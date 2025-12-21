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
  formatTxHashShort,
  formatBalance,
  hasActiveSubscription,
  type PendingMessage,
  type TxHashMap,
} from "@/lib/messages";

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
        // Fetch MessageSent events
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

        // Fetch ResponseReceived events
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

        // Trigger re-render after Maps are updated
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
          debug("Stored response tx", { messageId: messageId.toString(), txHash: log.transactionHash });
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
          debug("Stored message tx", { messageId: messageId.toString(), txHash: log.transactionHash });
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
      // Extract meaningful error message
      const errorDetails = (writeError as { shortMessage?: string; reason?: string }).shortMessage
        || (writeError as { reason?: string }).reason
        || writeError.message
        || "Transaction failed";
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
      // Clear pending message after a delay to let conversation update
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
    setErrorMessage(null); // Clear any previous error

    // Create pending message
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
        gas: 2_000_000n, // Quex oracle requests need ~1.4M gas
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
      <header className="p-4 border-b border-gray-700 flex justify-between items-center">
        <div className="flex items-center gap-4">
          <h1 className="text-xl font-bold">On-Chain AI Chat</h1>
          <button
            onClick={() => setShowDebug(!showDebug)}
            className="text-xs px-2 py-1 bg-gray-800 rounded hover:bg-gray-700"
          >
            {showDebug ? "Hide Debug" : "Debug"}
          </button>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm text-gray-400">
            {hasSubscription
              ? `Balance: ${subscriptionBalance ? formatBalance(subscriptionBalance) : "..."} ${currentChain.nativeCurrency.symbol}`
              : "No subscription"}
          </span>
          <ConnectButton />
        </div>
      </header>

      {showDebug && (
        <div className="bg-black border-b border-gray-700 p-2 max-h-48 overflow-y-auto font-mono text-xs">
          <div className="flex justify-between items-center mb-2">
            <span className="text-green-400">Debug Logs (copy and share with AI)</span>
            <button
              onClick={() => {
                navigator.clipboard.writeText(debugLogger.getLogs().join("\n"));
                alert("Logs copied to clipboard!");
              }}
              className="px-2 py-1 bg-gray-800 rounded hover:bg-gray-700"
            >
              Copy All
            </button>
          </div>
          {debugLogger.getLogs().map((log, i) => (
            <div key={i} className="text-gray-300 whitespace-pre-wrap break-all">
              {log}
            </div>
          ))}
          {debugLogger.getLogs().length === 0 && (
            <div className="text-gray-500">No logs yet... (v{debugVersion})</div>
          )}
        </div>
      )}

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && (
          <div className="text-center text-gray-500 mt-20">
            Send a message to start chatting with AI on-chain
          </div>
        )}
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div className={`flex flex-col gap-1 max-w-[70%] ${msg.role === "user" ? "items-end" : "items-start"}`}>
              <div
                className={`p-3 rounded-lg ${
                  msg.role === "user" ? "bg-blue-600" : "bg-gray-700"
                } ${msg.status === "pending" ? "opacity-70" : ""}`}
              >
                {msg.content}
              </div>
              <div className="flex items-center gap-2 text-xs text-gray-500">
                {msg.status === "pending" && (
                  <span className="animate-pulse text-yellow-400">Waiting for wallet...</span>
                )}
                {msg.status === "confirming" && (
                  <span className="animate-pulse text-blue-400">Confirming on chain...</span>
                )}
                {msg.status === "failed" && (
                  <span className="text-red-400">Failed</span>
                )}
                {msg.txHash && (
                  <a
                    href={getExplorerUrl(chainId, msg.txHash)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:text-blue-400 underline"
                  >
                    tx:{formatTxHashShort(msg.txHash)}
                  </a>
                )}
              </div>
            </div>
          </div>
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
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !isPending && handleSend()}
            placeholder="Type your message..."
            className="flex-1 px-4 py-2 bg-gray-800 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            disabled={isPending}
          />
          <button
            onClick={handleSend}
            disabled={isPending}
            className="px-6 py-2 bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {isPending ? "Sending..." : "Send"}
          </button>
        </div>
      </div>
    </main>
  );
}
