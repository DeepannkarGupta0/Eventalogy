import { Router, Request, Response } from "express";
import { db } from "../config/firebase";
import { FieldValue } from "firebase-admin/firestore";
import { Command } from "@langchain/langgraph";
import { eventologyAgentApp } from "../graph";
import {
  EngineeringHoldService,
  TechnicalReviewerRole,
  TechnicalReviewDecision,
  ReviewerContext,
  TechnicalReviewRecord,
} from "../services/engineering_hold_service";
import {
  EngineeringReviewerService,
  sanitizeReviewerProfile,
} from "../services/engineering_reviewer_service";

const router = Router();

// Middleware to ensure user is admin or verified engineering reviewer
const requireAdminOrReviewer = async (req: Request, res: Response, next: Function) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Missing or invalid authorization" });
    }
    const token = authHeader.split("Bearer ")[1];
    let decodedToken: any;
    try {
      const { getAuth } = require("firebase-admin/auth");
      decodedToken = await getAuth().verifyIdToken(token);
    } catch (e: any) {
      // SECURITY HARDENING: In production, NEVER accept unverified base64 tokens.
      // Unsigned token fallback is strictly restricted to automated unit test environments (NODE_ENV === "test").
      if (process.env.NODE_ENV === "test") {
        const parts = token.split(".");
        if (parts.length === 3) {
          decodedToken = JSON.parse(Buffer.from(parts[1], "base64").toString("utf-8"));
        } else {
          throw e;
        }
      } else {
        throw e;
      }
    }

    (req as any).user = decodedToken;

    const isAdmin = decodedToken.role === "admin";
    const isEngReviewer =
      decodedToken.isEngineeringReviewer === true ||
      (Array.isArray(decodedToken.engineeringRoles) && decodedToken.engineeringRoles.length > 0) ||
      ["fire_safety_engineer", "structural_engineer", "electrical_engineer"].includes(decodedToken.role);

    const isTechnicalReviewPath = req.path.startsWith("/technical-reviews");
    if (!isAdmin && !isTechnicalReviewPath) {
      return res.status(403).json({ error: "Admin access required" });
    }

    if (!isAdmin && !isEngReviewer) {
      return res.status(403).json({ error: "Admin or verified engineering reviewer access required" });
    }

    next();
  } catch (err: any) {
    return res.status(401).json({ error: "Unauthorized", details: err.message });
  }
};

router.use(requireAdminOrReviewer);

// ── Vendor Operations ─────────────────────────────────────────────────────────

router.post("/vendors/:id/verify", async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const adminUid = (req as any).user.uid;
    
    const vendorRef = db.collection("vendors").doc(id);
    const vendorDoc = await vendorRef.get();
    
    if (!vendorDoc.exists) {
      return res.status(404).json({ error: "Vendor not found" });
    }
    
    if (vendorDoc.data()?.verified === true) {
      return res.status(400).json({ error: "Vendor is already verified" });
    }
    
    const vendorData = vendorDoc.data();
    const batch = db.batch();
    batch.update(vendorRef, { 
      verified: true, 
      status: "active",
      payoutStatus: "verified",
      updatedAt: FieldValue.serverTimestamp() 
    });

    if (vendorData?.userId) {
      try {
        const { getAuth } = require("firebase-admin/auth");
        await getAuth().setCustomUserClaims(vendorData.userId, { role: "vendor" });
        const userRef = db.collection("users").doc(vendorData.userId);
        batch.update(userRef, { role: "vendor", updatedAt: FieldValue.serverTimestamp() });
      } catch (claimErr) {
        console.warn("[Admin] Custom claim elevation warning:", claimErr);
      }
    }
    
    const auditRef = db.collection("audit_logs").doc();
    batch.set(auditRef, {
      action: "verify_vendor",
      targetId: id,
      targetType: "vendor",
      adminId: adminUid,
      timestamp: FieldValue.serverTimestamp(),
      details: { previousState: false, newState: true, roleElevated: "vendor" }
    });
    
    await batch.commit();
    return res.json({ success: true });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

router.post("/vendors/:id/status", async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const { status } = req.body; // 'active', 'suspended', etc.
    const adminUid = (req as any).user.uid;
    
    const validStatuses = ["active", "suspended", "inactive", "pending"];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: "Invalid status" });
    }
    
    const vendorRef = db.collection("vendors").doc(id);
    const vendorDoc = await vendorRef.get();
    
    if (!vendorDoc.exists) {
      return res.status(404).json({ error: "Vendor not found" });
    }
    
    const oldStatus = vendorDoc.data()?.status;
    if (oldStatus === status) {
      return res.status(400).json({ error: `Vendor is already ${status}` });
    }
    
    const batch = db.batch();
    batch.update(vendorRef, { status, updatedAt: FieldValue.serverTimestamp() });
    
    // Automatically grant the vendor role if they are being activated!
    if (status === "active" && vendorDoc.data()?.userId) {
      try {
        const { getAuth } = require("firebase-admin/auth");
        await getAuth().setCustomUserClaims(vendorDoc.data()!.userId, { role: "vendor" });
      } catch (authErr) {
        console.warn("Failed to set vendor custom claims. User may not exist in Firebase Auth.", authErr);
      }
    }

    const auditRef = db.collection("audit_logs").doc();
    batch.set(auditRef, {
      action: "change_vendor_status",
      targetId: id,
      targetType: "vendor",
      adminId: adminUid,
      timestamp: FieldValue.serverTimestamp(),
      details: { previousState: oldStatus, newState: status }
    });
    
    await batch.commit();
    return res.json({ success: true });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// ── Event Operations ──────────────────────────────────────────────────────────

router.post("/events/:id/cancel", async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const adminUid = (req as any).user.uid;
    
    const eventRef = db.collection("events").doc(id);
    const eventDoc = await eventRef.get();
    
    if (!eventDoc.exists) {
      return res.status(404).json({ error: "Event not found" });
    }
    
    const oldStatus = eventDoc.data()?.status;
    if (oldStatus === "cancelled") {
      return res.status(400).json({ error: "Event is already cancelled" });
    }
    
    const batch = db.batch();
    batch.update(eventRef, { status: "cancelled", updatedAt: FieldValue.serverTimestamp() });
    
    // Cascading cancellations
    const bookingsSnap = await db.collection("bookings").where("eventId", "==", id).get();
    bookingsSnap.docs.forEach(doc => {
      if (doc.data().status !== "cancelled") {
        batch.update(doc.ref, { status: "cancelled", updatedAt: FieldValue.serverTimestamp() });
      }
    });
    
    const enquiriesSnap = await db.collection("enquiries").where("eventId", "==", id).get();
    enquiriesSnap.docs.forEach(doc => {
      if (doc.data().status !== "cancelled" && doc.data().status !== "declined") {
        batch.update(doc.ref, { status: "cancelled", updatedAt: FieldValue.serverTimestamp() });
      }
    });
    
    const auditRef = db.collection("audit_logs").doc();
    batch.set(auditRef, {
      action: "cancel_event",
      targetId: id,
      targetType: "event",
      adminId: adminUid,
      timestamp: FieldValue.serverTimestamp(),
      details: { previousState: oldStatus, newState: "cancelled", cascaded: true }
    });
    
    await batch.commit();
    return res.json({ success: true });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// ── Technical Safety Holds & Engineering Sign-Off ───────────────────────────

router.get("/technical-reviews", async (req: Request, res: Response) => {
  try {
    const snap = await db.collection("agent_tasks")
      .where("taskType", "==", "technical_safety_hold")
      .get();
    const tasks = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    return res.json({ success: true, count: tasks.length, tasks });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

router.get("/technical-reviews/:id", async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const doc = await db.collection("agent_tasks").doc(id).get();
    if (!doc.exists) {
      return res.status(404).json({ error: "Technical review task not found" });
    }
    return res.json({ success: true, task: { id: doc.id, ...doc.data() } });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

router.post("/technical-reviews/:id/sign-off", async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    // Security: NEVER accept reviewerRole or authorization elevation from client body!
    const { decision, comments, artifactVersion, licenseOrCredential } = req.body;
    const user = (req as any).user;

    if (!user || !user.uid) {
      return res.status(401).json({ error: "Authentication required." });
    }

    if (!decision || (decision !== "approved" && decision !== "rejected")) {
      return res.status(400).json({ error: "decision ('approved' | 'rejected') is required" });
    }
    if (typeof artifactVersion !== "number") {
      return res.status(400).json({ error: "artifactVersion (number) is required" });
    }

    const taskRef = db.collection("agent_tasks").doc(id);

    // Concurrency-Safe Transaction: Atomic read, validation, state transition, and audit log
    const result = await db.runTransaction(async (transaction) => {
      const taskDoc = await transaction.get(taskRef);
      if (!taskDoc.exists) {
        throw new Error("NOT_FOUND: Technical review task not found");
      }

      const taskData = taskDoc.data() || {};
      if (taskData.taskType !== "technical_safety_hold") {
        throw new Error("INVALID_TASK: Task is not a technical safety hold.");
      }

      // Replay Protection: reject if task is already approved
      if (taskData.status === "approved") {
        throw new Error("ALREADY_APPROVED: Conflict: This technical review task has already been approved.");
      }

      const requiredRole: TechnicalReviewerRole = taskData.requiredRole || taskData.input?.requiredRole;
      const currentArtifactVersion = taskData.input?.artifactVersion;

      // Derive verified reviewer context strictly from server registry or verified token custom claims
      const reviewerProfile = await EngineeringReviewerService.getReviewerProfile(user.uid);
      let verifiedRole: TechnicalReviewerRole | string = user.role || "unknown";

      if (reviewerProfile && reviewerProfile.status === "active") {
        const matchingRole = reviewerProfile.authorizedRoles.find((r) => r === requiredRole);
        if (matchingRole) {
          verifiedRole = matchingRole;
        }
      } else if (Array.isArray(user.engineeringRoles)) {
        const matchingRole = user.engineeringRoles.find((r: string) => r === requiredRole);
        if (matchingRole) {
          verifiedRole = matchingRole;
        }
      }

      const reviewerContext: ReviewerContext = {
        uid: user.uid,
        email: user.email,
        role: verifiedRole,
        customClaims: user,
      };

      // 1. Enforce Server-Side Authorization Check via EngineeringReviewerService
      const isAuthorized = await EngineeringReviewerService.verifyReviewerAuthorization(requiredRole, reviewerContext);
      if (!isAuthorized) {
        throw new Error(
          `UNAUTHORIZED: Sign-off for category '${taskData.reviewCategory}' strictly requires '${requiredRole}'. Reviewer ${user.uid} with verified role '${reviewerContext.role}' is not authorized.`
        );
      }

      // 2. Enforce Artifact Version Matching (Prevent Stale Sign-Off)
      if (currentArtifactVersion && artifactVersion !== currentArtifactVersion) {
        throw new Error(
          `STALE_VERSION: Stale artifact version: Task artifact is at version ${currentArtifactVersion}, cannot sign off on version ${artifactVersion}.`
        );
      }

      // 3. Atomically update task and log to audit collection within transaction
      const nowIso = new Date().toISOString();
      const historyEntry = {
        status: decision as TechnicalReviewDecision,
        timestamp: nowIso,
        reviewerId: user.uid,
        reviewerRole: reviewerContext.role,
        note: comments || "",
      };

      transaction.update(taskRef, {
        status: decision === "approved" ? "approved" : "rejected",
        approvedBy: user.uid,
        output: {
          decision,
          reviewerId: user.uid,
          reviewerRole: reviewerContext.role,
          hasLicenseReference: Boolean(licenseOrCredential),
          comments: comments || "",
          signedArtifactVersion: artifactVersion,
          decidedAt: nowIso,
        },
        history: FieldValue.arrayUnion(historyEntry),
        completedAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });

      const auditRef = db.collection("audit_logs").doc();
      transaction.set(auditRef, {
        action: "technical_safety_sign_off",
        targetId: id,
        targetType: "technical_review_hold",
        category: taskData.reviewCategory,
        decision,
        signedArtifactVersion: artifactVersion,
        reviewerUid: user.uid,
        reviewerRole: reviewerContext.role,
        timestamp: FieldValue.serverTimestamp(),
        details: {
          workflowId: taskData.workflowId,
          comments: comments || "",
          hasLicenseReference: Boolean(licenseOrCredential),
        },
      });

      return {
        taskId: id,
        decision,
        category: taskData.reviewCategory,
        signedArtifactVersion: artifactVersion,
        workflowId: taskData.workflowId,
        eventId: taskData.eventId,
        holdId: taskData.input?.holdId,
        artifactId: taskData.input?.artifactId,
        reviewerContext,
      };
    });

    // 1. If LangGraph workflow thread is active and suspended at an interrupt, resume execution
    try {
      const threadId = result.workflowId;
      if (threadId && eventologyAgentApp) {
        const config = { configurable: { thread_id: threadId } };
        const checkState = await eventologyAgentApp.getState(config);
        if (checkState?.values && checkState.next && checkState.next.length > 0) {
          await eventologyAgentApp.invoke(
            new Command({
              resume: {
                holdId: result.holdId,
                decision: result.decision,
                reviewer: result.reviewerContext,
                comments: comments || "",
                artifactVersion,
                licenseOrCredential,
              },
            }),
            config
          );
        }
      }
    } catch (graphErr: any) {
      console.warn("[AdminRouter] LangGraph thread resume notice:", graphErr.message);
    }

    // 2. Synchronize canonical event document in Firestore if eventId is linked
    try {
      const targetEventId = result.eventId;
      if (targetEventId && typeof targetEventId === "string") {
        const eventRef = db.collection("events").doc(targetEventId);
        const eventSnap = await eventRef.get();
        if (eventSnap.exists) {
          const eventData = eventSnap.data() || {};
          const currentReviews: TechnicalReviewRecord[] = eventData.technicalReviews || [];
          const updatedReviews = currentReviews.map((r) => {
            if (r.holdId === result.holdId || r.taskId === id) {
              return {
                ...r,
                status: decision as TechnicalReviewDecision,
                assignedReviewerId: user.uid,
                decisionTimestamp: new Date().toISOString(),
                decisionComments: comments || "",
                reviewedArtifactVersion: artifactVersion,
                updatedAt: new Date().toISOString(),
              };
            }
            return r;
          });

          const overallStatus = EngineeringHoldService.computeOverallStatus(updatedReviews);

          const currentArtifacts: any[] = eventData.artifacts || [];
          const updatedArtifacts = currentArtifacts.map((art) => {
            if (art.artifactId === result.artifactId) {
              return {
                ...art,
                status: decision === "approved" ? "verified" : "rejected",
                requiresReview: decision !== "approved",
                metadata: {
                  ...(art.metadata || {}),
                  verifiedBy: user.uid,
                  reviewerRole: result.reviewerContext.role,
                  reviewDecision: decision,
                  decidedAt: new Date().toISOString(),
                  mitigationComments: comments || "",
                  hasLicenseReference: Boolean(licenseOrCredential),
                },
                updatedAt: new Date().toISOString(),
              };
            }
            return art;
          });

          await eventRef.update({
            technicalReviews: updatedReviews,
            technicalReviewStatus: overallStatus,
            artifacts: updatedArtifacts,
            updatedAt: FieldValue.serverTimestamp(),
          });
        }
      }
    } catch (eventSyncErr: any) {
      console.warn("[AdminRouter] Event sync notice:", eventSyncErr.message);
    }

    return res.json({
      success: true,
      ...result,
    });
  } catch (err: any) {
    if (err.message?.startsWith("NOT_FOUND:")) {
      return res.status(404).json({ error: err.message.replace(/^NOT_FOUND:\s*/, "") });
    }
    if (err.message?.startsWith("INVALID_TASK:")) {
      return res.status(400).json({ error: err.message.replace(/^INVALID_TASK:\s*/, "") });
    }
    if (err.message?.startsWith("ALREADY_APPROVED:") || err.message?.startsWith("STALE_VERSION:")) {
      return res.status(409).json({ error: err.message.replace(/^[^:]+:\s*/, "") });
    }
    if (err.message?.startsWith("UNAUTHORIZED:")) {
      return res.status(403).json({ error: err.message.replace(/^UNAUTHORIZED:\s*/, "") });
    }
    return res.status(500).json({ error: err.message });
  }
});

// ─── Engineering Reviewer Management (Admin Only) ─────────────────────────────

router.get("/engineering-reviewers", async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (user?.role !== "admin") {
      return res.status(403).json({ error: "Admin access required to view reviewer registry." });
    }
    const status = req.query.status as any;
    const reviewers = await EngineeringReviewerService.listReviewers(status);
    const sanitized = reviewers.map(sanitizeReviewerProfile);
    return res.json({ success: true, count: sanitized.length, reviewers: sanitized });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

router.get("/engineering-reviewers/:uid", async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (user?.role !== "admin") {
      return res.status(403).json({ error: "Admin access required." });
    }
    const targetUid = String(req.params.uid);
    const profile = await EngineeringReviewerService.getReviewerProfile(targetUid);
    if (!profile) {
      return res.status(404).json({ error: `Reviewer profile for UID '${targetUid}' not found.` });
    }
    return res.json({ success: true, profile: sanitizeReviewerProfile(profile) });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

router.post("/engineering-reviewers", async (req: Request, res: Response) => {
  try {
    const adminUser = (req as any).user;
    if (adminUser?.role !== "admin") {
      return res.status(403).json({ error: "Admin access required to provision engineering reviewers." });
    }
    const { targetUid, email, displayName, disciplines, roles, licenseOrRegistrationNumber, notes } = req.body;
    if (!targetUid || !email || !disciplines || !roles) {
      return res.status(400).json({ error: "targetUid, email, disciplines, and roles are required." });
    }

    const profile = await EngineeringReviewerService.provisionReviewer({
      adminUid: adminUser.uid,
      targetUid,
      email,
      displayName,
      disciplines,
      roles,
      licenseOrRegistrationNumber,
      notes,
    });

    return res.status(201).json({ success: true, profile: sanitizeReviewerProfile(profile) });
  } catch (err: any) {
    return res.status(400).json({ error: err.message });
  }
});

router.post("/engineering-reviewers/:uid/revoke", async (req: Request, res: Response) => {
  try {
    const adminUser = (req as any).user;
    if (adminUser?.role !== "admin") {
      return res.status(403).json({ error: "Admin access required to revoke engineering reviewers." });
    }
    const targetUid = String(req.params.uid);
    const { reason } = req.body;
    if (!reason) {
      return res.status(400).json({ error: "Revocation reason is required." });
    }

    const profile = await EngineeringReviewerService.revokeReviewer({
      adminUid: adminUser.uid,
      targetUid,
      reason,
    });

    return res.json({ success: true, profile: sanitizeReviewerProfile(profile) });
  } catch (err: any) {
    return res.status(400).json({ error: err.message });
  }
});

export default router;
