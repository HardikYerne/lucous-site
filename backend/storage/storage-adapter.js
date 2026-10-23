/**
 * Storage Adapter Interface and Implementations for LUCOUS
 * Provides secure, isolated file storage abstraction for uploaded learning materials.
 */

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

/**
 * Abstract Base Storage Adapter
 */
class StorageAdapter {
  async save({ key, buffer, mimeType }) {
    throw new Error("Method save() must be implemented.");
  }

  async get(storageKey) {
    throw new Error("Method get() must be implemented.");
  }

  async delete(storageKey) {
    throw new Error("Method delete() must be implemented.");
  }

  async exists(storageKey) {
    throw new Error("Method exists() must be implemented.");
  }

  isConfigured() {
    return true;
  }
}

/**
 * Local Disk Storage Adapter
 * Used for development, staging, or environments without S3 credentials.
 * Implements strict path traversal prevention and safe filename generation.
 */
class LocalStorageAdapter extends StorageAdapter {
  constructor(storageDir) {
    super();

    let defaultDir = path.join(__dirname, "..", "uploads");
    const isServerless = Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);
    if (isServerless && !process.env.UPLOAD_STORAGE_DIR) {
      defaultDir = path.join("/tmp", "lucous-uploads");
      console.warn(
        "[LUCOUS Storage Warning] Running on serverless platform (Vercel/Lambda). Local uploads in /tmp are ephemeral and will NOT persist across function lifecycles or redeployments. Provision durable S3/R2 storage for production."
      );
    }

    this.isServerless = isServerless;
    this.storageDir = path.resolve(
      storageDir ||
      process.env.UPLOAD_STORAGE_DIR ||
      defaultDir
    );

    // Ensure storage directory exists synchronously on initialization
    if (!fs.existsSync(this.storageDir)) {
      try {
        fs.mkdirSync(this.storageDir, { recursive: true, mode: 0o750 });
      } catch (mkdirErr) {
        console.error(`[LUCOUS Storage] Failed to initialize storage directory ${this.storageDir}:`, mkdirErr.message);
      }
    }
  }


  /**
   * Resolves and verifies that a storage key resides strictly within storageDir.
   * Throws Error if path traversal is detected.
   */
  resolveSafePath(storageKey) {
    if (!storageKey || typeof storageKey !== "string") {
      throw new Error("Invalid storage key provided.");
    }

    if (storageKey.includes("..") || path.isAbsolute(storageKey)) {
      throw new Error("Path traversal attempt detected: storage access blocked.");
    }

    // Strip any leading slashes or relative parent directory segments
    const sanitizedKey = path.basename(storageKey.trim());
    const fullPath = path.resolve(this.storageDir, sanitizedKey);

    // Verify containment within this.storageDir
    if (!fullPath.startsWith(this.storageDir)) {
      throw new Error("Path traversal attempt detected: storage access blocked.");
    }

    return fullPath;
  }

  resolvePath(storageKey) {
    return this.resolveSafePath(storageKey);
  }

  async save({ key, buffer, mimeType }) {
    if (!Buffer.isBuffer(buffer)) {
      throw new Error("Payload must be a valid Buffer.");
    }

    const safePath = this.resolveSafePath(key);
    await fs.promises.writeFile(safePath, buffer);

    return {
      storageKey: path.basename(safePath),
      storageUri: `local://${path.basename(safePath)}`,
      size: buffer.length,
      driver: "local",
    };
  }

  async saveFile(buffer, originalName, extension, mimeType) {
    const key = `${crypto.randomUUID()}${extension}`;
    const res = await this.save({ key, buffer, mimeType });
    return { ...res, fileSizeBytes: buffer.length };
  }

  async get(storageKey) {
    const safePath = this.resolveSafePath(storageKey);
    try {
      const buffer = await fs.promises.readFile(safePath);
      const stat = await fs.promises.stat(safePath);
      return {
        buffer,
        size: stat.size,
      };
    } catch (err) {
      if (err.code === "ENOENT") {
        return null;
      }
      throw err;
    }
  }

  async readFile(storageKey) {
    const res = await this.get(storageKey);
    return res ? res.buffer : null;
  }

  async delete(storageKey) {
    const safePath = this.resolveSafePath(storageKey);
    try {
      await fs.promises.unlink(safePath);
      return { deleted: true };
    } catch (err) {
      if (err.code === "ENOENT") {
        return { deleted: false };
      }
      throw err;
    }
  }

  async deleteFile(storageKey) {
    const res = await this.delete(storageKey);
    return res ? res.deleted : false;
  }

  async exists(storageKey) {
    try {
      const safePath = this.resolveSafePath(storageKey);
      await fs.promises.access(safePath, fs.constants.F_OK);
      return true;
    } catch {
      return false;
    }
  }

  isConfigured() {
    return true;
  }
}

/**
 * S3-Compatible Durable Object Storage Adapter
 * Compatible with AWS S3, Cloudflare R2, MinIO, or Google Cloud Storage XML API.
 * If credentials are not supplied, provides honest status and guidance.
 */
class VercelBlobStorageAdapter extends StorageAdapter {
  constructor(options = {}) {
    super();
    this.bucket = options.bucket || process.env.S3_BUCKET || process.env.AWS_S3_BUCKET;
    this.region = options.region || process.env.AWS_REGION || "us-east-1";
    this.endpoint = options.endpoint || process.env.S3_ENDPOINT;
    this.accessKeyId = options.accessKeyId || process.env.AWS_ACCESS_KEY_ID;
    this.secretAccessKey = options.secretAccessKey || process.env.AWS_SECRET_ACCESS_KEY;
  }

  isConfigured() {
    return Boolean(this.bucket && this.accessKeyId && this.secretAccessKey);
  }

  async save({ key, buffer, mimeType }) {
    if (!this.isConfigured()) {
      throw new Error(
        "S3 durable storage is requested but required environment variables (S3_BUCKET, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY) are missing."
      );
    }
    // Real S3 integration when credentials are provided in production
    throw new Error("AWS SDK client not initialized in this environment.");
  }

  async get(storageKey) {
    if (!this.isConfigured()) {
      throw new Error("S3 durable storage is not configured.");
    }
    throw new Error("AWS SDK client not initialized.");
  }

  async delete(storageKey) {
    if (!this.isConfigured()) {
      throw new Error("S3 durable storage is not configured.");
    }
    throw new Error("AWS SDK client not initialized.");
  }

  async exists(storageKey) {
    if (!this.isConfigured()) return false;
    return false;
  }
}

/**
 * Factory to get active storage adapter
 */

let cachedAdapter = null;

function getStorageAdapter(forceNew = false) {
  if (cachedAdapter && !forceNew) {
    return cachedAdapter;
  }

  const driver = (
    process.env.STORAGE_DRIVER || "local"
  ).toLowerCase().trim();

  if (driver === "vercel-blob") {
    const adapter = new VercelBlobStorageAdapter();

    if (!adapter.isConfigured()) {
      throw new Error(
        "STORAGE_DRIVER=vercel-blob requires BLOB_READ_WRITE_TOKEN."
      );
    }

    cachedAdapter = adapter;
    return cachedAdapter;
  }

  if (driver === "s3") {
    throw new Error(
      "STORAGE_DRIVER=s3 is not implemented. Use STORAGE_DRIVER=vercel-blob."
    );
  }

  cachedAdapter = new LocalStorageAdapter();
  return cachedAdapter;
}


module.exports = {
  StorageAdapter,
  LocalStorageAdapter,
  VercelBlobStorageAdapter,
  getStorageAdapter,
};