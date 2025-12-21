import { ReactNode } from "react";

export interface HeaderProps {
  hasSubscription: boolean;
  subscriptionBalance?: string;
  currencySymbol?: string;
  onDebugToggle: () => void;
  showDebug: boolean;
  walletButton?: ReactNode;
  onWithdraw?: () => void;
  isWithdrawing?: boolean;
}

export function Header({
  hasSubscription,
  subscriptionBalance,
  currencySymbol = "ETH",
  onDebugToggle,
  showDebug,
  walletButton,
  onWithdraw,
  isWithdrawing,
}: HeaderProps) {
  const hasBalance = subscriptionBalance && parseFloat(subscriptionBalance) > 0;

  return (
    <header className="p-4 border-b border-gray-700 flex justify-between items-center">
      <div className="flex items-center gap-4">
        <h1 className="text-xl font-bold">On-Chain AI Chat</h1>
        <button
          onClick={onDebugToggle}
          className="text-xs px-2 py-1 bg-gray-800 rounded hover:bg-gray-700"
        >
          {showDebug ? "Hide Debug" : "Debug"}
        </button>
      </div>
      <div className="flex items-center gap-4">
        <span className="text-sm text-gray-400">
          {hasSubscription
            ? `Balance: ${subscriptionBalance ?? "..."} ${currencySymbol}`
            : "No subscription"}
        </span>
        {hasSubscription && hasBalance && onWithdraw && (
          <button
            onClick={onWithdraw}
            disabled={isWithdrawing}
            className="text-xs px-2 py-1 bg-orange-600 rounded hover:bg-orange-500 disabled:opacity-50"
          >
            {isWithdrawing ? "Withdrawing..." : "Withdraw"}
          </button>
        )}
        {walletButton}
      </div>
    </header>
  );
}
