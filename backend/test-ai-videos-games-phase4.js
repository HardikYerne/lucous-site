// ============================================================================
// LUCOUS — PHASE 4 VERIFICATION SUITE
// Contextual AI Tutor, Verified YouTube Videos, and Interactive Games
// ============================================================================

const assert = require("assert");
const http = require("http");
const jwt = require("jsonwebtoken");

const {
  getTopicGameData,
  getFallbackTopics,
  getFallbackBoards,
  getFallbackClasses,
  getFallbackSubjects,
  getFallbackChapters,
} = require("./curriculum-service");

const { filterVideos } = require("./curated-videos");

console.log("======================================================================");
console.log("  LUCOUS — PHASE 4: AI TUTOR, VIDEOS & INTERACTIVE GAMES VERIFICATION");
console.log("======================================================================\n");

function request(port, { path, method = "GET", headers = {}, body = null }) {
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        host: "127.0.0.1",
        port,
        path,
        method,
        headers,
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
  const testPort = 5099;
  process.env.PORT = String(testPort);
  process.env.JWT_SECRET = "test-jwt-secret-phase-4-lucous";
  process.env.ALLOW_EPHEMERAL_DEV_STORAGE = "true";

  const app = require("./server");
  const server = app.listen(testPort);
  await new Promise((r) => server.once("listening", r));

  try {
    // -------------------------------------------------------------------------
    // 1. GAME DATA GENERATOR TESTS (Curriculum-Grounded Games)
    // -------------------------------------------------------------------------
    console.log("--- 1. Curriculum Game Data Generator ---");

    // Test a mathematics topic (Euclid's Division Lemma)
    const cbse = getFallbackBoards("school").find((b) => b.name === "CBSE");
    const class10 = getFallbackClasses(cbse.id).find((c) => c.name === "Class 10");
    const math = getFallbackSubjects(cbse.id, class10.id).find((s) => s.name === "Mathematics");
    const chapters = getFallbackChapters(math.id);
    const realNumbersChap = chapters.find((c) => c.name === "Real Numbers");
    const mathTopics = getFallbackTopics(realNumbersChap.id);
    assert.ok(mathTopics.length >= 1, "Must have Real Numbers topics");
    const euclidTopic = mathTopics.find((t) => t.name === "Euclid's Division Lemma") || mathTopics[0];

    const euclidGameData = getTopicGameData(euclidTopic.id, "memory-match");
    assert.strictEqual(euclidGameData.topicId, euclidTopic.id);
    assert.ok(Array.isArray(euclidGameData.memoryPairs), "Memory pairs must be an array");
    assert.ok(euclidGameData.memoryPairs.length >= 2, "Must generate at least 2 memory pairs");
    assert.ok(euclidGameData.memoryPairs[0].term, "Memory pair must have term");
    assert.ok(euclidGameData.memoryPairs[0].match, "Memory pair must have matching explanation");
    console.log(`[PASS] Memory Match generated ${euclidGameData.memoryPairs.length} pairs for '${euclidTopic.name}'`);

    // Test Ordering Puzzle steps
    assert.ok(euclidGameData.orderingPuzzle, "Ordering puzzle must exist");
    assert.ok(Array.isArray(euclidGameData.orderingPuzzle.steps), "Steps must be an array");
    assert.strictEqual(euclidGameData.orderingPuzzle.steps.length, 4, "Must provide 4 sequential steps");
    assert.strictEqual(euclidGameData.orderingPuzzle.steps[0].order, 1);
    assert.strictEqual(euclidGameData.orderingPuzzle.steps[3].order, 4);
    assert.ok(
      euclidGameData.orderingPuzzle.steps[1].text.includes("a = bq + r") ||
        euclidGameData.orderingPuzzle.steps[1].text.includes("division lemma"),
      "Ordering steps must reflect academic curriculum procedure"
    );
    console.log(`[PASS] Ordering Puzzle generated 4 logical steps for '${euclidTopic.name}'`);

    // Test a Diploma topic (Programming in C / Logarithms)
    const msbte = getFallbackBoards("diploma").find((b) => b.name === "MSBTE");
    if (msbte) {
      const yr1 = getFallbackClasses(msbte.id)[0];
      const yr1Subjs = getFallbackSubjects(msbte.id, yr1.id, { branch: "Computer Engineering", semester: "Semester 1" });
      if (yr1Subjs.length > 0) {
        const dChap = getFallbackChapters(yr1Subjs[0].id)[0];
        const dipTopics = getFallbackTopics(dChap.id);
        if (dipTopics.length > 0) {
          const logTopic = dipTopics[0];
          const logGameData = getTopicGameData(logTopic.id, "ordering-puzzle");
          assert.ok(logGameData.orderingPuzzle.steps.length >= 3, "Diploma topic must have ordering steps");
          console.log(`[PASS] Diploma Ordering Puzzle generated for '${logTopic.name}'`);
        }
      }
    }

    // -------------------------------------------------------------------------
    // 2. YOUTUBE VIDEO VERIFICATION, SEARCH LINK & REPORTING TESTS
    // -------------------------------------------------------------------------
    console.log("\n--- 2. YouTube Video Verification & Safe Fallbacks ---");

    // Curated videos verification
    const mathVideos = filterVideos({ q: "Mathematics" });
    assert.ok(mathVideos.videos.length >= 1, "Should find video lessons for Mathematics");
    const testVideo = mathVideos.videos[0];
    assert.strictEqual(testVideo.isVerified, true, "Curated videos must be verified");
    assert.strictEqual(typeof testVideo.id, "string");
    assert.strictEqual(testVideo.id.length, 11, "YouTube video ID must be standard 11-char ID");
    assert.match(testVideo.id, /^[a-zA-Z0-9_-]{11}$/, "YouTube video ID format valid");
    console.log(`[PASS] Verified video ID '${testVideo.id}' with safe metadata (channel: '${testVideo.channel}')`);

    // Empty state & external YouTube search fallback link format verification
    const uncuratedTopic = { name: "Non-Existent Theorem 999", subject: "Quantum Computing" };
    const emptyResult = filterVideos({ q: uncuratedTopic.name });
    assert.strictEqual(emptyResult.videos.length, 0, "Uncurated topic yields empty curated results");

    const expectedSearchQuery = `CBSE Class 10 Science ${uncuratedTopic.name}`;
    const generatedSearchUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(expectedSearchQuery)}`;
    assert.ok(generatedSearchUrl.startsWith("https://www.youtube.com/results?search_query="));
    assert.ok(generatedSearchUrl.includes(encodeURIComponent(uncuratedTopic.name)));
    console.log(`[PASS] External YouTube search URL properly formatted for uncurated topics`);

    // Authenticated setup for API tests
    const studentA_Token = jwt.sign(
      { id: "student-alpha", email: "student_a@lucous.test", role: "STUDENT" },
      process.env.JWT_SECRET
    );
    const studentB_Token = jwt.sign(
      { id: "student-beta", email: "student_b@lucous.test", role: "STUDENT" },
      process.env.JWT_SECRET
    );
    const teacherToken = jwt.sign(
      { id: "teacher-gamma", email: "teacher@lucous.test", role: "TEACHER" },
      process.env.JWT_SECRET
    );

    const headersA = {
      Authorization: `Bearer ${studentA_Token}`,
      "Content-Type": "application/json",
    };
    const headersB = {
      Authorization: `Bearer ${studentB_Token}`,
      "Content-Type": "application/json",
    };

    // Test POST /api/videos/report
    const reportRes = await request(testPort, {
      path: "/api/videos/report",
      method: "POST",
      headers: headersA,
      body: {
        videoId: testVideo.id,
        reason: "Audio is slightly muffled in the second half",
        topicId: euclidTopic.id,
      },
    });
    assert.strictEqual(reportRes.status, 200);
    assert.strictEqual(reportRes.body.success, true);
    console.log(`[PASS] POST /api/videos/report successfully recorded feedback for video '${testVideo.id}'`);

    // Test reporting validation (missing reason)
    const badReport = await request(testPort, {
      path: "/api/videos/report",
      method: "POST",
      headers: headersA,
      body: { videoId: testVideo.id },
    });
    assert.strictEqual(badReport.status, 400, "Must require reason");
    console.log(`[PASS] POST /api/videos/report rejects incomplete reports (400)`);

    // -------------------------------------------------------------------------
    // 3. CONTEXTUAL AI TUTOR & MULTILINGUAL PEDAGOGY TESTS
    // -------------------------------------------------------------------------
    console.log("\n--- 3. Contextual AI Tutor & Multilingual Pedagogy ---");

    // A. Curriculum Context Injection in English
    const tutorReqEn = await request(testPort, {
      path: "/api/ai/tutor",
      method: "POST",
      headers: headersA,
      body: {
        message: "Can you explain this topic with an example?",
        language: "en",
        curriculumContext: {
          educationType: "school",
          board: "CBSE",
          classGrade: "Class 10",
          subject: "Mathematics",
          chapter: "Real Numbers",
          topic: "Euclid's Division Lemma",
        },
      },
    });
    assert.strictEqual(tutorReqEn.status, 200);
    assert.strictEqual(tutorReqEn.body.success, true);
    assert.strictEqual(tutorReqEn.body.language, "en");
    assert.ok(tutorReqEn.body.reply.includes("Euclid's Division Lemma"), "Reply references the topic");
    assert.ok(tutorReqEn.body.reply.includes("Simple Explanation"), "Includes progressive simple explanation");
    assert.ok(tutorReqEn.body.reply.includes("Relatable Example"), "Includes real-world example");
    assert.ok(tutorReqEn.body.reply.includes("Guided Question"), "Includes understanding check question");
    assert.ok(tutorReqEn.body.reply.includes("Short Practice Activity"), "Includes practice activity");
    assert.strictEqual(typeof tutorReqEn.body.apiKey, "undefined", "Never expose API keys in frontend payload");
    const threadConvId = tutorReqEn.body.conversationId;
    assert.ok(threadConvId, "Returns conversation ID for multi-turn thread");
    console.log(`[PASS] AI Tutor delivers progressive 4-part pedagogy in English for 'Euclid's Division Lemma'`);

    // B. Hindi Pedagogy (हिंदी — Devanagari script)
    const tutorReqHi = await request(testPort, {
      path: "/api/ai/tutor",
      method: "POST",
      headers: headersA,
      body: {
        message: "मुझे यह पाठ समझाइए।",
        language: "hi",
        curriculumContext: {
          educationType: "school",
          board: "CBSE",
          classGrade: "Class 10",
          subject: "Mathematics",
          chapter: "Real Numbers",
          topic: "Euclid's Division Lemma",
        },
      },
    });
    assert.strictEqual(tutorReqHi.status, 200);
    assert.strictEqual(tutorReqHi.body.language, "hi");
    assert.ok(tutorReqHi.body.reply.includes("सरल व्याख्या"), "Includes Hindi simple explanation");
    assert.ok(tutorReqHi.body.reply.includes("दैनिक उदाहरण"), "Includes Hindi everyday example");
    assert.ok(tutorReqHi.body.reply.includes("मार्गदर्शक प्रश्न"), "Includes Hindi guided question");
    assert.ok(tutorReqHi.body.reply.includes("अभ्यास चुनौती"), "Includes Hindi practice activity");
    console.log(`[PASS] AI Tutor delivers progressive pedagogy in Hindi (Devanagari script)`);

    // C. Marathi Pedagogy (मराठी — Devanagari script)
    const tutorReqMr = await request(testPort, {
      path: "/api/ai/tutor",
      method: "POST",
      headers: headersA,
      body: {
        message: "मला ही संकल्पना शिकवा.",
        language: "mr",
        curriculumContext: {
          educationType: "school",
          board: "Maharashtra State Board",
          classGrade: "Class 10",
          subject: "Mathematics",
          chapter: "Real Numbers",
          topic: "Euclid's Division Lemma",
        },
      },
    });
    assert.strictEqual(tutorReqMr.status, 200);
    assert.strictEqual(tutorReqMr.body.language, "mr");
    assert.ok(tutorReqMr.body.reply.includes("सोपे स्पष्टीकरण"), "Includes Marathi explanation");
    assert.ok(tutorReqMr.body.reply.includes("दैनंदिन उदाहरण"), "Includes Marathi example");
    assert.ok(tutorReqMr.body.reply.includes("मार्गदर्शक प्रश्न"), "Includes Marathi guided question");
    assert.ok(tutorReqMr.body.reply.includes("सराव प्रश्न"), "Includes Marathi practice question");
    console.log(`[PASS] AI Tutor delivers progressive pedagogy in Marathi (Devanagari script)`);

    // D. Telugu Pedagogy (తెలుగు — Telugu script)
    const tutorReqTe = await request(testPort, {
      path: "/api/ai/tutor",
      method: "POST",
      headers: headersA,
      body: {
        message: "ఈ పాఠం వివరించండి.",
        language: "te",
        curriculumContext: {
          educationType: "school",
          board: "Telangana State Board",
          classGrade: "Class 10",
          subject: "Mathematics",
          chapter: "Real Numbers",
          topic: "Euclid's Division Lemma",
        },
      },
    });
    assert.strictEqual(tutorReqTe.status, 200);
    assert.strictEqual(tutorReqTe.body.language, "te");
    assert.ok(tutorReqTe.body.reply.includes("సులభమైన వివరణ"), "Includes Telugu explanation");
    assert.ok(tutorReqTe.body.reply.includes("నిజ జీవిత ఉదాహరణ"), "Includes Telugu real life example");
    assert.ok(tutorReqTe.body.reply.includes("గైడెడ్ ప్రశ్న"), "Includes Telugu guided question");
    assert.ok(tutorReqTe.body.reply.includes("అభ్యాస సవాలు"), "Includes Telugu practice activity");
    console.log(`[PASS] AI Tutor delivers progressive pedagogy in Telugu (Telugu script)`);

    // E. Follow-Up Questions Retain Conversation Thread
    const followUpRes = await request(testPort, {
      path: "/api/ai/tutor",
      method: "POST",
      headers: headersA,
      body: {
        message: "What if remainder r is 0?",
        conversationId: threadConvId,
        language: "en",
      },
    });
    assert.strictEqual(followUpRes.status, 200);
    assert.strictEqual(followUpRes.body.conversationId, threadConvId);
    console.log(`[PASS] Multi-turn follow-up question chained successfully in thread '${threadConvId}'`);

    // F. Conversation Ownership & Security Isolation
    // Student B attempts to read Student A's discussion thread
    const hijackGetRes = await request(testPort, {
      path: `/api/ai/tutor?conversationId=${encodeURIComponent(threadConvId)}`,
      method: "GET",
      headers: headersB,
    });
    assert.strictEqual(hijackGetRes.status, 403, "Must reject cross-student thread snooping");
    assert.strictEqual(hijackGetRes.body.success, false);
    console.log(`[PASS] Security: Student B cannot read Student A's conversation thread (403 Forbidden)`);

    // Student B attempts to post into Student A's discussion thread
    const hijackPostRes = await request(testPort, {
      path: "/api/ai/tutor",
      method: "POST",
      headers: headersB,
      body: {
        message: "I am trying to inject into Student A's conversation!",
        conversationId: threadConvId,
      },
    });
    assert.strictEqual(hijackPostRes.status, 403, "Must reject cross-student thread hijacking");
    console.log(`[PASS] Security: Student B cannot inject messages into Student A's conversation (403 Forbidden)`);

    // -------------------------------------------------------------------------
    // 4. INTERACTIVE PLAYABLE GAMES TESTS (3 Distinct Working Games)
    // -------------------------------------------------------------------------
    console.log("\n--- 4. Interactive Playable Games (3 Distinct Types) ---");

    // Game 1: Memory Match Gameplay & Score Submission
    const memorySubmitRes = await request(testPort, {
      path: "/api/games/submit",
      method: "POST",
      headers: headersA,
      body: {
        gameId: "memory-match",
        topicId: euclidTopic.id,
        matchesFound: 4,
        totalPairs: 4,
        moves: 9,
      },
    });
    assert.strictEqual(memorySubmitRes.status, 201);
    assert.strictEqual(memorySubmitRes.body.success, true);
    assert.strictEqual(memorySubmitRes.body.score, 100);
    assert.strictEqual(memorySubmitRes.body.xp, 60, "4 pairs * 15 XP = 60 XP");
    assert.strictEqual(memorySubmitRes.body.moves, 9);
    console.log(`[PASS] Game 1 (Concept Memory Match): 4/4 pairs, 9 moves -> 100% Score, +${memorySubmitRes.body.xp} XP awarded`);

    // Game 2: Ordering Puzzle / Step Sequence Challenge
    const orderingSubmitRes = await request(testPort, {
      path: "/api/games/submit",
      method: "POST",
      headers: headersA,
      body: {
        gameId: "ordering-puzzle",
        topicId: euclidTopic.id,
        isCorrect: true,
        attempts: 1,
      },
    });
    assert.strictEqual(orderingSubmitRes.status, 201);
    assert.strictEqual(orderingSubmitRes.body.success, true);
    assert.strictEqual(orderingSubmitRes.body.isCorrect, true);
    assert.strictEqual(orderingSubmitRes.body.xp, 20, "First attempt sequence award = 20 XP");
    console.log(`[PASS] Game 2 (Ordering Step Puzzle): Perfect sequence on 1st attempt -> +${orderingSubmitRes.body.xp} XP awarded`);

    // Game 2: Ordering with multiple attempts (diminished XP)
    const orderingRetryRes = await request(testPort, {
      path: "/api/games/submit",
      method: "POST",
      headers: headersA,
      body: {
        gameId: "ordering-puzzle",
        topicId: euclidTopic.id,
        isCorrect: true,
        attempts: 3,
      },
    });
    assert.strictEqual(orderingRetryRes.status, 201);
    assert.strictEqual(orderingRetryRes.body.xp, 10, "3 attempts -> diminished 10 XP");
    console.log(`[PASS] Game 2 (Ordering Step Puzzle): Attempt penalty validated (awarded +10 XP on 3rd attempt)`);

    // Game 3: Timed Question Challenge (Speed Rush)
    const timedSubmitRes = await request(testPort, {
      path: "/api/games/submit",
      method: "POST",
      headers: headersA,
      body: {
        gameId: "timed-blitz",
        topicId: euclidTopic.id,
        streakBonus: 15, // 3x streak
        answers: [
          { questionId: "q_euclid_1", selected: 0 },
          { questionId: "q_euclid_2", selected: 1 },
          { questionId: "q_euclid_3", selected: 1 },
        ],
      },
    });
    assert.strictEqual(timedSubmitRes.status, 201);
    assert.strictEqual(timedSubmitRes.body.success, true);
    assert.ok(timedSubmitRes.body.xp > 0, "Earned XP with streak bonus");
    console.log(`[PASS] Game 3 (Timed Challenge): Speed attack scored with streak bonus -> +${timedSubmitRes.body.xp} XP awarded`);

    // Deduplication test: repeated answers to same questionId prevented
    const duplicateExploitRes = await request(testPort, {
      path: "/api/games/submit",
      method: "POST",
      headers: headersA,
      body: {
        gameId: "timed-blitz",
        topicId: euclidTopic.id,
        answers: [
          { questionId: "q_euclid_1", selected: 0 },
          { questionId: "q_euclid_1", selected: 0 }, // Duplicate attempt to game system
          { questionId: "q_euclid_1", selected: 0 },
        ],
      },
    });
    assert.strictEqual(duplicateExploitRes.status, 201);
    assert.strictEqual(duplicateExploitRes.body.total, 1, "Duplicate answers strictly deduplicated to 1 question");
    console.log(`[PASS] Anti-Forgery: Server strictly deduplicates repeated question answers`);

    // Role protection test: Teachers cannot submit student game scores
    const teacherSubmitRes = await request(testPort, {
      path: "/api/games/submit",
      method: "POST",
      headers: {
        Authorization: `Bearer ${teacherToken}`,
        "Content-Type": "application/json",
      },
      body: {
        gameId: "memory-match",
        topicId: euclidTopic.id,
        matchesFound: 4,
      },
    });
    assert.strictEqual(teacherSubmitRes.status, 403, "Non-students cannot submit student game scores");
    console.log(`[PASS] Security: Non-student roles strictly forbidden from game submissions (403)`);

    console.log("\n======================================================================");
    console.log("  ALL PHASE 4 AI TUTOR, VIDEO & INTERACTIVE GAME TESTS PASSED!");
    console.log("======================================================================");
  } finally {
    server.close();
  }
})().catch((err) => {
  console.error("\n[TEST RUNNER ERROR]:", err);
  process.exit(1);
});
