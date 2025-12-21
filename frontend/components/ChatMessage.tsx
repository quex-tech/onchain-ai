import { formatTxHashShort } from "@/lib/messages";

export type MessageStatus = "pending" | "confirming" | "confirmed" | "failed";

export interface ChatMessageProps {
  id: string;
  role: "user" | "assistant";
  content: string;
  status?: MessageStatus;
  txHash?: string;
  explorerUrl?: string;
}

export function ChatMessage({
  role,
  content,
  status,
  txHash,
  explorerUrl,
}: ChatMessageProps) {
  const isUser = role === "user";
  const isPending = status === "pending";

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={`flex flex-col gap-1 max-w-[70%] ${isUser ? "items-end" : "items-start"}`}
      >
        <div
          className={`p-3 rounded-lg ${
            isUser ? "bg-blue-600" : "bg-gray-700"
          } ${isPending ? "opacity-70" : ""}`}
        >
          {content}
        </div>
        <div className="flex items-center gap-2 text-xs text-gray-500">
          {status === "pending" && (
            <span className="animate-pulse text-yellow-400">
              Waiting for wallet...
            </span>
          )}
          {status === "confirming" && (
            <span className="animate-pulse text-blue-400">
              Confirming on chain...
            </span>
          )}
          {status === "failed" && <span className="text-red-400">Failed</span>}
          {txHash && explorerUrl && (
            <a
              href={explorerUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-blue-400 underline"
            >
              tx:{formatTxHashShort(txHash)}
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
