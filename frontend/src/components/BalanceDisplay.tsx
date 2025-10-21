"use client";

import { useAccount, useBalance, useReadContract } from "wagmi";
import { formatUnits } from "viem";
import { STABLE_ADDRESS, ERC20_ABI } from "@/lib/contracts";

export function BalanceDisplay() {
  const { address, isConnected } = useAccount();

  // Get ETH balance
  const { data: ethBalance } = useBalance({
    address: address,
  });

  // Get USDC balance
  const { data: usdcBalance } = useReadContract({
    address: STABLE_ADDRESS,
    abi: ERC20_ABI,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
  });

  if (!isConnected || !address) {
    return null;
  }

  const ethAmount = ethBalance ? parseFloat(formatUnits(ethBalance.value, 18)) : 0;
  const usdcAmount = usdcBalance ? parseFloat(formatUnits(usdcBalance as bigint, 6)) : 0;

  return (
    <div className="flex items-center gap-2 px-3 py-2 bg-zinc-800/50 rounded-lg border border-zinc-800">
      {/* ETH Balance */}
      <div className="flex items-center gap-1.5">
        <img 
          src="https://cryptologos.cc/logos/ethereum-eth-logo.svg" 
          alt="ETH" 
          className="w-4 h-4"
        />
        <div className="flex flex-col">
          <span className="text-[9px] text-zinc-500 leading-none">ETH</span>
          <span className="text-xs font-semibold text-zinc-100 leading-tight">
            {ethAmount.toFixed(4)}
          </span>
        </div>
      </div>

      {/* Divider */}
      <div className="w-px h-6 bg-zinc-700"></div>

      {/* USDC Balance */}
      <div className="flex items-center gap-1.5">
        <img 
          src="https://cryptologos.cc/logos/usd-coin-usdc-logo.svg" 
          alt="USDC" 
          className="w-4 h-4"
        />
        <div className="flex flex-col">
          <span className="text-[9px] text-zinc-500 leading-none">USDC</span>
          <span className="text-xs font-semibold text-zinc-100 leading-tight">
            {usdcAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
        </div>
      </div>
    </div>
  );
}

