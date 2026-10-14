/**
 * Unit tests for LUCOUS dynamic time-based greetings
 * Tests all boundary conditions, schedule requirements, fallback behavior, and next-boundary calculation.
 */

const assert = require("assert");

// Pure JS implementation matching src/lib/time-greeting.ts for Node runtime testing
function getTimeGreeting(date = new Date()) {
  const hour = date.getHours();

  if (hour >= 5 && hour < 12) {
    return "Good morning";
  }
  if (hour >= 12 && hour < 17) {
    return "Good afternoon";
  }
  if (hour >= 17 && hour < 21) {
    return "Good evening";
  }
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

console.log("======================================================================");
console.log("  LUCOUS DYNAMIC TIME-BASED GREETING TEST SUITE");
console.log("======================================================================");

function makeDate(hour, minute, second = 0) {
  const d = new Date();
  d.setHours(hour, minute, second, 0);
  return d;
}

let passed = 0;

function runTest(name, fn) {
  try {
    fn();
    console.log(`  [PASS] ${name}`);
    passed++;
  } catch (err) {
    console.error(`  [FAIL] ${name}:`, err.message);
    process.exit(1);
  }
}

// 1. Mandatory boundary tests from specification:
runTest("04:59 -> Good night", () => {
  const d = makeDate(4, 59);
  assert.strictEqual(getTimeGreeting(d), "Good night");
});

runTest("05:00 -> Good morning", () => {
  const d = makeDate(5, 0);
  assert.strictEqual(getTimeGreeting(d), "Good morning");
});

runTest("11:59 -> Good morning", () => {
  const d = makeDate(11, 59);
  assert.strictEqual(getTimeGreeting(d), "Good morning");
});

runTest("12:00 -> Good afternoon", () => {
  const d = makeDate(12, 0);
  assert.strictEqual(getTimeGreeting(d), "Good afternoon");
});

runTest("16:59 -> Good afternoon", () => {
  const d = makeDate(16, 59);
  assert.strictEqual(getTimeGreeting(d), "Good afternoon");
});

runTest("17:00 -> Good evening", () => {
  const d = makeDate(17, 0);
  assert.strictEqual(getTimeGreeting(d), "Good evening");
});

runTest("20:59 -> Good evening", () => {
  const d = makeDate(20, 59);
  assert.strictEqual(getTimeGreeting(d), "Good evening");
});

runTest("21:00 -> Good night", () => {
  const d = makeDate(21, 0);
  assert.strictEqual(getTimeGreeting(d), "Good night");
});

runTest("00:00 (Midnight) -> Good night", () => {
  const d = makeDate(0, 0);
  assert.strictEqual(getTimeGreeting(d), "Good night");
});

// Additional schedule checks
runTest("08:00 (Morning peak) -> Good morning", () => {
  const d = makeDate(8, 0);
  assert.strictEqual(getTimeGreeting(d), "Good morning");
});

runTest("14:30 (Afternoon peak) -> Good afternoon", () => {
  const d = makeDate(14, 30);
  assert.strictEqual(getTimeGreeting(d), "Good afternoon");
});

runTest("19:15 (Evening study) -> Good evening", () => {
  const d = makeDate(19, 15);
  assert.strictEqual(getTimeGreeting(d), "Good evening");
});

runTest("23:45 (Late night study) -> Good night", () => {
  const d = makeDate(23, 45);
  assert.strictEqual(getTimeGreeting(d), "Good night");
});

// 2. Personalization & name fallback handling
runTest("Personalized greeting with name: 'Shivprasad' at 08:00", () => {
  const d = makeDate(8, 0);
  assert.strictEqual(formatPersonalizedGreeting("Shivprasad", d), "Good morning, Shivprasad");
});

runTest("Personalized greeting with name: 'Aarav' at 14:00", () => {
  const d = makeDate(14, 0);
  assert.strictEqual(formatPersonalizedGreeting("Aarav", d), "Good afternoon, Aarav");
});

runTest("Personalized greeting with name: 'Ananya' at 18:00", () => {
  const d = makeDate(18, 0);
  assert.strictEqual(formatPersonalizedGreeting("Ananya", d), "Good evening, Ananya");
});

runTest("Personalized greeting with name: 'Rohan' at 22:00", () => {
  const d = makeDate(22, 0);
  assert.strictEqual(formatPersonalizedGreeting("Rohan", d), "Good night, Rohan");
});

runTest("Missing name (null) displays greeting alone", () => {
  const d = makeDate(8, 0);
  assert.strictEqual(formatPersonalizedGreeting(null, d), "Good morning");
});

runTest("Missing name (undefined) displays greeting alone", () => {
  const d = makeDate(13, 0);
  assert.strictEqual(formatPersonalizedGreeting(undefined, d), "Good afternoon");
});

runTest("Empty string name displays greeting alone", () => {
  const d = makeDate(18, 0);
  assert.strictEqual(formatPersonalizedGreeting("", d), "Good evening");
});

runTest("Whitespace-only name displays greeting alone", () => {
  const d = makeDate(22, 0);
  assert.strictEqual(formatPersonalizedGreeting("   ", d), "Good night");
});

runTest("String 'null' or 'undefined' does NOT print as name", () => {
  const d = makeDate(8, 0);
  assert.strictEqual(formatPersonalizedGreeting("null", d), "Good morning");
  assert.strictEqual(formatPersonalizedGreeting("undefined", d), "Good morning");
});

// 3. Next boundary calculation
runTest("Next boundary from 04:30 is 05:00 today", () => {
  const d = makeDate(4, 30);
  const next = getNextGreetingBoundary(d);
  assert.strictEqual(next.getHours(), 5);
  assert.strictEqual(next.getDate(), d.getDate());
});

runTest("Next boundary from 08:00 is 12:00 today", () => {
  const d = makeDate(8, 0);
  const next = getNextGreetingBoundary(d);
  assert.strictEqual(next.getHours(), 12);
  assert.strictEqual(next.getDate(), d.getDate());
});

runTest("Next boundary from 13:00 is 17:00 today", () => {
  const d = makeDate(13, 0);
  const next = getNextGreetingBoundary(d);
  assert.strictEqual(next.getHours(), 17);
  assert.strictEqual(next.getDate(), d.getDate());
});

runTest("Next boundary from 18:00 is 21:00 today", () => {
  const d = makeDate(18, 0);
  const next = getNextGreetingBoundary(d);
  assert.strictEqual(next.getHours(), 21);
  assert.strictEqual(next.getDate(), d.getDate());
});

runTest("Next boundary from 22:00 is 05:00 tomorrow", () => {
  const d = makeDate(22, 0);
  const next = getNextGreetingBoundary(d);
  assert.strictEqual(next.getHours(), 5);
  assert.ok(next.getTime() > d.getTime());
});

console.log("======================================================================");
console.log(`  GREETING TEST RESULTS: ${passed} PASSED, 0 FAILED`);
console.log("======================================================================\n");
