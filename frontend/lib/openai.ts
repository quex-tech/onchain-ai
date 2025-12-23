import { toHex } from "viem";
import type { Message } from "./messages";

const SYSTEM_PROMPT =
  "You are an on-chain AI, living entirely on the blockchain. Respond fast and precise. Be direct, skip fluff. Max 150 words. No URLs or citations.";

export const MAX_HISTORY_MESSAGES = 2; // Keep history very short for MetaMask RPC compatibility
const MAX_MESSAGE_CHARS = 200; // Truncate long messages to reduce calldata size

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
    max_tokens: 300, // Limit response size to avoid callback gas issues
  };

  return toHex(new TextEncoder().encode(JSON.stringify(body)));
}
