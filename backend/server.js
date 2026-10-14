require("dotenv").config();
const path = require("path");
const fs = require("fs");
const express = require("express");
const cors = require("cors");
const crypto = require("crypto");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const multer = require("multer");
const { PrismaClient } = require("@prisma/client");

const { getStorageAdapter } = require("./storage/storage-adapter");
const { isEmailConfigured, sendOtpEmail } = require("./services/email-service");
const {
  validateAvatarFile,
  MAX_AVATAR_SIZE_BYTES,
} = require("./services/avatar-validator");

const {
  APPLICATION_STATUS,
  validateTeacherDocument,
  isTeacherApproved,
  getApplicationByUserId,
  createPendingTeacherApplication,
  saveTeacherApplication,
  addDocumentToApplication,
  reviewTeacherApplication,
  listTeacherApplications,
} = require("./services/teacher-application-service");

const {
  CURATED_VIDEOS,
  EDUCATION_LEVELS,
  BOARDS,
  DIPLOMA_BRANCHES,
  DIPLOMA_SCHEMES,
  SCHOOL_SUBJECTS_BY_LEVEL,
  DIPLOMA_SUBJECTS_BY_BRANCH_AND_SEM,
  extractYouTubeId,
  filterVideos,
} = require("./curated-videos");
const {
  getFallbackBoards,
  getFallbackClasses,
  getFallbackSubjects,
  getFallbackChapters,
  getFallbackTopics,
  getFallbackTopicById,
  getFallbackContent,
  getFallbackQuestions,
  getFallbackQuestionById,
  getFallbackDiplomaMeta,
  validateCurriculumSelection,
  getTopicGameData,
} = require("./curriculum-service");

const inMemoryCompletedContent = new Map();
const inMemoryUserXp = new Map();
const inMemoryUsers = new Map();
const inMemoryStudentSelections = new Map();
const inMemoryVideoReports = [];
const inMemoryAiMessages = [];
const inMemoryAttempts = [];
const recentAttemptSubmissions = new Map();

function isMongoId(val) {
  return typeof val === "string" && /^[a-f\d]{24}$/i.test(val);
}

// Seed standard demo users for offline resilience
const defaultDemoUsers = [
  {
    id: "demo-student-id",
    name: "Alex Johnson",
    email: "student@lucous.com",
    password: "$2a$10$wK1VqJz4vD.qgLw0h1GGeOQ7g1bV7eA8jBq1q2q3q4q5q6q7q8q9q", // "password123"
    role: "STUDENT",
    avatarUrl: null,
    phone: "9876543210",
    grade: "Class 10",
    board: "CBSE",
    school: "Springfield High",
    subject: "Mathematics",
    xp: 250,
    isVerified: true,
  },
  {
    id: "demo-teacher-id",
    name: "Sarah Parker",
    email: "teacher@lucous.com",
    password: "$2a$10$wK1VqJz4vD.qgLw0h1GGeOQ7g1bV7eA8jBq1q2q3q4q5q6q7q8q9q",
    role: "TEACHER",
    avatarUrl: null,
    phone: "9876543211",
    school: "Springfield High",
    subject: "Science",
    xp: 0,
    isVerified: true,
  },
  {
    id: "demo-parent-id",
    name: "Robert Johnson",
    email: "parent@lucous.com",
    password: "$2a$10$wK1VqJz4vD.qgLw0h1GGeOQ7g1bV7eA8jBq1q2q3q4q5q6q7q8q9q",
    role: "PARENT",
    avatarUrl: null,
    phone: "9876543212",
    xp: 0,
    isVerified: true,
  },
];
for (const u of defaultDemoUsers) {
  inMemoryUsers.set(u.id, u);
}

// Admin account defined ONLY in env (never stored in the database).
// Set ADMIN_EMAIL and ADMIN_PASSWORD (min 8 chars) to enable login at /auth/admin/login.
// If either is missing, no admin is created.
if (process.env.ADMIN_EMAIL && process.env.ADMIN_PASSWORD) {
  inMemoryUsers.set("env-admin", {
    id: "env-admin",
    name: process.env.ADMIN_NAME || "LUCOUS Admin",
    email: process.env.ADMIN_EMAIL.trim().toLowerCase(),
    password: bcrypt.hashSync(process.env.ADMIN_PASSWORD, 10),
    role: "ADMIN",
    avatarUrl: null,
    xp: 0,
    isVerified: true,
  });
  console.log(`[admin] Env admin enabled: ${process.env.ADMIN_EMAIL.trim().toLowerCase()}`);
} else if (process.env.ADMIN_EMAIL || process.env.ADMIN_PASSWORD) {
  console.warn("[admin] ADMIN_EMAIL and ADMIN_PASSWORD must BOTH be set in .env. Env admin NOT enabled.");
}

const app = express();
const prisma = new PrismaClient();

const PORT = process.env.PORT ? Number(process.env.PORT) : 5000;
const JWT_SECRET = process.env.JWT_SECRET || "lucous-development-secret";

const allowedOrigins = [
  "http://localhost:3000",
  "http://127.0.0.1:3000",
  ...(process.env.FRONTEND_URL ? [process.env.FRONTEND_URL] : []),
];

// Allow the LUCOUS Next.js frontend to communicate with the backend
app.use(
  cors({
    origin: allowedOrigins,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true,
  })
);

// Express 5 equivalent of app.options("*", cors())
app.options("/*splat", cors());

// Capture the raw body so the Razorpay webhook can verify its HMAC signature.
app.use(
  express.json({
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    },
  })
);

// Health check
app.get("/api/health", async (req, res) => {
  try {
    await prisma.$runCommandRaw({ ping: 1 });

    res.json({
      success: true,
      message: "LUCOUS backend is running",
      database: "connected",
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      success: false,
      message: "Database connection failed",
    });
  }
});

// ------------------------- Static Uploads & Avatars -------------------------
const uploadsDir = path.resolve(__dirname, "uploads");
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true, mode: 0o755 });
}

// Serve uploaded files statically and with safe path-traversal validation
app.use("/uploads", express.static(uploadsDir));
app.use("/api/uploads", express.static(uploadsDir));

app.get("/api/uploads/:filename", (req, res) => {
  try {
    const rawFilename = req.params.filename;
    const storageAdapter = getStorageAdapter();
    const safePath = storageAdapter.resolveSafePath(rawFilename);
    if (!fs.existsSync(safePath)) {
      return res.status(404).json({ success: false, message: "File not found" });
    }
    res.sendFile(safePath);
  } catch (err) {
    res.status(400).json({ success: false, message: "Invalid file request" });
  }
});

// Multer memory-storage configuration for avatar images
const avatarUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_AVATAR_SIZE_BYTES + 1024,
    files: 1,
  },
});

// 1. Public avatar upload (e.g. preview / upload during registration)
app.post("/api/auth/upload-avatar", (req, res) => {
  avatarUpload.single("avatar")(req, res, async (err) => {
    if (err) {
      if (err instanceof multer.MulterError && err.code === "LIMIT_FILE_SIZE") {
        return res.status(400).json({
          success: false,
          message: "Profile picture exceeds the 3MB size limit.",
        });
      }
      return res.status(400).json({
        success: false,
        message: err.message || "Avatar upload failed.",
      });
    }

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "No avatar image provided.",
      });
    }

    const validation = validateAvatarFile(req.file);
    if (!validation.valid) {
      return res.status(400).json({
        success: false,
        message: validation.error,
      });
    }

    try {
      const storageAdapter = getStorageAdapter();
      const ext = validation.extension;
      const storageKey = `avatar-${crypto.randomUUID()}${ext}`;
      await storageAdapter.save({
        key: storageKey,
        buffer: req.file.buffer,
        mimeType: validation.mimeType,
      });

      const avatarUrl = `/api/uploads/${storageKey}`;
      return res.status(201).json({
        success: true,
        message: "Avatar uploaded successfully",
        avatarUrl,
      });
    } catch (saveErr) {
      console.error("Avatar save error:", saveErr);
      return res.status(500).json({
        success: false,
        message: "Failed to save profile picture.",
      });
    }
  });
});

// 2. Authenticated avatar upload (updates authenticated user profile directly)
app.post("/api/auth/profile/avatar", authenticate, (req, res) => {
  avatarUpload.single("avatar")(req, res, async (err) => {
    if (err) {
      if (err instanceof multer.MulterError && err.code === "LIMIT_FILE_SIZE") {
        return res.status(400).json({
          success: false,
          message: "Profile picture exceeds the 3MB size limit.",
        });
      }
      return res.status(400).json({
        success: false,
        message: err.message || "Avatar upload failed.",
      });
    }

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "No avatar image provided.",
      });
    }

    const validation = validateAvatarFile(req.file);
    if (!validation.valid) {
      return res.status(400).json({
        success: false,
        message: validation.error,
      });
    }

    try {
      const storageAdapter = getStorageAdapter();
      const ext = validation.extension;
      const storageKey = `avatar-${crypto.randomUUID()}${ext}`;
      await storageAdapter.save({
        key: storageKey,
        buffer: req.file.buffer,
        mimeType: validation.mimeType,
      });

      const avatarUrl = `/api/uploads/${storageKey}`;

      let updatedUser = null;
      if (process.env.MONGODB_URI) {
        try {
          updatedUser = await prisma.user.update({
            where: { id: req.userId },
            data: { avatarUrl },
            select: {
              id: true,
              name: true,
              email: true,
              role: true,
              avatarUrl: true,
              phone: true,
              grade: true,
              board: true,
              school: true,
              subject: true,
              xp: true,
            },
          });
        } catch (dbErr) {
          console.warn("Prisma avatar update fallback:", dbErr.message);
        }
      }

      if (!updatedUser) {
        const memUser = inMemoryUsers.get(req.userId);
        if (memUser) {
          memUser.avatarUrl = avatarUrl;
          inMemoryUsers.set(req.userId, memUser);
          updatedUser = { ...memUser };
          delete updatedUser.password;
        }
      }

      if (!updatedUser) {
        return res.status(404).json({ success: false, message: "User not found" });
      }

      return res.json({
        success: true,
        message: "Profile picture updated successfully",
        avatarUrl,
        user: updatedUser,
      });
    } catch (saveErr) {
      console.error("Profile avatar update error:", saveErr);
      return res.status(500).json({
        success: false,
        message: "Failed to update profile picture.",
      });
    }
  });
});

// Email verification is enforced only when SMTP is configured AND the database
// is available (codes are stored in MongoDB). Otherwise the old dev behaviour applies.
function emailVerificationRequired() {
  return isEmailConfigured() && Boolean(process.env.MONGODB_URI);
}

// ----------------------------- Registration ---------------------------------
// Only public roles are allowed for registration. ADMIN is strictly prohibited.
const PUBLIC_ALLOWED_ROLES = ["STUDENT", "PARENT", "TEACHER"];

async function registerUser(req, res, forcedRole) {
  try {
    const name = String(req.body.name || "").trim();
    const email = String(req.body.email || "").trim().toLowerCase();
    const password = String(req.body.password || "");
    const requestedRole = String(forcedRole || req.body.role || "").toUpperCase();
    const avatarUrl = req.body.avatarUrl ? String(req.body.avatarUrl).trim() : null;

    if (!name || !email || !password || !requestedRole) {
      return res.status(400).json({
        success: false,
        message: "Name, email, password and role are required",
      });
    }

    // STRICT CHECK: Public registration cannot assign the ADMIN role
    if (requestedRole === "ADMIN") {
      return res.status(403).json({
        success: false,
        message: "Public registration is not permitted for the ADMIN role.",
      });
    }

    if (!PUBLIC_ALLOWED_ROLES.includes(requestedRole)) {
      return res.status(400).json({
        success: false,
        message: "Invalid role. Only STUDENT, TEACHER, and PARENT can register.",
      });
    }

    // Look for existing user in MongoDB or in-memory fallback
    let existingUser = null;
    if (process.env.MONGODB_URI) {
      try {
        existingUser = await prisma.user.findUnique({
          where: { email },
        });
      } catch (dbErr) {
        console.warn("Prisma user lookup fallback:", dbErr.message);
      }
    }

    if (!existingUser) {
      for (const u of inMemoryUsers.values()) {
        if (u.email === email) {
          existingUser = u;
          break;
        }
      }
    }

    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: "User already exists",
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    let user = null;

    const needsEmailVerification = emailVerificationRequired();
    const isInitialVerified = needsEmailVerification
      ? false
      : requestedRole === "TEACHER"
        ? false
        : true;

    if (process.env.MONGODB_URI) {
      try {
        user = await prisma.user.create({
          data: {
            name,
            email,
            password: hashedPassword,
            role: requestedRole,
            avatarUrl,
            phone: req.body.phone ? String(req.body.phone).trim() : null,
            grade: req.body.grade ? String(req.body.grade).trim() : null,
            board: req.body.board ? String(req.body.board).trim() : null,
            school: req.body.school ? String(req.body.school).trim() : null,
            subject: req.body.subject ? String(req.body.subject).trim() : null,
            isVerified: isInitialVerified,
          },
        });
      } catch (dbErr) {
        console.warn("Prisma user create fallback:", dbErr.message);
      }
    }

    if (!user) {
      const newId = `user-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      user = {
        id: newId,
        name,
        email,
        password: hashedPassword,
        role: requestedRole,
        avatarUrl,
        phone: req.body.phone ? String(req.body.phone).trim() : null,
        grade: req.body.grade ? String(req.body.grade).trim() : null,
        board: req.body.board ? String(req.body.board).trim() : null,
        school: req.body.school ? String(req.body.school).trim() : null,
        subject: req.body.subject ? String(req.body.subject).trim() : null,
        xp: 0,
        isVerified: isInitialVerified,
      };
      inMemoryUsers.set(newId, user);
    }

    if (requestedRole === "TEACHER") {
      createPendingTeacherApplication(user);
    }

    res.status(201).json({
      success: true,
      message: "Registration successful",
      requiresVerification: needsEmailVerification,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        avatarUrl: user.avatarUrl || null,
      },
    });
  } catch (error) {
    console.error("Registration error:", error);
    res.status(500).json({
      success: false,
      message: "Registration failed",
    });
  }
}

app.post("/api/auth/register", (req, res) => registerUser(req, res, null));
app.post("/api/auth/register/student", (req, res) => registerUser(req, res, "STUDENT"));
app.post("/api/auth/register/teacher", (req, res) => registerUser(req, res, "TEACHER"));
app.post("/api/auth/register/parent", (req, res) => registerUser(req, res, "PARENT"));

// --------------------------------- Login ------------------------------------
app.post("/api/auth/login", async (req, res) => {
  try {
    const email = String(req.body.email || "").trim().toLowerCase();
    const password = String(req.body.password || "");

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: "Email and password are required",
      });
    }

    let user = null;
    if (process.env.MONGODB_URI) {
      try {
        user = await prisma.user.findUnique({
          where: { email },
        });
      } catch (dbErr) {
        console.warn("Prisma user login fallback:", dbErr.message);
      }
    }

    if (!user) {
      for (const u of inMemoryUsers.values()) {
        if (u.email === email) {
          user = u;
          break;
        }
      }
    }

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password",
      });
    }

    const passwordMatch = await bcrypt.compare(password, user.password);
    if (!passwordMatch) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password",
      });
    }

    if (
      emailVerificationRequired() &&
      user.role !== "ADMIN" &&
      !user.isVerified
    ) {
      return res.status(403).json({
        success: false,
        needsVerification: true,
        email: user.email,
        message: "Please verify your email to continue.",
      });
    }

    const token = jwt.sign(
      {
        userId: user.id,
        role: user.role,
      },
      JWT_SECRET,
      { expiresIn: "7d" }
    );

    const teacherApp = user.role === "TEACHER" ? (getApplicationByUserId(user.id) || createPendingTeacherApplication(user)) : null;

    res.json({
      success: true,
      message: "Login successful",
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        isVerified: user.isVerified || false,
        avatarUrl: user.avatarUrl || null,
        phone: user.phone || null,
        grade: user.grade || null,
        board: user.board || null,
        school: user.school || null,
        subject: user.subject || null,
        xp: user.xp || 0,
        teacherApplication: teacherApp,
      },
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({
      success: false,
      message: "Login failed",
    });
  }
});

// ------------------------------ User Profile --------------------------------
// Current authenticated user
app.get("/api/auth/me", authenticate, async (req, res) => {
  try {
    let user = null;
    if (process.env.MONGODB_URI) {
      try {
        user = await prisma.user.findUnique({
          where: { id: req.userId },
        });
      } catch (dbErr) {
        console.warn("Prisma /api/auth/me fallback:", dbErr.message);
      }
    }

    if (!user) {
      user = inMemoryUsers.get(req.userId);
    }

    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    const teacherApp = user.role === "TEACHER" ? (getApplicationByUserId(user.id) || createPendingTeacherApplication(user)) : null;

    res.json({
      success: true,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        isVerified: user.isVerified || false,
        phone: user.phone || null,
        grade: user.grade || null,
        board: user.board || null,
        school: user.school || null,
        subject: user.subject || null,
        avatarUrl: user.avatarUrl || null,
        xp: user.xp || 0,
        teacherApplication: teacherApp,
      },
    });
  } catch (error) {
    console.error("Me error:", error);
    res.status(500).json({ success: false, message: "Failed to load user" });
  }
});

// Update the authenticated user's own profile (strictly scoped to req.userId).
// Never allow updating role, password, or another user's profile.
app.patch("/api/auth/profile", authenticate, async (req, res) => {
  try {
    const allowed = ["name", "phone", "grade", "board", "school", "subject", "avatarUrl"];
    const data = {};
    for (const key of allowed) {
      if (req.body[key] !== undefined) {
        if (typeof req.body[key] === "string") {
          data[key] = req.body[key].trim();
        } else {
          data[key] = req.body[key];
        }
      }
    }
    if (data.name !== undefined && data.name.length === 0) {
      return res.status(400).json({ success: false, message: "Name cannot be empty" });
    }

    let user = null;
    if (process.env.MONGODB_URI) {
      try {
        user = await prisma.user.update({
          where: { id: req.userId },
          data,
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
            phone: true,
            grade: true,
            board: true,
            school: true,
            subject: true,
            avatarUrl: true,
            xp: true,
          },
        });
      } catch (dbErr) {
        console.warn("Prisma profile update fallback:", dbErr.message);
      }
    }

    if (!user) {
      const memUser = inMemoryUsers.get(req.userId);
      if (memUser) {
        Object.assign(memUser, data);
        inMemoryUsers.set(req.userId, memUser);
        user = { ...memUser };
        delete user.password;
      }
    }

    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    res.json({ success: true, message: "Profile updated", user });
  } catch (error) {
    console.error("Profile update error:", error);
    res.status(500).json({ success: false, message: "Failed to update profile" });
  }
});

// Logout (JWT is stateless; no blacklist needed)
app.post("/api/auth/logout", (req, res) => {
  res.json({ success: true, message: "Logged out" });
});

// ------------------------------- OTP ----------------------------------------
// When SMTP is configured (see services/email-service.js) the code is emailed.
// Without SMTP it is logged to the console and returned in the response ONLY
// when NODE_ENV is not "production".

const OTP_TTL_MS = 10 * 60 * 1000; // 10 minutes

function isDev() {
  return (process.env.NODE_ENV || "development") !== "production";
}

function generateOtpCode() {
  return String(crypto.randomInt(100000, 1000000));
}

// Best-effort throttling (in-memory, per server instance).
const OTP_RESEND_COOLDOWN_MS = 30 * 1000;
const OTP_MAX_FAILED_ATTEMPTS = 5;
const otpLastSent = new Map(); // `${purpose}:${email}` -> timestamp
const otpFailures = new Map(); // email -> { count, resetAt }

function otpTooManyAttempts(email) {
  const rec = otpFailures.get(email);
  if (!rec) return false;
  if (rec.resetAt < Date.now()) {
    otpFailures.delete(email);
    return false;
  }
  return rec.count >= OTP_MAX_FAILED_ATTEMPTS;
}

function otpRecordFailure(email) {
  const rec = otpFailures.get(email);
  if (!rec || rec.resetAt < Date.now()) {
    otpFailures.set(email, { count: 1, resetAt: Date.now() + OTP_TTL_MS });
  } else {
    rec.count += 1;
  }
}

async function issueOtp(email, purpose, userId) {
  const code = generateOtpCode();
  const expiresAt = new Date(Date.now() + OTP_TTL_MS);

  // Invalidate any previous unused OTPs for this email + purpose.
  await prisma.otp.deleteMany({
    where: { email, purpose, verified: false },
  });

  await prisma.otp.create({
    data: { email, code, purpose, expiresAt, userId: userId ?? null },
  });

  if (isEmailConfigured()) {
    try {
      await sendOtpEmail(email, code, purpose, OTP_TTL_MS / 60000);
    } catch (mailErr) {
      // Do not leave a usable code behind if the email never went out.
      await prisma.otp.deleteMany({ where: { email, purpose, code } });
      console.error("[OTP] email send failed:", mailErr.message);
      throw new Error("EMAIL_SEND_FAILED");
    }
  } else {
    console.log(`[OTP] ${purpose} code for ${email}: ${code} (expires ${expiresAt.toISOString()})`);
  }
  return code;
}

// Only expose the code in the API response when no real email is being sent.
function devOtpField(code) {
  return isDev() && !isEmailConfigured() ? { otp: code } : {};
}

app.post("/api/auth/send-otp", async (req, res) => {
  try {
    const rawEmail = String(req.body.email || "").trim().toLowerCase();
    const { purpose } = req.body;

    if (!rawEmail) {
      return res.status(400).json({ success: false, message: "Email is required" });
    }

    const otpPurpose = purpose === "RESET" ? "RESET" : "VERIFY";

    const sentKey = `${otpPurpose}:${rawEmail}`;
    const last = otpLastSent.get(sentKey) || 0;
    if (Date.now() - last < OTP_RESEND_COOLDOWN_MS) {
      return res.status(429).json({
        success: false,
        message: "Please wait a few seconds before requesting another code.",
      });
    }

    const user = await prisma.user.findUnique({ where: { email: rawEmail } });
    const code = await issueOtp(rawEmail, otpPurpose, user ? user.id : null);
    otpLastSent.set(sentKey, Date.now());

    res.json({
      success: true,
      message: "OTP sent",
      ...devOtpField(code),
    });
  } catch (error) {
    console.error("Send OTP error:", error);
    res.status(500).json({
      success: false,
      message:
        error.message === "EMAIL_SEND_FAILED"
          ? "Could not send the email. Please try again shortly."
          : "Failed to send OTP",
    });
  }
});

app.post("/api/auth/verify-otp", async (req, res) => {
  try {
    const rawEmail = String(req.body.email || "").trim().toLowerCase();
    const { code } = req.body;

    if (!rawEmail || !code) {
      return res
        .status(400)
        .json({ success: false, message: "Email and code are required" });
    }

    if (otpTooManyAttempts(rawEmail)) {
      return res.status(429).json({
        success: false,
        message: "Too many incorrect attempts. Request a new code and try again later.",
      });
    }

    const otp = await prisma.otp.findFirst({
      where: {
        email: rawEmail,
        code: String(code).trim(),
        purpose: "VERIFY",
        verified: false,
        expiresAt: { gte: new Date() },
      },
      orderBy: { createdAt: "desc" },
    });

    if (!otp) {
      otpRecordFailure(rawEmail);
      return res
        .status(400)
        .json({ success: false, message: "Invalid or expired OTP" });
    }

    otpFailures.delete(rawEmail);
    await prisma.otp.update({ where: { id: otp.id }, data: { verified: true } });

    if (otp.userId) {
      await prisma.user.update({
        where: { id: otp.userId },
        data: { isVerified: true },
      });
    }

    res.json({ success: true, message: "OTP verified" });
  } catch (error) {
    console.error("Verify OTP error:", error);
    res.status(500).json({ success: false, message: "Failed to verify OTP" });
  }
});

// --------------------------- Password reset ---------------------------------

app.post("/api/auth/forgot-password", async (req, res) => {
  try {
    const rawEmail = String(req.body.email || "").trim().toLowerCase();

    if (!rawEmail) {
      return res.status(400).json({ success: false, message: "Email is required" });
    }

    const user = await prisma.user.findUnique({ where: { email: rawEmail } });
    const generic = {
      success: true,
      message: "If an account exists for that email, an OTP has been sent",
    };

    if (!user) {
      // Do not reveal whether the email exists.
      return res.json(generic);
    }

    const code = await issueOtp(rawEmail, "RESET", user.id);
    res.json({ ...generic, ...devOtpField(code) });
  } catch (error) {
    console.error("Forgot password error:", error);
    res.status(500).json({ success: false, message: "Failed to process request" });
  }
});

app.post("/api/auth/reset-password", async (req, res) => {
  try {
    const rawEmail = String(req.body.email || "").trim().toLowerCase();
    const { code, newPassword } = req.body;

    if (!rawEmail || !code || !newPassword) {
      return res.status(400).json({
        success: false,
        message: "Email, code and newPassword are required",
      });
    }

    const otp = await prisma.otp.findFirst({
      where: {
        email: rawEmail,
        code: String(code).trim(),
        purpose: "RESET",
        verified: false,
        expiresAt: { gte: new Date() },
      },
      orderBy: { createdAt: "desc" },
    });

    const user = await prisma.user.findUnique({ where: { email: rawEmail } });

    if (!otp || !user) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid or expired OTP" });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    await prisma.user.update({
      where: { id: user.id },
      data: { password: hashedPassword },
    });

    // Invalidate the OTP after a successful reset.
    await prisma.otp.update({ where: { id: otp.id }, data: { verified: true } });

    res.json({ success: true, message: "Password reset successful" });
  } catch (error) {
    console.error("Reset password error:", error);
    res.status(500).json({ success: false, message: "Failed to reset password" });
  }
});

// ----------------------------- Auth guards --------------------------------

function verifyRole(req, res, next, expectedRole) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;

  if (!token) {
    return res
      .status(401)
      .json({ success: false, message: "Not authenticated" });
  }

  try {
    const payload = jwt.verify(token, JWT_SECRET);

    if (payload.role !== expectedRole) {
      return res
        .status(403)
        .json({ success: false, message: `${expectedRole.toLowerCase()} access only` });
    }

    req.userId = payload.userId;
    req.role = payload.role;
    next();
  } catch (error) {
    return res
      .status(401)
      .json({ success: false, message: "Invalid or expired token" });
  }
}

function requireStudent(req, res, next) {
  return verifyRole(req, res, next, "STUDENT");
}

function requireTeacher(req, res, next) {
  return verifyRole(
    req,
    res,
    () => {
      const approved = isTeacherApproved(req.userId, inMemoryUsers.get(req.userId));
      if (!approved) {
        const app = getApplicationByUserId(req.userId);
        if (app && app.status === APPLICATION_STATUS.REJECTED) {
          return res.status(403).json({
            success: false,
            code: "TEACHER_APPROVAL_REJECTED",
            message: "Your teacher application was rejected. Please review feedback and resubmit.",
            rejectionReason: app.rejectionReason || null,
          });
        }
        return res.status(403).json({
          success: false,
          code: "TEACHER_APPROVAL_PENDING",
          message: "Your teacher application is pending admin review. Teaching tools and publishing are locked until approved.",
        });
      }
      next();
    },
    "TEACHER"
  );
}

// General JWT auth: verifies the Bearer token and attaches userId + role.
function authenticate(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;

  if (!token) {
    return res
      .status(401)
      .json({ success: false, message: "Not authenticated" });
  }

  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.userId = payload.userId || payload.id;
    req.role = payload.role;
    next();
  } catch (error) {
    return res
      .status(401)
      .json({ success: false, message: "Invalid or expired token" });
  }
}

// Role gate built on authenticate.
function requireRole(...roles) {
  return (req, res, next) =>
    authenticate(req, res, () => {
      if (!roles.includes(req.role)) {
        return res.status(403).json({ success: false, message: "Forbidden" });
      }
      if (req.role === "TEACHER" && !roles.includes("ADMIN")) {
        const approved = isTeacherApproved(req.userId, inMemoryUsers.get(req.userId));
        if (!approved) {
          const app = getApplicationByUserId(req.userId);
          if (app && app.status === APPLICATION_STATUS.REJECTED) {
            return res.status(403).json({
              success: false,
              code: "TEACHER_APPROVAL_REJECTED",
              message: "Your teacher application was rejected. Please review feedback and resubmit.",
              rejectionReason: app.rejectionReason || null,
            });
          }
          return res.status(403).json({
            success: false,
            code: "TEACHER_APPROVAL_PENDING",
            message: "Your teacher application is pending admin review. Teaching tools and publishing are locked until approved.",
          });
        }
      }
      next();
    });
}

// ------------------------- Student MVP endpoints --------------------------
// Data-driven: Board -> Grade (Class) -> Subject -> Chapter -> Topic.
// Nothing here is hardcoded to a specific board/class/subject.

const ATTEMPT_MODES = ["PLAY", "PRACTICE", "TEST", "RETEST"];

app.get("/api/student/boards", requireStudent, async (req, res) => {
  try {
    const type = req.query.type;
    if (!process.env.MONGODB_URI) {
      return res.json({ success: true, boards: getFallbackBoards(type) });
    }
    const where = type ? { type } : {};
    let boards = [];
    try {
      boards = await prisma.board.findMany({ where, orderBy: { name: "asc" } });
    } catch {
      boards = [];
    }
    if (!boards || boards.length === 0) {
      return res.json({ success: true, boards: getFallbackBoards(type) });
    }
    res.json({ success: true, boards });
  } catch (error) {
    console.warn("Boards DB query fallback:", error.message);
    res.json({ success: true, boards: getFallbackBoards(req.query.type) });
  }
});

app.get("/api/student/classes", requireStudent, async (req, res) => {
  try {
    const boardId = req.query.boardId;
    const type = req.query.type;
    if (!process.env.MONGODB_URI) {
      return res.json({ success: true, classes: getFallbackClasses(boardId, type) });
    }
    const where = boardId ? { subjects: { some: { boardId } } } : {};
    let classes = [];
    try {
      classes = await prisma.grade.findMany({
        where,
        orderBy: { name: "asc" },
      });
    } catch {
      classes = [];
    }
    if (!classes || classes.length === 0) {
      return res.json({ success: true, classes: getFallbackClasses(boardId, type) });
    }
    res.json({ success: true, classes });
  } catch (error) {
    console.warn("Classes DB query fallback:", error.message);
    res.json({ success: true, classes: getFallbackClasses(req.query.boardId, req.query.type) });
  }
});

app.get("/api/student/diploma/meta", requireStudent, (req, res) => {
  try {
    res.json({ success: true, ...getFallbackDiplomaMeta() });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.get("/api/student/subjects", requireStudent, async (req, res) => {
  try {
    const boardId = req.query.boardId;
    const gradeId = req.query.gradeId;
    const branch = req.query.branch;
    const semester = req.query.semester;
    if (!process.env.MONGODB_URI) {
      return res.json({
        success: true,
        subjects: getFallbackSubjects(boardId, gradeId, branch, semester),
      });
    }
    const where = {};
    if (boardId) where.boardId = boardId;
    if (gradeId) where.gradeId = gradeId;

    let subjects = [];
    try {
      subjects = await prisma.subject.findMany({
        where,
        orderBy: { name: "asc" },
        include: {
          _count: { select: { chapters: true } },
          board: { select: { name: true } },
          grade: { select: { name: true } },
        },
      });
    } catch {
      subjects = [];
    }
    if (!subjects || subjects.length === 0) {
      return res.json({
        success: true,
        subjects: getFallbackSubjects(boardId, gradeId, branch, semester),
      });
    }
    res.json({ success: true, subjects });
  } catch (error) {
    console.warn("Subjects DB query fallback:", error.message);
    res.json({
      success: true,
      subjects: getFallbackSubjects(req.query.boardId, req.query.gradeId, req.query.branch, req.query.semester),
    });
  }
});

// Student Learn selection persistence & restoration
app.post("/api/student/learn/selection", requireStudent, async (req, res) => {
  try {
    const result = validateCurriculumSelection(req.body);
    if (!result.valid) {
      return res.status(400).json({ success: false, message: result.message });
    }

    inMemoryStudentSelections.set(req.userId, result.selection);

    res.json({
      success: true,
      selection: result.selection,
      message: "Curriculum selection saved successfully",
    });
  } catch (error) {
    console.error("Save selection error:", error);
    res.status(500).json({ success: false, message: "Failed to save curriculum selection" });
  }
});

app.get("/api/student/learn/selection", requireStudent, async (req, res) => {
  try {
    const selection = inMemoryStudentSelections.get(req.userId) || null;
    res.json({ success: true, selection });
  } catch (error) {
    console.error("Get selection error:", error);
    res.status(500).json({ success: false, message: "Failed to load saved curriculum selection" });
  }
});

app.get("/api/student/chapters", requireStudent, async (req, res) => {
  try {
    const subjectId = req.query.subjectId;
    if (!subjectId) {
      return res
        .status(400)
        .json({ success: false, message: "subjectId is required" });
    }
    if (!process.env.MONGODB_URI) {
      return res.json({ success: true, chapters: getFallbackChapters(subjectId) });
    }
    const chapters = await prisma.chapter.findMany({
      where: { subjectId },
      orderBy: { id: "asc" },
      include: { _count: { select: { topics: true } } },
    });
    if (!chapters || chapters.length === 0) {
      return res.json({ success: true, chapters: getFallbackChapters(subjectId) });
    }
    res.json({ success: true, chapters });
  } catch (error) {
    console.warn("Chapters DB query fallback:", error.message);
    res.json({ success: true, chapters: getFallbackChapters(req.query.subjectId) });
  }
});

app.get("/api/student/topics", requireStudent, async (req, res) => {
  try {
    const chapterId = req.query.chapterId;
    if (!chapterId) {
      return res
        .status(400)
        .json({ success: false, message: "chapterId is required" });
    }
    if (!process.env.MONGODB_URI) {
      return res.json({ success: true, topics: getFallbackTopics(chapterId) });
    }
    const topics = await prisma.topic.findMany({
      where: { chapterId },
      orderBy: { id: "asc" },
      include: { _count: { select: { questions: true, contents: true } } },
    });
    if (!topics || topics.length === 0) {
      return res.json({ success: true, topics: getFallbackTopics(chapterId) });
    }
    res.json({ success: true, topics });
  } catch (error) {
    console.warn("Topics DB query fallback:", error.message);
    res.json({ success: true, topics: getFallbackTopics(req.query.chapterId) });
  }
});

app.get("/api/student/content", requireStudent, async (req, res) => {
  try {
    const topicId = req.query.topicId;
    if (!topicId) {
      return res
        .status(400)
        .json({ success: false, message: "topicId is required" });
    }

    if (!process.env.MONGODB_URI) {
      const contents = getFallbackContent(topicId);
      const studentCompleted = inMemoryCompletedContent.get(req.userId) || [];
      return res.json({
        success: true,
        contents,
        completedIds: studentCompleted.filter((id) => contents.some((c) => c.id === id)),
      });
    }

    const contents = await prisma.learningContent.findMany({
      where: { topicId, status: "PUBLISHED" },
      orderBy: { order: "asc" },
      select: { id: true, topicId: true, title: true, body: true, order: true },
    });

    const progress = await prisma.studentProgress.findMany({
      where: {
        userId: req.userId,
        contentId: { in: contents.map((c) => c.id) },
      },
      select: { contentId: true },
    });

    const completedIds = progress.map((p) => p.contentId);
    // Also include any session-completed content
    const inMemList = inMemoryCompletedContent.get(req.userId) || [];
    for (const memId of inMemList) {
      if (!completedIds.includes(memId)) completedIds.push(memId);
    }

    res.json({
      success: true,
      contents,
      completedIds,
    });
  } catch (error) {
    console.warn("Content DB query fallback:", error.message);
    const contents = getFallbackContent(req.query.topicId);
    const studentCompleted = inMemoryCompletedContent.get(req.userId) || [];
    res.json({
      success: true,
      contents,
      completedIds: studentCompleted.filter((id) => contents.some((c) => c.id === id)),
    });
  }
});

app.get("/api/student/questions", requireStudent, async (req, res) => {
  try {
    const topicId = req.query.topicId;
    const limit = Math.min(Number(req.query.limit) || 10, 30);
    if (!topicId) {
      return res
        .status(400)
        .json({ success: false, message: "topicId is required" });
    }

    if (!process.env.MONGODB_URI) {
      return res.json({ success: true, questions: getFallbackQuestions(topicId, limit) });
    }

    // The correct answer is never sent to the client.
    const questions = await prisma.question.findMany({
      where: { topicId, status: "PUBLISHED" },
      take: limit,
      select: {
        id: true,
        text: true,
        optionA: true,
        optionB: true,
        optionC: true,
        optionD: true,
      },
    });

    if (!questions || questions.length === 0) {
      return res.json({ success: true, questions: getFallbackQuestions(topicId, limit) });
    }

    res.json({ success: true, questions });
  } catch (error) {
    console.warn("Questions DB query fallback:", error.message);
    res.json({
      success: true,
      questions: getFallbackQuestions(req.query.topicId, Number(req.query.limit) || 10),
    });
  }
});

// Immediate feedback for Play mode (single question).
app.post("/api/student/check", requireStudent, async (req, res) => {
  try {
    const { questionId, selected } = req.body;
    let question = null;

    if (process.env.MONGODB_URI) {
      try {
        question = await prisma.question.findUnique({
          where: { id: String(questionId) },
        });
      } catch (err) {
        console.warn("Question check DB query fallback:", err.message);
      }
    }

    if (!question) {
      question = getFallbackQuestionById(questionId);
    }

    if (!question) {
      return res
        .status(404)
        .json({ success: false, message: "Question not found" });
    }
    res.json({
      success: true,
      correct: Number(selected) === question.correct,
      correctIndex: question.correct,
      explanation: question.explanation,
    });
  } catch (error) {
    console.error("Check error:", error);
    res.status(500).json({ success: false, message: "Failed to check answer" });
  }
});

// Server-side grading; the client never decides the score.
// Server-side grading; the client never decides the score.
app.post("/api/student/attempts", requireStudent, async (req, res) => {
  try {
    const { topicId, mode, answers } = req.body;

    if (!ATTEMPT_MODES.includes(mode)) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid attempt mode" });
    }
    if (!Array.isArray(answers) || answers.length === 0) {
      return res
        .status(400)
        .json({ success: false, message: "answers are required" });
    }

    // 1. Deduplicate answers by questionId to prevent answer replay / scoring exploits
    const seen = new Set();
    const cleanAnswers = [];
    for (const a of answers) {
      const qId = String(a.questionId || "").trim();
      if (qId && !seen.has(qId)) {
        seen.add(qId);
        cleanAnswers.push({
          questionId: qId,
          selected: typeof a.selected === "number" ? a.selected : -1,
        });
      }
    }

    if (cleanAnswers.length === 0) {
      return res.status(400).json({ success: false, message: "Valid answers are required" });
    }

    // 2. Fetch Topic Metadata (DB or in-memory fallback)
    let topic = null;
    if (process.env.MONGODB_URI && isMongoId(String(topicId))) {
      try {
        topic = await prisma.topic.findUnique({
          where: { id: String(topicId) },
          include: { chapter: { select: { id: true, name: true } } },
        });
      } catch (err) {
        console.warn("Topic lookup DB query fallback:", err.message);
      }
    }
    if (!topic) {
      topic = getFallbackTopicById(topicId);
    }

    const topicMeta = {
      id: String(topicId),
      name: topic ? topic.name : `Topic ${topicId}`,
      chapter: {
        id: topic && topic.chapterId ? String(topic.chapterId) : "chap_1",
        name: topic && (topic.chapterName || (topic.chapter && topic.chapter.name))
          ? (topic.chapterName || topic.chapter.name)
          : "Chapter",
      },
    };

    // 3. Retrieve Questions (DB with fallback)
    let questions = [];
    if (process.env.MONGODB_URI && isMongoId(String(topicId))) {
      try {
        const mongoQIds = cleanAnswers.map((a) => a.questionId).filter(isMongoId);
        if (mongoQIds.length > 0) {
          questions = await prisma.question.findMany({
            where: {
              topicId: String(topicId),
              id: { in: mongoQIds },
            },
          });
        }
      } catch (err) {
        console.warn("Questions attempt DB query fallback:", err.message);
      }
    }

    // Combine with in-memory fallback questions
    const byId = new Map(questions.map((q) => [String(q.id), q]));
    for (const a of cleanAnswers) {
      if (!byId.has(String(a.questionId))) {
        const fbQ = getFallbackQuestionById(a.questionId);
        if (fbQ) byId.set(String(fbQ.id), fbQ);
      }
    }

    // 4. Grade Answers
    let correctCount = 0;
    const perQuestion = cleanAnswers.map((a) => {
      const question = byId.get(String(a.questionId));
      const correctIndex = question ? question.correct : null;
      const wasCorrect =
        question !== undefined && Number(a.selected) === question.correct;
      if (wasCorrect) correctCount += 1;
      return {
        questionId: String(a.questionId),
        selected: Number(a.selected),
        correctIndex,
        wasCorrect,
        explanation: question ? question.explanation : null,
      };
    });

    const total = perQuestion.length;
    const score = total > 0 ? Math.round((correctCount / total) * 10000) / 100 : 0;

    // 5. XP Award Calculation & Anti-Replay Check
    // Standard: 10 XP per correct question
    // Passing bonus: +15 XP if score >= 60%
    // Perfect bonus: +10 XP if score === 100%
    // Cap at 100 XP per attempt
    let awardedXp = correctCount * 10;
    if (score >= 60) awardedXp += 15;
    if (score === 100) awardedXp += 10;
    awardedXp = Math.min(awardedXp, 100);

    // Replay / Rapid Duplicate Prevention (within 30 seconds)
    const submissionSig = `${req.userId}:${topicId}:${cleanAnswers.map((a) => `${a.questionId}:${a.selected}`).join(",")}`;
    const now = Date.now();
    const recent = recentAttemptSubmissions.get(submissionSig);
    let isDuplicate = false;
    if (recent && (now - recent.timestamp) < 30000) {
      awardedXp = 0; // Zero duplicate XP
      isDuplicate = true;
    } else {
      recentAttemptSubmissions.set(submissionSig, { timestamp: now, score });
      if (recentAttemptSubmissions.size > 1000) {
        for (const [k, v] of recentAttemptSubmissions.entries()) {
          if (now - v.timestamp > 60000) recentAttemptSubmissions.delete(k);
        }
      }
    }

    let totalXp = (inMemoryUserXp.get(req.userId) || 0) + awardedXp;
    inMemoryUserXp.set(req.userId, totalXp);

    // 6. Record Attempt
    const attemptRecord = {
      id: `att_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      userId: req.userId,
      topicId: String(topicId),
      mode,
      correct: correctCount,
      total,
      score,
      xp: awardedXp,
      createdAt: new Date().toISOString(),
      topic: topicMeta,
    };
    inMemoryAttempts.unshift(attemptRecord);

    if (process.env.MONGODB_URI && isMongoId(req.userId) && isMongoId(String(topicId))) {
      try {
        const dbAttempt = await prisma.attempt.create({
          data: {
            userId: req.userId,
            topicId: String(topicId),
            mode,
            correct: correctCount,
            total,
            score,
          },
          include: {
            topic: {
              select: {
                id: true,
                name: true,
                chapter: { select: { id: true, name: true } },
              },
            },
          },
        });
        if (dbAttempt) {
          attemptRecord.id = dbAttempt.id;
          if (dbAttempt.topic) attemptRecord.topic = dbAttempt.topic;
        }
        if (awardedXp > 0) {
          const updatedUser = await prisma.user.update({
            where: { id: req.userId },
            data: { xp: { increment: awardedXp } },
            select: { xp: true },
          });
          if (updatedUser && typeof updatedUser.xp === "number") {
            totalXp = updatedUser.xp;
          }
        }
      } catch (dbErr) {
        console.warn("Prisma attempt create fallback:", dbErr.message);
      }
    }

    res.status(201).json({
      success: true,
      attempt: attemptRecord,
      perQuestion,
      xp: awardedXp,
      totalXp,
      isDuplicate,
    });
  } catch (error) {
    console.error("Attempt error:", error);
    res.status(500).json({ success: false, message: "Failed to save attempt" });
  }
});

app.get("/api/student/results", requireStudent, async (req, res) => {
  try {
    let dbAttempts = [];
    if (process.env.MONGODB_URI && isMongoId(req.userId)) {
      try {
        dbAttempts = await prisma.attempt.findMany({
          where: { userId: req.userId },
          orderBy: { createdAt: "desc" },
          take: 30,
          include: {
            topic: {
              select: {
                id: true,
                name: true,
                chapter: { select: { id: true, name: true } },
              },
            },
          },
        });
      } catch (dbErr) {
        console.warn("Prisma results query fallback:", dbErr.message);
      }
    }

    const memAttempts = inMemoryAttempts.filter((a) => a.userId === req.userId);
    const seenIds = new Set();
    const merged = [];

    for (const a of [...memAttempts, ...dbAttempts]) {
      const attId = String(a.id);
      if (!seenIds.has(attId)) {
        seenIds.add(attId);
        // Ensure topic metadata is filled
        let tMeta = a.topic;
        if (!tMeta || !tMeta.name) {
          const fbTopic = getFallbackTopicById(a.topicId);
          tMeta = {
            id: String(a.topicId),
            name: fbTopic ? fbTopic.name : `Topic ${a.topicId}`,
            chapter: {
              id: fbTopic && fbTopic.chapterId ? String(fbTopic.chapterId) : "chap_1",
              name: fbTopic && (fbTopic.chapterName || (fbTopic.chapter && fbTopic.chapter.name))
                ? (fbTopic.chapterName || fbTopic.chapter.name)
                : "Chapter",
            },
          };
        }
        merged.push({
          id: a.id,
          userId: a.userId,
          topicId: a.topicId,
          mode: a.mode,
          correct: a.correct,
          total: a.total,
          score: a.score,
          createdAt: a.createdAt,
          topic: tMeta,
        });
      }
    }

    merged.sort((x, y) => new Date(y.createdAt).getTime() - new Date(x.createdAt).getTime());

    res.json({ success: true, attempts: merged.slice(0, 30) });
  } catch (error) {
    console.error("Results error:", error);
    res.status(500).json({ success: false, message: "Failed to load results" });
  }
});

// Weak topics calculation:
// Threshold rule: score < 60 is weak; score >= 60 is competent/mastered.
// Distinguishes initial vs retest attempts and computes improvement.
app.get("/api/student/weak-topics", requireStudent, async (req, res) => {
  try {
    let dbAttempts = [];
    if (process.env.MONGODB_URI && isMongoId(req.userId)) {
      try {
        dbAttempts = await prisma.attempt.findMany({
          where: { userId: req.userId },
          orderBy: { createdAt: "desc" },
          include: {
            topic: {
              select: {
                id: true,
                name: true,
                chapter: { select: { id: true, name: true } },
              },
            },
          },
        });
      } catch (dbErr) {
        console.warn("Prisma weak topics query fallback:", dbErr.message);
      }
    }

    const memAttempts = inMemoryAttempts.filter((a) => a.userId === req.userId);
    const seenIds = new Set();
    const allAttempts = [];

    for (const a of [...memAttempts, ...dbAttempts]) {
      const attId = String(a.id);
      if (!seenIds.has(attId)) {
        seenIds.add(attId);
        let tMeta = a.topic;
        if (!tMeta || !tMeta.name) {
          const fbTopic = getFallbackTopicById(a.topicId);
          tMeta = {
            id: String(a.topicId),
            name: fbTopic ? fbTopic.name : `Topic ${a.topicId}`,
            chapter: {
              id: fbTopic && fbTopic.chapterId ? String(fbTopic.chapterId) : "chap_1",
              name: fbTopic && (fbTopic.chapterName || (fbTopic.chapter && fbTopic.chapter.name))
                ? (fbTopic.chapterName || fbTopic.chapter.name)
                : "Chapter",
            },
          };
        }
        allAttempts.push({ ...a, topic: tMeta });
      }
    }

    // Only assess valid assessment modes (TEST, PRACTICE, RETEST) - ignore ungrounded quick play
    const validAttempts = allAttempts.filter((a) => a.mode !== "PLAY");

    // Group chronologically by topicId
    const byTopic = new Map();
    for (const a of validAttempts) {
      const tId = String(a.topicId);
      if (!byTopic.has(tId)) byTopic.set(tId, []);
      byTopic.get(tId).push(a);
    }

    const weakTopics = [];
    const resolvedWeakTopics = [];

    for (const [tId, attempts] of byTopic.entries()) {
      // Sort oldest to newest
      attempts.sort((x, y) => new Date(x.createdAt).getTime() - new Date(y.createdAt).getTime());
      const initialAttempt = attempts[0];
      const latestAttempt = attempts[attempts.length - 1];
      const improvement = Math.round((latestAttempt.score - initialAttempt.score) * 100) / 100;
      const retests = attempts.filter((a) => a.mode === "RETEST");

      if (latestAttempt.score < 60) {
        // Active weak topic
        weakTopics.push({
          topicId: tId,
          topicName: latestAttempt.topic.name,
          chapterName: latestAttempt.topic.chapter ? latestAttempt.topic.chapter.name : "Chapter",
          score: latestAttempt.score,
          initialScore: initialAttempt.score,
          improvement,
          attemptsCount: attempts.length,
          hasRetested: retests.length > 0,
          action: latestAttempt.mode === "PRACTICE" || latestAttempt.mode === "RETEST" ? "Retest" : "Practice",
        });
      } else if (initialAttempt.score < 60 && latestAttempt.score >= 60) {
        // Improved from weak to mastered!
        resolvedWeakTopics.push({
          topicId: tId,
          topicName: latestAttempt.topic.name,
          chapterName: latestAttempt.topic.chapter ? latestAttempt.topic.chapter.name : "Chapter",
          initialScore: initialAttempt.score,
          latestScore: latestAttempt.score,
          improvement,
          attemptsCount: attempts.length,
          masteredAt: latestAttempt.createdAt,
        });
      }
    }

    res.json({ success: true, weakTopics, resolvedWeakTopics });
  } catch (error) {
    console.error("Weak topics error:", error);
    res.status(500).json({ success: false, message: "Failed to load weak topics" });
  }
});

app.post("/api/student/progress", requireStudent, async (req, res) => {
  try {
    const { contentId } = req.body;
    if (!contentId) {
      return res.status(400).json({ success: false, message: "contentId is required" });
    }

    const cId = String(contentId);
    let list = inMemoryCompletedContent.get(req.userId) || [];
    if (!list.includes(cId)) {
      list.push(cId);
      inMemoryCompletedContent.set(req.userId, list);
    }

    if (process.env.MONGODB_URI && isMongoId(req.userId) && isMongoId(cId)) {
      try {
        const content = await prisma.learningContent.findUnique({
          where: { id: cId },
        });
        if (content) {
          await prisma.studentProgress.upsert({
            where: {
              userId_contentId: { userId: req.userId, contentId: cId },
            },
            update: {},
            create: { userId: req.userId, contentId: cId },
          });
        }
      } catch (dbErr) {
        console.warn("Prisma student progress upsert fallback:", dbErr.message);
      }
    }

    res.json({ success: true, message: "Progress saved", contentId: cId });
  } catch (error) {
    console.error("Progress error:", error);
    res.status(500).json({ success: false, message: "Failed to save progress" });
  }
});

// Comprehensive progress endpoint returning lesson completion, test metrics, XP and subject completion
app.get("/api/student/progress", requireStudent, async (req, res) => {
  try {
    let completedIds = inMemoryCompletedContent.get(req.userId) || [];
    let totalContent = 0;

    if (process.env.MONGODB_URI) {
      try {
        const [dbCount, dbTotal, dbCompleted] = await Promise.all([
          isMongoId(req.userId) ? prisma.studentProgress.count({ where: { userId: req.userId } }) : 0,
          prisma.learningContent.count({ where: { status: "PUBLISHED" } }),
          isMongoId(req.userId) ? prisma.studentProgress.findMany({ where: { userId: req.userId }, select: { contentId: true } }) : [],
        ]);
        totalContent = dbTotal;
        for (const row of dbCompleted) {
          if (!completedIds.includes(row.contentId)) completedIds.push(row.contentId);
        }
      } catch (dbErr) {
        console.warn("Prisma progress query fallback:", dbErr.message);
      }
    }

    if (totalContent === 0) {
      totalContent = 20; // Fallback baseline content catalogue
    }

    // Collect attempts for student
    const studentAttempts = inMemoryAttempts.filter((a) => a.userId === req.userId);
    if (process.env.MONGODB_URI && isMongoId(req.userId)) {
      try {
        const dbAttempts = await prisma.attempt.findMany({ where: { userId: req.userId } });
        for (const da of dbAttempts) {
          if (!studentAttempts.some((sa) => String(sa.id) === String(da.id))) {
            studentAttempts.push(da);
          }
        }
      } catch {}
    }

    const totalAttempts = studentAttempts.length;
    const averageScore =
      totalAttempts > 0
        ? Math.round(studentAttempts.reduce((acc, a) => acc + a.score, 0) / totalAttempts)
        : 0;

    // Group valid assessments by topic to compute weak and mastered counts
    const validAttempts = studentAttempts.filter((a) => a.mode !== "PLAY");
    const byTopic = new Map();
    for (const a of validAttempts) {
      const tId = String(a.topicId);
      if (!byTopic.has(tId)) byTopic.set(tId, []);
      byTopic.get(tId).push(a);
    }

    let weakTopicsCount = 0;
    let masteredTopicsCount = 0;
    for (const [, tAttempts] of byTopic.entries()) {
      tAttempts.sort((x, y) => new Date(x.createdAt).getTime() - new Date(y.createdAt).getTime());
      const latest = tAttempts[tAttempts.length - 1];
      if (latest.score < 60) {
        weakTopicsCount += 1;
      } else {
        masteredTopicsCount += 1;
      }
    }

    const xp = inMemoryUserXp.get(req.userId) || 0;

    res.json({
      success: true,
      completedCount: completedIds.length,
      totalContent: Math.max(totalContent, completedIds.length),
      totalAttempts,
      averageScore,
      xp,
      weakTopicsCount,
      masteredTopicsCount,
    });
  } catch (error) {
    console.error("Progress error:", error);
    res.status(500).json({ success: false, message: "Failed to load progress" });
  }
});

// ------------------- Teacher content-pipeline foundation --------------------
// Metadata-only today. Real file storage + AI processing plug in later via the
// MaterialStatus / ContentStatus workflow. AI/teacher content is never
// auto-published: it starts as a draft for teacher review.

const MATERIAL_STATUSES = ["UPLOADED", "PROCESSING", "ANALYZED", "READY", "FAILED"];
const CONTENT_STATUSES = ["DRAFT", "PENDING_REVIEW", "PUBLISHED"];
const CONTENT_SOURCES = ["TEACHER", "UPLOADED", "AI"];

// -------------------- Teacher Identity & Applications -----------------------
const documentUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024 + 1024,
    files: 1,
  },
});

const privateDocsDir = path.resolve(__dirname, "storage", "documents");
if (!fs.existsSync(privateDocsDir)) {
  fs.mkdirSync(privateDocsDir, { recursive: true, mode: 0o750 });
}

// Teacher retrieves their current application details and status
app.get("/api/teacher/application", authenticate, async (req, res) => {
  if (req.role !== "TEACHER" && req.role !== "ADMIN") {
    return res.status(403).json({ success: false, message: "Teacher access only" });
  }

  let application = getApplicationByUserId(req.userId);
  if (!application) {
    let user = null;
    if (process.env.MONGODB_URI) {
      try {
        user = await prisma.user.findUnique({ where: { id: req.userId } });
      } catch {}
    }
    if (!user) user = inMemoryUsers.get(req.userId);
    application = createPendingTeacherApplication(user || { id: req.userId });
  }

  res.json({ success: true, application });
});

// Teacher submits or corrects/resubmits their application
app.post("/api/teacher/application", authenticate, async (req, res) => {
  if (req.role !== "TEACHER") {
    return res.status(403).json({ success: false, message: "Teacher access only" });
  }

  const { name, avatarUrl, qualifications, subjects, institution, experience, documents } = req.body;
  if (!name || !String(name).trim()) {
    return res.status(400).json({ success: false, message: "Legal full name is required." });
  }

  let user = null;
  if (process.env.MONGODB_URI) {
    try {
      user = await prisma.user.findUnique({ where: { id: req.userId } });
    } catch {}
  }
  if (!user) user = inMemoryUsers.get(req.userId);

  const updatedApp = saveTeacherApplication(
    req.userId,
    {
      name,
      avatarUrl,
      qualifications,
      subject: subjects,
      school: institution,
      experience,
      documents,
    },
    user
  );

  const updateData = {
    name: String(name).trim(),
    school: institution ? String(institution).trim() : null,
    subject: subjects ? String(subjects).trim() : null,
    isVerified: false,
  };
  if (avatarUrl) updateData.avatarUrl = avatarUrl;

  if (process.env.MONGODB_URI) {
    try {
      await prisma.user.update({
        where: { id: req.userId },
        data: updateData,
      });
    } catch {}
  }
  if (user) {
    Object.assign(user, updateData);
    inMemoryUsers.set(req.userId, user);
  }

  res.json({
    success: true,
    message: "Teacher application submitted for admin review.",
    application: updatedApp,
  });
});

// Teacher uploads a supporting document (PDF, DOCX, PNG, JPG)
app.post("/api/teacher/application/document", authenticate, (req, res) => {
  if (req.role !== "TEACHER") {
    return res.status(403).json({ success: false, message: "Teacher access only" });
  }

  documentUpload.single("document")(req, res, async (err) => {
    if (err) {
      if (err instanceof multer.MulterError && err.code === "LIMIT_FILE_SIZE") {
        return res.status(400).json({ success: false, message: "Document exceeds 10MB limit." });
      }
      return res.status(400).json({ success: false, message: err.message || "Document upload failed." });
    }

    if (!req.file) {
      return res.status(400).json({ success: false, message: "No document file provided." });
    }

    const validation = validateTeacherDocument(req.file);
    if (!validation.valid) {
      return res.status(400).json({ success: false, message: validation.error });
    }

    try {
      const ext = validation.extension;
      const safeFilename = `doc-${crypto.randomUUID()}${ext}`;
      const filePath = path.resolve(privateDocsDir, safeFilename);

      await fs.promises.writeFile(filePath, req.file.buffer);

      const docMeta = {
        id: `doc-${crypto.randomUUID()}`,
        filename: safeFilename,
        originalName: req.file.originalname,
        mimeType: req.file.mimetype || "application/octet-stream",
        size: req.file.buffer.length,
        url: `/api/teacher/documents/${safeFilename}`,
        uploadedAt: new Date().toISOString(),
      };

      addDocumentToApplication(req.userId, docMeta);

      res.status(201).json({
        success: true,
        message: "Document uploaded successfully",
        document: docMeta,
      });
    } catch (saveErr) {
      console.error("Document save error:", saveErr);
      res.status(500).json({ success: false, message: "Failed to save supporting document." });
    }
  });
});

// Secure document viewing endpoint (Restricted to applicant or ADMIN)
app.get("/api/teacher/documents/:filename", authenticate, async (req, res) => {
  try {
    const rawFilename = path.basename(req.params.filename);
    if (!rawFilename || rawFilename.includes("..")) {
      return res.status(400).json({ success: false, message: "Invalid filename" });
    }

    const allApps = listTeacherApplications({ status: "ALL" });
    const ownerApp = allApps.find(
      (a) => a.documents && a.documents.some((d) => d.filename === rawFilename)
    );

    if (!ownerApp) {
      return res.status(404).json({ success: false, message: "Document not found" });
    }

    if (req.role !== "ADMIN" && ownerApp.userId !== req.userId) {
      return res.status(403).json({
        success: false,
        message: "Access denied. Supporting documents are confidential and restricted to the applicant and administrators.",
      });
    }

    const filePath = path.resolve(privateDocsDir, rawFilename);
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ success: false, message: "Document file not found on disk" });
    }

    const doc = ownerApp.documents.find((d) => d.filename === rawFilename);
    res.setHeader("Content-Type", doc?.mimeType || "application/octet-stream");
    res.setHeader("Content-Disposition", `inline; filename="${doc?.originalName || rawFilename}"`);
    const stream = fs.createReadStream(filePath);
    stream.pipe(res);
  } catch (err) {
    console.error("Document read error:", err);
    res.status(500).json({ success: false, message: "Failed to read document" });
  }
});

const { createTeacherMaterialsRouter } = require("./routes/teacher-materials");
app.use("/api/teacher", createTeacherMaterialsRouter(prisma, requireTeacher));

const { createTeacherLessonsRouter } = require("./routes/teacher-lessons");
app.use("/api/teacher", createTeacherLessonsRouter(prisma, requireTeacher));

const { createTeacherAssessmentsRouter } = require("./routes/teacher-assessments");
app.use("/api/teacher", createTeacherAssessmentsRouter(prisma, requireTeacher));

const { createTeacherPublishingRouter } = require("./routes/teacher-publishing");
app.use("/api/teacher", createTeacherPublishingRouter(prisma, requireTeacher));

// Time-limited class access codes (teacher creates one code; students open all published material)
const { createTeacherClassCodesRouter, createStudentClassAccessRouter } = require("./routes/class-codes");
app.use("/api/teacher", createTeacherClassCodesRouter(prisma, requireTeacher));
app.use("/api/student/access/class", createStudentClassAccessRouter(prisma));

const { createStudentAccessRouter } = require("./routes/student-access");
app.use("/api/student/access", createStudentAccessRouter(prisma));

app.get("/api/teacher/content", requireTeacher, async (req, res) => {
  try {
    const where = { authorId: req.userId };
    if (req.query.status && CONTENT_STATUSES.includes(req.query.status)) {
      where.status = req.query.status;
    }
    const content = await prisma.learningContent.findMany({
      where,
      orderBy: { id: "desc" },
      include: {
        topic: {
          select: { name: true, chapter: { select: { name: true } } },
        },
      },
    });
    res.json({ success: true, content });
  } catch (error) {
    console.error("Teacher content error:", error);
    res.status(500).json({ success: false, message: "Failed to load content" });
  }
});

app.post("/api/teacher/content", requireTeacher, async (req, res) => {
  try {
    const { topicId, title, body, source, status, order } = req.body;

    if (!topicId || !title || !body) {
      return res.status(400).json({
        success: false,
        message: "topicId, title and body are required",
      });
    }

    const topic = await prisma.topic.findUnique({
      where: { id: String(topicId) },
    });
    if (!topic) {
      return res
        .status(404)
        .json({ success: false, message: "Topic not found" });
    }

    const content = await prisma.learningContent.create({
      data: {
        topicId: String(topicId),
        title,
        body,
        order: order !== undefined ? Number(order) : 0,
        source: CONTENT_SOURCES.includes(source) ? source : "TEACHER",
        // Never auto-publish: new content awaits teacher review.
        status: CONTENT_STATUSES.includes(status) ? status : "DRAFT",
        authorId: req.userId,
      },
    });

    res.status(201).json({ success: true, content });
  } catch (error) {
    console.error("Teacher content create error:", error);
    res.status(500).json({ success: false, message: "Failed to save content" });
  }
});

// ------------------------------- Courses ------------------------------------
// Only an authenticated TEACHER can create a course; teacherId always comes
// from the JWT, never the request body. Any authenticated user can view.

app.post("/api/courses", requireRole("TEACHER"), async (req, res) => {
  try {
    const { title, description, subject, board, price } = req.body;

    if (!title || !description || !subject || !board) {
      return res.status(400).json({
        success: false,
        message: "title, description, subject and board are required",
      });
    }

    const course = await prisma.course.create({
      data: {
        title,
        description,
        subject,
        board,
        price: price !== undefined ? Math.max(0, Number(price) || 0) : 0,
        teacherId: req.userId,
      },
    });

    res.status(201).json({ success: true, course });
  } catch (error) {
    console.error("Course create error:", error);
    res.status(500).json({ success: false, message: "Failed to create course" });
  }
});

// Edit a course — only its owning teacher (or an admin) may update it.
app.put("/api/courses/:id", authenticate, async (req, res) => {
  try {
    const course = await prisma.course.findUnique({ where: { id: req.params.id } });
    if (!course) {
      return res.status(404).json({ success: false, message: "Course not found" });
    }
    if (req.role !== "ADMIN" && course.teacherId !== req.userId) {
      return res.status(403).json({ success: false, message: "Forbidden" });
    }

    const allowed = ["title", "description", "subject", "board", "price"];
    const data = {};
    for (const key of allowed) {
      if (req.body[key] !== undefined) {
        data[key] = key === "price" ? Math.max(0, Number(req.body[key]) || 0) : req.body[key];
      }
    }

    const updated = await prisma.course.update({ where: { id: course.id }, data });
    res.json({ success: true, course: updated });
  } catch (error) {
    console.error("Course update error:", error);
    res.status(500).json({ success: false, message: "Failed to update course" });
  }
});

// A teacher's own courses.
app.get("/api/teacher/courses", requireRole("TEACHER"), async (req, res) => {
  try {
    const courses = await prisma.course.findMany({
      where: { teacherId: req.userId },
      orderBy: { createdAt: "desc" },
      include: { _count: { select: { enrollments: true } } },
    });
    res.json({ success: true, courses });
  } catch (error) {
    console.error("Teacher courses error:", error);
    res.status(500).json({ success: false, message: "Failed to load courses" });
  }
});

// Students enrolled across this teacher's courses, with a progress snapshot.
app.get("/api/teacher/students", requireRole("TEACHER"), async (req, res) => {
  try {
    const enrollments = await prisma.enrollment.findMany({
      where: { teacherId: req.userId },
      orderBy: { createdAt: "desc" },
      include: {
        student: { select: { id: true, name: true, email: true, grade: true, board: true } },
        course: { select: { id: true, title: true, subject: true } },
      },
    });

    const studentIds = [...new Set(enrollments.map((e) => e.studentId))];
    const attempts = await prisma.attempt.findMany({
      where: { userId: { in: studentIds } },
      select: { userId: true, score: true },
    });

    const byStudent = new Map();
    for (const a of attempts) {
      const list = byStudent.get(a.userId) || [];
      list.push(a.score);
      byStudent.set(a.userId, list);
    }

    const students = studentIds.map((id) => {
      const scores = byStudent.get(id) || [];
      const avg =
        scores.length > 0
          ? Math.round((scores.reduce((s, n) => s + n, 0) / scores.length) * 100) / 100
          : 0;
      const enr = enrollments.find((e) => e.studentId === id);
      return {
        id,
        name: enr?.student.name,
        email: enr?.student.email,
        grade: enr?.student.grade,
        board: enr?.student.board,
        attempts: scores.length,
        averageScore: avg,
        courses: enrollments.filter((e) => e.studentId === id).map((e) => e.course.title),
      };
    });

    res.json({ success: true, students });
  } catch (error) {
    console.error("Teacher students error:", error);
    res.status(500).json({ success: false, message: "Failed to load students" });
  }
});

app.get("/api/courses", authenticate, async (req, res) => {
  try {
    const courses = await prisma.course.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        teacher: { select: { id: true, name: true } },
        _count: { select: { enrollments: true } },
      },
    });
    res.json({ success: true, courses });
  } catch (error) {
    console.error("Courses list error:", error);
    res.status(500).json({ success: false, message: "Failed to load courses" });
  }
});

app.get("/api/courses/:id", authenticate, async (req, res) => {
  try {
    const course = await prisma.course.findUnique({
      where: { id: req.params.id },
      include: {
        teacher: { select: { id: true, name: true } },
        _count: { select: { enrollments: true } },
      },
    });
    if (!course) {
      return res.status(404).json({ success: false, message: "Course not found" });
    }
    res.json({ success: true, course });
  } catch (error) {
    console.error("Course detail error:", error);
    res.status(500).json({ success: false, message: "Failed to load course" });
  }
});

// ----------------------------- Enrollment -----------------------------------
// studentId always comes from the JWT, so a user cannot impersonate another
// student. Duplicate enrollment is prevented by the courseId+studentId unique.

app.post("/api/enrollments", requireRole("STUDENT"), async (req, res) => {
  try {
    const { courseId } = req.body;

    if (!courseId) {
      return res
        .status(400)
        .json({ success: false, message: "courseId is required" });
    }

    const course = await prisma.course.findUnique({
      where: { id: String(courseId) },
    });
    if (!course) {
      return res.status(404).json({ success: false, message: "Course not found" });
    }

    if (course.price > 0) {
      return res.status(400).json({
        success: false,
        message: "This course requires payment. Please complete checkout to enroll.",
      });
    }

    const existing = await prisma.enrollment.findUnique({
      where: {
        courseId_studentId: { courseId: String(courseId), studentId: req.userId },
      },
    });
    if (existing) {
      return res
        .status(409)
        .json({ success: false, message: "Already enrolled in this course" });
    }

    const enrollment = await prisma.enrollment.create({
      data: {
        courseId: String(courseId),
        studentId: req.userId,
        teacherId: course.teacherId,
        status: "ENROLLED",
      },
    });

    res.status(201).json({ success: true, enrollment });
  } catch (error) {
    console.error("Enrollment error:", error);
    res.status(500).json({ success: false, message: "Failed to enroll" });
  }
});

app.get("/api/enrollments/my", requireRole("STUDENT"), async (req, res) => {
  try {
    const enrollments = await prisma.enrollment.findMany({
      where: { studentId: req.userId },
      orderBy: { createdAt: "desc" },
      include: {
        course: {
          include: { teacher: { select: { id: true, name: true } } },
        },
      },
    });
    res.json({ success: true, enrollments });
  } catch (error) {
    console.error("My enrollments error:", error);
    res.status(500).json({ success: false, message: "Failed to load enrollments" });
  }
});

app.get("/api/teacher/enrollments", requireRole("TEACHER"), async (req, res) => {
  try {
    const enrollments = await prisma.enrollment.findMany({
      where: { teacherId: req.userId },
      orderBy: { createdAt: "desc" },
      include: {
        student: { select: { id: true, name: true, email: true } },
        course: { select: { id: true, title: true, subject: true, board: true } },
      },
    });
    res.json({ success: true, enrollments });
  } catch (error) {
    console.error("Teacher enrollments error:", error);
    res.status(500).json({ success: false, message: "Failed to load enrollments" });
  }
});

// ------------------------------- Admin ------------------------------------
// Every admin endpoint requires the ADMIN role.

app.get("/api/admin/stats", requireRole("ADMIN"), async (req, res) => {
  try {
    const [users, students, teachers, parents, admins, courses, enrollments, attempts, questions] =
      await Promise.all([
        prisma.user.count(),
        prisma.user.count({ where: { role: "STUDENT" } }),
        prisma.user.count({ where: { role: "TEACHER" } }),
        prisma.user.count({ where: { role: "PARENT" } }),
        prisma.user.count({ where: { role: "ADMIN" } }),
        prisma.course.count(),
        prisma.enrollment.count(),
        prisma.attempt.count(),
        prisma.question.count(),
      ]);
    res.json({
      success: true,
      stats: { users, students, teachers, parents, admins, courses, enrollments, attempts, questions },
    });
  } catch (error) {
    console.error("Admin stats error:", error);
    res.status(500).json({ success: false, message: "Failed to load stats" });
  }
});

app.get("/api/admin/users", requireRole("ADMIN"), async (req, res) => {
  try {
    const where = {};
    if (req.query.role && VALID_ROLES.includes(req.query.role)) {
      where.role = req.query.role;
    }
    const q = req.query.q ? String(req.query.q).trim() : "";
    if (q) {
      where.OR = [
        { name: { contains: q, mode: "insensitive" } },
        { email: { contains: q, mode: "insensitive" } },
      ];
    }
    const users = await prisma.user.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 200,
      select: {
        id: true, name: true, email: true, role: true, isVerified: true,
        grade: true, board: true, school: true, subject: true, xp: true, createdAt: true,
      },
    });
    res.json({ success: true, users });
  } catch (error) {
    console.error("Admin users error:", error);
    res.status(500).json({ success: false, message: "Failed to load users" });
  }
});

app.get("/api/admin/courses", requireRole("ADMIN"), async (req, res) => {
  try {
    const where = {};
    const q = req.query.q ? String(req.query.q).trim() : "";
    if (q) {
      where.OR = [
        { title: { contains: q, mode: "insensitive" } },
        { subject: { contains: q, mode: "insensitive" } },
        { board: { contains: q, mode: "insensitive" } },
      ];
    }
    const courses = await prisma.course.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 200,
      include: {
        teacher: { select: { id: true, name: true, email: true } },
        _count: { select: { enrollments: true } },
      },
    });
    res.json({ success: true, courses });
  } catch (error) {
    console.error("Admin courses error:", error);
    res.status(500).json({ success: false, message: "Failed to load courses" });
  }
});

// ----------------- Admin Teacher Applications Review ------------------------
app.get("/api/admin/teacher-applications", requireRole("ADMIN"), async (req, res) => {
  try {
    const status = req.query.status ? String(req.query.status).toUpperCase() : "ALL";
    const q = req.query.q ? String(req.query.q).trim() : "";
    const applications = listTeacherApplications({ status, search: q });
    res.json({ success: true, applications });
  } catch (error) {
    console.error("Admin teacher applications error:", error);
    res.status(500).json({ success: false, message: "Failed to load teacher applications" });
  }
});

app.get("/api/admin/teacher-applications/:id", requireRole("ADMIN"), async (req, res) => {
  try {
    const id = req.params.id;
    let app = getApplicationByUserId(id);
    if (!app) {
      const all = listTeacherApplications({ status: "ALL" });
      app = all.find((a) => a.id === id);
    }
    if (!app) {
      return res.status(404).json({ success: false, message: "Teacher application not found" });
    }
    res.json({ success: true, application: app });
  } catch (error) {
    console.error("Admin teacher application detail error:", error);
    res.status(500).json({ success: false, message: "Failed to load application detail" });
  }
});

app.post("/api/admin/teacher-applications/:id/decision", requireRole("ADMIN"), async (req, res) => {
  try {
    const id = req.params.id;
    let targetUserId = id;
    let targetApp = getApplicationByUserId(id);
    if (!targetApp) {
      const all = listTeacherApplications({ status: "ALL" });
      targetApp = all.find((a) => a.id === id);
      if (targetApp) targetUserId = targetApp.userId;
    }
    if (!targetApp) {
      return res.status(404).json({ success: false, message: "Teacher application not found" });
    }

    const { status, reason } = req.body;
    if (!status || !["APPROVED", "REJECTED"].includes(status)) {
      return res.status(400).json({ success: false, message: "Status must be APPROVED or REJECTED" });
    }
    if (status === "REJECTED" && (!reason || !String(reason).trim())) {
      return res.status(400).json({ success: false, message: "A clear rejection reason is required when rejecting an application." });
    }

    let adminUser = null;
    if (process.env.MONGODB_URI) {
      try {
        adminUser = await prisma.user.findUnique({ where: { id: req.userId } });
      } catch {}
    }
    if (!adminUser) adminUser = inMemoryUsers.get(req.userId) || { id: req.userId, name: "Platform Admin" };

    const updatedApp = reviewTeacherApplication(adminUser, targetUserId, { status, reason });

    const isApproved = status === "APPROVED";
    if (process.env.MONGODB_URI) {
      try {
        await prisma.user.update({
          where: { id: targetUserId },
          data: { isVerified: isApproved },
        });
      } catch {}
    }
    const memUser = inMemoryUsers.get(targetUserId);
    if (memUser) {
      memUser.isVerified = isApproved;
      inMemoryUsers.set(targetUserId, memUser);
    }

    res.json({
      success: true,
      message: `Teacher application ${status.toLowerCase()} successfully`,
      application: updatedApp,
    });
  } catch (error) {
    console.error("Admin application decision error:", error);
    res.status(500).json({ success: false, message: error.message || "Failed to process decision" });
  }
});

// ------------------------------- Parent -----------------------------------
// A parent may only view data for students explicitly linked to them.

app.post("/api/parent/link", requireRole("PARENT"), async (req, res) => {
  try {
    const rawEmail = req.body.studentEmail;
    if (!rawEmail || typeof rawEmail !== "string") {
      return res.status(400).json({ success: false, message: "studentEmail is required" });
    }
    const studentEmail = rawEmail.trim().toLowerCase();

    // Security: Avoid revealing whether an arbitrary email belongs to an account
    const student = await prisma.user.findUnique({ where: { email: studentEmail } });
    if (!student || student.role !== "STUDENT") {
      return res.json({
        success: true,
        message: "If an active student account exists for this email, it has been linked.",
      });
    }

    await prisma.parentChild.upsert({
      where: { parentId_studentId: { parentId: req.userId, studentId: student.id } },
      update: {},
      create: { parentId: req.userId, studentId: student.id },
    });
    res.json({
      success: true,
      message: "If an active student account exists for this email, it has been linked.",
    });
  } catch (error) {
    console.error("Parent link error:", error);
    res.status(500).json({ success: false, message: "Failed to link student" });
  }
});

app.get("/api/parent/children", requireRole("PARENT"), async (req, res) => {
  try {
    const links = await prisma.parentChild.findMany({
      where: { parentId: req.userId },
      include: {
        student: { select: { id: true, name: true, email: true, grade: true, board: true } },
      },
    });
    res.json({ success: true, children: links.map((l) => l.student) });
  } catch (error) {
    console.error("Parent children error:", error);
    res.status(500).json({ success: false, message: "Failed to load children" });
  }
});

async function assertParentAccess(req, res, studentId) {
  const link = await prisma.parentChild.findUnique({
    where: { parentId_studentId: { parentId: req.userId, studentId } },
  });
  if (!link) {
    res.status(403).json({ success: false, message: "Not authorized for this student" });
    return false;
  }
  return true;
}

app.get("/api/parent/child/:id/overview", requireRole("PARENT"), async (req, res) => {
  try {
    const studentId = req.params.id;
    if (!(await assertParentAccess(req, res, studentId))) return;

    const student = await prisma.user.findUnique({
      where: { id: studentId },
      select: { id: true, name: true, email: true, grade: true, board: true, xp: true },
    });

    const [completedCount, attempts] = await Promise.all([
      prisma.studentProgress.count({ where: { userId: studentId } }),
      prisma.attempt.findMany({
        where: { userId: studentId },
        orderBy: { createdAt: "desc" },
        take: 20,
        include: { topic: { select: { id: true, name: true, chapter: { select: { name: true } } } } },
      }),
    ]);

    const latestByTopic = new Map();
    for (const a of attempts) {
      if (!latestByTopic.has(a.topicId)) latestByTopic.set(a.topicId, a);
    }
    const weakTopics = [...latestByTopic.values()]
      .filter((a) => a.score < 60)
      .map((a) => ({
        topicId: a.topic.id,
        topicName: a.topic.name,
        chapterName: a.topic.chapter.name,
        score: a.score,
      }));

    res.json({ success: true, student, completedCount, attempts, weakTopics });
  } catch (error) {
    console.error("Parent overview error:", error);
    res.status(500).json({ success: false, message: "Failed to load child data" });
  }
});

// -------------------------------- Games -----------------------------------
// Presentational catalog; questions come from the existing topic bank and are
// scored server-side. XP is stored on the user for the leaderboard.

const GAMES = [
  {
    id: "memory-match",
    type: "memory_match",
    title: "Concept Memory Match",
    description: "Flip cards and match key terms with formulas and definitions. Test active recall!",
    xpPerCorrect: 15,
    pairsCount: 4,
  },
  {
    id: "ordering-puzzle",
    type: "ordering_challenge",
    title: "Sequence & Step Puzzle",
    description: "Arrange topic steps, derivations, or problem-solving procedures in the correct order.",
    xpPerCorrect: 20,
    stepsCount: 4,
  },
  {
    id: "timed-blitz",
    type: "timed_challenge",
    title: "Speed Rush (Time Attack)",
    description: "Answer questions against a 15-second countdown timer with streak multipliers for speed and accuracy.",
    xpPerCorrect: 10,
    limit: 5,
  },
  { id: "rapid-fire", type: "timed_challenge", title: "Rapid Fire", description: "10 questions, instant scoring. +10 XP each.", xpPerCorrect: 10, limit: 10 },
  { id: "topic-blitz", type: "timed_challenge", title: "Topic Blitz", description: "5 fast questions on one topic. +15 XP each.", xpPerCorrect: 15, limit: 5 },
  { id: "endurance", type: "timed_challenge", title: "Endurance", description: "Up to 20 questions. +8 XP each.", xpPerCorrect: 8, limit: 20 },
];

app.get("/api/games", authenticate, async (req, res) => {
  res.json({ success: true, games: GAMES });
});

app.get("/api/student/games/data", authenticate, async (req, res) => {
  try {
    const topicId = req.query.topicId;
    const gameId = req.query.gameId || "memory-match";
    if (!topicId) {
      return res.status(400).json({ success: false, message: "topicId is required" });
    }
    const data = getTopicGameData(topicId, gameId);
    res.json({ success: true, ...data });
  } catch (error) {
    console.error("Game data error:", error);
    res.status(500).json({ success: false, message: "Failed to load game data" });
  }
});

app.post("/api/videos/report", authenticate, async (req, res) => {
  try {
    const { videoId, reason, topicId } = req.body;
    if (!videoId || !reason) {
      return res.status(400).json({ success: false, message: "videoId and reason are required" });
    }
    const report = {
      id: `rep_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      userId: req.userId,
      videoId: String(videoId).trim().slice(0, 32),
      reason: String(reason).trim().slice(0, 500),
      topicId: topicId ? String(topicId).trim().slice(0, 64) : null,
      createdAt: new Date().toISOString(),
    };
    inMemoryVideoReports.push(report);
    res.json({ success: true, message: "Video report submitted successfully. Thank you for your feedback!" });
  } catch (error) {
    console.error("Video report error:", error);
    res.status(500).json({ success: false, message: "Failed to submit report" });
  }
});

app.post("/api/games/submit", requireRole("STUDENT"), async (req, res) => {
  try {
    const { gameId, topicId } = req.body;
    if (!gameId || !topicId) {
      return res.status(400).json({ success: false, message: "gameId and topicId are required" });
    }
    const game = GAMES.find((g) => g.id === gameId);
    if (!game) {
      return res.status(400).json({ success: false, message: "Unknown game" });
    }

    let topic = null;
    if (process.env.MONGODB_URI && isMongoId(String(topicId))) {
      try {
        topic = await prisma.topic.findUnique({ where: { id: String(topicId) } });
      } catch (err) {
        console.warn("Topic lookup DB query fallback:", err.message);
      }
    }
    if (!topic) {
      topic = getFallbackTopicById(topicId);
    }
    if (!topic) {
      return res.status(404).json({ success: false, message: "Topic not found" });
    }

    // 1. Memory Match Submission
    if (game.type === "memory_match" || gameId === "memory-match") {
      const matches = Math.max(0, Math.min(Number(req.body.matchesFound) || 0, 12));
      const totalPairs = Math.max(1, Number(req.body.totalPairs) || 4);
      const moves = Math.max(0, Number(req.body.moves) || 0);
      const correct = matches;
      const total = totalPairs;
      const score = Math.round((matches / totalPairs) * 100);
      const xp = Math.min(matches * (game.xpPerCorrect || 15), 60);

      let totalXp = (inMemoryUserXp.get(req.userId) || 0) + xp;
      inMemoryUserXp.set(req.userId, totalXp);

      if (process.env.MONGODB_URI && isMongoId(req.userId) && isMongoId(String(topicId))) {
        try {
          await prisma.gameScore.create({
            data: { userId: req.userId, gameId, topicId: String(topicId), correct, total, score, xp },
          });
          const user = await prisma.user.update({
            where: { id: req.userId },
            data: { xp: { increment: xp } },
            select: { xp: true },
          });
          if (user && typeof user.xp === "number") totalXp = user.xp;
        } catch (dbErr) {
          console.warn("Prisma game score recording fallback:", dbErr.message);
        }
      }

      return res.status(201).json({ success: true, correct, total, score, xp, totalXp, moves });
    }

    // 2. Ordering Puzzle Submission
    if (game.type === "ordering_challenge" || gameId === "ordering-puzzle") {
      const isCorrect = Boolean(req.body.isCorrect);
      const attempts = Math.max(1, Number(req.body.attempts) || 1);
      const correct = isCorrect ? 1 : 0;
      const total = 1;
      const score = isCorrect ? 100 : 0;
      const xp = isCorrect ? Math.max(5, 20 - (attempts - 1) * 5) : 0;

      let totalXp = (inMemoryUserXp.get(req.userId) || 0) + xp;
      inMemoryUserXp.set(req.userId, totalXp);

      if (process.env.MONGODB_URI && isMongoId(req.userId) && isMongoId(String(topicId))) {
        try {
          await prisma.gameScore.create({
            data: { userId: req.userId, gameId, topicId: String(topicId), correct, total, score, xp },
          });
          const user = await prisma.user.update({
            where: { id: req.userId },
            data: { xp: { increment: xp } },
            select: { xp: true },
          });
          if (user && typeof user.xp === "number") totalXp = user.xp;
        } catch (dbErr) {
          console.warn("Prisma game score recording fallback:", dbErr.message);
        }
      }

      return res.status(201).json({ success: true, correct, total, score, xp, totalXp, isCorrect });
    }

    // 3. Timed Challenge & Quiz Submission
    const answers = req.body.answers;
    if (!Array.isArray(answers) || answers.length === 0) {
      return res.status(400).json({ success: false, message: "answers are required" });
    }

    // Deduplicate answers by questionId to prevent repeated-answer XP exploitation
    const seen = new Set();
    const cleanAnswers = [];
    for (const a of answers) {
      const qId = String(a.questionId || "").trim();
      if (qId && !seen.has(qId)) {
        seen.add(qId);
        cleanAnswers.push({
          questionId: qId,
          selected: typeof a.selected === "number" ? a.selected : -1,
        });
      }
    }

    if (cleanAnswers.length === 0) {
      return res.status(400).json({ success: false, message: "Valid answers are required" });
    }

    // Enforce game limit
    const cappedAnswers = cleanAnswers.slice(0, game.limit || 10);

    let questions = [];
    if (process.env.MONGODB_URI && isMongoId(String(topicId))) {
      try {
        const mongoQIds = cappedAnswers.map((a) => a.questionId).filter(isMongoId);
        if (mongoQIds.length > 0) {
          questions = await prisma.question.findMany({
            where: {
              topicId: String(topicId),
              status: "PUBLISHED",
              id: { in: mongoQIds },
            },
          });
        }
      } catch (err) {
        console.warn("Questions lookup DB query fallback:", err.message);
      }
    }

    if (!questions || questions.length === 0) {
      questions = cappedAnswers
        .map((a) => getFallbackQuestionById(a.questionId))
        .filter(Boolean);
    }

    const byId = new Map(questions.map((q) => [q.id, q]));
    let correct = 0;
    for (const a of cappedAnswers) {
      const q = byId.get(a.questionId);
      if (q && a.selected === q.correct) correct += 1;
    }

    const total = cappedAnswers.length;
    const score = total > 0 ? Math.round((correct / total) * 10000) / 100 : 0;
    const streakBonus = Math.min(Math.max(0, Number(req.body.streakBonus) || 0), 25);
    const xp = Math.max(0, correct * (game.xpPerCorrect || 10) + streakBonus);

    let totalXp = (inMemoryUserXp.get(req.userId) || 0) + xp;
    inMemoryUserXp.set(req.userId, totalXp);

    if (process.env.MONGODB_URI && isMongoId(req.userId) && isMongoId(String(topicId))) {
      try {
        await prisma.gameScore.create({
          data: { userId: req.userId, gameId, topicId: String(topicId), correct, total, score, xp },
        });
        const user = await prisma.user.update({
          where: { id: req.userId },
          data: { xp: { increment: xp } },
          select: { xp: true },
        });
        if (user && typeof user.xp === "number") totalXp = user.xp;
      } catch (dbErr) {
        console.warn("Prisma game score recording fallback:", dbErr.message);
      }
    }

    res.status(201).json({ success: true, correct, total, score, xp, totalXp });
  } catch (error) {
    console.error("Game submit error:", error);
    res.status(500).json({ success: false, message: "Failed to record game" });
  }
});

app.get("/api/games/leaderboard", authenticate, async (req, res) => {
  try {
    const users = await prisma.user.findMany({
      where: { role: "STUDENT", xp: { gt: 0 } },
      orderBy: { xp: "desc" },
      take: 10,
      select: { id: true, name: true, xp: true },
    });
    res.json({ success: true, leaderboard: users });
  } catch (error) {
    console.error("Leaderboard error:", error);
    res.status(500).json({ success: false, message: "Failed to load leaderboard" });
  }
});

app.get("/api/games/me", requireRole("STUDENT"), async (req, res) => {
  try {
    const scores = await prisma.gameScore.findMany({
      where: { userId: req.userId },
      orderBy: { createdAt: "desc" },
      take: 20,
      include: { topic: { select: { name: true } } },
    });
    const me = await prisma.user.findUnique({ where: { id: req.userId }, select: { xp: true } });
    const best = scores.reduce((m, s) => Math.max(m, s.score), 0);
    res.json({
      success: true,
      totalXp: me?.xp ?? 0,
      gamesPlayed: scores.length,
      bestScore: best,
      recent: scores,
    });
  } catch (error) {
    console.error("Game me error:", error);
    res.status(500).json({ success: false, message: "Failed to load game stats" });
  }
});

// ------------------------------ AI adapter --------------------------------
// Multi-provider backend AI adapter supporting Google Gemini and OpenAI.
// Secrets stay strictly server-side. Missing configuration returns a clear,
// pedagogical preview without fabricating answers or crashing.

function getAiConfig() {
  const provider = (process.env.AI_PROVIDER || "").toLowerCase().trim();
  const geminiKey = process.env.GEMINI_API_KEY || "";
  const openaiKey = process.env.OPENAI_API_KEY || "";
  const genericKey = process.env.AI_API_KEY || "";

  if (provider === "gemini") {
    return {
      provider: "gemini",
      apiKey: geminiKey || genericKey,
      model: process.env.AI_MODEL || "gemini-2.5-flash",
    };
  }

  if (provider === "openai") {
    return {
      provider: "openai",
      apiKey: openaiKey || genericKey,
      model: process.env.AI_MODEL || "gpt-4o-mini",
    };
  }

  // Auto-detection when AI_PROVIDER is omitted:
  if (geminiKey) {
    return {
      provider: "gemini",
      apiKey: geminiKey,
      model: process.env.AI_MODEL || "gemini-2.5-flash",
    };
  }

  if (openaiKey) {
    return {
      provider: "openai",
      apiKey: openaiKey,
      model: process.env.AI_MODEL || "gpt-4o-mini",
    };
  }

  if (genericKey) {
    // Keys starting with AIza are Google Gemini API keys
    if (genericKey.startsWith("AIza")) {
      return {
        provider: "gemini",
        apiKey: genericKey,
        model: process.env.AI_MODEL || "gemini-2.5-flash",
      };
    }
    return {
      provider: "openai",
      apiKey: genericKey,
      model: process.env.AI_MODEL || "gpt-4o-mini",
    };
  }

  return { provider: null, apiKey: null, model: null };
}

function aiConfigured() {
  const cfg = getAiConfig();
  return Boolean(cfg.apiKey);
}

async function callGemini(apiKey, model, messages, { json = false, timeoutMs = 30000 } = {}) {
  const systemMsg = messages.find((m) => m.role === "system");
  const nonSystemMsgs = messages.filter((m) => m.role !== "system");

  const contents = [];
  for (const m of nonSystemMsgs) {
    const role = m.role === "assistant" ? "model" : "user";
    const text = String(m.content || "").trim();
    if (!text) continue;

    if (contents.length > 0 && contents[contents.length - 1].role === role) {
      contents[contents.length - 1].parts[0].text += "\n\n" + text;
    } else {
      contents.push({ role, parts: [{ text }] });
    }
  }

  if (contents.length === 0) {
    return { ok: false, reason: "No message content to send to AI" };
  }
  if (contents[0].role === "model") {
    contents.unshift({ role: "user", parts: [{ text: "Hello teacher" }] });
  }

  const payload = {
    contents,
    generationConfig: {
      temperature: 0.7,
      maxOutputTokens: 2048,
      ...(json ? { responseMimeType: "application/json" } : {}),
    },
  };

  if (systemMsg?.content) {
    payload.system_instruction = {
      parts: [{ text: systemMsg.content }],
    };
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const resp = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    clearTimeout(timer);

    if (!resp.ok) {
      const errBody = await resp.json().catch(() => ({}));
      const errMsg = errBody?.error?.message || `AI service error (${resp.status})`;
      if (resp.status === 429) {
        return { ok: false, reason: "The AI teacher is receiving many questions right now. Please wait a moment and ask again." };
      }
      return { ok: false, reason: `AI request failed (${resp.status}): ${errMsg}` };
    }

    const data = await resp.json();
    const candidate = data?.candidates?.[0];
    const text = candidate?.content?.parts?.map((p) => p.text).join("") || "";
    if (!text && candidate?.finishReason) {
      return { ok: false, reason: `AI finished without output (reason: ${candidate.finishReason})` };
    }
    return { ok: true, text };
  } catch (err) {
    clearTimeout(timer);
    if (err.name === "AbortError") {
      return { ok: false, reason: "AI request timed out. Please try asking again." };
    }
    console.error("Gemini request error:", err);
    return { ok: false, reason: "Failed to connect to Gemini AI provider" };
  }
}

async function callOpenAi(apiKey, model, messages, { json = false, timeoutMs = 30000 } = {}) {
  const baseUrl = process.env.OPENAI_BASE_URL || "https://api.openai.com/v1";
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const resp = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages,
        temperature: 0.7,
        max_tokens: 2048,
        ...(json ? { response_format: { type: "json_object" } } : {}),
      }),
      signal: controller.signal,
    });
    clearTimeout(timer);

    if (!resp.ok) {
      const errBody = await resp.json().catch(() => ({}));
      const errMsg = errBody?.error?.message || `AI service error (${resp.status})`;
      if (resp.status === 429) {
        return { ok: false, reason: "The AI teacher is handling high traffic. Please wait a moment and retry." };
      }
      return { ok: false, reason: `AI request failed (${resp.status}): ${errMsg}` };
    }

    const data = await resp.json();
    const text = data?.choices?.[0]?.message?.content ?? "";
    return { ok: true, text };
  } catch (err) {
    clearTimeout(timer);
    if (err.name === "AbortError") {
      return { ok: false, reason: "AI request timed out. Please try asking again." };
    }
    console.error("OpenAI request error:", err);
    return { ok: false, reason: "Failed to connect to OpenAI provider" };
  }
}

async function callAi(messages, options = {}) {
  const config = getAiConfig();
  if (!config.apiKey) {
    return { ok: false, reason: "AI provider not configured" };
  }
  if (config.provider === "gemini") {
    return callGemini(config.apiKey, config.model, messages, options);
  }
  if (config.provider === "openai") {
    return callOpenAi(config.apiKey, config.model, messages, options);
  }
  return { ok: false, reason: `Unsupported AI provider: ${config.provider}` };
}

// --------------------------- Adaptive Pedagogical Prompt --------------------

function buildTeacherSystemPrompt({
  language = "en",
  grade = "all",
  style = "adaptive",
  studentName = "",
  videoContext = null,
  curriculumContext = null,
} = {}) {
  const langKey = ["en", "hi", "mr", "te"].includes(language) ? language : "en";

  const languageInstructions = {
    en: `
LANGUAGE: ENGLISH
- Teach and explain in clear, fluent, natural English.
- Use encouraging, age-appropriate vocabulary suitable for school and technical learners.
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

  const gradeDirectives = {
    primary: "TARGET AUDIENCE: Primary School (Classes 1–5). Keep explanations very simple, playful, warm, visual, and free of heavy jargon. Use stories and cheerful encouragement.",
    middle: "TARGET AUDIENCE: Middle School (Classes 6–8). Connect concepts to observations, curiosity, and relatable experiments. Balance clarity with foundational rigor.",
    secondary: "TARGET AUDIENCE: Secondary School (Classes 9–10). Provide clear conceptual foundations, step-by-step mathematical reasoning, and curriculum-ready clarity.",
    senior: "TARGET AUDIENCE: Senior Secondary (Classes 11–12). Provide rigorous, in-depth conceptual clarity with derivations, edge-cases, and exam-level insight.",
    diploma: "TARGET AUDIENCE: Diploma / Polytechnic Engineering Student. Explain engineering concepts with industry-oriented practical clarity, code/syntax snippets (C/C++/Java/Python/SQL), circuit/architectural clarity, and step-by-step technical implementation.",
    all: "TARGET AUDIENCE: School Student. Infer complexity from the question's level and respond clearly.",
  }[grade] || "TARGET AUDIENCE: School Student.";

  const styleDirectives = {
    step_by_step: "TEACHING STYLE: Step-by-Step. Explicitly number each step (Step 1, Step 2, Step 3). Show the 'why' behind each progression.",
    visual_analogy: "TEACHING STYLE: Visual & Analogies. Anchor the explanation in a vivid, relatable everyday mental picture or story first.",
    concise: "TEACHING STYLE: Concise Doubt Clearance. Provide the direct concept answer in 2-3 sentences first, followed by a 1-sentence intuitive reason.",
    adaptive: "TEACHING STYLE: Socratic & Adaptive. Guide the student to discover the idea. Explain the core, then ask a guiding reflection question.",
  }[style] || "TEACHING STYLE: Adaptive & Socratic.";

  const activeCurriculum = curriculumContext || videoContext;
  const curriculumDirective = activeCurriculum && (activeCurriculum.topic || activeCurriculum.subject || activeCurriculum.chapter)
    ? `
STUDENT'S ACTIVE CURRICULUM CONTEXT:
${activeCurriculum.educationType || activeCurriculum.educationLevel ? `- EDUCATION LEVEL: ${(activeCurriculum.educationType || activeCurriculum.educationLevel).toUpperCase()}` : ""}
${activeCurriculum.board ? `- BOARD / AUTHORITY: ${activeCurriculum.board.toUpperCase()}` : ""}
${activeCurriculum.classGrade ? `- CLASS / YEAR: ${activeCurriculum.classGrade}` : ""}
${activeCurriculum.branch ? `- DIPLOMA BRANCH: ${activeCurriculum.branch.toUpperCase()}` : ""}
${activeCurriculum.semester ? `- SEMESTER: ${activeCurriculum.semester}` : ""}
${activeCurriculum.subject ? `- SUBJECT: ${activeCurriculum.subject}` : ""}
${activeCurriculum.chapter ? `- CHAPTER / UNIT: ${activeCurriculum.chapter}` : ""}
${activeCurriculum.topic ? `- TOPIC: ${activeCurriculum.topic}` : ""}
${activeCurriculum.transcript ? `VERIFIED LESSON MATERIAL / TRANSCRIPT SUMMARY:\n${activeCurriculum.transcript}\n\nGround your lesson-specific explanations and doubts directly in this verified lesson material.` : ""}

PEDAGOGICAL TEACHING METHOD:
1. PROGRESSIVE EXPLANATION: Introduce the concept step-by-step, starting with the simplest intuition before formal rules.
2. CONCRETE REAL-WORLD EXAMPLE: Always include a practical, relatable analogy from everyday life.
3. GUIDED UNDERSTANDING QUESTION: Conclude with a short, friendly question to prompt the student's thinking.
4. SHORT PRACTICE ACTIVITY: Provide a 1-step practice check or challenge for active recall.
5. STRICT CURRICULUM INTEGRITY: Ground all explanations in authentic, verified academic facts. Do NOT fabricate syllabus facts, invented theorems, or claim unsupported curriculum coverage.`
    : "";

  return `You are LUCOUS AI Teacher (ल्युकस शिक्षक / ల్యూకస్ ఉపాధ్యాయుడు), an intelligent, inspiring, multilingual teacher for school and engineering students.
${studentName ? `The student's name is ${studentName}.` : ""}

${languageInstructions}

${gradeDirectives}
${styleDirectives}
${curriculumDirective}

CORE EDUCATIONAL PRINCIPLES:
1. TEACH FOR UNDERSTANDING, NOT HOMEWORK DUMPING:
   - If the student asks for a direct calculation (e.g. "what is 34 * 12" or "solve x + 5 = 12"), do NOT simply print the final number alone.
   - Walk through the method step by step, explaining WHY it works, and invite them to finish or verify the last step.
2. BREAK COMPLICATED CONCEPTS DOWN:
   - Deconstruct abstract ideas into 2 to 3 bite-sized steps.
3. USE RELATABLE REAL-WORLD ANALOGIES:
   - Connect science, math, or history to things students can see and touch (cricket shots, water boiling, cycling against the wind, shadows).
4. ALWAYS CONCLUDE WITH AN INTERACTIVE UNDERSTANDING CHECK:
   - End your explanation with a friendly, short follow-up question to test their understanding.
5. HANDLE CONFUSION AND WRONG ANSWERS WITH EMPATHY:
   - If the student says "I don't understand" or answers incorrectly: NEVER be critical. Say "That is completely fine, let's look at this from a fresh angle!" and explain using a totally different, simpler everyday picture.
   - Diagnose their misconception constructively and provide a gentle hint.
6. FORMATTING:
   - Use clean Markdown with short paragraphs, bold key terms, and bullet points so it is easy to read on mobile devices.
   - Do NOT use markdown tables or raw HTML.`;
}


// -------------------------------- AI Tutor --------------------------------

// GET /api/ai/tutor/conversations — List past learning threads for authenticated student
app.get("/api/ai/tutor/conversations", authenticate, async (req, res) => {
  try {
    let userMessages = [];
    if (process.env.MONGODB_URI) {
      try {
        userMessages = await prisma.aiMessage.findMany({
          where: { userId: req.userId },
          orderBy: { createdAt: "desc" },
          take: 250,
        });
      } catch (dbErr) {
        console.warn("Prisma conversation list fallback:", dbErr.message);
      }
    }
    if (!userMessages || userMessages.length === 0) {
      userMessages = inMemoryAiMessages
        .filter((m) => m.userId === req.userId)
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    }

    const threadMap = new Map();
    for (const m of userMessages) {
      if (!threadMap.has(m.conversationId)) {
        threadMap.set(m.conversationId, {
          id: m.conversationId,
          firstUserText: m.role === "user" ? m.content : null,
          lastMessageText: m.content,
          updatedAt: m.createdAt,
          messageCount: 0,
        });
      }
      const item = threadMap.get(m.conversationId);
      item.messageCount += 1;
      if (m.role === "user" && !item.firstUserText) {
        item.firstUserText = m.content;
      }
    }

    const conversations = Array.from(threadMap.values()).map((t) => ({
      id: t.id,
      title: t.firstUserText ? t.firstUserText.slice(0, 55) : "Learning Session",
      lastMessage: t.lastMessageText ? t.lastMessageText.slice(0, 80) : "",
      messageCount: t.messageCount,
      updatedAt: t.updatedAt,
    }));

    res.json({ success: true, conversations });
  } catch (error) {
    console.error("AI tutor conversations error:", error);
    res.status(500).json({ success: false, message: "Failed to load discussions" });
  }
});

// DELETE /api/ai/tutor/conversations/:id — Delete a conversation owned by the student
app.delete("/api/ai/tutor/conversations/:id", authenticate, async (req, res) => {
  try {
    const convId = String(req.params.id || "").trim();
    if (!convId) {
      return res.status(400).json({ success: false, message: "Conversation id is required" });
    }

    if (process.env.MONGODB_URI) {
      try {
        await prisma.aiMessage.deleteMany({
          where: { conversationId: convId, userId: req.userId },
        });
      } catch (dbErr) {
        console.warn("Prisma conversation delete fallback:", dbErr.message);
      }
    }

    for (let i = inMemoryAiMessages.length - 1; i >= 0; i--) {
      if (inMemoryAiMessages[i].conversationId === convId && inMemoryAiMessages[i].userId === req.userId) {
        inMemoryAiMessages.splice(i, 1);
      }
    }

    res.json({ success: true, message: "Discussion deleted" });
  } catch (error) {
    console.error("AI tutor delete conversation error:", error);
    res.status(500).json({ success: false, message: "Failed to delete discussion" });
  }
});

// GET /api/ai/tutor — Get messages for current or requested conversation
app.get("/api/ai/tutor", authenticate, async (req, res) => {
  try {
    const requestedConvId = req.query.conversationId ? String(req.query.conversationId).trim() : null;
    let targetConvId = requestedConvId;

    if (targetConvId) {
      // Backend ownership verification: Ensure no other user owns messages in this thread
      let foreignMsg = inMemoryAiMessages.find((m) => m.conversationId === targetConvId && m.userId !== req.userId);
      if (!foreignMsg && process.env.MONGODB_URI) {
        try {
          foreignMsg = await prisma.aiMessage.findFirst({
            where: { conversationId: targetConvId, userId: { not: req.userId } },
          });
        } catch (dbErr) {
          console.warn("Prisma ownership check fallback:", dbErr.message);
        }
      }
      if (foreignMsg) {
        return res.status(403).json({ success: false, message: "Unauthorized access to discussion" });
      }
    } else {
      // Load latest conversation for this student
      if (process.env.MONGODB_URI) {
        try {
          const latest = await prisma.aiMessage.findFirst({
            where: { userId: req.userId },
            orderBy: { createdAt: "desc" },
          });
          if (latest) {
            targetConvId = latest.conversationId;
          }
        } catch (dbErr) {
          console.warn("Prisma latest conv check fallback:", dbErr.message);
        }
      }
      if (!targetConvId) {
        const memLatest = inMemoryAiMessages
          .filter((m) => m.userId === req.userId)
          .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))[0];
        if (memLatest) targetConvId = memLatest.conversationId;
      }
    }

    if (!targetConvId) {
      return res.json({
        success: true,
        configured: aiConfigured(),
        conversationId: null,
        messages: [],
      });
    }

    let messages = [];
    if (process.env.MONGODB_URI) {
      try {
        messages = await prisma.aiMessage.findMany({
          where: { userId: req.userId, conversationId: targetConvId },
          orderBy: { createdAt: "asc" },
          take: 50,
        });
      } catch (dbErr) {
        console.warn("Prisma messages fetch fallback:", dbErr.message);
      }
    }
    if (!messages || messages.length === 0) {
      messages = inMemoryAiMessages.filter((m) => m.userId === req.userId && m.conversationId === targetConvId);
    }

    res.json({
      success: true,
      configured: aiConfigured(),
      conversationId: targetConvId,
      messages: messages.map((m) => ({
        id: m.id,
        role: m.role,
        content: m.content,
        conversationId: m.conversationId,
        createdAt: m.createdAt,
      })),
    });
  } catch (error) {
    console.error("AI tutor history error:", error);
    res.status(500).json({ success: false, message: "Failed to load chat history" });
  }
});

// POST /api/ai/tutor — Send student message, run adaptive teacher intelligence
app.post("/api/ai/tutor", authenticate, async (req, res) => {
  try {
    const rawMessage = String(req.body.message || "").trim();
    if (!rawMessage) {
      return res.status(400).json({ success: false, message: "Message is required" });
    }
    if (rawMessage.length > 2000) {
      return res.status(400).json({ success: false, message: "Message exceeds limit of 2000 characters" });
    }

    const rawConvId = req.body.conversationId ? String(req.body.conversationId).trim().slice(0, 64) : null;
    const convId = rawConvId || `conv_${req.userId}_${Date.now()}`;

    // Backend ownership verification for existing conversation
    if (rawConvId) {
      let foreignMsg = inMemoryAiMessages.find((m) => m.conversationId === rawConvId && m.userId !== req.userId);
      if (!foreignMsg && process.env.MONGODB_URI && isMongoId(req.userId)) {
        try {
          foreignMsg = await prisma.aiMessage.findFirst({
            where: { conversationId: rawConvId, userId: { not: req.userId } },
          });
        } catch (dbErr) {
          console.warn("Prisma ownership check fallback:", dbErr.message);
        }
      }
      if (foreignMsg) {
        return res.status(403).json({ success: false, message: "Unauthorized access to discussion" });
      }
    }

    const language = String(req.body.language || "en").toLowerCase();
    const grade = String(req.body.grade || "all").toLowerCase();
    const style = String(req.body.style || "adaptive").toLowerCase();

    // Extract optional videoContext for multimodal/video-connected tutoring
    const videoContext = req.body.videoContext && typeof req.body.videoContext === "object" ? {
      videoId: req.body.videoContext.videoId ? String(req.body.videoContext.videoId).trim().slice(0, 32) : null,
      title: req.body.videoContext.title ? String(req.body.videoContext.title).trim().slice(0, 200) : null,
      topic: req.body.videoContext.topic ? String(req.body.videoContext.topic).trim().slice(0, 100) : null,
      subject: req.body.videoContext.subject ? String(req.body.videoContext.subject).trim().slice(0, 100) : null,
      educationLevel: req.body.videoContext.educationLevel ? String(req.body.videoContext.educationLevel).trim().slice(0, 50) : null,
      classGrade: req.body.videoContext.classGrade ? String(req.body.videoContext.classGrade).trim().slice(0, 20) : null,
      board: req.body.videoContext.board ? String(req.body.videoContext.board).trim().slice(0, 50) : null,
      stream: req.body.videoContext.stream ? String(req.body.videoContext.stream).trim().slice(0, 50) : null,
      branch: req.body.videoContext.branch ? String(req.body.videoContext.branch).trim().slice(0, 50) : null,
      scheme: req.body.videoContext.scheme ? String(req.body.videoContext.scheme).trim().slice(0, 50) : null,
      semester: req.body.videoContext.semester ? String(req.body.videoContext.semester).trim().slice(0, 20) : null,
      chapter: req.body.videoContext.chapter ? String(req.body.videoContext.chapter).trim().slice(0, 100) : null,
      transcript: req.body.videoContext.transcript ? String(req.body.videoContext.transcript).trim().slice(0, 4000) : null,
    } : null;

    // Extract student's actual selected curriculum context
    const rawCurriculum = req.body.curriculumContext && typeof req.body.curriculumContext === "object"
      ? req.body.curriculumContext
      : (videoContext || null);

    const curriculumContext = rawCurriculum ? {
      educationType: rawCurriculum.educationType ? String(rawCurriculum.educationType).trim().slice(0, 50) : (rawCurriculum.educationLevel ? String(rawCurriculum.educationLevel).trim().slice(0, 50) : null),
      board: rawCurriculum.board ? String(rawCurriculum.board).trim().slice(0, 50) : null,
      classGrade: rawCurriculum.classGrade ? String(rawCurriculum.classGrade).trim().slice(0, 50) : (rawCurriculum.grade ? String(rawCurriculum.grade).trim().slice(0, 50) : null),
      branch: rawCurriculum.branch ? String(rawCurriculum.branch).trim().slice(0, 50) : null,
      semester: rawCurriculum.semester ? String(rawCurriculum.semester).trim().slice(0, 50) : null,
      subject: rawCurriculum.subject ? String(rawCurriculum.subject).trim().slice(0, 100) : null,
      chapter: rawCurriculum.chapter ? String(rawCurriculum.chapter).trim().slice(0, 100) : null,
      topic: rawCurriculum.topic ? String(rawCurriculum.topic).trim().slice(0, 100) : null,
    } : null;

    const topicDisplay = (curriculumContext && (curriculumContext.topic || curriculumContext.chapter || curriculumContext.subject))
      || (videoContext && (videoContext.title || videoContext.topic || videoContext.subject))
      || "the curriculum topic";

    // Check if live AI is configured
    if (!aiConfigured()) {
      const previewResponses = {
        en: `Welcome to LUCOUS AI Teacher! 🎓\n\nLet's study **${topicDisplay}** step-by-step:\n\n1. **Simple Explanation**: ${topicDisplay} is a core academic principle designed to break complex ideas into clear, logical steps.\n2. **Relatable Example**: Think of everyday routines—like following a recipe or calculating cricket run rates—rules ensure the final outcome is always accurate and reliable.\n3. **Guided Question**: What do you think would happen if we changed the starting inputs or boundary values in this topic?\n4. **Short Practice Activity**: Can you identify the primary rule, formula, or concept definition for ${topicDisplay}?\n\n⚠️ **Teacher Setup Notice:**\nThe backend AI provider is currently in preview mode. To activate live responses, configure \`GEMINI_API_KEY\` (recommended) or \`AI_API_KEY\` on your backend server.`,
        hi: `ल्युकस AI शिक्षक में आपका स्वागत है! 🎓\n\nआइए **${topicDisplay}** को चरण-दर-चरण (Step-by-step) समझें:\n\n1. **सरल व्याख्या**: ${topicDisplay} एक महत्वपूर्ण शैक्षणिक संकल्पना है। इसे समझने के लिए हम इसे छोटे, तार्किक चरणों में विभाजित करते हैं।\n2. **दैनिक उदाहरण**: जैसे साइकिल चलाते समय पैडल घुमाने पर पहिया आगे बढ़ता है, वैसे ही गणित और विज्ञान में भी प्रत्येक क्रिया के पीछे स्पष्ट नियम होते हैं।\n3. **मार्गदर्शक प्रश्न**: आपके विचार में, यदि हम इस विषय के बुनियादी मानों या शर्तों को बदल दें, तो परिणाम पर क्या प्रभाव पड़ेगा?\n4. **अभ्यास चुनौती**: क्या आप ${topicDisplay} का मुख्य नियम या सूत्र एक वाक्य में बता सकते हैं?\n\n⚠️ **सेटअप सूचना:**\nबैकएंड पर AI प्रदाता अभी कनेक्ट नहीं है। लाइव उत्तरों के लिए सर्वर पर \`GEMINI_API_KEY\` या \`AI_API_KEY\` सेट करें।`,
        mr: `ल्युकस AI शिक्षकामध्ये तुमचे स्वागत आहे! 🎓\n\nचला **${topicDisplay}** ची संकल्पना टप्प्याटप्प्याने समजून घेऊया:\n\n1. **सोपे स्पष्टीकरण**: ${topicDisplay} ही एक मूलभूत शैक्षणिक संकल्पना आहे. ही संकल्पना समजण्यासाठी आपण तिचे छोटे-छोटे पायऱ्यांमध्ये विश्लेषण करतो.\n2. **दैनंदिन उदाहरण**: जसे सायकलचे पॅडल मारल्यावर चाक फिरते आणि गती मिळते, तसेच या नियमांमध्येही प्रत्येक पायरीमागे अचूक कारण असते.\n3. **मार्गदर्शक प्रश्न**: या संकल्पनेतील सुरुवातीची अट किंवा मूल्य बदलले तर अंतिम उत्तरावर काय परिणाम होईल असे तुम्हाला वाटते?\n4. **सराव प्रश्न**: ${topicDisplay} मधील मुख्य तत्त्व किंवा सूत्र तुम्ही ओळखू शकता का?\n\n⚠️ **सेटअप सूचना:**\nबॅकएंडवर AI प्रदाता अजून जोडलेला नाही. थेट उत्तरांसाठी सर्व्हरवर \`GEMINI_API_KEY\` किंवा \`AI_API_KEY\` सेट करा.`,
        te: `ల్యూకస్ AI ఉపాధ్యాయుడికి స్వాగతం! 🎓\n\nమనం **${topicDisplay}** ను దశలవారీగా నేర్చుకుందాం:\n\n1. **సులభమైన వివరణ**: ${topicDisplay} అనేది ఒక ప్రాథమిక పాఠ్యాంశ భావన. దీన్ని సరళమైన, తార్కిక దశలుగా విభజించి నేర్చుకోవచ్చు.\n2. **నిజ జీవిత ఉదాహరణ**: సైకిల్ తొక్కేటప్పుడు పెడల్ తిప్పితే చక్రం ముందుకు సాగినట్లే, గణితం మరియు శాస్త్రంలో కూడా స్పష్టమైన నియమాలు ఉంటాయి.\n3. **గైడెడ్ ప్రశ్న**: ప్రారంభ పరిస్థితులు లేదా విలువలని మార్చినప్పుడు తుది ఫలితం ఎలా మారుతుందని మీరు భావిస్తున్నారు?\n4. **అభ్యాస సవాలు**: ${topicDisplay} యొక్క ప్రాథమిక సూత్రం లేదా నిర్వచనాన్ని మీరు గుర్తుపట్టగలరా?\n\n⚠️ **సెటప్ సమాచారం:**\nబ్యాకెండ్‌లో AI ప్రొవైడర్ ఇంకా కాన్ఫిగర్ కాలేదు. లైవ్ సమాధానాల కోసం సర్వర్‌లో \`GEMINI_API_KEY\` లేదా \`AI_API_KEY\` సెట్ చేయండి.`,
      };

      let reply = previewResponses[language] || previewResponses.en;
      if (videoContext && (videoContext.title || videoContext.topic || videoContext.subject)) {
        const displayTitle = videoContext.title || videoContext.topic || videoContext.subject;
        const branchNotice = videoContext.branch ? ` (${videoContext.branch.toUpperCase()})` : "";
        const vidPrefix = {
          en: `📺 *Studying Lesson: ${displayTitle}${branchNotice}*\n\n`,
          hi: `📺 *पाठ अध्ययन: ${displayTitle}${branchNotice}*\n\n`,
          mr: `📺 *धडा अभ्यास: ${displayTitle}${branchNotice}*\n\n`,
          te: `📺 *పాఠం అధ్యయనం: ${displayTitle}${branchNotice}*\n\n`,
        }[language] || `📺 *Studying Lesson: ${displayTitle}${branchNotice}*\n\n`;
        reply = vidPrefix + reply;
      }

      // Record offline/preview conversation safely
      const nowIso = new Date().toISOString();
      inMemoryAiMessages.push({
        id: `msg_u_${Date.now()}`,
        userId: req.userId,
        conversationId: convId,
        role: "user",
        content: rawMessage,
        createdAt: nowIso,
      });
      inMemoryAiMessages.push({
        id: `msg_a_${Date.now() + 1}`,
        userId: req.userId,
        conversationId: convId,
        role: "assistant",
        content: reply,
        createdAt: nowIso,
      });

      return res.json({
        success: true,
        configured: false,
        isAiGenerated: false,
        conversationId: convId,
        language,
        reply,
      });
    }

    // Retrieve authenticated student info for personalization
    let studentUser = null;
    if (process.env.MONGODB_URI) {
      try {
        studentUser = await prisma.user.findUnique({
          where: { id: req.userId },
          select: { name: true, grade: true },
        });
      } catch (dbErr) {
        console.warn("Prisma student fetch fallback:", dbErr.message);
      }
    }
    if (!studentUser) {
      studentUser = inMemoryUsers.get(req.userId) || { name: "Student", grade: "all" };
    }

    let studentGrade = req.body.grade || studentUser?.grade || "all";
    if (curriculumContext && (curriculumContext.educationType || curriculumContext.classGrade)) {
      const edLevel = (curriculumContext.educationType || "").toLowerCase();
      if (edLevel.includes("diploma")) studentGrade = "diploma";
      else if (edLevel.includes("primary")) studentGrade = "primary";
      else if (edLevel.includes("middle")) studentGrade = "middle";
      else if (edLevel.includes("secondary") || edLevel.includes("10")) studentGrade = "secondary";
      else if (edLevel.includes("senior") || edLevel.includes("12")) studentGrade = "senior";
    }

    // Load recent conversation history (last 16 messages)
    let history = [];
    if (process.env.MONGODB_URI) {
      try {
        history = await prisma.aiMessage.findMany({
          where: { conversationId: convId, userId: req.userId },
          orderBy: { createdAt: "asc" },
          take: 16,
        });
      } catch (dbErr) {
        console.warn("Prisma history fetch fallback:", dbErr.message);
      }
    }
    if (!history || history.length === 0) {
      history = inMemoryAiMessages
        .filter((m) => m.conversationId === convId && m.userId === req.userId)
        .slice(-16);
    }

    const systemPrompt = buildTeacherSystemPrompt({
      language,
      grade: studentGrade,
      style,
      studentName: studentUser?.name || "",
      videoContext,
      curriculumContext,
    });

    const messages = [
      { role: "system", content: systemPrompt },
      ...history.map((m) => ({
        role: m.role === "assistant" ? "assistant" : "user",
        content: m.content,
      })),
      { role: "user", content: rawMessage },
    ];

    const result = await callAi(messages);
    if (!result.ok) {
      return res.status(502).json({
        success: false,
        configured: true,
        message: result.reason || "The AI teacher could not generate a response. Please try again.",
      });
    }

    // Save user message and AI response safely
    const nowIso = new Date().toISOString();
    inMemoryAiMessages.push({
      id: `msg_u_${Date.now()}`,
      userId: req.userId,
      conversationId: convId,
      role: "user",
      content: rawMessage,
      createdAt: nowIso,
    });
    inMemoryAiMessages.push({
      id: `msg_a_${Date.now() + 1}`,
      userId: req.userId,
      conversationId: convId,
      role: "assistant",
      content: result.text,
      createdAt: nowIso,
    });

    if (process.env.MONGODB_URI) {
      try {
        await prisma.aiMessage.createMany({
          data: [
            { userId: req.userId, conversationId: convId, role: "user", content: rawMessage },
            { userId: req.userId, conversationId: convId, role: "assistant", content: result.text },
          ],
        });
      } catch (dbErr) {
        console.warn("Prisma aiMessage save fallback:", dbErr.message);
      }
    }

    res.json({
      success: true,
      configured: true,
      isAiGenerated: true,
      conversationId: convId,
      language,
      reply: result.text,
    });
  } catch (error) {
    console.error("AI tutor error:", error);
    res.status(500).json({ success: false, message: "AI tutor request failed" });
  }
});

// ============================================================================
// PHASE 2: EDUCATIONAL VIDEOS & YOUTUBE LIBRARY
// ============================================================================

// GET /api/videos/curriculum — Dynamic curriculum metadata for Classes 1–12 and Diploma / Polytechnic
app.get("/api/videos/curriculum", (req, res) => {
  res.json({
    success: true,
    educationLevels: EDUCATION_LEVELS,
    boards: BOARDS,
    diplomaBranches: DIPLOMA_BRANCHES,
    diplomaSchemes: DIPLOMA_SCHEMES,
    schoolSubjectsByLevel: SCHOOL_SUBJECTS_BY_LEVEL,
    diplomaSubjectsByBranchAndSem: DIPLOMA_SUBJECTS_BY_BRANCH_AND_SEM,
  });
});

// GET /api/videos — Search and filter educational videos (YouTube API or Curated)
app.get("/api/videos", async (req, res) => {
  try {
    const {
      educationLevel = "all",
      grade = "all",
      classGrade = "all",
      board = "all",
      stream = "all",
      branch = "all",
      scheme = "all",
      semester = "all",
      subject = "all",
      topic = "all",
      chapter = "all",
      language = "all",
      verificationStatus = "all",
      q = "",
      page = 1,
    } = req.query;

    const limit = Math.min(Math.max(Number(req.query.limit) || 24, 1), 100);
    const query = String(q || "").toLowerCase().trim();
    const apiKey = process.env.YOUTUBE_API_KEY ? process.env.YOUTUBE_API_KEY.trim() : null;

    // Optional YouTube Data API live search: only triggered when live=true, query is non-empty, and API key exists
    if (apiKey && query && req.query.live === "true") {
      try {
        const langParam = ["en", "hi", "mr", "te"].includes(language) ? `&relevanceLanguage=${language}` : "";
        const searchUrl = `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&videoEmbeddable=true&maxResults=${limit}&q=${encodeURIComponent(query + " educational school lesson")}${langParam}&key=${apiKey}`;

        const ytRes = await fetch(searchUrl);
        if (ytRes.ok) {
          const ytData = await ytRes.json();
          if (Array.isArray(ytData.items) && ytData.items.length > 0) {
            const apiVideos = ytData.items
              .filter((item) => item.id?.videoId)
              .map((item) => {
                const videoId = item.id.videoId;
                return {
                  id: videoId,
                  title: item.snippet?.title || "Educational Lesson",
                  channel: item.snippet?.channelTitle || "Educational Channel",
                  language: language !== "all" ? language : "en",
                  topic: topic !== "all" ? topic : "General Science",
                  educationLevel: educationLevel !== "all" ? educationLevel : "secondary",
                  grade: grade !== "all" ? grade : "All Grades",
                  subject: subject !== "all" ? subject : (topic !== "all" ? topic : "General"),
                  duration: "Lesson",
                  description: item.snippet?.description || "",
                  thumbnailUrl: item.snippet?.thumbnails?.medium?.url || `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`,
                  youtubeUrl: `https://www.youtube.com/watch?v=${videoId}`,
                  embedUrl: `https://www.youtube-nocookie.com/embed/${videoId}`,
                  verificationStatus: "unverified",
                  isVerified: false,
                };
              });

            if (apiVideos.length > 0) {
              return res.json({
                success: true,
                source: "youtube_api",
                total: apiVideos.length,
                page: 1,
                totalPages: 1,
                videos: apiVideos,
              });
            }
          }
        }
      } catch (ytErr) {
        console.warn("YouTube Data API search failed, falling back to curated library:", ytErr.message);
      }
    }

    // Curated Library filtering using filterVideos helper
    const filterResult = filterVideos({
      educationLevel,
      grade,
      classGrade,
      board,
      stream,
      branch,
      scheme,
      semester,
      subject,
      topic,
      chapter,
      language,
      verificationStatus,
      q: query,
      limit,
      page,
    });

    res.json({
      success: true,
      source: "curated",
      total: filterResult.total,
      page: filterResult.page,
      totalPages: filterResult.totalPages,
      videos: filterResult.videos,
    });
  } catch (error) {
    console.error("GET /api/videos error:", error);
    res.status(500).json({ success: false, message: "Failed to retrieve educational videos" });
  }
});

// POST /api/videos/validate — Validate submitted YouTube URL/ID for teacher and student material
app.post("/api/videos/validate", authenticate, async (req, res) => {
  try {
    const rawInput = String(req.body.urlOrId || "").trim();
    if (!rawInput) {
      return res.status(400).json({ success: false, message: "YouTube URL or video ID is required" });
    }

    const videoId = extractYouTubeId(rawInput);
    if (!videoId) {
      return res.status(400).json({
        success: false,
        message: "Invalid YouTube URL or ID format. Please provide a standard YouTube video link or 11-character ID.",
      });
    }

    const validatedData = {
      success: true,
      videoId,
      youtubeUrl: `https://www.youtube.com/watch?v=${videoId}`,
      embedUrl: `https://www.youtube-nocookie.com/embed/${videoId}`,
      thumbnailUrl: `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`,
      embeddable: true,
      message: "Valid YouTube video verified",
    };

    // If YOUTUBE_API_KEY is available, optionally fetch video title and embeddable status
    const apiKey = process.env.YOUTUBE_API_KEY ? process.env.YOUTUBE_API_KEY.trim() : null;
    if (apiKey) {
      try {
        const metaUrl = `https://www.googleapis.com/youtube/v3/videos?part=snippet,status&id=${videoId}&key=${apiKey}`;
        const metaRes = await fetch(metaUrl);
        if (metaRes.ok) {
          const metaData = await metaRes.json();
          const item = metaData.items?.[0];
          if (item) {
            validatedData.title = item.snippet?.title;
            validatedData.channel = item.snippet?.channelTitle;
            validatedData.embeddable = item.status?.embeddable !== false;
            if (item.snippet?.thumbnails?.medium?.url) {
              validatedData.thumbnailUrl = item.snippet.thumbnails.medium.url;
            }
          }
        }
      } catch (metaErr) {
        console.warn("YouTube metadata check skipped:", metaErr.message);
      }
    }

    res.json(validatedData);
  } catch (error) {
    console.error("POST /api/videos/validate error:", error);
    res.status(500).json({ success: false, message: "Failed to validate video" });
  }
});


// ------------------------- AI content generation --------------------------
// Teacher-only. AI generates candidate questions for teacher review.
// Candidate questions are never auto-published or saved automatically.
// Teachers review/edit them and save explicitly as DRAFT.

app.post("/api/ai/generate-content", requireRole("TEACHER"), async (req, res) => {
  try {
    const { subject, chapter, topic, difficulty, count } = req.body;
    if (!topic) {
      return res.status(400).json({ success: false, message: "topic is required" });
    }
    const n = Math.min(Math.max(Number(count) || 5, 1), 20);
    const level = ["EASY", "MEDIUM", "HARD"].includes(difficulty) ? difficulty : "MEDIUM";

    if (!aiConfigured()) {
      return res.status(503).json({
        success: false,
        configured: false,
        message:
          "AI content generation is not configured. Set AI_PROVIDER, AI_API_KEY and AI_MODEL on the backend.",
      });
    }

    const prompt = `Generate ${n} ${level} multiple-choice questions on the topic "${topic}"` +
      (chapter ? ` from the chapter "${chapter}"` : "") +
      (subject ? ` for ${subject}` : "") +
      `. Return JSON of the form {"questions":[{"text":"...","optionA":"...","optionB":"...","optionC":"...","optionD":"...","correct":0,"explanation":"..."}]} where correct is the 0-based index of the right option (0 for A, 1 for B, 2 for C, 3 for D).`;

    const result = await callAi(
      [{ role: "system", content: "You generate curriculum-aligned MCQs and always respond with valid JSON." },
       { role: "user", content: prompt }],
      { json: true }
    );
    if (!result.ok) {
      return res.status(502).json({ success: false, message: result.reason });
    }

    let parsed;
    try {
      parsed = JSON.parse(result.text);
    } catch {
      return res.status(502).json({ success: false, message: "AI returned invalid JSON" });
    }
    const rawQuestions = Array.isArray(parsed?.questions) ? parsed.questions : [];

    // Rigorously validate each question structure and normalize correct index
    const questions = [];
    for (const q of rawQuestions) {
      if (!q || typeof q !== "object") continue;
      const text = String(q.text || "").trim();
      const optionA = String(q.optionA || "").trim();
      const optionB = String(q.optionB || "").trim();
      const optionC = String(q.optionC || "").trim();
      const optionD = String(q.optionD || "").trim();
      if (!text || !optionA || !optionB || !optionC || !optionD) continue;

      let correct = Number(q.correct);
      if (isNaN(correct) || correct < 0 || correct > 3) {
        if (typeof q.correct === "string") {
          const c = q.correct.trim().toUpperCase();
          correct = c === "B" ? 1 : c === "C" ? 2 : c === "D" ? 3 : 0;
        } else {
          correct = 0;
        }
      }

      questions.push({
        text,
        optionA,
        optionB,
        optionC,
        optionD,
        correct,
        explanation: q.explanation ? String(q.explanation).trim() : null,
      });
    }

    res.json({ success: true, configured: true, questions });
  } catch (error) {
    console.error("AI content generation error:", error);
    res.status(500).json({ success: false, message: "Content generation failed" });
  }
});

// Save reviewed teacher questions (from AI or manual review) strictly as DRAFT.
// Never auto-publish generated or newly drafted content.
app.post("/api/teacher/questions", requireRole("TEACHER"), async (req, res) => {
  try {
    const { topicId, questions, difficulty } = req.body;
    if (!topicId) {
      return res.status(400).json({ success: false, message: "topicId is required" });
    }
    if (!Array.isArray(questions) || questions.length === 0) {
      return res.status(400).json({ success: false, message: "At least one question is required" });
    }

    const topic = await prisma.topic.findUnique({ where: { id: String(topicId) } });
    if (!topic) {
      return res.status(404).json({ success: false, message: "Topic not found with the provided ID" });
    }

    const level = ["EASY", "MEDIUM", "HARD"].includes(difficulty) ? difficulty : "MEDIUM";
    const cleanQuestions = [];

    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      const text = String(q.text || "").trim();
      const optionA = String(q.optionA || "").trim();
      const optionB = String(q.optionB || "").trim();
      const optionC = String(q.optionC || "").trim();
      const optionD = String(q.optionD || "").trim();
      const correct = Number(q.correct);

      if (!text) {
        return res.status(400).json({ success: false, message: `Question #${i + 1} is missing question text` });
      }
      if (!optionA || !optionB || !optionC || !optionD) {
        return res.status(400).json({ success: false, message: `Question #${i + 1} must have all 4 options (A, B, C, D)` });
      }
      if (isNaN(correct) || correct < 0 || correct > 3) {
        return res.status(400).json({ success: false, message: `Question #${i + 1} has an invalid correct answer index (must be 0-3)` });
      }

      cleanQuestions.push({
        topicId: topic.id,
        text,
        optionA,
        optionB,
        optionC,
        optionD,
        correct,
        explanation: q.explanation ? String(q.explanation).trim() : null,
        difficulty: level,
        source: "AI",
        status: "DRAFT", // Enforce DRAFT status
      });
    }

    const result = await prisma.question.createMany({
      data: cleanQuestions,
    });

    res.status(201).json({
      success: true,
      count: result.count,
      message: `Successfully saved ${result.count} reviewed questions as DRAFT.`,
    });
  } catch (error) {
    console.error("Save teacher questions error:", error);
    res.status(500).json({ success: false, message: "Failed to save questions" });
  }
});

// ------------------------------ Payments ----------------------------------
// Razorpay. The key SECRET never leaves the backend; only the public key id is
// exposed. Payment success is granted only after server-side signature check.

function razorpayConfigured() {
  return Boolean(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET);
}

function safeEqual(a, b) {
  const bufA = Buffer.from(String(a));
  const bufB = Buffer.from(String(b));
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

app.get("/api/payments/config", (req, res) => {
  res.json({
    success: true,
    configured: razorpayConfigured(),
    keyId: process.env.RAZORPAY_KEY_ID || null,
  });
});

app.post("/api/payments/order", authenticate, async (req, res) => {
  try {
    const { courseId } = req.body;
    if (!courseId) {
      return res.status(400).json({ success: false, message: "courseId is required" });
    }
    const course = await prisma.course.findUnique({ where: { id: String(courseId) } });
    if (!course) {
      return res.status(404).json({ success: false, message: "Course not found" });
    }
    if (req.role !== "STUDENT") {
      return res.status(403).json({ success: false, message: "Only students can purchase course enrollments" });
    }
    if (course.price <= 0) {
      return res.status(400).json({ success: false, message: "This course is free; enroll directly" });
    }

    const existingEnrollment = await prisma.enrollment.findUnique({
      where: {
        courseId_studentId: { courseId: course.id, studentId: req.userId },
      },
    });
    if (existingEnrollment) {
      return res.status(409).json({ success: false, message: "You are already enrolled in this course" });
    }
    if (!razorpayConfigured()) {
      return res.status(503).json({ success: false, message: "Payments are not configured" });
    }

    const auth = Buffer.from(
      `${process.env.RAZORPAY_KEY_ID}:${process.env.RAZORPAY_KEY_SECRET}`
    ).toString("base64");

    const resp = await fetch("https://api.razorpay.com/v1/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Basic ${auth}` },
      body: JSON.stringify({
        amount: course.price,
        currency: course.currency || "INR",
        receipt: `course_${course.id}_${Date.now()}`,
        notes: { courseId: course.id, userId: req.userId },
      }),
    });

    if (!resp.ok) {
      return res.status(502).json({ success: false, message: "Failed to create Razorpay order" });
    }
    const order = await resp.json();

    await prisma.payment.create({
      data: {
        userId: req.userId,
        courseId: course.id,
        amount: course.price,
        currency: course.currency || "INR",
        status: "CREATED",
        razorpayOrderId: order.id,
      },
    });

    res.json({
      success: true,
      order: { id: order.id, amount: order.amount, currency: order.currency },
      course: { id: course.id, title: course.title },
    });
  } catch (error) {
    console.error("Payment order error:", error);
    res.status(500).json({ success: false, message: "Failed to create order" });
  }
});

app.post("/api/payments/verify", authenticate, async (req, res) => {
  try {
    const { orderId, paymentId, signature } = req.body;
    if (!orderId || !paymentId || !signature) {
      return res.status(400).json({
        success: false,
        message: "orderId, paymentId and signature are required",
      });
    }
    if (!razorpayConfigured()) {
      return res.status(503).json({ success: false, message: "Payments are not configured" });
    }

    const payment = await prisma.payment.findUnique({ where: { razorpayOrderId: String(orderId) } });
    if (!payment) {
      return res.status(404).json({ success: false, message: "Order not found" });
    }
    if (payment.userId !== req.userId) {
      return res.status(403).json({ success: false, message: "Forbidden" });
    }
    // Idempotent: a verified payment already granted access.
    if (payment.status === "PAID") {
      return res.json({ success: true, message: "Payment already verified", status: "PAID" });
    }

    const expected = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(`${orderId}|${paymentId}`)
      .digest("hex");

    if (!safeEqual(expected, signature)) {
      await prisma.payment.update({
        where: { id: payment.id },
        data: { status: "FAILED", razorpayPaymentId: paymentId, razorpaySignature: signature },
      });
      return res.status(400).json({ success: false, message: "Invalid payment signature" });
    }

    await prisma.payment.update({
      where: { id: payment.id },
      data: { status: "PAID", razorpayPaymentId: paymentId, razorpaySignature: signature },
    });

    // Grant access only after successful verification.
    if (payment.courseId) {
      const course = await prisma.course.findUnique({ where: { id: payment.courseId } });
      await prisma.enrollment.upsert({
        where: {
          courseId_studentId: { courseId: payment.courseId, studentId: req.userId },
        },
        update: { status: "ENROLLED" },
        create: {
          courseId: payment.courseId,
          studentId: req.userId,
          teacherId: course ? course.teacherId : null,
          status: "ENROLLED",
        },
      });
    }

    res.json({ success: true, message: "Payment verified", status: "PAID" });
  } catch (error) {
    console.error("Payment verify error:", error);
    res.status(500).json({ success: false, message: "Failed to verify payment" });
  }
});

// Secure, idempotent webhook. Signature is computed over the raw body.
app.post("/api/payments/webhook", async (req, res) => {
  try {
    const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
    const signature = req.headers["x-razorpay-signature"];
    if (!secret || !signature || !req.rawBody) {
      return res.status(400).json({ success: false, message: "Missing webhook signature" });
    }
    const expected = crypto.createHmac("sha256", secret).update(req.rawBody).digest("hex");
    if (!safeEqual(expected, signature)) {
      return res.status(400).json({ success: false, message: "Invalid webhook signature" });
    }

    const event = JSON.parse(req.rawBody.toString("utf8"));
    const entity = event?.payload?.payment?.entity;
    if (entity?.order_id) {
      const payment = await prisma.payment.findUnique({
        where: { razorpayOrderId: entity.order_id },
      });
      if (payment && payment.status !== "PAID") {
        const status = event.event === "payment.captured" ? "PAID" : "FAILED";
        await prisma.payment.update({
          where: { id: payment.id },
          data: { status, razorpayPaymentId: entity.id || payment.razorpayPaymentId },
        });
      }
    }
    res.json({ success: true, message: "Webhook processed" });
  } catch (error) {
    console.error("Webhook error:", error);
    res.status(400).json({ success: false, message: "Webhook processing failed" });
  }
});

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`LUCOUS backend running on http://localhost:${PORT}`);
  });
}

module.exports = app;