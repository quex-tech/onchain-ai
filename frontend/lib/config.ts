import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import { defineChain } from "viem";
import { arbitrum as viemArbitrum } from "viem/chains";
import chainsConfig from "../chains.json";

// Build chain definitions from shared config
const arbitrumConfig = chainsConfig.chains.arbitrum;
const zgMainnetConfig = chainsConfig.chains.zgMainnet;

export const arbitrum = {
  ...viemArbitrum,
  rpcUrls: {
    default: { http: [arbitrumConfig.rpcUrl] },
  },
};

export const zgMainnet = defineChain({
  id: zgMainnetConfig.chainId,
  name: zgMainnetConfig.name,
  nativeCurrency: zgMainnetConfig.nativeCurrency,
  rpcUrls: {
    default: { http: [zgMainnetConfig.rpcUrl] },
  },
  blockExplorers: {
    default: { name: "0G Explorer", url: zgMainnetConfig.explorerUrl },
  },
  iconUrl: "/0g-logo.svg",
});

// Only show mainnets (hide testnets)
export const CHAINS = [arbitrum, zgMainnet] as const;

export const config = getDefaultConfig({
  appName: "On-Chain AI Chat",
  projectId: process.env.NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID || "demo",
  chains: CHAINS,
  ssr: true,
});

// Build lookup tables from shared config
type ChainConfig = typeof chainsConfig.chains.arbitrum;
const allChains = chainsConfig.chains as Record<string, ChainConfig>;

// Contract addresses per chain
export const CONTRACT_ADDRESSES: Record<number, `0x${string}`> = Object.fromEntries(
  Object.values(allChains).map((c) => [c.chainId, c.chatOracle as `0x${string}`])
) as Record<number, `0x${string}`>;

// Quex Core addresses per chain
export const QUEX_CORE_ADDRESSES: Record<number, `0x${string}`> = Object.fromEntries(
  Object.values(allChains).map((c) => [c.chainId, c.quexCore as `0x${string}`])
) as Record<number, `0x${string}`>;

// Block explorer URLs per chain
export const EXPLORER_URLS: Record<number, string> = Object.fromEntries(
  Object.values(allChains).map((c) => [c.chainId, c.explorerUrl])
);

// Default deposit amounts per chain
export const DEFAULT_DEPOSIT: Record<number, string> = Object.fromEntries(
  Object.values(allChains).map((c) => [c.chainId, c.defaultDeposit])
);
