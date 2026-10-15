/**
 * Class Access Codes for LUCOUS
 *
 * One secure, time-limited code per teacher "class share". A student who enters
 * a valid, un-expired code can open ALL of that teacher's currently published
 * lessons and assessments. After the code expires (or the teacher revokes it)
 * nothing can be opened with it any more.
 *
 * Security notes:
 * - Codes are cryptographically random (crypto.randomInt), 8 chars from an
 *   unambiguous 31-char alphabet, prefixed "LC-" (individual item codes use "LU-").
 * - Individual item codes are NEVER sent to students from a class code. Each item
 *   is returned with a composite token "LC-XXXXXXXX::LU-YYYYYY". Every later request
 *   (check-answer, start/submit assessment) is re-validated against the class code,
 *   so expiry really cuts off access.
 */

const crypto = require("crypto");
const { normalizeAccessCode } = require("./access-code-service");
const {
  getTeacherPublishedContent,
  getStudentContentByAccessCode,
} = require("./publishing-service");

const ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";
const PREFIX = "LC-";
const BODY_LENGTH = 8;

const MIN_DURATION_MINUTES = 15;
const MAX_DURATION_MINUTES = 30 * 24 * 60; // 30 days
const DEFAULT_DURATION_MINUTES = 24 * 60; // 24 hours

const EXPIRED_MESSAGE =
  "This class code has expired or was turned off by your teacher. Please ask your teacher for a new code.";
const INVALID_MESSAGE = "Invalid class code. Please check the code and try again.";

// Used when MongoDB is not configured (local development without a database).
const memoryCodes = new Map();

function usesDatabase(prisma) {
  if (!process.env.MONGODB_URI) return false; // local dev without a database
  if (prisma && prisma.classAccessCode) return true;
  // A database is configured but the new model is not in the generated client yet.
  // Fail loudly instead of silently keeping codes in memory (they would vanish on restart).
  const err = new Error(
    "Class codes need a database update. Run `npx prisma generate` and `npx prisma db push`, then restart the backend."
  );
  err.statusCode = 500;
  throw err;
}

function generateClassCode() {
  let body = "";
  for (let i = 0; i < BODY_LENGTH; i++) {
    body += ALPHABET[crypto.randomInt(ALPHABET.length)];
  }
  return `${PREFIX}${body}`;
}

/** "lc 7k9m-2p4q" -> "LC-7K9M2P4Q". Returns "" when it cannot be a class code. */
function normalizeClassCode(raw) {
  if (!raw || typeof raw !== "string") return "";
  const cleaned = raw.replace(/[\s-]/g, "").toUpperCase();
  if (!cleaned.startsWith("LC")) return "";
  const body = cleaned.slice(2);
  const valid = new RegExp(`^[${ALPHABET}]{${BODY_LENGTH}}$`).test(body);
  return valid ? `${PREFIX}${body}` : "";
}

function isClassCodeLike(raw) {
  return Boolean(normalizeClassCode(raw));
}

function statusOf(record, now = Date.now()) {
  if (record.revokedAt) return "REVOKED";
  if (new Date(record.expiresAt).getTime() <= now) return "EXPIRED";
  return "ACTIVE";
}

function parseDurationMinutes(value) {
  if (value === undefined || value === null || value === "") {
    return DEFAULT_DURATION_MINUTES;
  }
  const minutes = Number(value);
  if (!Number.isFinite(minutes) || !Number.isInteger(minutes)) {
    const err = new Error("Duration must be a whole number of minutes.");
    err.statusCode = 400;
    throw err;
  }
  if (minutes < MIN_DURATION_MINUTES || minutes > MAX_DURATION_MINUTES) {
    const err = new Error("Duration must be between 15 minutes and 30 days.");
    err.statusCode = 400;
    throw err;
  }
  return minutes;
}

async function findByCode(prisma, normalizedCode) {
  if (usesDatabase(prisma)) {
    return prisma.classAccessCode.findUnique({ where: { code: normalizedCode } });
  }
  for (const record of memoryCodes.values()) {
    if (record.code === normalizedCode) return record;
  }
  return null;
}

async function createClassCode(prisma, { teacherId, title, durationMinutes }) {
  const minutes = parseDurationMinutes(durationMinutes);
  const cleanTitle =
    typeof title === "string" && title.trim() ? title.trim().slice(0, 80) : null;
  const expiresAt = new Date(Date.now() + minutes * 60 * 1000);

  let code = null;
  for (let attempt = 0; attempt < 6; attempt++) {
    const candidate = generateClassCode();
    if (!(await findByCode(prisma, candidate))) {
      code = candidate;
      break;
    }
  }
  if (!code) {
    const err = new Error("Could not generate a unique code. Please try again.");
    err.statusCode = 500;
    throw err;
  }

  if (usesDatabase(prisma)) {
    return prisma.classAccessCode.create({
      data: { code, teacherId, title: cleanTitle, expiresAt },
    });
  }
  const record = {
    id: crypto.randomUUID(),
    code,
    teacherId,
    title: cleanTitle,
    expiresAt,
    revokedAt: null,
    createdAt: new Date(),
  };
  memoryCodes.set(record.id, record);
  return record;
}

async function listClassCodes(prisma, teacherId) {
  let records;
  if (usesDatabase(prisma)) {
    records = await prisma.classAccessCode.findMany({
      where: { teacherId },
      orderBy: { createdAt: "desc" },
      take: 50,
    });
  } else {
    records = [...memoryCodes.values()]
      .filter((r) => r.teacherId === teacherId)
      .sort((a, b) => b.createdAt - a.createdAt);
  }
  return records;
}

async function revokeClassCode(prisma, { teacherId, id }) {
  let record = null;
  if (usesDatabase(prisma)) {
    try {
      record = await prisma.classAccessCode.findUnique({ where: { id } });
    } catch {
      record = null; // malformed id
    }
  } else {
    record = memoryCodes.get(id) || null;
  }

  if (!record || record.teacherId !== teacherId) {
    const err = new Error("Class code not found.");
    err.statusCode = 404;
    throw err;
  }

  if (usesDatabase(prisma)) {
    return prisma.classAccessCode.update({
      where: { id },
      data: { revokedAt: record.revokedAt || new Date() },
    });
  }
  record.revokedAt = record.revokedAt || new Date();
  return record;
}

/** Returns { record } for a usable code, or { error: { status, message } }. */
async function getUsableClassCode(prisma, rawCode) {
  const normalized = normalizeClassCode(rawCode);
  if (!normalized) return { error: { status: 404, message: INVALID_MESSAGE } };

  const record = await findByCode(prisma, normalized);
  if (!record) return { error: { status: 404, message: INVALID_MESSAGE } };

  if (statusOf(record) !== "ACTIVE") {
    return { error: { status: 410, message: EXPIRED_MESSAGE } };
  }
  return { record };
}

/** Everything a student may open with this class code (sanitized, composite tokens). */
async function buildClassBundle(prisma, record) {
  const published = await getTeacherPublishedContent(prisma, record.teacherId);

  const items = [];
  for (const entry of published) {
    if (!entry.accessCode) continue;
    const studentItem = await getStudentContentByAccessCode(prisma, entry.accessCode);
    if (!studentItem) continue;
    items.push({
      ...studentItem,
      // Composite token: class code + item code. Re-validated on every request.
      accessCode: `${record.code}::${entry.accessCode}`,
    });
  }

  let teacherName = null;
  if (usesDatabase(prisma) && prisma.user) {
    try {
      const teacher = await prisma.user.findUnique({
        where: { id: record.teacherId },
        select: { name: true },
      });
      teacherName = teacher ? teacher.name : null;
    } catch {
      teacherName = null;
    }
  }

  return {
    title: record.title || "Class materials",
    teacherName,
    expiresAt: new Date(record.expiresAt).toISOString(),
    items,
  };
}

/**
 * If `rawCode` is a composite "LC-...::LU-..." token, validate it and return the
 * plain item code. Returns null when it is not a composite token.
 */
async function resolveCompositeCode(prisma, rawCode) {
  if (typeof rawCode !== "string" || !rawCode.includes("::")) return null;

  const [classPart, itemPart] = rawCode.split("::");
  const usable = await getUsableClassCode(prisma, classPart);
  if (usable.error) {
    return { ok: false, status: usable.error.status, message: usable.error.message };
  }

  const itemCode = normalizeAccessCode(itemPart || "");
  const published = await getTeacherPublishedContent(prisma, usable.record.teacherId);
  if (!published.some((entry) => entry.accessCode === itemCode)) {
    return {
      ok: false,
      status: 404,
      message: "This material is no longer available with this class code.",
    };
  }
  return { ok: true, itemCode };
}

/** Express middleware: swaps a composite token in req.body.code for the item code. */
function classCodeMiddleware(prisma) {
  return async (req, res, next) => {
    try {
      const resolved = await resolveCompositeCode(prisma, req.body && req.body.code);
      if (!resolved) return next();
      if (!resolved.ok) {
        return res.status(resolved.status).json({ success: false, message: resolved.message });
      }
      req.body.code = resolved.itemCode;
      return next();
    } catch (err) {
      return next(err);
    }
  };
}

module.exports = {
  PREFIX,
  MIN_DURATION_MINUTES,
  MAX_DURATION_MINUTES,
  DEFAULT_DURATION_MINUTES,
  generateClassCode,
  normalizeClassCode,
  isClassCodeLike,
  statusOf,
  createClassCode,
  listClassCodes,
  revokeClassCode,
  getUsableClassCode,
  buildClassBundle,
  resolveCompositeCode,
  classCodeMiddleware,
  memoryCodes,
};