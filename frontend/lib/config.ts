import { http, createConfig } from "wagmi";
import { defineChain } from "viem";
import { injected } from "wagmi/connectors";

export const zgChain = defineChain({
  id: 16600,
  name: "0G Newton",
  nativeCurrency: { name: "A0GI", symbol: "A0GI", decimals: 18 },
  rpcUrls: {
    default: { http: ["https://evmrpc-testnet.0g.ai"] },
  },
  blockExplorers: {
    default: { name: "0G Explorer", url: "https://chainscan-newton.0g.ai" },
  },
});

export const config = createConfig({
  chains: [zgChain],
  connectors: [injected()],
  transports: {
    [zgChain.id]: http(),
  },
});

export const CHAT_ORACLE_ADDRESS =
  "0x0000000000000000000000000000000000000000" as const; // TODO: Set after deployment
