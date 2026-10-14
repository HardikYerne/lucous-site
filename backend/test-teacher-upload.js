/**
 * LUCOUS Phase 3.1 & 3.1.1 — Teacher Content Upload Stability & Hardening Test Suite
 * 
 * Verifies:
 * 1. Teacher Authorization & Role Verification
 * 2. Cross-Teacher Ownership Isolation
 * 3. File Type & Extension Validation
 * 4. Deep OpenXML DOCX & Magic Byte Signature Validation (Anti-Spoofing & Anti-Masquerading)
 * 5. Safe Filename Sanitization (Anti-Path Traversal & Anti-XSS)
 * 6. File Size Constraints (Empty 0-byte & Oversized >15MB)
 * 7. Curriculum Metadata Validation (School 1-12 & Diploma Schemes)
 * 8. Storage Adapter Safety (UUID generation, Path Traversal Prevention)
 * 9. Anti-Orphan Storage Rollback on Database Failure
 * 10. Explicit Persistence & Ephemeral Mode Flagging
 * 11. Material Retrieval & Safe Deletion Lifecycle
 */

const assert = require("assert");
const http = require("http");
const fs = require("fs");
const path = require("path");
const express = require("express");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");

// Set environment for test mode
process.env.ALLOW_EPHEMERAL_DEV_STORAGE = "true";
process.env.NODE_ENV = "test";

const { createTeacherMaterialsRouter } = require("./routes/teacher-materials");
const { validateFile, validateUploadedFile } = require("./services/file-validator");
const { validateCurriculum } = require("./services/curriculum-validator");
const { LocalStorageAdapter, getStorageAdapter } = require("./storage/storage-adapter");

const JWT_SECRET = process.env.JWT_SECRET || "lucous-secret-key-change-in-production";

console.log("======================================================================");
console.log("  LUCOUS PHASE 3.1.1 — TEACHER CONTENT UPLOAD STABILITY & HARDENING");
console.log("======================================================================");

let passedCount = 0;
let failedCount = 0;

function runSyncTest(name, fn) {
  try {
    fn();
    console.log(`  [PASS] ${name}`);
    passedCount++;
  } catch (err) {
    console.error(`  [FAIL] ${name}`);
    console.error(`         ${err.message}`);
    failedCount++;
  }
}

async function runAsyncTest(name, fn) {
  try {
    await fn();
    console.log(`  [PASS] ${name}`);
    passedCount++;
  } catch (err) {
    console.error(`  [FAIL] ${name}`);
    console.error(`         ${err.message}`);
    failedCount++;
  }
}

// Generate JWT tokens for test roles
function generateToken(userId, role) {
  return jwt.sign({ userId, role }, JWT_SECRET, { expiresIn: "1h" });
}

const TEACHER_A_TOKEN = generateToken("teacher_user_a", "TEACHER");
const TEACHER_B_TOKEN = generateToken("teacher_user_b", "TEACHER");
const STUDENT_TOKEN = generateToken("student_user_1", "STUDENT");
const PARENT_TOKEN = generateToken("parent_user_1", "PARENT");

// Test helper: role middleware identical to server.js
function requireTeacherMiddleware(req, res, next) {
  const authHeader = req.headers.authorization || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token) {
    return res.status(401).json({ success: false, message: "Not authenticated" });
  }
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    if (payload.role !== "TEACHER") {
      return res.status(403).json({ success: false, message: "teacher access only" });
    }
    req.userId = payload.userId;
    req.role = payload.role;
    next();
  } catch (err) {
    return res.status(401).json({ success: false, message: "Invalid or expired token" });
  }
}

// Spin up a test Express server
function createTestServer(mockPrismaOverride = null) {
  const app = express();
  app.use(express.json());

  // Mount teacher router with mock prisma
  const mockPrisma = mockPrismaOverride || {
    uploadedMaterial: {
      create: async () => { throw new Error("Database offline in test mode"); },
      findMany: async () => { throw new Error("Database offline in test mode"); },
      findUnique: async () => { throw new Error("Database offline in test mode"); },
      findFirst: async () => { throw new Error("Database offline in test mode"); },
      delete: async () => { throw new Error("Database offline in test mode"); },
    },
  };

  app.use("/api/teacher", createTeacherMaterialsRouter(mockPrisma, requireTeacherMiddleware));

  const server = http.createServer(app);
  return new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => {
      const port = server.address().port;
      resolve({
        server,
        baseUrl: `http://127.0.0.1:${port}`,
        close: () => new Promise((cb) => server.close(cb)),
      });
    });
  });
}

async function main() {
  const { baseUrl, close } = await createTestServer();

  try {
    // ======================================================================
    // 1. UNIT TESTS: Curriculum Validator
    // ======================================================================
    console.log("\n--- Group 1: Curriculum Metadata Validator Tests ---");

    runSyncTest("Curriculum: Accepts valid school metadata (Class 10 CBSE)", () => {
      const result = validateCurriculum({
        educationLevel: "school",
        classGrade: "10",
        board: "cbse",
        subjectName: "Mathematics",
        language: "en",
      });
      assert.strictEqual(result.isValid, true);
      assert.strictEqual(result.data.classGrade, "10");
      assert.strictEqual(result.data.board, "cbse");
      assert.strictEqual(result.data.subjectName, "Mathematics");
    });

    runSyncTest("Curriculum: Accepts valid higher secondary school with stream", () => {
      const result = validateCurriculum({
        educationLevel: "school",
        classGrade: "12",
        board: "msbshse",
        stream: "science",
        subjectName: "Physics",
        language: "mr",
      });
      assert.strictEqual(result.isValid, true);
      assert.strictEqual(result.data.stream, "science");
      assert.strictEqual(result.data.language, "mr");
    });

    runSyncTest("Curriculum: Accepts valid diploma metadata (CO K-Scheme Sem 3)", () => {
      const result = validateCurriculum({
        educationLevel: "diploma",
        branch: "co",
        scheme: "k_scheme",
        semester: "3",
        subjectName: "Data Structures",
        language: "en",
      });
      assert.strictEqual(result.isValid, true);
      assert.strictEqual(result.data.educationLevel, "diploma");
      assert.strictEqual(result.data.branch, "computer");
      assert.strictEqual(result.data.scheme, "k_scheme");
      assert.strictEqual(result.data.semester, 3);
    });

    runSyncTest("Curriculum: Rejects invalid education level", () => {
      const result = validateCurriculum({
        educationLevel: "preschool",
        subjectName: "Math",
      });
      assert.strictEqual(result.isValid, false);
      assert.match(result.error, /educationLevel must be/i);
    });

    runSyncTest("Curriculum: Rejects invalid school class grade (> 12)", () => {
      const result = validateCurriculum({
        educationLevel: "school",
        classGrade: "14",
        board: "cbse",
        subjectName: "Math",
      });
      assert.strictEqual(result.isValid, false);
      assert.match(result.error, /class grade must be between 1 and 12/i);
    });

    runSyncTest("Curriculum: Rejects invalid diploma semester (> 8)", () => {
      const result = validateCurriculum({
        educationLevel: "diploma",
        branch: "co",
        scheme: "k_scheme",
        semester: "10",
        subjectName: "Math",
      });
      assert.strictEqual(result.isValid, false);
      assert.match(result.error, /semester must be an integer between 1 and 8/i);
    });

    runSyncTest("Curriculum: Rejects missing subjectName", () => {
      const result = validateCurriculum({
        educationLevel: "school",
        classGrade: "9",
        board: "cbse",
        subjectName: "   ",
      });
      assert.strictEqual(result.isValid, false);
      assert.match(result.error, /subjectName is required/i);
    });

    // ======================================================================
    // 2. UNIT TESTS: File Validator & Binary Signature Tests
    // ======================================================================
    console.log("\n--- Group 2: File Validator & Binary Signature Tests ---");

    runSyncTest("FileValidator: Accepts valid PDF buffer with %PDF header", () => {
      const pdfBuffer = Buffer.concat([
        Buffer.from("%PDF-1.5\n"),
        Buffer.from("1 0 obj\n<< /Type /Catalog >>\nendobj\ntrailer\n<< /Root 1 0 R >>\n%%EOF"),
      ]);
      const result = validateFile(pdfBuffer, "sample_notes.pdf");
      assert.strictEqual(result.isValid, true);
      assert.strictEqual(result.extension, ".pdf");
      assert.strictEqual(result.mimeType, "application/pdf");
      assert(result.checksum.length === 64, "Should generate 64-char sha256 checksum");
    });

    runSyncTest("FileValidator: Accepts valid DOCX with PK header AND OpenXML parts", () => {
      const docxHeader = Buffer.from([0x50, 0x4B, 0x03, 0x04]);
      const docxBody = Buffer.from("PK\x03\x04[Content_Types].xml\x00\x00PK\x03\x04word/document.xml\x00\x00payload bytes");
      const docxBuffer = Buffer.concat([docxHeader, docxBody]);

      const result = validateFile(docxBuffer, "lesson_plan.docx");
      assert.strictEqual(result.isValid, true);
      assert.strictEqual(result.extension, ".docx");
      assert.strictEqual(result.mimeType, "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
    });

    runSyncTest("FileValidator: Rejects generic ZIP file renamed as .docx (anti-masquerading)", () => {
      const rawZipHeader = Buffer.from([0x50, 0x4B, 0x03, 0x04]);
      const rawZipBody = Buffer.from("PK\x03\x04malware_executable.exe\x00\x00arbitrary binary");
      const fakeDocxBuffer = Buffer.concat([rawZipHeader, rawZipBody]);

      const result = validateFile(fakeDocxBuffer, "notes.docx");
      assert.strictEqual(result.isValid, false);
      assert.match(result.error, /signature mismatch/i);
    });

    runSyncTest("FileValidator: Accepts valid PNG buffer with PNG signature", () => {
      const pngHeader = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
      const pngBody = Buffer.from("fake png pixel chunks");
      const pngBuffer = Buffer.concat([pngHeader, pngBody]);

      const result = validateFile(pngBuffer, "diagram.png");
      assert.strictEqual(result.isValid, true);
      assert.strictEqual(result.extension, ".png");
      assert.strictEqual(result.mimeType, "image/png");
    });

    runSyncTest("FileValidator: Accepts valid JPEG buffer with JPEG signature", () => {
      const jpegHeader = Buffer.from([0xFF, 0xD8, 0xFF, 0xE0]);
      const jpegBody = Buffer.from("fake jpeg payload");
      const jpegBuffer = Buffer.concat([jpegHeader, jpegBody]);

      const result = validateFile(jpegBuffer, "whiteboard.jpg");
      assert.strictEqual(result.isValid, true);
      assert.strictEqual(result.extension, ".jpg");
      assert.strictEqual(result.mimeType, "image/jpeg");
    });

    runSyncTest("FileValidator: Accepts valid TXT buffer with plain text", () => {
      const txtBuffer = Buffer.from("Course syllabus and weekly schedule for 2026-2027.", "utf-8");
      const result = validateFile(txtBuffer, "syllabus.txt");
      assert.strictEqual(result.isValid, true);
      assert.strictEqual(result.extension, ".txt");
      assert.strictEqual(result.mimeType, "text/plain");
    });

    runSyncTest("FileValidator: Rejects empty (0-byte) file", () => {
      const emptyBuffer = Buffer.alloc(0);
      const result = validateFile(emptyBuffer, "empty.pdf");
      assert.strictEqual(result.isValid, false);
      assert.match(result.error, /file is empty \(0 bytes\)/i);
    });

    runSyncTest("FileValidator: Rejects disallowed file extension (.exe, .sh, .py)", () => {
      const exeBuffer = Buffer.from("MZ dummy program");
      const result = validateFile(exeBuffer, "malware.exe");
      assert.strictEqual(result.isValid, false);
      assert.match(result.error, /unsupported file type/i);
    });

    runSyncTest("FileValidator: Anti-spoofing rejects Windows PE executable disguised as .pdf", () => {
      const fakePdfBuffer = Buffer.concat([
        Buffer.from([0x4D, 0x5A, 0x90, 0x00]),
        Buffer.from("This is a malicious PE binary disguised as notes.pdf"),
      ]);
      const result = validateFile(fakePdfBuffer, "notes.pdf");
      assert.strictEqual(result.isValid, false);
      assert.match(result.error, /signature mismatch/i);
    });

    runSyncTest("FileValidator: Anti-spoofing rejects non-zip file disguised as .docx", () => {
      const fakeDocxBuffer = Buffer.from("Random text without PK header");
      const result = validateFile(fakeDocxBuffer, "notes.docx");
      assert.strictEqual(result.isValid, false);
      assert.match(result.error, /signature mismatch/i);
    });

    runSyncTest("FileValidator: Rejects text file containing null bytes or binary executable markers", () => {
      const binaryInTxt = Buffer.from([0x4D, 0x5A, 0x00, 0x00, 0x65, 0x66]);
      const result = validateFile(binaryInTxt, "notes.txt");
      assert.strictEqual(result.isValid, false);
      assert.match(result.error, /signature mismatch/i);
    });

    runSyncTest("FileValidator: Safely sanitizes malicious filename with XSS and path traversal", () => {
      const validPdfBuffer = Buffer.from("%PDF-1.4 dummy content %%EOF");
      const dangerousFile = {
        originalname: "../../<script>alert('xss')</script>lesson#1.pdf",
        buffer: validPdfBuffer,
        size: validPdfBuffer.length,
      };
      const result = validateUploadedFile(dangerousFile);
      assert.strictEqual(result.valid, true);
      assert(!result.sanitized.originalName.includes("<script>"), "Must strip script tags");
      assert(!result.sanitized.originalName.includes("../"), "Must strip path traversal");
      assert(result.sanitized.originalName.endsWith(".pdf"), "Must preserve extension");
    });

    // ======================================================================
    // 3. UNIT TESTS: Storage Adapter Safety
    // ======================================================================
    console.log("\n--- Group 3: Storage Adapter Safety Tests ---");

    await runAsyncTest("StorageAdapter: Generates safe UUID key and writes file", async () => {
      const adapter = getStorageAdapter();
      const content = Buffer.from("%PDF-1.4 test safe write");
      const saved = await adapter.saveFile(content, "original_user_file.pdf", ".pdf", "application/pdf");

      assert(saved.storageKey, "Should have a storageKey");
      assert(!saved.storageKey.includes("original_user_file"), "Storage key must NOT use raw user filename");
      assert(saved.storageKey.endsWith(".pdf"), "Storage key should preserve safe extension");
      assert.strictEqual(saved.fileSizeBytes, content.length);

      // Verify file exists on disk
      const readBack = await adapter.readFile(saved.storageKey);
      assert.deepStrictEqual(readBack, content);

      // Clean up
      const deleted = await adapter.deleteFile(saved.storageKey);
      assert.strictEqual(deleted, true);
    });

    runSyncTest("StorageAdapter: Path traversal prevention in keys", () => {
      const adapter = getStorageAdapter();
      assert.throws(() => {
        adapter.resolvePath("../../../etc/passwd");
      }, /Path traversal attempt detected/);
    });

    // ======================================================================
    // 4. INTEGRATION TESTS: HTTP API & Teacher Authorization
    // ======================================================================
    console.log("\n--- Group 4: HTTP API Teacher Authorization Tests ---");

    await runAsyncTest("API Auth: Rejects unauthenticated GET /api/teacher/materials with 401", async () => {
      const res = await fetch(`${baseUrl}/api/teacher/materials`);
      assert.strictEqual(res.status, 401);
      const data = await res.json();
      assert.strictEqual(data.success, false);
      assert.match(data.message, /not authenticated/i);
    });

    await runAsyncTest("API Auth: Rejects STUDENT role with 403 Forbidden", async () => {
      const res = await fetch(`${baseUrl}/api/teacher/materials`, {
        headers: { Authorization: `Bearer ${STUDENT_TOKEN}` },
      });
      assert.strictEqual(res.status, 403);
      const data = await res.json();
      assert.strictEqual(data.success, false);
      assert.match(data.message, /teacher access only/i);
    });

    await runAsyncTest("API Auth: Rejects PARENT role with 403 Forbidden", async () => {
      const res = await fetch(`${baseUrl}/api/teacher/materials`, {
        headers: { Authorization: `Bearer ${PARENT_TOKEN}` },
      });
      assert.strictEqual(res.status, 403);
      const data = await res.json();
      assert.strictEqual(data.success, false);
      assert.match(data.message, /teacher access only/i);
    });

    await runAsyncTest("API Auth: Accepts TEACHER role with 200 OK", async () => {
      const res = await fetch(`${baseUrl}/api/teacher/materials`, {
        headers: { Authorization: `Bearer ${TEACHER_A_TOKEN}` },
      });
      assert.strictEqual(res.status, 200);
      const data = await res.json();
      assert.strictEqual(data.success, true);
      assert(Array.isArray(data.materials));
    });

    // ======================================================================
    // 5. INTEGRATION TESTS: Multipart Upload Workflow & Validation
    // ======================================================================
    console.log("\n--- Group 5: HTTP Multipart Upload Workflow Tests ---");

    await runAsyncTest("API Upload: Rejects request with missing file (400)", async () => {
      const formData = new FormData();
      formData.append("educationLevel", "school");
      formData.append("classGrade", "10");
      formData.append("board", "cbse");
      formData.append("subjectName", "Mathematics");
      formData.append("language", "en");

      const res = await fetch(`${baseUrl}/api/teacher/materials/upload`, {
        method: "POST",
        headers: { Authorization: `Bearer ${TEACHER_A_TOKEN}` },
        body: formData,
      });

      assert.strictEqual(res.status, 400);
      const data = await res.json();
      assert.strictEqual(data.success, false);
      assert.match(data.message, /no file/i);
    });

    await runAsyncTest("API Upload: Rejects request with invalid curriculum metadata (400)", async () => {
      const validPdfBlob = new Blob(["%PDF-1.4 dummy pdf bytes"], { type: "application/pdf" });
      const formData = new FormData();
      formData.append("file", validPdfBlob, "valid.pdf");
      formData.append("educationLevel", "invalid_level");
      formData.append("subjectName", "Mathematics");

      const res = await fetch(`${baseUrl}/api/teacher/materials/upload`, {
        method: "POST",
        headers: { Authorization: `Bearer ${TEACHER_A_TOKEN}` },
        body: formData,
      });

      assert.strictEqual(res.status, 400);
      const data = await res.json();
      assert.strictEqual(data.success, false);
      assert.match(data.message, /educationLevel must be/i);
    });

    await runAsyncTest("API Upload: Rejects spoofed executable named as pdf (400)", async () => {
      const spoofedBlob = new Blob([Buffer.concat([Buffer.from([0x4D, 0x5A]), Buffer.from("bad binary")])], {
        type: "application/pdf",
      });
      const formData = new FormData();
      formData.append("file", spoofedBlob, "fake.pdf");
      formData.append("educationLevel", "school");
      formData.append("classGrade", "10");
      formData.append("board", "cbse");
      formData.append("subjectName", "Mathematics");
      formData.append("language", "en");

      const res = await fetch(`${baseUrl}/api/teacher/materials/upload`, {
        method: "POST",
        headers: { Authorization: `Bearer ${TEACHER_A_TOKEN}` },
        body: formData,
      });

      assert.strictEqual(res.status, 400);
      const data = await res.json();
      assert.strictEqual(data.success, false);
      assert.match(data.message, /signature mismatch/i);
    });

    let uploadedMaterialIdA = null;

    await runAsyncTest("API Upload: Successfully uploads valid PDF material for Teacher A", async () => {
      const validPdfBuffer = Buffer.concat([
        Buffer.from("%PDF-1.4\n"),
        Buffer.from("1 0 obj << /Title (Trigonometry Class 10) >> endobj %%EOF"),
      ]);
      const pdfBlob = new Blob([validPdfBuffer], { type: "application/pdf" });

      const formData = new FormData();
      formData.append("file", pdfBlob, "trigonometry_chapter8.pdf");
      formData.append("educationLevel", "school");
      formData.append("classGrade", "10");
      formData.append("board", "cbse");
      formData.append("subjectName", "Mathematics");
      formData.append("chapterName", "Chapter 8");
      formData.append("topicName", "Introduction to Trigonometry");
      formData.append("language", "en");
      formData.append("description", "Comprehensive notes and formula sheet for CBSE Board Exam.");

      const res = await fetch(`${baseUrl}/api/teacher/materials/upload`, {
        method: "POST",
        headers: { Authorization: `Bearer ${TEACHER_A_TOKEN}` },
        body: formData,
      });

      assert.strictEqual(res.status, 201);
      const data = await res.json();
      assert.strictEqual(data.success, true);
      assert(data.material, "Response must include material object");
      assert.strictEqual(data.material.teacherId, "teacher_user_a");
      assert.strictEqual(data.material.originalName, "trigonometry_chapter8.pdf");
      assert.strictEqual(data.material.classGrade, "10");
      assert.strictEqual(data.material.board, "cbse");
      assert.strictEqual(data.material.subjectName, "Mathematics");
      assert.strictEqual(data.material.status, "UPLOADED");
      assert(data.material.checksum, "Material must have a checksum");
      assert(data.material.formattedSize, "Material must have formattedSize");

      uploadedMaterialIdA = data.material.id;
    });

    // ======================================================================
    // 6. INTEGRATION TESTS: Cross-Teacher Ownership & Isolation
    // ======================================================================
    console.log("\n--- Group 6: Cross-Teacher Ownership & Isolation Tests ---");

    await runAsyncTest("Isolation: Teacher A sees their uploaded material in GET list", async () => {
      const res = await fetch(`${baseUrl}/api/teacher/materials`, {
        headers: { Authorization: `Bearer ${TEACHER_A_TOKEN}` },
      });
      assert.strictEqual(res.status, 200);
      const data = await res.json();
      const found = data.materials.find((m) => m.id === uploadedMaterialIdA);
      assert(found, "Teacher A must see their uploaded material");
      assert.strictEqual(found.originalName, "trigonometry_chapter8.pdf");
    });

    await runAsyncTest("Isolation: Teacher B CANNOT see Teacher A's material in list", async () => {
      const res = await fetch(`${baseUrl}/api/teacher/materials`, {
        headers: { Authorization: `Bearer ${TEACHER_B_TOKEN}` },
      });
      assert.strictEqual(res.status, 200);
      const data = await res.json();
      const found = data.materials.find((m) => m.id === uploadedMaterialIdA);
      assert.strictEqual(found, undefined, "Teacher B must NOT see Teacher A's material");
    });

    await runAsyncTest("Isolation: Teacher B CANNOT access Teacher A's material by ID (404 Not Found)", async () => {
      const res = await fetch(`${baseUrl}/api/teacher/materials/${uploadedMaterialIdA}`, {
        headers: { Authorization: `Bearer ${TEACHER_B_TOKEN}` },
      });
      assert.strictEqual(res.status, 404);
      const data = await res.json();
      assert.strictEqual(data.success, false);
      assert.match(data.message, /not found/i);
    });

    await runAsyncTest("Isolation: Teacher B CANNOT delete Teacher A's material (403 Forbidden)", async () => {
      const res = await fetch(`${baseUrl}/api/teacher/materials/${uploadedMaterialIdA}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${TEACHER_B_TOKEN}` },
      });
      assert.strictEqual(res.status, 403);
      const data = await res.json();
      assert.strictEqual(data.success, false);
      assert.match(data.message, /not authorized/i);
    });

    // ======================================================================
    // 7. INTEGRATION TESTS: Material Deletion & Storage Cleanup
    // ======================================================================
    console.log("\n--- Group 7: Material Deletion & Storage Cleanup Tests ---");

    await runAsyncTest("Deletion: Teacher A can safely delete their material", async () => {
      const res = await fetch(`${baseUrl}/api/teacher/materials/${uploadedMaterialIdA}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${TEACHER_A_TOKEN}` },
      });
      assert.strictEqual(res.status, 200);
      const data = await res.json();
      assert.strictEqual(data.success, true);
      assert.strictEqual(data.id, uploadedMaterialIdA);

      // Verify it is no longer in Teacher A's list
      const listRes = await fetch(`${baseUrl}/api/teacher/materials`, {
        headers: { Authorization: `Bearer ${TEACHER_A_TOKEN}` },
      });
      const listData = await listRes.json();
      const found = listData.materials.find((m) => m.id === uploadedMaterialIdA);
      assert.strictEqual(found, undefined, "Material must no longer be present after deletion");
    });

  } finally {
    await close();
  }

  // ======================================================================
  // 8. INTEGRATION TESTS: Storage Rollback & Anti-Orphan Hardening
  // ======================================================================
  console.log("\n--- Group 8: Anti-Orphan Rollback & Failure Hardening Tests ---");

  // Spin up a server with strict production persistence (ALLOW_EPHEMERAL_DEV_STORAGE = false)
  const prevEnv = process.env.ALLOW_EPHEMERAL_DEV_STORAGE;
  process.env.ALLOW_EPHEMERAL_DEV_STORAGE = "false";

  let capturedStorageKey = null;
  const failingPrisma = {
    uploadedMaterial: {
      create: async (args) => {
        capturedStorageKey = args.data.storageKey;
        throw new Error("Simulated MongoDB Primary Replica Set Connection Failure");
      },
      findMany: async () => { throw new Error("Simulated MongoDB Query Failure"); },
      findUnique: async () => { throw new Error("Simulated MongoDB Find Failure"); },
      delete: async () => { throw new Error("Simulated MongoDB Delete Failure"); },
    },
  };

  const failingServer = await createTestServer(failingPrisma);

  try {
    await runAsyncTest("Anti-Orphan Rollback: Rejects upload and unlinks stored file when MongoDB fails", async () => {
      const pdfBlob = new Blob([Buffer.from("%PDF-1.4 rollback test %%EOF")], { type: "application/pdf" });
      const formData = new FormData();
      formData.append("file", pdfBlob, "rollback_test.pdf");
      formData.append("educationLevel", "school");
      formData.append("classGrade", "10");
      formData.append("board", "cbse");
      formData.append("subjectName", "Science");

      const res = await fetch(`${failingServer.baseUrl}/api/teacher/materials/upload`, {
        method: "POST",
        headers: { Authorization: `Bearer ${TEACHER_A_TOKEN}` },
        body: formData,
      });

      // Must return 503 Service Unavailable, NEVER 201 Created!
      assert.strictEqual(res.status, 503);
      const data = await res.json();
      assert.strictEqual(data.success, false);
      assert.match(data.message, /database persistence failed/i);

      // Verify that the file was unlinked from disk and does NOT exist as an orphan!
      assert(capturedStorageKey, "Storage key should have been captured before DB failure");
      const storageAdapter = getStorageAdapter();
      const fileExists = await storageAdapter.exists(capturedStorageKey);
      assert.strictEqual(fileExists, false, "Stored file MUST be deleted/unlinked upon database failure (anti-orphan)");
    });

    await runAsyncTest("Persistence Failure: GET /api/teacher/materials returns 503 when DB fails in prod", async () => {
      const res = await fetch(`${failingServer.baseUrl}/api/teacher/materials`, {
        headers: { Authorization: `Bearer ${TEACHER_A_TOKEN}` },
      });
      assert.strictEqual(res.status, 503);
      const data = await res.json();
      assert.strictEqual(data.success, false);
      assert.match(data.message, /database connection failed/i);
    });
  } finally {
    process.env.ALLOW_EPHEMERAL_DEV_STORAGE = prevEnv;
    await failingServer.close();
  }

  // ======================================================================
  // Test Summary
  // ======================================================================
  console.log("\n======================================================================");
  console.log(`  TEST RESULTS: ${passedCount} PASSED, ${failedCount} FAILED (TOTAL: ${passedCount + failedCount})`);
  console.log("======================================================================");

  if (failedCount > 0) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("Fatal test execution error:", err);
  process.exit(1);
});
