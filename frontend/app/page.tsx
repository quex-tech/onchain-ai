"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import {
  useAccount,
  useReadContract,
  useWriteContract,
  useWatchContractEvent,
  useChainId,
  useWaitForTransactionReceipt,
  usePublicClient,
} from "wagmi";
import { parseEther } from "viem";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { chatOracleAbi, quexCoreAbi } from "@/lib/abi";
import { CONTRACT_ADDRESSES, QUEX_CORE_ADDRESSES, CHAINS, arbitrumSepolia } from "@/lib/config";
import { buildOpenAIBody, getExplorerUrl } from "@/lib/utils";
import { createDebugLogger } from "@/lib/debug";
import {
  buildMessagesFromConversation,
  formatBalance,
  hasActiveSubscription,
  type PendingMessage,
  type TxHashMap,
} from "@/lib/messages";
import { Header } from "@/components/Header";
import { DebugPanel } from "@/components/DebugPanel";
import { ChatMessage } from "@/components/ChatMessage";
import { ChatInput } from "@/components/ChatInput";

// Store tx hashes for messages (messageId -> txHash)
const messageTxHashes: TxHashMap = new Map();
const responseTxHashes: TxHashMap = new Map();

// Debug logger instance
const debugLogger = createDebugLogger({ maxLogs: 50 });
const debug = (label: string, ...args: unknown[]) => debugLogger.log(label, args);

export default function Home() {
  const chainId = useChainId();
  const { address, isConnected } = useAccount();
  const publicClient = usePublicClient();
  const [input, setInput] = useState("");
  const [depositAmount, setDepositAmount] = useState("0.01");
  const [pendingMessage, setPendingMessage] = useState<PendingMessage | null>(null);
  const pendingMessageRef = useRef<PendingMessage | null>(null);
  const [showDebug, setShowDebug] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [debugVersion, setDebugVersion] = useState(0);
  const [txHashesVersion, setTxHashesVersion] = useState(0);

  // Register debug update callback
  useEffect(() => {
    debugLogger.setUpdateCallback(() => setDebugVersion((n) => n + 1));
    return () => { debugLogger.setUpdateCallback(null); };
  }, []);

  const contractAddress = CONTRACT_ADDRESSES[chainId];
  const quexCoreAddress = QUEX_CORE_ADDRESSES[chainId];
  const currentChain = CHAINS.find((c) => c.id === chainId) ?? arbitrumSepolia;

  // Fetch historical events on mount to populate tx hashes
  useEffect(() => {
    if (!contractAddress || !address || !publicClient) return;

    const fetchEvents = async () => {
      try {
        const messageLogs = await publicClient.getLogs({
          address: contractAddress,
          event: {
            type: "event",
            name: "MessageSent",
            inputs: [
              { name: "user", type: "address", indexed: true },
              { name: "messageId", type: "uint256", indexed: true },
              { name: "prompt", type: "string", indexed: false },
            ],
          },
          fromBlock: 0n,
          toBlock: "latest",
        });
        messageLogs.forEach((log) => {
          const messageId = log.args.messageId?.toString();
          if (messageId && log.transactionHash) {
            messageTxHashes.set(messageId, log.transactionHash);
          }
        });
        debug("Fetched historical message events", { count: messageLogs.length });

        const responseLogs = await publicClient.getLogs({
          address: contractAddress,
          event: {
            type: "event",
            name: "ResponseReceived",
            inputs: [
              { name: "messageId", type: "uint256", indexed: true },
              { name: "response", type: "string", indexed: false },
            ],
          },
          fromBlock: 0n,
          toBlock: "latest",
        });
        responseLogs.forEach((log) => {
          const messageId = log.args.messageId?.toString();
          if (messageId && log.transactionHash) {
            responseTxHashes.set(messageId, log.transactionHash);
          }
        });
        debug("Fetched historical response events", { count: responseLogs.length });

        setTxHashesVersion((n) => n + 1);
      } catch (error) {
        debug("Error fetching historical events", error);
      }
    };

    fetchEvents();
  }, [contractAddress, address, publicClient]);

  const { data: subscriptionId, refetch: refetchSubscription } = useReadContract({
    address: contractAddress,
    abi: chatOracleAbi,
    functionName: "getUserSubscription",
    args: address ? [address] : undefined,
    query: { enabled: !!address && !!contractAddress },
  });

  const { data: subscriptionBalance } = useReadContract({
    address: quexCoreAddress,
    abi: quexCoreAbi,
    functionName: "balance",
    args: subscriptionId ? [subscriptionId] : undefined,
    query: { enabled: !!subscriptionId && subscriptionId > 0n && !!quexCoreAddress },
  });

  const { data: conversation, refetch: refetchConversation } = useReadContract({
    address: contractAddress,
    abi: chatOracleAbi,
    functionName: "getConversation",
    args: address ? [address] : undefined,
    query: { enabled: !!address && !!contractAddress },
  });

  const { writeContract, isPending, data: txHash, error: writeError, reset: resetWrite } = useWriteContract();

  const { isLoading: isConfirming, isSuccess: isConfirmed, error: txError } = useWaitForTransactionReceipt({
    hash: pendingMessage?.txHash,
  });

  const hasSubscription = hasActiveSubscription(subscriptionId);

  // Watch for ResponseReceived events
  useWatchContractEvent({
    address: contractAddress,
    abi: chatOracleAbi,
    eventName: "ResponseReceived",
    onLogs: (logs) => {
      debug("ResponseReceived event", logs);
      logs.forEach((log) => {
        const messageId = (log as { args?: { messageId?: bigint } }).args?.messageId;
        if (messageId !== undefined && log.transactionHash) {
          responseTxHashes.set(messageId.toString(), log.transactionHash);
        }
      });
      setTxHashesVersion((n) => n + 1);
      refetchConversation();
    },
  });

  // Watch for MessageSent events
  useWatchContractEvent({
    address: contractAddress,
    abi: chatOracleAbi,
    eventName: "MessageSent",
    onLogs: (logs) => {
      debug("MessageSent event", logs);
      logs.forEach((log) => {
        const messageId = (log as { args?: { messageId?: bigint } }).args?.messageId;
        if (messageId !== undefined && log.transactionHash) {
          messageTxHashes.set(messageId.toString(), log.transactionHash);
        }
      });
      setTxHashesVersion((n) => n + 1);
      refetchConversation();
      refetchSubscription();
    },
  });

  // Handle tx hash from writeContract
  useEffect(() => {
    if (txHash && pendingMessageRef.current && !pendingMessageRef.current.txHash) {
      debug("Transaction hash received", txHash);
      const updated = { ...pendingMessageRef.current, txHash, status: "confirming" as const };
      pendingMessageRef.current = updated;
      setPendingMessage(updated);
    }
  }, [txHash]);

  // Handle write errors
  useEffect(() => {
    if (writeError) {
      debug("Write error", writeError);
      let errorDetails = (writeError as { shortMessage?: string; reason?: string }).shortMessage
        || (writeError as { reason?: string }).reason
        || writeError.message
        || "Transaction failed";

      if (errorDetails.includes("Internal JSON-RPC error")) {
        errorDetails = "RPC connection issue. Try: 1) Switch RPC in MetaMask (Settings > Networks > Arbitrum Sepolia), 2) Use RPC: https://sepolia-rollup.arbitrum.io/rpc";
      }

      setErrorMessage(errorDetails);
      pendingMessageRef.current = null;
      setPendingMessage(null);
      resetWrite();
    }
  }, [writeError, resetWrite]);

  // Handle tx confirmation
  useEffect(() => {
    if (isConfirmed && pendingMessageRef.current?.txHash) {
      debug("Transaction confirmed", pendingMessageRef.current.txHash);
      const updated = { ...pendingMessageRef.current, status: "confirmed" as const };
      pendingMessageRef.current = updated;
      setPendingMessage(updated);
      refetchConversation();
      refetchSubscription();
      setTimeout(() => {
        debug("Clearing pending message after confirmation");
        pendingMessageRef.current = null;
        setPendingMessage(null);
        resetWrite();
      }, 2000);
    }
  }, [isConfirmed, refetchConversation, refetchSubscription, resetWrite]);

  // Handle tx error
  useEffect(() => {
    if (txError && pendingMessageRef.current) {
      debug("Transaction failed", txError);
      const updated = { ...pendingMessageRef.current, status: "failed" as const };
      pendingMessageRef.current = updated;
      setPendingMessage(updated);
    }
  }, [txError]);

  // Build messages from conversation + pending
  const messages = buildMessagesFromConversation(
    conversation ?? [],
    pendingMessage,
    messageTxHashes,
    responseTxHashes
  );

  const handleSend = useCallback(() => {
    if (!input.trim() || !address || !contractAddress) {
      debug("Send blocked", { input: input.trim(), address, contractAddress });
      return;
    }

    const value = hasSubscription ? 0n : parseEther(depositAmount);
    const body = buildOpenAIBody(input);
    const messageContent = input;

    debug("Sending message", { prompt: messageContent, value: value.toString(), hasSubscription });
    setErrorMessage(null);

    const pending: PendingMessage = {
      id: Date.now(),
      content: messageContent,
      status: "pending",
    };
    pendingMessageRef.current = pending;
    setPendingMessage(pending);
    setInput("");

    writeContract(
      {
        address: contractAddress,
        abi: chatOracleAbi,
        functionName: "sendMessage",
        args: [messageContent, body],
        value,
        gas: 2_000_000n,
      },
      {
        onSuccess: (hash) => {
          debug("writeContract onSuccess", hash);
        },
        onError: (error) => {
          debug("writeContract onError", error);
          pendingMessageRef.current = null;
          setPendingMessage(null);
        },
      }
    );
  }, [input, address, contractAddress, hasSubscription, depositAmount, writeContract]);

  const handleCopyLogs = useCallback(() => {
    navigator.clipboard.writeText(debugLogger.getLogs().join("\n"));
    alert("Logs copied to clipboard!");
  }, []);

  if (!isConnected) {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center bg-gray-900 gap-6">
        <h1 className="text-2xl font-bold text-white">On-Chain AI Chat</h1>
        <p className="text-gray-400">Connect your wallet to start chatting</p>
        <ConnectButton />
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-900 text-white flex flex-col">
      <Header
        hasSubscription={hasSubscription}
        subscriptionBalance={subscriptionBalance ? formatBalance(subscriptionBalance) : undefined}
        currencySymbol={currentChain.nativeCurrency.symbol}
        onDebugToggle={() => setShowDebug(!showDebug)}
        showDebug={showDebug}
        walletButton={<ConnectButton />}
      />

      {showDebug && (
        <DebugPanel
          logs={debugLogger.getLogs()}
          onCopy={handleCopyLogs}
        />
      )}

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && (
          <div className="text-center text-gray-500 mt-20">
            Send a message to start chatting with AI on-chain
          </div>
        )}
        {messages.map((msg) => (
          <ChatMessage
            key={msg.id}
            id={String(msg.id)}
            role={msg.role}
            content={msg.content}
            status={msg.status}
            txHash={msg.txHash}
            explorerUrl={msg.txHash ? getExplorerUrl(chainId, msg.txHash) : undefined}
          />
        ))}
        {isConfirming && (
          <div className="text-center text-gray-500 text-sm">
            Waiting for transaction confirmation...
          </div>
        )}
      </div>

      <div className="p-4 border-t border-gray-700">
        {errorMessage && (
          <div className="mb-3 p-3 bg-red-900/50 rounded-lg text-sm text-red-200">
            <div className="flex justify-between items-start">
              <span>{errorMessage}</span>
              <button
                onClick={() => setErrorMessage(null)}
                className="text-red-400 hover:text-red-300 ml-2"
              >
                ✕
              </button>
            </div>
          </div>
        )}
        {!hasSubscription && (
          <div className="mb-3 p-3 bg-yellow-900/50 rounded-lg text-sm">
            First message requires a deposit to create subscription.
            <div className="mt-2 flex items-center gap-2">
              <input
                type="number"
                value={depositAmount}
                onChange={(e) => setDepositAmount(e.target.value)}
                className="w-24 px-2 py-1 bg-gray-800 rounded"
                step="0.01"
                min="0.001"
              />
              <span className="text-gray-400">{currentChain.nativeCurrency.symbol}</span>
            </div>
          </div>
        )}
        <ChatInput
          value={input}
          onChange={setInput}
          onSend={handleSend}
          isPending={isPending}
        />
      </div>
    </main>
  );
}
