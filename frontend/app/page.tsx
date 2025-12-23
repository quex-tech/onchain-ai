"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import {
  useAccount,
  useReadContract,
  useWriteContract,
  useSendTransaction,
  useWatchContractEvent,
  useChainId,
  useWaitForTransactionReceipt,
  usePublicClient,
} from "wagmi";
import { parseEther, encodeFunctionData } from "viem";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { chatOracleAbi, quexCoreAbi } from "@/lib/abi";
import { CONTRACT_ADDRESSES, QUEX_CORE_ADDRESSES, CHAINS, arbitrumSepolia } from "@/lib/config";
import { buildOpenAIBody, getExplorerUrl } from "@/lib/utils";
import { createDebugLogger } from "@/lib/debug";
import {
  buildMessagesFromEvents,
  formatBalance,
  hasActiveSubscription,
  needsDeposit,
  type PendingMessage,
  type MessageSentLog,
  type ResponseReceivedLog,
} from "@/lib/messages";
import { Header } from "@/components/Header";
import { DebugPanel } from "@/components/DebugPanel";
import { ChatMessage } from "@/components/ChatMessage";
import { ChatInput } from "@/components/ChatInput";

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
  const [optimisticBalance, setOptimisticBalance] = useState<bigint | null>(null);
  // Store event logs with guaranteed txHash (React state for proper re-renders)
  const [messageSentLogs, setMessageSentLogs] = useState<MessageSentLog[]>([]);
  const [responseReceivedLogs, setResponseReceivedLogs] = useState<ResponseReceivedLog[]>([]);

  // Register debug update callback
  useEffect(() => {
    debugLogger.setUpdateCallback(() => setDebugVersion((n) => n + 1));
    return () => { debugLogger.setUpdateCallback(null); };
  }, []);

  const contractAddress = CONTRACT_ADDRESSES[chainId];
  const quexCoreAddress = QUEX_CORE_ADDRESSES[chainId];
  const currentChain = CHAINS.find((c) => c.id === chainId) ?? arbitrumSepolia;

  // Log RPC info on mount
  useEffect(() => {
    if (publicClient) {
      const transport = publicClient.transport as { url?: string };
      debug("RPC", { chainId, rpcUrl: transport.url || "unknown" });
    }
  }, [publicClient, chainId]);

  // Track when to refetch events (incremented after tx confirmation)
  const [eventRefetchTrigger, setEventRefetchTrigger] = useState(0);

  // Fetch historical events on mount and after tx confirmation
  useEffect(() => {
    if (!contractAddress || !address || !publicClient) return;

    const fetchEvents = async () => {
      try {
        // Fetch MessageSent events for this user
        const rawMessageLogs = await publicClient.getLogs({
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
          args: { user: address },
          fromBlock: 0n,
          toBlock: "latest",
        });

        const fetchedMessageLogs: MessageSentLog[] = rawMessageLogs
          .filter((log) => log.args.messageId !== undefined && log.args.prompt && log.transactionHash)
          .map((log) => ({
            messageId: log.args.messageId!,
            prompt: log.args.prompt!,
            txHash: log.transactionHash!,
          }));
        setMessageSentLogs(fetchedMessageLogs);
        debug("Fetched historical message events", { count: fetchedMessageLogs.length });

        // Fetch ResponseReceived events (get messageIds from message logs)
        const messageIds = fetchedMessageLogs.map((m) => m.messageId);
        const rawResponseLogs = await publicClient.getLogs({
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

        const fetchedResponseLogs: ResponseReceivedLog[] = rawResponseLogs
          .filter((log) => {
            const msgId = log.args.messageId;
            return msgId !== undefined && log.args.response && log.transactionHash && messageIds.includes(msgId);
          })
          .map((log) => ({
            messageId: log.args.messageId!,
            response: log.args.response!,
            txHash: log.transactionHash!,
          }));
        setResponseReceivedLogs(fetchedResponseLogs);
        debug("Fetched historical response events", { count: fetchedResponseLogs.length });
      } catch (error) {
        debug("Error fetching historical events", error);
      }
    };

    fetchEvents();
  }, [contractAddress, address, publicClient, eventRefetchTrigger]);

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

  // Use sendTransaction to skip viem's simulation (avoids MetaMask RPC issues)
  const { sendTransaction, isPending, data: txHash, error: writeError, reset: resetWrite } = useSendTransaction();
  const { writeContract: withdrawContract, isPending: isWithdrawing, error: withdrawError, reset: resetWithdraw } = useWriteContract();

  const { isLoading: isConfirming, isSuccess: isConfirmed, error: txError } = useWaitForTransactionReceipt({
    hash: pendingMessage?.txHash,
  });

  const hasSubscription = hasActiveSubscription(subscriptionId);
  // Use optimistic balance if set, otherwise use actual balance
  const displayBalance = optimisticBalance !== null ? optimisticBalance : subscriptionBalance;
  const showDepositPrompt = needsDeposit(subscriptionId, displayBalance);

  // Check if we're waiting for any responses
  const awaitingResponses = messageSentLogs.length > responseReceivedLogs.length;

  // Helper to add responses without duplicates (first one wins)
  const addResponsesIfNew = useCallback((newResponses: ResponseReceivedLog[], source: string) => {
    if (newResponses.length === 0) return;
    setResponseReceivedLogs((prev) => {
      const existingIds = new Set(prev.map((r) => r.messageId));
      const unique = newResponses.filter((r) => !existingIds.has(r.messageId));
      if (unique.length > 0) {
        debug(`New responses from ${source}`, { count: unique.length, ids: unique.map(r => Number(r.messageId)) });
        return [...prev, ...unique];
      }
      return prev;
    });
  }, []);

  // Watch for ResponseReceived events (subscription mode - first to detect wins)
  useWatchContractEvent({
    address: contractAddress,
    abi: chatOracleAbi,
    eventName: "ResponseReceived",
    poll: true,
    pollingInterval: 2_000,
    onLogs: (logs) => {
      const responses: ResponseReceivedLog[] = logs
        .filter((log) => {
          const args = (log as { args?: { messageId?: bigint; response?: string } }).args;
          return args?.messageId !== undefined && args?.response && log.transactionHash;
        })
        .map((log) => {
          const args = (log as { args: { messageId: bigint; response: string } }).args;
          return {
            messageId: args.messageId,
            response: args.response,
            txHash: log.transactionHash as `0x${string}`,
          };
        });
      addResponsesIfNew(responses, "watch");
    },
    onError: (error) => {
      debug("ResponseReceived watch error", error);
    },
  });

  // Polling fallback - only active when waiting for responses (races with subscription)
  useEffect(() => {
    if (!publicClient || !contractAddress || !awaitingResponses) return;

    const pollForResponses = async () => {
      try {
        const rawResponseLogs = await publicClient.getLogs({
          address: contractAddress,
          event: {
            type: "event",
            name: "ResponseReceived",
            inputs: [
              { name: "messageId", type: "uint256", indexed: true },
              { name: "response", type: "string", indexed: false },
            ],
          },
          fromBlock: "earliest",
          toBlock: "latest",
        });

        const responses: ResponseReceivedLog[] = rawResponseLogs
          .filter((log) => log.args.messageId !== undefined && log.args.response && log.transactionHash)
          .map((log) => ({
            messageId: log.args.messageId!,
            response: log.args.response!,
            txHash: log.transactionHash!,
          }));

        addResponsesIfNew(responses, "poll");
      } catch (error) {
        debug("Poll error", error);
      }
    };

    // Poll every 3 seconds while waiting for responses
    const interval = setInterval(pollForResponses, 3000);
    return () => clearInterval(interval);
  }, [publicClient, contractAddress, awaitingResponses, addResponsesIfNew]);

  // Watch for MessageSent events (with explicit polling for RPC compatibility)
  useWatchContractEvent({
    address: contractAddress,
    abi: chatOracleAbi,
    eventName: "MessageSent",
    poll: true,
    pollingInterval: 2_000,
    onLogs: (logs) => {
      debug("MessageSent event (watch)", logs);
      const newMessages: MessageSentLog[] = logs
        .filter((log) => {
          const args = (log as { args?: { messageId?: bigint; prompt?: string } }).args;
          return args?.messageId !== undefined && args?.prompt && log.transactionHash;
        })
        .map((log) => {
          const args = (log as { args: { messageId: bigint; prompt: string } }).args;
          return {
            messageId: args.messageId,
            prompt: args.prompt,
            txHash: log.transactionHash as `0x${string}`,
          };
        });
      if (newMessages.length > 0) {
        setMessageSentLogs((prev) => [...prev, ...newMessages]);
      }
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

      if (errorDetails.includes("rate limit") || errorDetails.includes("exceeds defined limit")) {
        errorDetails = "Network is busy (rate limited). Please wait a moment and try again.";
      } else if (errorDetails.includes("Failed to fetch")) {
        errorDetails = "Oracle failed to reach OpenAI. This could be a temporary issue with the Quex oracle or OpenAI service. Try again in a moment.";
      } else if (errorDetails.includes("Internal JSON-RPC error")) {
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
      refetchSubscription();
      // Trigger refetch of events to ensure we have the latest data
      setEventRefetchTrigger((n) => n + 1);
      setTimeout(() => {
        debug("Clearing pending message after confirmation");
        pendingMessageRef.current = null;
        setPendingMessage(null);
        resetWrite();
      }, 2000);
    }
  }, [isConfirmed, refetchSubscription, resetWrite]);

  // Handle tx error
  useEffect(() => {
    if (txError && pendingMessageRef.current) {
      debug("Transaction failed", txError);
      const updated = { ...pendingMessageRef.current, status: "failed" as const };
      pendingMessageRef.current = updated;
      setPendingMessage(updated);
    }
  }, [txError]);

  // Build messages from events - guaranteed to have txHash for confirmed messages
  const confirmedMessages = buildMessagesFromEvents(messageSentLogs, responseReceivedLogs);

  // Compute unique key for each message to avoid React key collisions
  const messagesWithKeys = confirmedMessages.map((msg) => ({
    ...msg,
    id: Number(msg.messageId) * 2 + (msg.role === "assistant" ? 1 : 0),
    status: "confirmed" as const,
  }));

  // Add pending message if it exists and not already confirmed
  const pendingContent = pendingMessage?.content;
  const isPendingAlreadyConfirmed = pendingContent &&
    messagesWithKeys.some((m) => m.role === "user" && m.content === pendingContent);

  const messages = isPendingAlreadyConfirmed
    ? messagesWithKeys
    : pendingMessage
      ? [...messagesWithKeys, {
          id: pendingMessage.id,
          messageId: 0n,
          role: "user" as const,
          content: pendingMessage.content,
          txHash: pendingMessage.txHash ?? ("0x" as `0x${string}`),
          status: pendingMessage.status,
        }]
      : messagesWithKeys;

  const handleSend = useCallback(() => {
    if (!input.trim() || !address || !contractAddress) {
      debug("Send blocked", { input: input.trim(), address, contractAddress });
      return;
    }

    const value = showDepositPrompt ? parseEther(depositAmount) : 0n;
    const confirmedMessages = messages.filter(m => m.status === "confirmed");
    const body = buildOpenAIBody(input, { history: confirmedMessages });
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

    // Encode calldata manually to bypass viem's simulation (which fails through MetaMask's RPC)
    const data = encodeFunctionData({
      abi: chatOracleAbi,
      functionName: "sendMessage",
      args: [messageContent, body],
    });

    sendTransaction(
      {
        to: contractAddress,
        data,
        value,
        gas: 4_000_000n, // Large to handle long conversation histories
      },
      {
        onSuccess: (hash) => {
          debug("sendTransaction onSuccess", hash);
        },
        onError: (error) => {
          debug("sendTransaction onError", error);
          pendingMessageRef.current = null;
          setPendingMessage(null);
        },
      }
    );
  }, [input, address, contractAddress, showDepositPrompt, depositAmount, sendTransaction, messages]);

  const handleWithdraw = useCallback(() => {
    if (!contractAddress) return;
    debug("Withdrawing from subscription");
    setOptimisticBalance(0n); // Optimistically set balance to 0
    withdrawContract(
      {
        address: contractAddress,
        abi: chatOracleAbi,
        functionName: "withdraw",
        args: [],
        gas: 500_000n, // Explicit gas to avoid estimation issues with rate-limited RPCs
      },
      {
        onSuccess: (hash) => {
          debug("Withdraw success", hash);
          refetchSubscription();
          // Clear optimistic balance after a delay to let the real balance update
          setTimeout(() => setOptimisticBalance(null), 5000);
        },
        onError: (error) => {
          debug("Withdraw error", error);
          setOptimisticBalance(null); // Revert optimistic update on error
        },
      }
    );
  }, [contractAddress, withdrawContract, refetchSubscription]);

  // Handle withdraw errors
  useEffect(() => {
    if (withdrawError) {
      debug("Withdraw error", withdrawError);
      const errorDetails = (withdrawError as { shortMessage?: string }).shortMessage
        || withdrawError.message
        || "Withdraw failed";
      setErrorMessage(errorDetails);
      resetWithdraw();
    }
  }, [withdrawError, resetWithdraw]);

  const handleCopyLogs = useCallback(() => {
    navigator.clipboard.writeText(debugLogger.getLogs().join("\n"));
    alert("Logs copied to clipboard!");
  }, []);

  if (!isConnected) {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center bg-black gap-8">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-white mb-2">On-Chain AI Chat</h1>
          <p className="text-gray-400">Powered by <span className="text-[#00d084] font-medium">Quex</span> Oracle</p>
        </div>
        <p className="text-gray-500 text-sm max-w-md text-center">
          Every message is recorded on-chain with verifiable AI responses through trusted execution
        </p>
        <ConnectButton />
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-black text-white flex flex-col">
      <Header
        hasSubscription={hasSubscription}
        subscriptionBalance={displayBalance !== undefined ? formatBalance(displayBalance) : undefined}
        currencySymbol={currentChain.nativeCurrency.symbol}
        onDebugToggle={() => setShowDebug(!showDebug)}
        showDebug={showDebug}
        walletButton={<ConnectButton />}
        onWithdraw={handleWithdraw}
        isWithdrawing={isWithdrawing}
      />

      {showDebug && (
        <DebugPanel
          logs={debugLogger.getLogs()}
          onCopy={handleCopyLogs}
        />
      )}

      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-black">
        {messages.length === 0 && (
          <div className="text-center text-gray-500 mt-20">
            <p className="text-lg mb-2">Send a message to start chatting</p>
            <p className="text-sm text-gray-600">All conversations are recorded on-chain</p>
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

      <div className="p-4 border-t border-[#2a2a3e] bg-black">
        {errorMessage && (
          <div className="mb-3 p-3 bg-red-900/30 border border-red-800/50 rounded-xl text-sm text-red-200">
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
        {showDepositPrompt && (
          <div className="mb-3 p-3 bg-[#00d084]/10 border border-[#00d084]/30 rounded-xl text-sm">
            <span className="text-gray-200">
              {hasSubscription ? "Balance is empty. Add funds to continue." : "First message requires a deposit to create subscription."}
            </span>
            <div className="mt-2 flex items-center gap-2">
              <input
                type="number"
                value={depositAmount}
                onChange={(e) => setDepositAmount(e.target.value)}
                className="w-24 px-3 py-1.5 bg-[#1a1a2e] border border-[#00d084]/30 rounded-lg text-white focus:outline-none focus:border-[#00d084]"
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
