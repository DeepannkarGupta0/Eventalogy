import { db, hasFirestoreCredentials } from "../config/firebase";
import { FieldValue } from "firebase-admin/firestore";

export async function createAgentTask(workflowId: string, agentType: string, status: string, inputData: any, requiresApproval = false) {
  if (!hasFirestoreCredentials) {
    if (process.env.NODE_ENV === "production") {
      throw new Error(`[AgentTaskService] Core task creation failed: Missing Firestore credentials in production.`);
    }
    return `task-${Date.now()}`;
  }
  try {
    const ref = db.collection("agent_tasks").doc();
    await ref.set({
      taskId: ref.id,
      eventId: inputData.eventId || null,
      workflowId,
      agentType,
      status,
      input: inputData,
      createdAt: FieldValue.serverTimestamp(),
      requiresApproval,
    });
    return ref.id;
  } catch (err: any) {
    if (process.env.NODE_ENV === "production") {
      throw new Error(`[AgentTaskService] Core task creation failed: ${err.message}`);
    }
    console.warn(`[AgentTaskService] Dev fallback task ID: ${err.message}`);
    return `task-${Date.now()}`;
  }
}

export async function updateAgentTaskStatus(taskId: string, status: string, outputData?: any, error?: string) {
  if (!hasFirestoreCredentials) {
    if (process.env.NODE_ENV === "production") {
      throw new Error(`[AgentTaskService] Core task update failed: Missing Firestore credentials in production.`);
    }
    return;
  }
  try {
    const updates: any = { status };
    if (outputData) updates.output = outputData;
    if (error) updates.error = error;
    
    if (status === "completed" || status === "error" || status === "rejected") {
      updates.completedAt = FieldValue.serverTimestamp();
    }
    
    await db.collection("agent_tasks").doc(taskId).update(updates);
  } catch (err: any) {
    if (process.env.NODE_ENV === "production") {
      throw new Error(`[AgentTaskService] Core task status update failed: ${err.message}`);
    }
    console.warn(`[AgentTaskService] Dev fallback task update: ${err.message}`);
  }
}
