/**
 * Teacher Content Upload & Materials Management Routes for LUCOUS
 * Enforces role authorization, file integrity verification, curriculum metadata validation,
 * and safe storage isolation.
 */

const express = require("express");
const multer = require("multer");
const { validateUploadedFile, getMaxUploadSizeBytes } = require("../services/file-validator");
const { validateCurriculumMetadata } = require("../services/curriculum-validator");
const { getStorageAdapter } = require("../storage/storage-adapter");

// In-memory fallback repository when MongoDB connection is offline in local dev/tests
const inMemoryMaterials = new Map();

function formatBytes(bytes) {
  if (!bytes || isNaN(bytes) || bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

function createTeacherMaterialsRouter(prisma, requireTeacher) {

  const router = express.Router();

  // Configure multer with memory storage and strict field/file limits
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
      fileSize: getMaxUploadSizeBytes() + 1024, // allow slight slack so validator can return friendly 400
      files: 1,
      fields: 20,
      fieldSize: 64 * 1024, // max 64KB per metadata field to prevent memory blowup
    },
  });

  // Middleware to handle multer-level errors (e.g. file size limit exceeded)
  const handleUploadMiddleware = (req, res, next) => {
    upload.single("file")(req, res, (err) => {
      if (err) {
        if (err instanceof multer.MulterError) {
          if (err.code === "LIMIT_FILE_SIZE") {
            const maxMb = (getMaxUploadSizeBytes() / (1024 * 1024)).toFixed(0);
            return res.status(400).json({
              success: false,
              message: `File size exceeds the maximum limit of ${maxMb}MB.`,
            });
          }
          if (err.code === "LIMIT_FIELD_VALUE") {
            return res.status(400).json({
              success: false,
              message: "Form field size limit exceeded.",
            });
          }
          return res.status(400).json({
            success: false,
            message: `Upload error: ${err.message}`,
          });
        }
        return res.status(400).json({
          success: false,
          message: err.message || "Failed to process upload.",
        });
      }
      next();
    });
  };

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
   * Helper to perform DB queries with explicit failure handling
   */
  async function createMaterialRecord(data) {
    if (prisma && prisma.uploadedMaterial) {
      try {
        const record = await prisma.uploadedMaterial.create({ data });
        return { ...record, persisted: true, storageMode: "mongodb" };
      } catch (dbErr) {
        console.warn("[Teacher Materials] MongoDB create failed:", dbErr.message);
        if (!isEphemeralAllowed()) {
          throw new Error(`Database persistence failed: MongoDB error (${dbErr.message}). Upload aborted.`);
        }
      }
    } else if (!isEphemeralAllowed()) {
      throw new Error("Database persistence failed: Prisma client or MongoDB is not configured. Upload aborted.");
    }

    // Ephemeral in-memory fallback only when explicitly permitted in dev/test
    const id = `mem_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    const record = {
      id,
      ...data,
      createdAt: new Date(),
      updatedAt: new Date(),
      persisted: false,
      storageMode: "in_memory_ephemeral",
    };
    inMemoryMaterials.set(id, record);
    return record;
  }

  async function findMaterialsForTeacher(teacherId, filter = {}) {
    if (prisma && prisma.uploadedMaterial) {
      try {
        const where = { teacherId, ...filter };
        const list = await prisma.uploadedMaterial.findMany({
          where,
          orderBy: { createdAt: "desc" },
        });
        return {
          materials: list,
          persisted: true,
          storageMode: "mongodb",
        };
      } catch (dbErr) {
        console.warn("[Teacher Materials] MongoDB query failed:", dbErr.message);
        if (!isEphemeralAllowed()) {
          throw new Error(`Database connection failed: MongoDB error (${dbErr.message})`);
        }
      }
    } else if (!isEphemeralAllowed()) {
      throw new Error("Database connection failed: Prisma client or MongoDB is not configured.");
    }

    const list = [];
    for (const item of inMemoryMaterials.values()) {
      if (item.teacherId === teacherId) {
        let match = true;
        if (filter.educationLevel && item.educationLevel !== filter.educationLevel) match = false;
        if (filter.status && item.status !== filter.status) match = false;
        if (match) list.push(item);
      }
    }
    return {
      materials: list.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)),
      persisted: false,
      storageMode: "in_memory_ephemeral",
    };
  }

  async function findMaterialById(id) {
    if (prisma && prisma.uploadedMaterial) {
      try {
        if (typeof prisma.uploadedMaterial.findUnique === "function") {
          const rec = await prisma.uploadedMaterial.findUnique({ where: { id } });
          if (rec) return { ...rec, persisted: true, storageMode: "mongodb" };
        }
      } catch (dbErr) {
        console.warn("[Teacher Materials] MongoDB findUnique failed:", dbErr.message);
        if (!isEphemeralAllowed()) {
          throw new Error(`Database connection failed: MongoDB error (${dbErr.message})`);
        }
      }
    } else if (!isEphemeralAllowed()) {
      throw new Error("Database connection failed: Prisma client or MongoDB is not configured.");
    }
    return inMemoryMaterials.get(id) || null;
  }

  async function deleteMaterialRecord(id) {
    if (prisma && prisma.uploadedMaterial) {
      try {
        if (typeof prisma.uploadedMaterial.delete === "function") {
          await prisma.uploadedMaterial.delete({ where: { id } });
          return true;
        }
      } catch (dbErr) {
        console.warn("[Teacher Materials] MongoDB delete failed:", dbErr.message);
        if (!isEphemeralAllowed()) {
          throw new Error(`Database connection failed: MongoDB error (${dbErr.message})`);
        }
      }
    } else if (!isEphemeralAllowed()) {
      throw new Error("Database connection failed: Prisma client or MongoDB is not configured.");
    }
    return inMemoryMaterials.delete(id);
  }

  // --------------------------------------------------------------------------
  // 1. POST /api/teacher/materials/upload — Upload and validate source document
  // --------------------------------------------------------------------------
  router.post("/materials/upload", requireTeacher, handleUploadMiddleware, async (req, res) => {
    let storageResult = null;
    const storageAdapter = getStorageAdapter();

    try {
      const teacherId = req.userId;
      if (!teacherId) {
        return res.status(401).json({ success: false, message: "Unauthorized teacher access." });
      }

      // Step A: File validation (extension, size, magic signature)
      const fileValidation = validateUploadedFile(req.file);
      if (!fileValidation.valid) {
        return res.status(400).json({
          success: false,
          message: fileValidation.error,
        });
      }
      const { originalName, fileType, fileSize, checksum, storageKey } = fileValidation.sanitized;

      // Step B: Curriculum metadata validation
      const metaValidation = validateCurriculumMetadata(req.body);
      if (!metaValidation.valid) {
        return res.status(400).json({
          success: false,
          message: metaValidation.error,
        });
      }
      const metadata = metaValidation.metadata;

      // Step C: Persist to storage via active StorageAdapter
      storageResult = await storageAdapter.save({
        key: storageKey,
        buffer: req.file.buffer,
        mimeType: fileType,
      });

      // Step D: Create Database record (with automatic rollback on failure)
      const recordData = {
        teacherId,
        originalName,
        fileType,
        fileSize,
        storageKey: storageResult.storageKey,
        storageUri: storageResult.storageUri,
        checksum,
        educationLevel: metadata.educationLevel,
        classGrade: metadata.classGrade,
        board: metadata.board,
        stream: metadata.stream,
        branch: metadata.branch,
        scheme: metadata.scheme,
        semester: metadata.semester,
        subjectName: metadata.subjectName,
        chapterName: metadata.chapterName,
        topicName: metadata.topicName,
        topicId: metadata.topicId || null,
        language: metadata.language,
        description: metadata.description,
        status: "UPLOADED",
      };

      let material;
      try {
        material = await createMaterialRecord(recordData);
      } catch (dbError) {
        // Anti-Orphan Rollback: delete stored file if database record failed
        if (storageResult && storageResult.storageKey) {
          try {
            await storageAdapter.delete(storageResult.storageKey);
            console.log(`[Teacher Upload Rollback] Successfully unlinked orphaned file: ${storageResult.storageKey}`);
          } catch (cleanupErr) {
            console.warn(`[Teacher Upload Rollback] Warning unlinking file: ${cleanupErr.message}`);
          }
        }
        return res.status(503).json({
          success: false,
          message: dbError.message || "Database storage failed. Material was not saved.",
        });
      }

      res.status(201).json({
        success: true,
        message: "Material uploaded and validated successfully.",
        persisted: material.persisted !== false,
        storageMode: material.storageMode || "mongodb",
        material: {
          id: material.id,
          teacherId: material.teacherId,
          originalName: material.originalName,
          fileType: material.fileType,
          fileSize: material.fileSize,
          formattedSize: formatBytes(material.fileSize),
          storageKey: material.storageKey,
          checksum: material.checksum,
          educationLevel: material.educationLevel,
          classGrade: material.classGrade,
          board: material.board,
          stream: material.stream,
          branch: material.branch,
          scheme: material.scheme,
          semester: material.semester,
          subjectName: material.subjectName,
          chapterName: material.chapterName,
          topicName: material.topicName,
          topicId: material.topicId || null,
          language: material.language,
          description: material.description,
          status: material.status,
          createdAt: material.createdAt,
        },
      });
    } catch (error) {
      console.error("[Teacher Upload Error]", error.message);
      // Clean up storage if an unexpected error occurs
      if (storageResult && storageResult.storageKey) {
        try {
          await storageAdapter.delete(storageResult.storageKey);
        } catch (_) {}
      }
      res.status(500).json({
        success: false,
        message: error.message || "Failed to process and store uploaded material.",
      });
    }
  });


  // --------------------------------------------------------------------------
  // 2. GET /api/teacher/materials — List current teacher's uploaded materials
  // --------------------------------------------------------------------------
  router.get("/materials", requireTeacher, async (req, res) => {
    try {
      const teacherId = req.userId;
      const { educationLevel, status } = req.query;

      const filter = {};
      if (educationLevel && educationLevel !== "all") {
        filter.educationLevel = String(educationLevel).toLowerCase();
      }
      if (status && status !== "all") {
        filter.status = String(status).toUpperCase();
      }

      const result = await findMaterialsForTeacher(teacherId, filter);

      res.json({
        success: true,
        persisted: result.persisted !== false,
        storageMode: result.storageMode || "mongodb",
        count: result.materials.length,
        materials: result.materials.map((m) => ({
          id: m.id,
          teacherId: m.teacherId,
          originalName: m.originalName,
          fileType: m.fileType,
          fileSize: m.fileSize,
          formattedSize: formatBytes(m.fileSize),
          storageKey: m.storageKey,
          checksum: m.checksum,
          educationLevel: m.educationLevel,
          classGrade: m.classGrade,
          board: m.board,
          stream: m.stream,
          branch: m.branch,
          scheme: m.scheme,
          semester: m.semester,
          subjectName: m.subjectName,
          chapterName: m.chapterName,
          topicName: m.topicName,
          topicId: m.topicId || null,
          language: m.language,
          description: m.description,
          status: m.status,
          createdAt: m.createdAt,
          updatedAt: m.updatedAt,
        })),
      });
    } catch (error) {
      console.error("[Teacher Materials List Error]", error.message);
      res.status(503).json({
        success: false,
        message: error.message || "Failed to load uploaded materials.",
      });
    }
  });


  // --------------------------------------------------------------------------
  // 3. GET /api/teacher/materials/:id — Get single material metadata & status
  // --------------------------------------------------------------------------
  router.get("/materials/:id", requireTeacher, async (req, res) => {
    try {
      const { id } = req.params;
      const material = await findMaterialById(id);

      if (!material) {
        return res.status(404).json({ success: false, message: "Material not found." });
      }

      // Enforce strict teacher ownership isolation
      if (material.teacherId !== req.userId) {
        return res.status(404).json({ success: false, message: "Material not found." });
      }

      res.json({
        success: true,
        material: {
          id: material.id,
          originalName: material.originalName,
          fileType: material.fileType,
          fileSize: material.fileSize,
          storageKey: material.storageKey,
          checksum: material.checksum,
          educationLevel: material.educationLevel,
          classGrade: material.classGrade,
          board: material.board,
          stream: material.stream,
          branch: material.branch,
          scheme: material.scheme,
          semester: material.semester,
          subjectName: material.subjectName,
          chapterName: material.chapterName,
          topicName: material.topicName,
          topicId: material.topicId || null,
          language: material.language,
          description: material.description,
          status: material.status,
          createdAt: material.createdAt,
          updatedAt: material.updatedAt,
        },
      });
    } catch (error) {
      console.error("[Teacher Material Detail Error]", error);
      res.status(500).json({
        success: false,
        message: "Failed to retrieve material details.",
      });
    }
  });

  // --------------------------------------------------------------------------
  // 4. DELETE /api/teacher/materials/:id — Delete teacher's material & storage file
  // --------------------------------------------------------------------------
  router.delete("/materials/:id", requireTeacher, async (req, res) => {
    try {
      const { id } = req.params;
      const material = await findMaterialById(id);

      if (!material) {
        return res.status(404).json({ success: false, message: "Material not found." });
      }

      // Enforce strict teacher ownership isolation
      if (material.teacherId !== req.userId) {
        return res.status(403).json({ success: false, message: "You are not authorized to delete this material." });
      }

      // Delete binary file from storage
      if (material.storageKey) {
        const storageAdapter = getStorageAdapter();
        try {
          await storageAdapter.delete(material.storageKey);
        } catch (storageErr) {
          console.warn("[Teacher Material Delete] Storage deletion warning:", storageErr.message);
        }
      }

      // Delete record from database
      await deleteMaterialRecord(id);

      res.json({
        success: true,
        message: "Material deleted successfully.",
        id,
      });
    } catch (error) {
      console.error("[Teacher Material Delete Error]", error);
      res.status(500).json({
        success: false,
        message: "Failed to delete material.",
      });
    }
  });

  return router;
}

module.exports = {
  createTeacherMaterialsRouter,
  inMemoryMaterials,
};
