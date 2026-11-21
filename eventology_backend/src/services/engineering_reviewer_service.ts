import { db, hasFirestoreCredentials } from "../config/firebase";
import { FieldValue } from "firebase-admin/firestore";
import {
  TechnicalReviewCategory,
  TechnicalReviewerRole,
  ReviewerContext,
} from "./engineering_hold_service";

// ─── Domain Models ────────────────────────────────────────────────────────────

export type EngineeringReviewerStatus = "active" | "revoked" | "suspended";

export type ProfessionalCredentialStatus = "unverified" | "pending_verification";

export interface EngineeringReviewerProfile {
  uid: string;
  email: string;
  displayName?: string;
  authorizedDisciplines: TechnicalReviewCategory[];
  authorizedRoles: TechnicalReviewerRole[];
  status: EngineeringReviewerStatus;
  professionalCredentialStatus: ProfessionalCredentialStatus;
  isProfessionallyVerified: false;
  credentialVerificationNotes: string;
  isEmailVerified: boolean;
  licenseOrRegistrationNumber?: string;
  notes?: string;
  provisionedByUid: string;
  provisionedAt: string;
  revokedByUid?: string | null;
  revokedAt?: string | null;
  revocationReason?: string | null;
  updatedAt: string;
}

export type SanitizedReviewerProfile = Omit<EngineeringReviewerProfile, "licenseOrRegistrationNumber"> & {
  hasLicenseReference: boolean;
};

export function sanitizeReviewerProfile(profile: EngineeringReviewerProfile): SanitizedReviewerProfile {
  const { licenseOrRegistrationNumber, ...safeProfile } = profile;
  return {
    ...safeProfile,
    hasLicenseReference: Boolean(licenseOrRegistrationNumber),
  };
}

export interface ReviewerProvisioningParams {
  adminUid: string;
  targetUid: string;
  email: string;
  displayName?: string;
  disciplines: TechnicalReviewCategory[];
  roles: TechnicalReviewerRole[];
  licenseOrRegistrationNumber?: string;
  notes?: string;
}

export interface ReviewerRevocationParams {
  adminUid: string;
  targetUid: string;
  reason: string;
}

// In-memory registry fallback for hermetic unit testing / mock environments
const inMemoryReviewers: Map<string, EngineeringReviewerProfile> = new Map();

// ─── Service Implementation ───────────────────────────────────────────────────

export class EngineeringReviewerService {
  /**
   * Reset in-memory test registry (for test setup/teardown).
   */
  public static resetInMemoryRegistry(): void {
    inMemoryReviewers.clear();
  }

  /**
   * Provisions or updates an authorized engineering reviewer.
   * Can only be invoked by an authenticated administrator.
   */
  public static async provisionReviewer(
    params: ReviewerProvisioningParams
  ): Promise<EngineeringReviewerProfile> {
    const {
      adminUid,
      targetUid,
      email,
      displayName,
      disciplines,
      roles,
      licenseOrRegistrationNumber,
      notes,
    } = params;

    if (!targetUid || !email) {
      throw new Error("targetUid and email are required to provision an engineering reviewer.");
    }
    if (!roles || roles.length === 0) {
      throw new Error("At least one authorized engineering role must be assigned.");
    }
    if (!disciplines || disciplines.length === 0) {
      throw new Error("At least one authorized engineering discipline must be assigned.");
    }

    // Discipline-Role mapping validation
    for (const role of roles) {
      if (role === "fire_safety_engineer" && !disciplines.includes("fire_life_safety")) {
        throw new Error("fire_safety_engineer role requires fire_life_safety discipline.");
      }
      if (role === "structural_engineer" && !disciplines.includes("structural_rigging")) {
        throw new Error("structural_engineer role requires structural_rigging discipline.");
      }
      if (role === "electrical_engineer" && !disciplines.includes("electrical_load")) {
        throw new Error("electrical_engineer role requires electrical_load discipline.");
      }
    }

    // 1. Verify target UID and email correspond to the intended Firebase Auth account using trusted server-side data
    let auth: any;
    try {
      const { getAuth } = require("firebase-admin/auth");
      auth = getAuth();
    } catch (e: any) {
      throw new Error(`Firebase Admin Authentication is unavailable or unconfigured: ${e.message}`);
    }

    let existingUser: any;
    try {
      existingUser = await auth.getUser(targetUid);
    } catch (err: any) {
      throw new Error(`Target user UID '${targetUid}' not found in Firebase Authentication: ${err.message}`);
    }

    if (!existingUser) {
      throw new Error(`Target user UID '${targetUid}' not found in Firebase Authentication.`);
    }

    if (existingUser.email && existingUser.email.toLowerCase() !== email.toLowerCase()) {
      throw new Error(
        `Target UID '${targetUid}' email mismatch: Firebase Auth account has '${existingUser.email}', requested '${email}'.`
      );
    }

    // 2. Safely merge custom claims preserving existing platform claims
    const existingClaims = existingUser.customClaims || {};
    const updatedClaims = {
      ...existingClaims,
      engineeringRoles: roles,
      engineeringDisciplines: disciplines,
      isEngineeringReviewer: true,
    };
    await auth.setCustomUserClaims(targetUid, updatedClaims);

    // 3. Assemble profile with explicit unverified professional credential status
    const nowIso = new Date().toISOString();
    const profile: EngineeringReviewerProfile = {
      uid: targetUid,
      email: existingUser.email || email,
      displayName: displayName || existingUser.displayName,
      authorizedDisciplines: disciplines,
      authorizedRoles: roles,
      status: "active",
      professionalCredentialStatus: "unverified",
      isProfessionallyVerified: false,
      credentialVerificationNotes:
        "Administrative entry only. Professional engineering license or registration has not been independently verified.",
      isEmailVerified: Boolean(existingUser.emailVerified),
      licenseOrRegistrationNumber,
      notes,
      provisionedByUid: adminUid,
      provisionedAt: nowIso,
      revokedByUid: null,
      revokedAt: null,
      revocationReason: null,
      updatedAt: nowIso,
    };

    // 4. Update In-Memory cache for deterministic test environments
    inMemoryReviewers.set(targetUid, profile);

    // 5. Persist to Firestore engineering_reviewers collection
    if (hasFirestoreCredentials) {
      try {
        const reviewerRef = db.collection("engineering_reviewers").doc(targetUid);
        await reviewerRef.set({
          ...profile,
          updatedAt: FieldValue.serverTimestamp(),
          provisionedAtTimestamp: FieldValue.serverTimestamp(),
        });
      } catch (err: any) {
        console.warn(`[EngineeringReviewerService] Firestore set error: ${err.message}`);
      }
    }

    // 6. Record Server-Side Audit Log (omitting sensitive license details)
    if (hasFirestoreCredentials) {
      try {
        await db.collection("audit_logs").add({
          action: "provision_engineering_reviewer",
          targetId: targetUid,
          targetType: "engineering_reviewer",
          performedBy: adminUid,
          timestamp: FieldValue.serverTimestamp(),
          details: {
            email: profile.email,
            authorizedDisciplines: disciplines,
            authorizedRoles: roles,
            hasLicenseReference: Boolean(licenseOrRegistrationNumber),
            professionalCredentialStatus: "unverified",
            isProfessionallyVerified: false,
            notes: notes || null,
          },
        });
      } catch (err: any) {
        console.warn(`[EngineeringReviewerService] Audit log write warning: ${err.message}`);
      }
    }

    return profile;
  }

  /**
   * Revokes an engineering reviewer's permissions.
   * Strips custom claims and marks the profile as revoked.
   */
  public static async revokeReviewer(
    params: ReviewerRevocationParams
  ): Promise<EngineeringReviewerProfile> {
    const { adminUid, targetUid, reason } = params;

    if (!targetUid) {
      throw new Error("targetUid is required to revoke an engineering reviewer.");
    }
    if (!reason || reason.trim().length === 0) {
      throw new Error("A revocation reason must be provided for audit tracking.");
    }

    let profile = await this.getReviewerProfile(targetUid);
    if (!profile) {
      throw new Error(`Engineering reviewer profile for UID '${targetUid}' not found.`);
    }

    const nowIso = new Date().toISOString();
    profile = {
      ...profile,
      status: "revoked",
      revokedByUid: adminUid,
      revokedAt: nowIso,
      revocationReason: reason,
      updatedAt: nowIso,
    };

    // 1. Update In-Memory cache
    inMemoryReviewers.set(targetUid, profile);

    // 2. Update Firestore
    if (hasFirestoreCredentials) {
      try {
        const reviewerRef = db.collection("engineering_reviewers").doc(targetUid);
        await reviewerRef.update({
          status: "revoked",
          revokedByUid: adminUid,
          revokedAt: nowIso,
          revocationReason: reason,
          updatedAt: FieldValue.serverTimestamp(),
        });
      } catch (err: any) {
        console.warn(`[EngineeringReviewerService] Firestore update error: ${err.message}`);
      }
    }

    // 3. Clear Firebase Custom Claims and Revoke Refresh Tokens
    try {
      const { getAuth } = require("firebase-admin/auth");
      const auth = getAuth();
      const existingUser = await auth.getUser(targetUid).catch(() => null);
      if (existingUser) {
        const existingClaims = existingUser.customClaims || {};
        const updatedClaims = {
          ...existingClaims,
          engineeringRoles: [],
          engineeringDisciplines: [],
          isEngineeringReviewer: false,
        };
        await auth.setCustomUserClaims(targetUid, updatedClaims);
        await auth.revokeRefreshTokens(targetUid);
      }
    } catch (err: any) {
      console.warn(`[EngineeringReviewerService] Auth custom claims revocation warning: ${err.message}`);
    }

    // 4. Record Server-Side Audit Log
    if (hasFirestoreCredentials) {
      try {
        await db.collection("audit_logs").add({
          action: "revoke_engineering_reviewer",
          targetId: targetUid,
          targetType: "engineering_reviewer",
          performedBy: adminUid,
          timestamp: FieldValue.serverTimestamp(),
          details: {
            reason,
            revocationReason: reason,
            priorDisciplines: profile.authorizedDisciplines,
            priorRoles: profile.authorizedRoles,
          },
        });
      } catch (err: any) {
        console.warn(`[EngineeringReviewerService] Audit log write warning: ${err.message}`);
      }
    }

    return profile;
  }

  /**
   * Retrieves a reviewer's profile by UID from Firestore or in-memory fallback.
   */
  public static async getReviewerProfile(uid: string): Promise<EngineeringReviewerProfile | null> {
    if (!uid) return null;

    if (inMemoryReviewers.has(uid)) {
      return inMemoryReviewers.get(uid)!;
    }

    if (hasFirestoreCredentials) {
      try {
        const snap = await db.collection("engineering_reviewers").doc(uid).get();
        if (snap.exists) {
          const data = snap.data() as EngineeringReviewerProfile;
          inMemoryReviewers.set(uid, data);
          return data;
        }
      } catch (err: any) {
        console.warn(`[EngineeringReviewerService] getReviewerProfile warning: ${err.message}`);
      }
    }

    return null;
  }

  /**
   * Lists reviewer profiles, optionally filtering by status.
   */
  public static async listReviewers(
    statusFilter?: EngineeringReviewerStatus
  ): Promise<EngineeringReviewerProfile[]> {
    const list: EngineeringReviewerProfile[] = [];

    if (hasFirestoreCredentials) {
      try {
        let q: any = db.collection("engineering_reviewers");
        if (statusFilter) {
          q = q.where("status", "==", statusFilter);
        }
        const snap = await q.get();
        for (const doc of snap.docs) {
          const profile = doc.data() as EngineeringReviewerProfile;
          list.push(profile);
          inMemoryReviewers.set(profile.uid, profile);
        }
        return list;
      } catch (err: any) {
        console.warn(`[EngineeringReviewerService] listReviewers warning: ${err.message}`);
      }
    }

    // Fallback to in-memory store
    for (const profile of inMemoryReviewers.values()) {
      if (!statusFilter || profile.status === statusFilter) {
        list.push(profile);
      }
    }
    return list;
  }

  /**
   * Validates whether an authenticated reviewer has active, verified permissions
   * for a required technical role.
   *
   * SECURITY INVARIANTS:
   * 1. Never trusts client-supplied role or credential fields.
   * 2. General admin role does NOT grant engineering sign-off authority.
   * 3. Revoked reviewer profiles are strictly rejected.
   * 4. Scopes are strictly segregated between disciplines.
   */
  public static async verifyReviewerAuthorization(
    requiredRole: TechnicalReviewerRole,
    reviewer: ReviewerContext
  ): Promise<boolean> {
    if (!reviewer || !reviewer.uid) {
      return false;
    }

    // 1. Check Registry Status (Revocation Check)
    const profile = await this.getReviewerProfile(reviewer.uid);
    if (profile) {
      if (profile.status === "revoked") {
        return false; // Explicitly revoked
      }
      if (profile.status === "active" && profile.authorizedRoles.includes(requiredRole)) {
        return true;
      }
    }

    // 2. Check Verified Token Custom Claims (if token verified by Firebase Admin)
    const customRoles: string[] = [];
    if (Array.isArray(reviewer.customClaims?.engineeringRoles)) {
      customRoles.push(...reviewer.customClaims.engineeringRoles);
    }
    if (Array.isArray(reviewer.customClaims?.roles)) {
      customRoles.push(...reviewer.customClaims.roles);
    }
    if (Array.isArray(reviewer.customClaims?.engineeringCredentials)) {
      customRoles.push(...reviewer.customClaims.engineeringCredentials);
    }

    // If exact role is in verified token claims and NOT revoked
    if (customRoles.includes(requiredRole)) {
      if (profile && profile.status !== "active") {
        return false;
      }
      return true;
    }

    // Reviewer role assigned directly via verified token claims (not client body)
    if (reviewer.role === requiredRole) {
      if (profile && profile.status !== "active") {
        return false;
      }
      return true;
    }

    return false;
  }
}
