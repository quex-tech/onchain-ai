import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import { defineChain } from "viem";
import { arbitrum } from "viem/chains";

export const zgMainnet = defineChain({
  id: 16661,
  name: "0G Mainnet",
  nativeCurrency: { name: "0G", symbol: "0G", decimals: 18 },
  rpcUrls: {
    default: { http: ["https://evmrpc.0g.ai"] },
  },
  blockExplorers: {
    default: { name: "0G Explorer", url: "https://chainscan.0g.ai" },
  },
});

export { arbitrum };

// Only show mainnets (hide testnets)
export const CHAINS = [arbitrum, zgMainnet] as const;

export const config = getDefaultConfig({
  appName: "On-Chain AI Chat",
  projectId: process.env.NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID || "demo",
  chains: CHAINS,
  ssr: true,
});

// Contract addresses per chain - update after deployment
export const CONTRACT_ADDRESSES: Record<number, `0x${string}`> = {
  [arbitrum.id]: "0xb7941532b4E4355744F2CD14401cA2De9abA1C0C",
  [zgMainnet.id]: "0xeC677913eFA4eDbB1033dFe5464eC35B21759c64",
};

// Quex Core addresses per chain
export const QUEX_CORE_ADDRESSES: Record<number, `0x${string}`> = {
  [arbitrum.id]: "0x97076a3c0A414E779f7BEC2Bd196D4FdaADFDB96",
  [zgMainnet.id]: "0x48f15775Bc2d83BA18485FE19D4BC6a7ad90293c",
};

// Default deposit amounts per chain
export const DEFAULT_DEPOSIT: Record<number, string> = {
  [arbitrum.id]: "0.001",
  [zgMainnet.id]: "0.1",
};

// Block explorer URLs per chain
export const EXPLORER_URLS: Record<number, string> = {
  [arbitrum.id]: "https://arbiscan.io",
  [zgMainnet.id]: "https://chainscan.0g.ai",
};
