import { describe, it, expect } from "vitest";
import { getExplorerUrl, buildOpenAIBody, MAX_HISTORY_MESSAGES } from "./utils";
import { fromHex } from "viem";
import type { Message } from "./messages";

describe("getExplorerUrl", () => {
  it("returns Arbitrum Sepolia URL for chain 421614", () => {
    const url = getExplorerUrl(421614, "0xabc123");
    expect(url).toBe("https://sepolia.arbiscan.io/tx/0xabc123");
  });

  it("returns 0G mainnet URL for chain 16600", () => {
    const url = getExplorerUrl(16600, "0xdef456");
    expect(url).toBe("https://chainscan.0g.ai/tx/0xdef456");
  });

  it("returns 0G testnet URL for chain 16601", () => {
    const url = getExplorerUrl(16601, "0x789ghi");
    expect(url).toBe("https://chainscan-newton.0g.ai/tx/0x789ghi");
  });

  it("defaults to Arbitrum Sepolia for unknown chains", () => {
    const url = getExplorerUrl(99999, "0xunknown");
    expect(url).toBe("https://sepolia.arbiscan.io/tx/0xunknown");
  });
});

describe("buildOpenAIBody", () => {
  it("creates valid hex-encoded JSON with user prompt", () => {
    const hex = buildOpenAIBody("Hello");
    const decoded = new TextDecoder().decode(fromHex(hex, "bytes"));
    const parsed = JSON.parse(decoded);

    expect(parsed.model).toBe("gpt-4o");
    expect(parsed.messages).toHaveLength(2);
    expect(parsed.messages[0].role).toBe("system");
    expect(parsed.messages[1].role).toBe("user");
    expect(parsed.messages[1].content).toBe("Hello");
  });

  it("returns hex string starting with 0x", () => {
    const hex = buildOpenAIBody("Test");
    expect(hex.startsWith("0x")).toBe(true);
  });

  it("includes conversation history when provided", () => {
    const history: Message[] = [
      { id: 0, role: "user", content: "What is 2+2?", status: "confirmed" },
      { id: 1, role: "assistant", content: "4", status: "confirmed" },
    ];
    const hex = buildOpenAIBody("What is 3+3?", { history });
    const decoded = new TextDecoder().decode(fromHex(hex, "bytes"));
    const parsed = JSON.parse(decoded);

    // system + 2 history + 1 new = 4 messages
    expect(parsed.messages).toHaveLength(4);
    expect(parsed.messages[1].role).toBe("user");
    expect(parsed.messages[1].content).toBe("What is 2+2?");
    expect(parsed.messages[2].role).toBe("assistant");
    expect(parsed.messages[2].content).toBe("4");
    expect(parsed.messages[3].content).toBe("What is 3+3?");
  });

  it("limits history to MAX_HISTORY_MESSAGES", () => {
    const history: Message[] = Array.from({ length: 30 }, (_, i) => ({
      id: i,
      role: i % 2 === 0 ? "user" : "assistant",
      content: `Message ${i}`,
      status: "confirmed" as const,
    }));
    const hex = buildOpenAIBody("New message", { history });
    const decoded = new TextDecoder().decode(fromHex(hex, "bytes"));
    const parsed = JSON.parse(decoded);

    // system + MAX_HISTORY_MESSAGES + 1 new
    expect(parsed.messages).toHaveLength(1 + MAX_HISTORY_MESSAGES + 1);
  });

  it("enables web search when option is set", () => {
    const hex = buildOpenAIBody("Search the web for latest news", { webSearch: true });
    const decoded = new TextDecoder().decode(fromHex(hex, "bytes"));
    const parsed = JSON.parse(decoded);

    expect(parsed.tools).toBeDefined();
    expect(parsed.tools).toContainEqual({ type: "web_search_preview" });
  });

  it("does not include tools when webSearch is false", () => {
    const hex = buildOpenAIBody("Hello", { webSearch: false });
    const decoded = new TextDecoder().decode(fromHex(hex, "bytes"));
    const parsed = JSON.parse(decoded);

    expect(parsed.tools).toBeUndefined();
  });
});
