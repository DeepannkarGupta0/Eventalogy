import { db, hasFirestoreCredentials } from "../config/firebase";
import { FieldValue } from "firebase-admin/firestore";

export async function logAgentAction(workflowId: string, agent: string, action: string, status: string, metadata: any = {}) {
  if (!hasFirestoreCredentials) {
    console.log(`[AgentLog] (${agent}:${action}:${status}) ${JSON.stringify(metadata)}`);
    return;
  }
  try {
    const ref = db.collection("agent_logs").doc();
    await ref.set({
      logId: ref.id,
      taskId: metadata.taskId || null,
      workflowId,
      agentType: agent,
      action,
      status,
      metadata,
      createdAt: FieldValue.serverTimestamp(),
    });
  } catch (err: any) {
    console.warn(`[AgentLogService] Telemetry log skipped: ${err.message}`);
  }
}
