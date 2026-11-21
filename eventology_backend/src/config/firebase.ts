import { initializeApp, getApps, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import * as dotenv from "dotenv";
import * as path from "path";
import * as fs from "fs";

dotenv.config({ path: path.join(__dirname, "../../.env") });

// Delete nonexistent credential paths in local dev so Google gax/ADC does not crash on invalid file
if (process.env.GOOGLE_APPLICATION_CREDENTIALS && !fs.existsSync(process.env.GOOGLE_APPLICATION_CREDENTIALS)) {
  delete process.env.GOOGLE_APPLICATION_CREDENTIALS;
}

const isEmulatorExplicit = process.env.USE_FIREBASE_EMULATOR === "true";

if (process.env.NODE_ENV === "production" && (isEmulatorExplicit || process.env.FIRESTORE_EMULATOR_HOST || process.env.FIREBASE_AUTH_EMULATOR_HOST)) {
  throw new Error("[FATAL] Firebase emulators cannot be enabled when NODE_ENV is 'production'.");
}

if (isEmulatorExplicit) {
  if (!process.env.FIRESTORE_EMULATOR_HOST) {
    process.env.FIRESTORE_EMULATOR_HOST = "127.0.0.1:8080";
  }
  if (!process.env.FIREBASE_AUTH_EMULATOR_HOST) {
    process.env.FIREBASE_AUTH_EMULATOR_HOST = "127.0.0.1:9099";
  }
  if (!process.env.GCLOUD_PROJECT) {
    process.env.GCLOUD_PROJECT = process.env.FIREBASE_PROJECT_ID || "eventalogy-p1";
  }
}

if (!getApps().length) {
  const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT;
  const credPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;

  if (isEmulatorExplicit || process.env.FIRESTORE_EMULATOR_HOST) {
    initializeApp({ projectId: process.env.FIREBASE_PROJECT_ID || "eventalogy-p1" });
  } else if (serviceAccountJson) {
    // Production (Koyeb / Cloud Run): credentials injected as a JSON string env var.
    let serviceAccount: object;
    try {
      serviceAccount = JSON.parse(serviceAccountJson);
    } catch {
      throw new Error(
        "[FATAL] FIREBASE_SERVICE_ACCOUNT env var is set but is not valid JSON. " +
        "Paste the entire service-account JSON as a single-line string."
      );
    }
    initializeApp({ credential: cert(serviceAccount as any) });
  } else if (credPath && fs.existsSync(credPath)) {
    // Local development fallback: file-path-based ADC
    initializeApp();
  } else {
    // In production, missing credentials MUST fail loudly and immediately
    if (process.env.NODE_ENV === "production") {
      throw new Error(
        "[FATAL] Firebase Admin production credentials are missing. " +
        "Set FIREBASE_SERVICE_ACCOUNT (JSON string) for production deployment."
      );
    }
    // Development / offline fallback: initialize with Project ID for token verification
    initializeApp({ projectId: process.env.FIREBASE_PROJECT_ID || "eventalogy-p1" });
  }
}

// The Eventology project uses the 'user-data' named Firestore database,
// not the default database. All agent tools and services must use this instance.
export const db = getFirestore("user-data");
try {
  if (typeof (db as any).settings === "function") {
    (db as any).settings({ ignoreUndefinedProperties: true });
  }
} catch (_) {}

export const isEmulatorMode = Boolean(
  isEmulatorExplicit ||
  process.env.FIRESTORE_EMULATOR_HOST ||
  process.env.FIREBASE_AUTH_EMULATOR_HOST
);

export const hasFirestoreCredentials = Boolean(
  isEmulatorMode ||
  process.env.FIREBASE_SERVICE_ACCOUNT ||
  (process.env.GOOGLE_APPLICATION_CREDENTIALS && fs.existsSync(process.env.GOOGLE_APPLICATION_CREDENTIALS))
);

