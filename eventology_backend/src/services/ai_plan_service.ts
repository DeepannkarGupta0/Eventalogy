import { db, hasFirestoreCredentials } from "../config/firebase";
import { FieldValue } from "firebase-admin/firestore";

export interface AIPlanData {
  userId: string;
  eventId: string | null;
  eventRequirements: any;
  recommendations: string[];
  estimatedBudget: string;
  status: string;
}

export async function saveAIPlan(planData: AIPlanData): Promise<string> {
  if (!hasFirestoreCredentials) {
    if (process.env.NODE_ENV === "production") {
      throw new Error(`[AIPlanService] Core AI plan persistence failed: Missing Firestore credentials in production.`);
    }
    console.warn(`[AIPlanService] Dev fallback AI plan generated`);
    return `plan-${Date.now()}`;
  }
  try {
    const plansRef = db.collection("ai_plans");
    const docRef = plansRef.doc();
    
    await docRef.set({
      planId: docRef.id,
      ...planData,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
    
    return docRef.id;
  } catch (err: any) {
    if (process.env.NODE_ENV === "production") {
      throw new Error(`[AIPlanService] Core AI plan persistence failed: ${err.message}`);
    }
    console.warn(`[AIPlanService] Dev fallback AI plan: ${err.message}`);
    return `plan-${Date.now()}`;
  }
}
