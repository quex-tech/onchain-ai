"use client";

import { useEffect, useState } from "react";
import {
  useAccount,
  useConnect,
  useDisconnect,
  useReadContract,
  useWriteContract,
  useWatchContractEvent,
  useSwitchChain,
  useChainId,
} from "wagmi";
import { parseEther } from "viem";
import { chatOracleAbi } from "@/lib/abi";
import { CONTRACT_ADDRESSES, zgMainnet, zgTestnet } from "@/lib/config";

type Message = {
  id: number;
  role: "user" | "assistant";
  content: string;
};

export default function Home() {
  const chainId = useChainId();
  const { address, isConnected } = useAccount();
  const { connect, connectors } = useConnect();
  const { disconnect } = useDisconnect();
  const { switchChain } = useSwitchChain();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [depositAmount, setDepositAmount] = useState("0.01");

  const contractAddress = CONTRACT_ADDRESSES[chainId];
  const currentChain = chainId === zgMainnet.id ? zgMainnet : zgTestnet;

  const { data: subscriptionId } = useReadContract({
    address: contractAddress,
    abi: chatOracleAbi,
    functionName: "getUserSubscription",
    args: address ? [address] : undefined,
    query: { enabled: !!address && !!contractAddress },
  });

  const { data: conversation, refetch: refetchConversation } = useReadContract({
    address: contractAddress,
    abi: chatOracleAbi,
    functionName: "getConversation",
    args: address ? [address] : undefined,
    query: { enabled: !!address && !!contractAddress },
  });

  const { writeContract, isPending } = useWriteContract();

  const hasSubscription = subscriptionId && subscriptionId > 0n;

  useWatchContractEvent({
    address: contractAddress,
    abi: chatOracleAbi,
    eventName: "ResponseReceived",
    onLogs: () => {
      refetchConversation();
    },
  });

  useEffect(() => {
    if (conversation) {
      const msgs: Message[] = [];
      conversation.forEach((msg, i) => {
        msgs.push({ id: i * 2, role: "user", content: msg.prompt });
        if (msg.response) {
          msgs.push({ id: i * 2 + 1, role: "assistant", content: msg.response });
        }
      });
      setMessages(msgs);
    }
  }, [conversation]);

  const handleSend = () => {
    if (!input.trim() || !address || !contractAddress) return;

    const value = hasSubscription ? 0n : parseEther(depositAmount);

    writeContract(
      {
        address: contractAddress,
        abi: chatOracleAbi,
        functionName: "sendMessage",
        args: [input],
        value,
        chain: currentChain,
        account: address,
      },
      {
        onSuccess: () => {
          setInput("");
          refetchConversation();
        },
      }
    );
  };

  if (!isConnected) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-gray-900">
        <button
          onClick={() => connect({ connector: connectors[0] })}
          className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          Connect Wallet
        </button>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-900 text-white flex flex-col">
      <header className="p-4 border-b border-gray-700 flex justify-between items-center">
        <h1 className="text-xl font-bold">On-Chain AI Chat</h1>
        <div className="flex items-center gap-4">
          <select
            value={chainId}
            onChange={(e) => switchChain({ chainId: Number(e.target.value) })}
            className="px-2 py-1 bg-gray-800 rounded text-sm"
          >
            <option value={zgTestnet.id}>{zgTestnet.name}</option>
            <option value={zgMainnet.id}>{zgMainnet.name}</option>
          </select>
          <span className="text-sm text-gray-400">
            {hasSubscription ? "Active" : "No sub"}
          </span>
          <span className="text-sm text-gray-400">
            {address?.slice(0, 6)}...{address?.slice(-4)}
          </span>
          <button
            onClick={() => disconnect()}
            className="px-3 py-1 bg-gray-700 rounded hover:bg-gray-600"
          >
            Disconnect
          </button>
        </div>
      </header>

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
            <div
              className={`max-w-[70%] p-3 rounded-lg ${
                msg.role === "user" ? "bg-blue-600" : "bg-gray-700"
              }`}
            >
              {msg.content}
            </div>
          </div>
        ))}
      </div>

      <div className="p-4 border-t border-gray-700">
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
              <span className="text-gray-400">A0GI</span>
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
