import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import { defineChain } from "viem";
import { arbitrumSepolia } from "viem/chains";

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

export const zgTestnet = defineChain({
  id: 16601,
  name: "0G Newton Testnet",
  nativeCurrency: { name: "0G", symbol: "0G", decimals: 18 },
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
  [zgMainnet.id]: "0xeC677913eFA4eDbB1033dFe5464eC35B21759c64",
  [zgTestnet.id]: "0x0000000000000000000000000000000000000000",
};

// Quex Core addresses per chain
export const QUEX_CORE_ADDRESSES: Record<number, `0x${string}`> = {
  [arbitrumSepolia.id]: "0x97076a3c0A414E779f7BEC2Bd196D4FdaADFDB96",
  [zgMainnet.id]: "0x48f15775Bc2d83BA18485FE19D4BC6a7ad90293c",
  [zgTestnet.id]: "0x0000000000000000000000000000000000000000",
};

// Default deposit amounts per chain
export const DEFAULT_DEPOSIT: Record<number, string> = {
  [arbitrumSepolia.id]: "0.01",
  [zgMainnet.id]: "0.1",
  [zgTestnet.id]: "0.1",
};
