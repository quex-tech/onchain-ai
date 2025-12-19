# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Git Workflow
- Default branch: `main` (for all repos in this project)

# Core Development Philosophy

## KISS (Keep It Simple, Stupid)
Simplicity should be a key goal in design. Choose straightforward solutions over complex ones whenever possible. Simple solutions are easier to understand, maintain, and debug.

## YAGNI (You Aren't Gonna Need It)
Avoid building functionality on speculation. Implement features only when they are needed, not when you anticipate they might be useful in the future.

## DRY (Don't repeat yourself)
Every piece of knowledge must have a single, unambiguous, authoritative representation within a system

## TDD (Test-Driven Development)
Write tests first, then code to pass them. Red → Green → Refactor.

## Small Steps & Frequent Commits
- Implement the minimal possible piece of logic at a time
- Commit working code immediately after tests pass
- Stop after each commit to explain what was done and what's next
- Never accumulate large uncommitted changes

## Test Coverage
- Test happy paths (expected behavior)
- Test wrong paths (edge cases, invalid inputs, access control)
- Test isolation (e.g., one user's actions shouldn't affect another user's state)
- Each test should verify one specific behavior

## Design Principles
- Dependency Inversion: High-level modules should not depend on low-level modules. Both should depend on abstractions.
- Open/Closed Principle: Software entities should be open for extension but closed for modification.
- Single Responsibility: Each function, class, and module should have one clear purpose.
- Fail Fast: Check for potential errors early and raise exceptions immediately when issues occur.

## EXAMPLES
- Quex examples are available at http://github.com/quex-tech/quex-v1-examples

## DOCUMENTATION
- Quex documentation is available at https://docs.quex.tech/ (sources at https://github.com/quex-tech/developer-docs) 

## Project Overview

### Quex On-Chain AI Chat

A full-stack demonstration application showcasing Quex oracle capabilities for on-chain AI interactions. This project provides a ChatGPT-like interface where every request and response is recorded as on-chain transactions, enabling verifiable, transparent AI conversations on the blockchain.

### Purpose

- Demonstrate Quex's ability to securely bridge Web2 AI APIs (OpenAI) with Web3 smart contracts
- Provide a user-friendly chat interface for interacting with AI through blockchain transactions
- Showcase encrypted credential handling via Quex Trust Domains
- Serve as a reference implementation for developers building on-chain AI applications

### Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Frontend (React/Next.js)                  │
│  ┌─────────────┐  ┌──────────────┐  ┌────────────────────────┐  │
│  │ Chat UI     │  │ Wallet       │  │ Transaction History    │  │
│  │ (ChatGPT-   │  │ Connection   │  │ & Response Viewer      │  │
│  │  style)     │  │ (wagmi)      │  │                        │  │
│  └─────────────┘  └──────────────┘  └────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Smart Contracts (Solidity)                    │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │                    ChatOracle Contract                       ││
│  │  - Receives user prompts as transactions                    ││
│  │  - Configures Quex data flow for OpenAI API                 ││
│  │  - Stores conversation history on-chain                     ││
│  │  - Emits events for frontend subscriptions                  ││
│  └─────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                     Quex Oracle Network                          │
│  ┌──────────────┐  ┌──────────────┐  ┌───────────────────────┐  │
│  │ Trust Domain │  │ TEE-secured  │  │ Response Callback     │  │
│  │ (Encrypted   │  │ API Request  │  │ to Smart Contract     │  │
│  │  API Keys)   │  │ Processing   │  │                       │  │
│  └──────────────┘  └──────────────┘  └───────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      OpenAI API                                  │
│                  (Chat Completions)                              │
└─────────────────────────────────────────────────────────────────┘
```

### Data Flow

1. **User connects wallet** → Frontend establishes connection via wagmi/viem
2. **User sends message** → Transaction submitted to ChatOracle contract
3. **Contract triggers Quex** → Initiates oracle request with encrypted OpenAI credentials
4. **Quex processes request** → TEE-secured environment calls OpenAI API
5. **Response callback** → Quex oracle delivers response to contract's `processResponse()`
6. **Event emitted** → Frontend receives response via event subscription
7. **UI updates** → Chat interface displays AI response with transaction proof

### Tech Stack

**Frontend:**
- Next.js 14 (App Router)
- TypeScript
- Tailwind CSS
- wagmi v2 + viem (wallet connection & contract interaction)
- React Query (state management)

**Smart Contracts:**
- Solidity ^0.8.20
- Foundry (development, testing, deployment)
- Quex Oracle interfaces

**Target Network:**
- 0G Mainnet / Aristotle (Chain ID: 16661)

### Key Features

- **ChatGPT-style Interface**: Familiar chat UX with message bubbles, typing indicators, and conversation history
- **Web3 Wallet Integration**: Connect with MetaMask, WalletConnect, and other popular wallets
- **On-Chain Transparency**: Every prompt and response recorded as verifiable transactions
- **Conversation History**: Persistent chat history stored on-chain, queryable by address
- **Transaction Proofs**: Link to block explorer for each message/response pair
- **Cost Estimation**: Display estimated gas costs before sending messages

### Smart Contract Interface

```solidity
interface IChatOracle {
    // Events
    event MessageSent(address indexed user, uint256 indexed messageId, string prompt);
    event ResponseReceived(uint256 indexed messageId, string response);

    // User functions
    function sendMessage(string calldata prompt) external payable returns (uint256 messageId);
    function getConversation(address user) external view returns (Message[] memory);
    function getMessageCount(address user) external view returns (uint256);

    // Quex callback
    function processResponse(uint256 messageId, bytes calldata response) external;
}
```

### Project Structure

```
quex-onchain-ai/
├── contracts/              # Solidity smart contracts
│   ├── src/
│   │   ├── ChatOracle.sol
│   │   └── interfaces/
│   ├── test/
│   └── script/
├── frontend/               # Next.js application
│   ├── app/
│   ├── components/
│   ├── hooks/
│   ├── lib/
│   └── public/
├── CLAUDE.md
└── README.md
```

### Development Workflow

1. **Contracts First**: Develop and test smart contracts with Foundry
2. **Local Testing**: Use Anvil for local blockchain + mock Quex responses
3. **Testnet Deployment**: Deploy to Arbitrum Sepolia with real Quex integration
4. **Frontend Development**: Build UI with hot reload against testnet contracts
5. **Integration Testing**: End-to-end tests with actual on-chain transactions

### Environment Variables

```
# Frontend
NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID=
NEXT_PUBLIC_CHAT_ORACLE_ADDRESS=
NEXT_PUBLIC_CHAIN_ID=16661

# Contracts
PRIVATE_KEY=
RPC_URL=https://evmrpc.0g.ai
BLOCK_EXPLORER_URL=https://chainscan.0g.ai
```

### References

- [Quex Documentation](https://docs.quex.tech/)
- [Quex Examples Repository](https://github.com/quex-tech/quex-v1-examples)
- [OpenAI API Integration Example](https://github.com/quex-tech/quex-v1-examples/tree/main/openai-api-integration)
