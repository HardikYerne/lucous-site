/**
 * LUCOUS PHASE 2 — Teacher Identity & Admin Approval Verification Suite
 * Tests:
 * 1. Document validation & magic byte security.
 * 2. Teacher registration with default PENDING status and blocked teaching tools.
 * 3. Confidential document upload and access isolation.
 * 4. Unauthorized approval attempt blocks (self-approval, student, unauthenticated).
 * 5. Rejection flow with required reason and resubmission.
 * 6. Admin approval flow, reviewer tracking, and unlocking of protected teacher APIs.
 */

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const http = require("http");
const crypto = require("crypto");
const jwt = require("jsonwebtoken");

const {
  validateTeacherDocument,
  verifyDocumentSignature,
  MAX_DOC_SIZE_BYTES,
  APPLICATION_STATUS,
} = require("./services/teacher-application-service");

// Helper to create valid minimal PDF buffer (%PDF-1.4 header)
function createValidPdfBuffer() {
  const content = "%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\ntrailer\n<< /Root 1 0 R >>\n%%EOF";
  return Buffer.from(content, "utf-8");
}

// Helper to create valid minimal PNG buffer
function createValidPngBuffer() {
  return Buffer.from([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
    0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
    0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
    0x08, 0x06, 0x00, 0x00, 0x00, 0x1f, 0x15, 0xc4,
    0x89, 0x00, 0x00, 0x00, 0x0a, 0x49, 0x44, 0x41,
    0x54, 0x78, 0x9c, 0x63, 0x00, 0x01, 0x00, 0x00,
    0x05, 0x00, 0x01, 0x0d, 0x0a, 0x2d, 0xb4, 0x00,
    0x00, 0x00, 0x00, 0x49, 0x45, 0x4e, 0x44, 0xae,
    0x42, 0x60, 0x82,
  ]);
}

// Helper to create multipart body
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

async function runTeacherApprovalTestSuite() {
  console.log("======================================================================");
  console.log("  LUCOUS PHASE 2 — TEACHER IDENTITY & ADMIN APPROVAL VERIFICATION");
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
  // 1. UNIT TESTS: Document Validation & Magic Bytes
  // -------------------------------------------------------------------------
  try {
    const pdfBuf = createValidPdfBuffer();
    assert.strictEqual(verifyDocumentSignature(pdfBuf, ".pdf"), true);
    const pdfRes = validateTeacherDocument({
      originalname: "degree-certificate.pdf",
      mimetype: "application/pdf",
      buffer: pdfBuf,
      size: pdfBuf.length,
    });
    assert.strictEqual(pdfRes.valid, true);
    assert.strictEqual(pdfRes.extension, ".pdf");
    pass("[Validator] Validates authentic PDF document with %PDF- header");
  } catch (err) {
    fail("[Validator] Validates authentic PDF document", err);
  }

  try {
    const pngBuf = createValidPngBuffer();
    assert.strictEqual(verifyDocumentSignature(pngBuf, ".png"), true);
    const pngRes = validateTeacherDocument({
      originalname: "teaching-id.png",
      mimetype: "image/png",
      buffer: pngBuf,
      size: pngBuf.length,
    });
    assert.strictEqual(pngRes.valid, true);
    assert.strictEqual(pngRes.extension, ".png");
    pass("[Validator] Validates authentic image credential (PNG)");
  } catch (err) {
    fail("[Validator] Validates authentic image credential", err);
  }

  try {
    const fakeBuf = Buffer.from("MZExecutableBinaryHeaderPayloadPadding123456789");
    const fakeRes = validateTeacherDocument({
      originalname: "malicious-cert.pdf",
      mimetype: "application/pdf",
      buffer: fakeBuf,
      size: fakeBuf.length,
    });
    assert.strictEqual(fakeRes.valid, false);
    assert.match(fakeRes.error, /signature/i);
    pass("[Validator] Strictly rejects executable spoofed with .pdf extension");
  } catch (err) {
    fail("[Validator] Rejects spoofed executable", err);
  }

  try {
    const hugeBuf = Buffer.alloc(MAX_DOC_SIZE_BYTES + 1024);
    const hugeRes = validateTeacherDocument({
      originalname: "oversized-doc.pdf",
      mimetype: "application/pdf",
      buffer: hugeBuf,
      size: hugeBuf.length,
    });
    assert.strictEqual(hugeRes.valid, false);
    assert.match(hugeRes.error, /10MB limit/i);
    pass("[Validator] Strictly rejects oversized documents (> 10MB)");
  } catch (err) {
    fail("[Validator] Rejects oversized document", err);
  }

  // -------------------------------------------------------------------------
  // 2. HTTP SERVER INTEGRATION TESTS
  // -------------------------------------------------------------------------
  const testPort = 5097;
  process.env.PORT = String(testPort);
  process.env.JWT_SECRET = "test-jwt-secret-phase-2-teacher-lucous";
  const app = require("./server");

  const server = app.listen(testPort);
  await new Promise((r) => server.once("listening", r));

  try {
    // -----------------------------------------------------------------------
    // A. Teacher Registration & Default PENDING Status
    // -----------------------------------------------------------------------
    const teacherEmail = `teacher_${Date.now()}@lucous.test`;
    const regRes = await request(
      testPort,
      {
        path: "/api/auth/register/teacher",
        method: "POST",
        headers: { "Content-Type": "application/json" },
      },
      {
        name: "Professor Anand Verma",
        email: teacherEmail,
        password: "TeacherPassword123",
        school: "Delhi Public School",
        subject: "Physics",
      }
    );

    assert.strictEqual(regRes.status, 201);
    assert.strictEqual(regRes.body.success, true);
    assert.strictEqual(regRes.body.user.role, "TEACHER");
    const teacherId = regRes.body.user.id;
    pass("[Registration] New teacher registers successfully");

    // Login as new teacher
    const loginRes = await request(
      testPort,
      {
        path: "/api/auth/login",
        method: "POST",
        headers: { "Content-Type": "application/json" },
      },
      {
        email: teacherEmail,
        password: "TeacherPassword123",
      }
    );

    assert.strictEqual(loginRes.status, 200);
    assert.strictEqual(loginRes.body.user.isVerified, false);
    assert.ok(loginRes.body.user.teacherApplication);
    assert.strictEqual(loginRes.body.user.teacherApplication.status, "PENDING");
    const teacherToken = loginRes.body.token;
    pass("[Status] Newly registered teacher defaults to PENDING status and isVerified=false");

    // -----------------------------------------------------------------------
    // B. Pending Teacher Blocked from Protected Teaching APIs
    // -----------------------------------------------------------------------
    const blockedMaterials = await request(testPort, {
      path: "/api/teacher/materials",
      method: "GET",
      headers: { Authorization: `Bearer ${teacherToken}` },
    });
    assert.strictEqual(blockedMaterials.status, 403);
    assert.strictEqual(blockedMaterials.body.code, "TEACHER_APPROVAL_PENDING");
    assert.match(blockedMaterials.body.message, /pending admin review/i);
    pass("[Security] Pending teacher is blocked from /api/teacher/materials (403 TEACHER_APPROVAL_PENDING)");

    const blockedPublish = await request(
      testPort,
      {
        path: "/api/teacher/publish",
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${teacherToken}`,
        },
      },
      {
        contentType: "LESSON",
        contentId: "dummy-id",
      }
    );
    assert.strictEqual(blockedPublish.status, 403);
    assert.strictEqual(blockedPublish.body.code, "TEACHER_APPROVAL_PENDING");
    pass("[Security] Pending teacher is blocked from lesson publishing /api/teacher/publish (403)");

    const blockedCourses = await request(
      testPort,
      {
        path: "/api/courses",
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${teacherToken}`,
        },
      },
      {
        title: "Advanced Physics",
        subject: "Physics",
      }
    );
    assert.strictEqual(blockedCourses.status, 403);
    assert.strictEqual(blockedCourses.body.code, "TEACHER_APPROVAL_PENDING");
    pass("[Security] Pending teacher is blocked from course creation /api/courses (403)");

    // -----------------------------------------------------------------------
    // C. Teacher Document Upload & Confidentiality Checks
    // -----------------------------------------------------------------------
    const boundary = `----LucousDocBoundary${Date.now()}`;
    const pdfDocBuf = createValidPdfBuffer();
    const multipartBody = buildMultipartBody(
      boundary,
      "document",
      "master-degree.pdf",
      "application/pdf",
      pdfDocBuf
    );

    const docUploadRes = await request(
      testPort,
      {
        path: "/api/teacher/application/document",
        method: "POST",
        headers: {
          Authorization: `Bearer ${teacherToken}`,
          "Content-Type": `multipart/form-data; boundary=${boundary}`,
          "Content-Length": multipartBody.length,
        },
      },
      multipartBody
    );

    assert.strictEqual(docUploadRes.status, 201);
    assert.strictEqual(docUploadRes.body.success, true);
    assert.ok(docUploadRes.body.document);
    assert.ok(docUploadRes.body.document.url);
    const uploadedDocUrl = docUploadRes.body.document.url;
    pass(`[Upload] Supporting credential document uploaded safely (${uploadedDocUrl})`);

    // Complete application submission
    const submitAppRes = await request(
      testPort,
      {
        path: "/api/teacher/application",
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${teacherToken}`,
        },
      },
      {
        name: "Dr. Anand Verma",
        institution: "Indian Institute of Science",
        subjects: "Physics, Quantum Mechanics",
        qualifications: "Ph.D in Theoretical Physics, M.Sc (First Class)",
        experience: "12 years teaching undergraduate and senior secondary students",
        documents: [docUploadRes.body.document],
      }
    );

    assert.strictEqual(submitAppRes.status, 200);
    assert.strictEqual(submitAppRes.body.success, true);
    assert.strictEqual(submitAppRes.body.application.status, "PENDING");
    assert.strictEqual(submitAppRes.body.application.qualifications, "Ph.D in Theoretical Physics, M.Sc (First Class)");
    pass("[Application] Teacher submits application with qualifications, experience, and documents");

    // Document Confidentiality: Unauthenticated request must be rejected
    const unauthDoc = await request(testPort, {
      path: uploadedDocUrl,
      method: "GET",
    });
    assert.strictEqual(unauthDoc.status, 401);
    pass("[Confidentiality] Unauthenticated request for supporting document rejected (401)");

    // Document Confidentiality: Another teacher (Teacher B) must be rejected
    const teacherBToken = jwt.sign(
      { userId: "teacher-b-intruder", role: "TEACHER" },
      process.env.JWT_SECRET
    );
    const teacherBDoc = await request(testPort, {
      path: uploadedDocUrl,
      method: "GET",
      headers: { Authorization: `Bearer ${teacherBToken}` },
    });
    assert.strictEqual(teacherBDoc.status, 403);
    assert.match(teacherBDoc.body.message, /confidential/i);
    pass("[Confidentiality] Cross-teacher document access is strictly blocked (403 Forbidden)");

    // Document Confidentiality: Applicant teacher CAN access their own document
    const ownerDoc = await request(testPort, {
      path: uploadedDocUrl,
      method: "GET",
      headers: { Authorization: `Bearer ${teacherToken}` },
    });
    assert.strictEqual(ownerDoc.status, 200);
    pass("[Confidentiality] Applicant teacher can access their own uploaded document");

    // -----------------------------------------------------------------------
    // D. Unauthorized Approval Attempts
    // -----------------------------------------------------------------------
    // Teacher attempts to approve themselves
    const selfApprove = await request(
      testPort,
      {
        path: `/api/admin/teacher-applications/${teacherId}/decision`,
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${teacherToken}`,
        },
      },
      { status: "APPROVED" }
    );
    assert.strictEqual(selfApprove.status, 403);
    pass("[Security] Teacher cannot approve themselves or call admin decision endpoint (403)");

    // Create Admin Token
    const adminToken = jwt.sign(
      { userId: "admin-platform-user", role: "ADMIN" },
      process.env.JWT_SECRET
    );

    // Admin lists applications
    const listApps = await request(testPort, {
      path: "/api/admin/teacher-applications?status=ALL",
      method: "GET",
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert.strictEqual(listApps.status, 200);
    assert.strictEqual(listApps.body.success, true);
    assert.ok(listApps.body.applications.length >= 1);
    pass("[Admin] Authorized admin successfully lists teacher applications");

    // Admin can access confidential supporting document
    const adminDoc = await request(testPort, {
      path: uploadedDocUrl,
      method: "GET",
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert.strictEqual(adminDoc.status, 200);
    pass("[Admin] Authorized admin can inspect applicant's supporting documents");

    // -----------------------------------------------------------------------
    // E. Admin Rejection with Reason & Teacher Resubmission
    // -----------------------------------------------------------------------
    // Attempt rejection without reason -> must fail with 400
    const rejectNoReason = await request(
      testPort,
      {
        path: `/api/admin/teacher-applications/${teacherId}/decision`,
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${adminToken}`,
        },
      },
      { status: "REJECTED", reason: "" }
    );
    assert.strictEqual(rejectNoReason.status, 400);
    assert.match(rejectNoReason.body.message, /rejection reason is required/i);
    pass("[Admin] Rejection requires a non-empty feedback reason (400 Bad Request)");

    // Perform valid rejection
    const rejectValid = await request(
      testPort,
      {
        path: `/api/admin/teacher-applications/${teacherId}/decision`,
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${adminToken}`,
        },
      },
      {
        status: "REJECTED",
        reason: "Please upload a clearer institutional appointment letter with signature.",
      }
    );
    assert.strictEqual(rejectValid.status, 200);
    assert.strictEqual(rejectValid.body.application.status, "REJECTED");
    assert.strictEqual(
      rejectValid.body.application.rejectionReason,
      "Please upload a clearer institutional appointment letter with signature."
    );
    assert.ok(rejectValid.body.application.reviewedAt);
    pass("[Admin] Admin rejects application with reason, decision timestamp recorded");

    // Rejected teacher is blocked with specific rejection code and message
    const rejectedAccess = await request(testPort, {
      path: "/api/teacher/materials",
      method: "GET",
      headers: { Authorization: `Bearer ${teacherToken}` },
    });
    assert.strictEqual(rejectedAccess.status, 403);
    assert.strictEqual(rejectedAccess.body.code, "TEACHER_APPROVAL_REJECTED");
    assert.match(rejectedAccess.body.message, /rejected/i);
    assert.strictEqual(
      rejectedAccess.body.rejectionReason,
      "Please upload a clearer institutional appointment letter with signature."
    );
    pass("[Security] Rejected teacher is blocked with 403 TEACHER_APPROVAL_REJECTED and feedback");

    // Teacher resubmits corrected application
    const resubmitApp = await request(
      testPort,
      {
        path: "/api/teacher/application",
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${teacherToken}`,
        },
      },
      {
        name: "Dr. Anand Verma",
        institution: "Indian Institute of Science Bangalore",
        subjects: "Physics, Quantum Mechanics",
        qualifications: "Ph.D in Theoretical Physics (IISc), Certified Senior Faculty",
        experience: "12 years university and high school teaching",
        documents: [docUploadRes.body.document],
      }
    );
    assert.strictEqual(resubmitApp.status, 200);
    assert.strictEqual(resubmitApp.body.application.status, "PENDING");
    assert.strictEqual(resubmitApp.body.application.rejectionReason, null);
    pass("[Resubmission] Teacher resubmits application; status transitions back to PENDING");

    // -----------------------------------------------------------------------
    // F. Admin Approval & Full Teaching Capabilities Unlock
    // -----------------------------------------------------------------------
    const approveRes = await request(
      testPort,
      {
        path: `/api/admin/teacher-applications/${teacherId}/decision`,
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${adminToken}`,
        },
      },
      { status: "APPROVED" }
    );
    assert.strictEqual(approveRes.status, 200);
    assert.strictEqual(approveRes.body.application.status, "APPROVED");
    assert.ok(approveRes.body.application.reviewedAt);
    pass("[Admin] Admin explicitly approves teacher application");

    // Teacher gets application status
    const verifiedApp = await request(testPort, {
      path: "/api/teacher/application",
      method: "GET",
      headers: { Authorization: `Bearer ${teacherToken}` },
    });
    assert.strictEqual(verifiedApp.status, 200);
    assert.strictEqual(verifiedApp.body.application.status, "APPROVED");
    pass("[Teacher] Teacher application status reflects APPROVED");

    // Protected teaching endpoints are now UNLOCKED
    const unlockedMaterials = await request(testPort, {
      path: "/api/teacher/materials",
      method: "GET",
      headers: { Authorization: `Bearer ${teacherToken}` },
    });
    assert.strictEqual(unlockedMaterials.status, 200);
    assert.strictEqual(unlockedMaterials.body.success, true);
    pass("[Unlock] Protected /api/teacher/materials is now accessible to approved teacher (200 OK)");
  } finally {
    server.close();
  }

  console.log("\n======================================================================");
  console.log(`  PHASE 2 TEST RESULTS: ${passedTests} PASSED, ${failedTests} FAILED`);
  console.log("======================================================================\n");

  if (failedTests > 0) {
    process.exit(1);
  }
}

runTeacherApprovalTestSuite().catch((err) => {
  console.error("Test execution error:", err);
  process.exit(1);
});
