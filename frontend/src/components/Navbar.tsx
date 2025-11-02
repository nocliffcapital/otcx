"use client";

import Link from "next/link";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { usePathname } from "next/navigation";
import { Logo } from "./Logo";
import { BalanceDisplay } from "./BalanceDisplay";
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { REGISTRY_ADDRESS, PROJECT_REGISTRY_ABI, STABLE_ADDRESS, MOCK_TOKEN_ADDRESS, ERC20_ABI } from "@/lib/contracts";
import { useState, useRef } from "react";
import { ChevronDown, Settings, Menu, X, Lock, LayoutDashboard, Calculator, BookOpen, Lightbulb, FileText } from "lucide-react";
import { parseUnits } from "viem";

export function Navbar() {
  const pathname = usePathname();
  const { address, isConnected } = useAccount();
  const [showResourcesDropdown, setShowResourcesDropdown] = useState(false);
  const [showMobileMenu, setShowMobileMenu] = useState(false);
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
      await writeContract({
        address: MOCK_TOKEN_ADDRESS,
        abi: ERC20_ABI,
        functionName: "mint",
        args: [address, parseUnits("10000", 18)], // 18 decimals for tokens
      });
    } catch (error) {
      console.error("Error minting test tokens:", error);
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
    <nav className="border-b backdrop-blur-xl sticky top-0 z-50 shadow-lg" style={{ borderColor: '#2b2b30', backgroundColor: '#121218' }}>
      <div className="mx-auto max-w-7xl px-4 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-8">
            <Link href="/" className="flex items-center gap-3 group">
              <Logo variant="full" className="h-8 w-auto group-hover:scale-110 transition-transform" />
            </Link>
            <div className="hidden md:flex items-center gap-2">
              <Link 
                href="/private-order" 
                className={`px-4 py-2 rounded text-xs font-mono font-medium transition-colors flex items-center gap-2 ${
                  pathname === '/private-order' 
                    ? 'text-white' 
                    : 'text-zinc-400 hover:text-zinc-100'
                }`}
              >
                <Lock className="w-4 h-4" />
                PRIVATE
              </Link>
              <Link 
                href="/dashboard" 
                className={`px-4 py-2 rounded text-xs font-mono font-medium transition-colors flex items-center gap-2 ${
                  pathname === '/dashboard' 
                    ? 'text-white' 
                    : 'text-zinc-400 hover:text-zinc-100'
                }`}
              >
                <LayoutDashboard className="w-4 h-4" />
                DASHBOARD
              </Link>
              <Link 
                href="/calculator" 
                className={`px-4 py-2 rounded text-xs font-mono font-medium transition-colors flex items-center gap-2 ${
                  pathname === '/calculator' 
                    ? 'text-white' 
                    : 'text-zinc-400 hover:text-zinc-100'
                }`}
              >
                <Calculator className="w-4 h-4" />
                CALCULATOR
              </Link>
              
              {/* Resources dropdown */}
              <div 
                className="relative"
                onMouseEnter={handleMouseEnter}
                onMouseLeave={handleMouseLeave}
              >
                <button 
                  className={`px-4 py-2 rounded text-xs font-mono font-medium transition-colors flex items-center gap-1.5 ${
                    pathname === '/how-it-works' || pathname === '/docs'
                      ? 'text-white' 
                      : 'text-zinc-400 hover:text-zinc-100'
                  }`}
                >
                  <BookOpen className="w-4 h-4" />
                  RESOURCES
                  <ChevronDown className="w-4 h-4" />
                </button>
                
                {showResourcesDropdown && (
                  <div className="absolute top-full left-0 mt-2 w-48 rounded shadow-xl overflow-hidden z-50" style={{ backgroundColor: '#121218', border: '1px solid #2b2b30' }}>
                    <Link 
                      href="/how-it-works"
                      className="flex items-center gap-2 px-4 py-3 text-xs font-mono text-zinc-400 hover:text-zinc-100 transition-all"
                      style={{ 
                        borderBottom: '1px solid #2b2b30'
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#2b2b30'}
                      onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                    >
                      <Lightbulb className="w-4 h-4" />
                      HOW IT WORKS
                    </Link>
                    <Link 
                      href="/docs"
                      className="flex items-center gap-2 px-4 py-3 text-xs font-mono text-zinc-400 hover:text-zinc-100 transition-all"
                      onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#2b2b30'}
                      onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                    >
                      <FileText className="w-4 h-4" />
                      DOCS
                    </Link>
                  </div>
                )}
              </div>
              
              {/* Admin link - only visible to owner */}
              {isOwner && (
                <Link 
                  href="/admin" 
                  className={`px-4 py-2 rounded text-xs font-mono font-medium transition-colors flex items-center gap-2 ${
                    pathname === '/admin' 
                      ? 'text-white' 
                      : 'text-zinc-400 hover:text-zinc-100'
                  }`}
                >
                  <Settings className="w-4 h-4" />
                  ADMIN
                </Link>
              )}
            </div>
          </div>
          
          {/* Desktop wallet/controls - hidden on mobile */}
          <div className="hidden md:flex">
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
                    className="px-4 py-1.5 text-sm text-white font-medium rounded border transition-all font-mono h-[38px]"
                    style={{ backgroundColor: '#2b2b30', borderColor: '#2b2b30' }}
                  >
                    CONNECT WALLET
                  </button>
                      );
                    }

                    if (chain.unsupported) {
                      return (
                        <button
                          onClick={openChainModal}
                          type="button"
                          className="px-4 py-1.5 text-sm text-yellow-400 hover:text-yellow-300 font-medium rounded border transition-all font-mono h-[38px] flex items-center gap-2"
                          style={{ backgroundColor: '#2b2b30', borderColor: '#facc15' }}
                        >
                          <span className="w-2 h-2 bg-yellow-400 rounded-full animate-pulse"></span>
                          SWITCH NETWORK
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
                            className="px-1.5 py-[2px] text-[9px] leading-tight bg-green-600/80 hover:bg-green-600 text-white font-medium rounded border border-zinc-800 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {minting ? "..." : "Mint USDC"}
                          </button>
                          <button
                            onClick={handleMintTestTokens}
                            disabled={minting || !address}
                            className="px-1.5 py-[2px] text-[9px] leading-tight bg-blue-600/80 hover:bg-blue-600 text-white font-medium rounded border border-zinc-800 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                            title="Mints Mock MegaETH Token (mMEGAETH) - Use this token address when activating TGE for testing"
                          >
                            {minting ? "..." : "Mint mMEGAETH"}
                          </button>
                        </div>
                        
                        <BalanceDisplay />
                        
                        <button
                          onClick={openChainModal}
                          type="button"
                          className="px-4 py-1.5 text-zinc-300 font-medium rounded border transition-all flex items-center gap-2 text-sm font-mono hover:text-white h-[38px]"
                          style={{ backgroundColor: '#121218', borderColor: '#2b2b30' }}
                          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#2b2b30'}
                          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#121218'}
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
                          className="px-4 py-1.5 text-zinc-300 font-medium rounded border transition-all text-sm font-mono hover:text-white h-[38px]"
                          style={{ backgroundColor: '#121218', borderColor: '#2b2b30' }}
                          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#2b2b30'}
                          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#121218'}
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
          
          {/* Mobile: Just show connect button and hamburger */}
          <div className="flex md:hidden items-center gap-2">
            <ConnectButton.Custom>
            {({
              openConnectModal,
              authenticationStatus,
              mounted,
            }) => {
              const ready = mounted && authenticationStatus !== 'loading';
              
              return (
              <button
                onClick={openConnectModal}
                type="button"
                className="px-3 py-1.5 text-xs text-white font-medium rounded border transition-all font-mono h-[38px]"
                style={{ backgroundColor: '#2b2b30', borderColor: '#2b2b30' }}
              >
                CONNECT
              </button>
              );
            }}
            </ConnectButton.Custom>
            
            <button
              onClick={() => setShowMobileMenu(!showMobileMenu)}
              className="p-2 text-zinc-400 hover:text-white transition-colors"
            >
              {showMobileMenu ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>
        
        {/* Mobile menu */}
        {showMobileMenu && (
          <div className="md:hidden mt-4 pb-4 border-t pt-4" style={{ borderColor: '#2b2b30' }}>
            <div className="flex flex-col gap-2">
              <Link 
                href="/private-order" 
                onClick={() => setShowMobileMenu(false)}
                className={`px-4 py-2 rounded text-xs font-mono font-medium transition-colors flex items-center gap-2 ${
                  pathname === '/private-order' 
                    ? 'text-white' 
                    : 'text-zinc-400 hover:text-zinc-100'
                }`}
              >
                <Lock className="w-4 h-4" />
                PRIVATE ORDER
              </Link>
              <Link 
                href="/dashboard" 
                onClick={() => setShowMobileMenu(false)}
                className={`px-4 py-2 rounded text-xs font-mono font-medium transition-colors flex items-center gap-2 ${
                  pathname === '/dashboard' 
                    ? 'text-white' 
                    : 'text-zinc-400 hover:text-zinc-100'
                }`}
              >
                <LayoutDashboard className="w-4 h-4" />
                DASHBOARD
              </Link>
              <Link 
                href="/calculator" 
                onClick={() => setShowMobileMenu(false)}
                className={`px-4 py-2 rounded text-xs font-mono font-medium transition-colors flex items-center gap-2 ${
                  pathname === '/calculator' 
                    ? 'text-white' 
                    : 'text-zinc-400 hover:text-zinc-100'
                }`}
              >
                <Calculator className="w-4 h-4" />
                CALCULATOR
              </Link>
              <Link 
                href="/how-it-works" 
                onClick={() => setShowMobileMenu(false)}
                className={`px-4 py-2 rounded text-xs font-mono font-medium transition-colors flex items-center gap-2 ${
                  pathname === '/how-it-works' 
                    ? 'text-white' 
                    : 'text-zinc-400 hover:text-zinc-100'
                }`}
              >
                <Lightbulb className="w-4 h-4" />
                HOW IT WORKS
              </Link>
              <Link 
                href="/docs" 
                onClick={() => setShowMobileMenu(false)}
                className="px-4 py-2 rounded text-xs font-mono font-medium transition-colors text-zinc-400 hover:text-zinc-100 flex items-center gap-2"
              >
                <FileText className="w-4 h-4" />
                DOCS
              </Link>
              {isOwner && (
                <Link 
                  href="/admin" 
                  onClick={() => setShowMobileMenu(false)}
                  className={`px-4 py-2 rounded text-xs font-mono font-medium transition-colors flex items-center gap-2 ${
                    pathname === '/admin' 
                      ? 'text-white' 
                      : 'text-zinc-400 hover:text-zinc-100'
                  }`}
                >
                  <Settings className="w-4 h-4" />
                  ADMIN
                </Link>
              )}
            </div>
          </div>
        )}
      </div>
    </nav>
  );
}

