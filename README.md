# Quex On-Chain AI Chat

[![Frontend](https://github.com/quex-tech/onchain-ai/actions/workflows/frontend.yml/badge.svg)](https://github.com/quex-tech/onchain-ai/actions/workflows/frontend.yml)
[![Contracts](https://github.com/quex-tech/onchain-ai/actions/workflows/contracts.yml/badge.svg)](https://github.com/quex-tech/onchain-ai/actions/workflows/contracts.yml)

A ChatGPT-like interface for [Quex](https://quex.tech) oracle to get on-chain verifiable responses from ChatGPT.

**Live Demo:** https://ongpt.quex.tech/

## Quick Start

```bash
# Install
cd frontend && npm install

# Run
npm run dev
```

Open http://localhost:3000

## Deployed Networks

| Network | ChatOracle | Explorer |
|---------|------------|----------|
| Arbitrum One | `0xfCD2634F...` | [arbiscan.io](https://arbiscan.io/address/0xfCD2634F7dA892e32e4212dd2cF30B81b8acba42) |
| Aristotle (0G) | `0x46eb80d4...` | [chainscan.0g.ai](https://chainscan.0g.ai/address/0x46eb80d40782bb75D22b3Fa1cAe597123e1164f9) |
| Arbitrum Sepolia | `0x6Fe4C7A8...` | [sepolia.arbiscan.io](https://sepolia.arbiscan.io/address/0x6Fe4C7A89dd06295Cf5cdd33b92c33451d408427) |

## Project Structure

```
├── contracts/          # Solidity (Foundry)
├── frontend/           # Next.js
├── chains.json         # Shared chain config
└── CLAUDE.md           # Dev guidelines
```

## Links

- [Quex Documentation](https://docs.quex.tech)
- [Quex Examples](https://github.com/quex-tech/quex-v1-examples)
