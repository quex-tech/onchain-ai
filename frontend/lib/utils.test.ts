import { describe, it, expect } from "vitest";
import { getExplorerUrl, buildOpenAIBody } from "./utils";
import { fromHex } from "viem";

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
});
