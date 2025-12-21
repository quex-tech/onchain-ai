import { toHex } from "viem";

const SYSTEM_PROMPT =
  "You are a helpful assistant responding to blockchain users. Keep responses concise.";

export function buildOpenAIBody(prompt: string): `0x${string}` {
  const body = JSON.stringify({
    model: "gpt-4o",
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: prompt },
    ],
  });
  return toHex(new TextEncoder().encode(body));
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
