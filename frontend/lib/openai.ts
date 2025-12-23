import { toHex } from "viem";
import type { Message } from "./messages";

const SYSTEM_PROMPT =
  "You are a helpful assistant responding to blockchain users. Keep responses very short (max 200 words). Do not include URLs or citations - just the key facts.";

export const MAX_HISTORY_MESSAGES = 6; // Keep history short to reduce gas costs

type OpenAIMessage = { role: "system" | "user" | "assistant"; content: string };

type BuildOptions = {
  history?: Message[];
};

export function buildOpenAIBody(
  prompt: string,
  options: BuildOptions = {}
): `0x${string}` {
  const { history = [] } = options;

  const messages: OpenAIMessage[] = [
    { role: "system", content: SYSTEM_PROMPT },
  ];

  // Add conversation history (limited to last MAX_HISTORY_MESSAGES)
  const recentHistory = history.slice(-MAX_HISTORY_MESSAGES);
  for (const msg of recentHistory) {
    messages.push({ role: msg.role, content: msg.content });
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
