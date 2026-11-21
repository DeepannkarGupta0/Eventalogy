/**
 * Agent Training & Self-Improvement API Router (Milestone 62)
 *
 * REST Endpoints for:
 * - In-Context Grounded Knowledge Retrieval (PKUs)
 * - Autonomous Evaluation Harness Battery Execution
 * - Continuous Self-Improvement Analysis & Ranked Proposals
 * - SFT and DPO Training Dataset Exporters
 * - Comprehensive Multi-Discipline Physics Audits
 */

import { Router, Request, Response } from "express";
import {
  KnowledgeRetrievalService,
  ImprovementAnalyzerService,
  AgentTrainingDatasetExporter,
  EvaluationHarnessService,
} from "../services/training";
import { MultiDisciplinePhysicsService } from "../services/physics/multi_discipline_physics_service";
import { verifyFirebaseToken } from "../middleware/auth";

export const trainingRouter = Router();

// Middleware ensuring training & evaluation APIs are strictly restricted to admins or engineering reviewers
const requireAdminOrReviewer = (req: Request, res: Response, next: Function) => {
  const user = (req as any).user;
  const isAdmin = user?.role === "admin";
  const isEngReviewer =
    user?.isEngineeringReviewer === true ||
    (Array.isArray(user?.engineeringRoles) && user.engineeringRoles.length > 0) ||
    ["fire_safety_engineer", "structural_engineer", "electrical_engineer"].includes(user?.role);

  if (!isAdmin && !isEngReviewer) {
    return res.status(403).json({
      error: "Forbidden: Admin or verified engineering reviewer authorization required.",
    });
  }
  next();
};

trainingRouter.use(verifyFirebaseToken);
trainingRouter.use(requireAdminOrReviewer);

/**
 * GET /api/training/pku/context/:venueName
 * Retrieves grounded prompt injection context and historical benchmarks for a venue.
 */
trainingRouter.get("/pku/context/:venueName", async (req: Request, res: Response) => {
  try {
    const venueName = String(req.params.venueName);
    const intelligence = await KnowledgeRetrievalService.getGroundedVenueIntelligence(venueName);
    if (!intelligence) {
      return res.status(404).json({
        error: `No grounded historical PKU telemetry found for venue: ${venueName}`,
      });
    }
    return res.json({ success: true, intelligence });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/training/evaluate
 * Runs the Evaluation Harness battery across Golden Scenarios.
 */
trainingRouter.post("/evaluate", (req: Request, res: Response) => {
  try {
    const report = EvaluationHarnessService.runBattery();
    return res.json({ success: true, report });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/training/proposals
 * Evaluates operational telemetry samples and returns ranked improvement proposals.
 */
trainingRouter.post("/proposals", (req: Request, res: Response) => {
  try {
    const samples = req.body.samples || [];
    const proposals = ImprovementAnalyzerService.analyzeOperationalVariances(samples);
    return res.json({ success: true, proposals });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/training/export/sft
 * Exports Supervised Fine-Tuning (SFT) JSONL dataset.
 */
trainingRouter.post("/export/sft", (req: Request, res: Response) => {
  try {
    const samples = req.body.samples || [];
    const sftJsonl = AgentTrainingDatasetExporter.exportSftDataset(samples);
    res.setHeader("Content-Type", "application/x-jsonlines");
    res.setHeader("Content-Disposition", 'attachment; filename="eventology_sft_dataset.jsonl"');
    return res.send(sftJsonl);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/training/export/dpo
 * Exports Direct Preference Optimization (DPO) JSONL dataset.
 */
trainingRouter.post("/export/dpo", (req: Request, res: Response) => {
  try {
    const samples = req.body.samples || [];
    const dpoJsonl = AgentTrainingDatasetExporter.exportDpoDataset(samples);
    res.setHeader("Content-Type", "application/x-jsonlines");
    res.setHeader("Content-Disposition", 'attachment; filename="eventology_dpo_dataset.jsonl"');
    return res.send(dpoJsonl);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/training/audit/comprehensive
 * Runs an all-in-one multi-discipline physics & spatial engineering audit.
 */
trainingRouter.post("/audit/comprehensive", (req: Request, res: Response) => {
  try {
    const spec = req.body;
    if (!spec || !spec.eventId) {
      return res.status(400).json({ error: "Missing required eventId or spec body" });
    }
    const audit = MultiDisciplinePhysicsService.runComprehensiveAudit(spec);
    return res.json({ success: true, audit });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});
