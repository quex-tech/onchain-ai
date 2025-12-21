import { toHex } from "viem";
import type { Message } from "./messages";

const SYSTEM_PROMPT =
  "You are a helpful assistant responding to blockchain users. Keep responses concise.";

export const MAX_HISTORY_MESSAGES = 20;

type OpenAIMessage = { role: "system" | "user" | "assistant"; content: string };

type BuildOptions = {
  history?: Message[];
  webSearch?: boolean;
};

export function buildOpenAIBody(
  prompt: string,
  options: BuildOptions = {}
): `0x${string}` {
  const { history = [], webSearch = false } = options;

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
    model: "gpt-4o",
    messages,
  };

  if (webSearch) {
    body.tools = [{ type: "web_search_preview" }];
  }

  return toHex(new TextEncoder().encode(JSON.stringify(body)));
}

export function getExplorerUrl(chainId: number, txHash: string): string {
  const explorers: Record<number, string> = {
    421614: "https://sepolia.arbiscan.io",
    16600: "https://chainscan.0g.ai",
    16601: "https://chainscan-newton.0g.ai",
  };
  const base = explorers[chainId] || "https://sepolia.arbiscan.io";
  return `${base}/tx/${txHash}`;
}
