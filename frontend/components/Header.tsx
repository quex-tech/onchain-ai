import { ReactNode } from "react";
import Image from "next/image";

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
    <header className="px-6 py-4 border-b border-[#2a2a3e] bg-black flex justify-between items-center">
      <div className="flex items-center gap-4">
        <Image
          src="/quex-logo.png"
          alt="Quex"
          width={100}
          height={26}
          className="h-6 w-auto"
        />
        <span className="text-gray-500">|</span>
        <span className="text-white font-medium">On-Chain AI</span>
        <button
          onClick={onDebugToggle}
          className="text-xs px-3 py-1.5 bg-[#32373c] text-white rounded-full hover:bg-[#3d4349] transition-colors"
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
            className="text-xs px-3 py-1.5 bg-[#00d084] text-white rounded-full hover:bg-[#00e090] disabled:opacity-50 transition-colors"
          >
            {isWithdrawing ? "Withdrawing..." : "Withdraw"}
          </button>
        )}
        {walletButton}
      </div>
    </header>
  );
}
