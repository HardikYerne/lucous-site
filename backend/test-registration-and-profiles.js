/**
 * LUCOUS PHASE 1 — Registration and User Profiles Verification Suite
 * Tests avatar validation, public registration role guards, profile picture uploads,
 * login profile payloads, authenticated updates, and cross-user isolation.
 */

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const http = require("http");
const crypto = require("crypto");

const {
  validateAvatarFile,
  verifyImageSignature,
  MAX_AVATAR_SIZE_BYTES,
} = require("./services/avatar-validator");

// Helper to create a valid minimal 1x1 PNG image buffer
function createValidPngBuffer() {
  return Buffer.from([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, // PNG signature
    0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52, // IHDR header
    0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
    0x08, 0x06, 0x00, 0x00, 0x00, 0x1f, 0x15, 0xc4,
    0x89, 0x00, 0x00, 0x00, 0x0a, 0x49, 0x44, 0x41,
    0x54, 0x78, 0x9c, 0x63, 0x00, 0x01, 0x00, 0x00,
    0x05, 0x00, 0x01, 0x0d, 0x0a, 0x2d, 0xb4, 0x00,
    0x00, 0x00, 0x00, 0x49, 0x45, 0x4e, 0x44, 0xae,
    0x42, 0x60, 0x82,
  ]);
}

// Helper to create a valid minimal JPEG image buffer
function createValidJpegBuffer() {
  return Buffer.from([
    0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46,
    0x49, 0x46, 0x00, 0x01, 0x01, 0x01, 0x00, 0x48,
    0x00, 0x48, 0x00, 0x00, 0xff, 0xdb, 0x00, 0x43,
    0x00, 0x08, 0x06, 0x06, 0x07, 0x06, 0x05, 0x08,
    0xff, 0xd9,
  ]);
}

// Helper to create a multipart/form-data body buffer
function buildMultipartBody(boundary, fieldName, filename, mimeType, fileBuffer) {
  const header = Buffer.from(
    `--${boundary}\r\nContent-Disposition: form-data; name="${fieldName}"; filename="${filename}"\r\nContent-Type: ${mimeType}\r\n\r\n`
  );
  const footer = Buffer.from(`\r\n--${boundary}--\r\n`);
  return Buffer.concat([header, fileBuffer, footer]);
}

// Helper to make HTTP requests
function request(serverPort, options, body) {
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        hostname: "127.0.0.1",
        port: serverPort,
        ...options,
      },
      (res) => {
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => {
          let json = null;
          try {
            json = JSON.parse(data);
          } catch {}
          resolve({ status: res.statusCode, headers: res.headers, body: json || data });
        });
      }
    );

    req.on("error", reject);

    if (body) {
      if (Buffer.isBuffer(body)) {
        req.write(body);
      } else if (typeof body === "object") {
        req.write(JSON.stringify(body));
      } else {
        req.write(body);
      }
    }
    req.end();
  });
}

async function runPhase1VerificationSuite() {
  console.log("======================================================================");
  console.log("  LUCOUS PHASE 1 — REGISTRATION & USER PROFILES VERIFICATION SUITE");
  console.log("======================================================================\n");

  let passedTests = 0;
  let failedTests = 0;

  function pass(name) {
    passedTests++;
    console.log(`  [PASS] ${name}`);
  }

  function fail(name, err) {
    failedTests++;
    console.error(`  [FAIL] ${name}:`, err.message || err);
  }

  // -------------------------------------------------------------------------
  // 1. UNIT TESTS: Avatar Validator & Signatures
  // -------------------------------------------------------------------------
  try {
    const pngBuf = createValidPngBuffer();
    assert.strictEqual(verifyImageSignature(pngBuf, ".png"), true);
    const pngRes = validateAvatarFile({
      originalname: "student-avatar.png",
      mimetype: "image/png",
      buffer: pngBuf,
      size: pngBuf.length,
    });
    assert.strictEqual(pngRes.valid, true);
    assert.strictEqual(pngRes.extension, ".png");
    pass("[Validator] Validates authentic PNG image with binary signature");
  } catch (err) {
    fail("[Validator] Validates authentic PNG image", err);
  }

  try {
    const jpgBuf = createValidJpegBuffer();
    assert.strictEqual(verifyImageSignature(jpgBuf, ".jpg"), true);
    const jpgRes = validateAvatarFile({
      originalname: "photo.jpeg",
      mimetype: "image/jpeg",
      buffer: jpgBuf,
      size: jpgBuf.length,
    });
    assert.strictEqual(jpgRes.valid, true);
    assert.strictEqual(jpgRes.extension, ".jpg");
    pass("[Validator] Validates authentic JPEG image with binary signature");
  } catch (err) {
    fail("[Validator] Validates authentic JPEG image", err);
  }

  try {
    const fakeBuf = Buffer.from("MZThisIsAWindowsExecutablePayload1234567890");
    const fakeRes = validateAvatarFile({
      originalname: "malicious.png",
      mimetype: "image/png",
      buffer: fakeBuf,
      size: fakeBuf.length,
    });
    assert.strictEqual(fakeRes.valid, false);
    assert.match(fakeRes.error, /header signature/i);
    pass("[Validator] Strictly rejects executable spoofed with .png extension");
  } catch (err) {
    fail("[Validator] Rejects spoofed executable", err);
  }

  try {
    const docRes = validateAvatarFile({
      originalname: "document.pdf",
      mimetype: "application/pdf",
      buffer: Buffer.from("%PDF-1.4 minimal test"),
      size: 20,
    });
    assert.strictEqual(docRes.valid, false);
    assert.match(docRes.error, /Unsupported image format/i);
    pass("[Validator] Rejects unsupported document format (.pdf)");
  } catch (err) {
    fail("[Validator] Rejects unsupported format", err);
  }

  try {
    const hugeBuf = Buffer.alloc(MAX_AVATAR_SIZE_BYTES + 500);
    const hugeRes = validateAvatarFile({
      originalname: "too-large.png",
      mimetype: "image/png",
      buffer: hugeBuf,
      size: hugeBuf.length,
    });
    assert.strictEqual(hugeRes.valid, false);
    assert.match(hugeRes.error, /exceeds the 3MB/i);
    pass("[Validator] Strictly rejects oversized images (> 3MB)");
  } catch (err) {
    fail("[Validator] Rejects oversized image", err);
  }

  // -------------------------------------------------------------------------
  // 2. HTTP SERVER INTEGRATION TESTS
  // -------------------------------------------------------------------------
  // Start server on an isolated port for testing
  const testPort = 5098;
  process.env.PORT = String(testPort);
  process.env.JWT_SECRET = "test-jwt-secret-phase-1-lucous-key-2026";
  const app = require("./server");

  const server = app.listen(testPort);
  await new Promise((r) => server.once("listening", r));

  try {
    // -----------------------------------------------------------------------
    // Test: Public registration CANNOT assign Admin role
    // -----------------------------------------------------------------------
    const adminRegAttempt = await request(
      testPort,
      {
        path: "/api/auth/register",
        method: "POST",
        headers: { "Content-Type": "application/json" },
      },
      {
        name: "Hacker Admin",
        email: "hacker@evil.com",
        password: "password123",
        role: "ADMIN",
      }
    );
    assert.strictEqual(adminRegAttempt.status, 403);
    assert.strictEqual(adminRegAttempt.body.success, false);
    assert.match(adminRegAttempt.body.message, /not permitted for the ADMIN role/i);
    pass("[Security] Public registration strictly rejects assigning ADMIN role (403 Forbidden)");

    // Also test lowercase admin
    const adminLowerAttempt = await request(
      testPort,
      {
        path: "/api/auth/register",
        method: "POST",
        headers: { "Content-Type": "application/json" },
      },
      {
        name: "Hacker Admin 2",
        email: "hacker2@evil.com",
        password: "password123",
        role: "admin",
      }
    );
    assert.strictEqual(adminLowerAttempt.status, 403);
    pass("[Security] Public registration strictly rejects case-insensitive 'admin' role");

    // -----------------------------------------------------------------------
    // Test: Upload avatar endpoint (Public)
    // -----------------------------------------------------------------------
    const boundary = `----LucousTestBoundary${Date.now()}`;
    const pngImageBuffer = createValidPngBuffer();
    const multipartBody = buildMultipartBody(
      boundary,
      "avatar",
      "student-avatar.png",
      "image/png",
      pngImageBuffer
    );

    const uploadAvatarRes = await request(
      testPort,
      {
        path: "/api/auth/upload-avatar",
        method: "POST",
        headers: {
          "Content-Type": `multipart/form-data; boundary=${boundary}`,
          "Content-Length": multipartBody.length,
        },
      },
      multipartBody
    );

    assert.strictEqual(uploadAvatarRes.status, 201);
    assert.strictEqual(uploadAvatarRes.body.success, true);
    assert.ok(uploadAvatarRes.body.avatarUrl);
    assert.match(uploadAvatarRes.body.avatarUrl, /^\/api\/uploads\/avatar-.*\.png$/);
    const uploadedAvatarUrl = uploadAvatarRes.body.avatarUrl;
    pass(`[Upload] Uploaded profile picture successfully (${uploadedAvatarUrl})`);

    // Verify uploaded file can be served
    const fetchUploadedImage = await request(testPort, {
      path: uploadedAvatarUrl,
      method: "GET",
    });
    assert.strictEqual(fetchUploadedImage.status, 200);
    pass("[Upload] Uploaded picture is safely accessible via static/uploads endpoint");

    // -----------------------------------------------------------------------
    // Test: Register student WITH profile picture
    // -----------------------------------------------------------------------
    const studentWithPicEmail = `student_pic_${Date.now()}@lucous.test`;
    const regWithPicRes = await request(
      testPort,
      {
        path: "/api/auth/register/student",
        method: "POST",
        headers: { "Content-Type": "application/json" },
      },
      {
        name: "Priya Sharma",
        email: studentWithPicEmail,
        password: "SecretPassword123",
        avatarUrl: uploadedAvatarUrl,
        grade: "Class 10",
        board: "CBSE",
        school: "Delhi Public School",
      }
    );

    assert.strictEqual(regWithPicRes.status, 201);
    assert.strictEqual(regWithPicRes.body.success, true);
    assert.strictEqual(regWithPicRes.body.user.name, "Priya Sharma");
    assert.strictEqual(regWithPicRes.body.user.email, studentWithPicEmail);
    assert.strictEqual(regWithPicRes.body.user.role, "STUDENT");
    assert.strictEqual(regWithPicRes.body.user.avatarUrl, uploadedAvatarUrl);
    pass("[Register] Student registers with uploaded profile picture (avatarUrl persisted)");

    // -----------------------------------------------------------------------
    // Test: Register student WITHOUT picture (optional fallback)
    // -----------------------------------------------------------------------
    const studentNoPicEmail = `student_nopic_${Date.now()}@lucous.test`;
    const regNoPicRes = await request(
      testPort,
      {
        path: "/api/auth/register/student",
        method: "POST",
        headers: { "Content-Type": "application/json" },
      },
      {
        name: "Rahul Verma",
        email: studentNoPicEmail,
        password: "SecretPassword123",
        grade: "Class 10",
        board: "Maharashtra State Board",
      }
    );

    assert.strictEqual(regNoPicRes.status, 201);
    assert.strictEqual(regNoPicRes.body.success, true);
    assert.strictEqual(regNoPicRes.body.user.name, "Rahul Verma");
    assert.strictEqual(regNoPicRes.body.user.avatarUrl, null);
    pass("[Register] Student registers without picture; defaults safely to null for fallback avatar");

    // -----------------------------------------------------------------------
    // Test: Log in and verify actual name and picture
    // -----------------------------------------------------------------------
    const loginRes = await request(
      testPort,
      {
        path: "/api/auth/login",
        method: "POST",
        headers: { "Content-Type": "application/json" },
      },
      {
        email: studentWithPicEmail,
        password: "SecretPassword123",
      }
    );

    assert.strictEqual(loginRes.status, 200);
    assert.strictEqual(loginRes.body.success, true);
    assert.ok(loginRes.body.token);
    assert.strictEqual(loginRes.body.user.name, "Priya Sharma");
    assert.strictEqual(loginRes.body.user.avatarUrl, uploadedAvatarUrl);
    assert.strictEqual(loginRes.body.user.role, "STUDENT");
    const priyaToken = loginRes.body.token;
    pass("[Login] Authentication returns full name and active avatarUrl in trusted session payload");

    // -----------------------------------------------------------------------
    // Test: Fetch authenticated user (/api/auth/me)
    // -----------------------------------------------------------------------
    const meRes = await request(testPort, {
      path: "/api/auth/me",
      method: "GET",
      headers: { Authorization: `Bearer ${priyaToken}` },
    });

    assert.strictEqual(meRes.status, 200);
    assert.strictEqual(meRes.body.success, true);
    assert.strictEqual(meRes.body.user.name, "Priya Sharma");
    assert.strictEqual(meRes.body.user.avatarUrl, uploadedAvatarUrl);
    pass("[Auth/Me] GET /api/auth/me loads verified full name and profile picture from session token");

    // -----------------------------------------------------------------------
    // Test: Authenticated profile update (Name and fields)
    // -----------------------------------------------------------------------
    const updateProfileRes = await request(
      testPort,
      {
        path: "/api/auth/profile",
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${priyaToken}`,
        },
      },
      {
        name: "Priya S. Sharma",
        school: "Delhi Public School RK Puram",
      }
    );

    assert.strictEqual(updateProfileRes.status, 200);
    assert.strictEqual(updateProfileRes.body.success, true);
    assert.strictEqual(updateProfileRes.body.user.name, "Priya S. Sharma");
    assert.strictEqual(updateProfileRes.body.user.school, "Delhi Public School RK Puram");
    pass("[Profile] Authenticated student updates full name and details via PATCH /api/auth/profile");

    // -----------------------------------------------------------------------
    // Test: Update profile picture via authenticated upload (/api/auth/profile/avatar)
    // -----------------------------------------------------------------------
    const boundary2 = `----LucousTestBoundary2${Date.now()}`;
    const jpegImageBuffer = createValidJpegBuffer();
    const multipartBody2 = buildMultipartBody(
      boundary2,
      "avatar",
      "new-profile-pic.jpg",
      "image/jpeg",
      jpegImageBuffer
    );

    const updateAvatarRes = await request(
      testPort,
      {
        path: "/api/auth/profile/avatar",
        method: "POST",
        headers: {
          Authorization: `Bearer ${priyaToken}`,
          "Content-Type": `multipart/form-data; boundary=${boundary2}`,
          "Content-Length": multipartBody2.length,
        },
      },
      multipartBody2
    );

    assert.strictEqual(updateAvatarRes.status, 200);
    assert.strictEqual(updateAvatarRes.body.success, true);
    assert.ok(updateAvatarRes.body.avatarUrl);
    assert.match(updateAvatarRes.body.avatarUrl, /^\/api\/uploads\/avatar-.*\.jpg$/);
    const newAvatarUrl = updateAvatarRes.body.avatarUrl;
    pass(`[Profile] Updated picture via authenticated upload (${newAvatarUrl})`);

    // Verify persistence after refresh (new GET /api/auth/me)
    const meRefreshed = await request(testPort, {
      path: "/api/auth/me",
      method: "GET",
      headers: { Authorization: `Bearer ${priyaToken}` },
    });

    assert.strictEqual(meRefreshed.status, 200);
    assert.strictEqual(meRefreshed.body.user.name, "Priya S. Sharma");
    assert.strictEqual(meRefreshed.body.user.avatarUrl, newAvatarUrl);
    pass("[Persistence] Updated profile name and picture persist across subsequent session requests");

    // -----------------------------------------------------------------------
    // Test: Cross-User Isolation (User B cannot update User A's profile)
    // -----------------------------------------------------------------------
    // Register User B
    const userBEmail = `userb_${Date.now()}@lucous.test`;
    await request(
      testPort,
      {
        path: "/api/auth/register/student",
        method: "POST",
        headers: { "Content-Type": "application/json" },
      },
      {
        name: "User B",
        email: userBEmail,
        password: "SecretPassword123",
      }
    );

    const userBLogin = await request(
      testPort,
      {
        path: "/api/auth/login",
        method: "POST",
        headers: { "Content-Type": "application/json" },
      },
      {
        email: userBEmail,
        password: "SecretPassword123",
      }
    );
    const userBToken = userBLogin.body.token;

    // User B attempts to change name/avatar on behalf of User A (passes userId / id in body)
    const maliciousUpdate = await request(
      testPort,
      {
        path: "/api/auth/profile",
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${userBToken}`,
        },
      },
      {
        userId: regWithPicRes.body.user.id,
        id: regWithPicRes.body.user.id,
        name: "Hacked Name",
      }
    );

    assert.strictEqual(maliciousUpdate.status, 200);
    // User B's own profile should be updated to "Hacked Name"
    assert.strictEqual(maliciousUpdate.body.user.email, userBEmail);
    assert.strictEqual(maliciousUpdate.body.user.name, "Hacked Name");

    // Verify User A's profile is completely unchanged
    const userAVerify = await request(testPort, {
      path: "/api/auth/me",
      method: "GET",
      headers: { Authorization: `Bearer ${priyaToken}` },
    });

    assert.strictEqual(userAVerify.body.user.name, "Priya S. Sharma");
    assert.strictEqual(userAVerify.body.user.avatarUrl, newAvatarUrl);
    pass("[Isolation] Cross-User Isolation: User B cannot modify User A's profile under any circumstances");

    // Unauthenticated update attempt
    const unauthUpdate = await request(
      testPort,
      {
        path: "/api/auth/profile",
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
      },
      { name: "Unauthorized Attempt" }
    );
    assert.strictEqual(unauthUpdate.status, 401);
    pass("[Security] Unauthenticated profile modifications are rejected with 401 Unauthorized");
  } finally {
    server.close();
  }

  console.log("\n======================================================================");
  console.log(`  PHASE 1 TEST RESULTS: ${passedTests} PASSED, ${failedTests} FAILED`);
  console.log("======================================================================\n");

  if (failedTests > 0) {
    process.exit(1);
  }
}

runPhase1VerificationSuite().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
