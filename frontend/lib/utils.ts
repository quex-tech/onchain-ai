// Re-export OpenAI functions for backwards compatibility
export { buildOpenAIBody, MAX_HISTORY_MESSAGES } from "./openai";

import { EXPLORER_URLS, arbitrumSepolia } from "./config";

export function getExplorerUrl(chainId: number, txHash: string): string {
  const base = EXPLORER_URLS[chainId] || EXPLORER_URLS[arbitrumSepolia.id];
  return `${base}/tx/${txHash}`;
}
