# Quex On-Chain AI Chat

[![Frontend](https://github.com/catena2w/onchain-ai/actions/workflows/frontend.yml/badge.svg)](https://github.com/catena2w/onchain-ai/actions/workflows/frontend.yml)
[![Contracts](https://github.com/catena2w/onchain-ai/actions/workflows/contracts.yml/badge.svg)](https://github.com/catena2w/onchain-ai/actions/workflows/contracts.yml)

[![Frontend Coverage](https://codecov.io/gh/catena2w/onchain-ai/graph/badge.svg?flag=frontend)](https://codecov.io/gh/catena2w/onchain-ai)
[![Contracts Coverage](https://codecov.io/gh/catena2w/onchain-ai/graph/badge.svg?flag=contracts)](https://codecov.io/gh/catena2w/onchain-ai)

A ChatGPT-like interface where every request and response is recorded on-chain via [Quex](https://quex.tech) oracles.

## Architecture

```
Frontend (Next.js) → Smart Contract → Quex Oracle → OpenAI API
                                   ↓
                          Response stored on-chain
```

## Quick Start

### Prerequisites

- Node.js 18+
- [Foundry](https://book.getfoundry.sh/getting-started/installation)
- Wallet with testnet ETH (Arbitrum Sepolia)
- OpenAI API key

### 1. Clone and install

```bash
git clone <repo-url>
cd quex-onchain-ai

# Install frontend dependencies
cd frontend && npm install && cd ..

# Install contract dependencies
cd contracts && forge install && cd ..
```

### 2. Deploy contracts

See [contracts/README.md](./contracts/README.md) for deployment instructions.

### 3. Run frontend

```bash
cd frontend
npm run dev
```

Open http://localhost:3000

## Project Structure

```
├── contracts/          # Solidity smart contracts (Foundry)
│   ├── src/           # Contract source
│   ├── test/          # Contract tests
│   └── script/        # Deployment scripts
├── frontend/          # Next.js web application
│   ├── app/           # App router pages
│   └── lib/           # Config, ABI, providers
└── CLAUDE.md          # Development guidelines
```

## Supported Networks

| Network | Status |
|---------|--------|
| Arbitrum Sepolia | Testnet |
| 0G Mainnet | Coming soon |

## Links

- [Quex Documentation](https://docs.quex.tech)
- [Quex Examples](https://github.com/quex-tech/quex-v1-examples)
