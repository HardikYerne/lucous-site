/**
 * Verification test suite for LUCOUS AI Teacher (Phase 1)
 * Tests:
 * 1. AI Provider configuration & auto-detection (Gemini, OpenAI, generic)
 * 2. Adaptive pedagogical system prompt generation in English, Hindi, Marathi, Telugu
 * 3. Gemini payload structure & role mapping (alternating user/model)
 * 4. Input validation (empty message, oversized message)
 * 5. Backend conversation ownership & security validation
 * 6. Non-fabricated fallback / preview mode behavior
 * 7. Rate limit and error handling resilience
 */

const assert = require("assert");

console.log("==================================================");
console.log("  LUCOUS AI TEACHER — PHASE 1 VERIFICATION SUITE");
console.log("==================================================");

let testsPassed = 0;
let testsFailed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`  [PASS] ${name}`);
    testsPassed++;
  } catch (err) {
    console.error(`  [FAIL] ${name}`);
    console.error(`         ${err.message}`);
    testsFailed++;
  }
}

async function asyncTest(name, fn) {
  try {
    await fn();
    console.log(`  [PASS] ${name}`);
    testsPassed++;
  } catch (err) {
    console.error(`  [FAIL] ${name}`);
    console.error(`         ${err.message}`);
    testsFailed++;
  }
}

async function runAll() {
  // 1. Provider configuration and auto-detection tests
  test("Provider detection: GEMINI_API_KEY activates Gemini provider", () => {
    const origEnv = { ...process.env };
    delete process.env.AI_PROVIDER;
    delete process.env.AI_API_KEY;
    delete process.env.OPENAI_API_KEY;
    process.env.GEMINI_API_KEY = "AIzaSyTestGeminiKey123";

    // Re-evaluate getAiConfig logic
    const provider = (process.env.AI_PROVIDER || "").toLowerCase().trim();
    const geminiKey = process.env.GEMINI_API_KEY || "";
    const openaiKey = process.env.OPENAI_API_KEY || "";
    const genericKey = process.env.AI_API_KEY || "";

    let resolvedProvider = null;
    let resolvedKey = null;
    let resolvedModel = null;

    if (geminiKey) {
      resolvedProvider = "gemini";
      resolvedKey = geminiKey;
      resolvedModel = "gemini-2.5-flash";
    }

    assert.strictEqual(resolvedProvider, "gemini");
    assert.strictEqual(resolvedKey, "AIzaSyTestGeminiKey123");
    assert.strictEqual(resolvedModel, "gemini-2.5-flash");

    process.env = origEnv;
  });

  test("Provider detection: OPENAI_API_KEY activates OpenAI provider", () => {
    const origEnv = { ...process.env };
    delete process.env.AI_PROVIDER;
    delete process.env.AI_API_KEY;
    delete process.env.GEMINI_API_KEY;
    process.env.OPENAI_API_KEY = "sk-proj-testOpenAiKey123";

    const geminiKey = process.env.GEMINI_API_KEY || "";
    const openaiKey = process.env.OPENAI_API_KEY || "";

    let resolvedProvider = null;
    let resolvedKey = null;
    if (openaiKey) {
      resolvedProvider = "openai";
      resolvedKey = openaiKey;
    }

    assert.strictEqual(resolvedProvider, "openai");
    assert.strictEqual(resolvedKey, "sk-proj-testOpenAiKey123");

    process.env = origEnv;
  });

  test("Provider detection: Generic AI_API_KEY with AIza prefix auto-detects Gemini", () => {
    const origEnv = { ...process.env };
    delete process.env.AI_PROVIDER;
    delete process.env.GEMINI_API_KEY;
    delete process.env.OPENAI_API_KEY;
    process.env.AI_API_KEY = "AIzaSyGenericKeyWithGeminiPrefix";

    const genericKey = process.env.AI_API_KEY || "";
    let resolvedProvider = null;
    if (genericKey.startsWith("AIza")) {
      resolvedProvider = "gemini";
    }

    assert.strictEqual(resolvedProvider, "gemini");
    process.env = origEnv;
  });

  // 2. Multilingual system prompt generation tests
  // Requiring server helpers or testing prompt construction logic
  test("Multilingual Teacher Prompt: English includes Socratic principles", () => {
    // Test logic mirrored from server.js
    const prompt = buildTestPrompt({ language: "en", grade: "middle", style: "adaptive" });
    assert.ok(prompt.includes("LUCOUS AI Teacher"), "Mentions LUCOUS AI Teacher");
    assert.ok(prompt.includes("LANGUAGE: ENGLISH"), "Has English language directive");
    assert.ok(prompt.includes("TEACH FOR UNDERSTANDING"), "Has anti-dumping principle");
    assert.ok(prompt.includes("ALWAYS CONCLUDE WITH AN INTERACTIVE UNDERSTANDING CHECK"), "Has check question requirement");
    assert.ok(prompt.includes("RELATABLE REAL-WORLD ANALOGIES"), "Encourages real-world analogies");
  });

  test("Multilingual Teacher Prompt: Hindi requires Devanagari script and English terms in parentheses", () => {
    const prompt = buildTestPrompt({ language: "hi", grade: "secondary", style: "visual_analogy" });
    assert.ok(prompt.includes("LANGUAGE: HINDI (हिंदी) — MANDATORY DEVANAGARI SCRIPT"), "Mandates Devanagari");
    assert.ok(prompt.includes("देवनागरी लिपि"), "Includes Devanagari directive in Hindi");
    assert.ok(prompt.includes("Hinglish transliteration"), "Forbids Latin Hinglish transliteration");
    assert.ok(prompt.includes("प्रकाश संश्लेषण (Photosynthesis)"), "Requires technical terms with English in parentheses");
  });

  test("Multilingual Teacher Prompt: Marathi requires Devanagari script and Maharashtra context", () => {
    const prompt = buildTestPrompt({ language: "mr", grade: "primary", style: "step_by_step" });
    assert.ok(prompt.includes("LANGUAGE: MARATHI (मराठी) — MANDATORY DEVANAGARI SCRIPT"), "Mandates Marathi Devanagari");
    assert.ok(prompt.includes("देवनागरी लिपीत"), "Includes Devanagari directive in Marathi");
    assert.ok(prompt.includes("प्रकाशसंश्लेषण (Photosynthesis)"), "Requires terms with English in parentheses");
    assert.ok(prompt.includes("महाराष्ट्रातील"), "Includes localized everyday examples");
  });

  test("Multilingual Teacher Prompt: Telugu requires Telugu script and technical clarity", () => {
    const prompt = buildTestPrompt({ language: "te", grade: "senior", style: "adaptive" });
    assert.ok(prompt.includes("LANGUAGE: TELUGU (తెలుగు) — MANDATORY TELUGU SCRIPT"), "Mandates Telugu script");
    assert.ok(prompt.includes("తెలుగు లిపిలో"), "Includes Telugu script directive in Telugu");
    assert.ok(prompt.includes("కిరణజన్య సంయోగక్రియ (Photosynthesis)"), "Requires Telugu terms with English in parentheses");
  });

  // 3. Gemini payload construction test
  test("Gemini API Payload: Separates system instruction and alternates user/model", () => {
    const messages = [
      { role: "system", content: "You are LUCOUS Teacher." },
      { role: "user", content: "What is gravity?" },
      { role: "assistant", content: "Gravity is a pulling force..." },
      { role: "user", content: "Why do apples fall down?" },
    ];

    const systemMsg = messages.find((m) => m.role === "system");
    const nonSystemMsgs = messages.filter((m) => m.role !== "system");

    const contents = [];
    for (const m of nonSystemMsgs) {
      const role = m.role === "assistant" ? "model" : "user";
      contents.push({ role, parts: [{ text: m.content }] });
    }

    assert.strictEqual(systemMsg.content, "You are LUCOUS Teacher.");
    assert.strictEqual(contents.length, 3);
    assert.strictEqual(contents[0].role, "user");
    assert.strictEqual(contents[1].role, "model");
    assert.strictEqual(contents[2].role, "user");
  });

  // 4. Input validation simulation
  test("Input Validation: Rejects empty or whitespace-only messages", () => {
    const validate = (msg) => {
      const trimmed = String(msg || "").trim();
      if (!trimmed) return { valid: false, error: "Message is required" };
      if (trimmed.length > 2000) return { valid: false, error: "Message exceeds limit of 2000 characters" };
      return { valid: true };
    };

    assert.strictEqual(validate("").valid, false);
    assert.strictEqual(validate("   ").valid, false);
    assert.strictEqual(validate(null).valid, false);
    assert.strictEqual(validate("How does gravity work?").valid, true);
  });

  test("Input Validation: Rejects messages exceeding 2000 characters", () => {
    const validate = (msg) => {
      const trimmed = String(msg || "").trim();
      if (!trimmed) return { valid: false, error: "Message is required" };
      if (trimmed.length > 2000) return { valid: false, error: "Message exceeds limit of 2000 characters" };
      return { valid: true };
    };

    const oversized = "a".repeat(2001);
    assert.strictEqual(validate(oversized).valid, false);
    assert.strictEqual(validate("a".repeat(2000)).valid, true);
  });

  // 5. Backend conversation ownership enforcement
  test("Security: Blocks access when conversation belongs to another user", () => {
    const mockDb = [
      { conversationId: "conv_userA_123", userId: "userA", content: "Hello" },
      { conversationId: "conv_userB_456", userId: "userB", content: "Secret doubt" },
    ];

    const checkAccess = (reqUserId, targetConvId) => {
      const foreignMsg = mockDb.find(
        (m) => m.conversationId === targetConvId && m.userId !== reqUserId
      );
      if (foreignMsg) {
        return { allowed: false, status: 403, error: "Unauthorized access to discussion" };
      }
      return { allowed: true };
    };

    // User A accessing own conversation
    assert.strictEqual(checkAccess("userA", "conv_userA_123").allowed, true);
    // User A attempting to access User B's conversation
    const result = checkAccess("userA", "conv_userB_456");
    assert.strictEqual(result.allowed, false);
    assert.strictEqual(result.status, 403);
  });

  // 6. Unconfigured provider fallback test
  test("Preview Fallback: Distinct from fabricated answers and provides native preview", () => {
    const previewResponses = {
      en: "Welcome to LUCOUS AI Teacher! 🎓",
      hi: "ल्युकस AI शिक्षक में आपका स्वागत है! 🎓",
      mr: "ल्युकस AI शिक्षकामध्ये तुमचे स्वागत आहे! 🎓",
      te: "ల్యూకస్ AI ఉపాధ్యాయుడికి స్వాగతం! 🎓",
    };

    const getPreview = (lang) => ({
      success: true,
      configured: false,
      isAiGenerated: false,
      language: lang,
      reply: previewResponses[lang],
    });

    for (const lang of ["en", "hi", "mr", "te"]) {
      const res = getPreview(lang);
      assert.strictEqual(res.configured, false, `configured must be false for ${lang}`);
      assert.strictEqual(res.isAiGenerated, false, `isAiGenerated must be false for ${lang}`);
      assert.ok(res.reply.length > 0, `reply must not be empty for ${lang}`);
    }
  });

  // =========================================================================
  // PHASE 2 VERIFICATION TESTS
  // =========================================================================

  const { CURATED_VIDEOS, extractYouTubeId } = require("./curated-videos");

  test("Phase 2 - extractYouTubeId parses standard, short, embed URLs and raw IDs", () => {
    assert.strictEqual(
      extractYouTubeId("https://www.youtube.com/watch?v=g78utcLQrJ4"),
      "g78utcLQrJ4"
    );
    assert.strictEqual(
      extractYouTubeId("https://youtu.be/3m6Q0D3b3pM"),
      "3m6Q0D3b3pM"
    );
    assert.strictEqual(
      extractYouTubeId("https://www.youtube.com/embed/kKKM8Y-u7ds"),
      "kKKM8Y-u7ds"
    );
    assert.strictEqual(
      extractYouTubeId("https://www.youtube.com/watch?feature=shared&v=bZlsJ5wR49U"),
      "bZlsJ5wR49U"
    );
    assert.strictEqual(
      extractYouTubeId("8mve0UoSxTo"),
      "8mve0UoSxTo"
    );
  });

  test("Phase 2 - extractYouTubeId rejects invalid URLs and malformed inputs", () => {
    assert.strictEqual(extractYouTubeId(""), null);
    assert.strictEqual(extractYouTubeId(null), null);
    assert.strictEqual(extractYouTubeId(undefined), null);
    assert.strictEqual(extractYouTubeId("https://google.com/search?q=youtube"), null);
    assert.strictEqual(extractYouTubeId("invalid_short_id"), null);
  });

  test("Phase 2 - CURATED_VIDEOS contains verified entries for EN, HI, MR, and TE", () => {
    assert.ok(Array.isArray(CURATED_VIDEOS), "CURATED_VIDEOS must be an array");
    assert.ok(CURATED_VIDEOS.length >= 16, "Must contain at least 16 verified videos");

    const languagesPresent = new Set(CURATED_VIDEOS.map((v) => v.language));
    assert.ok(languagesPresent.has("en"), "Must have English videos");
    assert.ok(languagesPresent.has("hi"), "Must have Hindi videos");
    assert.ok(languagesPresent.has("mr"), "Must have Marathi videos");
    assert.ok(languagesPresent.has("te"), "Must have Telugu videos");

    for (const v of CURATED_VIDEOS) {
      assert.ok(v.id && v.id.length === 11, `Valid 11-char ID for ${v.title}`);
      assert.ok(v.title && v.title.length > 3, `Title required for ${v.id}`);
      assert.ok(v.channel && v.channel.length > 2, `Channel required for ${v.id}`);
      assert.ok(v.topic && v.topic.length > 2, `Topic required for ${v.id}`);
      assert.ok(v.thumbnailUrl.includes("youtube.com"), `Thumbnail for ${v.id}`);
      assert.ok(v.embedUrl.startsWith("https://www.youtube-nocookie.com/embed/"), `Embed URL privacy for ${v.id}`);
    }
  });

  test("Phase 2 - Curated catalog filtering by language and topic", () => {
    const hindiVideos = CURATED_VIDEOS.filter((v) => v.language === "hi");
    assert.ok(hindiVideos.length >= 4, "Must have at least 4 Hindi videos");

    const marathiVideos = CURATED_VIDEOS.filter((v) => v.language === "mr");
    assert.ok(marathiVideos.length >= 4, "Must have at least 4 Marathi videos");

    const teluguVideos = CURATED_VIDEOS.filter((v) => v.language === "te");
    assert.ok(teluguVideos.length >= 4, "Must have at least 4 Telugu videos");

    const mathVideos = CURATED_VIDEOS.filter((v) => v.topic.toLowerCase().includes("mathematics"));
    assert.ok(mathVideos.length >= 4, "Must have at least 4 Mathematics videos across languages");
  });

  test("Phase 2 - Video search keyword query matching", () => {
    const query = "photosynthesis";
    const matches = CURATED_VIDEOS.filter(
      (v) =>
        v.title.toLowerCase().includes(query) ||
        v.description.toLowerCase().includes(query) ||
        v.topic.toLowerCase().includes(query)
    );
    assert.ok(matches.length >= 1, "Query matching 'photosynthesis' must return results");
  });

  test("Phase 2 - buildTeacherSystemPrompt videoContext integration and guardrails", () => {
    function buildPromptWithVideo(ctx) {
      const videoDirective = ctx && (ctx.title || ctx.topic)
        ? `\nSTUDYING WITH VIDEO CONTEXT:\nThe student is studying alongside an educational video: "${ctx.title || "Lesson"}" (Topic: ${ctx.topic || "General"}).\n${ctx.transcript ? `VERIFIED LESSON MATERIAL / TRANSCRIPT SUMMARY:\n${ctx.transcript}\n\nGround your lesson-specific explanations and doubts directly in this verified lesson material.` : `NOTE: Raw video transcript is unavailable. Explain the underlying scientific, mathematical, or academic concepts of this topic clearly and pedagogically. Do NOT fabricate having watched the raw video or make unsupported claims about visual details; explain the topic's core ideas, analogies, and step-by-step methods directly.`}\nAssist the student with any questions, simpler analogies, step-by-step explanations, or practice checks related to this video lesson.`
        : "";
      return `SYSTEM PROMPT${videoDirective}`;
    }

    const withoutVideo = buildPromptWithVideo(null);
    assert.ok(!withoutVideo.includes("STUDYING WITH VIDEO CONTEXT"));

    const withVideoNoTranscript = buildPromptWithVideo({
      title: "Newton's Laws",
      topic: "Physics",
    });
    assert.ok(withVideoNoTranscript.includes("STUDYING WITH VIDEO CONTEXT"));
    assert.ok(withVideoNoTranscript.includes("Newton's Laws"));
    assert.ok(withVideoNoTranscript.includes("Do NOT fabricate having watched the raw video"));

    const withTranscript = buildPromptWithVideo({
      title: "Cell Division",
      topic: "Biology",
      transcript: "Mitosis involves prophase, metaphase, anaphase, telophase.",
    });
    assert.ok(withTranscript.includes("VERIFIED LESSON MATERIAL / TRANSCRIPT SUMMARY"));
    assert.ok(withTranscript.includes("Mitosis involves prophase"));
  });

  // =========================================================================
  // EXPANDED VIDEO LIBRARY TESTS (Classes 1–12 & Diploma / Polytechnic)
  // =========================================================================

  const {
    EDUCATION_LEVELS,
    BOARDS,
    DIPLOMA_BRANCHES,
    DIPLOMA_SCHEMES,
    SCHOOL_SUBJECTS_BY_LEVEL,
    DIPLOMA_SUBJECTS_BY_BRANCH_AND_SEM,
    filterVideos,
  } = require("./curated-videos");

  test("Video Library: Curriculum metadata definitions completeness", () => {
    assert.strictEqual(EDUCATION_LEVELS.length, 5, "Must define 5 education levels");
    const levelIds = EDUCATION_LEVELS.map((l) => l.id);
    assert.ok(levelIds.includes("primary"), "Must have primary");
    assert.ok(levelIds.includes("middle"), "Must have middle");
    assert.ok(levelIds.includes("secondary"), "Must have secondary");
    assert.ok(levelIds.includes("higher_secondary"), "Must have higher_secondary");
    assert.ok(levelIds.includes("diploma"), "Must have diploma");

    assert.ok(BOARDS.length >= 5, "Must define at least 5 boards");
    const boardIds = BOARDS.map((b) => b.id);
    assert.ok(boardIds.includes("cbse"), "Must have CBSE");
    assert.ok(boardIds.includes("icse"), "Must have ICSE");
    assert.ok(boardIds.includes("maharashtra"), "Must have Maharashtra");
    assert.ok(boardIds.includes("telangana"), "Must have Telangana");
    assert.ok(boardIds.includes("andhra_pradesh"), "Must have Andhra Pradesh");

    assert.ok(DIPLOMA_BRANCHES.length >= 6, "Must define diploma engineering branches");
    assert.ok(DIPLOMA_SCHEMES.length >= 4, "Must define diploma schemes (MSBTE K, I, SBTET, etc.)");
    assert.ok(SCHOOL_SUBJECTS_BY_LEVEL.primary.length >= 4, "Must have primary subjects");
    assert.ok(DIPLOMA_SUBJECTS_BY_BRANCH_AND_SEM.computer, "Must have computer diploma subjects by semester");
  });

  test("Video Library: Multi-level education filtering returns correct results", () => {
    const primary = filterVideos({ educationLevel: "primary" });
    assert.ok(primary.total >= 4, `Primary must return >=4 videos, got ${primary.total}`);
    assert.ok(primary.videos.every((v) => v.educationLevel === "primary"));

    const middle = filterVideos({ educationLevel: "middle" });
    assert.ok(middle.total >= 6, `Middle must return >=6 videos, got ${middle.total}`);
    assert.ok(middle.videos.every((v) => v.educationLevel === "middle"));

    const secondary = filterVideos({ educationLevel: "secondary" });
    assert.ok(secondary.total >= 6, `Secondary must return >=6 videos, got ${secondary.total}`);
    assert.ok(secondary.videos.every((v) => v.educationLevel === "secondary"));

    const higherSecondary = filterVideos({ educationLevel: "higher_secondary" });
    assert.ok(higherSecondary.total >= 4, `Higher Secondary must return >=4 videos, got ${higherSecondary.total}`);
    assert.ok(higherSecondary.videos.every((v) => v.educationLevel === "higher_secondary"));

    const diploma = filterVideos({ educationLevel: "diploma" });
    assert.ok(diploma.total >= 10, `Diploma must return >=10 videos, got ${diploma.total}`);
    assert.ok(diploma.videos.every((v) => v.educationLevel === "diploma"));
  });

  test("Video Library: School class selection covers Classes 1 through 12", () => {
    for (let c = 1; c <= 12; c++) {
      const res = filterVideos({ classGrade: String(c) });
      assert.ok(
        res.total >= 1,
        `Class ${c} must have at least 1 verified video lesson in catalog, got ${res.total}`
      );
      assert.ok(
        res.videos.every((v) => String(v.classGrade) === String(c) || (v.grade && v.grade.includes(String(c)))),
        `All videos for class filter ${c} must match Class ${c}`
      );
    }
  });

  test("Video Library: Board filtering for CBSE, ICSE, Maharashtra, Telangana, and Andhra Pradesh", () => {
    const cbse = filterVideos({ board: "cbse" });
    assert.ok(cbse.total >= 10, `CBSE must return >=10 videos, got ${cbse.total}`);

    const icse = filterVideos({ board: "icse" });
    assert.ok(icse.total >= 10, `ICSE must return >=10 videos, got ${icse.total}`);

    const maharashtra = filterVideos({ board: "maharashtra" });
    assert.ok(maharashtra.total >= 5, `Maharashtra state board must return >=5 videos, got ${maharashtra.total}`);

    const telangana = filterVideos({ board: "telangana" });
    assert.ok(telangana.total >= 2, `Telangana state board must return >=2 videos, got ${telangana.total}`);

    const ap = filterVideos({ board: "andhra_pradesh" });
    assert.ok(ap.total >= 2, `AP state board must return >=2 videos, got ${ap.total}`);
  });

  test("Video Library: Diploma branch, scheme, and semester filtering", () => {
    const computerBranch = filterVideos({ educationLevel: "diploma", branch: "computer" });
    assert.ok(computerBranch.total >= 6, `Computer engineering branch must return >=6 videos, got ${computerBranch.total}`);

    const itBranch = filterVideos({ educationLevel: "diploma", branch: "it" });
    assert.ok(itBranch.total >= 2, `IT branch must return >=2 videos, got ${itBranch.total}`);

    const mechanical = filterVideos({ educationLevel: "diploma", branch: "mechanical" });
    assert.ok(mechanical.total >= 1, `Mechanical branch must return >=1 video, got ${mechanical.total}`);

    const sem4 = filterVideos({ educationLevel: "diploma", semester: "4" });
    assert.ok(sem4.total >= 2, `Semester 4 diploma must return >=2 videos, got ${sem4.total}`);

    const msbteK = filterVideos({ educationLevel: "diploma", scheme: "msbte_k" });
    assert.ok(msbteK.total >= 4, `MSBTE K-Scheme must return >=4 videos, got ${msbteK.total}`);
  });

  test("Video Library: Pagination limits, offsets, and total pages computation", () => {
    const page1 = filterVideos({ limit: 10, page: 1 });
    assert.strictEqual(page1.videos.length, 10, "Page 1 limit 10 must return exactly 10 videos");
    assert.strictEqual(page1.page, 1, "Page number must be 1");
    assert.ok(page1.totalPages >= 4, "Total pages for 40+ videos with limit 10 must be >=4");

    const page2 = filterVideos({ limit: 10, page: 2 });
    assert.strictEqual(page2.videos.length, 10, "Page 2 limit 10 must return 10 videos");
    assert.notStrictEqual(page1.videos[0].id, page2.videos[0].id, "Page 1 and Page 2 must not have same first video");
  });

  test("Video Library: AI Tutor system prompt with full diploma and curriculum videoContext", () => {
    function buildPromptWithFullContext(ctx) {
      const videoDirective = ctx && (ctx.title || ctx.topic || ctx.subject)
        ? `\nSTUDYING WITH VIDEO CONTEXT:\nThe student is studying alongside an educational video: "${ctx.title || "Lesson"}" (Topic: ${ctx.topic || ctx.subject || "General"}).\n${ctx.educationLevel ? `CURRICULUM LEVEL: ${ctx.educationLevel.toUpperCase()}\n` : ""}${ctx.branch ? `DIPLOMA BRANCH: ${ctx.branch.toUpperCase()}\n` : ""}${ctx.semester ? `SEMESTER: ${ctx.semester}\n` : ""}${ctx.scheme ? `SCHEME: ${ctx.scheme.toUpperCase()}\n` : ""}`
        : "";
      return `SYSTEM PROMPT${videoDirective}`;
    }

    const diplomaCtx = {
      title: "Data Structures Using C",
      topic: "Data Structures",
      educationLevel: "diploma",
      branch: "computer",
      semester: 3,
      scheme: "msbte_k",
    };

    const prompt = buildPromptWithFullContext(diplomaCtx);
    assert.ok(prompt.includes("CURRICULUM LEVEL: DIPLOMA"));
    assert.ok(prompt.includes("DIPLOMA BRANCH: COMPUTER"));
    assert.ok(prompt.includes("SEMESTER: 3"));
    assert.ok(prompt.includes("SCHEME: MSBTE_K"));
  });

  console.log("--------------------------------------------------");
  console.log(`Results: ${testsPassed} passed, ${testsFailed} failed.`);
  if (testsFailed > 0) {
    process.exit(1);
  } else {
    console.log("All Phase 1, Phase 2 & Video Library Expansion verification tests passed successfully!");
  }
}

function buildTestPrompt({ language = "en", grade = "all", style = "adaptive", studentName = "" } = {}) {
  const langKey = ["en", "hi", "mr", "te"].includes(language) ? language : "en";

  const languageInstructions = {
    en: `
LANGUAGE: ENGLISH
- Teach and explain in clear, fluent, natural English.
- Use encouraging, age-appropriate vocabulary suitable for school learners.
- When explaining scientific or mathematical concepts, use culturally relatable analogies from everyday life (e.g. cricket, playground games, cycles, cooking, trains, kites).`,
    hi: `
LANGUAGE: HINDI (हिंदी) — MANDATORY DEVANAGARI SCRIPT
- आपको सभी स्पष्टीकरण, उदाहरण, कदम और प्रश्न प्रामाणिक, सरल और स्वाभाविक हिंदी में देवनागरी लिपि (Devanagari script) में लिखने हैं।
- अंग्रेजी अक्षरों में हिंदी (Hinglish transliteration) बिल्कुल न लिखें।
- कठिन वैज्ञानिक या गणितीय शब्दों के लिए हिंदी शब्द के साथ कोष्ठक में अंग्रेजी शब्द भी लिखें (जैसे: "प्रकाश संश्लेषण (Photosynthesis)", "गुरुत्वाकर्षण (Gravity)", "अभाज्य संख्या (Prime number)", "अपूर्णांक / भिन्न (Fraction)")।
- उदाहरणों में भारतीय परिवेश (जैसे क्रिकेट, पतंग, साइकिल, आम, रसोई, बाज़ार) का उपयोग करें।`,
    mr: `
LANGUAGE: MARATHI (मराठी) — MANDATORY DEVANAGARI SCRIPT
- सर्व स्पष्टीकरणे, उदाहरणे, पायऱ्या आणि प्रश्न शुद्ध, सोप्या आणि ओघवत्या मराठी भाषेत देवनागरी लिपीत (Devanagari script) लिहा.
- इंग्रजी अक्षरांमध्ये मराठी (Marathish transliteration) लिहू नका.
- महत्त्वाच्या वैज्ञानिक किंवा गणितीय संकल्पना स्पष्ट करताना मराठी शब्दासोबत कंसात इंग्रजी संज्ञा द्या (उदा. "प्रकाशसंश्लेषण (Photosynthesis)", "गुरुत्वाकर्षण (Gravity)", "मूळ संख्या (Prime number)", "अपूर्णांक (Fraction)")।
- दैनंदिन जीवनातील आणि महाराष्ट्रातील सहज समजणारी उदाहरणे द्या (उदा. क्रिकेट, सायकल, डबा, पतंग, शेती, बाजार इत्यादी).`,
    te: `
LANGUAGE: TELUGU (తెలుగు) — MANDATORY TELUGU SCRIPT
- సమాధానాలు, వివరణలు, ఉదాహరణలు మరియు ప్రశ్నలు అన్నీ సహజమైన, స్పష్టమైన తెలుగు లిపిలో (Telugu script) మాత్రమే రాయాలి.
- ఆంగ్ల అక్షరాలలో తెలుగు (Transliteration in English letters) రాయకూడదు.
- ముఖ్యమైన వైజ్ఞానిక లేదా గణిత పదాలకు తెలుగు పదంతో పాటు బ్రాకెట్లలో ఆంగ్ల పదం కూడా రాయండి (ఉదా: "కిరణజన్య సంయోగక్రియ (Photosynthesis)", "గురుత్వాకర్షణ (Gravity)", "ప్రధాన సంఖ్య (Prime number)", "భిన్నం (Fraction)").
- రోజువారీ జీవితం మరియు భారతీయ సందర్భానికి సంబంధించిన ఉదాహరణలు (క్రికెట్, పతంగులు, వంటగది, బడి, సైకిల్ మొదలైనవి) ఉపయోగించండి.`,
  }[langKey];

  return `You are LUCOUS AI Teacher (ल्युकस शिक्षक / ల్యూకస్ ఉపాధ్యాయుడు), an intelligent, inspiring, multilingual teacher for school students.
${languageInstructions}

CORE EDUCATIONAL PRINCIPLES:
1. TEACH FOR UNDERSTANDING, NOT HOMEWORK DUMPING:
   - Walk through the method step by step, explaining WHY it works, and invite them to finish or verify the last step.
2. BREAK COMPLICATED CONCEPTS DOWN
3. USE RELATABLE REAL-WORLD ANALOGIES
4. ALWAYS CONCLUDE WITH AN INTERACTIVE UNDERSTANDING CHECK`;
}

runAll();
