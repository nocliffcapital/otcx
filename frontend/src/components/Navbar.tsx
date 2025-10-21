"use client";

import Link from "next/link";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { usePathname } from "next/navigation";
import { Logo } from "./Logo";
import { BalanceDisplay } from "./BalanceDisplay";
import { useAccount, useReadContract } from "wagmi";
import { REGISTRY_ADDRESS, PROJECT_REGISTRY_ABI } from "@/lib/contracts";
import { useState } from "react";
import { ChevronDown } from "lucide-react";

export function Navbar() {
  const pathname = usePathname();
  const { address, isConnected } = useAccount();
  const [showResourcesDropdown, setShowResourcesDropdown] = useState(false);
  
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
              <Logo className="w-8 h-8 group-hover:scale-110 transition-transform" />
              <span className="text-2xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent group-hover:from-blue-300 group-hover:to-purple-300 transition-all">
                otcX
              </span>
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
                onMouseEnter={() => setShowResourcesDropdown(true)}
                onMouseLeave={() => setShowResourcesDropdown(false)}
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
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                    pathname === '/admin' 
                      ? 'bg-violet-600/20 text-violet-400 border border-violet-500/30' 
                      : 'text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/50'
                  }`}
                >
                  ⚙️ Admin
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

