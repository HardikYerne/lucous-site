/**
 * Teacher Assessment & Game Management Routes for LUCOUS (Phase 3.3)
 * 
 * Enforces:
 * 1. Authenticated teacher role verification.
 * 2. Cross-teacher ownership isolation for materials and assessments.
 * 3. Document retrieval from durable storage with missing-file detection.
 * 4. Grounded AI assessment and educational game generation.
 * 5. Strict server-side schema, question type, and answer key verification.
 * 6. Explicit persistence failure reporting (no silent fake persistence).
 * 7. Assessment viewing, updating, and deletion by author.
 */

const express = require("express");
const { getStorageAdapter } = require("../storage/storage-adapter");
const { processDocument } = require("../services/document-processor");
const {
  generateAssessmentDraft,
  validateAssessmentSchema,
  validateGenerationParams,
} = require("../services/assessment-generator");

// In-memory fallback repository for assessments when MongoDB is offline in local dev/test
const inMemoryAssessments = new Map();

function createTeacherAssessmentsRouter(prisma, requireTeacher, materialFinder) {
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
    let mat = null;
    if (typeof materialFinder === "function") {
      mat = await materialFinder(materialId);
    } else if (prisma && prisma.uploadedMaterial) {
      try {
        mat = await prisma.uploadedMaterial.findUnique({
          where: { id: materialId },
        });
        if (mat) {
          mat = { ...mat, persisted: true, storageMode: "mongodb" };
        }
      } catch (dbErr) {
        console.warn("[Teacher Assessments] MongoDB material lookup failed:", dbErr.message);
        if (!isEphemeralAllowed()) {
          throw new Error(`Database connection failed: MongoDB error (${dbErr.message})`);
        }
      }
    } else if (!isEphemeralAllowed()) {
      throw new Error("Database connection failed: Prisma client or MongoDB is not configured.");
    }

    if (!mat) {
      const { inMemoryMaterials } = require("./teacher-materials");
      mat = inMemoryMaterials.get(materialId) || null;
    }

    if (!mat) {
      return { error: "NOT_FOUND" };
    }

    if (mat.teacherId !== teacherId) {
      return { error: "FORBIDDEN" };
    }

    return { material: mat };
  }

  /**
   * Creates an AssessmentDraft record in database or fallback
   */
  async function createAssessmentRecord(data) {
    if (prisma && prisma.assessmentDraft) {
      try {
        const record = await prisma.assessmentDraft.create({ data });
        return { ...record, persisted: true, storageMode: "mongodb" };
      } catch (dbErr) {
        console.warn("[Teacher Assessments] MongoDB assessment create failed:", dbErr.message);
        if (!isEphemeralAllowed()) {
          throw new Error(`Database persistence failed: MongoDB error (${dbErr.message}). Assessment generation aborted.`);
        }
      }
    } else if (!isEphemeralAllowed()) {
      throw new Error("Database persistence failed: Prisma client or MongoDB is not configured. Assessment generation aborted.");
    }

    const id = `asmt_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    const record = {
      id,
      ...data,
      createdAt: new Date(),
      updatedAt: new Date(),
      persisted: false,
      storageMode: "in_memory_ephemeral",
    };
    inMemoryAssessments.set(id, record);
    return record;
  }

  /**
   * Finds assessments belonging to a teacher
   */
  async function findAssessmentsForTeacher(teacherId, filter = {}) {
    if (prisma && prisma.assessmentDraft) {
      try {
        const where = { teacherId, ...filter };
        const list = await prisma.assessmentDraft.findMany({
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
                topicId: true,
              },
            },
          },
        });
        return {
          assessments: list,
          persisted: true,
          storageMode: "mongodb",
        };
      } catch (dbErr) {
        console.warn("[Teacher Assessments] MongoDB findAssessments failed:", dbErr.message);
        if (!isEphemeralAllowed()) {
          throw new Error(`Database connection failed: MongoDB error (${dbErr.message})`);
        }
      }
    } else if (!isEphemeralAllowed()) {
      throw new Error("Database connection failed: Prisma client or MongoDB is not configured.");
    }

    const list = [];
    for (const item of inMemoryAssessments.values()) {
      if (item.teacherId === teacherId) {
        let match = true;
        if (filter.sourceMaterialId && item.sourceMaterialId !== filter.sourceMaterialId) match = false;
        if (filter.contentType && item.contentType !== filter.contentType) match = false;
        if (filter.difficulty && item.difficulty !== filter.difficulty) match = false;
        if (filter.status && item.status !== filter.status) match = false;
        if (match) list.push(item);
      }
    }
    return {
      assessments: list.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)),
      persisted: false,
      storageMode: "in_memory_ephemeral",
    };
  }

  /**
   * Finds single assessment by ID
   */
  async function findAssessmentById(id) {
    if (prisma && prisma.assessmentDraft) {
      try {
        const record = await prisma.assessmentDraft.findUnique({
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
                topicId: true,
              },
            },
          },
        });
        if (record) return { ...record, persisted: true, storageMode: "mongodb" };
      } catch (dbErr) {
        console.warn("[Teacher Assessments] MongoDB findAssessmentById failed:", dbErr.message);
        if (!isEphemeralAllowed()) {
          throw new Error(`Database connection failed: MongoDB error (${dbErr.message})`);
        }
      }
    } else if (!isEphemeralAllowed()) {
      throw new Error("Database connection failed: Prisma client or MongoDB is not configured.");
    }

    return inMemoryAssessments.get(id) || null;
  }

  /**
   * Updates assessment record
   */
  async function updateAssessmentRecord(id, data) {
    if (prisma && prisma.assessmentDraft) {
      try {
        const record = await prisma.assessmentDraft.update({
          where: { id },
          data,
        });
        return { ...record, persisted: true, storageMode: "mongodb" };
      } catch (dbErr) {
        console.warn("[Teacher Assessments] MongoDB updateAssessment failed:", dbErr.message);
        if (!isEphemeralAllowed()) {
          throw new Error(`Database persistence failed: MongoDB error (${dbErr.message})`);
        }
      }
    } else if (!isEphemeralAllowed()) {
      throw new Error("Database connection failed: Prisma client or MongoDB is not configured.");
    }

    const existing = inMemoryAssessments.get(id);
    if (!existing) return null;
    const updated = {
      ...existing,
      ...data,
      updatedAt: new Date(),
    };
    inMemoryAssessments.set(id, updated);
    return updated;
  }

  /**
   * Deletes assessment record
   */
  async function deleteAssessmentRecord(id) {
    if (prisma && prisma.assessmentDraft) {
      try {
        await prisma.assessmentDraft.delete({ where: { id } });
        return true;
      } catch (dbErr) {
        console.warn("[Teacher Assessments] MongoDB deleteAssessment failed:", dbErr.message);
        if (!isEphemeralAllowed()) {
          throw new Error(`Database connection failed: MongoDB error (${dbErr.message})`);
        }
      }
    } else if (!isEphemeralAllowed()) {
      throw new Error("Database connection failed: Prisma client or MongoDB is not configured.");
    }

    return inMemoryAssessments.delete(id);
  }

  // --------------------------------------------------------------------------
  // 1. POST /api/teacher/assessments/generate — Generate grounded questions/game
  // --------------------------------------------------------------------------
  router.post("/assessments/generate", requireTeacher, async (req, res) => {
    try {
      const teacherId = req.userId;
      const {
        materialId,
        contentType = "PRACTICE",
        gameFormat = "MULTIPLE_CHOICE",
        difficulty = "MEDIUM",
        questionCount = 5,
      } = req.body;

      if (!materialId || typeof materialId !== "string" || !materialId.trim()) {
        return res.status(400).json({
          success: false,
          message: "materialId is required to generate an assessment.",
        });
      }

      // Step A: Parameter validation
      const paramCheck = validateGenerationParams({
        contentType,
        gameFormat,
        difficulty,
        questionCount,
      });
      if (!paramCheck.valid) {
        return res.status(400).json({
          success: false,
          message: paramCheck.error,
        });
      }
      const cleanParams = paramCheck.params;

      // Step B: Ownership and existence check
      const lookup = await getMaterialForTeacher(materialId.trim(), teacherId);
      if (lookup.error === "FORBIDDEN") {
        return res.status(403).json({
          success: false,
          message: "Access denied: You do not have permission to access learning materials owned by another teacher.",
        });
      }
      if (lookup.error === "NOT_FOUND" || !lookup.material) {
        return res.status(404).json({
          success: false,
          message: "Source material not found.",
        });
      }
      const material = lookup.material;

      // Step C: Retrieve document from durable storage
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
            "The source document could not be found in storage or retrieved. In serverless environments, local uploads in temporary storage do not persist across deployments. Please re-upload the file.",
        });
      }

      // Step D: Document text extraction
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

      // Step E: Assessment generation
      let generationResult;
      try {
        generationResult = await generateAssessmentDraft({
          curriculum: material,
          sourceText: extractionResult.text,
          originalName: material.originalName,
          sections: extractionResult.sections,
          ...cleanParams,
        });
      } catch (genErr) {
        return res.status(502).json({
          success: false,
          message: `AI assessment generation failed: ${genErr.message}`,
        });
      }

      // Step F: Server-side validation
      const schemaCheck = validateAssessmentSchema(
        generationResult.content,
        cleanParams.questionCount
      );
      if (!schemaCheck.valid) {
        return res.status(502).json({
          success: false,
          message: `Generated assessment failed schema verification: ${schemaCheck.error}`,
        });
      }

      if (material.topicId) {
        generationResult.content.topicId = material.topicId;
      }

      // Step G: Persist assessment record in database
      const assessmentRecordData = {
        teacherId,
        sourceMaterialId: material.id,
        title: generationResult.content.title,
        description: generationResult.content.description || null,
        contentType: cleanParams.contentType,
        gameFormat: cleanParams.gameFormat,
        difficulty: cleanParams.difficulty,
        questionCount: cleanParams.questionCount,
        educationLevel: material.educationLevel || null,
        gradeOrSemester:
          generationResult.content.gradeOrSemester ||
          material.classGrade ||
          (material.semester ? `Semester ${material.semester}` : null),
        boardOrScheme:
          generationResult.content.boardOrScheme ||
          material.board ||
          material.scheme ||
          null,
        subject: material.subjectName || generationResult.content.subject,
        chapter: material.chapterName || generationResult.content.chapter || null,
        topic: material.topicName || generationResult.content.topic || null,
        content: JSON.stringify(generationResult.content),
        status: "DRAFT",
        aiProvider: generationResult.aiProvider,
        aiModel: generationResult.aiModel,
        sourceWordCount: extractionResult.wordCount,
      };

      let assessmentRecord;
      try {
        assessmentRecord = await createAssessmentRecord(assessmentRecordData);
      } catch (persistErr) {
        return res.status(503).json({
          success: false,
          message: persistErr.message || "Database storage failed. Assessment was not saved.",
        });
      }

      res.status(201).json({
        success: true,
        message: "Assessment generated and saved successfully.",
        persisted: assessmentRecord.persisted !== false,
        storageMode: assessmentRecord.storageMode || "mongodb",
        isAiGenerated: generationResult.isAiGenerated,
        aiProvider: generationResult.aiProvider,
        aiModel: generationResult.aiModel,
        assessment: {
          id: assessmentRecord.id,
          teacherId: assessmentRecord.teacherId,
          sourceMaterialId: assessmentRecord.sourceMaterialId,
          sourceMaterialName: material.originalName,
          title: assessmentRecord.title,
          description: assessmentRecord.description,
          contentType: assessmentRecord.contentType,
          gameFormat: assessmentRecord.gameFormat,
          difficulty: assessmentRecord.difficulty,
          questionCount: assessmentRecord.questionCount,
          educationLevel: assessmentRecord.educationLevel,
          gradeOrSemester: assessmentRecord.gradeOrSemester,
          boardOrScheme: assessmentRecord.boardOrScheme,
          subject: assessmentRecord.subject,
          chapter: assessmentRecord.chapter,
          topic: assessmentRecord.topic,
          topicId: material.topicId || null,
          content: generationResult.content,
          status: assessmentRecord.status,
          aiProvider: assessmentRecord.aiProvider,
          aiModel: assessmentRecord.aiModel,
          sourceWordCount: assessmentRecord.sourceWordCount,
          createdAt: assessmentRecord.createdAt,
          updatedAt: assessmentRecord.updatedAt,
        },
      });
    } catch (error) {
      console.error("[Teacher Assessment Generate Error]", error);
      res.status(500).json({
        success: false,
        message: error.message || "Failed to generate educational assessment.",
      });
    }
  });

  // --------------------------------------------------------------------------
  // 2. GET /api/teacher/assessments — List all assessments for current teacher
  // --------------------------------------------------------------------------
  router.get("/assessments", requireTeacher, async (req, res) => {
    try {
      const teacherId = req.userId;
      const { sourceMaterialId, contentType, difficulty, status } = req.query;

      const filter = {};
      if (sourceMaterialId) filter.sourceMaterialId = String(sourceMaterialId);
      if (contentType && contentType !== "all") filter.contentType = String(contentType).toUpperCase();
      if (difficulty && difficulty !== "all") filter.difficulty = String(difficulty).toUpperCase();
      if (status && status !== "all") filter.status = String(status).toUpperCase();

      const result = await findAssessmentsForTeacher(teacherId, filter);

      res.json({
        success: true,
        persisted: result.persisted !== false,
        storageMode: result.storageMode || "mongodb",
        count: result.assessments.length,
        assessments: result.assessments.map((a) => {
          let parsedContent = null;
          try {
            parsedContent = typeof a.content === "string" ? JSON.parse(a.content) : a.content;
          } catch {
            parsedContent = null;
          }
          return {
            id: a.id,
            teacherId: a.teacherId,
            sourceMaterialId: a.sourceMaterialId,
            sourceMaterialName: a.sourceMaterial?.originalName || null,
            title: a.title,
            description: a.description,
            contentType: a.contentType,
            gameFormat: a.gameFormat,
            difficulty: a.difficulty,
            questionCount: a.questionCount,
            educationLevel: a.educationLevel,
            gradeOrSemester: a.gradeOrSemester,
            boardOrScheme: a.boardOrScheme,
            subject: a.subject,
            chapter: a.chapter,
            topic: a.topic,
            topicId: a.topicId || (parsedContent && parsedContent.topicId) || a.sourceMaterial?.topicId || null,
            content: parsedContent,
            status: a.status,
            aiProvider: a.aiProvider,
            aiModel: a.aiModel,
            sourceWordCount: a.sourceWordCount,
            createdAt: a.createdAt,
            updatedAt: a.updatedAt,
          };
        }),
      });
    } catch (error) {
      console.error("[Teacher Assessments List Error]", error);
      res.status(503).json({
        success: false,
        message: error.message || "Failed to load assessments.",
      });
    }
  });

  // --------------------------------------------------------------------------
  // 3. GET /api/teacher/assessments/:id — Get single assessment details
  // --------------------------------------------------------------------------
  router.get("/assessments/:id", requireTeacher, async (req, res) => {
    try {
      const { id } = req.params;
      const asmt = await findAssessmentById(id);

      if (!asmt) {
        return res.status(404).json({ success: false, message: "Assessment not found." });
      }

      if (asmt.teacherId !== req.userId) {
        return res.status(404).json({ success: false, message: "Assessment not found." });
      }

      let parsedContent = null;
      try {
        parsedContent = typeof asmt.content === "string" ? JSON.parse(asmt.content) : asmt.content;
      } catch {
        parsedContent = null;
      }

      res.json({
        success: true,
        assessment: {
          id: asmt.id,
          teacherId: asmt.teacherId,
          sourceMaterialId: asmt.sourceMaterialId,
          sourceMaterialName: asmt.sourceMaterial?.originalName || null,
          title: asmt.title,
          description: asmt.description,
          contentType: asmt.contentType,
          gameFormat: asmt.gameFormat,
          difficulty: asmt.difficulty,
          questionCount: asmt.questionCount,
          educationLevel: asmt.educationLevel,
          gradeOrSemester: asmt.gradeOrSemester,
          boardOrScheme: asmt.boardOrScheme,
          subject: asmt.subject,
          chapter: asmt.chapter,
          topic: asmt.topic,
          topicId: asmt.topicId || (parsedContent && parsedContent.topicId) || asmt.sourceMaterial?.topicId || null,
          content: parsedContent,
          status: asmt.status,
          aiProvider: asmt.aiProvider,
          aiModel: asmt.aiModel,
          sourceWordCount: asmt.sourceWordCount,
          createdAt: asmt.createdAt,
          updatedAt: asmt.updatedAt,
        },
      });
    } catch (error) {
      console.error("[Teacher Assessment Detail Error]", error);
      res.status(500).json({
        success: false,
        message: "Failed to retrieve assessment details.",
      });
    }
  });

  // --------------------------------------------------------------------------
  // 4. PUT /api/teacher/assessments/:id — Update assessment content
  // --------------------------------------------------------------------------
  router.put("/assessments/:id", requireTeacher, async (req, res) => {
    try {
      const { id } = req.params;
      const asmt = await findAssessmentById(id);

      if (!asmt) {
        return res.status(404).json({ success: false, message: "Assessment not found." });
      }

      if (asmt.teacherId !== req.userId) {
        return res.status(403).json({ success: false, message: "Unauthorized to edit this assessment." });
      }

      const { title, description, content, status } = req.body;
      const updateData = {};

      if (title && typeof title === "string" && title.trim()) {
        updateData.title = title.trim();
      }

      if (description !== undefined) {
        updateData.description = typeof description === "string" ? description.trim() : null;
      }

      if (status && ["DRAFT", "REVIEWED"].includes(status)) {
        updateData.status = status;
      }

      if (content) {
        const contentObj = typeof content === "string" ? JSON.parse(content) : content;
        const validation = validateAssessmentSchema(contentObj);
        if (!validation.valid) {
          return res.status(400).json({
            success: false,
            message: `Invalid question content or schema: ${validation.error}`,
          });
        }
        updateData.content = JSON.stringify(contentObj);
        if (!updateData.title && contentObj.title) {
          updateData.title = contentObj.title;
        }
        if (contentObj.questionCount) {
          updateData.questionCount = contentObj.questionCount;
        }
      }

      const updated = await updateAssessmentRecord(id, updateData);

      let parsedContent = null;
      try {
        parsedContent = typeof updated.content === "string" ? JSON.parse(updated.content) : updated.content;
      } catch {
        parsedContent = null;
      }

      res.json({
        success: true,
        message: "Assessment updated successfully.",
        assessment: {
          id: updated.id,
          teacherId: updated.teacherId,
          sourceMaterialId: updated.sourceMaterialId,
          title: updated.title,
          description: updated.description,
          content: parsedContent,
          status: updated.status,
          updatedAt: updated.updatedAt,
        },
      });
    } catch (error) {
      console.error("[Teacher Assessment Update Error]", error);
      res.status(500).json({
        success: false,
        message: error.message || "Failed to update assessment.",
      });
    }
  });

  // --------------------------------------------------------------------------
  // 5. DELETE /api/teacher/assessments/:id — Delete assessment
  // --------------------------------------------------------------------------
  router.delete("/assessments/:id", requireTeacher, async (req, res) => {
    try {
      const { id } = req.params;
      const asmt = await findAssessmentById(id);

      if (!asmt) {
        return res.status(404).json({ success: false, message: "Assessment not found." });
      }

      if (asmt.teacherId !== req.userId) {
        return res.status(403).json({ success: false, message: "Unauthorized to delete this assessment." });
      }

      await deleteAssessmentRecord(id);

      res.json({
        success: true,
        message: "Assessment deleted successfully.",
        id,
      });
    } catch (error) {
      console.error("[Teacher Assessment Delete Error]", error);
      res.status(500).json({
        success: false,
        message: "Failed to delete assessment.",
      });
    }
  });

  return router;
}

module.exports = {
  createTeacherAssessmentsRouter,
  inMemoryAssessments,
};
