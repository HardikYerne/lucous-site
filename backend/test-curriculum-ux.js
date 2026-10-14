const assert = require("assert");
const { filterVideos, CURATED_VIDEOS, EDUCATION_LEVELS, BOARDS } = require("../backend/curated-videos");

console.log("=== COMPREHENSIVE STUDENT UX & FILTER VERIFICATION ===");

// 1. Check all education levels have videos
EDUCATION_LEVELS.forEach(lvl => {
  const res = filterVideos({ educationLevel: lvl.id });
  console.log(`Education Level [${lvl.id}]: ${res.total} videos found`);
  assert.ok(res.total >= 4, `Level ${lvl.id} must have >= 4 videos`);
});

// 2. Check Classes 1 to 12
for (let c = 1; c <= 12; c++) {
  const res = filterVideos({ classGrade: String(c) });
  assert.ok(res.total >= 1, `Class ${c} must have at least 1 lesson`);
}
console.log("Classes 1 to 12: All covered with at least 1 lesson!");

// 3. Check Diploma Branches
const branches = ["computer", "it", "mechanical", "electrical", "electronics", "civil"];
branches.forEach(b => {
  const res = filterVideos({ educationLevel: "diploma", branch: b });
  console.log(`Diploma Branch [${b}]: ${res.total} videos`);
  assert.ok(res.total >= 1, `Branch ${b} must have at least 1 lesson`);
});

// 4. Check Language coverage
["en", "hi", "mr", "te"].forEach(l => {
  const res = filterVideos({ language: l });
  console.log(`Language [${l}]: ${res.total} videos`);
  assert.ok(res.total >= 4, `Language ${l} must have >= 4 videos`);
});

// 5. Verification status filter
const verifiedOnly = filterVideos({ verificationStatus: "verified" });
const provisionalOnly = filterVideos({ verificationStatus: "provisional" });
console.log(`Verified Filter: ${verifiedOnly.total} videos`);
console.log(`Provisional Filter: ${provisionalOnly.total} videos`);
assert.strictEqual(verifiedOnly.total, 61);
assert.strictEqual(provisionalOnly.total, 9);
assert.strictEqual(verifiedOnly.total + provisionalOnly.total, 70);

// 6. Search functionality
const searchTests = ["physics", "fractions", "python", "water", "marathi", "telugu"];
searchTests.forEach(term => {
  const res = filterVideos({ q: term });
  console.log(`Search for "${term}": ${res.total} matches`);
  assert.ok(res.total >= 1, `Search for ${term} should return results`);
});

console.log("\nALL 6 VERIFICATION TEST SUITES PASSED FLAWLESSLY!");
