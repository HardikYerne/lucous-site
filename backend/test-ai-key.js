
/**
 * Test whether the Gemini API key works.
 *
 * Run from the backend folder:
 *   node test-ai-key.js
 *
 * Reads GEMINI_API_KEY (or AI_API_KEY) and AI_MODEL from .env.
 * Never prints the API key.
 */

require("dotenv").config();

const key = (
  process.env.GEMINI_API_KEY ||
  process.env.AI_API_KEY ||
  ""
).trim();

const model = (
  process.env.AI_MODEL ||
  "gemini-3.8-flash"
).trim();

const MAX_RETRIES = 4;
const RETRYABLE_STATUSES = new Set([
  408, 429, 500, 502, 503, 504,
]);

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchWithRetry(url, options) {
  for (let attempt = 0; ; attempt++) {
    let response;

    try {
      response = await fetch(url, options);
    } catch (err) {
      if (attempt >= MAX_RETRIES) {
        throw err;
      }

      const delay =
        Math.min(1000 * 2 ** attempt, 8000) +
        Math.random() * 500;

      console.warn(
        `Network error: ${err.message}. ` +
        `Retry ${attempt + 1}/${MAX_RETRIES} ` +
        `in ${Math.round(delay)} ms.`
      );

      await sleep(delay);
      continue;
    }

    if (
      response.ok ||
      !RETRYABLE_STATUSES.has(response.status) ||
      attempt >= MAX_RETRIES
    ) {
      return response;
    }

    // Release the previous response body before retrying.
    await response.body?.cancel().catch(() => {});

    const delay =
      Math.min(1000 * 2 ** attempt, 8000) +
      Math.random() * 500;

    console.warn(
      `Gemini HTTP ${response.status}. ` +
      `Retry ${attempt + 1}/${MAX_RETRIES} ` +
      `in ${Math.round(delay)} ms.`
    );

    await sleep(delay);
  }
}

async function main() {
  if (!key) {
    console.error(
      "No API key found. Add GEMINI_API_KEY=... to backend/.env."
    );
    process.exitCode = 1;
    return;
  }

  if (!model || /[=\s"']/.test(model)) {
    console.error(
      "Invalid AI_MODEL value. Check the model name in backend/.env."
    );
    process.exitCode = 1;
    return;
  }

  console.log(`Key found (${key.length} characters). Model: ${model}`);
  console.log("Asking Gemini a test question...\n");

  const url =
    `https://generativelanguage.googleapis.com/v1beta/models/` +
    `${encodeURIComponent(model)}:generateContent` +
    `?key=${encodeURIComponent(key)}`;

  try {
    const response = await fetchWithRetry(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts: [
              {
                text:
                  "In one short sentence, explain Euclid's " +
                  "division lemma for a Class 10 student.",
              },
            ],
          },
        ],
        generationConfig: {
          maxOutputTokens: 256,
        },
      }),
    });

    const body = await response.json().catch(() => ({}));

    if (!response.ok) {
      console.error(
        `FAILED (HTTP ${response.status}): ` +
        `${body?.error?.message || "Unknown API error"}`
      );

      switch (response.status) {
        case 400:
          console.error(
            "Check the request format, model name, and API configuration."
          );
          break;
        case 401:
        case 403:
          console.error(
            "Check API key validity, permissions, and API access."
          );
          break;
        case 404:
          console.error(
            `Model "${model}" or the requested endpoint was not found. ` +
            "Verify the currently supported model name."
          );
          break;
        case 429:
          console.error(
            "Rate limit or quota may have been reached. " +
            "Check your Google AI Studio usage and limits."
          );
          break;
        case 503:
          console.error(
            "Gemini is temporarily overloaded or unavailable. " +
            "Retry later or test another currently supported model."
          );
          break;
        default:
          console.error(
            "Check Google's Gemini API troubleshooting documentation."
          );
      }

      process.exitCode = 1;
      return;
    }

    const candidate = body?.candidates?.[0];
    const answer =
      candidate?.content?.parts
        ?.map((part) => part.text || "")
        .join("")
        .trim() || "";

    if (!answer) {
      console.error(
        "The API request succeeded, but Gemini returned no text. " +
        `Finish reason: ${candidate?.finishReason || "unknown"}`
      );
      process.exitCode = 1;
      return;
    }

    console.log("SUCCESS. Gemini replied:\n");
    console.log(answer);

    if (
      candidate.finishReason &&
      candidate.finishReason !== "STOP"
    ) {
      console.log(
        `\nFinish reason: ${candidate.finishReason}`
      );
    }
  } catch (err) {
    console.error("Gemini request failed:", err.message);
    console.error(
      "Check your internet connection and try again later."
    );
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error("Unexpected test error:", err.message);
  process.exitCode = 1;
});
