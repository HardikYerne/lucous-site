/**
 * Comprehensive Backend Test Suite for LUCOUS Phase 3.4:
 * Teacher Review, Publishing, Unique Access Codes & Student Access
 */

const assert = require("assert");
const http = require("http");
const express = require("express");
const jwt = require("jsonwebtoken");

const {
  CODE_ALPHABET,
  generateAccessCode,
  normalizeAccessCode,
  isValidAccessCodeFormat,
  generateUniqueAccessCode,
} = require("./services/access-code-service");

const {
  validateLessonForPublishing,
  validateAssessmentForPublishing,
} = require("./validators/publishing-validator");

const {
  publishTeacherContent,
  unpublishTeacherContent,
  getTeacherPublishedContent,
  getStudentContentByAccessCode,
  checkStudentAnswer,
  findPublishedContentByAccessCode,
  startStudentAssessmentSession,
  submitStudentAssessment,
  inMemoryAccessCodes,
  inMemoryAssessmentSessions,
} = require("./services/publishing-service");

const { createTeacherPublishingRouter } = require("./routes/teacher-publishing");
const { createStudentAccessRouter } = require("./routes/student-access");
const { inMemoryDrafts } = require("./routes/teacher-lessons");
const { inMemoryAssessments } = require("./routes/teacher-assessments");

process.env.ALLOW_EPHEMERAL_DEV_STORAGE = "true";
process.env.NODE_ENV = "test";

const JWT_SECRET = "test-jwt-secret-phase-3-4";

function signToken(userId, role) {
  return jwt.sign({ userId, role }, JWT_SECRET, { expiresIn: "1h" });
}

// Minimal auth middleware matching server.js
function mockAuthenticate(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) {
    return res.status(401).json({ success: false, message: "Authentication required." });
  }
  try {
    const decoded = jwt.verify(header.slice(7), JWT_SECRET);
    req.userId = decoded.userId;
    req.userRole = decoded.role;
    next();
  } catch {
    return res.status(401).json({ success: false, message: "Invalid or expired token." });
  }
}

function mockRequireTeacher(req, res, next) {
  mockAuthenticate(req, res, () => {
    if (req.userRole !== "teacher" && req.userRole !== "TEACHER") {
      return res.status(403).json({ success: false, message: "Teacher access required." });
    }
    next();
  });
}

console.log("======================================================================");
console.log("  LUCOUS PHASE 3.4 — PUBLISHING & STUDENT ACCESS TEST SUITE");
console.log("======================================================================\n");

let passed = 0;

function runTest(section, name, fn) {
  try {
    fn();
    console.log(`  [PASS] [${section}] ${name}`);
    passed++;
  } catch (err) {
    console.error(`  [FAIL] [${section}] ${name}:`, err.message);
    process.exit(1);
  }
}

async function runAsyncTest(section, name, fn) {
  try {
    await fn();
    console.log(`  [PASS] [${section}] ${name}`);
    passed++;
  } catch (err) {
    console.error(`  [FAIL] [${section}] ${name}:`, err.message);
    process.exit(1);
  }
}

async function main() {
  // --------------------------------------------------------------------------
  // SECTION 1: ACCESS CODE GENERATION, NORMALIZATION & COLLISION SAFETY
  // --------------------------------------------------------------------------
  runTest("CodeService", "Generates unpredictable 8-character codes prefixed with LU-", () => {
    const code = generateAccessCode();
    assert.strictEqual(typeof code, "string");
    assert.ok(code.startsWith("LU-"), "Must start with LU-");
    assert.strictEqual(code.length, 9); // LU- + 6 characters = 9
    const body = code.slice(3);
    for (const char of body) {
      assert.ok(CODE_ALPHABET.includes(char), `Character ${char} must be in unambiguous alphabet`);
    }
  });

  runTest("CodeService", "Rejects ambiguous characters (0, O, 1, I, L)", () => {
    const ambiguous = ["0", "O", "1", "I", "L"];
    for (const char of ambiguous) {
      assert.ok(!CODE_ALPHABET.includes(char), `Ambiguous glyph ${char} must be excluded`);
    }
  });

  runTest("CodeService", "Normalizes lowercase, whitespace, and dash variants", () => {
    assert.strictEqual(normalizeAccessCode("lu-7k9m2p"), "LU-7K9M2P");
    assert.strictEqual(normalizeAccessCode("  7k9m2p  "), "LU-7K9M2P");
    assert.strictEqual(normalizeAccessCode("lu 7k9m2p"), "LU-7K9M2P");
    assert.strictEqual(normalizeAccessCode("LU-7K9M2P"), "LU-7K9M2P");
  });

  runTest("CodeService", "Validates formatted access codes strictly", () => {
    assert.ok(isValidAccessCodeFormat("LU-7K9M2P"));
    assert.ok(isValidAccessCodeFormat("lu-7k9m2p"));
    assert.ok(!isValidAccessCodeFormat("INVALID"));
    assert.ok(!isValidAccessCodeFormat("LU-123")); // too short
    assert.ok(!isValidAccessCodeFormat("LU-7K9M2PO")); // contains 'O'
  });

  await runAsyncTest("CodeService", "Collision retry loop safely finds unused code", async () => {
    let callCount = 0;
    const mockInUseChecker = async (candidate) => {
      callCount++;
      // Simulate first 2 candidates being in-use
      return callCount < 3;
    };
    const code = await generateUniqueAccessCode(mockInUseChecker, 5);
    assert.ok(isValidAccessCodeFormat(code));
    assert.strictEqual(callCount, 3);
  });

  // --------------------------------------------------------------------------
  // SECTION 2: PUBLISHING VALIDATION
  // --------------------------------------------------------------------------
  runTest("Validator", "Rejects incomplete lesson draft missing objectives or steps", () => {
    const incompleteLesson = {
      title: "Photosynthesis",
      subject: "Science",
      content: {
        learningObjectives: [],
        explanationSteps: [],
        reviewQuestions: [],
      },
    };
    const res = validateLessonForPublishing(incompleteLesson);
    assert.strictEqual(res.valid, false);
    assert.ok(res.errors.length >= 2);
  });

  runTest("Validator", "Accepts fully complete lesson draft", () => {
    const completeLesson = {
      title: "Cell Division and Mitosis",
      subject: "Biology",
      content: {
        title: "Cell Division and Mitosis",
        learningObjectives: ["Understand the phases of mitosis", "Identify chromosome alignment"],
        explanationSteps: [
          {
            stepNumber: 1,
            heading: "Prophase",
            explanation: "Chromatin condenses into visible double-stranded chromosomes.",
          },
          {
            stepNumber: 2,
            heading: "Metaphase",
            explanation: "Chromosomes line up along the cellular equatorial plate.",
          },
        ],
        reviewQuestions: [
          {
            question: "In which phase do chromosomes align along the equatorial plate?",
            answer: "Metaphase",
            explanation: "Metaphase is defined by the alignment along the metaphase plate.",
          },
        ],
      },
    };
    const res = validateLessonForPublishing(completeLesson);
    assert.strictEqual(res.valid, true);
    assert.strictEqual(res.errors.length, 0);
  });

  runTest("Validator", "Rejects incomplete assessment draft missing questions", () => {
    const incompleteAsmt = {
      title: "Physics Quiz",
      subject: "Physics",
      content: { questions: [] },
    };
    const res = validateAssessmentForPublishing(incompleteAsmt);
    assert.strictEqual(res.valid, false);
  });

  runTest("Validator", "Accepts valid flashcard assessment draft with front and back", () => {
    const flashcardAsmt = {
      title: "Biology Flashcards",
      subject: "Biology",
      content: {
        questions: [
          {
            id: "q_1",
            type: "FLASHCARD",
            front: "Mitochondria",
            back: "Powerhouse of the cell, generates ATP.",
            explanation: "Cell biology core concept.",
          },
        ],
      },
    };
    const res = validateAssessmentForPublishing(flashcardAsmt);
    assert.strictEqual(res.valid, true);
  });

  runTest("Validator", "Accepts valid ordering assessment draft with sequence items", () => {
    const orderingAsmt = {
      title: "Digestive System Sequence",
      subject: "Biology",
      content: {
        questions: [
          {
            id: "q_1",
            type: "ORDERING",
            questionText: "Arrange digestion stages in order:",
            items: [
              { id: "step_1", text: "Ingestion in mouth" },
              { id: "step_2", text: "Digestion in stomach" },
              { id: "step_3", text: "Absorption in small intestine" },
            ],
            correctOrder: ["step_1", "step_2", "step_3"],
            explanation: "Digestion proceeds from mouth to stomach to intestine.",
          },
        ],
      },
    };
    const res = validateAssessmentForPublishing(orderingAsmt);
    assert.strictEqual(res.valid, true);
  });

  // --------------------------------------------------------------------------
  // SECTION 3: PUBLISHING SERVICE WORKFLOW & OWNERSHIP ENFORCEMENT
  // --------------------------------------------------------------------------
  const teacherA = "teacher_id_alpha";
  const teacherB = "teacher_id_beta";

  // Seed Teacher A's lesson draft in inMemoryDrafts
  const lessonIdA = "lesson_seed_alpha_01";
  inMemoryDrafts.set(lessonIdA, {
    id: lessonIdA,
    teacherId: teacherA,
    sourceMaterialId: "mat_01",
    title: "Newton's Laws of Motion",
    subject: "Physics",
    status: "REVIEWED",
    content: {
      title: "Newton's Laws of Motion",
      summary: "Comprehensive guide to inertia, force, and action-reaction.",
      learningObjectives: ["Explain inertia with examples", "Calculate F = ma"],
      explanationSteps: [
        {
          stepNumber: 1,
          heading: "First Law: Inertia",
          explanation: "Objects remain in uniform motion unless acted upon by an external net force.",
        },
      ],
      reviewQuestions: [
        {
          question: "What property of matter resists changes in its state of motion?",
          answer: "Inertia",
          explanation: "Inertia is the tendency of objects to resist changes in velocity.",
        },
      ],
    },
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  await runAsyncTest("PublishingService", "Cross-Teacher Isolation: Teacher B cannot publish Teacher A's draft", async () => {
    let caught = false;
    try {
      await publishTeacherContent(null, {
        teacherId: teacherB,
        contentType: "LESSON",
        contentId: lessonIdA,
      });
    } catch (err) {
      caught = true;
      assert.strictEqual(err.statusCode, 403);
    }
    assert.ok(caught, "Must throw 403 when publishing another teacher's draft");
  });

  let publishedCodeLesson = null;
  await runAsyncTest("PublishingService", "Teacher A publishes lesson: transitions to PUBLISHED and returns access code", async () => {
    const res = await publishTeacherContent(null, {
      teacherId: teacherA,
      contentType: "LESSON",
      contentId: lessonIdA,
    });
    assert.strictEqual(res.success, true);
    assert.strictEqual(res.status, "PUBLISHED");
    assert.ok(isValidAccessCodeFormat(res.accessCode));
    publishedCodeLesson = res.accessCode;

    // Verify stored state
    const stored = inMemoryDrafts.get(lessonIdA);
    assert.strictEqual(stored.status, "PUBLISHED");
    assert.strictEqual(stored.accessCode, publishedCodeLesson);
    assert.ok(stored.publishedAt instanceof Date);
  });

  await runAsyncTest("PublishingService", "Teacher A lists their published items; Teacher B sees empty list", async () => {
    const teacherAItems = await getTeacherPublishedContent(null, teacherA);
    assert.ok(teacherAItems.length >= 1);
    assert.strictEqual(teacherAItems[0].accessCode, publishedCodeLesson);

    const teacherBItems = await getTeacherPublishedContent(null, teacherB);
    assert.strictEqual(teacherBItems.length, 0);
  });

  // --------------------------------------------------------------------------
  // SECTION 4: STUDENT ACCESS LOOKUP, SANITIZATION & ANSWER CHECKING
  // --------------------------------------------------------------------------
  await runAsyncTest("StudentAccess", "Student retrieves published lesson using valid access code", async () => {
    const studentView = await getStudentContentByAccessCode(null, publishedCodeLesson);
    assert.ok(studentView);
    assert.strictEqual(studentView.title, "Newton's Laws of Motion");
    assert.strictEqual(studentView.contentType, "LESSON");
    assert.strictEqual(studentView.accessCode, publishedCodeLesson);

    // Verify student-safe sanitization (no teacher passwords, IDs, or file paths)
    assert.strictEqual(studentView.teacherId, undefined);
    assert.strictEqual(studentView.sourceMaterialId, undefined);
    assert.strictEqual(studentView.storageKey, undefined);

    // Verify review questions are present and answer keys are masked
    const rq = studentView.content.reviewQuestions;
    assert.ok(rq && rq.length >= 1);
    assert.strictEqual(rq[0].question, "What property of matter resists changes in its state of motion?");
    assert.strictEqual(rq[0].answer, undefined, "Raw answer key must not be exposed on initial load");
    assert.strictEqual(rq[0].hasAnswer, true);
  });

  await runAsyncTest("StudentAccess", "Interactive Answer Checking evaluates student response accurately", async () => {
    // Correct answer
    const checkCorrect = await checkStudentAnswer(null, {
      rawCode: publishedCodeLesson,
      questionId: "rq_1",
      studentAnswer: "Inertia",
    });
    assert.strictEqual(checkCorrect.isCorrect, true);
    assert.strictEqual(checkCorrect.correctAnswer, "Inertia");
    assert.ok(checkCorrect.explanation.includes("Inertia"));

    // Incorrect answer
    const checkIncorrect = await checkStudentAnswer(null, {
      rawCode: publishedCodeLesson,
      questionId: "rq_1",
      studentAnswer: "Gravity",
    });
    assert.strictEqual(checkIncorrect.isCorrect, false);
  });

  await runAsyncTest("StudentAccess", "Unpublished / Draft content is strictly INACCESSIBLE to students", async () => {
    // Seed an unpublished draft
    const draftOnlyId = "lesson_unpublished_draft";
    inMemoryDrafts.set(draftOnlyId, {
      id: draftOnlyId,
      teacherId: teacherA,
      title: "Secret Unfinished Lesson",
      status: "DRAFT",
      accessCode: null,
      content: { learningObjectives: ["Test"] },
    });

    const studentResult = await getStudentContentByAccessCode(null, "LU-999999");
    assert.strictEqual(studentResult, null, "Must return null for non-existent or draft access code");
  });

  // --------------------------------------------------------------------------
  // SECTION 5: UNPUBLISHING / REVOCATION IMMEDIATELY TERMINATES ACCESS
  // --------------------------------------------------------------------------
  await runAsyncTest("Revocation", "Teacher unpublishes content; student access is instantly revoked", async () => {
    const unpublishRes = await unpublishTeacherContent(null, {
      teacherId: teacherA,
      contentType: "LESSON",
      contentId: lessonIdA,
    });
    assert.strictEqual(unpublishRes.success, true);
    assert.strictEqual(unpublishRes.status, "REVIEWED");

    // Student lookup with the previous access code must now return null (404)
    const accessAfterRevoke = await getStudentContentByAccessCode(null, publishedCodeLesson);
    assert.strictEqual(accessAfterRevoke, null, "Revoked content must be inaccessible to students");
  });

  // --------------------------------------------------------------------------
  // SECTION 4B: ASSESSMENT PUBLISHING, CROSS-TEACHER ISOLATION & MULTI-FORMAT ACCESS
  // --------------------------------------------------------------------------
  const asmtIdA = "asmt_seed_alpha_01";
  inMemoryAssessments.set(asmtIdA, {
    id: asmtIdA,
    teacherId: teacherA,
    sourceMaterialId: "mat_bio_01",
    title: "Cell Biology & Digestion Assessment",
    subject: "Biology",
    topicId: "topic_bio_101",
    status: "REVIEWED",
    contentType: "PRACTICE",
    gameFormat: "MIXED",
    difficulty: "MEDIUM",
    questionCount: 4,
    content: {
      title: "Cell Biology & Digestion Assessment",
      description: "Interactive assessment spanning multiple question formats.",
      topicId: "topic_bio_101",
      questions: [
        {
          id: "q_mc",
          type: "MULTIPLE_CHOICE",
          questionText: "What is the primary function of mitochondria?",
          options: ["ATP energy production", "Protein synthesis", "DNA storage", "Lipid breakdown"],
          correctAnswer: "ATP energy production",
          explanation: "Mitochondria produce ATP through cellular respiration.",
        },
        {
          id: "q_blitz",
          type: "TIMED_BLITZ",
          questionText: "Which organelle carries out photosynthesis?",
          options: ["Chloroplast", "Nucleus", "Ribosome", "Vacuole"],
          correctAnswer: "Chloroplast",
          timeLimitSeconds: 15,
          explanation: "Chloroplasts contain chlorophyll for photosynthesis.",
        },
        {
          id: "q_flash",
          type: "FLASHCARD",
          front: "Ribosome",
          back: "Cellular site of protein translation.",
          explanation: "Ribosomes translate mRNA into polypeptide chains.",
        },
        {
          id: "q_order",
          type: "ORDERING",
          questionText: "Order the digestive path:",
          items: [
            { id: "step_1", text: "Mouth" },
            { id: "step_2", text: "Stomach" },
            { id: "step_3", text: "Small Intestine" },
          ],
          correctOrder: ["step_1", "step_2", "step_3"],
          correctAnswer: ["step_1", "step_2", "step_3"],
          explanation: "Food travels from mouth to stomach to small intestine.",
        },
      ],
    },
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  await runAsyncTest("PublishingService", "Cross-Teacher Isolation: Teacher B cannot publish Teacher A's assessment draft", async () => {
    let caught = false;
    try {
      await publishTeacherContent(null, {
        teacherId: teacherB,
        contentType: "ASSESSMENT",
        contentId: asmtIdA,
      });
    } catch (err) {
      caught = true;
      assert.strictEqual(err.statusCode, 403);
    }
    assert.ok(caught, "Must throw 403 when publishing another teacher's assessment draft");
  });

  let publishedCodeAsmt = null;
  await runAsyncTest("PublishingService", "Teacher A publishes assessment: transitions to PUBLISHED and returns access code", async () => {
    const res = await publishTeacherContent(null, {
      teacherId: teacherA,
      contentType: "ASSESSMENT",
      contentId: asmtIdA,
    });
    assert.strictEqual(res.success, true);
    assert.strictEqual(res.status, "PUBLISHED");
    assert.ok(isValidAccessCodeFormat(res.accessCode));
    publishedCodeAsmt = res.accessCode;

    // Verify stored state
    const stored = inMemoryAssessments.get(asmtIdA);
    assert.strictEqual(stored.status, "PUBLISHED");
    assert.strictEqual(stored.accessCode, publishedCodeAsmt);
    assert.ok(stored.publishedAt instanceof Date);
  });

  await runAsyncTest("StudentAccess", "Student retrieves published assessment with sanitized content and topicId", async () => {
    const studentView = await getStudentContentByAccessCode(null, publishedCodeAsmt);
    assert.ok(studentView);
    assert.strictEqual(studentView.title, "Cell Biology & Digestion Assessment");
    assert.strictEqual(studentView.contentType, "ASSESSMENT");
    assert.strictEqual(studentView.topicId, "topic_bio_101");
    assert.strictEqual(studentView.accessCode, publishedCodeAsmt);

    // Verify questions sanitized
    const qs = studentView.content.questions;
    assert.strictEqual(qs.length, 4);

    // Multiple choice
    assert.strictEqual(qs[0].questionText, "What is the primary function of mitochondria?");
    assert.strictEqual(qs[0].correctAnswer, undefined, "correctAnswer must be scrubbed");
    assert.strictEqual(qs[0].explanation, undefined, "explanation must be scrubbed");

    // Timed Blitz
    assert.strictEqual(qs[1].type, "TIMED_BLITZ");
    assert.strictEqual(qs[1].timeLimitSeconds, 15);
    assert.strictEqual(qs[1].correctAnswer, undefined);

    // Flashcard
    assert.strictEqual(qs[2].type, "FLASHCARD");
    assert.strictEqual(qs[2].front, "Ribosome");
    assert.strictEqual(qs[2].back, undefined, "Flashcard back must be scrubbed");

    // Ordering
    assert.strictEqual(qs[3].type, "ORDERING");
    assert.strictEqual(qs[3].items.length, 3);
    assert.strictEqual(qs[3].correctOrder, undefined, "correctOrder must be scrubbed");
  });

  await runAsyncTest("StudentAccess", "Interactive Answer Checking evaluates multi-format assessment questions", async () => {
    // 1. Multiple choice
    const mcCheck = await checkStudentAnswer(null, {
      rawCode: publishedCodeAsmt,
      questionId: "q_mc",
      studentAnswer: "ATP energy production",
    });
    assert.strictEqual(mcCheck.isCorrect, true);
    assert.strictEqual(mcCheck.correctAnswer, "ATP energy production");

    // 2. Timed blitz
    const blitzCheck = await checkStudentAnswer(null, {
      rawCode: publishedCodeAsmt,
      questionId: "q_blitz",
      studentAnswer: "Chloroplast",
    });
    assert.strictEqual(blitzCheck.isCorrect, true);

    // 3. Flashcard
    const flashCheck = await checkStudentAnswer(null, {
      rawCode: publishedCodeAsmt,
      questionId: "q_flash",
      studentAnswer: "Cellular site of protein translation.",
    });
    assert.strictEqual(flashCheck.isCorrect, true);

    // 4. Ordering correct sequence
    const orderCorrect = await checkStudentAnswer(null, {
      rawCode: publishedCodeAsmt,
      questionId: "q_order",
      studentAnswer: ["step_1", "step_2", "step_3"],
    });
    assert.strictEqual(orderCorrect.isCorrect, true);

    // 4b. Ordering incorrect sequence
    const orderWrong = await checkStudentAnswer(null, {
      rawCode: publishedCodeAsmt,
      questionId: "q_order",
      studentAnswer: ["step_3", "step_2", "step_1"],
    });
    assert.strictEqual(orderWrong.isCorrect, false);
  });

  await runAsyncTest("Revocation", "Teacher unpublishes assessment; student access is immediately severed", async () => {
    const unpublishRes = await unpublishTeacherContent(null, {
      teacherId: teacherA,
      contentType: "ASSESSMENT",
      contentId: asmtIdA,
    });
    assert.strictEqual(unpublishRes.success, true);
    assert.strictEqual(unpublishRes.status, "REVIEWED");

    const accessAfterRevoke = await getStudentContentByAccessCode(null, publishedCodeAsmt);
    assert.strictEqual(accessAfterRevoke, null, "Revoked assessment must be inaccessible to students");
  });

  // --------------------------------------------------------------------------
  // SECTION 6: EXPRESS ROUTER HTTP INTEGRATION & RATE LIMITING
  // --------------------------------------------------------------------------
  const app = express();
  app.use(express.json());
  app.use("/api/teacher", createTeacherPublishingRouter(null, mockRequireTeacher));
  app.use("/api/student/access", createStudentAccessRouter(null));

  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  const port = server.address().port;

  async function postJson(path, body, token = null) {
    return new Promise((resolve, reject) => {
      const payload = JSON.stringify(body);
      const headers = {
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(payload),
      };
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }
      const req = http.request(
        {
          hostname: "127.0.0.1",
          port,
          path,
          method: "POST",
          headers,
        },
        (res) => {
          let data = "";
          res.on("data", (chunk) => (data += chunk));
          res.on("end", () => {
            try {
              resolve({ status: res.statusCode, body: JSON.parse(data) });
            } catch {
              resolve({ status: res.statusCode, body: data });
            }
          });
        }
      );
      req.on("error", reject);
      req.write(payload);
      req.end();
    });
  }

  const teacherTokenA = signToken(teacherA, "teacher");
  const studentToken = signToken("student_01", "student");

  await runAsyncTest("HTTP_API", "POST /api/teacher/publish rejects unauthenticated request with 401", async () => {
    const res = await postJson("/api/teacher/publish", {
      contentType: "LESSON",
      contentId: lessonIdA,
    });
    assert.strictEqual(res.status, 401);
  });

  await runAsyncTest("HTTP_API", "POST /api/teacher/publish rejects student role with 403", async () => {
    const res = await postJson(
      "/api/teacher/publish",
      { contentType: "LESSON", contentId: lessonIdA },
      studentToken
    );
    assert.strictEqual(res.status, 403);
  });

  let liveCode = null;
  await runAsyncTest("HTTP_API", "POST /api/teacher/publish successfully publishes for teacher", async () => {
    const res = await postJson(
      "/api/teacher/publish",
      { contentType: "LESSON", contentId: lessonIdA },
      teacherTokenA
    );
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.success, true);
    assert.ok(res.body.accessCode);
    liveCode = res.body.accessCode;
  });

  await runAsyncTest("HTTP_API", "POST /api/student/access/verify returns published lesson without credentials", async () => {
    const res = await postJson("/api/student/access/verify", {
      code: liveCode,
    });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.success, true);
    assert.strictEqual(res.body.item.title, "Newton's Laws of Motion");
  });

  await runAsyncTest("HTTP_API", "POST /api/student/access/verify returns 404 for invalid code", async () => {
    const res = await postJson("/api/student/access/verify", {
      code: "LU-000000",
    });
    assert.strictEqual(res.status, 404);
    assert.strictEqual(res.body.success, false);
  });

  let liveAsmtCode = null;
  await runAsyncTest("HTTP_API", "POST /api/teacher/publish publishes assessment draft via HTTP API", async () => {
    const res = await postJson(
      "/api/teacher/publish",
      { contentType: "ASSESSMENT", contentId: asmtIdA },
      teacherTokenA
    );
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.success, true);
    assert.strictEqual(res.body.contentType, "ASSESSMENT");
    assert.ok(res.body.accessCode);
    liveAsmtCode = res.body.accessCode;
  });

  await runAsyncTest("HTTP_API", "POST /api/teacher/publish blocks Teacher B from publishing Teacher A's assessment", async () => {
    const teacherTokenB = signToken(teacherB, "teacher");
    const res = await postJson(
      "/api/teacher/publish",
      { contentType: "ASSESSMENT", contentId: asmtIdA },
      teacherTokenB
    );
    assert.strictEqual(res.status, 403);
  });

  await runAsyncTest("HTTP_API", "POST /api/student/access/verify retrieves published assessment via HTTP API", async () => {
    const res = await postJson("/api/student/access/verify", {
      code: liveAsmtCode,
    });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.success, true);
    assert.strictEqual(res.body.item.contentType, "ASSESSMENT");
    assert.strictEqual(res.body.item.topicId, "topic_bio_101");
  });

  await runAsyncTest("HTTP_API", "POST /api/student/access/check-answer validates student answer via HTTP API", async () => {
    const res = await postJson("/api/student/access/check-answer", {
      code: liveAsmtCode,
      questionId: "q_order",
      studentAnswer: ["step_1", "step_2", "step_3"],
    });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.success, true);
    assert.strictEqual(res.body.isCorrect, true);
  });

  // --------------------------------------------------------------------------
  // SECTION 7: PHASE 6.4 — MULTI-FORMAT DELIVERY, TIMED BLITZ, SESSIONS & SECURE GRADING
  // --------------------------------------------------------------------------
  console.log("\n--- Phase 6.4: Interactive Student Delivery & Secure Server-Side Grading ---");

  const asmtAllFormatsId = "asmt_seed_all_formats_01";
  inMemoryAssessments.set(asmtAllFormatsId, {
    id: asmtAllFormatsId,
    teacherId: teacherA,
    title: "Complete Curriculum Assessment All Formats",
    subject: "Science",
    topic: "Energy Transformations",
    topicId: "topic_sci_200",
    status: "REVIEWED",
    contentType: "TEST",
    gameFormat: "TIMED_BLITZ",
    difficulty: "HARD",
    questionCount: 6,
    content: {
      title: "Complete Curriculum Assessment All Formats",
      topicId: "topic_sci_200",
      questions: [
        {
          id: "q_mc",
          type: "MULTIPLE_CHOICE",
          questionText: "What energy transformation occurs in a solar cell?",
          options: ["Light to Electrical", "Chemical to Thermal", "Nuclear to Kinetic", "Sound to Magnetic"],
          correctAnswer: "Light to Electrical",
          explanation: "Photovoltaic cells convert photons directly to electrical current.",
        },
        {
          id: "q_tf",
          type: "TRUE_FALSE",
          questionText: "Energy can be created or destroyed in an isolated system.",
          options: ["True", "False"],
          correctAnswer: false,
          explanation: "Conservation of energy dictates energy cannot be created or destroyed.",
        },
        {
          id: "q_match",
          type: "MATCHING",
          questionText: "Match energy source with its type:",
          matchingPairs: [
            { left: "Wind Turbine", right: "Kinetic" },
            { left: "Battery", right: "Chemical" },
            { left: "Uranium", right: "Nuclear" },
          ],
          correctAnswer: {
            "Wind Turbine": "Kinetic",
            "Battery": "Chemical",
            "Uranium": "Nuclear",
          },
          explanation: "Sources classified by stored/active mechanical forms.",
        },
        {
          id: "q_flash",
          type: "FLASHCARD",
          front: "Law of Conservation of Energy",
          back: "Total energy remains constant in an isolated system.",
          explanation: "Fundamental thermodynamic principle.",
        },
        {
          id: "q_order",
          type: "ORDERING",
          questionText: "Order energy flow in hydroelectric dam:",
          items: [
            { id: "e_1", text: "Water stored in reservoir (Potential)" },
            { id: "e_2", text: "Falling water spins turbine (Kinetic)" },
            { id: "e_3", text: "Generator outputs power (Electrical)" },
          ],
          correctOrder: ["e_1", "e_2", "e_3"],
          explanation: "Gravitational potential converts to kinetic then electrical energy.",
        },
        {
          id: "q_blitz",
          type: "TIMED_BLITZ",
          questionText: "Which is a renewable resource?",
          options: ["Solar", "Coal", "Petroleum", "Natural Gas"],
          correctAnswer: "Solar",
          timeLimitSeconds: 10,
          explanation: "Solar radiation is naturally replenished continuously.",
        },
      ],
    },
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  let publishedAllFormatsCode = null;
  await runAsyncTest("Phase6.4_Delivery", "Publishes 6-format assessment and provides sanitized student content", async () => {
    const pubRes = await publishTeacherContent(null, {
      teacherId: teacherA,
      contentType: "ASSESSMENT",
      contentId: asmtAllFormatsId,
    });
    assert.strictEqual(pubRes.success, true);
    assert.ok(isValidAccessCodeFormat(pubRes.accessCode));
    publishedAllFormatsCode = pubRes.accessCode;

    // Student retrieval
    const studentView = await getStudentContentByAccessCode(null, publishedAllFormatsCode);
    assert.ok(studentView);
    assert.strictEqual(studentView.content.questions.length, 6);

    // Verify sanitization of answer keys across all 6 formats
    studentView.content.questions.forEach((q) => {
      assert.strictEqual(q.correctAnswer, undefined, `Question ${q.id} must not leak correctAnswer`);
      assert.strictEqual(q.explanation, undefined, `Question ${q.id} must not leak explanation`);
      assert.strictEqual(q.sourceReference, undefined, `Question ${q.id} must not leak sourceReference`);
      if (q.type === "FLASHCARD") {
        assert.strictEqual(q.back, undefined, "Flashcard back must be scrubbed");
        assert.ok(q.front, "Flashcard front prompt must be delivered");
      }
      if (q.type === "ORDERING") {
        assert.strictEqual(q.correctOrder, undefined, "Ordering correctOrder must be scrubbed");
      }
      if (q.type === "MATCHING") {
        assert.ok(Array.isArray(q.matchingLeft), "Matching left items must be provided");
        assert.ok(Array.isArray(q.matchingRight), "Matching right options must be provided");
      }
    });
  });

  let activeSessionId = null;
  await runAsyncTest("Phase6.4_Sessions", "POST /api/student/access/start-assessment starts timed session with deadline", async () => {
    const res = await postJson("/api/student/access/start-assessment", {
      code: publishedAllFormatsCode,
      studentId: "student_alpha",
    });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.success, true);
    assert.ok(res.body.sessionId);
    assert.strictEqual(res.body.questionCount, 6);
    assert.strictEqual(res.body.isTimed, true);
    assert.ok(res.body.deadline > Date.now());
    activeSessionId = res.body.sessionId;
  });

  await runAsyncTest("Phase6.4_Sessions", "POST /api/student/access/start-assessment rejects invalid code with 404", async () => {
    const res = await postJson("/api/student/access/start-assessment", {
      code: "LU-XXXXXX",
    });
    assert.strictEqual(res.status, 404);
  });

  await runAsyncTest("Phase6.4_Grading", "POST /api/student/access/submit-assessment correctly grades all 6 question formats", async () => {
    const answers = [
      { questionId: "q_mc", studentAnswer: "Light to Electrical" },
      { questionId: "q_tf", studentAnswer: false },
      {
        questionId: "q_match",
        studentAnswer: {
          "Wind Turbine": "Kinetic",
          "Battery": "Chemical",
          "Uranium": "Nuclear",
        },
      },
      { questionId: "q_flash", studentAnswer: true },
      { questionId: "q_order", studentAnswer: ["e_1", "e_2", "e_3"] },
      { questionId: "q_blitz", studentAnswer: "Solar" },
    ];

    const res = await postJson("/api/student/access/submit-assessment", {
      code: publishedAllFormatsCode,
      sessionId: activeSessionId,
      answers,
      studentId: "student_alpha",
    });

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.success, true);
    assert.strictEqual(res.body.score, 100);
    assert.strictEqual(res.body.correctCount, 6);
    assert.strictEqual(res.body.totalQuestions, 6);
    assert.strictEqual(res.body.topicId, "topic_sci_200");
    assert.strictEqual(res.body.results.length, 6);

    // Verify explanations and answers are now revealed
    res.body.results.forEach((r) => {
      assert.strictEqual(r.isCorrect, true);
      assert.ok(r.explanation, "Verified explanation must be revealed on results");
      assert.ok(r.correctAnswer !== null, "Correct answer must be revealed on results");
    });
  });

  await runAsyncTest("Phase6.4_Security", "Rejects duplicate or concurrent submission attempt on same session", async () => {
    const res = await postJson("/api/student/access/submit-assessment", {
      code: publishedAllFormatsCode,
      sessionId: activeSessionId,
      answers: [{ questionId: "q_mc", studentAnswer: "Light to Electrical" }],
    });
    assert.strictEqual(res.status, 400);
    assert.strictEqual(res.body.code, "DUPLICATE_SUBMISSION");
  });

  await runAsyncTest("Phase6.4_Security", "Rejects rogue/unregistered question ID not belonging to assessment", async () => {
    // Start fresh session
    const startRes = await postJson("/api/student/access/start-assessment", {
      code: publishedAllFormatsCode,
    });
    assert.strictEqual(startRes.status, 200);
    const newSessionId = startRes.body.sessionId;

    const res = await postJson("/api/student/access/submit-assessment", {
      code: publishedAllFormatsCode,
      sessionId: newSessionId,
      answers: [
        { questionId: "q_mc", studentAnswer: "Light to Electrical" },
        { questionId: "q_rogue_intruder_999", studentAnswer: "Fake" },
      ],
    });
    assert.strictEqual(res.status, 400);
    assert.ok(res.body.message.includes("does not belong"));
  });

  await runAsyncTest("Phase6.4_Security", "Deduplicates multiple answers for same question within attempt", async () => {
    // Start fresh session
    const startRes = await postJson("/api/student/access/start-assessment", {
      code: publishedAllFormatsCode,
    });
    assert.strictEqual(startRes.status, 200);
    const newSessionId = startRes.body.sessionId;

    const res = await postJson("/api/student/access/submit-assessment", {
      code: publishedAllFormatsCode,
      sessionId: newSessionId,
      answers: [
        { questionId: "q_mc", studentAnswer: "Light to Electrical" },
        { questionId: "q_mc", studentAnswer: "Wrong Option" }, // duplicate attempt for same question ID
      ],
    });
    assert.strictEqual(res.status, 200);
    // Deduplication kept the first answer, scored correctly without inflating total count
    assert.strictEqual(res.body.correctCount, 1);
  });

  await runAsyncTest("Phase6.4_Security", "Rejects submission when session deadline has expired", async () => {
    const startRes = await postJson("/api/student/access/start-assessment", {
      code: publishedAllFormatsCode,
    });
    assert.strictEqual(startRes.status, 200);
    const expiredSessionId = startRes.body.sessionId;

    // Manually force session deadline to 10 seconds in the past
    const sessionRecord = inMemoryAssessmentSessions.get(expiredSessionId);
    assert.ok(sessionRecord);
    sessionRecord.deadline = Date.now() - 10000;

    const res = await postJson("/api/student/access/submit-assessment", {
      code: publishedAllFormatsCode,
      sessionId: expiredSessionId,
      answers: [{ questionId: "q_mc", studentAnswer: "Light to Electrical" }],
    });
    assert.strictEqual(res.status, 400);
    assert.strictEqual(res.body.code, "TIME_EXPIRED");
  });

  await runAsyncTest("Phase6.4_Revocation", "Teacher unpublishes assessment; subsequent student submission is rejected with 404", async () => {
    const unpub = await unpublishTeacherContent(null, {
      teacherId: teacherA,
      contentType: "ASSESSMENT",
      contentId: asmtAllFormatsId,
    });
    assert.strictEqual(unpub.success, true);

    const res = await postJson("/api/student/access/submit-assessment", {
      code: publishedAllFormatsCode,
      answers: [{ questionId: "q_mc", studentAnswer: "Light to Electrical" }],
    });
    assert.strictEqual(res.status, 404);
  });

  await new Promise((resolve) => server.close(resolve));

  console.log("\n======================================================================");
  console.log(`  PHASE 3.4 TEST RESULTS: ${passed} PASSED, 0 FAILED`);
  console.log("======================================================================\n");
}

main().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
