/**
 * LUCOUS Phase 3.3 — AI Assessment & Game Generation Test Suite
 * 
 * Verifies:
 * 1. Assessment schema validation (MC, True/False, Fill-in-the-blank, Matching)
 * 2. Multiple-choice single-correct answer requirement
 * 3. Matching pairs completeness and bidirectional mapping validation
 * 4. Fill-in-the-blank accepted answer validation
 * 5. Deterministic fallback labeling and honesty (isAiGenerated: false)
 * 6. Authentication & Role Authorization (Teacher only, 401/403)
 * 7. Cross-teacher source material ownership enforcement
 * 8. Cross-teacher assessment access, update, and deletion isolation
 * 9. Missing storage binary handling (410)
 * 10. Complete Assessment CRUD Lifecycle
 * 11. Malformed update rejection
 */

const assert = require("assert");
const http = require("http");
const express = require("express");
const jwt = require("jsonwebtoken");

// Set environment for test mode
process.env.ALLOW_EPHEMERAL_DEV_STORAGE = "true";
process.env.NODE_ENV = "test";

const {
  validateAssessmentSchema,
  validateQuestion,
  generateUnconfiguredAssessmentPreview,
  generateAssessmentDraft,
  getAiConfig,
} = require("./services/assessment-generator");
const { createTeacherMaterialsRouter, inMemoryMaterials } = require("./routes/teacher-materials");
const { createTeacherAssessmentsRouter, inMemoryAssessments } = require("./routes/teacher-assessments");
const { LocalStorageAdapter, getStorageAdapter } = require("./storage/storage-adapter");

const JWT_SECRET = process.env.JWT_SECRET || "lucous-development-secret";

console.log("======================================================================");
console.log("  LUCOUS PHASE 3.3 — AI ASSESSMENT & GAME GENERATION TEST SUITE");
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
      if (String(payload.role).toLowerCase() !== String(expectedRole).toLowerCase()) {
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

async function runAllTests() {
  // -------------------------------------------------------------------------
  // SECTION 1: Question Format & Schema Validation
  // -------------------------------------------------------------------------
  console.log("\n--- Section 1: Assessment Schema & Question Formats ---");

  runSyncTest("Multiple-choice: Validates 4 distinct options and matching single correct answer", () => {
    const validMC = {
      id: "q-1",
      questionType: "MULTIPLE_CHOICE",
      questionText: "What is Newton's first law of motion also known as?",
      options: ["Law of Inertia", "Law of Acceleration", "Law of Gravitation", "Law of Friction"],
      correctAnswer: "Law of Inertia",
      explanation: "Newton's first law states that an object remains at rest unless acted on by an external force.",
      sourceExcerpt: "Newton's first law of motion is frequently called the law of inertia.",
    };
    const res = validateQuestion(validMC, 0);
    assert.strictEqual(res.valid, true);
    assert.strictEqual(res.question.correctAnswer, "Law of Inertia");
  });

  runSyncTest("Multiple-choice: Rejects when fewer or more than 4 options provided", () => {
    const invalidMC = {
      id: "q-2",
      questionType: "MULTIPLE_CHOICE",
      questionText: "Which is a noble gas?",
      options: ["Helium", "Neon", "Argon"], // only 3 options
      correctAnswer: "Helium",
      explanation: "Helium is an inert gas.",
    };
    const res = validateQuestion(invalidMC, 0);
    assert.strictEqual(res.valid, false);
    assert.ok(res.error.includes("exactly 4 options"));
  });

  runSyncTest("Multiple-choice: Rejects when correct answer is not present in options", () => {
    const invalidMC = {
      id: "q-3",
      questionType: "MULTIPLE_CHOICE",
      questionText: "Capital of France?",
      options: ["London", "Berlin", "Madrid", "Rome"],
      correctAnswer: "Paris", // not in options
      explanation: "Paris is the capital.",
    };
    const res = validateQuestion(invalidMC, 0);
    assert.strictEqual(res.valid, false);
    assert.ok(res.error.includes("must match one of the options"));
  });

  runSyncTest("Multiple-choice: Rejects duplicate options", () => {
    const invalidMC = {
      id: "q-4",
      questionType: "MULTIPLE_CHOICE",
      questionText: "Select answer:",
      options: ["Option A", "Option A", "Option B", "Option C"],
      correctAnswer: "Option A",
      explanation: "Dup check",
    };
    const res = validateQuestion(invalidMC, 0);
    assert.strictEqual(res.valid, false);
    assert.ok(res.error.includes("distinct"));
  });

  runSyncTest("True/False: Validates strict boolean options and answer", () => {
    const validTF = {
      id: "q-5",
      questionType: "TRUE_FALSE",
      questionText: "Sound travels faster through air than through steel.",
      options: ["True", "False"],
      correctAnswer: "False",
      explanation: "Sound travels much faster in solids like steel (approx 5000 m/s) than in air (343 m/s).",
    };
    const res = validateQuestion(validTF, 0);
    assert.strictEqual(res.valid, true);
    assert.strictEqual(res.question.correctAnswer, "False");
  });

  runSyncTest("True/False: Rejects non-standard True/False options", () => {
    const invalidTF = {
      id: "q-6",
      questionType: "TRUE_FALSE",
      questionText: "Water boils at 100 C at sea level.",
      options: ["Yes", "No"],
      correctAnswer: "Yes",
      explanation: "Standard",
    };
    const res = validateQuestion(invalidTF, 0);
    assert.strictEqual(res.valid, false);
    assert.ok(res.error.includes("True and False"));
  });

  runSyncTest("Fill-in-the-blank: Validates answer and variations", () => {
    const validFIB = {
      id: "q-7",
      questionType: "FILL_BLANK",
      questionText: "The SI unit of force is the _______.",
      correctAnswer: "Newton",
      acceptedAnswers: ["newton", "Newtons", "N"],
      explanation: "Force is measured in Newtons (N) in the metric system.",
    };
    const res = validateQuestion(validFIB, 0);
    assert.strictEqual(res.valid, true);
    assert.ok(res.question.acceptedAnswers.includes("newton"));
  });

  runSyncTest("Fill-in-the-blank: Rejects empty or missing correct answer", () => {
    const invalidFIB = {
      id: "q-8",
      questionType: "FILL_BLANK",
      questionText: "The green pigment in plants is called _______.",
      correctAnswer: "",
      explanation: "Chlorophyll",
    };
    const res = validateQuestion(invalidFIB, 0);
    assert.strictEqual(res.valid, false);
    assert.ok(res.error.includes("correct answer"));
  });

  runSyncTest("Matching: Validates matching pairs and bijective mapping", () => {
    const validMatch = {
      id: "q-9",
      questionType: "MATCHING",
      questionText: "Match the following SI units to their physical quantities:",
      matchingPairs: [
        { left: "Force", right: "Newton" },
        { left: "Energy", right: "Joule" },
        { left: "Pressure", right: "Pascal" },
        { left: "Power", right: "Watt" },
      ],
      correctAnswer: {
        Force: "Newton",
        Energy: "Joule",
        Pressure: "Pascal",
        Power: "Watt",
      },
      explanation: "Each SI unit corresponds to the correct physical quantity.",
    };
    const res = validateQuestion(validMatch, 0);
    assert.strictEqual(res.valid, true);
    assert.strictEqual(res.question.matchingPairs.length, 4);
  });

  runSyncTest("Matching: Rejects when fewer than 3 pairs provided", () => {
    const invalidMatch = {
      id: "q-10",
      questionType: "MATCHING",
      questionText: "Match pairs:",
      matchingPairs: [
        { left: "Item A", right: "Val 1" },
        { left: "Item B", right: "Val 2" },
      ], // only 2 pairs
      correctAnswer: { "Item A": "Val 1", "Item B": "Val 2" },
      explanation: "Too few pairs",
    };
    const res = validateQuestion(invalidMatch, 0);
    assert.strictEqual(res.valid, false);
    assert.ok(res.error.includes("at least 3 pairs"));
  });

  runSyncTest("Matching: Rejects incomplete mapping in correctAnswer", () => {
    const invalidMatch = {
      id: "q-11",
      questionType: "MATCHING",
      questionText: "Match quantities:",
      matchingPairs: [
        { left: "P1", right: "V1" },
        { left: "P2", right: "V2" },
        { left: "P3", right: "V3" },
      ],
      correctAnswer: { P1: "V1", P2: "WRONG_VALUE" }, // P3 missing, P2 wrong
      explanation: "Incomplete",
    };
    const res = validateQuestion(invalidMatch, 0);
    assert.strictEqual(res.valid, false);
    assert.ok(res.error.includes("must map"));
  });

  runSyncTest("Full Assessment Schema: Validates complete assessment object", () => {
    const fullAssessment = {
      title: "Class 10 Physics - Laws of Motion Practice",
      description: "Comprehensive practice questions grounded in Chapter 4 notes.",
      contentType: "PRACTICE",
      gameFormat: "MULTIPLE_CHOICE",
      difficulty: "MEDIUM",
      totalQuestions: 2,
      questions: [
        {
          id: "q-1",
          questionType: "MULTIPLE_CHOICE",
          questionText: "What is inertia?",
          options: ["Resistance to change in motion", "Force of gravity", "Speed divided by time", "Mass times velocity"],
          correctAnswer: "Resistance to change in motion",
          explanation: "Inertia is the inherent resistance of matter to change in velocity.",
        },
        {
          id: "q-2",
          questionType: "MULTIPLE_CHOICE",
          questionText: "What is the SI unit of momentum?",
          options: ["kg*m/s", "N/m", "Joules", "Watts"],
          correctAnswer: "kg*m/s",
          explanation: "Momentum is mass times velocity, so units are kg*m/s.",
        },
      ],
    };
    const res = validateAssessmentSchema(fullAssessment, 2);
    assert.strictEqual(res.valid, true);
    assert.strictEqual(res.assessment.questions.length, 2);
  });

  runSyncTest("Full Assessment Schema: Rejects when question count does not match", () => {
    const mismatch = {
      title: "Test",
      description: "Test",
      contentType: "TEST",
      gameFormat: "MULTIPLE_CHOICE",
      difficulty: "EASY",
      totalQuestions: 5, // Expected 5, but only 1 question supplied
      questions: [
        {
          id: "q-1",
          questionType: "MULTIPLE_CHOICE",
          questionText: "Q1",
          options: ["A", "B", "C", "D"],
          correctAnswer: "A",
          explanation: "Exp",
        },
      ],
    };
    const res = validateAssessmentSchema(mismatch, 5);
    assert.strictEqual(res.valid, false);
    assert.ok(res.error.includes("Expected 5 questions"));
  });

  // -------------------------------------------------------------------------
  // SECTION 2: Deterministic Unconfigured Fallback
  // -------------------------------------------------------------------------
  console.log("\n--- Section 2: Deterministic Fallback & Honesty ---");

  runSyncTest("Unconfigured fallback: Generates requested question count and flags isAiGenerated: false", () => {
    const sourceText = "Ohm's Law states that current is directly proportional to voltage across a conductor.\nV = I * R where R is resistance in ohms.\nElectric current is measured in amperes using an ammeter.\nResistance opposes current flow.";
    
    const preview = generateUnconfiguredAssessmentPreview({
      materialTitle: "ohms_law.pdf",
      extractedText: sourceText,
      subject: "Physics",
      topic: "Current Electricity",
      contentType: "PRACTICE",
      gameFormat: "MULTIPLE_CHOICE",
      difficulty: "MEDIUM",
      questionCount: 5,
    });

    assert.strictEqual(preview.aiProvider, "unconfigured_preview");
    assert.strictEqual(preview.isAiGenerated, false);
    assert.strictEqual(preview.content.questions.length, 5);
    assert.ok(preview.content.title.includes("Preview"));
    assert.ok(preview.content.questions[0].explanation.length > 5);
    assert.ok(preview.content.questions[0].sourceReference);
  });

  runSyncTest("Unconfigured fallback: Supports MATCHING format with pairs", () => {
    const sourceText = "Atoms consist of protons, neutrons, and electrons.\nProtons carry a positive charge.\nNeutrons carry neutral charge.\nElectrons carry negative charge.";
    
    const preview = generateUnconfiguredAssessmentPreview({
      materialTitle: "atomic_structure.docx",
      extractedText: sourceText,
      subject: "Chemistry",
      topic: "Structure of Atom",
      contentType: "GAME",
      gameFormat: "MATCHING",
      difficulty: "EASY",
      questionCount: 5,
    });

    assert.strictEqual(preview.content.gameFormat, "MATCHING");
    assert.strictEqual(preview.content.questions.length, 5);
    const q1 = preview.content.questions[0];
    assert.strictEqual(q1.questionType, "MATCHING");
    assert.ok(Array.isArray(q1.matchingPairs));
    assert.ok(q1.matchingPairs.length >= 3);
    assert.ok(typeof q1.correctAnswer === "object");
  });

  // -------------------------------------------------------------------------
  // SECTION 3: HTTP API & Teacher Authorization / Isolation
  // -------------------------------------------------------------------------
  console.log("\n--- Section 3: HTTP API, Auth, & Ownership Protection ---");

  const app = express();
  app.use(express.json());

  // Mount teacher materials and assessments routers
  const storageAdapter = getStorageAdapter();
  const requireTeacher = verifyRoleMiddleware("teacher");
  app.use("/api/teacher", createTeacherMaterialsRouter(null, requireTeacher));
  app.use("/api/teacher", createTeacherAssessmentsRouter(null, requireTeacher));

  const server = http.createServer(app);

  await new Promise((resolve) => server.listen(0, resolve));
  const port = server.address().port;

  const teacherAId = "teacher-101";
  const teacherBId = "teacher-202";
  const studentId = "student-303";

  const teacherAToken = makeToken(teacherAId, "teacher");
  const teacherBToken = makeToken(teacherBId, "teacher");
  const studentToken = makeToken(studentId, "student");

  // Create test material owned by Teacher A in storage and in-memory map
  const testStorageKey = "materials_test_physics.txt";
  const testMaterialContent = Buffer.from(
    "Chapter 3: Work, Energy, and Power.\nWork done is force multiplied by displacement in the direction of force.\nKinetic energy is energy possessed due to motion: KE = 0.5 * m * v^2.\nPotential energy is energy possessed due to position: PE = m * g * h.\nThe law of conservation of energy states total mechanical energy remains constant in an isolated system."
  );
  const saveRes = await storageAdapter.save({
    key: testStorageKey,
    buffer: testMaterialContent,
    mimeType: "text/plain",
  });

  const materialA = {
    id: "mat-physics-1",
    teacherId: teacherAId,
    originalName: "physics-notes.txt",
    storedName: "notes-stored.txt",
    storageKey: saveRes.storageKey,
    mimeType: "text/plain",
    extension: ".txt",
    fileSize: testMaterialContent.length,
    checksum: "dummychecksum12345",
    educationLevel: "school",
    classGrade: "10",
    board: "cbse",
    subjectName: "Physics",
    topicName: "Work and Energy",
    status: "READY",
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  inMemoryMaterials.set(materialA.id, materialA);

  await runAsyncTest("Auth Guard: Returns 401 when no token is provided", async () => {
    const res = await makeRequest(server, {
      hostname: "127.0.0.1",
      port,
      path: "/api/teacher/assessments",
      method: "GET",
    });
    assert.strictEqual(res.status, 401);
  });

  await runAsyncTest("Role Guard: Returns 403 when user is student role", async () => {
    const res = await makeRequest(server, {
      hostname: "127.0.0.1",
      port,
      path: "/api/teacher/assessments",
      method: "GET",
      headers: { Authorization: `Bearer ${studentToken}` },
    });
    assert.strictEqual(res.status, 403);
  });

  await runAsyncTest("Ownership Guard: Teacher B cannot generate from Teacher A's material", async () => {
    const res = await makeRequest(
      server,
      {
        hostname: "127.0.0.1",
        port,
        path: "/api/teacher/assessments/generate",
        method: "POST",
        headers: {
          Authorization: `Bearer ${teacherBToken}`,
          "Content-Type": "application/json",
        },
      },
      {
        materialId: materialA.id,
        contentType: "PRACTICE",
        gameFormat: "MULTIPLE_CHOICE",
        difficulty: "MEDIUM",
        questionCount: 5,
      }
    );
    assert.strictEqual(res.status, 403);
    assert.ok(res.body.message.includes("Access denied"));
  });

  await runAsyncTest("Parameter Validation: Rejects invalid question counts (e.g. 7)", async () => {
    const res = await makeRequest(
      server,
      {
        hostname: "127.0.0.1",
        port,
        path: "/api/teacher/assessments/generate",
        method: "POST",
        headers: {
          Authorization: `Bearer ${teacherAToken}`,
          "Content-Type": "application/json",
        },
      },
      {
        materialId: materialA.id,
        contentType: "PRACTICE",
        gameFormat: "MULTIPLE_CHOICE",
        difficulty: "MEDIUM",
        questionCount: 7, // Invalid count
      }
    );
    assert.strictEqual(res.status, 400);
    assert.ok(res.body.message.includes("Question count must be"));
  });

  // -------------------------------------------------------------------------
  // SECTION 4: Assessment CRUD Lifecycle
  // -------------------------------------------------------------------------
  console.log("\n--- Section 4: Full Assessment CRUD Lifecycle ---");

  let generatedAssessmentId = null;

  await runAsyncTest("POST /api/teacher/assessments/generate: Successfully creates assessment draft", async () => {
    const res = await makeRequest(
      server,
      {
        hostname: "127.0.0.1",
        port,
        path: "/api/teacher/assessments/generate",
        method: "POST",
        headers: {
          Authorization: `Bearer ${teacherAToken}`,
          "Content-Type": "application/json",
        },
      },
      {
        materialId: materialA.id,
        contentType: "PRACTICE",
        gameFormat: "MULTIPLE_CHOICE",
        difficulty: "MEDIUM",
        questionCount: 5,
      }
    );

    assert.strictEqual(res.status, 201);
    assert.strictEqual(res.body.success, true);
    assert.ok(res.body.assessment);
    assert.strictEqual(res.body.assessment.teacherId, teacherAId);
    assert.strictEqual(res.body.assessment.contentType, "PRACTICE");
    assert.strictEqual(res.body.assessment.questionCount, 5);
    assert.strictEqual(res.body.assessment.content.questions.length, 5);
    assert.strictEqual(res.body.assessment.status, "DRAFT");
    
    generatedAssessmentId = res.body.assessment.id;
  });

  await runAsyncTest("GET /api/teacher/assessments: Lists assessments for Teacher A", async () => {
    const res = await makeRequest(server, {
      hostname: "127.0.0.1",
      port,
      path: "/api/teacher/assessments",
      method: "GET",
      headers: { Authorization: `Bearer ${teacherAToken}` },
    });

    assert.strictEqual(res.status, 200);
    assert.ok(Array.isArray(res.body.assessments));
    assert.strictEqual(res.body.assessments.length, 1);
    assert.strictEqual(res.body.assessments[0].id, generatedAssessmentId);
  });

  await runAsyncTest("Isolation: Teacher B sees 0 assessments", async () => {
    const res = await makeRequest(server, {
      hostname: "127.0.0.1",
      port,
      path: "/api/teacher/assessments",
      method: "GET",
      headers: { Authorization: `Bearer ${teacherBToken}` },
    });

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.assessments.length, 0);
  });

  await runAsyncTest("GET /api/teacher/assessments/:id: Retrieves assessment detail with parsed content", async () => {
    const res = await makeRequest(server, {
      hostname: "127.0.0.1",
      port,
      path: `/api/teacher/assessments/${generatedAssessmentId}`,
      method: "GET",
      headers: { Authorization: `Bearer ${teacherAToken}` },
    });

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.assessment.id, generatedAssessmentId);
    assert.ok(res.body.assessment.content.questions);
    assert.strictEqual(typeof res.body.assessment.content, "object");
  });

  await runAsyncTest("PUT /api/teacher/assessments/:id: Updates assessment questions and reviews status", async () => {
    // Fetch existing content
    const detailRes = await makeRequest(server, {
      hostname: "127.0.0.1",
      port,
      path: `/api/teacher/assessments/${generatedAssessmentId}`,
      method: "GET",
      headers: { Authorization: `Bearer ${teacherAToken}` },
    });

    const updatedContent = detailRes.body.assessment.content;
    updatedContent.title = "Reviewed Practice - Class 10 Physics";
    updatedContent.questions[0].questionText = "Edited Question: What is the unit of mechanical work?";
    updatedContent.questions[0].options = ["Joule", "Watt", "Newton", "Pascal"];
    updatedContent.questions[0].correctAnswer = "Joule";
    updatedContent.questions[0].explanation = "Work is measured in Joules (J).";

    const updateRes = await makeRequest(
      server,
      {
        hostname: "127.0.0.1",
        port,
        path: `/api/teacher/assessments/${generatedAssessmentId}`,
        method: "PUT",
        headers: {
          Authorization: `Bearer ${teacherAToken}`,
          "Content-Type": "application/json",
        },
      },
      {
        title: "Reviewed Practice - Class 10 Physics",
        content: updatedContent,
        status: "REVIEWED",
      }
    );

    assert.strictEqual(updateRes.status, 200);
    assert.strictEqual(updateRes.body.assessment.title, "Reviewed Practice - Class 10 Physics");
    assert.strictEqual(updateRes.body.assessment.status, "REVIEWED");
    assert.strictEqual(updateRes.body.assessment.content.questions[0].correctAnswer, "Joule");
  });

  await runAsyncTest("PUT /api/teacher/assessments/:id: Rejects invalid question edits (e.g. wrong answer)", async () => {
    const detailRes = await makeRequest(server, {
      hostname: "127.0.0.1",
      port,
      path: `/api/teacher/assessments/${generatedAssessmentId}`,
      method: "GET",
      headers: { Authorization: `Bearer ${teacherAToken}` },
    });

    const invalidContent = JSON.parse(JSON.stringify(detailRes.body.assessment.content));
    invalidContent.questions[0].correctAnswer = "NON_EXISTENT_OPTION";

    const updateRes = await makeRequest(
      server,
      {
        hostname: "127.0.0.1",
        port,
        path: `/api/teacher/assessments/${generatedAssessmentId}`,
        method: "PUT",
        headers: {
          Authorization: `Bearer ${teacherAToken}`,
          "Content-Type": "application/json",
        },
      },
      {
        title: "Invalid Update",
        content: invalidContent,
      }
    );

    assert.strictEqual(updateRes.status, 400);
    assert.ok(updateRes.body.message.includes("Invalid question content"));
  });

  await runAsyncTest("Cross-Teacher Isolation: Teacher B cannot update Teacher A's assessment", async () => {
    const res = await makeRequest(
      server,
      {
        hostname: "127.0.0.1",
        port,
        path: `/api/teacher/assessments/${generatedAssessmentId}`,
        method: "PUT",
        headers: {
          Authorization: `Bearer ${teacherBToken}`,
          "Content-Type": "application/json",
        },
      },
      {
        title: "Hacked Title",
      }
    );
    assert.strictEqual(res.status, 403);
  });

  await runAsyncTest("Cross-Teacher Isolation: Teacher B cannot delete Teacher A's assessment", async () => {
    const res = await makeRequest(server, {
      hostname: "127.0.0.1",
      port,
      path: `/api/teacher/assessments/${generatedAssessmentId}`,
      method: "DELETE",
      headers: { Authorization: `Bearer ${teacherBToken}` },
    });
    assert.strictEqual(res.status, 403);
  });

  await runAsyncTest("DELETE /api/teacher/assessments/:id: Deletes assessment successfully", async () => {
    const res = await makeRequest(server, {
      hostname: "127.0.0.1",
      port,
      path: `/api/teacher/assessments/${generatedAssessmentId}`,
      method: "DELETE",
      headers: { Authorization: `Bearer ${teacherAToken}` },
    });

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.success, true);

    // Verify it is gone
    const getRes = await makeRequest(server, {
      hostname: "127.0.0.1",
      port,
      path: `/api/teacher/assessments/${generatedAssessmentId}`,
      method: "GET",
      headers: { Authorization: `Bearer ${teacherAToken}` },
    });
    assert.strictEqual(getRes.status, 404);
  });

  await runAsyncTest("Missing binary detection: Returns 410 when file is missing from storage", async () => {
    const missingMat = {
      id: "mat-missing-file",
      teacherId: teacherAId,
      originalName: "vanished.pdf",
      storageKey: "materials/teacher-101/nonexistent.pdf",
      mimeType: "application/pdf",
      fileSize: 1024,
      status: "READY",
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    inMemoryMaterials.set(missingMat.id, missingMat);

    const res = await makeRequest(
      server,
      {
        hostname: "127.0.0.1",
        port,
        path: "/api/teacher/assessments/generate",
        method: "POST",
        headers: {
          Authorization: `Bearer ${teacherAToken}`,
          "Content-Type": "application/json",
        },
      },
      {
        materialId: missingMat.id,
        contentType: "PRACTICE",
        gameFormat: "MULTIPLE_CHOICE",
        difficulty: "MEDIUM",
        questionCount: 5,
      }
    );

    assert.strictEqual(res.status, 410);
    assert.ok(res.body.message.includes("could not be found in storage"));
  });

  // Close server
  await new Promise((resolve) => server.close(resolve));

  console.log("\n======================================================================");
  console.log(`  PHASE 3.3 TEST RESULTS: ${passedCount} PASSED, ${failedCount} FAILED`);
  console.log("======================================================================\n");

  if (failedCount > 0) {
    process.exit(1);
  }
}

runAllTests().catch((err) => {
  console.error("Test runner crashed:", err);
  process.exit(1);
});
