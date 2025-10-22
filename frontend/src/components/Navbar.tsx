"use client";

import Link from "next/link";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { usePathname } from "next/navigation";
import { Logo } from "./Logo";
import { BalanceDisplay } from "./BalanceDisplay";
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { REGISTRY_ADDRESS, PROJECT_REGISTRY_ABI, STABLE_ADDRESS, ERC20_ABI } from "@/lib/contracts";
import { useState, useRef } from "react";
import { ChevronDown, Settings } from "lucide-react";
import { parseUnits } from "viem";

export function Navbar() {
  const pathname = usePathname();
  const { address, isConnected } = useAccount();
  const [showResourcesDropdown, setShowResourcesDropdown] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [minting, setMinting] = useState(false);
  
  const { writeContract } = useWriteContract();

  const handleMouseEnter = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    setShowResourcesDropdown(true);
  };

  const handleMouseLeave = () => {
    timeoutRef.current = setTimeout(() => {
      setShowResourcesDropdown(false);
    }, 150); // 150ms delay
  };
  
  const handleMintUSDC = async () => {
    if (!address) return;
    try {
      setMinting(true);
      await writeContract({
        address: STABLE_ADDRESS,
        abi: ERC20_ABI,
        functionName: "mint",
        args: [address, parseUnits("10000", 6)],
      });
    } catch (error) {
      console.error("Error minting USDC:", error);
    } finally {
      setMinting(false);
    }
  };

  const handleMintTestTokens = async () => {
    if (!address) return;
    try {
      setMinting(true);
      // Mock token address - you can make this dynamic if needed
      const mockTokenAddress = "0x0DCd1Bf9A1b36cE34237eEaFef220932846BCD82" as `0x${string}`;
      await writeContract({
        address: mockTokenAddress,
        abi: ERC20_ABI,
        functionName: "mint",
        args: [address, parseUnits("10000", 18)],
      });
    } catch (error) {
      console.error("Error minting tokens:", error);
    } finally {
      setMinting(false);
    }
  };
  
  // Check if connected user is the owner
  const { data: owner } = useReadContract({
    address: REGISTRY_ADDRESS,
    abi: PROJECT_REGISTRY_ABI,
    functionName: "owner",
  });
  
  const isOwner = isConnected && address && owner && address.toLowerCase() === (owner as string).toLowerCase();
  
  return (
    <nav className="border-b border-zinc-800/50 bg-zinc-950/80 backdrop-blur-xl sticky top-0 z-50 shadow-lg">
      <div className="mx-auto max-w-7xl px-4 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-8">
            <Link href="/" className="flex items-center gap-3 group">
              <Logo variant="full" className="h-8 w-auto group-hover:scale-110 transition-transform" />
            </Link>
            <div className="hidden md:flex items-center gap-2">
              <Link 
                href="/app" 
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  pathname === '/app' 
                    ? 'bg-blue-600/20 text-blue-400 border border-blue-500/30' 
                    : 'text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/50'
                }`}
              >
                Projects
              </Link>
              <Link 
                href="/my" 
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  pathname === '/my' 
                    ? 'bg-blue-600/20 text-blue-400 border border-blue-500/30' 
                    : 'text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/50'
                }`}
              >
                Dashboard
              </Link>
              <Link 
                href="/calculator" 
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  pathname === '/calculator' 
                    ? 'bg-cyan-600/20 text-cyan-400 border border-cyan-500/30' 
                    : 'text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/50'
                }`}
              >
                Calculator
              </Link>
              
              {/* Resources dropdown */}
              <div 
                className="relative"
                onMouseEnter={handleMouseEnter}
                onMouseLeave={handleMouseLeave}
              >
                <button 
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-1 ${
                    pathname === '/how-it-works' || pathname === '/docs'
                      ? 'bg-cyan-600/20 text-cyan-400 border border-cyan-500/30' 
                      : 'text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/50'
                  }`}
                >
                  Resources
                  <ChevronDown className="w-4 h-4" />
                </button>
                
                {showResourcesDropdown && (
                  <div className="absolute top-full left-0 mt-2 w-48 bg-zinc-900 border border-zinc-800 rounded-lg shadow-xl overflow-hidden z-50">
                    <Link 
                      href="/how-it-works"
                      className="block px-4 py-3 text-sm text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 transition-all"
                    >
                      How It Works
                    </Link>
                    <Link 
                      href="/docs"
                      className="block px-4 py-3 text-sm text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 transition-all border-t border-zinc-800"
                    >
                      Docs
                    </Link>
                  </div>
                )}
              </div>
              
              {/* Admin link - only visible to owner */}
              {isOwner && (
                <Link 
                  href="/admin" 
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${
                    pathname === '/admin' 
                      ? 'bg-violet-600/20 text-violet-400 border border-violet-500/30' 
                      : 'text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/50'
                  }`}
                >
                  <Settings className="w-4 h-4" />
                  Admin
                </Link>
              )}
            </div>
          </div>
          <ConnectButton.Custom>
            {({
              account,
              chain,
              openAccountModal,
              openChainModal,
              openConnectModal,
              authenticationStatus,
              mounted,
            }) => {
              const ready = mounted && authenticationStatus !== 'loading';
              const connected =
                ready &&
                account &&
                chain &&
                (!authenticationStatus ||
                  authenticationStatus === 'authenticated');

              return (
                <div
                  {...(!ready && {
                    'aria-hidden': true,
                    'style': {
                      opacity: 0,
                      pointerEvents: 'none',
                      userSelect: 'none',
                    },
                  })}
                >
                  {(() => {
                    if (!connected) {
                      return (
                        <button
                          onClick={openConnectModal}
                          type="button"
                          className="px-4 py-1.5 text-sm bg-gradient-to-r from-cyan-600 to-violet-600 hover:from-cyan-700 hover:to-violet-700 text-white font-medium rounded-lg border border-cyan-500/30 shadow-md transition-all hover:shadow-lg"
                        >
                          Connect Wallet
                        </button>
                      );
                    }

                    if (chain.unsupported) {
                      return (
                        <button
                          onClick={openChainModal}
                          type="button"
                          className="px-6 py-2.5 bg-red-600 hover:bg-red-700 text-white font-medium rounded-lg border border-red-500/30 transition-all"
                        >
                          Wrong network
                        </button>
                      );
                    }

                    return (
                      <div className="flex gap-2 items-center">
                        {/* Mint Test Tokens - Stacked tiny buttons on the left */}
                        <div className="flex flex-col gap-0.5">
                          <button
                            onClick={handleMintUSDC}
                            disabled={minting || !address}
                            className="px-1.5 py-[2px] text-[9px] leading-tight bg-green-600/80 hover:bg-green-600 text-white font-medium rounded border border-green-500/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {minting ? "..." : "Mint USDC"}
                          </button>
                          <button
                            onClick={handleMintTestTokens}
                            disabled={minting || !address}
                            className="px-1.5 py-[2px] text-[9px] leading-tight bg-blue-600/80 hover:bg-blue-600 text-white font-medium rounded border border-blue-500/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {minting ? "..." : "Mint Tokens"}
                          </button>
                        </div>
                        
                        <BalanceDisplay />
                        
                        <button
                          onClick={openChainModal}
                          type="button"
                          className="px-4 py-2.5 bg-zinc-800/50 hover:bg-zinc-800 text-zinc-100 font-medium rounded-lg border border-cyan-500/20 hover:border-cyan-500/40 transition-all flex items-center gap-2 text-sm"
                        >
                          {chain.hasIcon && (
                            <div
                              style={{
                                background: chain.iconBackground,
                                width: 16,
                                height: 16,
                                borderRadius: 999,
                                overflow: 'hidden',
                              }}
                            >
                              {chain.iconUrl && (
                                <img
                                  alt={chain.name ?? 'Chain icon'}
                                  src={chain.iconUrl}
                                  style={{ width: 16, height: 16 }}
                                />
                              )}
                            </div>
                          )}
                          {chain.name}
                        </button>

                        <button
                          onClick={openAccountModal}
                          type="button"
                          className="px-4 py-2.5 bg-zinc-800/50 hover:bg-zinc-800 text-zinc-100 font-medium rounded-lg border border-violet-500/20 hover:border-violet-500/40 transition-all text-sm"
                        >
                          {account.displayName}
                        </button>
                      </div>
                    );
                  })()}
                </div>
              );
            }}
          </ConnectButton.Custom>
        </div>
      </div>
    </nav>
  );
}

