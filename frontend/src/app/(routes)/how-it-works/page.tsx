"use client";

import { useState, useEffect } from "react";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { 
  FileText, 
  Users, 
  CheckCircle, 
  Shield, 
  AlertTriangle, 
  CheckCheck,
  HelpCircle,
  Coins,
  Zap,
  BookOpen,
  Lock,
  Globe,
  Terminal,
  Database,
  Cpu
} from "lucide-react";
import { usePublicClient, useBlockNumber, useReadContract, useChainId } from "wagmi";
import { getExplorerUrl } from "@/lib/chains";
import { ORDERBOOK_ADDRESS, ESCROW_ORDERBOOK_ABI } from "@/lib/contracts";

export default function HowItWorksPage() {
  const chainId = useChainId();
  const [activeTab, setActiveTab] = useState<"overview" | "process" | "private" | "risks" | "faq">("overview");
  const [settlementFee, setSettlementFee] = useState<string>("0.5");
  const [cancellationFee, setCancellationFee] = useState<string>("0.1");
  const publicClient = usePublicClient();
  const { data: blockNumber } = useBlockNumber({ watch: true });

  // Check if orderbook is paused
  const { data: isOrderbookPaused } = useReadContract({
    address: ORDERBOOK_ADDRESS as `0x${string}`,
    abi: [{
      name: "paused",
      type: "function",
      stateMutability: "view",
      inputs: [],
      outputs: [{ type: "bool" }],
    }],
    functionName: "paused",
  });

  useEffect(() => {
    const fetchFees = async () => {
      if (!publicClient) return;
      
      try {
        const [settlementFeeBps, cancellationFeeBps] = await Promise.all([
          publicClient.readContract({
            address: ORDERBOOK_ADDRESS,
            abi: ESCROW_ORDERBOOK_ABI,
            functionName: "settlementFeeBps",
          }),
          publicClient.readContract({
            address: ORDERBOOK_ADDRESS,
            abi: ESCROW_ORDERBOOK_ABI,
            functionName: "cancellationFeeBps",
          }),
        ]);

        // Convert basis points to percentage (e.g., 50 bps = 0.5%)
        setSettlementFee((Number(settlementFeeBps) / 100).toFixed(2));
        setCancellationFee((Number(cancellationFeeBps) / 100).toFixed(2));
      } catch (error) {
        console.error("Failed to fetch fees:", error);
        // Keep default values on error
      }
    };

    fetchFees();
  }, [publicClient]);

  return (
    <div style={{ backgroundColor: '#06060c', minHeight: '100vh' }}>
      <div className="mx-auto max-w-7xl px-4 py-8">
      {/* Terminal-style header */}
      <div className="border rounded p-4 mb-6 backdrop-blur-sm font-mono" style={{ backgroundColor: '#121218', borderColor: '#2b2b30' }}>
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <div className="border rounded flex items-center justify-center flex-shrink-0" style={{ 
              width: '56px', 
              height: '56px',
              borderColor: '#2b2b30'
            }}>
              <BookOpen className="w-10 h-10 text-zinc-300" />
            </div>
            <div className="min-w-0 flex-1">
              <span className="text-zinc-300/70 text-xs mb-1 block">otcX://protocol/documentation/how-it-works</span>
              <h1 className="text-2xl md:text-3xl font-bold text-white tracking-tight break-words">
                HOW_OTCX_WORKS
              </h1>
              <p className="text-xs text-zinc-300/70 mt-1 break-words">
                Protocol Overview • Escrow System Guide
              </p>
            </div>
          </div>
          <div className="flex flex-col gap-2 items-end flex-shrink-0">
            <div className="flex items-center gap-2 text-xs whitespace-nowrap">
              <a 
                href={getExplorerUrl(chainId, ORDERBOOK_ADDRESS)}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-xs whitespace-nowrap hover:opacity-80 transition-opacity"
              >
                <span className="text-zinc-300/70">
                  {ORDERBOOK_ADDRESS.slice(0, 6)}...{ORDERBOOK_ADDRESS.slice(-4)}
                </span>
                <Database className="w-3 h-3 text-zinc-300/70 flex-shrink-0" />
              </a>
            </div>
            <div className={`flex items-center gap-2 px-3 py-1.5 rounded border whitespace-nowrap ${
              isOrderbookPaused 
                ? 'bg-red-950/30 border-red-500/50' 
                : 'bg-green-950/30 border-green-500/50'
            }`}>
              <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
                isOrderbookPaused ? 'bg-red-500 animate-pulse' : 'bg-green-500 animate-pulse'
              }`} />
              <span className={`text-xs font-mono font-semibold ${
                isOrderbookPaused ? 'text-red-400' : 'text-green-400'
              }`}>
                {isOrderbookPaused ? 'PAUSED' : 'ONLINE'}
              </span>
            </div>
            <div className="flex items-center gap-2 text-xs text-zinc-500 font-mono whitespace-nowrap">
              <span className="hidden sm:inline">BLOCK #{blockNumber?.toString() || '...'}</span>
              <span className="sm:hidden">#{blockNumber?.toString() || '...'}</span>
              <Cpu className="w-3 h-3 flex-shrink-0" />
            </div>
          </div>
        </div>
      </div>
      <div className="mb-8">
          <a
          href="/docs"
          className="inline-flex items-center gap-2 px-4 py-2 text-sm rounded border transition-all group"
          style={{ backgroundColor: '#121218', borderColor: '#2b2b30' }}
        >
          <FileText className="w-4 h-4 text-zinc-300" />
          <span className="text-zinc-300 group-hover:text-zinc-100 transition-colors">
            For a more comprehensive overview of the platform, please visit the docs page
          </span>
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="text-zinc-400 group-hover:text-zinc-100 group-hover:translate-x-0.5 transition-all"
          >
            <path d="M5 12h14" />
            <path d="m12 5 7 7-7 7" />
          </svg>
        </a>
      </div>

      {/* Tabs */}
      <div className="mb-6">
        <div className="flex items-center gap-2 border-b" style={{ borderColor: '#2b2b30' }}>
          <button
            onClick={() => setActiveTab("overview")}
            className={`px-4 py-2 text-xs font-mono font-medium transition-all relative ${
              activeTab === "overview"
                ? "text-zinc-300"
                : "text-zinc-400 hover:text-zinc-300"
            }`}
          >
            OVERVIEW & ASSETS
            {activeTab === "overview" && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5" style={{ backgroundColor: '#2b2b30' }}></div>
            )}
          </button>
          <button
            onClick={() => setActiveTab("process")}
            className={`px-4 py-2 text-xs font-mono font-medium transition-all relative ${
              activeTab === "process"
                ? "text-zinc-300"
                : "text-zinc-400 hover:text-zinc-300"
            }`}
          >
            THE PROCESS
            {activeTab === "process" && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5" style={{ backgroundColor: '#2b2b30' }}></div>
            )}
          </button>
          <button
            onClick={() => setActiveTab("private")}
            className={`px-4 py-2 text-xs font-mono font-medium transition-all relative ${
              activeTab === "private"
                ? "text-zinc-300"
                : "text-zinc-400 hover:text-zinc-300"
            }`}
          >
            PRIVATE VS PUBLIC
            {activeTab === "private" && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5" style={{ backgroundColor: '#2b2b30' }}></div>
            )}
          </button>
          <button
            onClick={() => setActiveTab("risks")}
            className={`px-4 py-2 text-xs font-mono font-medium transition-all relative ${
              activeTab === "risks"
                ? "text-zinc-300"
                : "text-zinc-400 hover:text-zinc-300"
            }`}
          >
            RISKS & BEST PRACTICES
            {activeTab === "risks" && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5" style={{ backgroundColor: '#2b2b30' }}></div>
            )}
          </button>
          <button
            onClick={() => setActiveTab("faq")}
            className={`px-4 py-2 text-xs font-mono font-medium transition-all relative ${
              activeTab === "faq"
                ? "text-zinc-300"
                : "text-zinc-400 hover:text-zinc-300"
            }`}
          >
            FAQ
            {activeTab === "faq" && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5" style={{ backgroundColor: '#2b2b30' }}></div>
            )}
          </button>
        </div>
      </div>

      {/* Overview Tab */}
      {activeTab === "overview" && (
        <>
      <Card className="mb-6">
        <div className="flex items-start gap-3 mb-4">
          <FileText className="w-6 h-6 text-zinc-300 mt-1" />
          <h2 className="text-2xl font-bold">Overview</h2>
        </div>
        <p className="text-zinc-300 leading-relaxed mb-4">
          otcX enables traders to buy and sell pre-TGE (Token Generation Event) tokens and points 
          through a fully decentralized escrow system. Both buyers and sellers lock collateral on-chain 
          to ensure mutual trust and accountability.
        </p>
        <div className="border rounded-lg p-4" style={{ backgroundColor: '#121218', borderColor: '#2b2b30' }}>
          <p className="text-sm text-zinc-300">
            <strong>Key Innovation:</strong> Unlike traditional OTC desks, otcX requires both parties 
            to lock funds in a smart contract, creating economic incentives for honest behavior.
          </p>
        </div>
      </Card>

      {/* Asset Types */}
      <Card className="mb-6">
        <div className="flex items-start gap-3 mb-4">
          <Coins className="w-6 h-6 text-zinc-300 mt-1" />
          <h2 className="text-2xl font-bold">Asset Types</h2>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Tokens */}
          <div className="border rounded-lg p-4" style={{ backgroundColor: '#121218', borderColor: '#2b2b30' }}>
            <div className="flex items-center gap-2 mb-3">
              <Badge className="bg-blue-500/20 text-blue-400 border border-blue-500/50">Tokens</Badge>
              <Zap className="w-4 h-4 text-zinc-300" />
            </div>
            <h3 className="text-lg font-semibold mb-2 text-zinc-100">On-Chain Settlement</h3>
            <p className="text-sm text-zinc-400 mb-3">
              For projects with confirmed TGE token contracts, settlement happens automatically on-chain.
            </p>
            <div className="space-y-2 text-xs text-zinc-400">
              <div className="flex items-start gap-2">
                <CheckCircle className="w-4 h-4 text-green-400 flex-shrink-0 mt-0.5" />
                <span>Admin activates TGE window (4 hours)</span>
              </div>
              <div className="flex items-start gap-2">
                <CheckCircle className="w-4 h-4 text-green-400 flex-shrink-0 mt-0.5" />
                <span>Seller deposits actual tokens to contract</span>
              </div>
              <div className="flex items-start gap-2">
                <CheckCircle className="w-4 h-4 text-green-400 flex-shrink-0 mt-0.5" />
                <span>Buyer claims tokens from contract</span>
              </div>
              <div className="flex items-start gap-2">
                <CheckCircle className="w-4 h-4 text-green-400 flex-shrink-0 mt-0.5" />
                <span>Funds auto-released to seller</span>
              </div>
            </div>
          </div>

          {/* Points */}
          <div className="border rounded-lg p-4" style={{ backgroundColor: '#121218', borderColor: '#2b2b30' }}>
            <div className="flex items-center gap-2 mb-3">
              <Badge className="bg-purple-500/20 text-purple-400 border border-purple-500/50">Points</Badge>
              <Users className="w-4 h-4 text-zinc-300" />
            </div>
            <h3 className="text-lg font-semibold mb-2 text-zinc-100">Proof-Based Settlement</h3>
            <p className="text-sm text-zinc-400 mb-3">
              For off-chain points (loyalty, rewards), seller submits proof for admin verification.
            </p>
            <div className="space-y-2 text-xs text-zinc-400">
              <div className="flex items-start gap-2">
                <CheckCircle className="w-4 h-4 text-green-400 flex-shrink-0 mt-0.5" />
                <span>Seller transfers points off-chain</span>
              </div>
              <div className="flex items-start gap-2">
                <CheckCircle className="w-4 h-4 text-green-400 flex-shrink-0 mt-0.5" />
                <span>Seller submits proof (tx hash, screenshot)</span>
              </div>
              <div className="flex items-start gap-2">
                <CheckCircle className="w-4 h-4 text-green-400 flex-shrink-0 mt-0.5" />
                <span>Admin verifies the proof</span>
              </div>
              <div className="flex items-start gap-2">
                <CheckCircle className="w-4 h-4 text-green-400 flex-shrink-0 mt-0.5" />
                <span>Funds released to seller after verification</span>
              </div>
            </div>
          </div>
        </div>
      </Card>
        </>
      )}

      {/* Process Tab */}
      {activeTab === "process" && (
        <>
      <Card className="mb-6">
        <div className="flex items-start gap-3 mb-4">
          <Zap className="w-6 h-6 text-zinc-300 mt-1" />
          <h2 className="text-2xl font-bold">The Process</h2>
        </div>
        
        <div className="space-y-5">
          {/* Step 1 */}
          <div className="flex gap-4">
            <div className="flex-shrink-0">
              <div className="w-8 h-8 rounded border flex items-center justify-center font-bold text-sm text-zinc-300" style={{ backgroundColor: '#121218', borderColor: '#2b2b30' }}>
                1
              </div>
            </div>
            <div className="flex-1">
              <h3 className="text-base font-semibold mb-2">Create an Order</h3>
              <p className="text-zinc-400 text-sm">
                A maker creates a <Badge className="bg-red-600 text-[10px]">SELL</Badge> or <Badge className="bg-green-600 text-[10px]">BUY</Badge> order 
                specifying the project token, amount, unit price, and expiration date.
              </p>
            </div>
          </div>

          {/* Step 2 */}
          <div className="flex gap-4">
            <div className="flex-shrink-0">
              <div className="w-8 h-8 rounded border flex items-center justify-center font-bold text-sm text-zinc-300" style={{ backgroundColor: '#121218', borderColor: '#2b2b30' }}>
                2
              </div>
            </div>
            <div className="flex-1">
              <h3 className="text-base font-semibold mb-2">Lock Collateral</h3>
              <p className="text-zinc-400 text-sm mb-2">
                Both parties must lock funds in the smart contract:
              </p>
              <div className="space-y-1.5 text-sm ml-4">
                <div className="flex items-center gap-2">
                  <div className="w-1 h-1 bg-red-400 rounded-full"></div>
                  <span className="text-zinc-400"><strong className="text-red-400">Seller:</strong> Locks collateral equal to trade value in USDC</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-1 h-1 bg-zinc-400 rounded-full"></div>
                  <span className="text-zinc-400"><strong className="text-zinc-100">Buyer:</strong> Locks the full purchase price in USDC</span>
                </div>
              </div>
            </div>
          </div>

          {/* Step 3 */}
          <div className="flex gap-4">
            <div className="flex-shrink-0">
              <div className="w-8 h-8 rounded border flex items-center justify-center font-bold text-sm text-zinc-300" style={{ backgroundColor: '#121218', borderColor: '#2b2b30' }}>
                3
              </div>
            </div>
            <div className="flex-1">
              <h3 className="text-base font-semibold mb-2">Settlement</h3>
              <p className="text-zinc-400 text-sm mb-2">
                Depending on asset type:
              </p>
              <div className="space-y-2">
                <div className="border rounded-lg p-3" style={{ backgroundColor: '#121218', borderColor: '#2b2b30' }}>
                  <div className="flex items-center gap-2 mb-1">
                    <Badge className="bg-blue-500/20 text-blue-400 border border-blue-500/50 text-[10px]">Tokens</Badge>
                  </div>
                  <p className="text-xs text-zinc-400">
                    Seller deposits actual tokens to smart contract during TGE window. Buyer claims tokens directly from contract.
                  </p>
                </div>
                <div className="border rounded-lg p-3" style={{ backgroundColor: '#121218', borderColor: '#2b2b30' }}>
                  <div className="flex items-center gap-2 mb-1">
                    <Badge className="bg-purple-500/20 text-purple-400 border border-purple-500/50 text-[10px]">Points</Badge>
                  </div>
                  <p className="text-xs text-zinc-400">
                    Seller transfers points off-chain (via platform UI), then submits proof (screenshot, tx hash) for admin verification.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Step 4 */}
          <div className="flex gap-4">
            <div className="flex-shrink-0">
              <div className="w-8 h-8 rounded border flex items-center justify-center font-bold text-sm text-zinc-300" style={{ backgroundColor: '#121218', borderColor: '#2b2b30' }}>
                4
              </div>
            </div>
            <div className="flex-1">
              <h3 className="text-base font-semibold mb-2">Funds Release</h3>
              <p className="text-zinc-400 text-sm mb-2">
                Once settlement is complete:
              </p>
              <div className="space-y-1.5 text-sm ml-4">
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-green-400" />
                  <span className="text-zinc-400">Buyer&apos;s payment released to seller (minus 0.5% settlement fee)</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-green-400" />
                  <span className="text-zinc-400">Seller&apos;s collateral returned in full</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-green-400" />
                  <span className="text-zinc-400">Buyer receives tokens/points (minus 0.5% settlement fee from their side)</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-green-400" />
                  <span className="text-zinc-400">Trade complete ✓</span>
                </div>
              </div>
              <div className="mt-3 p-2 border rounded-lg" style={{ backgroundColor: '#121218', borderColor: '#2b2b30' }}>
                <p className="text-xs text-zinc-300">
                  💡 <strong>Fee Split:</strong> The 0.5% settlement fee is applied to both sides - buyer pays 0.5% in stablecoins, seller pays 0.5% in project tokens.
                </p>
              </div>
            </div>
          </div>
        </div>
      </Card>

      <Card className="mb-6">
        <div className="flex items-start gap-3 mb-4">
          <Shield className="w-6 h-6 text-zinc-300 mt-1" />
          <h2 className="text-2xl font-bold">Default Protection</h2>
        </div>
        <p className="text-zinc-300 mb-4 text-sm">
          If one party fails to fulfill their obligation, the other party can claim the defaulter&apos;s collateral:
        </p>
        
        <div className="space-y-3">
          <div className="bg-red-950/30 border border-red-800/50 rounded-lg p-4">
            <h3 className="text-base font-semibold mb-2 text-red-400">Buyer Defaults</h3>
            <p className="text-sm text-zinc-400">
              If the buyer locks funds but then refuses to complete settlement (even after receiving tokens/points), 
              the seller can claim the buyer's locked funds as compensation.
            </p>
          </div>

          <div className="border rounded-lg p-4" style={{ backgroundColor: '#121218', borderColor: '#2b2b30' }}>
            <h3 className="text-base font-semibold mb-2 text-zinc-100">Seller Defaults (Tokens)</h3>
            <p className="text-sm text-zinc-400">
              If TGE deadline expires without seller depositing tokens, buyer can claim seller&apos;s collateral (2x their payment back).
            </p>
          </div>
        </div>

        <div className="mt-4 border rounded-lg p-4" style={{ backgroundColor: '#121218', borderColor: '#2b2b30' }}>
          <p className="text-sm text-zinc-300">
            <strong>⚖️ Economic Incentive:</strong> Since both parties have &ldquo;skin in the game,&rdquo; it&apos;s economically 
            irrational to default. Honest behavior is always more profitable than scamming.
          </p>
        </div>
      </Card>
        </>
      )}

      {/* Private vs Public Tab */}
      {activeTab === "private" && (
        <>
      <Card className="mb-6">
        <div className="flex items-start gap-3 mb-4">
          <Lock className="w-6 h-6 text-zinc-300 mt-1" />
          <h2 className="text-2xl font-bold">Private vs Public Orders</h2>
        </div>
        <p className="text-zinc-300 leading-relaxed mb-6">
          otcX offers two types of orders: <strong className="text-zinc-100">Private Orders</strong> and <strong className="text-zinc-100">Public Orders</strong>. 
          Each serves different use cases and provides different levels of visibility and control.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Public Orders */}
          <div className="border rounded-lg p-5" style={{ backgroundColor: '#121218', borderColor: '#2b2b30' }}>
            <div className="flex items-center gap-2 mb-4">
              <Globe className="w-5 h-5 text-zinc-300" />
              <h3 className="text-xl font-semibold text-zinc-100">Public Orders</h3>
            </div>
            
            <p className="text-sm text-zinc-400 mb-4">
              Public orders are visible to everyone and can be taken by anyone on the platform.
            </p>

            <div className="space-y-3">
              <div className="flex items-start gap-2">
                <CheckCircle className="w-4 h-4 text-green-400 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-white">Visible in Orderbook</p>
                  <p className="text-xs text-zinc-400">Appears in the public markets page for all users to see</p>
                </div>
              </div>

              <div className="flex items-start gap-2">
                <CheckCircle className="w-4 h-4 text-green-400 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-white">Anyone Can Take</p>
                  <p className="text-xs text-zinc-400">Any user can fill your order on a first-come, first-served basis</p>
                </div>
              </div>

              <div className="flex items-start gap-2">
                <CheckCircle className="w-4 h-4 text-green-400 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-white">Maximum Liquidity</p>
                  <p className="text-xs text-zinc-400">Higher chance of order being filled quickly</p>
                </div>
              </div>

              <div className="flex items-start gap-2">
                <CheckCircle className="w-4 h-4 text-green-400 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-white">Price Discovery</p>
                  <p className="text-xs text-zinc-400">Contributes to market price discovery and transparency</p>
                </div>
              </div>
            </div>

            <div className="mt-4 p-3 border rounded-lg" style={{ backgroundColor: '#121218', borderColor: '#2b2b30' }}>
              <p className="text-xs text-zinc-300">
                <strong>Best for:</strong> Traders looking for quick fills, market makers, and anyone comfortable with public visibility
              </p>
            </div>
          </div>

          {/* Private Orders */}
          <div className="border rounded-lg p-5" style={{ backgroundColor: '#121218', borderColor: '#2b2b30' }}>
            <div className="flex items-center gap-2 mb-4">
              <Lock className="w-5 h-5 text-zinc-300" />
              <h3 className="text-xl font-semibold text-zinc-100">Private Orders</h3>
            </div>
            
            <p className="text-sm text-zinc-400 mb-4">
              Private orders are created for a specific counterparty and are not visible in the public orderbook.
            </p>

            <div className="space-y-3">
              <div className="flex items-start gap-2">
                <CheckCircle className="w-4 h-4 text-green-400 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-white">Not in Public Orderbook</p>
                  <p className="text-xs text-zinc-400">Order is hidden from the markets page and not visible to other users</p>
                </div>
              </div>

              <div className="flex items-start gap-2">
                <CheckCircle className="w-4 h-4 text-green-400 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-white">Specific Counterparty</p>
                  <p className="text-xs text-zinc-400">Only the wallet address you specify can take the order</p>
                </div>
              </div>

              <div className="flex items-start gap-2">
                <CheckCircle className="w-4 h-4 text-green-400 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-white">Shareable Link</p>
                  <p className="text-xs text-zinc-400">Generate a unique URL to share with your intended counterparty</p>
                </div>
              </div>

              <div className="flex items-start gap-2">
                <CheckCircle className="w-4 h-4 text-green-400 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-white">On-Chain Enforcement</p>
                  <p className="text-xs text-zinc-400">Privacy is enforced by the smart contract, not just the UI</p>
                </div>
              </div>
            </div>

            <div className="mt-4 p-3 border rounded-lg" style={{ backgroundColor: '#121218', borderColor: '#2b2b30' }}>
              <p className="text-xs text-zinc-300">
                <strong>Best for:</strong> OTC deals, pre-negotiated trades, privacy-conscious users, and specific counterparty agreements
              </p>
            </div>
          </div>
        </div>
      </Card>

      {/* How Private Orders Work */}
      <Card className="mb-6">
        <div className="flex items-start gap-3 mb-4">
          <Zap className="w-6 h-6 text-zinc-300 mt-1" />
          <h2 className="text-2xl font-bold">How Private Orders Work</h2>
        </div>
        
        <div className="space-y-5">
          {/* Step 1 */}
          <div className="flex gap-4">
            <div className="flex-shrink-0">
              <div className="w-8 h-8 rounded border flex items-center justify-center font-bold text-sm text-zinc-300" style={{ backgroundColor: '#121218', borderColor: '#2b2b30' }}>
                1
              </div>
            </div>
            <div className="flex-1">
              <h3 className="text-base font-semibold mb-2">Create Private Order</h3>
              <p className="text-zinc-400 text-sm">
                Navigate to the <strong className="text-zinc-100">Private Orders</strong> page, select your project, 
                enter the order details, and specify the wallet address of your intended counterparty.
              </p>
            </div>
          </div>

          {/* Step 2 */}
          <div className="flex gap-4">
            <div className="flex-shrink-0">
              <div className="w-8 h-8 rounded border flex items-center justify-center font-bold text-sm text-zinc-300" style={{ backgroundColor: '#121218', borderColor: '#2b2b30' }}>
                2
              </div>
            </div>
            <div className="flex-1">
              <h3 className="text-base font-semibold mb-2">Share the Link</h3>
              <p className="text-zinc-400 text-sm mb-2">
                After creating the order, you'll receive a unique shareable URL. Send this link to your counterparty via:
              </p>
              <div className="space-y-1 text-sm ml-4">
                <div className="flex items-center gap-2">
                  <div className="w-1 h-1 bg-zinc-400 rounded-full"></div>
                  <span className="text-zinc-400">Telegram, Discord, or other messaging apps</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-1 h-1 bg-zinc-400 rounded-full"></div>
                  <span className="text-zinc-400">Email (though less secure)</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-1 h-1 bg-zinc-400 rounded-full"></div>
                  <span className="text-zinc-400">Any secure communication channel</span>
                </div>
              </div>
            </div>
          </div>

          {/* Step 3 */}
          <div className="flex gap-4">
            <div className="flex-shrink-0">
              <div className="w-8 h-8 rounded border flex items-center justify-center font-bold text-sm text-zinc-300" style={{ backgroundColor: '#121218', borderColor: '#2b2b30' }}>
                3
              </div>
            </div>
            <div className="flex-1">
              <h3 className="text-base font-semibold mb-2">Counterparty Takes Order</h3>
              <p className="text-zinc-400 text-sm">
                Your counterparty opens the link, connects their wallet, and if they're the authorized address, 
                they can take the order. The smart contract verifies their wallet address on-chain.
              </p>
            </div>
          </div>

          {/* Step 4 */}
          <div className="flex gap-4">
            <div className="flex-shrink-0">
              <div className="w-8 h-8 rounded border flex items-center justify-center font-bold text-sm text-zinc-300" style={{ backgroundColor: '#121218', borderColor: '#2b2b30' }}>
                4
              </div>
            </div>
            <div className="flex-1">
              <h3 className="text-base font-semibold mb-2">Settlement</h3>
              <p className="text-zinc-400 text-sm">
                Once taken, private orders follow the same settlement process as public orders - both parties lock collateral, 
                and settlement happens according to the asset type (Tokens or Points).
              </p>
            </div>
          </div>
        </div>
      </Card>

      {/* Key Differences */}
      <Card className="mb-6">
        <div className="flex items-start gap-3 mb-4">
          <Shield className="w-6 h-6 text-zinc-300 mt-1" />
          <h2 className="text-2xl font-bold">Key Differences</h2>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-800">
                <th className="text-left py-3 px-4 text-zinc-400 font-semibold">Feature</th>
                <th className="text-left py-3 px-4 text-zinc-100 font-semibold">Public Orders</th>
                <th className="text-left py-3 px-4 text-zinc-100 font-semibold">Private Orders</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-zinc-800/50">
                <td className="py-3 px-4 text-zinc-300 font-medium">Visibility</td>
                <td className="py-3 px-4 text-zinc-400">Visible to everyone</td>
                <td className="py-3 px-4 text-zinc-400">Hidden from orderbook</td>
              </tr>
              <tr className="border-b border-zinc-800/50">
                <td className="py-3 px-4 text-zinc-300 font-medium">Who Can Take</td>
                <td className="py-3 px-4 text-zinc-400">Anyone</td>
                <td className="py-3 px-4 text-zinc-400">Specific wallet only</td>
              </tr>
              <tr className="border-b border-zinc-800/50">
                <td className="py-3 px-4 text-zinc-300 font-medium">Access Method</td>
                <td className="py-3 px-4 text-zinc-400">Browse markets page</td>
                <td className="py-3 px-4 text-zinc-400">Shareable link</td>
              </tr>
              <tr className="border-b border-zinc-800/50">
                <td className="py-3 px-4 text-zinc-300 font-medium">Privacy</td>
                <td className="py-3 px-4 text-zinc-400">Fully public</td>
                <td className="py-3 px-4 text-zinc-400">Counterparty privacy</td>
              </tr>
              <tr className="border-b border-zinc-800/50">
                <td className="py-3 px-4 text-zinc-300 font-medium">Settlement</td>
                <td className="py-3 px-4 text-zinc-400">Same process</td>
                <td className="py-3 px-4 text-zinc-400">Same process</td>
              </tr>
              <tr className="border-b border-zinc-800/50">
                <td className="py-3 px-4 text-zinc-300 font-medium">Fees</td>
                <td className="py-3 px-4 text-zinc-400">Same fees</td>
                <td className="py-3 px-4 text-zinc-400">Same fees</td>
              </tr>
              <tr>
                <td className="py-3 px-4 text-zinc-300 font-medium">Use Case</td>
                <td className="py-3 px-4 text-zinc-400">Market trading</td>
                <td className="py-3 px-4 text-zinc-400">OTC deals</td>
              </tr>
            </tbody>
          </table>
        </div>
      </Card>
        </>
      )}

      {/* Risks Tab */}
      {activeTab === "risks" && (
        <>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        {/* Risks */}
        <Card className="h-full">
          <div className="flex items-start gap-3 mb-4">
            <AlertTriangle className="w-6 h-6 text-red-400 mt-1" />
            <h2 className="text-2xl font-bold text-red-400">Risks & Limitations</h2>
          </div>
          
          <div className="space-y-3">
            <div className="bg-zinc-900/50 rounded-lg p-3 border border-zinc-800">
              <h3 className="text-sm font-semibold mb-1">1. Smart Contract Risk</h3>
              <p className="text-xs text-zinc-400">
                All smart contracts carry inherent risks. Bugs or exploits could result in loss of funds. Use at your own risk.
              </p>
            </div>

            <div className="bg-zinc-900/50 rounded-lg p-3 border border-zinc-800">
              <h3 className="text-sm font-semibold mb-1">2. Off-Chain Settlement (Points)</h3>
              <p className="text-xs text-zinc-400">
                For Points assets, the actual transfer happens off-chain. Requires trust in the admin verification process.
              </p>
            </div>

            <div className="bg-zinc-900/50 rounded-lg p-3 border border-zinc-800">
              <h3 className="text-sm font-semibold mb-1">3. No Pre-TGE Token Guarantees</h3>
              <p className="text-xs text-zinc-400 mb-1">
                Pre-TGE tokens and points are promises of future tokens. No guarantee that:
              </p>
              <ul className="space-y-0.5 text-xs text-zinc-500 ml-4">
                <li>• The project will ever issue tokens (TGE may never happen)</li>
                <li>• Points will be convertible to tokens at any specific rate</li>
                <li>• The tokens will have any market value</li>
              </ul>
            </div>

            <div className="bg-zinc-900/50 rounded-lg p-3 border border-zinc-800">
              <h3 className="text-sm font-semibold mb-1">4. Liquidity Risk</h3>
              <p className="text-xs text-zinc-400">
                Orders may take time to fill. There&apos;s no guarantee someone will take your order at your desired price.
              </p>
            </div>

            <div className="bg-zinc-900/50 rounded-lg p-3 border border-zinc-800">
              <h3 className="text-sm font-semibold mb-1">5. Regulatory Risk</h3>
              <p className="text-xs text-zinc-400">
                Trading pre-TGE tokens may be subject to securities laws in your jurisdiction. Ensure you comply with all applicable regulations.
              </p>
            </div>
          </div>
        </Card>

        {/* Best Practices */}
        <Card className="h-full">
          <div className="flex items-start gap-3 mb-4">
            <CheckCheck className="w-6 h-6 text-green-400 mt-1" />
            <h2 className="text-2xl font-bold text-green-400">Best Practices</h2>
          </div>
          
          <div className="space-y-3">
            <div className="flex items-start gap-3 bg-zinc-900/30 rounded-lg p-3 border border-zinc-800">
              <CheckCircle className="w-4 h-4 text-green-400 flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="text-sm font-semibold mb-1">Verify Counterparty Identity</h3>
                <p className="text-xs text-zinc-400">
                  Before trading, communicate with your counterparty via Telegram/Discord. Check their reputation and trade history if possible.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3 bg-zinc-900/30 rounded-lg p-3 border border-zinc-800">
              <CheckCircle className="w-4 h-4 text-green-400 flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="text-sm font-semibold mb-1">Double-Check Addresses</h3>
                <p className="text-xs text-zinc-400">
                  Confirm the recipient wallet address multiple times before sending tokens/points. One mistake could result in permanent loss.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3 bg-zinc-900/30 rounded-lg p-3 border border-zinc-800">
              <CheckCircle className="w-4 h-4 text-green-400 flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="text-sm font-semibold mb-1">Start Small</h3>
                <p className="text-xs text-zinc-400">
                  For your first trades, start with smaller amounts to get comfortable with the process.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3 bg-zinc-900/30 rounded-lg p-3 border border-zinc-800">
              <CheckCircle className="w-4 h-4 text-green-400 flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="text-sm font-semibold mb-1">Document Everything</h3>
                <p className="text-xs text-zinc-400">
                  Take screenshots of your communications, transaction hashes, and order details. This helps resolve disputes if they arise.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3 bg-zinc-900/30 rounded-lg p-3 border border-zinc-800">
              <CheckCircle className="w-4 h-4 text-green-400 flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="text-sm font-semibold mb-1">Research the Project</h3>
                <p className="text-xs text-zinc-400">
                  Do your own research on the project before trading. Check their team, roadmap, community engagement, and tokenomics.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3 bg-zinc-900/30 rounded-lg p-3 border border-zinc-800">
              <CheckCircle className="w-4 h-4 text-green-400 flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="text-sm font-semibold mb-1">Understand the Risks</h3>
                <p className="text-xs text-zinc-400">
                  Never trade more than you can afford to lose. Pre-TGE trading is highly speculative and carries significant risk.
                </p>
              </div>
            </div>
          </div>
        </Card>
      </div>
        </>
      )}

      {/* FAQ Tab */}
      {activeTab === "faq" && (
        <>
      <Card className="mb-6">
        <div className="flex items-start gap-3 mb-4">
          <HelpCircle className="w-6 h-6 text-zinc-300 mt-1" />
          <h2 className="text-2xl font-bold">Frequently Asked Questions</h2>
        </div>
        
        <div className="space-y-4">
          <div className="bg-zinc-900/30 rounded-lg p-3 border border-zinc-800">
            <h3 className="text-sm font-semibold mb-1.5">Why do I need to lock collateral as a seller?</h3>
            <p className="text-xs text-zinc-400">
              Collateral ensures you have &ldquo;skin in the game.&rdquo; It prevents sellers from creating orders without 
              intention to fulfill them and provides compensation to buyers if you default.
            </p>
          </div>

          <div className="bg-zinc-900/30 rounded-lg p-3 border border-zinc-800">
            <h3 className="text-sm font-semibold mb-1.5">Can I cancel my order?</h3>
            <p className="text-xs text-zinc-400">
              Yes, you can cancel your order at any time before someone takes it. Once someone locks their 
              funds to take your order, it cannot be cancelled.
            </p>
          </div>

          <div className="bg-zinc-900/30 rounded-lg p-3 border border-zinc-800">
            <h3 className="text-sm font-semibold mb-1.5">What&apos;s the difference between Tokens and Points?</h3>
            <p className="text-xs text-zinc-400">
              <strong className="text-blue-400">Tokens</strong> settle on-chain via smart contract after TGE. 
              <strong className="text-purple-400"> Points</strong> settle off-chain with proof submission and admin verification.
            </p>
          </div>

          <div className="bg-zinc-900/30 rounded-lg p-3 border border-zinc-800">
            <h3 className="text-sm font-semibold mb-1.5">What stablecoin is used?</h3>
            <p className="text-xs text-zinc-400">
              Currently otcX uses USDC on Sepolia testnet. All prices and collateral are denominated in USDC.
            </p>
          </div>

          <div className="bg-zinc-900/30 rounded-lg p-3 border border-zinc-800">
            <h3 className="text-sm font-semibold mb-1.5">Are there any fees?</h3>
            <p className="text-xs text-zinc-400 mb-2">
              otcX charges minimal protocol fees to sustain development and operations:
            </p>
            <ul className="space-y-1 text-xs text-zinc-400 ml-4">
              <li className="flex items-start gap-2">
                <div className="w-1 h-1 bg-zinc-400 rounded-full mt-1.5"></div>
                <span><strong className="text-zinc-100">Settlement Fee:</strong> Currently {settlementFee}% from both buyer and seller when the trade settles</span>
              </li>
              <li className="flex items-start gap-2">
                <div className="w-1 h-1 bg-zinc-400 rounded-full mt-1.5"></div>
                <span><strong className="text-zinc-100">Cancellation Fee:</strong> Currently {cancellationFee}% if you cancel an order (discourages spam)</span>
              </li>
              <li className="flex items-start gap-2">
                <div className="w-1 h-1 bg-zinc-500 rounded-full mt-1.5"></div>
                <span className="text-zinc-500">Plus Ethereum gas fees for transactions</span>
              </li>
            </ul>
            <p className="text-xs text-green-400 mt-2">
              💡 Fees are dynamic and adjustable by the protocol owner, with a maximum cap of 5% to protect users.
            </p>
          </div>

          <div className="bg-zinc-900/30 rounded-lg p-3 border border-zinc-800">
            <h3 className="text-sm font-semibold mb-1.5">Is this audited?</h3>
            <p className="text-xs text-zinc-400">
              The smart contracts have been tested but have not undergone a formal third-party audit. 
              Use at your own risk. The code is open source and available for review.
            </p>
          </div>
        </div>
      </Card>
        </>
      )}

      {/* Disclaimer - Show on all tabs */}
      <Card className="bg-red-950/20 border-red-800/50 mt-6">
        <div className="flex items-start gap-3 mb-3">
          <AlertTriangle className="w-6 h-6 text-red-400 mt-1" />
          <h2 className="text-xl font-bold text-red-400">Important Disclaimer</h2>
        </div>
        <p className="text-sm text-zinc-300 leading-relaxed mb-3">
          otcX is an experimental decentralized trading protocol. By using this platform, you acknowledge that:
        </p>
        <ul className="space-y-1.5 text-sm text-zinc-400">
          <li className="flex items-start gap-2">
            <div className="w-1 h-1 bg-red-400 rounded-full mt-2"></div>
            <span>You are trading at your own risk</span>
          </li>
          <li className="flex items-start gap-2">
            <div className="w-1 h-1 bg-red-400 rounded-full mt-2"></div>
            <span>Pre-TGE tokens may never materialize or have value</span>
          </li>
          <li className="flex items-start gap-2">
            <div className="w-1 h-1 bg-red-400 rounded-full mt-2"></div>
            <span>Smart contracts may contain bugs or vulnerabilities</span>
          </li>
          <li className="flex items-start gap-2">
            <div className="w-1 h-1 bg-red-400 rounded-full mt-2"></div>
            <span>There is no central authority to resolve disputes</span>
          </li>
          <li className="flex items-start gap-2">
            <div className="w-1 h-1 bg-red-400 rounded-full mt-2"></div>
            <span>You may lose all funds locked in the contract</span>
          </li>
          <li className="flex items-start gap-2">
            <div className="w-1 h-1 bg-red-400 rounded-full mt-2"></div>
            <span>This is not financial advice</span>
          </li>
          <li className="flex items-start gap-2">
            <div className="w-1 h-1 bg-red-400 rounded-full mt-2"></div>
            <span>You are responsible for complying with your local laws and regulations</span>
          </li>
        </ul>
        <p className="text-sm text-red-400 mt-4 font-semibold">
          USE AT YOUR OWN RISK. DO YOUR OWN RESEARCH.
        </p>
      </Card>
      </div>
    </div>
  );
}
