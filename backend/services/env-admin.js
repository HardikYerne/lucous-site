/**
 * Admin account stored in the server .env file (NOT in the database).
 *
 *   ADMIN_EMAIL=owner@yourdomain.com
 *   ADMIN_PASSWORD_HASH=$2a$10$...        (recommended: bcrypt hash)
 *   # or, simpler for local testing:
 *   ADMIN_PASSWORD=ChangeMe-LongPassword
 *   ADMIN_NAME=Platform Admin             (optional)
 *
 * The admin signs in at /auth/admin/login with that email + password. There is no
 * admin sign-up and no database record, so only someone who controls the server's
 * .env file can be an admin. To change the admin, edit .env and restart the backend.
 *
 * Make a bcrypt hash with:
 *   node -e "console.log(require('bcryptjs').hashSync('YourPassword', 10))"
 */

const crypto = require("crypto");
const bcrypt = require("bcryptjs");

const ENV_ADMIN_ID = "env-admin";

function getEnvAdmin() {
  const email = String(process.env.ADMIN_EMAIL || "").trim().toLowerCase();
  const hash = String(process.env.ADMIN_PASSWORD_HASH || "").trim();
  const plain = String(process.env.ADMIN_PASSWORD || "");
  if (!email || (!hash && !plain)) return null;
  return {
    id: ENV_ADMIN_ID,
    email,
    name: String(process.env.ADMIN_NAME || "Platform Admin").trim() || "Platform Admin",
    role: "ADMIN",
    hash,
    plain,
  };
}

function isEnvAdminId(id) {
  return id === ENV_ADMIN_ID;
}

function isEnvAdminEmail(email) {
  const admin = getEnvAdmin();
  return Boolean(admin && admin.email === String(email || "").trim().toLowerCase());
}

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest();
}

async function passwordMatches(admin, password) {
  if (admin.hash) {
    try {
      return await bcrypt.compare(password, admin.hash);
    } catch {
      return false;
    }
  }
  // Constant-time comparison for the plain-text variant.
  return crypto.timingSafeEqual(sha256(password), sha256(admin.plain));
}

function publicUser(admin) {
  return {
    id: admin.id,
    name: admin.name,
    email: admin.email,
    role: "ADMIN",
    isVerified: true,
    avatarUrl: null,
    phone: null,
    grade: null,
    board: null,
    school: null,
    subject: null,
    xp: 0,
    teacherApplication: null,
  };
}

function getEnvAdminPublicUser() {
  const admin = getEnvAdmin();
  return admin ? publicUser(admin) : null;
}

// Brute-force protection: at most 10 admin sign-in attempts per IP per 15 minutes.
const attempts = new Map();
const WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 10;

function withinLimit(ip) {
  const now = Date.now();
  const record = attempts.get(ip) || { count: 0, resetAt: now + WINDOW_MS };
  if (now > record.resetAt) {
    record.count = 0;
    record.resetAt = now + WINDOW_MS;
  }
  record.count += 1;
  attempts.set(ip, record);
  return record.count <= MAX_ATTEMPTS;
}

/**
 * Returns null when `email` is not the env admin (so normal login continues),
 * otherwise { status, body } ready to send.
 */
async function attemptEnvAdminLogin({ email, password, ip, signToken }) {
  const admin = getEnvAdmin();
  if (!admin || admin.email !== String(email || "").trim().toLowerCase()) return null;

  if (!withinLimit(ip || "unknown_ip")) {
    return {
      status: 429,
      body: { success: false, message: "Too many sign-in attempts. Please wait 15 minutes and try again." },
    };
  }

  if (!(await passwordMatches(admin, String(password || "")))) {
    return { status: 401, body: { success: false, message: "Invalid email or password" } };
  }

  const token = signToken({ userId: admin.id, role: "ADMIN" });
  return {
    status: 200,
    body: { success: true, message: "Login successful", token, user: publicUser(admin) },
  };
}

module.exports = {
  ENV_ADMIN_ID,
  getEnvAdmin,
  isEnvAdminId,
  isEnvAdminEmail,
  getEnvAdminPublicUser,
  attemptEnvAdminLogin,
};