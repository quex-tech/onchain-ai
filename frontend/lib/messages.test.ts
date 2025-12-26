import { describe, it, expect } from "vitest";
import fc from "fast-check";
import {
  buildMessagesFromConversation,
  buildMessagesFromEvents,
  formatTxHashShort,
  formatBalance,
  hasActiveSubscription,
  needsDeposit,
  type ConversationItem,
  type PendingMessage,
  type TxHashMap,
  type PromptToMessageIdMap,
  type MessageSentLog,
  type ResponseReceivedLog,
} from "./messages";

describe("formatTxHashShort", () => {
  it("returns first 6 chars after 0x prefix", () => {
    expect(formatTxHashShort("0xabcdef123456")).toBe("abcdef");
  });

  it("handles short hashes", () => {
    expect(formatTxHashShort("0xabc")).toBe("abc");
  });
});

describe("formatBalance", () => {
  it("formats balance to 6 decimal places", () => {
    expect(formatBalance(1000000000000000000n)).toBe("1.000000"); // 1 ETH
  });

  it("formats small balance correctly", () => {
    expect(formatBalance(1000000000000000n)).toBe("0.001000"); // 0.001 ETH
  });

  it("formats zero", () => {
    expect(formatBalance(0n)).toBe("0.000000");
  });
});

describe("hasActiveSubscription", () => {
  it("returns false for undefined", () => {
    expect(hasActiveSubscription(undefined)).toBe(false);
  });

  it("returns false for zero", () => {
    expect(hasActiveSubscription(0n)).toBe(false);
  });

  it("returns true for positive value", () => {
    expect(hasActiveSubscription(1n)).toBe(true);
    expect(hasActiveSubscription(100n)).toBe(true);
  });
});

describe("needsDeposit", () => {
  it("returns true when no subscription", () => {
    expect(needsDeposit(undefined, undefined)).toBe(true);
    expect(needsDeposit(0n, undefined)).toBe(true);
  });

  it("returns true when subscription exists but balance is zero", () => {
    expect(needsDeposit(1n, 0n)).toBe(true);
    expect(needsDeposit(100n, 0n)).toBe(true);
  });

  it("returns false when subscription exists with positive balance", () => {
    expect(needsDeposit(1n, 1000n)).toBe(false);
    expect(needsDeposit(100n, 999999n)).toBe(false);
  });

  it("returns true when subscription exists but balance is undefined", () => {
    expect(needsDeposit(1n, undefined)).toBe(true);
  });
});

describe("buildMessagesFromConversation", () => {
  const emptyTxMap: TxHashMap = new Map();
  const emptyPromptMap: PromptToMessageIdMap = new Map();

  it("returns empty array for empty conversation", () => {
    const result = buildMessagesFromConversation([], null, emptyTxMap, emptyTxMap, emptyPromptMap);
    expect(result).toEqual([]);
  });

  it("builds user message from conversation item", () => {
    const conversation: ConversationItem[] = [
      { prompt: "Hello", response: "" },
    ];
    const promptMap: PromptToMessageIdMap = new Map([["Hello", "1"]]);
    const result = buildMessagesFromConversation(conversation, null, emptyTxMap, emptyTxMap, promptMap);

    expect(result).toHaveLength(1);
    expect(result[0].role).toBe("user");
    expect(result[0].content).toBe("Hello");
    expect(result[0].status).toBe("confirmed");
    expect(result[0].messageId).toBe(1n);
  });

  it("builds user and assistant messages when response exists", () => {
    const conversation: ConversationItem[] = [
      { prompt: "Hello", response: "Hi there!" },
    ];
    const result = buildMessagesFromConversation(conversation, null, emptyTxMap, emptyTxMap, emptyPromptMap);

    expect(result).toHaveLength(2);
    expect(result[0].role).toBe("user");
    expect(result[0].content).toBe("Hello");
    expect(result[1].role).toBe("assistant");
    expect(result[1].content).toBe("Hi there!");
  });

  it("includes tx hashes from maps", () => {
    const conversation: ConversationItem[] = [
      { prompt: "Hello", response: "Hi!" },
    ];
    const messageTxMap: TxHashMap = new Map([["1", "0xabc123"]]);
    const responseTxMap: TxHashMap = new Map([["1", "0xdef456"]]);
    const promptMap: PromptToMessageIdMap = new Map([["Hello", "1"]]);

    const result = buildMessagesFromConversation(conversation, null, messageTxMap, responseTxMap, promptMap);

    expect(result[0].txHash).toBe("0xabc123");
    expect(result[1].txHash).toBe("0xdef456");
  });

  it("adds pending message if not in conversation", () => {
    const conversation: ConversationItem[] = [];
    const pending: PendingMessage = {
      id: 123,
      content: "New message",
      status: "pending",
    };

    const result = buildMessagesFromConversation(conversation, pending, emptyTxMap, emptyTxMap, emptyPromptMap);

    expect(result).toHaveLength(1);
    expect(result[0].role).toBe("user");
    expect(result[0].content).toBe("New message");
    expect(result[0].status).toBe("pending");
  });

  it("does not duplicate pending message if already in conversation", () => {
    const conversation: ConversationItem[] = [
      { prompt: "New message", response: "" },
    ];
    const pending: PendingMessage = {
      id: 123,
      content: "New message",
      status: "confirming",
    };

    const result = buildMessagesFromConversation(conversation, pending, emptyTxMap, emptyTxMap, emptyPromptMap);

    expect(result).toHaveLength(1);
    expect(result[0].content).toBe("New message");
  });

  it("handles multiple conversation items", () => {
    const conversation: ConversationItem[] = [
      { prompt: "First", response: "Response 1" },
      { prompt: "Second", response: "Response 2" },
      { prompt: "Third", response: "" },
    ];

    const result = buildMessagesFromConversation(conversation, null, emptyTxMap, emptyTxMap, emptyPromptMap);

    expect(result).toHaveLength(5); // 3 user + 2 assistant (third has no response)
    expect(result[0].content).toBe("First");
    expect(result[1].content).toBe("Response 1");
    expect(result[2].content).toBe("Second");
    expect(result[3].content).toBe("Response 2");
    expect(result[4].content).toBe("Third");
  });
});

describe("buildMessagesFromEvents", () => {
  it("returns empty array for no events", () => {
    const result = buildMessagesFromEvents([], []);
    expect(result).toEqual([]);
  });

  it("builds user message from MessageSent event with required txHash", () => {
    const messageLogs: MessageSentLog[] = [
      { messageId: 1n, prompt: "Hello", txHash: "0xabc123" as `0x${string}` },
    ];

    const result = buildMessagesFromEvents(messageLogs, []);

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      messageId: 1n,
      role: "user",
      content: "Hello",
      txHash: "0xabc123",
    });
  });

  it("builds assistant message from ResponseReceived event with required txHash", () => {
    const messageLogs: MessageSentLog[] = [
      { messageId: 1n, prompt: "Hello", txHash: "0xabc123" as `0x${string}` },
    ];
    const responseLogs: ResponseReceivedLog[] = [
      { messageId: 1n, response: "Hi there!", txHash: "0xdef456" as `0x${string}` },
    ];

    const result = buildMessagesFromEvents(messageLogs, responseLogs);

    expect(result).toHaveLength(2);
    expect(result[0].role).toBe("user");
    expect(result[0].txHash).toBe("0xabc123");
    expect(result[1].role).toBe("assistant");
    expect(result[1].content).toBe("Hi there!");
    expect(result[1].txHash).toBe("0xdef456");
  });

  it("orders messages by messageId", () => {
    const messageLogs: MessageSentLog[] = [
      { messageId: 2n, prompt: "Second", txHash: "0x222" as `0x${string}` },
      { messageId: 1n, prompt: "First", txHash: "0x111" as `0x${string}` },
    ];
    const responseLogs: ResponseReceivedLog[] = [
      { messageId: 1n, response: "First response", txHash: "0x333" as `0x${string}` },
    ];

    const result = buildMessagesFromEvents(messageLogs, responseLogs);

    expect(result[0].content).toBe("First");
    expect(result[1].content).toBe("First response");
    expect(result[2].content).toBe("Second");
  });

  it("handles message without response yet", () => {
    const messageLogs: MessageSentLog[] = [
      { messageId: 1n, prompt: "Hello", txHash: "0xabc" as `0x${string}` },
    ];

    const result = buildMessagesFromEvents(messageLogs, []);

    expect(result).toHaveLength(1);
    expect(result[0].role).toBe("user");
  });

  it("every message has txHash - no undefined allowed", () => {
    const messageLogs: MessageSentLog[] = [
      { messageId: 1n, prompt: "Hello", txHash: "0xabc" as `0x${string}` },
    ];
    const responseLogs: ResponseReceivedLog[] = [
      { messageId: 1n, response: "Hi!", txHash: "0xdef" as `0x${string}` },
    ];

    const result = buildMessagesFromEvents(messageLogs, responseLogs);

    // Type assertion: txHash is required, not optional
    result.forEach((msg) => {
      expect(msg.txHash).toBeDefined();
      expect(typeof msg.txHash).toBe("string");
      expect(msg.txHash.startsWith("0x")).toBe(true);
    });
  });
});

// Property-based tests
describe("property tests", () => {
  // Arbitrary for valid tx hash (0x + 64 hex chars)
  const hexCharArb = fc.constantFrom(..."0123456789abcdef".split(""));
  const txHashArb = fc.array(hexCharArb, { minLength: 64, maxLength: 64 })
    .map((chars) => `0x${chars.join("")}` as `0x${string}`);

  describe("formatTxHashShort", () => {
    it("always returns at most 6 characters", () => {
      fc.assert(
        fc.property(fc.string(), (input) => {
          const result = formatTxHashShort(input);
          return result.length <= 6;
        })
      );
    });

    it("returns chars from index 2 to 8 for valid tx hashes", () => {
      fc.assert(
        fc.property(txHashArb, (txHash) => {
          const result = formatTxHashShort(txHash);
          return result === txHash.slice(2, 8);
        })
      );
    });
  });

  describe("formatBalance", () => {
    it("always returns string with 6 decimal places", () => {
      fc.assert(
        fc.property(
          fc.bigInt({ min: 0n, max: 10n ** 30n }),
          (balance) => {
            const result = formatBalance(balance);
            return /^\d+\.\d{6}$/.test(result);
          }
        )
      );
    });

    it("never returns negative values for non-negative input", () => {
      fc.assert(
        fc.property(
          fc.bigInt({ min: 0n, max: 10n ** 30n }),
          (balance) => {
            const result = formatBalance(balance);
            return parseFloat(result) >= 0;
          }
        )
      );
    });
  });

  describe("hasActiveSubscription", () => {
    it("returns false for undefined", () => {
      expect(hasActiveSubscription(undefined)).toBe(false);
    });

    it("returns true iff subscriptionId > 0", () => {
      fc.assert(
        fc.property(
          fc.bigInt({ min: 0n, max: 10n ** 20n }),
          (subscriptionId) => {
            const result = hasActiveSubscription(subscriptionId);
            return result === (subscriptionId > 0n);
          }
        )
      );
    });
  });

  describe("needsDeposit", () => {
    it("returns false only when subscription > 0 AND balance > 0", () => {
      fc.assert(
        fc.property(
          fc.option(fc.bigInt({ min: 0n, max: 10n ** 20n }), { nil: undefined }),
          fc.option(fc.bigInt({ min: 0n, max: 10n ** 20n }), { nil: undefined }),
          (subscriptionId, balance) => {
            const result = needsDeposit(subscriptionId, balance);
            const hasSubscription = subscriptionId !== undefined && subscriptionId > 0n;
            const hasBalance = balance !== undefined && balance > 0n;

            // Needs deposit unless both subscription and balance exist and are positive
            const expected = !(hasSubscription && hasBalance);
            return result === expected;
          }
        )
      );
    });
  });

  describe("buildMessagesFromEvents", () => {
    const messageLogArb = fc.record({
      messageId: fc.bigInt({ min: 1n, max: 10000n }),
      prompt: fc.string(),
      txHash: txHashArb,
    });

    const responseLogArb = fc.record({
      messageId: fc.bigInt({ min: 1n, max: 10000n }),
      response: fc.string(),
      txHash: txHashArb,
    });

    it("output is always sorted by messageId", () => {
      fc.assert(
        fc.property(
          fc.array(messageLogArb, { minLength: 0, maxLength: 10 }),
          fc.array(responseLogArb, { minLength: 0, maxLength: 10 }),
          (messageLogs, responseLogs) => {
            const result = buildMessagesFromEvents(messageLogs, responseLogs);

            // Check that user messages appear in sorted order
            let lastMessageId = 0n;
            for (const msg of result) {
              if (msg.role === "user") {
                if (msg.messageId < lastMessageId) return false;
                lastMessageId = msg.messageId;
              }
            }
            return true;
          }
        )
      );
    });

    it("every output message has valid txHash", () => {
      fc.assert(
        fc.property(
          fc.array(messageLogArb, { minLength: 1, maxLength: 5 }),
          fc.array(responseLogArb, { minLength: 0, maxLength: 5 }),
          (messageLogs, responseLogs) => {
            const result = buildMessagesFromEvents(messageLogs, responseLogs);
            return result.every((msg) =>
              msg.txHash.startsWith("0x") && msg.txHash.length === 66
            );
          }
        )
      );
    });

    it("user message count equals input message count", () => {
      fc.assert(
        fc.property(
          fc.array(messageLogArb, { minLength: 0, maxLength: 10 }),
          fc.array(responseLogArb, { minLength: 0, maxLength: 10 }),
          (messageLogs, responseLogs) => {
            const result = buildMessagesFromEvents(messageLogs, responseLogs);
            const userMessages = result.filter((m) => m.role === "user");
            return userMessages.length === messageLogs.length;
          }
        )
      );
    });

    it("assistant messages only appear after matching user message", () => {
      fc.assert(
        fc.property(
          fc.array(messageLogArb, { minLength: 1, maxLength: 5 }),
          fc.array(responseLogArb, { minLength: 0, maxLength: 5 }),
          (messageLogs, responseLogs) => {
            const result = buildMessagesFromEvents(messageLogs, responseLogs);

            for (let i = 0; i < result.length; i++) {
              if (result[i].role === "assistant") {
                // Must have a preceding user message with same messageId
                const precedingUser = result.slice(0, i).find(
                  (m) => m.role === "user" && m.messageId === result[i].messageId
                );
                if (!precedingUser) return false;
              }
            }
            return true;
          }
        )
      );
    });
  });
});
