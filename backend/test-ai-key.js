/**
 * Quick check that your Gemini API key works.
 * Put this file in the backend folder (next to server.js) and run:
 *     node test-ai-key.js
 * It reads GEMINI_API_KEY (and AI_MODEL) from backend/.env and never prints the key.
 */
require("dotenv").config();

const key = (process.env.GEMINI_API_KEY || process.env.AI_API_KEY || "").trim();
const model = (process.env.AI_MODEL || "gemini-3.8-flash").trim();

if (!key) {
  console.error("No key found. Add GEMINI_API_KEY=... to backend/.env and run again.");
  process.exit(1);
}
console.log(`Key found (${key.length} characters). Model: ${model}`);
if (/[=\s"']/.test(model)) {
  console.error('\nThe model name looks wrong. In backend/.env the line must be exactly:\n  AI_MODEL=gemini-3.8-flash\n(no second "AI_MODEL=", no quotes, no spaces)');
  process.exit(1);
}
console.log("Asking Gemini a test question...\n");

(async () => {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(key)}`;
  try {
    const resp = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: "In one short sentence, explain Euclid's division lemma for a Class 10 student." }] }],
        generationConfig: { maxOutputTokens: 2048 },
      }),
    });
    const body = await resp.json().catch(() => ({}));

    if (!resp.ok) {
      console.error(`FAILED (HTTP ${resp.status}): ${body?.error?.message || "unknown error"}`);
      if (resp.status === 400) console.error("-> Bad request: check that GEMINI_API_KEY has no quotes/spaces and AI_MODEL is exactly gemini-3.8-flash in .env.");
      if (resp.status === 403) console.error("-> The key is not allowed: enable the Generative Language API for it, or check the region.");
      if (resp.status === 404) console.error(`-> Model "${model}" is not available. Set AI_MODEL=gemini-3.8-flash in backend/.env and restart.`);
      if (resp.status === 429) console.error("-> Quota/rate limit reached. Wait a minute or check your Google AI Studio plan.");
      process.exit(1);
    }

    const finish = body?.candidates?.[0]?.finishReason;
    const text = body?.candidates?.[0]?.content?.parts?.map((p) => p.text).join("") || "";
    console.log("SUCCESS. Gemini replied:\n");
    console.log(text.trim() || "(empty reply)");
    if (finish && finish !== "STOP") {
      console.log(`\n(finishReason: ${finish} - the answer was cut off because the model used its output budget.)`);
    }
  } catch (err) {
    console.error("Could not reach Google:", err.message);
    console.error("-> Check your internet connection / firewall.");
    process.exit(1);
  }
})();