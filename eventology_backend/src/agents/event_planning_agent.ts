import { z } from "zod";
import { SystemMessage, HumanMessage, AIMessage, ToolMessage } from "@langchain/core/messages";
import { getLLMProvider } from "../llm/provider";
import { logAgentAction } from "../services/agent_log_service";
import { createAgentTask, updateAgentTaskStatus } from "../services/agent_task_service";
import { saveAIPlan } from "../services/ai_plan_service";
import { executeTool } from "../utils/tool_executor";
import { getAllCategoriesTool, getEventTypesTool, getPackagesTool } from "../tools/services";
import { imageGenerationService, type VisualCategory } from "../services/visual/image_generation_service";
import type { StateType, EventPlan, ProductionArtifact } from "../graph/state";

const PlanSchema = z.object({
  title: z.string(),
  summary: z.string(),
  requiredServices: z.array(z.string()).describe("Service category names that exist in the Eventalogy system"),
  venueCharacteristics: z.array(z.string()),
  estimatedInitialBudget: z.number(),
  dependencies: z.array(z.string()),
});

export async function eventPlanningAgentNode(state: StateType): Promise<Partial<StateType>> {
  const startTime = Date.now();
  await logAgentAction(state.workflowId, "event_planning_agent", "start", "running");
  const taskId = await createAgentTask(state.workflowId, "event_planning_agent", "running", { requirements: state.eventRequirements }, false);

  const tools = [getAllCategoriesTool, getEventTypesTool, getPackagesTool];
  const llm = getLLMProvider({ temperature: 0.2 }).bindTools(tools);

  const systemPrompt = `You are the Eventalogy Event Planning Agent.

You receive structured event requirements and must create a comprehensive event plan.

Your responsibilities:
1. Use tools to fetch available service categories from the Eventalogy system
2. Check what event type packages are available
3. Reason carefully about which services are actually needed for this specific event
4. Do NOT produce a generic checklist - adapt to the specific event type, scale, and budget
5. Your requiredServices must only use categories that actually exist in the Eventalogy system

CRITICAL: When you have finished gathering information and reasoning, you MUST call the "submit_event_plan_results" tool to output the final plan. You MUST NOT respond with plain text.

Think about:
- Scale: A 50-person birthday party needs different services than a 500-person wedding
- Budget constraints: factor into the estimated breakdown
- Cultural context: Indian events have specific requirements (e.g., mehendi, mandap for weddings)

Current event requirements:
${JSON.stringify(state.eventRequirements, null, 2)}`;

  const messages: any[] = [
    new SystemMessage(systemPrompt),
    new HumanMessage(`Please create the event plan based on these requirements.`),
  ];

  try {
    let iterations = 0;
    let finalPlan: any = null;
    let fallbackText: string | null = null;

    const modelWithTools = getLLMProvider({ temperature: 0.2 }).bindTools([
      ...tools,
      {
        name: "submit_event_plan_results",
        description: "MUST be called to finalize your response. Call this when you have finished planning the event.",
        schema: PlanSchema,
      }
    ]);

    while (iterations < 4) {
      const response = await modelWithTools.invoke(messages) as AIMessage;
      messages.push(response);
      
      if (response.content && typeof response.content === 'string') {
        fallbackText = response.content;
      }
      
      if (!response.tool_calls?.length) break;
      
      let extractionFound = false;
      
      for (const tc of response.tool_calls) {
        if (tc.name === "submit_event_plan_results") {
          finalPlan = tc.args;
          extractionFound = true;
          break;
        } else {
          const toolToRun = tools.find(t => t.name === tc.name);
          if (toolToRun) {
            const result = await executeTool([toolToRun] as any, tc);
            messages.push(new ToolMessage({ content: result, tool_call_id: tc.id! }));
          }
        }
      }
      
      if (extractionFound) break;
      iterations++;
    }

    if (!finalPlan) {
      finalPlan = {
        title: "Default Event Plan",
        summary: fallbackText || "Basic plan generated due to missing structured output.",
        requiredServices: [],
        venueCharacteristics: ["Standard Venue"],
        estimatedInitialBudget: 0,
        dependencies: []
      };
    }

    const plan = finalPlan;

    const planId = await saveAIPlan({
      userId: state.userId,
      eventId: state.eventId,
      eventRequirements: state.eventRequirements,
      recommendations: plan.requiredServices,
      estimatedBudget: plan.estimatedInitialBudget.toString(),
      status: "generated",
    });

    await updateAgentTaskStatus(taskId, "completed", plan);
    await logAgentAction(state.workflowId, "event_planning_agent", "complete", "success", { planId, title: plan.title, servicesCount: plan.requiredServices.length, durationMs: Date.now() - startTime });

    const briefArtifact: ProductionArtifact = {
      artifactId: `brief-${state.workflowId}-v1`,
      type: "event_brief",
      title: plan.title || "Event Production Brief",
      summary: plan.summary || "Comprehensive event production and requirement brief.",
      version: 1,
      format: "markdown",
      mimeType: "text/markdown",
      content: [
        `# ${plan.title || "Event Production Brief"}`,
        "",
        "## Executive Summary",
        plan.summary || "No executive summary provided.",
        "",
        "## Event Specifications",
        `- **Event Type:** ${state.eventRequirements?.eventType ?? "Unspecified"}`,
        `- **Estimated Guests:** ${state.eventRequirements?.guestCount ?? "To be confirmed"}`,
        `- **Preferred City / Region:** ${state.eventRequirements?.location ?? "Pan-India"}`,
        `- **Estimated Initial Budget:** INR ${(plan.estimatedInitialBudget ?? 0).toLocaleString("en-IN")}`,
        "",
        "## Required Services & Modules",
        ...(plan.requiredServices && plan.requiredServices.length > 0
          ? plan.requiredServices.map((s: string) => `- ${s}`)
          : ["- Standard event planning & management"]),
        "",
        "## Venue Specifications",
        ...(plan.venueCharacteristics && plan.venueCharacteristics.length > 0
          ? plan.venueCharacteristics.map((v: string) => `- ${v}`)
          : ["- Standard multi-purpose banquet / lawn"]),
      ].join("\n"),
      status: "draft",
      requiresReview: true,
      assumptions: plan.dependencies && plan.dependencies.length > 0
        ? plan.dependencies
        : ["Estimates and service scopes are preliminary subject to specialist discovery."],
      sources: [
        {
          title: "Eventology Category & Package Catalog",
          sourceType: "catalog",
          notes: "Derived from standard catalog service templates and planner rules.",
        },
      ],
      metadata: {
        workflowId: state.workflowId,
        aiPlanId: planId,
        eventId: state.eventId ?? undefined,
        estimatedInitialBudget: plan.estimatedInitialBudget,
        servicesCount: plan.requiredServices?.length ?? 0,
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const emittedArtifacts: ProductionArtifact[] = [briefArtifact];

    if ((state.metadata as any)?.includeConceptVisual === true) {
      try {
        const eventTypeStr = String(state.eventRequirements?.eventType ?? "Event");
        const lowerType = eventTypeStr.toLowerCase();
        let visualCategory: VisualCategory = "venue_styling";
        if (lowerType.includes("wedding") || lowerType.includes("sangeet") || lowerType.includes("mandap")) {
          visualCategory = "mandap";
        } else if (
          lowerType.includes("conference") ||
          lowerType.includes("summit") ||
          lowerType.includes("concert") ||
          lowerType.includes("corporate") ||
          lowerType.includes("launch")
        ) {
          visualCategory = "stage";
        }

        const visualRes = await imageGenerationService.generate({
          eventType: eventTypeStr,
          category: visualCategory,
          themeDescription: plan.summary || `${eventTypeStr} production design`,
          guestCount: state.eventRequirements?.guestCount,
          venueStyle: plan.venueCharacteristics?.[0] || "Luxury Event Venue",
          aspectRatio: "16:9",
          workflowId: state.workflowId,
        });

        emittedArtifacts.push({
          artifactId: `concept-visual-${state.workflowId}-v1`,
          type: "concept_visual",
          title: `${plan.title || eventTypeStr} — Concept Visual`,
          summary: visualRes.success
            ? `Generated ${visualRes.widthPx}x${visualRes.heightPx} ${visualCategory} concept render via ${visualRes.modelUsed}.`
            : `Concept visual prompt prepared (${visualRes.modelUsed}): ${visualRes.error || "awaiting image provider"}`,
          version: 1,
          format: "json",
          mimeType: "application/json",
          content: JSON.stringify(visualRes, null, 2),
          contentUrl: visualRes.imageUrl,
          imageBase64: visualRes.imageBase64,
          status: visualRes.success ? "validated" : "draft",
          requiresReview: false,
          sources: [
            {
              title: "Eventology AI Visual Studio",
              sourceType: "web",
              notes: `Provider model: ${visualRes.modelUsed}`,
            },
          ],
          metadata: {
            workflowId: state.workflowId,
            modelUsed: visualRes.modelUsed,
            category: visualCategory,
            success: visualRes.success,
          },
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
      } catch (visErr: any) {
        console.warn("[EventPlanningAgent] Concept visual generation skipped:", visErr?.message);
      }
    }

    return {
      eventPlan: plan as EventPlan,
      aiPlanId: planId,
      currentAgent: "orchestrator_agent",
      currentStage: "planning",
      workflowStatus: "active",
      artifacts: emittedArtifacts,
      agentHistory: [{ agent: "event_planning_agent", stage: "planning", status: "success", startedAt: new Date(startTime).toISOString(), durationMs: Date.now() - startTime, notes: `Plan: "${plan.title}" | ${plan.requiredServices.length} services` }],
      completedTasks: ["event_planning_agent"],
    };
  } catch (err: any) {
    await updateAgentTaskStatus(taskId, "error", undefined, err.message);
    await logAgentAction(state.workflowId, "event_planning_agent", "failed", "error", { error: err.message });
    return {
      failedTasks: ["event_planning_agent"],
      lastError: `Planning error: ${err.message}`,
      workflowStatus: "error",
      retryCount: (state.retryCount ?? 0) + 1,
      agentHistory: [{ agent: "event_planning_agent", stage: "planning", status: "error", startedAt: new Date(startTime).toISOString(), notes: err.message }],
    };
  }
}
