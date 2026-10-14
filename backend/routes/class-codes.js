/**
 * Class Access Code routes for LUCOUS
 *
 * Teacher (approved, authenticated):
 *   POST /api/teacher/class-codes              create a time-limited code
 *   GET  /api/teacher/class-codes              list own codes (+ status)
 *   POST /api/teacher/class-codes/:id/revoke   turn a code off immediately
 *
 * Student (public, rate limited):
 *   POST /api/student/access/class/verify      open all materials with a valid code
 */

const express = require("express");
const {
  createClassCode,
  listClassCodes,
  revokeClassCode,
  getUsableClassCode,
  buildClassBundle,
  statusOf,
  MIN_DURATION_MINUTES,
  MAX_DURATION_MINUTES,
} = require("../services/class-code-service");
const { getTeacherPublishedContent } = require("../services/publishing-service");

function toTeacherView(record, publishedCount) {
  return {
    id: record.id,
    code: record.code,
    title: record.title || null,
    status: statusOf(record),
    createdAt: new Date(record.createdAt).toISOString(),
    expiresAt: new Date(record.expiresAt).toISOString(),
    revokedAt: record.revokedAt ? new Date(record.revokedAt).toISOString() : null,
    publishedCount,
  };
}

function createTeacherClassCodesRouter(prisma, requireTeacher) {
  const router = express.Router();

  router.post("/class-codes", requireTeacher, async (req, res) => {
    try {
      const { title, durationMinutes } = req.body || {};
      const record = await createClassCode(prisma, {
        teacherId: req.userId,
        title,
        durationMinutes,
      });
      const published = await getTeacherPublishedContent(prisma, req.userId);
      return res.status(201).json({
        success: true,
        message: "Class code created.",
        item: toTeacherView(record, published.length),
        limits: { minMinutes: MIN_DURATION_MINUTES, maxMinutes: MAX_DURATION_MINUTES },
      });
    } catch (err) {
      const status = err.statusCode || 500;
      if (status >= 500) console.error("[Class Code Create Error]", err);
      return res.status(status).json({
        success: false,
        message: err.message || "Failed to create class code.",
      });
    }
  });

  router.get("/class-codes", requireTeacher, async (req, res) => {
    try {
      const records = await listClassCodes(prisma, req.userId);
      const published = await getTeacherPublishedContent(prisma, req.userId);
      return res.status(200).json({
        success: true,
        publishedCount: published.length,
        items: records.map((r) => toTeacherView(r, published.length)),
      });
    } catch (err) {
      console.error("[Class Code List Error]", err);
      return res.status(500).json({ success: false, message: "Failed to load class codes." });
    }
  });

  router.post("/class-codes/:id/revoke", requireTeacher, async (req, res) => {
    try {
      const record = await revokeClassCode(prisma, {
        teacherId: req.userId,
        id: req.params.id,
      });
      const published = await getTeacherPublishedContent(prisma, req.userId);
      return res.status(200).json({
        success: true,
        message: "Class code turned off.",
        item: toTeacherView(record, published.length),
      });
    } catch (err) {
      const status = err.statusCode || 500;
      if (status >= 500) console.error("[Class Code Revoke Error]", err);
      return res.status(status).json({
        success: false,
        message: err.message || "Failed to turn off class code.",
      });
    }
  });

  return router;
}

// Sliding-window in-memory rate limiter per IP (brute-force protection).
const attemptsPerIp = new Map();
const WINDOW_MS = 5 * 60 * 1000;
const MAX_ATTEMPTS = 30;

function withinRateLimit(ip) {
  const now = Date.now();
  const record = attemptsPerIp.get(ip) || { count: 0, resetAt: now + WINDOW_MS };
  if (now > record.resetAt) {
    record.count = 0;
    record.resetAt = now + WINDOW_MS;
  }
  record.count += 1;
  attemptsPerIp.set(ip, record);
  return record.count <= MAX_ATTEMPTS;
}

function createStudentClassAccessRouter(prisma) {
  const router = express.Router();

  router.post("/verify", async (req, res) => {
    try {
      const ip = req.ip || (req.connection && req.connection.remoteAddress) || "unknown_ip";
      if (!withinRateLimit(ip)) {
        return res.status(429).json({
          success: false,
          message: "Too many attempts. Please wait a few minutes before trying again.",
        });
      }

      const { code } = req.body || {};
      if (!code || typeof code !== "string" || !code.trim()) {
        return res.status(400).json({ success: false, message: "A class code is required." });
      }

      const usable = await getUsableClassCode(prisma, code.trim());
      if (usable.error) {
        return res
          .status(usable.error.status)
          .json({ success: false, message: usable.error.message });
      }

      const bundle = await buildClassBundle(prisma, usable.record);
      return res.status(200).json({ success: true, bundle });
    } catch (err) {
      console.error("[Class Code Verify Error]", err);
      return res.status(500).json({ success: false, message: "Failed to verify class code." });
    }
  });

  return router;
}

module.exports = { createTeacherClassCodesRouter, createStudentClassAccessRouter };
