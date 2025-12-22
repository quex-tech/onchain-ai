import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import { defineChain } from "viem";
import { arbitrumSepolia } from "viem/chains";

export const zgMainnet = defineChain({
  id: 16600,
  name: "0G Mainnet",
  nativeCurrency: { name: "A0GI", symbol: "A0GI", decimals: 18 },
  rpcUrls: {
    default: { http: ["https://evmrpc.0g.ai"] },
  },
  blockExplorers: {
    default: { name: "0G Explorer", url: "https://chainscan.0g.ai" },
  },
});

export const zgTestnet = defineChain({
  id: 16601,
  name: "0G Newton Testnet",
  nativeCurrency: { name: "A0GI", symbol: "A0GI", decimals: 18 },
  rpcUrls: {
    default: { http: ["https://evmrpc-testnet.0g.ai"] },
  },
  blockExplorers: {
    default: { name: "0G Explorer", url: "https://chainscan-newton.0g.ai" },
  },
});

export { arbitrumSepolia };

export const CHAINS = [arbitrumSepolia, zgMainnet, zgTestnet] as const;

export const config = getDefaultConfig({
  appName: "On-Chain AI Chat",
  projectId: process.env.NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID || "demo",
  chains: CHAINS,
  ssr: true,
});

// Contract addresses per chain - update after deployment
export const CONTRACT_ADDRESSES: Record<number, `0x${string}`> = {
  [arbitrumSepolia.id]: "0xF23E2F871764A1A8c02D88f7313C4Ce30220Be35",
  [zgMainnet.id]: "0x0000000000000000000000000000000000000000",
  [zgTestnet.id]: "0x0000000000000000000000000000000000000000",
};

// Quex Core addresses per chain
export const QUEX_CORE_ADDRESSES: Record<number, `0x${string}`> = {
  [arbitrumSepolia.id]: "0x97076a3c0A414E779f7BEC2Bd196D4FdaADFDB96",
  [zgMainnet.id]: "0x0000000000000000000000000000000000000000",
  [zgTestnet.id]: "0x0000000000000000000000000000000000000000",
};
