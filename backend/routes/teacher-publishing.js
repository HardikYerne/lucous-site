/**
 * Teacher Publishing Router for LUCOUS Phase 3.4
 * 
 * Enforces:
 * 1. Authenticated teacher role.
 * 2. Cross-teacher ownership isolation.
 * 3. Validation before publication.
 * 4. Cryptographic access code generation and assignment.
 * 5. Publishing lifecycle management (publish, unpublish, list published).
 */

const express = require("express");
const {
  publishTeacherContent,
  unpublishTeacherContent,
  getTeacherPublishedContent,
} = require("../services/publishing-service");

function createTeacherPublishingRouter(prisma, requireTeacher) {
  const router = express.Router();

  // POST /api/teacher/publish — Publish a lesson or assessment draft
  router.post("/publish", requireTeacher, async (req, res) => {
    try {
      const { contentType, contentId } = req.body;
      if (!contentType || !contentId) {
        return res.status(400).json({
          success: false,
          message: "Both contentType ('LESSON' | 'ASSESSMENT') and contentId are required.",
        });
      }

      const result = await publishTeacherContent(prisma, {
        teacherId: req.userId,
        contentType,
        contentId,
      });

      return res.status(200).json(result);
    } catch (err) {
      const status = err.statusCode || 500;
      if (status >= 500) {
        console.error("[Teacher Publishing Error]", err);
      } else {
        console.warn(`[Teacher Publishing Warning] (${status}) ${err.message}`);
      }
      return res.status(status).json({
        success: false,
        message: err.message || "Failed to publish content.",
        details: err.details || null,
      });
    }
  });

  // POST /api/teacher/unpublish — Revoke publication and student access
  router.post("/unpublish", requireTeacher, async (req, res) => {
    try {
      const { contentType, contentId } = req.body;
      if (!contentType || !contentId) {
        return res.status(400).json({
          success: false,
          message: "Both contentType and contentId are required.",
        });
      }

      const result = await unpublishTeacherContent(prisma, {
        teacherId: req.userId,
        contentType,
        contentId,
      });

      return res.status(200).json(result);
    } catch (err) {
      const status = err.statusCode || 500;
      if (status >= 500) {
        console.error("[Teacher Unpublishing Error]", err);
      } else {
        console.warn(`[Teacher Unpublishing Warning] (${status}) ${err.message}`);
      }
      return res.status(status).json({
        success: false,
        message: err.message || "Failed to unpublish content.",
      });
    }
  });

  // GET /api/teacher/published — List all published items with access codes
  router.get("/published", requireTeacher, async (req, res) => {
    try {
      const items = await getTeacherPublishedContent(prisma, req.userId);
      return res.status(200).json({
        success: true,
        count: items.length,
        items,
      });
    } catch (err) {
      console.error("[Teacher Published List Error]", err);
      return res.status(500).json({
        success: false,
        message: err.message || "Failed to list published content.",
      });
    }
  });

  return router;
}

module.exports = {
  createTeacherPublishingRouter,
};
