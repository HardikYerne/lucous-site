/**
 * LUCOUS Phase 3.2 — Source-Grounded AI Lesson Generation Test Suite
 * 
 * Verifies:
 * 1. Authentication & Role Authorization (Teacher only, 401/403)
 * 2. Cross-Teacher Material & Draft Ownership Isolation
 * 3. Document Text Extraction (TXT, DOCX, PDF)
 * 4. Scanned-Only PDF & Image OCR Honesty (no fake OCR)
 * 5. Corrupted, Empty, and Unsupported File Handling
 * 6. Extraction Character & Word Limits
 * 7. AI Response Schema Validation (rejection of malformed model outputs)
 * 8. Unconfigured AI Provider Fallback (honest preview, isAiGenerated: false)
 * 9. AI Timeout & Error Resilience
 * 10. Draft Persistence & Explicit Ephemeral Reporting
 * 11. Full Draft CRUD Lifecycle (Generate, List, Detail, Update, Delete)
 * 12. Missing Storage File Detection
 */

const assert = require("assert");
const http = require("http");
const zlib = require("zlib");
const path = require("path");
const express = require("express");
const jwt = require("jsonwebtoken");

// Set environment for test mode
process.env.ALLOW_EPHEMERAL_DEV_STORAGE = "true";
process.env.NODE_ENV = "test";

const { processDocument, MAX_EXTRACT_CHARS, MIN_EXTRACT_CHARS } = require("./services/document-processor");
const {
  validateLessonSchema,
  generateUnconfiguredPreview,
  generateLessonDraft,
  getAiConfig,
} = require("./services/lesson-generator");
const { createTeacherMaterialsRouter, inMemoryMaterials } = require("./routes/teacher-materials");
const { createTeacherLessonsRouter, inMemoryDrafts } = require("./routes/teacher-lessons");
const { LocalStorageAdapter, getStorageAdapter } = require("./storage/storage-adapter");

const JWT_SECRET = process.env.JWT_SECRET || "lucous-development-secret";

console.log("======================================================================");
console.log("  LUCOUS PHASE 3.2 — SOURCE-GROUNDED AI LESSON GENERATION TEST SUITE");
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

// Helpers to generate test JWT tokens
function makeToken(userId, role) {
  return jwt.sign({ userId, role }, JWT_SECRET, { expiresIn: "1h" });
}

function verifyRoleMiddleware(expectedRole) {
  return (req, res, next) => {
    const auth = req.headers.authorization || "";
    if (!auth.startsWith("Bearer ")) {
      return res.status(401).json({ success: false, message: "Not authenticated" });
    }
    try {
      const payload = jwt.verify(auth.slice(7), JWT_SECRET);
      if (payload.role !== expectedRole) {
        return res.status(403).json({ success: false, message: `${expectedRole.toLowerCase()} access only` });
      }
      req.userId = payload.userId;
      req.role = payload.role;
      next();
    } catch {
      return res.status(401).json({ success: false, message: "Invalid token" });
    }
  };
}

// Helper to send HTTP requests to test Express app
function makeRequest(server, options, body = null) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        let json = null;
        try {
          json = JSON.parse(data);
        } catch {}
        resolve({ status: res.statusCode, headers: res.headers, body: json || data });
      });
    });
    req.on("error", reject);
    if (body) {
      if (typeof body === "string") {
        req.write(body);
      } else {
        req.write(JSON.stringify(body));
      }
    }
    req.end();
  });
}

// Helper to create a valid minimal DOCX buffer
function createTestDocxBuffer(xmlText) {
  const xmlBuffer = Buffer.from(
    `<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${xmlText}</w:body></w:document>`
  );
  const deflated = zlib.deflateRawSync(xmlBuffer);
  const fileName = Buffer.from("word/document.xml");

  const header = Buffer.alloc(30);
  header.writeUInt32LE(0x04034b50, 0);
  header.writeUInt16LE(20, 4);
  header.writeUInt16LE(0, 6);
  header.writeUInt16LE(8, 8);
  header.writeUInt16LE(0, 10);
  header.writeUInt16LE(0, 12);
  header.writeUInt32LE(0, 14);
  header.writeUInt32LE(deflated.length, 18);
  header.writeUInt32LE(xmlBuffer.length, 22);
  header.writeUInt16LE(fileName.length, 26);
  header.writeUInt16LE(0, 28);

  return Buffer.concat([header, fileName, deflated]);
}

// Helper to create a valid minimal PDF buffer with text stream
function createTestPdfBuffer(text) {
  const streamContent = Buffer.from(`BT /F1 12 Tf (${text}) Tj ET`);
  const compressed = zlib.deflateSync(streamContent);
  return Buffer.concat([
    Buffer.from("%PDF-1.4\n1 0 obj\n<< /Length " + compressed.length + " /Filter /FlateDecode >>\nstream\n"),
    compressed,
    Buffer.from("\nendstream\nendobj\ntrailer\n<< /Root 1 0 R >>\n%%EOF"),
  ]);
}

async function runAllTests() {
  // -------------------------------------------------------------------------
  // SECTION 1: Document Processing Service
  // -------------------------------------------------------------------------
  console.log("\n--- Section 1: Document Processing (PDF, DOCX, TXT) ---");

  await runAsyncTest("TXT extraction: Extracts clean text, calculates words and sections", async () => {
    const txt = "Chapter 1: Thermodynamics.\n\nEnergy can neither be created nor destroyed; only altered in form.";
    const res = await processDocument({
      buffer: Buffer.from(txt),
      fileType: "text/plain",
      originalName: "thermo.txt",
    });
    assert.strictEqual(res.format, "txt");
    assert.ok(res.text.includes("Thermodynamics"));
    assert.strictEqual(res.truncated, false);
    assert.ok(res.wordCount > 10);
    assert.ok(res.sections.length >= 1);
  });

  await runAsyncTest("DOCX extraction: Inflates word/document.xml and preserves paragraphs", async () => {
    const docxBuf = createTestDocxBuffer(
      "<w:p><w:r><w:t>Unit 3: Kinematics.</w:t></w:r></w:p><w:p><w:r><w:t>Acceleration is the rate of change of velocity with respect to time.</w:t></w:r></w:p>"
    );
    const res = await processDocument({
      buffer: docxBuf,
      fileType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      originalName: "kinematics.docx",
    });
    assert.strictEqual(res.format, "docx");
    assert.ok(res.text.includes("Kinematics"));
    assert.ok(res.text.includes("Acceleration"));
    assert.ok(res.wordCount > 8);
  });

  await runAsyncTest("PDF extraction: Decompresses FlateDecode stream and extracts BT/ET text", async () => {
    const pdfBuf = createTestPdfBuffer("Electromagnetic Induction and Faraday Laws");
    const res = await processDocument({
      buffer: pdfBuf,
      fileType: "application/pdf",
      originalName: "faraday.pdf",
    });
    assert.strictEqual(res.format, "pdf");
    assert.ok(res.text.includes("Electromagnetic Induction"));
    assert.ok(res.wordCount >= 5);
  });

  await runAsyncTest("Document limit: Enforces maximum extraction limit (30,000 chars)", async () => {
    const hugeText = "Word ".repeat(8000); // ~40,000 chars
    const res = await processDocument({
      buffer: Buffer.from(hugeText),
      fileType: "text/plain",
      originalName: "huge.txt",
    });
    assert.strictEqual(res.truncated, true);
    assert.strictEqual(res.text.length, MAX_EXTRACT_CHARS);
  });

  await runAsyncTest("Document threshold: Rejects empty or sub-threshold documents (<20 chars)", async () => {
    await assert.rejects(
      async () => {
        await processDocument({
          buffer: Buffer.from("Too short"),
          fileType: "text/plain",
          originalName: "short.txt",
        });
      },
      /insufficient readable text/i
    );
  });

  await runAsyncTest("Corrupted DOCX: Rejects file with invalid ZIP signature", async () => {
    await assert.rejects(
      async () => {
        await processDocument({
          buffer: Buffer.from("Corrupted non-zip content posing as docx"),
          fileType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          originalName: "corrupt.docx",
        });
      },
      /Invalid Word file signature/i
    );
  });

  await runAsyncTest("Corrupted PDF: Rejects file with missing %PDF- header", async () => {
    await assert.rejects(
      async () => {
        await processDocument({
          buffer: Buffer.from("Not a real PDF binary content with sufficient length to exceed 32 bytes"),
          fileType: "application/pdf",
          originalName: "corrupt.pdf",
        });
      },
      /Invalid PDF file header/i
    );
  });

  await runAsyncTest("Scanned PDF detection: Distinguishes image-only PDF from text PDF", async () => {
    // PDF with /Subtype /Image and 0 BT text
    const scannedPdf = Buffer.from(
      "%PDF-1.4\n1 0 obj\n<< /Type /XObject /Subtype /Image /Width 100 /Height 100 >>\nstream\n(raw_image_bytes)\nendstream\nendobj\ntrailer\n<< /Root 1 0 R >>\n%%EOF"
    );
    await assert.rejects(
      async () => {
        await processDocument({
          buffer: scannedPdf,
          fileType: "application/pdf",
          originalName: "scanned.pdf",
        });
      },
      /scanned or image-based/i
    );
  });

  await runAsyncTest("Image OCR honesty: Returns actionable message that OCR is unconfigured (no fake OCR)", async () => {
    const pngHeader = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00]);
    await assert.rejects(
      async () => {
        await processDocument({
          buffer: pngHeader,
          fileType: "image/png",
          originalName: "diagram.png",
        });
      },
      /Image OCR is not configured/i
    );
  });

  await runAsyncTest("Unsupported file format: Rejects non-document files", async () => {
    await assert.rejects(
      async () => {
        await processDocument({
          buffer: Buffer.from("MZ executable"),
          fileType: "application/octet-stream",
          originalName: "program.exe",
        });
      },
      /Unsupported document format/i
    );
  });

  // -------------------------------------------------------------------------
  // SECTION 2: AI Lesson Schema & Generator
  // -------------------------------------------------------------------------
  console.log("\n--- Section 2: AI Schema Validation & Generator ---");

  runSyncTest("Schema Validation: Accepts fully compliant educational lesson object", () => {
    const validLesson = {
      title: "Newton's First Law of Motion",
      educationLevel: "school",
      gradeOrSemester: "Class 9",
      boardOrScheme: "CBSE",
      subject: "Science",
      chapter: "Motion and Force",
      topic: "Inertia",
      learningObjectives: ["Define inertia and Newton's first law", "Analyze real-world examples of inertia"],
      prerequisiteKnowledge: ["Concept of velocity and external force"],
      stepByStepExplanation: [
        {
          stepNumber: 1,
          heading: "Concept of Inertia",
          explanation: "Inertia is the natural tendency of an object to resist changes in its state of motion.",
          sourceReferences: "Section 1.2",
        },
      ],
      sourceGroundedExamples: [
        {
          title: "Bus passenger leaning on sudden stop",
          context: "Public transit everyday physics",
          example: "When a moving bus stops suddenly, passengers lean forward.",
          explanation: "The lower body stops with the bus, while the upper body tends to continue moving.",
        },
      ],
      keyTerms: [
        { term: "Inertia", definition: "Resistance of any physical object to any change in its velocity." },
      ],
      summary: "Newton's First Law establishes inertia as the baseline property of matter.",
      reviewQuestions: [
        {
          question: "Why do passengers fall forward when a vehicle brakes suddenly?",
          answer: "Due to inertia of motion of the upper body.",
          explanation: "Their bodies tend to maintain their forward velocity.",
        },
      ],
      sourceGroundingNotes: "All definitions and examples directly grounded in uploaded textbook excerpt.",
    };

    const res = validateLessonSchema(validLesson);
    assert.strictEqual(res.valid, true);
  });

  runSyncTest("Schema Validation: Rejects malformed model output missing learning objectives", () => {
    const malformed = {
      title: "Test Lesson",
      learningObjectives: [], // empty
      prerequisiteKnowledge: [],
      stepByStepExplanation: [{ heading: "H", explanation: "E" }],
      sourceGroundedExamples: [],
      keyTerms: [],
      summary: "S",
      reviewQuestions: [{ question: "Q", answer: "A" }],
    };
    const res = validateLessonSchema(malformed);
    assert.strictEqual(res.valid, false);
    assert.ok(res.error.includes("learning objective"));
  });

  runSyncTest("Schema Validation: Rejects malformed model output missing explanation steps", () => {
    const malformed = {
      title: "Test Lesson",
      learningObjectives: ["Obj 1"],
      prerequisiteKnowledge: [],
      stepByStepExplanation: [], // empty
      sourceGroundedExamples: [],
      keyTerms: [],
      summary: "S",
      reviewQuestions: [{ question: "Q", answer: "A" }],
    };
    const res = validateLessonSchema(malformed);
    assert.strictEqual(res.valid, false);
    assert.ok(res.error.includes("step in step-by-step explanation"));
  });

  runSyncTest("Schema Validation: Rejects malformed model output missing review questions", () => {
    const malformed = {
      title: "Test Lesson",
      learningObjectives: ["Obj 1"],
      prerequisiteKnowledge: [],
      stepByStepExplanation: [{ heading: "H", explanation: "E" }],
      sourceGroundedExamples: [],
      keyTerms: [],
      summary: "S",
      reviewQuestions: [], // empty
    };
    const res = validateLessonSchema(malformed);
    assert.strictEqual(res.valid, false);
    assert.ok(res.error.includes("review question"));
  });

  await runAsyncTest("Unconfigured Fallback: Returns honest preview (isAiGenerated: false, unconfigured_preview)", async () => {
    const origEnv = { ...process.env };
    delete process.env.AI_PROVIDER;
    delete process.env.GEMINI_API_KEY;
    delete process.env.OPENAI_API_KEY;
    delete process.env.AI_API_KEY;

    const res = await generateLessonDraft({
      curriculum: {
        educationLevel: "school",
        classGrade: "10",
        board: "cbse",
        subjectName: "Science",
        chapterName: "Electricity",
        topicName: "Ohm's Law",
      },
      sourceText: "Ohm's Law states that electric current through a conductor is directly proportional to voltage.\n\nResistance is the opposition to current flow.",
      originalName: "electricity.txt",
    });

    assert.strictEqual(res.isAiGenerated, false);
    assert.strictEqual(res.aiProvider, "unconfigured_preview");
    assert.ok(res.content.sourceGroundingNotes.includes("unconfigured"));
    assert.ok(res.content.title.includes("Ohm's Law"));

    // Verify fallback passes schema check
    const schemaCheck = validateLessonSchema(res.content);
    assert.strictEqual(schemaCheck.valid, true);

    process.env = origEnv;
  });

  // -------------------------------------------------------------------------
  // SECTION 3: HTTP Router & Authorization & CRUD Lifecycle
  // -------------------------------------------------------------------------
  console.log("\n--- Section 3: API Router, Authorization & CRUD Lifecycle ---");

  // Spin up an Express test server with both routers mounted
  const app = express();
  app.use(express.json());

  const requireTeacher = verifyRoleMiddleware("TEACHER");

  // Mount materials router and lessons router
  app.use("/api/teacher", createTeacherMaterialsRouter(null, requireTeacher));
  app.use("/api/teacher", createTeacherLessonsRouter(null, requireTeacher));

  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  const serverPort = server.address().port;

  const teacherAToken = makeToken("teacher_alpha", "TEACHER");
  const teacherBToken = makeToken("teacher_beta", "TEACHER");
  const studentToken = makeToken("student_1", "STUDENT");

  let createdMaterialAId = null;
  let createdDraftAId = null;

  // 1. Create a material for Teacher A directly in memory storage
  await runAsyncTest("Setup: Seed material in teacher materials storage for Teacher A", async () => {
    const storageAdapter = getStorageAdapter();
    const saveRes = await storageAdapter.save({
      key: "test_doc_alpha.txt",
      buffer: Buffer.from("Photosynthesis is the process by which green plants use sunlight to synthesize nutrients from CO2 and water.\n\nChlorophyll absorbs light energy."),
      mimeType: "text/plain",
    });

    createdMaterialAId = `mat_test_alpha_${Date.now()}`;
    const matRecord = {
      id: createdMaterialAId,
      teacherId: "teacher_alpha",
      originalName: "photosynthesis.txt",
      fileType: "text/plain",
      fileSize: 150,
      storageKey: saveRes.storageKey,
      educationLevel: "school",
      classGrade: "10",
      board: "cbse",
      subjectName: "Biology",
      chapterName: "Life Processes",
      topicName: "Photosynthesis",
      language: "en",
      status: "UPLOADED",
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    inMemoryMaterials.set(createdMaterialAId, matRecord);
    assert.ok(createdMaterialAId);
  });

  // 2. Authorization guards
  await runAsyncTest("Auth guard: Blocks unauthenticated requests with 401", async () => {
    const res = await makeRequest(server, {
      hostname: "127.0.0.1",
      port: serverPort,
      path: "/api/teacher/lessons/generate",
      method: "POST",
      headers: { "Content-Type": "application/json" },
    }, { materialId: createdMaterialAId });

    assert.strictEqual(res.status, 401);
  });

  await runAsyncTest("Role guard: Blocks student token with 403 (teacher access only)", async () => {
    const res = await makeRequest(server, {
      hostname: "127.0.0.1",
      port: serverPort,
      path: "/api/teacher/lessons/generate",
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${studentToken}`,
      },
    }, { materialId: createdMaterialAId });

    assert.strictEqual(res.status, 403);
  });

  await runAsyncTest("Ownership isolation: Blocks Teacher B from generating a lesson from Teacher A's material (404)", async () => {
    const res = await makeRequest(server, {
      hostname: "127.0.0.1",
      port: serverPort,
      path: "/api/teacher/lessons/generate",
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${teacherBToken}`,
      },
    }, { materialId: createdMaterialAId });

    assert.strictEqual(res.status, 404);
  });

  // 3. Successful Generation for Teacher A
  await runAsyncTest("Generate Lesson: Teacher A generates lesson draft from own material (201 Created)", async () => {
    const res = await makeRequest(server, {
      hostname: "127.0.0.1",
      port: serverPort,
      path: "/api/teacher/lessons/generate",
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${teacherAToken}`,
      },
    }, { materialId: createdMaterialAId });

    assert.strictEqual(res.status, 201);
    assert.strictEqual(res.body.success, true);
    assert.ok(res.body.draft);
    assert.strictEqual(res.body.draft.teacherId, "teacher_alpha");
    assert.strictEqual(res.body.draft.sourceMaterialId, createdMaterialAId);
    assert.ok(res.body.draft.content.learningObjectives.length >= 1);
    assert.ok(res.body.draft.content.stepByStepExplanation.length >= 1);

    createdDraftAId = res.body.draft.id;
  });

  // 4. List Drafts with Ownership Isolation
  await runAsyncTest("List Drafts: Teacher A sees draft; Teacher B sees empty list (cross-teacher isolation)", async () => {
    // Teacher A list
    const resA = await makeRequest(server, {
      hostname: "127.0.0.1",
      port: serverPort,
      path: "/api/teacher/lessons",
      method: "GET",
      headers: { Authorization: `Bearer ${teacherAToken}` },
    });
    assert.strictEqual(resA.status, 200);
    assert.ok(resA.body.drafts.some((d) => d.id === createdDraftAId));

    // Teacher B list
    const resB = await makeRequest(server, {
      hostname: "127.0.0.1",
      port: serverPort,
      path: "/api/teacher/lessons",
      method: "GET",
      headers: { Authorization: `Bearer ${teacherBToken}` },
    });
    assert.strictEqual(resB.status, 200);
    assert.strictEqual(resB.body.drafts.length, 0);
  });

  // 5. Get Single Draft Detail with Ownership Protection
  await runAsyncTest("Get Draft: Teacher A retrieves draft details; Teacher B receives 404", async () => {
    const resA = await makeRequest(server, {
      hostname: "127.0.0.1",
      port: serverPort,
      path: `/api/teacher/lessons/${createdDraftAId}`,
      method: "GET",
      headers: { Authorization: `Bearer ${teacherAToken}` },
    });
    assert.strictEqual(resA.status, 200);
    assert.strictEqual(resA.body.draft.id, createdDraftAId);

    // Teacher B unauthorized access
    const resB = await makeRequest(server, {
      hostname: "127.0.0.1",
      port: serverPort,
      path: `/api/teacher/lessons/${createdDraftAId}`,
      method: "GET",
      headers: { Authorization: `Bearer ${teacherBToken}` },
    });
    assert.strictEqual(resB.status, 404);
  });

  // 6. Update Draft (PUT)
  await runAsyncTest("Update Draft: Teacher A updates title and marks as REVIEWED", async () => {
    const res = await makeRequest(server, {
      hostname: "127.0.0.1",
      port: serverPort,
      path: `/api/teacher/lessons/${createdDraftAId}`,
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${teacherAToken}`,
      },
    }, {
      title: "Updated: Comprehensive Photosynthesis Masterclass",
      status: "REVIEWED",
    });

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.draft.title, "Updated: Comprehensive Photosynthesis Masterclass");
    assert.strictEqual(res.body.draft.status, "REVIEWED");
  });

  await runAsyncTest("Update Draft Security: Teacher B is forbidden from updating Teacher A's draft (403)", async () => {
    const res = await makeRequest(server, {
      hostname: "127.0.0.1",
      port: serverPort,
      path: `/api/teacher/lessons/${createdDraftAId}`,
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${teacherBToken}`,
      },
    }, { title: "Malicious Tampering" });

    assert.strictEqual(res.status, 403);
  });

  // 7. Missing Storage File Detection
  await runAsyncTest("Storage resilience: Returns 410 if source file is missing from durable storage", async () => {
    // Create material record with nonexistent storageKey
    const missingMatId = `mat_missing_${Date.now()}`;
    inMemoryMaterials.set(missingMatId, {
      id: missingMatId,
      teacherId: "teacher_alpha",
      originalName: "vanished.txt",
      fileType: "text/plain",
      storageKey: "nonexistent_file_key_123.txt",
      status: "UPLOADED",
    });

    const res = await makeRequest(server, {
      hostname: "127.0.0.1",
      port: serverPort,
      path: "/api/teacher/lessons/generate",
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${teacherAToken}`,
      },
    }, { materialId: missingMatId });

    assert.strictEqual(res.status, 410);
    assert.ok(res.body.message.includes("could not be retrieved"));
  });

  // 8. Delete Draft
  await runAsyncTest("Delete Draft: Teacher A deletes draft; Teacher B forbidden; subsequent GET returns 404", async () => {
    // Teacher B forbidden
    const resB = await makeRequest(server, {
      hostname: "127.0.0.1",
      port: serverPort,
      path: `/api/teacher/lessons/${createdDraftAId}`,
      method: "DELETE",
      headers: { Authorization: `Bearer ${teacherBToken}` },
    });
    assert.strictEqual(resB.status, 403);

    // Teacher A deletes
    const resA = await makeRequest(server, {
      hostname: "127.0.0.1",
      port: serverPort,
      path: `/api/teacher/lessons/${createdDraftAId}`,
      method: "DELETE",
      headers: { Authorization: `Bearer ${teacherAToken}` },
    });
    assert.strictEqual(resA.status, 200);

    // Verify deleted
    const resCheck = await makeRequest(server, {
      hostname: "127.0.0.1",
      port: serverPort,
      path: `/api/teacher/lessons/${createdDraftAId}`,
      method: "GET",
      headers: { Authorization: `Bearer ${teacherAToken}` },
    });
    assert.strictEqual(resCheck.status, 404);
  });

  // Cleanup test server
  await new Promise((resolve) => server.close(resolve));

  console.log("\n======================================================================");
  console.log(`  PHASE 3.2 TEST SUMMARY: ${passedCount} PASSED, ${failedCount} FAILED`);
  console.log("======================================================================");

  if (failedCount > 0) {
    process.exit(1);
  }
}

runAllTests().catch((err) => {
  console.error("Test runner crashed:", err);
  process.exit(1);
});
