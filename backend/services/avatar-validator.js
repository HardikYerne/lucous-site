/**
 * Avatar Image Validator for LUCOUS
 * Enforces strict MIME types, extensions, magic byte signatures, and file size limits.
 */

const path = require("path");

const MAX_AVATAR_SIZE_BYTES = 3 * 1024 * 1024; // 3 MB

const ALLOWED_AVATAR_MIME_TYPES = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/gif",
]);

const ALLOWED_AVATAR_EXTENSIONS = new Set([
  ".jpg",
  ".jpeg",
  ".png",
  ".webp",
  ".gif",
]);

/**
 * Validates binary signature (magic bytes) for image formats.
 */
function verifyImageSignature(buffer, extension) {
  if (!buffer || buffer.length < 8) return false;
  const ext = extension.toLowerCase();

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (ext === ".png") {
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

  // GIF: GIF87a (47 49 46 38 37 61) or GIF89a (47 49 46 38 39 61)
  if (ext === ".gif") {
    return (
      buffer[0] === 0x47 &&
      buffer[1] === 0x49 &&
      buffer[2] === 0x46 &&
      buffer[3] === 0x38 &&
      (buffer[4] === 0x37 || buffer[4] === 0x39) &&
      buffer[5] === 0x61
    );
  }

  // WebP: RIFF at 0..3 (52 49 46 46) and WEBP at 8..11 (57 45 42 50)
  if (ext === ".webp") {
    if (buffer.length < 12) return false;
    const isRiff =
      buffer[0] === 0x52 &&
      buffer[1] === 0x49 &&
      buffer[2] === 0x46 &&
      buffer[3] === 0x46;
    const isWebp =
      buffer[8] === 0x57 &&
      buffer[9] === 0x45 &&
      buffer[10] === 0x42 &&
      buffer[11] === 0x50;
    return isRiff && isWebp;
  }

  return false;
}

/**
 * Validates an uploaded avatar file object.
 * Returns { valid: boolean, error?: string, extension?: string, mimeType?: string }
 */
function validateAvatarFile(file) {
  if (!file) {
    return { valid: false, error: "No image file provided." };
  }

  const { originalname, mimetype, buffer, size } = file;

  if (!buffer || buffer.length === 0) {
    return { valid: false, error: "Image file is empty." };
  }

  const actualSize = size || buffer.length;
  if (actualSize > MAX_AVATAR_SIZE_BYTES) {
    return {
      valid: false,
      error: `Profile picture exceeds the 3MB size limit (got ${(actualSize / (1024 * 1024)).toFixed(2)}MB).`,
    };
  }

  if (actualSize < 16) {
    return { valid: false, error: "Image file is too small to be a valid image." };
  }

  const ext = path.extname(originalname || "").toLowerCase();
  if (!ALLOWED_AVATAR_EXTENSIONS.has(ext)) {
    return {
      valid: false,
      error: `Unsupported image format (${ext || "unknown"}). Allowed formats: JPG, PNG, WebP, GIF.`,
    };
  }

  const declaredMime = (mimetype || "").toLowerCase();
  if (!ALLOWED_AVATAR_MIME_TYPES.has(declaredMime)) {
    return {
      valid: false,
      error: `Invalid image MIME type: ${declaredMime}. Allowed types: image/jpeg, image/png, image/webp, image/gif.`,
    };
  }

  if (!verifyImageSignature(buffer, ext)) {
    return {
      valid: false,
      error: "File content does not match the image header signature. Potentially corrupt or renamed file.",
    };
  }

  return {
    valid: true,
    extension: ext === ".jpeg" ? ".jpg" : ext,
    mimeType: declaredMime,
  };
}

module.exports = {
  MAX_AVATAR_SIZE_BYTES,
  validateAvatarFile,
  verifyImageSignature,
};
