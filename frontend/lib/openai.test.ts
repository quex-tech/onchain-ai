import { describe, it, expect } from "vitest";
import { buildOpenAIBody, MAX_HISTORY_MESSAGES } from "./openai";
import { fromHex } from "viem";
import type { Message } from "./messages";

describe("buildOpenAIBody", () => {
  it("creates valid hex-encoded JSON with user prompt", () => {
    const hex = buildOpenAIBody("Hello");
    const decoded = new TextDecoder().decode(fromHex(hex, "bytes"));
    const parsed = JSON.parse(decoded);

    expect(parsed.model).toBe("gpt-4o-search-preview");
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
});
