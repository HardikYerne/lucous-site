/**
 * Teacher Lesson Generation and Draft Management Routes for LUCOUS
 * 
 * Enforces:
 * 1. Authenticated teacher role verification.
 * 2. Cross-teacher ownership isolation for materials and lesson drafts.
 * 3. Document retrieval from durable storage with missing-file detection.
 * 4. Safe, untrusted document processing and size limits.
 * 5. Grounded AI lesson generation with strict server-side schema validation.
 * 6. Explicit persistence failure reporting (no silent fake persistence).
 * 7. Draft viewing, updating, and deletion by author.
 */

const express = require("express");
const { getStorageAdapter } = require("../storage/storage-adapter");
const { processDocument } = require("../services/document-processor");
const {
  generateLessonDraft,
  validateLessonSchema,
  getAiConfig,
} = require("../services/lesson-generator");

// In-memory fallback repository for drafts when MongoDB is offline in local dev/test
const inMemoryDrafts = new Map();

function createTeacherLessonsRouter(prisma, requireTeacher, materialFinder) {
  const router = express.Router();

  const isEphemeralAllowed = () => {
    if (process.env.ALLOW_EPHEMERAL_DEV_STORAGE === "false") {
      return false;
    }
    return (
      process.env.ALLOW_EPHEMERAL_DEV_STORAGE === "true" ||
      process.env.NODE_ENV === "test"
    );
  };

  /**
   * Helper to retrieve uploaded material by ID with ownership check
   */
  async function getMaterialForTeacher(materialId, teacherId) {
    // If a custom finder is provided (e.g. from teacher-materials router or tests)
    if (typeof materialFinder === "function") {
      const mat = await materialFinder(materialId);
      if (mat && mat.teacherId === teacherId) return mat;
      return null;
    }

    if (prisma && prisma.uploadedMaterial) {
      try {
        const mat = await prisma.uploadedMaterial.findUnique({
          where: { id: materialId },
        });
        if (mat && mat.teacherId === teacherId) {
          return { ...mat, persisted: true, storageMode: "mongodb" };
        }
        return null;
      } catch (dbErr) {
        console.warn("[Teacher Lessons] MongoDB material lookup failed:", dbErr.message);
        if (!isEphemeralAllowed()) {
          throw new Error(`Database connection failed: MongoDB error (${dbErr.message})`);
        }
      }
    } else if (!isEphemeralAllowed()) {
      throw new Error("Database connection failed: Prisma client or MongoDB is not configured.");
    }

    // Check shared inMemoryMaterials if accessible
    const { inMemoryMaterials } = require("./teacher-materials");
    const memMat = inMemoryMaterials.get(materialId);
    if (memMat && memMat.teacherId === teacherId) {
      return memMat;
    }
    return null;
  }

  /**
   * Creates a LessonDraft record in database or fallback
   */
  async function createDraftRecord(data) {
    if (prisma && prisma.lessonDraft) {
      try {
        const record = await prisma.lessonDraft.create({ data });
        return { ...record, persisted: true, storageMode: "mongodb" };
      } catch (dbErr) {
        console.warn("[Teacher Lessons] MongoDB draft create failed:", dbErr.message);
        if (!isEphemeralAllowed()) {
          throw new Error(`Database persistence failed: MongoDB error (${dbErr.message}). Draft generation aborted.`);
        }
      }
    } else if (!isEphemeralAllowed()) {
      throw new Error("Database persistence failed: Prisma client or MongoDB is not configured. Draft generation aborted.");
    }

    // Ephemeral in-memory fallback only when permitted
    const id = `draft_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    const record = {
      id,
      ...data,
      createdAt: new Date(),
      updatedAt: new Date(),
      persisted: false,
      storageMode: "in_memory_ephemeral",
    };
    inMemoryDrafts.set(id, record);
    return record;
  }

  /**
   * Finds drafts belonging to a teacher
   */
  async function findDraftsForTeacher(teacherId, filter = {}) {
    if (prisma && prisma.lessonDraft) {
      try {
        const where = { teacherId, ...filter };
        const list = await prisma.lessonDraft.findMany({
          where,
          orderBy: { createdAt: "desc" },
          include: {
            sourceMaterial: {
              select: {
                id: true,
                originalName: true,
                fileType: true,
                fileSize: true,
                subjectName: true,
                chapterName: true,
                topicName: true,
              },
            },
          },
        });
        return {
          drafts: list,
          persisted: true,
          storageMode: "mongodb",
        };
      } catch (dbErr) {
        console.warn("[Teacher Lessons] MongoDB findDrafts failed:", dbErr.message);
        if (!isEphemeralAllowed()) {
          throw new Error(`Database connection failed: MongoDB error (${dbErr.message})`);
        }
      }
    } else if (!isEphemeralAllowed()) {
      throw new Error("Database connection failed: Prisma client or MongoDB is not configured.");
    }

    const list = [];
    for (const draft of inMemoryDrafts.values()) {
      if (draft.teacherId === teacherId) {
        let match = true;
        if (filter.sourceMaterialId && draft.sourceMaterialId !== filter.sourceMaterialId) match = false;
        if (filter.status && draft.status !== filter.status) match = false;
        if (filter.educationLevel && draft.educationLevel !== filter.educationLevel) match = false;
        if (match) list.push(draft);
      }
    }
    return {
      drafts: list.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)),
      persisted: false,
      storageMode: "in_memory_ephemeral",
    };
  }

  /**
   * Finds single draft by ID
   */
  async function findDraftById(id) {
    if (prisma && prisma.lessonDraft) {
      try {
        const record = await prisma.lessonDraft.findUnique({
          where: { id },
          include: {
            sourceMaterial: {
              select: {
                id: true,
                originalName: true,
                fileType: true,
                fileSize: true,
                subjectName: true,
                chapterName: true,
                topicName: true,
              },
            },
          },
        });
        if (record) return { ...record, persisted: true, storageMode: "mongodb" };
      } catch (dbErr) {
        console.warn("[Teacher Lessons] MongoDB findDraftById failed:", dbErr.message);
        if (!isEphemeralAllowed()) {
          throw new Error(`Database connection failed: MongoDB error (${dbErr.message})`);
        }
      }
    } else if (!isEphemeralAllowed()) {
      throw new Error("Database connection failed: Prisma client or MongoDB is not configured.");
    }

    return inMemoryDrafts.get(id) || null;
  }

  /**
   * Updates draft record
   */
  async function updateDraftRecord(id, data) {
    if (prisma && prisma.lessonDraft) {
      try {
        const record = await prisma.lessonDraft.update({
          where: { id },
          data,
        });
        return { ...record, persisted: true, storageMode: "mongodb" };
      } catch (dbErr) {
        console.warn("[Teacher Lessons] MongoDB updateDraft failed:", dbErr.message);
        if (!isEphemeralAllowed()) {
          throw new Error(`Database persistence failed: MongoDB error (${dbErr.message})`);
        }
      }
    } else if (!isEphemeralAllowed()) {
      throw new Error("Database persistence failed: Prisma client or MongoDB is not configured.");
    }

    const existing = inMemoryDrafts.get(id);
    if (!existing) return null;
    const updated = {
      ...existing,
      ...data,
      updatedAt: new Date(),
    };
    inMemoryDrafts.set(id, updated);
    return updated;
  }

  /**
   * Deletes draft record
   */
  async function deleteDraftRecord(id) {
    if (prisma && prisma.lessonDraft) {
      try {
        await prisma.lessonDraft.delete({ where: { id } });
        return true;
      } catch (dbErr) {
        console.warn("[Teacher Lessons] MongoDB deleteDraft failed:", dbErr.message);
        if (!isEphemeralAllowed()) {
          throw new Error(`Database connection failed: MongoDB error (${dbErr.message})`);
        }
      }
    } else if (!isEphemeralAllowed()) {
      throw new Error("Database connection failed: Prisma client or MongoDB is not configured.");
    }

    return inMemoryDrafts.delete(id);
  }

  // --------------------------------------------------------------------------
  // 1. POST /api/teacher/lessons/generate — Generate grounded lesson from material
  // --------------------------------------------------------------------------
  router.post("/lessons/generate", requireTeacher, async (req, res) => {
    try {
      const teacherId = req.userId;
      const { materialId } = req.body;

      if (!materialId || typeof materialId !== "string" || !materialId.trim()) {
        return res.status(400).json({
          success: false,
          message: "materialId is required to generate a lesson draft.",
        });
      }

      // Step A: Ownership and existence check
      const material = await getMaterialForTeacher(materialId.trim(), teacherId);
      if (!material) {
        return res.status(404).json({
          success: false,
          message: "Source material not found or unauthorized.",
        });
      }

      // Step B: Retrieve document buffer from durable storage adapter
      if (!material.storageKey) {
        return res.status(400).json({
          success: false,
          message: "Source material is missing a valid storage key.",
        });
      }

      const storageAdapter = getStorageAdapter();
      let storageData;
      try {
        storageData = await storageAdapter.get(material.storageKey);
      } catch (storageErr) {
        return res.status(500).json({
          success: false,
          message: `Storage access error: ${storageErr.message}`,
        });
      }

      if (!storageData || !storageData.buffer) {
        return res.status(410).json({
          success: false,
          message:
            "The source document could not be retrieved from storage. In serverless environments, local uploads in temporary storage do not persist across deployments. Please re-upload the file.",
        });
      }

      // Step C: Document extraction & processing
      let extractionResult;
      try {
        extractionResult = await processDocument({
          buffer: storageData.buffer,
          fileType: material.fileType,
          originalName: material.originalName,
        });
      } catch (extractErr) {
        return res.status(422).json({
          success: false,
          message: `Document processing failed: ${extractErr.message}`,
        });
      }

      // Step D: AI Lesson Generation
      let generationResult;
      try {
        generationResult = await generateLessonDraft({
          curriculum: material,
          sourceText: extractionResult.text,
          originalName: material.originalName,
          sections: extractionResult.sections,
        });
      } catch (genErr) {
        return res.status(502).json({
          success: false,
          message: `AI lesson generation failed: ${genErr.message}`,
        });
      }

      // Step E: Server-side validation of generated lesson schema
      const schemaCheck = validateLessonSchema(generationResult.content);
      if (!schemaCheck.valid) {
        return res.status(502).json({
          success: false,
          message: `Generated lesson did not pass schema verification: ${schemaCheck.error}`,
        });
      }

      // Step F: Persist lesson draft in database
      const draftRecordData = {
        teacherId,
        sourceMaterialId: material.id,
        title: generationResult.content.title,
        educationLevel: material.educationLevel || null,
        gradeOrSemester: generationResult.content.gradeOrSemester || material.classGrade || (material.semester ? `Semester ${material.semester}` : null),
        boardOrScheme: generationResult.content.boardOrScheme || material.board || material.scheme || null,
        subject: material.subjectName || generationResult.content.subject,
        chapter: material.chapterName || generationResult.content.chapter || null,
        topic: material.topicName || generationResult.content.topic || null,
        content: JSON.stringify(generationResult.content),
        status: "DRAFT",
        aiProvider: generationResult.aiProvider,
        aiModel: generationResult.aiModel,
        sourceWordCount: extractionResult.wordCount,
      };

      let draftRecord;
      try {
        draftRecord = await createDraftRecord(draftRecordData);
      } catch (persistErr) {
        return res.status(503).json({
          success: false,
          message: persistErr.message || "Database storage failed. Lesson draft was not saved.",
        });
      }

      res.status(201).json({
        success: true,
        message: "Lesson draft generated and saved successfully.",
        persisted: draftRecord.persisted !== false,
        storageMode: draftRecord.storageMode || "mongodb",
        isAiGenerated: generationResult.isAiGenerated,
        aiProvider: generationResult.aiProvider,
        aiModel: generationResult.aiModel,
        draft: {
          id: draftRecord.id,
          teacherId: draftRecord.teacherId,
          sourceMaterialId: draftRecord.sourceMaterialId,
          sourceMaterialName: material.originalName,
          title: draftRecord.title,
          educationLevel: draftRecord.educationLevel,
          gradeOrSemester: draftRecord.gradeOrSemester,
          boardOrScheme: draftRecord.boardOrScheme,
          subject: draftRecord.subject,
          chapter: draftRecord.chapter,
          topic: draftRecord.topic,
          content: generationResult.content,
          status: draftRecord.status,
          aiProvider: draftRecord.aiProvider,
          aiModel: draftRecord.aiModel,
          sourceWordCount: draftRecord.sourceWordCount,
          createdAt: draftRecord.createdAt,
          updatedAt: draftRecord.updatedAt,
        },
      });
    } catch (error) {
      console.error("[Teacher Lesson Generate Error]", error);
      res.status(500).json({
        success: false,
        message: error.message || "Failed to generate educational lesson draft.",
      });
    }
  });

  // --------------------------------------------------------------------------
  // 2. GET /api/teacher/lessons — List all lesson drafts for current teacher
  // --------------------------------------------------------------------------
  router.get("/lessons", requireTeacher, async (req, res) => {
    try {
      const teacherId = req.userId;
      const { sourceMaterialId, educationLevel, status } = req.query;

      const filter = {};
      if (sourceMaterialId) filter.sourceMaterialId = String(sourceMaterialId);
      if (educationLevel && educationLevel !== "all") filter.educationLevel = String(educationLevel).toLowerCase();
      if (status && status !== "all") filter.status = String(status).toUpperCase();

      const result = await findDraftsForTeacher(teacherId, filter);

      res.json({
        success: true,
        persisted: result.persisted !== false,
        storageMode: result.storageMode || "mongodb",
        count: result.drafts.length,
        drafts: result.drafts.map((d) => {
          let parsedContent = null;
          try {
            parsedContent = typeof d.content === "string" ? JSON.parse(d.content) : d.content;
          } catch {
            parsedContent = null;
          }
          return {
            id: d.id,
            teacherId: d.teacherId,
            sourceMaterialId: d.sourceMaterialId,
            sourceMaterialName: d.sourceMaterial?.originalName || null,
            title: d.title,
            educationLevel: d.educationLevel,
            gradeOrSemester: d.gradeOrSemester,
            boardOrScheme: d.boardOrScheme,
            subject: d.subject,
            chapter: d.chapter,
            topic: d.topic,
            content: parsedContent,
            status: d.status,
            aiProvider: d.aiProvider,
            aiModel: d.aiModel,
            sourceWordCount: d.sourceWordCount,
            createdAt: d.createdAt,
            updatedAt: d.updatedAt,
          };
        }),
      });
    } catch (error) {
      console.error("[Teacher Lessons List Error]", error);
      res.status(503).json({
        success: false,
        message: error.message || "Failed to load lesson drafts.",
      });
    }
  });

  // --------------------------------------------------------------------------
  // 3. GET /api/teacher/lessons/:id — Get single lesson draft details
  // --------------------------------------------------------------------------
  router.get("/lessons/:id", requireTeacher, async (req, res) => {
    try {
      const { id } = req.params;
      const draft = await findDraftById(id);

      if (!draft) {
        return res.status(404).json({ success: false, message: "Lesson draft not found." });
      }

      // Enforce teacher ownership isolation
      if (draft.teacherId !== req.userId) {
        return res.status(404).json({ success: false, message: "Lesson draft not found." });
      }

      let parsedContent = null;
      try {
        parsedContent = typeof draft.content === "string" ? JSON.parse(draft.content) : draft.content;
      } catch {
        parsedContent = null;
      }

      res.json({
        success: true,
        draft: {
          id: draft.id,
          teacherId: draft.teacherId,
          sourceMaterialId: draft.sourceMaterialId,
          sourceMaterialName: draft.sourceMaterial?.originalName || null,
          title: draft.title,
          educationLevel: draft.educationLevel,
          gradeOrSemester: draft.gradeOrSemester,
          boardOrScheme: draft.boardOrScheme,
          subject: draft.subject,
          chapter: draft.chapter,
          topic: draft.topic,
          content: parsedContent,
          status: draft.status,
          aiProvider: draft.aiProvider,
          aiModel: draft.aiModel,
          sourceWordCount: draft.sourceWordCount,
          createdAt: draft.createdAt,
          updatedAt: draft.updatedAt,
        },
      });
    } catch (error) {
      console.error("[Teacher Lesson Detail Error]", error);
      res.status(500).json({
        success: false,
        message: "Failed to retrieve lesson draft.",
      });
    }
  });

  // --------------------------------------------------------------------------
  // 4. PUT /api/teacher/lessons/:id — Update editable draft content
  // --------------------------------------------------------------------------
  router.put("/lessons/:id", requireTeacher, async (req, res) => {
    try {
      const { id } = req.params;
      const draft = await findDraftById(id);

      if (!draft) {
        return res.status(404).json({ success: false, message: "Lesson draft not found." });
      }

      if (draft.teacherId !== req.userId) {
        return res.status(403).json({ success: false, message: "Unauthorized to edit this lesson draft." });
      }

      const { title, content, status } = req.body;
      const updateData = {};

      if (title && typeof title === "string" && title.trim()) {
        updateData.title = title.trim();
      }

      if (status && ["DRAFT", "REVIEWED"].includes(status)) {
        updateData.status = status;
      }

      if (content) {
        const contentObj = typeof content === "string" ? JSON.parse(content) : content;
        const validation = validateLessonSchema(contentObj);
        if (!validation.valid) {
          return res.status(400).json({
            success: false,
            message: `Invalid lesson content: ${validation.error}`,
          });
        }
        updateData.content = JSON.stringify(contentObj);
        if (!updateData.title && contentObj.title) {
          updateData.title = contentObj.title;
        }
      }

      const updated = await updateDraftRecord(id, updateData);

      let parsedContent = null;
      try {
        parsedContent = typeof updated.content === "string" ? JSON.parse(updated.content) : updated.content;
      } catch {
        parsedContent = null;
      }

      res.json({
        success: true,
        message: "Lesson draft updated successfully.",
        draft: {
          id: updated.id,
          teacherId: updated.teacherId,
          sourceMaterialId: updated.sourceMaterialId,
          title: updated.title,
          content: parsedContent,
          status: updated.status,
          updatedAt: updated.updatedAt,
        },
      });
    } catch (error) {
      console.error("[Teacher Lesson Update Error]", error);
      res.status(500).json({
        success: false,
        message: error.message || "Failed to update lesson draft.",
      });
    }
  });

  // --------------------------------------------------------------------------
  // 5. DELETE /api/teacher/lessons/:id — Delete lesson draft
  // --------------------------------------------------------------------------
  router.delete("/lessons/:id", requireTeacher, async (req, res) => {
    try {
      const { id } = req.params;
      const draft = await findDraftById(id);

      if (!draft) {
        return res.status(404).json({ success: false, message: "Lesson draft not found." });
      }

      if (draft.teacherId !== req.userId) {
        return res.status(403).json({ success: false, message: "Unauthorized to delete this lesson draft." });
      }

      await deleteDraftRecord(id);

      res.json({
        success: true,
        message: "Lesson draft deleted successfully.",
        id,
      });
    } catch (error) {
      console.error("[Teacher Lesson Delete Error]", error);
      res.status(500).json({
        success: false,
        message: "Failed to delete lesson draft.",
      });
    }
  });

  return router;
}

module.exports = {
  createTeacherLessonsRouter,
  inMemoryDrafts,
};
