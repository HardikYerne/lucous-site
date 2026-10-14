// ============================================================================
// LUCOUS — PHASE 5 VERIFICATION SUITE
// Student Progress, Smart Assessment, Weak-Topic Intelligence & Retests
// ============================================================================

const assert = require("assert");
const http = require("http");
const jwt = require("jsonwebtoken");

const {
  getFallbackTopics,
  getFallbackQuestions,
} = require("./curriculum-service");

console.log("======================================================================");
console.log("  LUCOUS — PHASE 5: STUDENT PROGRESS & ASSESSMENT VERIFICATION");
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
  const testPort = 5097;
  process.env.PORT = String(testPort);
  process.env.JWT_SECRET = "lucous-phase5-verification-secret";

  const app = require("./server");
  const server = app.listen(testPort);
  await new Promise((r) => server.once("listening", r));

  const JWT_SECRET = process.env.JWT_SECRET;

  // Student Alpha (primary learner)
  const studentAlphaToken = jwt.sign(
    { userId: "student-alpha", role: "STUDENT", email: "alpha@lucous.com" },
    JWT_SECRET
  );

  // Student Beta (cross-student isolation tests)
  const studentBetaToken = jwt.sign(
    { userId: "student-beta", role: "STUDENT", email: "beta@lucous.com" },
    JWT_SECRET
  );

  // Teacher token (role protection tests)
  const teacherToken = jwt.sign(
    { userId: "teacher-gamma", role: "TEACHER", email: "gamma@lucous.com" },
    JWT_SECRET
  );

  const authHeadersAlpha = {
    Authorization: `Bearer ${studentAlphaToken}`,
    "Content-Type": "application/json",
  };

  const authHeadersBeta = {
    Authorization: `Bearer ${studentBetaToken}`,
    "Content-Type": "application/json",
  };

  const authHeadersTeacher = {
    Authorization: `Bearer ${teacherToken}`,
    "Content-Type": "application/json",
  };

  try {
    // ------------------------------------------------------------------------
    // 1. PRACTICE & TEST SCORING (Server-side Grading)
    // ------------------------------------------------------------------------
    console.log("--- 1. Practice & Test Server-Side Grading ---");

    const euclidTopicId = "top_1"; // Euclid's Division Lemma
    const euclidQuestions = getFallbackQuestions(euclidTopicId, 4);
    assert(euclidQuestions.length >= 2, "Expected at least 2 questions for top_1");

    // All correct answers payload
    const allCorrectPayload = {
      topicId: euclidTopicId,
      mode: "TEST",
      answers: euclidQuestions.map((q) => ({
        questionId: q.id,
        selected: q.correct,
      })),
    };

    const resTest1 = await request(testPort, {
      path: "/api/student/attempts",
      method: "POST",
      headers: authHeadersAlpha,
      body: allCorrectPayload,
    });

    assert.strictEqual(resTest1.status, 201, "Expected 201 Created for valid test attempt");
    assert.strictEqual(resTest1.body.success, true);
    assert.strictEqual(resTest1.body.attempt.score, 100, "Expected 100% score for all correct");
    assert.strictEqual(resTest1.body.attempt.correct, euclidQuestions.length);
    assert.strictEqual(resTest1.body.attempt.total, euclidQuestions.length);
    assert(resTest1.body.xp > 0, "XP should be awarded for passing test attempt");
    assert(resTest1.body.totalXp >= resTest1.body.xp, "Total XP should reflect attempt reward");
    console.log(`[PASS] Server-side grading awarded 100% score and +${resTest1.body.xp} XP (Total: ${resTest1.body.totalXp} XP)`);

    // Validation checks
    const resBadMode = await request(testPort, {
      path: "/api/student/attempts",
      method: "POST",
      headers: authHeadersAlpha,
      body: { topicId: euclidTopicId, mode: "INVALID_MODE", answers: [{ questionId: "q_1", selected: 0 }] },
    });
    assert.strictEqual(resBadMode.status, 400, "Invalid mode must be rejected with 400");
    console.log("[PASS] Rejected invalid attempt mode with 400 Bad Request");

    const resEmptyAnswers = await request(testPort, {
      path: "/api/student/attempts",
      method: "POST",
      headers: authHeadersAlpha,
      body: { topicId: euclidTopicId, mode: "TEST", answers: [] },
    });
    assert.strictEqual(resEmptyAnswers.status, 400, "Empty answers must be rejected with 400");
    console.log("[PASS] Rejected empty answers payload with 400 Bad Request");

    // ------------------------------------------------------------------------
    // 2. ANSWER DEDUPLICATION & ANTI-REPLAY XP PROTECTION
    // ------------------------------------------------------------------------
    console.log("\n--- 2. Answer Deduplication & Anti-Replay XP Protection ---");

    // Answer replay attack payload: duplicate questionId in single attempt
    const replayPayload = {
      topicId: euclidTopicId,
      mode: "PRACTICE",
      answers: [
        { questionId: euclidQuestions[0].id, selected: euclidQuestions[0].correct },
        { questionId: euclidQuestions[0].id, selected: euclidQuestions[0].correct }, // Duplicate!
        { questionId: euclidQuestions[1].id, selected: euclidQuestions[1].correct },
      ],
    };

    const resDedup = await request(testPort, {
      path: "/api/student/attempts",
      method: "POST",
      headers: authHeadersAlpha,
      body: replayPayload,
    });
    assert.strictEqual(resDedup.status, 201);
    assert.strictEqual(resDedup.body.attempt.total, 2, "Server must deduplicate answers to 2 questions");
    console.log("[PASS] Server strictly deduplicated repeated question answers within attempt payload");

    // Rapid replay attack: submitting identical attempt within 30 seconds
    const resRapidReplay = await request(testPort, {
      path: "/api/student/attempts",
      method: "POST",
      headers: authHeadersAlpha,
      body: replayPayload,
    });
    assert.strictEqual(resRapidReplay.status, 201);
    assert.strictEqual(resRapidReplay.body.isDuplicate, true, "Rapid duplicate submission should be flagged");
    assert.strictEqual(resRapidReplay.body.xp, 0, "Duplicate submission must award 0 additional XP");
    console.log("[PASS] Rapid duplicate attempt detected and blocked from awarding duplicate XP");

    // ------------------------------------------------------------------------
    // 3. WEAK TOPICS (< 60% THRESHOLD & EXACTLY 60% BOUNDARY)
    // ------------------------------------------------------------------------
    console.log("\n--- 3. Weak Topics & Threshold Boundary Verification ---");

    const weakTopicId = "top_2"; // Fundamental Theorem of Arithmetic
    const weakQuestions = getFallbackQuestions(weakTopicId, 4);

    // Alpha scores 25% on top_2 (1 correct, 3 wrong) -> Weak topic (< 60%)
    const weakPayload = {
      topicId: weakTopicId,
      mode: "TEST",
      answers: [
        { questionId: weakQuestions[0].id, selected: weakQuestions[0].correct },
        { questionId: weakQuestions[1].id, selected: (weakQuestions[1].correct + 1) % 4 }, // wrong
        { questionId: weakQuestions[2].id, selected: (weakQuestions[2].correct + 1) % 4 }, // wrong
        { questionId: weakQuestions[3].id, selected: (weakQuestions[3].correct + 1) % 4 }, // wrong
      ],
    };

    const resWeakAttempt = await request(testPort, {
      path: "/api/student/attempts",
      method: "POST",
      headers: authHeadersAlpha,
      body: weakPayload,
    });
    assert.strictEqual(resWeakAttempt.status, 201);
    assert.strictEqual(resWeakAttempt.body.attempt.score, 25, "Expected 25% score");

    // Query weak topics
    const resWeakList = await request(testPort, {
      path: "/api/student/weak-topics",
      method: "GET",
      headers: authHeadersAlpha,
    });
    assert.strictEqual(resWeakList.status, 200);
    const weakItem = resWeakList.body.weakTopics.find((w) => w.topicId === weakTopicId);
    assert(weakItem, "Topic with 25% score MUST be in weakTopics list");
    assert.strictEqual(weakItem.score, 25);
    assert.strictEqual(weakItem.action, "Practice");
    console.log(`[PASS] Topic '${weakItem.topicName}' with 25% score correctly classified as weak (<60%)`);

    // BOUNDARY TEST: Exactly 60% score
    // 3 out of 5 correct = exactly 60.0% -> Must NOT be classified as weak
    const boundaryTopicId = "top_19";
    const boundaryQuestions = getFallbackQuestions(boundaryTopicId, 5);
    const boundaryPayload = {
      topicId: boundaryTopicId,
      mode: "TEST",
      answers: [
        { questionId: boundaryQuestions[0].id, selected: boundaryQuestions[0].correct },
        { questionId: boundaryQuestions[1].id, selected: boundaryQuestions[1].correct },
        { questionId: boundaryQuestions[2].id, selected: boundaryQuestions[2].correct },
        { questionId: boundaryQuestions[3].id, selected: (boundaryQuestions[3].correct + 1) % 4 },
        { questionId: boundaryQuestions[4].id, selected: (boundaryQuestions[4].correct + 1) % 4 },
      ],
    };

    const resBoundaryAttempt = await request(testPort, {
      path: "/api/student/attempts",
      method: "POST",
      headers: authHeadersAlpha,
      body: boundaryPayload,
    });
    assert.strictEqual(resBoundaryAttempt.status, 201);
    assert.strictEqual(resBoundaryAttempt.body.attempt.score, 60, "Expected exactly 60% score");

    const resWeakList2 = await request(testPort, {
      path: "/api/student/weak-topics",
      method: "GET",
      headers: authHeadersAlpha,
    });
    const boundaryItem = resWeakList2.body.weakTopics.find((w) => w.topicId === boundaryTopicId);
    assert.strictEqual(boundaryItem, undefined, "Score of exactly 60% must NOT be classified as weak");
    console.log("[PASS] Boundary verification: Exactly 60% score successfully passes threshold and is NOT weak");

    // ------------------------------------------------------------------------
    // 4. RETEST INTELLIGENCE & IMPROVEMENT DELTA CALCULATION
    // ------------------------------------------------------------------------
    console.log("\n--- 4. Retest Intelligence & Improvement Delta Calculation ---");

    // Student Alpha takes RETEST on top_2 and scores 100% (was 25%)
    const retestPayload = {
      topicId: weakTopicId,
      mode: "RETEST",
      answers: weakQuestions.map((q) => ({
        questionId: q.id,
        selected: q.correct,
      })),
    };

    const resRetest = await request(testPort, {
      path: "/api/student/attempts",
      method: "POST",
      headers: authHeadersAlpha,
      body: retestPayload,
    });
    assert.strictEqual(resRetest.status, 201);
    assert.strictEqual(resRetest.body.attempt.score, 100);
    assert.strictEqual(resRetest.body.attempt.mode, "RETEST");

    // Query weak topics after retest
    const resWeakListAfterRetest = await request(testPort, {
      path: "/api/student/weak-topics",
      method: "GET",
      headers: authHeadersAlpha,
    });
    assert.strictEqual(resWeakListAfterRetest.status, 200);

    // Topic should now be cleared from active weakTopics
    const activeWeakAfter = resWeakListAfterRetest.body.weakTopics.find((w) => w.topicId === weakTopicId);
    assert.strictEqual(activeWeakAfter, undefined, "Topic must be removed from weakTopics once score reaches >= 60%");

    // Topic should appear in resolvedWeakTopics with improvement delta
    const resolvedItem = resWeakListAfterRetest.body.resolvedWeakTopics.find((r) => r.topicId === weakTopicId);
    assert(resolvedItem, "Topic should appear in resolvedWeakTopics after improving above 60%");
    assert.strictEqual(resolvedItem.initialScore, 25);
    assert.strictEqual(resolvedItem.latestScore, 100);
    assert.strictEqual(resolvedItem.improvement, 75, "Expected +75% improvement (100 - 25)");
    console.log(`[PASS] Retest resolved weak topic '${resolvedItem.topicName}': Initial 25% -> Latest 100% (+${resolvedItem.improvement}% improvement)`);

    // ------------------------------------------------------------------------
    // 5. ATTEMPT HISTORY & RESULTS ENDPOINT
    // ------------------------------------------------------------------------
    console.log("\n--- 5. Attempt History Retrieval (/api/student/results) ---");

    const resResults = await request(testPort, {
      path: "/api/student/results",
      method: "GET",
      headers: authHeadersAlpha,
    });
    assert.strictEqual(resResults.status, 200);
    assert(Array.isArray(resResults.body.attempts), "Expected array of attempts");
    assert(resResults.body.attempts.length >= 4, "Expected at least 4 recorded attempts");

    // Verify chronological order (newest first)
    for (let i = 0; i < resResults.body.attempts.length - 1; i++) {
      const cur = new Date(resResults.body.attempts[i].createdAt).getTime();
      const nxt = new Date(resResults.body.attempts[i + 1].createdAt).getTime();
      assert(cur >= nxt, "Attempts must be sorted by createdAt descending");
    }
    console.log(`[PASS] Loaded ${resResults.body.attempts.length} attempts in reverse chronological order with topic & chapter metadata`);

    // ------------------------------------------------------------------------
    // 6. STUDENT PROGRESS ENGINE (/api/student/progress)
    // ------------------------------------------------------------------------
    console.log("\n--- 6. Comprehensive Student Progress Metrics ---");

    // Save lesson content completion
    const resSaveProgress = await request(testPort, {
      path: "/api/student/progress",
      method: "POST",
      headers: authHeadersAlpha,
      body: { contentId: "cnt_1" },
    });
    assert.strictEqual(resSaveProgress.status, 200);

    // Retrieve progress
    const resProgress = await request(testPort, {
      path: "/api/student/progress",
      method: "GET",
      headers: authHeadersAlpha,
    });
    assert.strictEqual(resProgress.status, 200);
    assert(resProgress.body.completedCount >= 1, "Completed lessons count should be at least 1");
    assert(resProgress.body.totalAttempts >= 4, "Total attempts should be at least 4");
    assert(typeof resProgress.body.averageScore === "number");
    assert(resProgress.body.masteredTopicsCount >= 2, "Mastered topics count should be at least 2");
    assert.strictEqual(resProgress.body.weakTopicsCount, 0, "No active weak topics should remain");
    console.log(`[PASS] Progress metrics: ${resProgress.body.completedCount} lessons completed, ${resProgress.body.totalAttempts} tests, avg score ${resProgress.body.averageScore}%, ${resProgress.body.masteredTopicsCount} mastered topics`);

    // ------------------------------------------------------------------------
    // 7. SECURITY & CROSS-STUDENT ISOLATION (Negative Tests)
    // ------------------------------------------------------------------------
    console.log("\n--- 7. Security, Role Guards & Cross-Student Isolation ---");

    // Student Beta has made 0 attempts; verify they see 0 of Student Alpha's attempts
    const resBetaResults = await request(testPort, {
      path: "/api/student/results",
      method: "GET",
      headers: authHeadersBeta,
    });
    assert.strictEqual(resBetaResults.status, 200);
    assert.strictEqual(resBetaResults.body.attempts.length, 0, "Student Beta must have 0 attempts (complete student isolation)");
    console.log("[PASS] Cross-student isolation: Student Beta cannot access Student Alpha's attempt history");

    // Teacher cannot submit student attempts
    const resTeacherAttempt = await request(testPort, {
      path: "/api/student/attempts",
      method: "POST",
      headers: authHeadersTeacher,
      body: allCorrectPayload,
    });
    assert.strictEqual(resTeacherAttempt.status, 403, "Teacher role must be forbidden from student attempts endpoint (403)");
    console.log("[PASS] Security: Non-student role (TEACHER) strictly rejected with 403 Forbidden");

    // Unauthenticated request
    const resUnauth = await request(testPort, {
      path: "/api/student/progress",
      method: "GET",
    });
    assert.strictEqual(resUnauth.status, 401, "Unauthenticated request must be rejected with 401 Unauthorized");
    console.log("[PASS] Security: Unauthenticated progress request strictly rejected with 401 Unauthorized");

    console.log("\n======================================================================");
    console.log("  ALL PHASE 5 STUDENT PROGRESS & ASSESSMENT TESTS PASSED!");
    console.log("======================================================================\n");
    process.exit(0);
  } catch (err) {
    console.error("\n[TEST FAILURE]", err);
    process.exit(1);
  }
})();
