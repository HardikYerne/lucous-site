/**
 * File validation and signature verification service for LUCOUS
 * Enforces strict MIME, extension, magic byte signatures, and size constraints.
 */

const crypto = require("crypto");
const path = require("path");

// Supported extensions and canonical MIME mappings
const SUPPORTED_EXTENSIONS = {
  ".pdf": "application/pdf",
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".txt": "text/plain",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
};

// Maximum default upload size: 15MB, configurable via MAX_UPLOAD_SIZE_MB env variable
function getMaxUploadSizeBytes() {
  const envMb = parseFloat(process.env.MAX_UPLOAD_SIZE_MB);
  if (!isNaN(envMb) && envMb > 0) {
    return Math.floor(envMb * 1024 * 1024);
  }
  return 15 * 1024 * 1024; // 15 MB
}

/**
 * Validates the binary header (magic bytes) against the declared extension.
 * Returns true if valid, false otherwise.
 */
function verifyFileSignature(buffer, extension) {
  if (!buffer || buffer.length < 4) {
    return false;
  }

  const ext = extension.toLowerCase();

  // 1. PDF: %PDF- (0x25, 0x50, 0x44, 0x46)
  if (ext === ".pdf") {
    return (
      buffer[0] === 0x25 &&
      buffer[1] === 0x50 &&
      buffer[2] === 0x44 &&
      buffer[3] === 0x46
    );
  }

  // 2. PNG: 89 50 4E 47 0D 0A 1A 0A
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

  // 3. JPEG: FF D8 FF
  if (ext === ".jpg" || ext === ".jpeg") {
    return buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  }

  // 4. DOCX: ZIP container PK\x03\x04 (0x50, 0x4B, 0x03, 0x04) and OpenXML signature
  if (ext === ".docx") {
    const isZip = (
      buffer[0] === 0x50 &&
      buffer[1] === 0x4b &&
      buffer[2] === 0x03 &&
      buffer[3] === 0x04
    );
    if (!isZip) return false;

    // Deep OpenXML inspection: Word documents must contain [Content_Types].xml or word/ parts
    const inspectionSample = buffer.subarray(0, Math.min(buffer.length, 65536)).toString("latin1");
    const hasOpenXmlParts = inspectionSample.includes("[Content_Types].xml") || inspectionSample.includes("word/");
    return hasOpenXmlParts;
  }

  // 5. TXT: Plain text file
  if (ext === ".txt") {
    // Check for obvious binary executable magic numbers
    // MZ (Windows PE): 0x4D, 0x5A
    if (buffer[0] === 0x4d && buffer[1] === 0x5a) return false;
    // ELF (Linux): 0x7F, 0x45, 0x4C, 0x46
    if (buffer[0] === 0x7f && buffer[1] === 0x45 && buffer[2] === 0x4c && buffer[3] === 0x46) return false;

    // Check for null bytes in the first 2KB (binary indicator)
    const checkLen = Math.min(buffer.length, 2048);
    for (let i = 0; i < checkLen; i++) {
      if (buffer[i] === 0x00) {
        return false;
      }
    }

    // Verify valid UTF-8 string conversion without errors
    try {
      const sample = buffer.subarray(0, checkLen).toString("utf8");
      // Check for replacement character dominance (indicates corrupted binary)
      if (sample.includes("\uFFFD\uFFFD\uFFFD")) {
        return false;
      }
    } catch {
      return false;
    }

    return true;
  }

  return false;
}

/**
 * Sanitizes original filename: strips path traversal, control chars, HTML/script injections,
 * and caps length.
 */
function sanitizeOriginalFilename(rawName) {
  if (!rawName || typeof rawName !== "string") return "uploaded_document";
  // 1. Strip any directory traversal paths
  let clean = path.basename(rawName.trim());
  // 2. Remove null bytes and non-printable control characters
  clean = clean.replace(/[\x00-\x1f\x7f]/g, "");
  // 3. Remove dangerous HTML / script / quote characters (< > " ' ` ;)
  clean = clean.replace(/[<>"'`;]/g, "");
  // 4. If nothing left or only dots/spaces, fallback
  clean = clean.trim();
  if (!clean || clean === "." || clean === "..") {
    return "uploaded_file";
  }
  // 5. Truncate length
  return clean.slice(0, 150);
}

/**
 * Validates an uploaded file object (e.g. from multer).
 * Returns { valid: true, sanitized: { ... } } or { valid: false, error: "..." }
 */
function validateUploadedFile(file) {
  if (!file) {
    return { valid: false, error: "No file was provided for upload." };
  }

  const { originalname, buffer, size } = file;

  // 1. Name check
  if (!originalname || typeof originalname !== "string" || !originalname.trim()) {
    return { valid: false, error: "Original file name is missing or invalid." };
  }

  const safeOriginalName = sanitizeOriginalFilename(originalname);
  const ext = path.extname(safeOriginalName).toLowerCase();

  // 2. Extension check
  if (!SUPPORTED_EXTENSIONS[ext]) {
    const allowedList = Object.keys(SUPPORTED_EXTENSIONS).join(", ");
    return {
      valid: false,
      error: `Unsupported file type '${ext || "none"}'. Supported types are: ${allowedList}.`,
    };
  }

  // 3. Buffer check & Empty file check
  if (!buffer || !Buffer.isBuffer(buffer) || buffer.length === 0 || size === 0) {
    return { valid: false, error: "Uploaded file is empty (0 bytes). Empty documents cannot be processed." };
  }

  // 4. Maximum size check
  const maxBytes = getMaxUploadSizeBytes();
  if (buffer.length > maxBytes || size > maxBytes) {
    const maxMb = (maxBytes / (1024 * 1024)).toFixed(0);
    return {
      valid: false,
      error: `File size exceeds the configured maximum limit of ${maxMb}MB.`,
    };
  }

  // 5. Signature / Magic bytes check
  if (!verifyFileSignature(buffer, ext)) {
    const extName = ext.slice(1).toUpperCase();
    return {
      valid: false,
      isValid: false,
      error: `File signature mismatch for '${safeOriginalName}'. The file content does not match its ${extName} format.`,
    };
  }

  // 6. Generate SHA-256 checksum and safe storage key
  const checksum = crypto.createHash("sha256").update(buffer).digest("hex");
  const uniqueId = crypto.randomUUID();
  const safeStorageKey = `${uniqueId}${ext}`;

  return {
    valid: true,
    isValid: true,
    sanitized: {
      originalName: safeOriginalName,
      extension: ext,
      fileType: SUPPORTED_EXTENSIONS[ext],
      fileSize: buffer.length,
      checksum,
      storageKey: safeStorageKey,
    },
  };
}


/**
 * Convenience helper to validate a raw Buffer directly.
 */
function validateFile(buffer, originalname) {
  const fileObj = {
    originalname,
    buffer,
    size: buffer ? buffer.length : 0,
  };
  const res = validateUploadedFile(fileObj);
  if (!res.valid) {
    return {
      isValid: false,
      valid: false,
      error: res.error,
    };
  }
  return {
    isValid: true,
    valid: true,
    extension: res.sanitized.extension,
    mimeType: res.sanitized.fileType,
    fileType: res.sanitized.fileType,
    fileSize: res.sanitized.fileSize,
    checksum: res.sanitized.checksum,
    storageKey: res.sanitized.storageKey,
    originalName: res.sanitized.originalName,
  };
}

module.exports = {
  SUPPORTED_EXTENSIONS,
  getMaxUploadSizeBytes,
  verifyFileSignature,
  validateUploadedFile,
  validateFile,
};

