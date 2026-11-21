import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { ChatOpenAI } from "@langchain/openai";
import * as dotenv from "dotenv";

dotenv.config({ override: true });
process.env.LANGCHAIN_VERBOSE = "true";

export type AgentRoleType = "chat" | "planning" | "engineering" | "budget" | "fast";

export interface LLMProviderOptions {
  temperature?: number;
  modelName?: string;
  role?: AgentRoleType;
  callbacks?: any[];
}

/**
 * Resolves the optimal OpenRouter model for a specific agent role.
 */
function resolveModelForRole(role?: AgentRoleType, explicitModel?: string): string {
  if (explicitModel) return explicitModel;

  const defaultModel = process.env.OPENROUTER_MODEL || "openai/gpt-4o-mini";

  switch (role) {
    case "planning":
      return process.env.OPENROUTER_PLANNING_MODEL || "anthropic/claude-3.5-sonnet";
    case "chat":
      return process.env.OPENROUTER_CHAT_MODEL || defaultModel;
    case "engineering":
      return process.env.OPENROUTER_ENGINEERING_MODEL || defaultModel;
    case "budget":
      return process.env.OPENROUTER_BUDGET_MODEL || defaultModel;
    case "fast":
      return process.env.OPENROUTER_FAST_MODEL || "google/gemini-2.0-flash-001";
    default:
      return defaultModel;
  }
}

export function getLLMProvider(options?: LLMProviderOptions) {
  const temperature = options?.temperature ?? 0.0;
  
  const openRouterApiKey = (process.env.OPENROUTER_API_KEY || "").trim();
  
  // If OpenRouter API key is available, use it as the primary provider
  if (openRouterApiKey) {
    const modelName = resolveModelForRole(options?.role, options?.modelName);
    return new ChatOpenAI({
      modelName: modelName,
      temperature,
      apiKey: openRouterApiKey,
      callbacks: options?.callbacks,
      configuration: {
        baseURL: "https://openrouter.ai/api/v1",
        defaultHeaders: {
          "HTTP-Referer": process.env.EVENTOLOGY_WEB_URL || "https://eventology.io",
          "X-Title": "Eventology AI Agent Runtime"
        }
      }
    });
  }

  // Fallback to Gemini if OpenRouter is not configured
  const geminiApiKey = (process.env.GEMINI_API_KEY || "").trim();
  const geminiModelName = options?.modelName || process.env.GEMINI_MODEL || "gemini-1.5-flash";
  return new ChatGoogleGenerativeAI({
    model: geminiModelName,
    temperature,
    apiKey: geminiApiKey,
    maxRetries: 0,
    callbacks: options?.callbacks,
  });
}
