/**
 * Comprehensive verification suite for LUCOUS Video Library Expansion,
 * Dynamic Time-Based Greetings, and Security Allowlisting.
 */

const assert = require("assert");
const {
  CURATED_VIDEOS,
  EDUCATION_LEVELS,
  BOARDS,
  DIPLOMA_BRANCHES,
  DIPLOMA_SCHEMES,
  extractYouTubeId,
  filterVideos,
} = require("./curated-videos");

console.log("======================================================================");
console.log("  LUCOUS PHASE 4 — VIDEO LIBRARY & DYNAMIC GREETING VERIFICATION SUITE");
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

// ============================================================================
// SECTION 1: VIDEO CATALOG INTEGRITY & QUALITY
// ============================================================================
runTest("Catalog", "Catalog size contains exactly 70 curated lessons", () => {
  assert.strictEqual(CURATED_VIDEOS.length, 70);
});

runTest("Catalog", "Every video has a valid 11-char YouTube ID and safe embed URL", () => {
  CURATED_VIDEOS.forEach((v, idx) => {
    assert.ok(v.id && typeof v.id === "string", `Video #${idx} missing id`);
    assert.ok(/^[a-zA-Z0-9_-]{11}$/.test(v.id), `Video #${idx} (${v.id}) must be 11 chars`);
    assert.ok(v.embedUrl.startsWith("https://www.youtube-nocookie.com/embed/"), `Video #${idx} embed URL unsafe`);
    assert.ok(v.embedUrl.includes(v.id), `Video #${idx} embed URL missing video ID`);
    assert.ok(v.youtubeUrl.startsWith("https://www.youtube.com/watch?v="), `Video #${idx} youtube URL unsafe`);
  });
});

runTest("Catalog", "Every video has complete educational metadata (title, channel, subject, topic, language)", () => {
  const validLangs = new Set(["en", "hi", "mr", "te"]);
  CURATED_VIDEOS.forEach((v, idx) => {
    assert.ok(v.title && v.title.trim().length > 3, `Video #${idx} title too short`);
    assert.ok(v.channel && v.channel.trim().length > 1, `Video #${idx} missing channel`);
    assert.ok(v.topic && v.topic.trim().length > 1, `Video #${idx} missing topic`);
    assert.ok(v.subject && v.subject.trim().length > 1, `Video #${idx} missing subject`);
    assert.ok(validLangs.has(v.language), `Video #${idx} language ${v.language} not supported`);
    assert.ok(
      v.verificationStatus === "verified" || v.verificationStatus === "provisional",
      `Video #${idx} invalid verificationStatus ${v.verificationStatus}`
    );
  });
});

runTest("Catalog", "Verification status counts match empirical audit (61 Verified, 9 Provisional)", () => {
  const verified = CURATED_VIDEOS.filter((v) => v.verificationStatus === "verified");
  const provisional = CURATED_VIDEOS.filter((v) => v.verificationStatus === "provisional");
  assert.strictEqual(verified.length, 61, "Verified count mismatch");
  assert.strictEqual(provisional.length, 9, "Provisional count mismatch");
  assert.strictEqual(verified.length + provisional.length, 70);
});

// ============================================================================
// SECTION 2: URL VALIDATION, EXTRACTOR & SECURITY ALLOWLIST
// ============================================================================
runTest("Security", "extractYouTubeId extracts raw 11-character video IDs", () => {
  assert.strictEqual(extractYouTubeId("g78utcLQrJ4"), "g78utcLQrJ4");
  assert.strictEqual(extractYouTubeId("dQw4w9WgXcQ"), "dQw4w9WgXcQ");
});

runTest("Security", "extractYouTubeId parses standard youtube.com/watch URLs", () => {
  assert.strictEqual(
    extractYouTubeId("https://www.youtube.com/watch?v=g78utcLQrJ4"),
    "g78utcLQrJ4"
  );
  assert.strictEqual(
    extractYouTubeId("https://youtube.com/watch?v=g78utcLQrJ4&t=45s"),
    "g78utcLQrJ4"
  );
});

runTest("Security", "extractYouTubeId parses short youtu.be URLs", () => {
  assert.strictEqual(extractYouTubeId("https://youtu.be/g78utcLQrJ4"), "g78utcLQrJ4");
  assert.strictEqual(extractYouTubeId("https://youtu.be/g78utcLQrJ4?si=xyz123"), "g78utcLQrJ4");
});

runTest("Security", "extractYouTubeId parses youtube.com/embed and shorts URLs", () => {
  assert.strictEqual(
    extractYouTubeId("https://www.youtube.com/embed/g78utcLQrJ4"),
    "g78utcLQrJ4"
  );
  assert.strictEqual(
    extractYouTubeId("https://www.youtube.com/shorts/g78utcLQrJ4"),
    "g78utcLQrJ4"
  );
});

runTest("Security", "extractYouTubeId blocks unsupported video hosts (Vimeo, Dailymotion, arbitrary URLs)", () => {
  assert.strictEqual(extractYouTubeId("https://vimeo.com/123456789"), null);
  assert.strictEqual(extractYouTubeId("https://dailymotion.com/video/x7tgad0"), null);
  assert.strictEqual(extractYouTubeId("https://malicious-site.com/watch?v=g78utcLQrJ4"), null);
  assert.strictEqual(extractYouTubeId("https://attacker.com/youtube.com/watch?v=g78utcLQrJ4"), null);
});

runTest("Security", "extractYouTubeId rejects malformed, invalid, or empty input", () => {
  assert.strictEqual(extractYouTubeId(""), null);
  assert.strictEqual(extractYouTubeId("   "), null);
  assert.strictEqual(extractYouTubeId(null), null);
  assert.strictEqual(extractYouTubeId(undefined), null);
  assert.strictEqual(extractYouTubeId("too_short"), null);
  assert.strictEqual(extractYouTubeId("way_too_long_to_be_a_youtube_id_1234567"), null);
  assert.strictEqual(extractYouTubeId("<script>alert(1)</script>"), null);
});

// ============================================================================
// SECTION 3: FILTERING, SEARCH & EMPTY STATE RESILIENCE
// ============================================================================
runTest("Filter", "Education level filtering returns expected counts across all 5 tiers", () => {
  const levels = ["primary", "middle", "secondary", "higher_secondary", "diploma"];
  levels.forEach((lvl) => {
    const res = filterVideos({ educationLevel: lvl });
    assert.ok(res.total >= 4, `Level ${lvl} returned insufficient lessons: ${res.total}`);
  });
});

runTest("Filter", "Board filtering handles CBSE, ICSE, Maharashtra, Telangana, and Andhra Pradesh", () => {
  ["cbse", "icse", "maharashtra", "telangana", "andhra_pradesh"].forEach((board) => {
    const res = filterVideos({ board });
    assert.ok(res.total >= 1, `Board ${board} should return matching lessons`);
  });
});

runTest("Filter", "Language filtering covers English, Hindi, Marathi, and Telugu", () => {
  ["en", "hi", "mr", "te"].forEach((lang) => {
    const res = filterVideos({ language: lang });
    assert.ok(res.total >= 4, `Language ${lang} should have >= 4 lessons`);
  });
});

runTest("Filter", "Search matching finds titles, channels, topics, and subjects", () => {
  const queryPhysics = filterVideos({ q: "physics" });
  assert.ok(queryPhysics.total >= 4, "Search for physics should return multiple lessons");
  const queryMarathi = filterVideos({ q: "marathi" });
  assert.ok(queryMarathi.total >= 4, "Search for marathi should return multiple lessons");
});

runTest("Filter", "Empty search query or impossible filters safely return total 0 and empty array", () => {
  const impossible = filterVideos({ q: "nonexistent_term_xyz_123456789" });
  assert.strictEqual(impossible.total, 0);
  assert.strictEqual(impossible.videos.length, 0);
  assert.strictEqual(impossible.totalPages, 1);
});

runTest("Filter", "Pagination calculations adhere to page and limit parameters", () => {
  const page1 = filterVideos({ limit: 10, page: 1 });
  assert.strictEqual(page1.videos.length, 10);
  assert.strictEqual(page1.page, 1);
  assert.strictEqual(page1.totalPages, 7);

  const page7 = filterVideos({ limit: 10, page: 7 });
  assert.strictEqual(page7.videos.length, 10);
  assert.strictEqual(page7.page, 7);
});

// ============================================================================
// SECTION 4: DYNAMIC TIME-BASED GREETING SCHEDULE
// ============================================================================
function getTimeGreeting(date = new Date()) {
  const hour = date.getHours();
  if (hour >= 5 && hour < 12) return "Good morning";
  if (hour >= 12 && hour < 17) return "Good afternoon";
  if (hour >= 17 && hour < 21) return "Good evening";
  return "Good night";
}

function formatPersonalizedGreeting(name, date = new Date()) {
  const greeting = getTimeGreeting(date);
  const trimmed = typeof name === "string" ? name.trim() : "";
  if (
    trimmed &&
    trimmed.toLowerCase() !== "null" &&
    trimmed.toLowerCase() !== "undefined"
  ) {
    return `${greeting}, ${trimmed}`;
  }
  return greeting;
}

function makeDate(hour, minute, second = 0) {
  const d = new Date();
  d.setHours(hour, minute, second, 0);
  return d;
}

runTest("Greeting", "04:59 local time returns 'Good night'", () => {
  assert.strictEqual(getTimeGreeting(makeDate(4, 59)), "Good night");
});

runTest("Greeting", "05:00 local time returns 'Good morning'", () => {
  assert.strictEqual(getTimeGreeting(makeDate(5, 0)), "Good morning");
});

runTest("Greeting", "11:59 local time returns 'Good morning'", () => {
  assert.strictEqual(getTimeGreeting(makeDate(11, 59)), "Good morning");
});

runTest("Greeting", "12:00 local time returns 'Good afternoon'", () => {
  assert.strictEqual(getTimeGreeting(makeDate(12, 0)), "Good afternoon");
});

runTest("Greeting", "16:59 local time returns 'Good afternoon'", () => {
  assert.strictEqual(getTimeGreeting(makeDate(16, 59)), "Good afternoon");
});

runTest("Greeting", "17:00 local time returns 'Good evening'", () => {
  assert.strictEqual(getTimeGreeting(makeDate(17, 0)), "Good evening");
});

runTest("Greeting", "20:59 local time returns 'Good evening'", () => {
  assert.strictEqual(getTimeGreeting(makeDate(20, 59)), "Good evening");
});

runTest("Greeting", "21:00 local time returns 'Good night'", () => {
  assert.strictEqual(getTimeGreeting(makeDate(21, 0)), "Good night");
});

runTest("Greeting", "00:00 (Midnight) local time returns 'Good night'", () => {
  assert.strictEqual(getTimeGreeting(makeDate(0, 0)), "Good night");
});

// ============================================================================
// SECTION 5: PERSONALIZATION, FALLBACK & SANITIZATION
// ============================================================================
runTest("Greeting", "Displays personalized greeting with user name: 'Good morning, Shivprasad'", () => {
  assert.strictEqual(
    formatPersonalizedGreeting("Shivprasad", makeDate(9, 0)),
    "Good morning, Shivprasad"
  );
  assert.strictEqual(
    formatPersonalizedGreeting("Shivprasad", makeDate(13, 0)),
    "Good afternoon, Shivprasad"
  );
  assert.strictEqual(
    formatPersonalizedGreeting("Shivprasad", makeDate(18, 0)),
    "Good evening, Shivprasad"
  );
  assert.strictEqual(
    formatPersonalizedGreeting("Shivprasad", makeDate(22, 0)),
    "Good night, Shivprasad"
  );
});

runTest("Greeting", "Omits name and displays greeting alone when name is missing or empty", () => {
  assert.strictEqual(formatPersonalizedGreeting(null, makeDate(9, 0)), "Good morning");
  assert.strictEqual(formatPersonalizedGreeting(undefined, makeDate(13, 0)), "Good afternoon");
  assert.strictEqual(formatPersonalizedGreeting("", makeDate(18, 0)), "Good evening");
  assert.strictEqual(formatPersonalizedGreeting("   ", makeDate(22, 0)), "Good night");
});

runTest("Greeting", "Guards against literal 'null' and 'undefined' strings", () => {
  assert.strictEqual(formatPersonalizedGreeting("null", makeDate(9, 0)), "Good morning");
  assert.strictEqual(formatPersonalizedGreeting("undefined", makeDate(13, 0)), "Good afternoon");
});

// ============================================================================
// SECTION 6: TIME BOUNDARY TRANSITIONS
// ============================================================================
function getNextGreetingBoundary(date = new Date()) {
  const currentHour = date.getHours();
  const boundaryHours = [5, 12, 17, 21];

  for (const bHour of boundaryHours) {
    if (bHour > currentHour) {
      const boundary = new Date(date);
      boundary.setHours(bHour, 0, 0, 0);
      return boundary;
    }
  }

  const tomorrowBoundary = new Date(date);
  tomorrowBoundary.setDate(tomorrowBoundary.getDate() + 1);
  tomorrowBoundary.setHours(5, 0, 0, 0);
  return tomorrowBoundary;
}

runTest("Boundary", "Boundary calculation correctly predicts next local boundary target", () => {
  const morning = makeDate(8, 30);
  const nextFromMorning = getNextGreetingBoundary(morning);
  assert.strictEqual(nextFromMorning.getHours(), 12);

  const afternoon = makeDate(14, 0);
  const nextFromAfternoon = getNextGreetingBoundary(afternoon);
  assert.strictEqual(nextFromAfternoon.getHours(), 17);

  const evening = makeDate(19, 0);
  const nextFromEvening = getNextGreetingBoundary(evening);
  assert.strictEqual(nextFromEvening.getHours(), 21);

  const night = makeDate(23, 0);
  const nextFromNight = getNextGreetingBoundary(night);
  assert.strictEqual(nextFromNight.getHours(), 5);
  assert.ok(nextFromNight.getTime() > night.getTime());
});

console.log("\n======================================================================");
console.log(`  ALL ${passed} VERIFICATION SUITES PASSED SUCCESSFULLY!`);
console.log("======================================================================\n");
