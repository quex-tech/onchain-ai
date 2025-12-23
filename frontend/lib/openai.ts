import { toHex } from "viem";
import type { Message } from "./messages";

const SYSTEM_PROMPT =
  "You are an on-chain AI living on the blockchain. Keep responses under 50 words. Be extremely brief. One short paragraph max. No lists, no URLs.";

export const MAX_HISTORY_MESSAGES = 6; // Keep history short to reduce gas costs
const MAX_MESSAGE_CHARS = 500; // Truncate long messages to reduce calldata size

type OpenAIMessage = { role: "system" | "user" | "assistant"; content: string };

type BuildOptions = {
  history?: Message[];
};

// Truncate content to avoid huge calldata from long AI responses
function truncateContent(content: string, maxChars: number): string {
  if (content.length <= maxChars) return content;
  return content.slice(0, maxChars) + "...";
}

export function buildOpenAIBody(
  prompt: string,
  options: BuildOptions = {}
): `0x${string}` {
  const { history = [] } = options;

  const messages: OpenAIMessage[] = [
    { role: "system", content: SYSTEM_PROMPT },
  ];

  // Add conversation history (limited to last MAX_HISTORY_MESSAGES, truncated)
  const recentHistory = history.slice(-MAX_HISTORY_MESSAGES);
  for (const msg of recentHistory) {
    messages.push({ role: msg.role, content: truncateContent(msg.content, MAX_MESSAGE_CHARS) });
  }

  // Add current prompt
  messages.push({ role: "user", content: prompt });

  const body: Record<string, unknown> = {
    model: "gpt-4o-search-preview",
    messages,
    max_tokens: 100, // Keep responses short for gas efficiency
  };

  return toHex(new TextEncoder().encode(JSON.stringify(body)));
}
