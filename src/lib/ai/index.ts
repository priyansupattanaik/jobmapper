import { AIProvider } from "./provider";
import { RuleBasedAIProvider } from "./ruleBased";
import { GeminiAIProvider } from "./gemini";

let aiInstance: AIProvider | null = null;

export function getAIProvider(): AIProvider {
  if (aiInstance) return aiInstance;

  const providerType = process.env.AI_PROVIDER || "rule_based";
  if (providerType === "gemini" && process.env.GEMINI_API_KEY) {
    aiInstance = new GeminiAIProvider();
  } else {
    aiInstance = new RuleBasedAIProvider();
  }

  return aiInstance;
}

export * from "./provider";
export * from "./taxonomy";
export * from "./ruleBased";
export * from "./gemini";
