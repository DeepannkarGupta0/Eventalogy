import * as fs from "fs";
import * as path from "path";
import { createHash } from "crypto";
import { getStorage } from "firebase-admin/storage";
import { getApps } from "firebase-admin/app";
import { isEmulatorMode, hasFirestoreCredentials } from "../../config/firebase";

export interface ArtifactUploadResult {
  artifactId: string;
  workflowId: string;
  storagePath: string;
  downloadUrl: string;
  byteSize: number;
  sha256Hash: string;
  isCloudStorage: boolean;
  mimeType: string;
  fileName: string;
  uploadedAt: string;
}

export interface StoredArtifactBuffer {
  buffer: Buffer;
  mimeType: string;
  fileName: string;
  sha256Hash: string;
}

export class ArtifactStorageService {
  private static readonly memoryCache = new Map<string, StoredArtifactBuffer>();
  private static readonly localStorageDir = path.join(__dirname, "../../../storage/artifacts");

  /**
   * Initializes local storage directory for offline development and test caching.
   */
  private static ensureLocalStorageDir(): void {
    if (!fs.existsSync(this.localStorageDir)) {
      fs.mkdirSync(this.localStorageDir, { recursive: true });
    }
  }

  /**
   * Validates and sanitizes artifact IDs to strictly block path traversal attacks (CWE-22).
   */
  public static sanitizeArtifactId(artifactId: string): string {
    if (!artifactId || typeof artifactId !== "string") {
      throw new Error("Invalid artifactId: must be a non-empty string.");
    }
    const raw = artifactId.trim();
    if (raw.includes("/") || raw.includes("\\") || raw.includes("..")) {
      throw new Error("Security Error: Invalid artifact ID. Path traversal sequences rejected.");
    }
    const sanitized = raw.replace(/[^a-zA-Z0-9_\-\.]/g, "");
    if (!sanitized || sanitized !== raw) {
      throw new Error("Security Error: Invalid artifact ID. Invalid characters rejected.");
    }
    return sanitized;
  }

  /**
   * Uploads and persists an artifact PDF/file to Firebase Cloud Storage with local fallback.
   * Generates a secure signed download URL or authenticated local download route.
   */
  public static async uploadArtifact(params: {
    artifactId: string;
    workflowId: string;
    buffer: Buffer;
    fileName?: string;
    mimeType?: string;
  }): Promise<ArtifactUploadResult> {
    const cleanArtifactId = this.sanitizeArtifactId(params.artifactId);
    const { workflowId, buffer } = params;
    const artifactId = cleanArtifactId;
    const mimeType = params.mimeType || "application/pdf";
    const fileName = params.fileName || `${artifactId}.pdf`;
    const byteSize = buffer.length;
    const sha256Hash = createHash("sha256").update(buffer).digest("hex");
    const uploadedAt = new Date().toISOString();

    // Cache in memory for instant high-speed retrieval
    this.memoryCache.set(artifactId, {
      buffer,
      mimeType,
      fileName,
      sha256Hash,
    });

    // Always persist to local storage directory as dual-layer backup
    this.ensureLocalStorageDir();
    const localFilePath = path.resolve(this.localStorageDir, `${artifactId}.pdf`);
    if (!localFilePath.startsWith(path.resolve(this.localStorageDir))) {
      throw new Error("Security Error: Target path escapes local storage boundary.");
    }
    fs.writeFileSync(localFilePath, buffer);

    const cloudStoragePath = `artifacts/${workflowId}/${artifactId}.pdf`;
    let downloadUrl = `/api/artifacts/download/${artifactId}`;
    let isCloudStorage = false;

    // Attempt Firebase Cloud Storage upload if initialized and credentials exist
    if (getApps().length > 0 && hasFirestoreCredentials && !isEmulatorMode) {
      try {
        const bucketName = process.env.FIREBASE_STORAGE_BUCKET || `${process.env.FIREBASE_PROJECT_ID || "eventalogy-p1"}.appspot.com`;
        const bucket = getStorage().bucket(bucketName);
        const file = bucket.file(cloudStoragePath);

        await file.save(buffer, {
          contentType: mimeType,
          metadata: {
            artifactId,
            workflowId,
            sha256Hash,
            uploadedAt,
          },
        });

        // Generate signed URL valid for 24 hours
        const [signedUrl] = await file.getSignedUrl({
          action: "read",
          expires: Date.now() + 24 * 60 * 60 * 1000,
        });

        downloadUrl = signedUrl;
        isCloudStorage = true;
      } catch (cloudErr) {
        // Fall back gracefully to local serving route
        console.warn(`[ArtifactStorageService] Cloud Storage upload bypassed; using local storage: ${(cloudErr as Error).message}`);
        downloadUrl = `/api/artifacts/download/${artifactId}`;
        isCloudStorage = false;
      }
    }

    return {
      artifactId,
      workflowId,
      storagePath: isCloudStorage ? cloudStoragePath : localFilePath,
      downloadUrl,
      byteSize,
      sha256Hash,
      isCloudStorage,
      mimeType,
      fileName,
      uploadedAt,
    };
  }

  /**
   * Retrieves an artifact binary buffer for client streaming or test assertions.
   */
  public static async getArtifactBuffer(artifactId: string): Promise<StoredArtifactBuffer | null> {
    const cleanId = this.sanitizeArtifactId(artifactId);

    // 1. Check in-memory cache
    if (this.memoryCache.has(cleanId)) {
      return this.memoryCache.get(cleanId)!;
    }

    // 2. Check local disk
    const localFilePath = path.resolve(this.localStorageDir, `${cleanId}.pdf`);
    if (!localFilePath.startsWith(path.resolve(this.localStorageDir))) {
      throw new Error("Security Error: Target path escapes local storage boundary.");
    }
    if (fs.existsSync(localFilePath)) {
      const buffer = fs.readFileSync(localFilePath);
      const sha256Hash = createHash("sha256").update(buffer).digest("hex");
      const record: StoredArtifactBuffer = {
        buffer,
        mimeType: "application/pdf",
        fileName: `${cleanId}.pdf`,
        sha256Hash,
      };
      this.memoryCache.set(cleanId, record);
      return record;
    }

    return null;
  }

  /**
   * Clears memory cache (useful for test isolation).
   */
  public static clearCache(): void {
    this.memoryCache.clear();
  }
}
