// Phase 3 Verification Suite: Education Dropdowns and Curriculum MVP
// Tests:
// - School: Class 1, Class 10, Class 12, boards catalogue and coverage flags
// - Diploma: Years 1-3, MSBTE technical board, branches, semesters, subjects, chapters, topics
// - Dependent cascades and downstream filtering
// - Selection validation & invalid combinations
// - Selection persistence & restoration simulation
// - Uncurated board empty states & missing data transparency

const assert = require("assert");
const {
  getFallbackBoards,
  getFallbackClasses,
  getFallbackSubjects,
  getFallbackChapters,
  getFallbackTopics,
  getFallbackContent,
  getFallbackQuestions,
  getFallbackDiplomaMeta,
  validateCurriculumSelection,
} = require("./curriculum-service");

const {
  ALL_SCHOOL_BOARDS,
  ALL_TECHNICAL_BOARDS,
  ALL_SCHOOL_CLASSES,
  ALL_DIPLOMA_YEARS,
  DIPLOMA_BRANCHES,
  DIPLOMA_SEMESTERS_BY_YEAR,
} = require("./curriculum-data");

console.log("======================================================================");
console.log("  LUCOUS — PHASE 3 EDUCATION DROPDOWNS & CURRICULUM VERIFICATION");
console.log("======================================================================\n");

// -----------------------------------------------------------------------------
// 1. SCHOOL EDUCATION TESTS
// -----------------------------------------------------------------------------
console.log("--- 1. School Education & Boards Catalogue ---");

const allBoards = getFallbackBoards();
const schoolBoards = getFallbackBoards("school");
console.log(`[PASS] Loaded ${schoolBoards.length} school boards (total boards: ${allBoards.length})`);
assert.ok(schoolBoards.length >= 10, "Must support at least 10 school boards");

const schoolNames = schoolBoards.map((b) => b.name);
assert.ok(schoolNames.includes("CBSE"), "CBSE must be present");
assert.ok(schoolNames.includes("ICSE"), "ICSE must be present");
assert.ok(schoolNames.includes("Maharashtra State Board"), "Maharashtra State Board must be present");
assert.ok(schoolNames.includes("Karnataka State Board"), "Configurable state boards like Karnataka must be present");
assert.ok(schoolNames.includes("Tamil Nadu State Board"), "Tamil Nadu must be present");

// Verify separate state & coverage flags
const cbseBoard = schoolBoards.find((b) => b.name === "CBSE");
assert.strictEqual(cbseBoard.type, "school");
assert.strictEqual(cbseBoard.hasCurriculumCoverage, true, "CBSE has verified curriculum coverage");
assert.strictEqual(cbseBoard.state, "Central / National");

const karnatakaBoard = schoolBoards.find((b) => b.name === "Karnataka State Board");
assert.strictEqual(karnatakaBoard.hasCurriculumCoverage, false, "Do not claim coverage before data is verified");
assert.strictEqual(karnatakaBoard.state, "Karnataka");
console.log("[PASS] State, board, and coverage flags properly separated and validated");

// Verify Classes 1 through 12
const cbseClasses = getFallbackClasses(cbseBoard.id);
console.log(`[PASS] CBSE supports ${cbseClasses.length} classes:`, cbseClasses.map((c) => c.name).join(", "));
assert.strictEqual(cbseClasses.length, 12, "Must support Class 1 through Class 12");
for (let i = 1; i <= 12; i++) {
  assert.ok(cbseClasses.some((c) => c.name === `Class ${i}`), `Class ${i} must exist`);
}

// -----------------------------------------------------------------------------
// 2. VERIFIED SCHOOL CURRICULUM (Class 1, Class 10, Class 12)
// -----------------------------------------------------------------------------
console.log("\n--- 2. Verified School Curriculum (Class 1, 10, 12) ---");

// Class 1
const class1 = cbseClasses.find((c) => c.name === "Class 1");
const class1Subjects = getFallbackSubjects(cbseBoard.id, class1.id);
assert.ok(class1Subjects.length >= 1, "Class 1 must have verified Mathematics");
const class1Math = class1Subjects.find((s) => s.name === "Mathematics");
assert.ok(class1Math, "Class 1 Mathematics exists");
const class1Chapters = getFallbackChapters(class1Math.id);
assert.ok(class1Chapters.some((c) => c.name === "Shapes and Space"), "Class 1 has Shapes and Space chapter");
assert.ok(class1Chapters.some((c) => c.name === "Numbers from One to Nine"), "Class 1 has Numbers from One to Nine");
const shapesChapter = class1Chapters.find((c) => c.name === "Shapes and Space");
const shapesTopics = getFallbackTopics(shapesChapter.id);
assert.ok(shapesTopics.length >= 1, "Shapes and Space has verified topics");
console.log(`[PASS] Class 1 Mathematics verified: ${class1Chapters.length} chapters, ${shapesTopics.length} topic(s) in chapter 1`);

// Class 10
const class10 = cbseClasses.find((c) => c.name === "Class 10");
const class10Subjects = getFallbackSubjects(cbseBoard.id, class10.id);
assert.ok(class10Subjects.length >= 2, "Class 10 has Mathematics and Science");
const class10Math = class10Subjects.find((s) => s.name === "Mathematics");
const class10Chapters = getFallbackChapters(class10Math.id);
assert.ok(class10Chapters.some((c) => c.name === "Real Numbers"), "Class 10 has Real Numbers");
assert.ok(class10Chapters.some((c) => c.name === "Quadratic Equations"), "Class 10 has Quadratic Equations");
console.log(`[PASS] Class 10 Mathematics verified: ${class10Chapters.length} chapters`);

// Class 12 (CBSE & Maharashtra)
const class12 = cbseClasses.find((c) => c.name === "Class 12");
const class12Subjects = getFallbackSubjects(cbseBoard.id, class12.id);
assert.ok(class12Subjects.length >= 1, "Class 12 CBSE has verified Mathematics");
const class12Math = class12Subjects.find((s) => s.name === "Mathematics");
const class12Chapters = getFallbackChapters(class12Math.id);
assert.ok(class12Chapters.some((c) => c.name === "Relations and Functions"), "Class 12 has Relations and Functions");
assert.ok(class12Chapters.some((c) => c.name === "Matrices"), "Class 12 has Matrices");
console.log(`[PASS] Class 12 CBSE Mathematics verified: ${class12Chapters.length} chapters`);

const mahaBoard = schoolBoards.find((b) => b.name === "Maharashtra State Board");
const mahaClass12 = getFallbackClasses(mahaBoard.id).find((c) => c.name === "Class 12");
const maha12Subjects = getFallbackSubjects(mahaBoard.id, mahaClass12.id);
assert.ok(maha12Subjects.length >= 1, "Class 12 Maharashtra has verified Mathematics");
const maha12Chapters = getFallbackChapters(maha12Subjects[0].id);
assert.ok(maha12Chapters.some((c) => c.name === "Mathematical Logic"), "Maharashtra 12 has Mathematical Logic");
console.log(`[PASS] Class 12 Maharashtra State Board verified: ${maha12Chapters.length} chapters`);

// -----------------------------------------------------------------------------
// 3. DIPLOMA / POLYTECHNIC EDUCATION TESTS (Years 1, 2, 3)
// -----------------------------------------------------------------------------
console.log("\n--- 3. Diploma Education & MSBTE Technical Board ---");

const diplomaBoards = getFallbackBoards("diploma");
console.log(`[PASS] Loaded ${diplomaBoards.length} diploma technical boards:`, diplomaBoards.map((b) => b.name).join(", "));
assert.ok(diplomaBoards.length >= 4, "Must support technical boards (MSBTE, SBTET, DTE Karnataka, BTEUP, etc.)");

const msbte = diplomaBoards.find((b) => b.name === "MSBTE");
assert.ok(msbte, "MSBTE technical board must exist");
assert.strictEqual(msbte.type, "diploma");
assert.strictEqual(msbte.hasCurriculumCoverage, true);

const msbteYears = getFallbackClasses(msbte.id);
console.log(`[PASS] MSBTE supports ${msbteYears.length} years:`, msbteYears.map((y) => y.name).join(", "));
assert.strictEqual(msbteYears.length, 3, "Must support Diploma Year 1, Year 2, Year 3");
assert.ok(msbteYears.some((y) => y.name === "Diploma Year 1"));
assert.ok(msbteYears.some((y) => y.name === "Diploma Year 2"));
assert.ok(msbteYears.some((y) => y.name === "Diploma Year 3"));

const diplomaMeta = getFallbackDiplomaMeta();
assert.ok(diplomaMeta.branches.includes("Computer Engineering"), "Computer Engineering branch exists");
assert.deepStrictEqual(diplomaMeta.semestersByYear["Diploma Year 1"], ["Semester 1", "Semester 2"]);
assert.deepStrictEqual(diplomaMeta.semestersByYear["Diploma Year 2"], ["Semester 3", "Semester 4"]);
assert.deepStrictEqual(diplomaMeta.semestersByYear["Diploma Year 3"], ["Semester 5", "Semester 6"]);
console.log("[PASS] Diploma branches and semesters by year correctly mapped");

// Year 1 Curriculum
const yr1 = msbteYears.find((y) => y.name === "Diploma Year 1");
const yr1Sem1Subjects = getFallbackSubjects(msbte.id, yr1.id, "Computer Engineering", "Semester 1");
assert.ok(yr1Sem1Subjects.length >= 1, "Year 1 Sem 1 has Basic Mathematics");
assert.ok(yr1Sem1Subjects[0].name.includes("Basic Mathematics"));
const yr1Sem1Chapters = getFallbackChapters(yr1Sem1Subjects[0].id);
assert.ok(yr1Sem1Chapters.some((c) => c.name === "Logarithms and Determinants"));
console.log(`[PASS] Diploma Year 1 Sem 1 verified: ${yr1Sem1Subjects[0].name}`);

const yr1Sem2Subjects = getFallbackSubjects(msbte.id, yr1.id, "Computer Engineering", "Semester 2");
assert.ok(yr1Sem2Subjects.length >= 1, "Year 1 Sem 2 has Programming in C");
assert.ok(yr1Sem2Subjects[0].name.includes("Programming in C"));
console.log(`[PASS] Diploma Year 1 Sem 2 verified: ${yr1Sem2Subjects[0].name}`);

// Year 2 Curriculum
const yr2 = msbteYears.find((y) => y.name === "Diploma Year 2");
const yr2Sem3Subjects = getFallbackSubjects(msbte.id, yr2.id, "Computer Engineering", "Semester 3");
assert.ok(yr2Sem3Subjects.length >= 1, "Year 2 Sem 3 has Data Structures");
assert.ok(yr2Sem3Subjects[0].name.includes("Data Structures"));
const yr2Sem4Subjects = getFallbackSubjects(msbte.id, yr2.id, "Computer Engineering", "Semester 4");
assert.ok(yr2Sem4Subjects.length >= 1, "Year 2 Sem 4 has Java Programming");
console.log(`[PASS] Diploma Year 2 verified: Sem 3 (${yr2Sem3Subjects[0].name}), Sem 4 (${yr2Sem4Subjects[0].name})`);

// Year 3 Curriculum
const yr3 = msbteYears.find((y) => y.name === "Diploma Year 3");
const yr3Sem5Subjects = getFallbackSubjects(msbte.id, yr3.id, "Computer Engineering", "Semester 5");
assert.ok(yr3Sem5Subjects.length >= 1, "Year 3 Sem 5 has Advanced Java");
const yr3Sem6Subjects = getFallbackSubjects(msbte.id, yr3.id, "Computer Engineering", "Semester 6");
assert.ok(yr3Sem6Subjects.length >= 1, "Year 3 Sem 6 has Network & Info Security");
console.log(`[PASS] Diploma Year 3 verified: Sem 5 (${yr3Sem5Subjects[0].name}), Sem 6 (${yr3Sem6Subjects[0].name})`);

// -----------------------------------------------------------------------------
// 4. DEPENDENT CASCADES & DOWNSTREAM FILTERING
// -----------------------------------------------------------------------------
console.log("\n--- 4. Dependent Cascades & Downstream Filtering ---");

// Filtering by semester strictly separates Sem 1 from Sem 2
const allYr1Subjects = getFallbackSubjects(msbte.id, yr1.id, "Computer Engineering");
assert.strictEqual(allYr1Subjects.length, 2, "Year 1 has 2 subjects across Sem 1 and Sem 2");
assert.notStrictEqual(yr1Sem1Subjects[0].id, yr1Sem2Subjects[0].id, "Sem 1 and Sem 2 subjects must differ");
console.log("[PASS] Branch and semester filters accurately isolate subjects");

// -----------------------------------------------------------------------------
// 5. VALIDATION & INVALID COMBINATIONS
// -----------------------------------------------------------------------------
console.log("\n--- 5. Combination Validation & Error Handling ---");

// Valid School Combination
const realNumbersChap = class10Chapters.find((c) => c.name === "Real Numbers");
const euclidTopic = getFallbackTopics(realNumbersChap.id).find((t) => t.name === "Euclid's Division Lemma");

const validSchoolPayload = {
  educationType: "school",
  boardId: cbseBoard.id,
  gradeId: class10.id,
  subjectId: class10Math.id,
  chapterId: realNumbersChap.id,
  topicId: euclidTopic.id,
};
const schoolValidation = validateCurriculumSelection(validSchoolPayload);
assert.strictEqual(schoolValidation.valid, true, "Valid school payload must pass validation");
assert.strictEqual(schoolValidation.selection.board.name, "CBSE");
console.log("[PASS] Valid school payload passed validation");

// Valid Diploma Combination
const dChap = yr1Sem1Chapters[0];
const dTopic = getFallbackTopics(dChap.id)[0];
const validDiplomaPayload = {
  educationType: "diploma",
  boardId: msbte.id,
  gradeId: yr1.id,
  branch: "Computer Engineering",
  semester: "Semester 1",
  subjectId: yr1Sem1Subjects[0].id,
  chapterId: dChap.id,
  topicId: dTopic.id,
};
const diplomaValidation = validateCurriculumSelection(validDiplomaPayload);
assert.strictEqual(diplomaValidation.valid, true, "Valid diploma payload must pass validation");
assert.strictEqual(diplomaValidation.selection.branch, "Computer Engineering");
assert.strictEqual(diplomaValidation.selection.semester, "Semester 1");
console.log("[PASS] Valid diploma payload passed validation");

// Invalid combination 1: CBSE with a diploma subject
const invalidCrossPayload = {
  ...validSchoolPayload,
  subjectId: yr1Sem1Subjects[0].id, // MSBTE subject
};
const crossValidation = validateCurriculumSelection(invalidCrossPayload);
assert.strictEqual(crossValidation.valid, false, "Cross-combination must fail validation");
console.log(`[PASS] Cross-board mismatch rejected: "${crossValidation.message}"`);

// Invalid combination 2: Diploma Year 1 with Semester 5
const invalidSemPayload = {
  ...validDiplomaPayload,
  semester: "Semester 5", // Invalid for Year 1
};
const semValidation = validateCurriculumSelection(invalidSemPayload);
assert.strictEqual(semValidation.valid, false, "Invalid semester for Year 1 must fail validation");
console.log(`[PASS] Invalid semester rejected: "${semValidation.message}"`);

// Invalid combination 3: Non-existent topic
const invalidTopicPayload = {
  ...validSchoolPayload,
  topicId: "non_existent_topic_999",
};
const topicValidation = validateCurriculumSelection(invalidTopicPayload);
assert.strictEqual(topicValidation.valid, false, "Non-existent topic must fail validation");
console.log(`[PASS] Non-existent topic rejected: "${topicValidation.message}"`);

// -----------------------------------------------------------------------------
// 6. UNCURATED BOARDS & EMPTY STATES
// -----------------------------------------------------------------------------
console.log("\n--- 6. Uncurated Boards & Empty States ---");

const karnatakaClasses = getFallbackClasses(karnatakaBoard.id);
assert.strictEqual(karnatakaClasses.length, 12, "Karnataka board returns school class structure");
const karnatakaSubjects = getFallbackSubjects(karnatakaBoard.id, karnatakaClasses[0].id);
assert.strictEqual(karnatakaSubjects.length, 0, "Uncurated board returns empty array without throwing");

const sbtetBoard = diplomaBoards.find((b) => b.name.includes("SBTET"));
assert.ok(sbtetBoard, "SBTET board exists");
assert.strictEqual(sbtetBoard.hasCurriculumCoverage, false, "SBTET has coverage false until verified");
const sbtetSubjects = getFallbackSubjects(sbtetBoard.id, msbteYears[0].id, "Computer Engineering", "Semester 1");
assert.strictEqual(sbtetSubjects.length, 0, "Uncurated technical board returns empty subjects gracefully");
console.log("[PASS] Uncurated boards and classes yield clean empty lists without crashing");

// -----------------------------------------------------------------------------
// 7. HTTP SERVER INTEGRATION TESTS
// -----------------------------------------------------------------------------
console.log("\n--- 7. HTTP API Integration & Selection Persistence ---");

const http = require("http");
const jwt = require("jsonwebtoken");

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
      if (typeof body === "object") {
        req.write(JSON.stringify(body));
      } else {
        req.write(body);
      }
    }
    req.end();
  });
}

(async () => {
  const testPort = 5098;
  process.env.PORT = String(testPort);
  process.env.JWT_SECRET = "test-jwt-secret-phase-3-curriculum";
  const app = require("./server");
  const server = app.listen(testPort);
  await new Promise((r) => server.once("listening", r));

  try {
    const studentToken = jwt.sign(
      { id: "test-student-p3", email: "student_p3@lucous.test", role: "STUDENT" },
      process.env.JWT_SECRET
    );
    const authHeaders = {
      Authorization: `Bearer ${studentToken}`,
      "Content-Type": "application/json",
    };

    // 1. GET /api/student/boards?type=school
    const schoolRes = await request(testPort, {
      path: "/api/student/boards?type=school",
      method: "GET",
      headers: authHeaders,
    });
    assert.strictEqual(schoolRes.status, 200);
    assert.strictEqual(schoolRes.body.success, true);
    assert.ok(schoolRes.body.boards.length >= 10, "HTTP returns school boards");
    console.log(`[PASS] GET /api/student/boards?type=school returns ${schoolRes.body.boards.length} boards`);

    // 2. GET /api/student/boards?type=diploma
    const dipRes = await request(testPort, {
      path: "/api/student/boards?type=diploma",
      method: "GET",
      headers: authHeaders,
    });
    assert.strictEqual(dipRes.status, 200);
    assert.ok(dipRes.body.boards.length >= 4, "HTTP returns diploma boards");
    console.log(`[PASS] GET /api/student/boards?type=diploma returns ${dipRes.body.boards.length} boards`);

    // 3. GET /api/student/diploma/meta
    const metaRes = await request(testPort, {
      path: "/api/student/diploma/meta",
      method: "GET",
      headers: authHeaders,
    });
    assert.strictEqual(metaRes.status, 200);
    assert.ok(metaRes.body.branches.includes("Computer Engineering"));
    assert.ok(metaRes.body.years.includes("Diploma Year 1"));
    console.log("[PASS] GET /api/student/diploma/meta returns verified branches & years");

    // 4. GET /api/student/classes for CBSE
    const cbseId = schoolRes.body.boards.find((b) => b.name === "CBSE").id;
    const classesRes = await request(testPort, {
      path: `/api/student/classes?boardId=${encodeURIComponent(cbseId)}&type=school`,
      method: "GET",
      headers: authHeaders,
    });
    assert.strictEqual(classesRes.status, 200);
    assert.strictEqual(classesRes.body.classes.length, 12, "Returns Class 1 through 12");
    console.log("[PASS] GET /api/student/classes for CBSE returns Class 1 through Class 12");

    // 5. GET /api/student/subjects for MSBTE Year 1 CompEng Sem 1
    const msbteId = dipRes.body.boards.find((b) => b.name === "MSBTE").id;
    const yr1Id = (await request(testPort, {
      path: `/api/student/classes?boardId=${encodeURIComponent(msbteId)}&type=diploma`,
      method: "GET",
      headers: authHeaders,
    })).body.classes.find((y) => y.name === "Diploma Year 1").id;

    const subjsRes = await request(testPort, {
      path: `/api/student/subjects?boardId=${encodeURIComponent(msbteId)}&gradeId=${encodeURIComponent(yr1Id)}&branch=${encodeURIComponent("Computer Engineering")}&semester=${encodeURIComponent("Semester 1")}`,
      method: "GET",
      headers: authHeaders,
    });
    assert.strictEqual(subjsRes.status, 200);
    assert.ok(subjsRes.body.subjects.length >= 1);
    assert.ok(subjsRes.body.subjects[0].name.includes("Basic Mathematics"));
    console.log(`[PASS] GET /api/student/subjects with branch & semester filters returns ${subjsRes.body.subjects[0].name}`);

    // 6. POST /api/student/learn/selection (Save valid selection)
    const validSaveRes = await request(
      testPort,
      {
        path: "/api/student/learn/selection",
        method: "POST",
        headers: authHeaders,
      },
      validDiplomaPayload
    );
    assert.strictEqual(validSaveRes.status, 200);
    assert.strictEqual(validSaveRes.body.success, true);
    assert.strictEqual(validSaveRes.body.selection.branch, "Computer Engineering");
    console.log("[PASS] POST /api/student/learn/selection successfully saves validated selection");

    // 7. GET /api/student/learn/selection (Restore saved selection)
    const getSaveRes = await request(testPort, {
      path: "/api/student/learn/selection",
      method: "GET",
      headers: authHeaders,
    });
    assert.strictEqual(getSaveRes.status, 200);
    assert.ok(getSaveRes.body.selection);
    assert.strictEqual(getSaveRes.body.selection.topic.name, dTopic.name);
    console.log(`[PASS] GET /api/student/learn/selection restores active curriculum: "${getSaveRes.body.selection.topic.name}"`);

    // 8. POST /api/student/learn/selection (Reject invalid combination)
    const invalidSaveRes = await request(
      testPort,
      {
        path: "/api/student/learn/selection",
        method: "POST",
        headers: authHeaders,
      },
      invalidCrossPayload
    );
    assert.strictEqual(invalidSaveRes.status, 400);
    assert.strictEqual(invalidSaveRes.body.success, false);
    console.log(`[PASS] POST /api/student/learn/selection strictly rejects invalid cross-board selection (400)`);

    console.log("\n======================================================================");
    console.log("  ALL PHASE 3 CURRICULUM, DROPDOWN & HTTP API TESTS PASSED!");
    console.log("======================================================================\n");
  } finally {
    server.close();
  }
})().catch((err) => {
  console.error("HTTP verification error:", err);
  process.exit(1);
});
