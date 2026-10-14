/**
 * Student Access Router for LUCOUS Phase 3.4
 * 
 * Provides:
 * 1. Public code lookup and verification for student learning.
 * 2. Rate limiting to prevent brute-force code guessing.
 * 3. Sanitized content delivery (excluding private teacher info, database internals, and raw answer keys).
 * 4. Interactive answer verification with explanations.
 */

const express = require("express");
const { classCodeMiddleware } = require("../services/class-code-service");
const {
  getStudentContentByAccessCode,
  checkStudentAnswer,
  startStudentAssessmentSession,
  submitStudentAssessment,
} = require("../services/publishing-service");

// Simple sliding window in-memory rate limiter per IP
const attemptsPerIp = new Map();
const RATE_LIMIT_WINDOW_MS = 5 * 60 * 1000; // 5 minutes
const MAX_ATTEMPTS = 40; // Max 40 code verification requests per 5 minutes

function checkRateLimit(ip) {
  const now = Date.now();
  const record = attemptsPerIp.get(ip) || { count: 0, resetAt: now + RATE_LIMIT_WINDOW_MS };

  if (now > record.resetAt) {
    record.count = 1;
    record.resetAt = now + RATE_LIMIT_WINDOW_MS;
    attemptsPerIp.set(ip, record);
    return true;
  }

  record.count += 1;
  attemptsPerIp.set(ip, record);

  return record.count <= MAX_ATTEMPTS;
}

function createStudentAccessRouter(prisma) {
  const router = express.Router();

  // Class-code tokens ("LC-...::LU-...") are validated (not expired/revoked) here
  // and swapped for the plain item code. Normal item codes pass through untouched.
  router.use(classCodeMiddleware(prisma));

  // POST /api/student/access/verify — Verify code and retrieve published lesson/assessment
  router.post("/verify", async (req, res) => {
    try {
      const clientIp = req.ip || req.connection?.remoteAddress || "unknown_ip";
      if (!checkRateLimit(clientIp)) {
        return res.status(429).json({
          success: false,
          message: "Too many code verification attempts. Please wait a few minutes before trying again.",
        });
      }

      const { code } = req.body;
      if (!code || typeof code !== "string" || !code.trim()) {
        return res.status(400).json({
          success: false,
          message: "An access code is required.",
        });
      }

      const item = await getStudentContentByAccessCode(prisma, code.trim());
      if (!item) {
        return res.status(404).json({
          success: false,
          message: "Invalid access code, or this content is not currently published.",
        });
      }

      return res.status(200).json({
        success: true,
        item,
      });
    } catch (err) {
      console.error("[Student Access Verify Error]", err);
      return res.status(500).json({
        success: false,
        message: "Failed to verify access code.",
      });
    }
  });

  // POST /api/student/access/check-answer — Verify student answer for practice
  router.post("/check-answer", async (req, res) => {
    try {
      const { code, questionId, studentAnswer } = req.body;
      if (!code || !questionId) {
        return res.status(400).json({
          success: false,
          message: "Access code and question ID are required.",
        });
      }

      const result = await checkStudentAnswer(prisma, {
        rawCode: code,
        questionId,
        studentAnswer,
      });

      return res.status(200).json(result);
    } catch (err) {
      console.error("[Student Check Answer Error]", err);
      const status = err.statusCode || 500;
      return res.status(status).json({
        success: false,
        message: err.message || "Failed to check answer.",
      });
    }
  });

  // POST /api/student/access/start-assessment — Start session & obtain server-enforced deadline
  router.post("/start-assessment", async (req, res) => {
    try {
      const { code, studentId } = req.body;
      if (!code || typeof code !== "string" || !code.trim()) {
        return res.status(400).json({
          success: false,
          message: "Access code is required.",
        });
      }

      const session = await startStudentAssessmentSession(prisma, {
        rawCode: code.trim(),
        studentId,
      });

      return res.status(200).json(session);
    } catch (err) {
      console.error("[Student Start Assessment Error]", err);
      const status = err.statusCode || 500;
      return res.status(status).json({
        success: false,
        message: err.message || "Failed to start assessment session.",
      });
    }
  });

  // POST /api/student/access/submit-assessment — Secure server-side grading of complete assessment
  router.post("/submit-assessment", async (req, res) => {
    try {
      const { code, sessionId, answers, studentId } = req.body;
      if (!code || typeof code !== "string" || !code.trim()) {
        return res.status(400).json({
          success: false,
          message: "Access code is required.",
        });
      }

      if (!answers) {
        return res.status(400).json({
          success: false,
          message: "Submission answers are required.",
        });
      }

      const result = await submitStudentAssessment(prisma, {
        rawCode: code.trim(),
        sessionId,
        answers,
        studentId,
      });

      return res.status(200).json(result);
    } catch (err) {
      console.error("[Student Submit Assessment Error]", err);
      const status = err.statusCode || 500;
      return res.status(status).json({
        success: false,
        code: err.code || undefined,
        message: err.message || "Failed to submit assessment.",
      });
    }
  });

  return router;
}

module.exports = {
  createStudentAccessRouter,
  attemptsPerIp,
};
