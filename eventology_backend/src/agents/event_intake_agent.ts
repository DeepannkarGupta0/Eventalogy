import { z } from "zod";
import { SystemMessage, AIMessage, ToolMessage } from "@langchain/core/messages";
import { getLLMProvider } from "../llm/provider";
import { logAgentAction } from "../services/agent_log_service";
import { executeTool } from "../utils/tool_executor";
import { getEventTypesTool, getLocationsTool } from "../tools/services";
import type { StateType } from "../graph/state";

const IntakeOutputSchema = z.object({
  extractedRequirements: z.object({
    eventType: z.string().optional(),
    guestCount: z.number().optional(),
    location: z.string().optional(),
    dateStr: z.string().optional(),
    budgetStr: z.string().optional(),
    preferences: z.array(z.string()).optional(),
    constraints: z.array(z.string()).optional(),
  }),
  missingInformation: z.array(z.string()),
  nextQuestion: z.string().optional(),
  isComplete: z.boolean(),
  confidence: z.number().min(0).max(1),
});

export async function eventIntakeAgentNode(state: StateType): Promise<Partial<StateType>> {
  const startTime = Date.now();
  await logAgentAction(state.workflowId, "event_intake_agent", "start", "running");

  const tools = [getEventTypesTool, getLocationsTool];
  const llm = getLLMProvider({ temperature: 0.1 });

  const systemPrompt = `You are the Eventalogy Event Architect, a highly empathetic, warm, and human-like luxury event concierge.

Your goal is to understand the user's dream event by having a natural, engaging conversation. DO NOT interrogate them like a robot. Speak to them like a high-end wedding planner would. 
Ask about their vision, their vibe, what matters most to them (e.g., "Are you picturing an intimate garden gathering under the stars, or a grand royal celebration?"). 

You have access to tools to fetch valid event types and supported locations from the Eventalogy database.
Use them to validate what the user mentions and provide accurate, gentle suggestions.

CRITICAL: When you have finished gathering information, OR when you need to ask the user a follow-up question, you MUST call the "submit_intake_results" tool. You MUST NOT respond with plain text.

Information we eventually need to gather (but do it naturally over a few turns):
- Event Type (e.g. Wedding, Gala)
- Location / City (must be a supported location)
- Guest Count (number of attendees, or rough size)
- Date / Date Range (when is the event)
- Budget (approximate budget, you can gently ask "Do you have a comfortable investment range in mind for this celebration?")
- Vision/Vibe (what do they want it to feel like)

Rules:
1. Speak with warmth, excitement, and a human touch. Use conversational fillers naturally (e.g., "That sounds absolutely beautiful!", "I love that vision.")
2. Ask only 1 or 2 questions at a time. Do not overwhelm them with a form.
3. Validate their choices gently. (e.g., "Raipur is a stunning choice for a winter wedding.")
4. Set isComplete = true ONLY when you have: eventType, location, guestCount, dateStr, AND you feel you understand their overarching vision.
5. Always provide your human-like conversational response in the "nextQuestion" field of the tool call.
6. You MUST call submit_intake_results to communicate.
7. BE INTELLIGENT ABOUT BUDGETS AND GUESTS: If the budget is unrealistically low for the guest count (e.g., ₹50k for 1000 guests = ₹50/guest), gracefully point this out and suggest either raising the budget or reducing the guest count. If a guest count is absurd (e.g. 500,000), politely clarify if that was a typo.

Current known requirements:
${JSON.stringify(state.eventRequirements, null, 2)}`;

  const messages: any[] = [
    new SystemMessage(systemPrompt),
    ...state.conversationHistory,
  ];

  try {
    let iterations = 0;
    let finalExtraction: any = null;
    let fallbackText: string | null = null;
    
    // Create the model binding that includes the submit tool
    const modelWithTools = llm.bindTools([
      ...tools,
      {
        name: "submit_intake_results",
        description: "MUST be called to finalize your response. Call this when you have extracted requirements or need to ask the user a follow-up question.",
        schema: IntakeOutputSchema,
      }
    ]);

    while (iterations < 4) {
      const response = await modelWithTools.invoke(messages) as AIMessage;
      messages.push(response);
      
      // If the model somehow returns plain text instead of tool calls, save it as a fallback
      if (response.content && typeof response.content === 'string') {
        fallbackText = response.content;
      }
      
      if (!response.tool_calls?.length) {
        // If the model responded directly with conversational text instead of calling submit_intake_results,
        // force a structured submission so requirements and nextQuestion are captured
        try {
          const submitModel = (llm as any).bindTools([
            {
              name: "submit_intake_results",
              description: "MUST be called to finalize your response. Call this when you have extracted requirements or need to ask the user a follow-up question.",
              schema: IntakeOutputSchema,
            }
          ], { tool_choice: { type: "function", function: { name: "submit_intake_results" } } });
          const forcedResponse = await submitModel.invoke(messages) as AIMessage;
          if (forcedResponse.tool_calls?.length) {
            const submitCall = forcedResponse.tool_calls.find(tc => tc.name === "submit_intake_results");
            if (submitCall) {
              finalExtraction = submitCall.args;
              break;
            }
          }
        } catch (_) {
          // Ignore tool force errors and proceed to fallback
        }
        break; // Stop if the model refuses to call tools
      }
      
      let extractionFound = false;
      
      for (const tc of response.tool_calls) {
        if (tc.name === "submit_intake_results") {
          finalExtraction = tc.args;
          extractionFound = true;
          break; // Stop processing other tools if we got the final result
        } else if (tc.name === "get_event_types" || tc.name === "get_locations") {
          // Execute normal tools
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

    // If the model completely ignored the submit tool and just gave text, fallback gracefully
    if (!finalExtraction) {
      let parsedQuestion = fallbackText;
      if (fallbackText && fallbackText.trim().startsWith('{')) {
        try {
          const parsed = JSON.parse(fallbackText);
          if (parsed.nextQuestion) parsedQuestion = parsed.nextQuestion;
        } catch (e) {
          // ignore parse errors
        }
      }

      // Extract basic heuristic requirements from conversation text if missing
      const combinedText = (state.conversationHistory || [])
        .map((m: any) => typeof m.content === 'string' ? m.content : '')
        .join(' ') + ' ' + (state.userMessage || '');
      const extractedFallback: any = { ...(state.eventRequirements || {}) };
      if (!extractedFallback.eventType) {
        const typeMatch = combinedText.match(/\b(birthday(?:\s+party)?|wedding|anniversary|corporate|conference|reception)\b/i);
        if (typeMatch) extractedFallback.eventType = typeMatch[1];
      }
      if (!extractedFallback.guestCount) {
        const guestMatch = combinedText.match(/(\d+)\s*(?:people|guests|pax|persons)/i);
        if (guestMatch) extractedFallback.guestCount = parseInt(guestMatch[1], 10);
      }
      if (!extractedFallback.location) {
        const locMatch = combinedText.match(/\b(?:in|at)\s+([A-Za-z]+)\b/i);
        if (locMatch) extractedFallback.location = locMatch[1];
      }

      finalExtraction = {
        extractedRequirements: extractedFallback,
        missingInformation: ["Unknown (fallback)"],
        nextQuestion: parsedQuestion || "Could you provide more details?",
        isComplete: false,
        confidence: 0,
      };
    }

    // Complement any missing basic requirements from user input if explicitly mentioned
    const rawInput = (state.conversationHistory || [])
      .map((m: any) => typeof m.content === 'string' ? m.content : '')
      .join(' ') + ' ' + (state.userMessage || '');
    if (!finalExtraction.extractedRequirements) {
      finalExtraction.extractedRequirements = {};
    }
    if (!finalExtraction.extractedRequirements.eventType) {
      const typeMatch = rawInput.match(/\b(birthday(?:\s+party)?|wedding|anniversary|corporate|conference|reception)\b/i);
      if (typeMatch) finalExtraction.extractedRequirements.eventType = typeMatch[1];
    }
    if (!finalExtraction.extractedRequirements.guestCount) {
      const guestMatch = rawInput.match(/(\d+)\s*(?:people|guests|pax|persons)/i);
      if (guestMatch) finalExtraction.extractedRequirements.guestCount = parseInt(guestMatch[1], 10);
    }
    if (!finalExtraction.extractedRequirements.location) {
      const locMatch = rawInput.match(/\b(?:in|at)\s+([A-Za-z]+)\b/i);
      if (locMatch) finalExtraction.extractedRequirements.location = locMatch[1];
    }

    await logAgentAction(state.workflowId, "event_intake_agent", "complete", "success", { isComplete: finalExtraction.isComplete, confidence: finalExtraction.confidence, durationMs: Date.now() - startTime });

    return {
      eventRequirements: finalExtraction.extractedRequirements,
      missingInformation: finalExtraction.missingInformation,
      pendingQuestions: finalExtraction.nextQuestion ? [finalExtraction.nextQuestion] : [],
      conversationHistory: finalExtraction.nextQuestion ? [new AIMessage(finalExtraction.nextQuestion)] : [],
      intakeComplete: finalExtraction.isComplete,
      workflowStatus: finalExtraction.isComplete ? "active" : "pending_user",
      currentAgent: "orchestrator_agent",
      agentHistory: [{ agent: "event_intake_agent", stage: "intake", status: "success", startedAt: new Date(startTime).toISOString(), durationMs: Date.now() - startTime, notes: finalExtraction.isComplete ? "Requirements complete" : `Missing: ${finalExtraction.missingInformation.join(", ")}` }],
      completedTasks: finalExtraction.isComplete ? ["event_intake_agent"] : [],
    };
  } catch (err: any) {
    await logAgentAction(state.workflowId, "event_intake_agent", "failed", "error", { error: err.message });
    return {
      failedTasks: ["event_intake_agent"],
      lastError: `Intake error: ${err.message}`,
      workflowStatus: "error",
      retryCount: (state.retryCount ?? 0) + 1,
      agentHistory: [{ agent: "event_intake_agent", stage: "intake", status: "error", startedAt: new Date(startTime).toISOString(), notes: err.message }],
    };
  }
}
