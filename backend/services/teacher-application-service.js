/**
 * Teacher Application & Verification Service for LUCOUS
 * Manages teacher credentials, qualifications, supporting documents,
 * and admin approval/rejection lifecycle.
 */

const crypto = require("crypto");
const path = require("path");
const fs = require("fs");

const APPLICATION_STATUS = {
  PENDING: "PENDING",
  APPROVED: "APPROVED",
  REJECTED: "REJECTED",
};

// In-memory application store for fast access and fallback
const teacherApplications = new Map();

// Initialize the demo teacher as APPROVED so standard teacher testing retains full baseline capabilities
const demoTeacherApp = {
  id: "app-demo-teacher",
  userId: "demo-teacher-id",
  name: "Sarah Parker",
  email: "teacher@lucous.com",
  avatarUrl: null,
  school: "Springfield High",
  subject: "Science",
  qualifications: "M.Sc. Physics, B.Ed (Central University)",
  experience: "8 years teaching secondary and higher secondary science",
  documents: [
    {
      id: "doc-demo-cert",
      filename: "doc-demo-teaching-cert.pdf",
      originalName: "teaching-certificate.pdf",
      mimeType: "application/pdf",
      size: 45200,
      url: "/api/teacher/documents/doc-demo-teaching-cert.pdf",
      uploadedAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
    },
  ],
  status: APPLICATION_STATUS.APPROVED,
  rejectionReason: null,
  reviewedBy: "admin-platform-seed",
  reviewedByName: "Head Administrator",
  reviewedAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
  submittedAt: new Date(Date.now() - 31 * 24 * 60 * 60 * 1000).toISOString(),
  updatedAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
};
teacherApplications.set("demo-teacher-id", demoTeacherApp);

/**
 * Validates binary signature for documents (PDF, DOCX, PNG, JPG).
 */
function verifyDocumentSignature(buffer, extension) {
  if (!buffer || buffer.length < 4) return false;
  const ext = extension.toLowerCase();

  // PDF: %PDF- (0x25 0x50 0x44 0x46)
  if (ext === ".pdf") {
    return buffer[0] === 0x25 && buffer[1] === 0x50 && buffer[2] === 0x44 && buffer[3] === 0x46;
  }

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (ext === ".png") {
    if (buffer.length < 8) return false;
    return (
      buffer[0] === 0x89 &&
      buffer[1] === 0x50 &&
      buffer[2] === 0x4e &&
      buffer[3] === 0x47 &&
      buffer[4] === 0x0d &&
      buffer[5] === 0x0a &&
      buffer[6] === 0x1a &&
      buffer[7] === 0x0a
    );
  }

  // JPEG: FF D8 FF
  if (ext === ".jpg" || ext === ".jpeg") {
    return buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  }

  // DOCX: PK.. (ZIP archive standard: 50 4B 03 04 or 50 4B 05 06)
  if (ext === ".docx") {
    return buffer[0] === 0x50 && buffer[1] === 0x4b;
  }

  return false;
}

const ALLOWED_DOC_EXTENSIONS = new Set([".pdf", ".docx", ".png", ".jpg", ".jpeg"]);
const MAX_DOC_SIZE_BYTES = 10 * 1024 * 1024; // 10MB

/**
 * Validates an uploaded teacher document.
 */
function validateTeacherDocument(file) {
  if (!file) return { valid: false, error: "No document file provided." };
  const { originalname, buffer, size } = file;
  if (!buffer || buffer.length === 0) return { valid: false, error: "Document is empty." };

  const actualSize = size || buffer.length;
  if (actualSize > MAX_DOC_SIZE_BYTES) {
    return {
      valid: false,
      error: `Document exceeds maximum 10MB limit (got ${(actualSize / (1024 * 1024)).toFixed(1)}MB).`,
    };
  }

  const ext = path.extname(originalname || "").toLowerCase();
  if (!ALLOWED_DOC_EXTENSIONS.has(ext)) {
    return {
      valid: false,
      error: `Unsupported file format (${ext || "unknown"}). Allowed formats: PDF, DOCX, PNG, JPG.`,
    };
  }

  if (!verifyDocumentSignature(buffer, ext)) {
    return {
      valid: false,
      error: "File content does not match the expected document signature.",
    };
  }

  return { valid: true, extension: ext };
}

/**
 * Returns whether a teacher is approved to use protected teaching APIs.
 */
function isTeacherApproved(userId, fallbackUser = null) {
  if (!userId) return false;
  const app = teacherApplications.get(userId);
  if (app) {
    return app.status === APPLICATION_STATUS.APPROVED;
  }
  // Backwards compatibility check
  if (fallbackUser && fallbackUser.role === "TEACHER" && fallbackUser.isVerified) {
    return true;
  }
  return false;
}

/**
 * Retrieves the application for a teacher by userId.
 */
function getApplicationByUserId(userId) {
  return teacherApplications.get(userId) || null;
}

/**
 * Registers an initial PENDING teacher application upon registration.
 */
function createPendingTeacherApplication(user) {
  if (!user || !user.id) return null;
  const existing = teacherApplications.get(user.id);
  if (existing) return existing;

  const app = {
    id: `app-${user.id}`,
    userId: user.id,
    name: user.name || "",
    email: user.email || "",
    avatarUrl: user.avatarUrl || null,
    school: user.school || null,
    subject: user.subject || null,
    qualifications: "",
    experience: "",
    documents: [],
    status: APPLICATION_STATUS.PENDING,
    rejectionReason: null,
    reviewedBy: null,
    reviewedByName: null,
    reviewedAt: null,
    submittedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  teacherApplications.set(user.id, app);
  return app;
}

/**
 * Updates or resubmits a teacher application.
 * Transitions REJECTED or PENDING applications to PENDING with fresh timestamp.
 */
function saveTeacherApplication(userId, data, userProfile) {
  if (!userId) throw new Error("userId is required");

  let app = teacherApplications.get(userId);
  if (!app) {
    app = {
      id: `app-${userId}`,
      userId,
      name: userProfile?.name || "",
      email: userProfile?.email || "",
      avatarUrl: userProfile?.avatarUrl || null,
      school: userProfile?.school || null,
      subject: userProfile?.subject || null,
      qualifications: "",
      experience: "",
      documents: [],
      status: APPLICATION_STATUS.PENDING,
      rejectionReason: null,
      reviewedBy: null,
      reviewedByName: null,
      reviewedAt: null,
      submittedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  }

  // Update profile fields if supplied
  if (data.name !== undefined) app.name = String(data.name).trim();
  if (data.avatarUrl !== undefined) app.avatarUrl = data.avatarUrl;
  if (data.school !== undefined) app.school = data.school ? String(data.school).trim() : null;
  if (data.subject !== undefined) app.subject = data.subject ? String(data.subject).trim() : null;

  // Update application specific fields
  if (data.qualifications !== undefined) {
    app.qualifications = String(data.qualifications).trim();
  }
  if (data.experience !== undefined) {
    app.experience = String(data.experience).trim();
  }
  if (Array.isArray(data.documents)) {
    app.documents = data.documents;
  }

  // Reset status to PENDING upon submission/resubmission
  app.status = APPLICATION_STATUS.PENDING;
  app.rejectionReason = null;
  app.submittedAt = new Date().toISOString();
  app.updatedAt = new Date().toISOString();

  teacherApplications.set(userId, app);
  return app;
}

/**
 * Adds an uploaded document to a teacher's application record.
 */
function addDocumentToApplication(userId, docMeta) {
  let app = teacherApplications.get(userId);
  if (!app) {
    app = createPendingTeacherApplication({ id: userId });
  }
  app.documents.push(docMeta);
  app.updatedAt = new Date().toISOString();
  teacherApplications.set(userId, app);
  return app;
}

/**
 * Admin decision: approve or reject application.
 */
function reviewTeacherApplication(adminUser, targetUserId, decision) {
  const { status, reason } = decision;

  if (!status || ![APPLICATION_STATUS.APPROVED, APPLICATION_STATUS.REJECTED].includes(status)) {
    throw new Error("Invalid status. Must be APPROVED or REJECTED.");
  }

  if (status === APPLICATION_STATUS.REJECTED && (!reason || !String(reason).trim())) {
    throw new Error("A clear rejection reason is required when rejecting an application.");
  }

  let app = teacherApplications.get(targetUserId);
  if (!app) {
    throw new Error("Teacher application not found.");
  }

  app.status = status;
  app.rejectionReason = status === APPLICATION_STATUS.REJECTED ? String(reason).trim() : null;
  app.reviewedBy = adminUser.id || "admin";
  app.reviewedByName = adminUser.name || "Administrator";
  app.reviewedAt = new Date().toISOString();
  app.updatedAt = new Date().toISOString();

  teacherApplications.set(targetUserId, app);
  return app;
}

/**
 * Lists teacher applications with optional status filter and search query.
 */
function listTeacherApplications({ status, search } = {}) {
  let list = Array.from(teacherApplications.values());

  if (status && status !== "ALL") {
    list = list.filter((a) => a.status === status);
  }

  if (search) {
    const q = String(search).toLowerCase();
    list = list.filter(
      (a) =>
        a.name.toLowerCase().includes(q) ||
        a.email.toLowerCase().includes(q) ||
        (a.school && a.school.toLowerCase().includes(q)) ||
        (a.subject && a.subject.toLowerCase().includes(q))
    );
  }

  // Sort: PENDING applications first, then by most recently updated
  list.sort((a, b) => {
    if (a.status === APPLICATION_STATUS.PENDING && b.status !== APPLICATION_STATUS.PENDING) return -1;
    if (b.status === APPLICATION_STATUS.PENDING && a.status !== APPLICATION_STATUS.PENDING) return 1;
    return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
  });

  return list;
}

module.exports = {
  APPLICATION_STATUS,
  ALLOWED_DOC_EXTENSIONS,
  MAX_DOC_SIZE_BYTES,
  validateTeacherDocument,
  verifyDocumentSignature,
  isTeacherApproved,
  getApplicationByUserId,
  createPendingTeacherApplication,
  saveTeacherApplication,
  addDocumentToApplication,
  reviewTeacherApplication,
  listTeacherApplications,
  _teacherApplicationsMap: teacherApplications,
};
