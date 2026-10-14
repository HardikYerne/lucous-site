/**
 * Cryptographically Secure Unique Access Code Service for LUCOUS
 * 
 * Generates and normalizes human-friendly, collision-resistant access codes
 * for published teacher lessons and assessments.
 *
 * Characteristics:
 * - Unambiguous 31-character alphabet excluding confusing glyphs (0/O, 1/I/L).
 * - Prefix "LU-" for branding and context recognition.
 * - Normalized on ingestion (case-insensitive, trims dashes and whitespace).
 * - Cryptographically random entropy (31^6 = ~887.5 million combinations).
 */

const crypto = require("crypto");

// Exclude visually ambiguous characters: 0, O, 1, I, L
const CODE_ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";
const CODE_LENGTH = 6;
const CODE_PREFIX = "LU-";

/**
 * Generates a random unpredictable alphanumeric access code.
 * Example output: "LU-7K9M2P"
 */
function generateAccessCode(length = CODE_LENGTH, prefix = CODE_PREFIX) {
  let result = "";
  const alphabetLength = CODE_ALPHABET.length;
  // Use crypto.randomBytes for cryptographic unpredictability
  const randomBytes = crypto.randomBytes(length);

  for (let i = 0; i < length; i++) {
    const randomIndex = randomBytes[i] % alphabetLength;
    result += CODE_ALPHABET[randomIndex];
  }

  return `${prefix}${result}`;
}

/**
 * Normalizes user-entered access codes.
 * Examples:
 * - "lu-7k9m2p" -> "LU-7K9M2P"
 * - " 7k9m2p "  -> "LU-7K9M2P"
 * - "LU - 7K9M2P" -> "LU-7K9M2P"
 */
function normalizeAccessCode(rawCode) {
  if (!rawCode || typeof rawCode !== "string") {
    return "";
  }

  // Remove whitespace and hyphens, convert to uppercase
  const cleaned = rawCode.replace(/[\s-]/g, "").toUpperCase();

  // If begins with LU, strip LU and reconstruct with standard hyphen
  if (cleaned.startsWith("LU")) {
    const suffix = cleaned.slice(2);
    return `${CODE_PREFIX}${suffix}`;
  }

  // If student entered just the 6-character body
  return `${CODE_PREFIX}${cleaned}`;
}

/**
 * Validates whether an access code matches the accepted format.
 * Format: "LU-" followed by 6 valid alphabet characters.
 */
function isValidAccessCodeFormat(rawCode) {
  const normalized = normalizeAccessCode(rawCode);
  const regex = new RegExp(`^${CODE_PREFIX}[2-9A-HJ-NP-Z]{${CODE_LENGTH}}$`);
  return regex.test(normalized);
}

/**
 * Generates an access code guaranteed unique against existing records
 * by querying an asynchronous collision-checker function.
 * 
 * @param {Function} isCodeInUse - async function(code) => boolean
 * @param {number} maxRetries - default 5
 */
async function generateUniqueAccessCode(isCodeInUse, maxRetries = 5) {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const candidate = generateAccessCode();
    const inUse = await isCodeInUse(candidate);
    if (!inUse) {
      return candidate;
    }
    console.warn(`[Access Code Service] Collision detected for ${candidate}. Retrying (attempt ${attempt + 1}/${maxRetries})...`);
  }

  throw new Error("Failed to generate unique access code after maximum retries. Please retry publication.");
}

module.exports = {
  CODE_ALPHABET,
  CODE_LENGTH,
  CODE_PREFIX,
  generateAccessCode,
  normalizeAccessCode,
  isValidAccessCodeFormat,
  generateUniqueAccessCode,
};
