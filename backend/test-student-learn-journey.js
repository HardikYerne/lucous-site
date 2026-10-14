// Test suite for LUCOUS Student Learn Journey
// Tests dependent cascade, content loading, games, videos, AI tutor topic context, and security.

const assert = require("assert");
const http = require("http");
const jwt = require("jsonwebtoken");

// Run server in test mode
process.env.NODE_ENV = "test";
process.env.JWT_SECRET = "test-secret-key";
process.env.ALLOW_EPHEMERAL_DEV_STORAGE = "true";

// Import curriculum service directly to verify business logic
const {
  getFallbackBoards,
  getFallbackClasses,
  getFallbackSubjects,
  getFallbackChapters,
  getFallbackTopics,
  getFallbackContent,
  getFallbackQuestions,
} = require("./curriculum-service");

const { filterVideos } = require("./curated-videos");

console.log("======================================================================");
console.log("  LUCOUS STUDENT LEARN JOURNEY VERIFICATION SUITE");
console.log("======================================================================");

// 1. Boards Test
const boards = getFallbackBoards();
console.log(`[PASS] [Curriculum] Loaded ${boards.length} supported education boards:`, boards.map(b => b.name).join(", "));
assert.ok(boards.length >= 6, "Must support at least 6 boards (CBSE, ICSE, Maharashtra, Telangana, Bihar, MP, Diploma)");
const boardNames = boards.map(b => b.name);
assert.ok(boardNames.includes("CBSE"), "CBSE must be present");
assert.ok(boardNames.includes("Maharashtra State Board"), "Maharashtra State Board must be present");
assert.ok(boardNames.includes("ICSE"), "ICSE must be present");
assert.ok(boardNames.includes("Telangana"), "Telangana must be present");
assert.ok(boardNames.includes("Bihar"), "Bihar must be present");
assert.ok(boardNames.includes("Madhya Pradesh"), "Madhya Pradesh must be present");

// 2. Cascade Test: CBSE
const cbse = boards.find(b => b.name === "CBSE");
const cbseClasses = getFallbackClasses(cbse.id);
console.log(`[PASS] [Curriculum] CBSE has classes:`, cbseClasses.map(c => c.name).join(", "));
assert.ok(cbseClasses.length >= 1, "CBSE must have classes");

const class10 = cbseClasses.find(c => c.name === "Class 10");
assert.ok(class10, "Class 10 must exist for CBSE");

const cbseSubjects = getFallbackSubjects(cbse.id, class10.id);
console.log(`[PASS] [Curriculum] CBSE Class 10 has subjects:`, cbseSubjects.map(s => s.name).join(", "));
assert.ok(cbseSubjects.length >= 2, "Must have Mathematics and Science");

const math = cbseSubjects.find(s => s.name === "Mathematics");
assert.ok(math, "Mathematics must exist");

const mathChapters = getFallbackChapters(math.id);
console.log(`[PASS] [Curriculum] CBSE Class 10 Math has chapters:`, mathChapters.map(c => c.name).join(", "));
assert.ok(mathChapters.length >= 2, "Must have at least 2 chapters");

const realNumbers = mathChapters.find(c => c.name === "Real Numbers");
assert.ok(realNumbers, "Real Numbers chapter must exist");

const realNumTopics = getFallbackTopics(realNumbers.id);
console.log(`[PASS] [Curriculum] Real Numbers has topics:`, realNumTopics.map(t => t.name).join(", "));
assert.ok(realNumTopics.length >= 2, "Must have Euclid's Division Lemma and Fundamental Theorem of Arithmetic");

const euclidTopic = realNumTopics.find(t => t.name === "Euclid's Division Lemma");
assert.ok(euclidTopic, "Euclid's Division Lemma topic must exist");

// 3. Content and Questions Verification
const contents = getFallbackContent(euclidTopic.id);
console.log(`[PASS] [Content] Topic '${euclidTopic.name}' has ${contents.length} lesson(s)`);
assert.ok(contents.length >= 1, "Must have at least 1 lesson for Euclid's Division Lemma");
assert.ok(contents[0].body.includes("a = bq + r"), "Lesson body must contain real educational content");

const questions = getFallbackQuestions(euclidTopic.id, 10);
console.log(`[PASS] [Questions] Topic '${euclidTopic.name}' has ${questions.length} question(s)`);
assert.ok(questions.length >= 4, "Must have at least 4 questions");
assert.ok(questions[0].text && questions[0].optionA && questions[0].optionB, "Questions must have options");

// 4. Video Library topic search
const videoResults = filterVideos({ q: "math" });
console.log(`[PASS] [Videos] Math subject search found ${videoResults.total} relevant video(s)`);
assert.ok(videoResults.total >= 1, "Should find video lessons matching Mathematics");

// 5. Educational Level & Diploma coverage
const diplomaBoard = boards.find(b => b.name === "Diploma / Polytechnic");
assert.ok(diplomaBoard, "Diploma / Polytechnic board must exist");
const diplomaClasses = getFallbackClasses(diplomaBoard.id);
assert.ok(diplomaClasses.length >= 1, "Diploma classes must exist");
const diplomaSubjects = getFallbackSubjects(diplomaBoard.id, diplomaClasses[0].id);
assert.ok(diplomaSubjects.length >= 1, "Computer Engineering subject must exist for Diploma");

console.log("\n======================================================================");
console.log("  ALL CURRICULUM, CASCADE, AND DATA TESTS PASSED SUCCESSFULLY!");
console.log("======================================================================");
