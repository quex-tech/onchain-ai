import { describe, it, expect } from "vitest";
import fc from "fast-check";
import { getExplorerUrl } from "./utils";

describe("getExplorerUrl", () => {
  it("returns Arbitrum One URL for chain 42161", () => {
    const url = getExplorerUrl(42161, "0xabc123");
    expect(url).toBe("https://arbiscan.io/tx/0xabc123");
  });

  it("returns Arbitrum Sepolia URL for chain 421614", () => {
    const url = getExplorerUrl(421614, "0xabc123");
    expect(url).toBe("https://sepolia.arbiscan.io/tx/0xabc123");
  });

  it("returns 0G mainnet URL for chain 16661", () => {
    const url = getExplorerUrl(16661, "0xdef456");
    expect(url).toBe("https://chainscan.0g.ai/tx/0xdef456");
  });

  it("defaults to Arbitrum One for unknown chains", () => {
    const url = getExplorerUrl(99999, "0xunknown");
    expect(url).toBe("https://arbiscan.io/tx/0xunknown");
  });

  // Property tests
  describe("property tests", () => {
    const hexCharArb = fc.constantFrom(..."0123456789abcdef".split(""));
    const txHashArb = fc.array(hexCharArb, { minLength: 64, maxLength: 64 })
      .map((chars) => `0x${chars.join("")}`);

    it("always returns valid URL format", () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 1000000 }),
          txHashArb,
          (chainId, txHash) => {
            const url = getExplorerUrl(chainId, txHash);
            return url.startsWith("https://") && url.includes("/tx/");
          }
        )
      );
    });

    it("always includes txHash in result", () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 1000000 }),
          txHashArb,
          (chainId, txHash) => {
            const url = getExplorerUrl(chainId, txHash);
            return url.endsWith(txHash);
          }
        )
      );
    });

    it("URL ends with /tx/{txHash} pattern", () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 1000000 }),
          txHashArb,
          (chainId, txHash) => {
            const url = getExplorerUrl(chainId, txHash);
            return url.endsWith(`/tx/${txHash}`);
          }
        )
      );
    });

    it("same chainId always produces same base URL", () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 1000000 }),
          txHashArb,
          txHashArb,
          (chainId, txHash1, txHash2) => {
            const url1 = getExplorerUrl(chainId, txHash1);
            const url2 = getExplorerUrl(chainId, txHash2);
            const base1 = url1.replace(txHash1, "");
            const base2 = url2.replace(txHash2, "");
            return base1 === base2;
          }
        )
      );
    });
  });
});
