"use client";

import { useState, useEffect } from "react";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { 
  BookOpen, 
  Code, 
  Shield, 
  Zap,
  Users,
  Lock,
  FileText,
  Settings,
  AlertTriangle,
  CheckCircle,
  Coins,
  GitBranch,
  Globe,
  Terminal,
  Database,
  Cpu
} from "lucide-react";
import { usePublicClient, useReadContract, useBlockNumber } from "wagmi";
import { ORDERBOOK_ADDRESS, REGISTRY_ADDRESS, ESCROW_ORDERBOOK_ABI } from "@/lib/contracts";
import { sepolia } from "viem/chains";

export default function DocsPage() {
  const [activeSection, setActiveSection] = useState<string>("architecture");
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
  
  // Fetch dynamic contract data
  const { data: settlementFeeBps } = useReadContract({
    address: ORDERBOOK_ADDRESS,
    abi: ESCROW_ORDERBOOK_ABI,
    functionName: "settlementFeeBps",
  });

  const { data: cancellationFeeBps } = useReadContract({
    address: ORDERBOOK_ADDRESS,
    abi: ESCROW_ORDERBOOK_ABI,
    functionName: "cancellationFeeBps",
  });

  const { data: stableAddress } = useReadContract({
    address: ORDERBOOK_ADDRESS,
    abi: ESCROW_ORDERBOOK_ABI,
    functionName: "stable",
  });

  const { data: registryOwner } = useReadContract({
    address: REGISTRY_ADDRESS,
    abi: [{ "inputs": [], "name": "owner", "outputs": [{ "internalType": "address", "name": "", "type": "address" }], "stateMutability": "view", "type": "function" }],
    functionName: "owner",
  });

  // Convert basis points to percentage
  const settlementFeePercent = settlementFeeBps ? (Number(settlementFeeBps) / 100).toFixed(2) : "0.50";
  const cancellationFeePercent = cancellationFeeBps ? (Number(cancellationFeeBps) / 100).toFixed(2) : "0.10";

  const sections = [
    { id: "architecture", label: "Architecture", icon: GitBranch },
    { id: "contracts", label: "Smart Contracts", icon: Code },
    { id: "orderflow", label: "Order Flow", icon: Zap },
    { id: "settlement", label: "Settlement", icon: CheckCircle },
    { id: "security", label: "Security", icon: Shield },
    { id: "api", label: "Integration", icon: Terminal },
  ];

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
              <span className="text-zinc-300/70 text-xs mb-1 block">otcX://protocol/documentation/technical-docs</span>
              <h1 className="text-2xl md:text-3xl font-bold text-white tracking-tight break-words">
                TECHNICAL_DOCUMENTATION
              </h1>
              <p className="text-xs text-zinc-300/70 mt-1 break-words">
                Developer Reference • Integration Guide
              </p>
            </div>
          </div>
          <div className="flex flex-col gap-2 items-end flex-shrink-0">
            <div className="flex items-center gap-2 text-xs whitespace-nowrap">
              <span className="text-zinc-300">
                {ORDERBOOK_ADDRESS.slice(0, 6)}...{ORDERBOOK_ADDRESS.slice(-4)}
              </span>
              <Database className="w-3 h-3 text-zinc-300 flex-shrink-0" />
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

      {/* Navigation */}
      <div className="mb-6 overflow-x-auto">
        <div className="flex items-center gap-2 border-b min-w-max" style={{ borderColor: '#2b2b30' }}>
          {sections.map((section) => {
            const Icon = section.icon;
            return (
              <button
                key={section.id}
                onClick={() => setActiveSection(section.id)}
                className={`px-4 py-2 text-xs font-mono font-medium transition-all relative flex items-center gap-2 ${
                  activeSection === section.id
                    ? "text-zinc-300"
                    : "text-zinc-400 hover:text-zinc-300"
                }`}
              >
                <Icon className="w-4 h-4" />
                {section.label.toUpperCase()}
                {activeSection === section.id && (
                  <div className="absolute bottom-0 left-0 right-0 h-0.5" style={{ backgroundColor: '#2b2b30' }}></div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Architecture Section */}
      {activeSection === "architecture" && (
        <>
          <Card className="mb-6">
            <div className="flex items-start gap-3 mb-4">
              <GitBranch className="w-6 h-6 text-zinc-300 mt-1" />
              <h2 className="text-2xl font-bold">System Architecture</h2>
            </div>
            <p className="text-zinc-300 mb-6">
              otcX is built on a dual-contract architecture: a Registry for project metadata and an OrderBook for trading logic.
            </p>

            <div className="space-y-6">
              {/* Contract Overview */}
              <div>
                <h3 className="text-lg font-semibold mb-3 text-zinc-100">Core Contracts</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-zinc-900/50 border border-zinc-800 rounded-lg p-4">
                    <h4 className="font-semibold mb-2 flex items-center gap-2">
                      <FileText className="w-4 h-4 text-zinc-300" />
                      ProjectRegistryV2
                    </h4>
                    <p className="text-sm text-zinc-400 mb-3">
                      Manages project listings, metadata, and TGE activation state.
                    </p>
                    <div className="space-y-1 text-xs">
                      <div className="flex items-center gap-2">
                        <div className="w-1 h-1 bg-cyan-400 rounded-full"></div>
                        <span className="text-zinc-400">Project registration</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-1 h-1 bg-cyan-400 rounded-full"></div>
                        <span className="text-zinc-400">Metadata storage (IPFS)</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-1 h-1 bg-cyan-400 rounded-full"></div>
                        <span className="text-zinc-400">Status management</span>
                      </div>
                    </div>
                  </div>

                  <div className="bg-zinc-900/50 border border-zinc-800 rounded-lg p-4">
                    <h4 className="font-semibold mb-2 flex items-center gap-2">
                      <Code className="w-4 h-4 text-zinc-300" />
                      EscrowOrderBookV4
                    </h4>
                    <p className="text-sm text-zinc-400 mb-3">
                      Handles order creation, matching, collateral escrow, and settlement.
                    </p>
                    <div className="space-y-1 text-xs">
                      <div className="flex items-center gap-2">
                        <div className="w-1 h-1 bg-cyan-400 rounded-full"></div>
                        <span className="text-zinc-400">Order lifecycle management</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-1 h-1 bg-cyan-400 rounded-full"></div>
                        <span className="text-zinc-400">Collateral escrow (USDC)</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-1 h-1 bg-cyan-400 rounded-full"></div>
                        <span className="text-zinc-400">Dual settlement paths</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Data Flow */}
              <div>
                <h3 className="text-lg font-semibold mb-3 text-zinc-100">Data Flow</h3>
                <div className="bg-zinc-900/30 border border-zinc-800 rounded-lg p-4">
                  <pre className="text-xs text-zinc-300 overflow-x-auto">
{`Registry                    OrderBook                    Frontend
   │                           │                            │
   │  ┌─ getProject() ─────────┤                            │
   │  │                        │                            │
   │  │  ┌─ createOrder() ─────┼─── validates projectId ───┤
   │  │  │                     │                            │
   │  │  │  ┌─ takeOrder() ────┼─── locks collateral ──────┤
   │  │  │  │                  │                            │
   │  └──┼──┼─ TGE activated ──┤                            │
   │     │  │                  │                            │
   │     │  └─ settleOrder() ──┼─── distributes funds ─────┤
   │     │                     │                            │
   └─────┴─────────────────────┴────────────────────────────┘`}
                  </pre>
                </div>
              </div>
            </div>
          </Card>

          {/* Network Info */}
          <Card className="mb-6">
            <div className="flex items-start gap-3 mb-4">
              <Globe className="w-6 h-6 text-zinc-300 mt-1" />
              <h2 className="text-2xl font-bold">Deployment Information</h2>
            </div>
            
            <div className="space-y-4">
              <div className="bg-zinc-900/30 border border-zinc-800 rounded-lg p-4">
                <h3 className="font-semibold mb-2 flex items-center gap-2">
                  <Badge className="bg-orange-600">Testnet</Badge>
                  <span>Sepolia</span>
                </h3>
                <div className="space-y-2 text-sm">
                  <div className="flex items-start gap-2">
                    <span className="text-zinc-400 min-w-[140px]">Registry:</span>
                    <code className="text-zinc-300 text-xs bg-zinc-900/50 px-2 py-1 rounded break-all">
                      {REGISTRY_ADDRESS}
                    </code>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="text-zinc-400 min-w-[140px]">OrderBook:</span>
                    <code className="text-zinc-300 text-xs bg-zinc-900/50 px-2 py-1 rounded break-all">
                      {ORDERBOOK_ADDRESS}
                    </code>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="text-zinc-400 min-w-[140px]">Stablecoin:</span>
                    <code className="text-zinc-300 text-xs bg-zinc-900/50 px-2 py-1 rounded break-all">
                      {stableAddress || 'Loading...'}
                    </code>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="text-zinc-400 min-w-[140px]">Registry Owner:</span>
                    <code className="text-zinc-300 text-xs bg-zinc-900/50 px-2 py-1 rounded break-all">
                      {registryOwner || 'Loading...'}
                    </code>
                  </div>
                </div>
              </div>

              <div className="bg-yellow-950/20 border border-yellow-800/50 rounded-lg p-4">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="w-5 h-5 text-yellow-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm text-yellow-200 font-semibold mb-1">Testnet Only</p>
                    <p className="text-xs text-zinc-400">
                      Currently deployed on Sepolia testnet. Mainnet deployment coming soon.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </Card>
        </>
      )}

      {/* Smart Contracts Section */}
      {activeSection === "contracts" && (
        <>
          <Card className="mb-6">
            <div className="flex items-start gap-3 mb-4">
              <Code className="w-6 h-6 text-zinc-300 mt-1" />
              <h2 className="text-2xl font-bold">Smart Contract Reference</h2>
            </div>

            {/* EscrowOrderBookV4 */}
            <div className="mb-8">
              <h3 className="text-xl font-semibold mb-4 text-zinc-100">EscrowOrderBookV4</h3>
              
              {/* Key Functions */}
              <div className="space-y-4">
                <div className="bg-zinc-900/30 border border-zinc-800 rounded-lg p-4">
                  <h4 className="font-semibold mb-2 font-mono text-sm text-zinc-100">createOrder()</h4>
                  <p className="text-sm text-zinc-400 mb-3">
                    Creates a new buy or sell order and locks maker's collateral.
                  </p>
                  <div className="bg-zinc-950/50 rounded p-3 mb-3">
                    <pre className="text-xs text-zinc-300 overflow-x-auto">
{`function createOrder(
    bytes32 projectId,
    uint256 tokenAmount,
    uint256 unitPrice,
    bool isBuyOrder,
    uint256 expiryTimestamp,
    address allowedTaker  // 0x0 for public, address for private
) external`}
                    </pre>
                  </div>
                  <div className="text-xs text-zinc-400 space-y-1">
                    <div className="flex items-start gap-2">
                      <span className="text-zinc-400 min-w-[80px]">Collateral:</span>
                      <span>Seller locks tokenAmount × unitPrice, Buyer locks tokenAmount × unitPrice</span>
                    </div>
                    <div className="flex items-start gap-2">
                      <span className="text-zinc-400 min-w-[80px]">Emits:</span>
                      <code className="text-zinc-300">OrderCreated</code>
                    </div>
                  </div>
                </div>

                <div className="bg-zinc-900/30 border border-zinc-800 rounded-lg p-4">
                  <h4 className="font-semibold mb-2 font-mono text-sm text-zinc-100">takeOrder()</h4>
                  <p className="text-sm text-zinc-400 mb-3">
                    Fills an existing order and locks taker's collateral.
                  </p>
                  <div className="bg-zinc-950/50 rounded p-3 mb-3">
                    <pre className="text-xs text-zinc-300 overflow-x-auto">
{`function takeOrder(uint256 orderId) external`}
                    </pre>
                  </div>
                  <div className="text-xs text-zinc-400 space-y-1">
                    <div className="flex items-start gap-2">
                      <span className="text-zinc-400 min-w-[80px]">Validation:</span>
                      <span>Checks allowedTaker (if private), order status, expiry</span>
                    </div>
                    <div className="flex items-start gap-2">
                      <span className="text-zinc-400 min-w-[80px]">Emits:</span>
                      <code className="text-zinc-300">OrderTaken</code>
                    </div>
                  </div>
                </div>

                <div className="bg-zinc-900/30 border border-zinc-800 rounded-lg p-4">
                  <h4 className="font-semibold mb-2 font-mono text-sm text-zinc-100">settleOrder()</h4>
                  <p className="text-sm text-zinc-400 mb-3">
                    For Token projects: seller deposits actual tokens on-chain, buyer claims tokens, funds distributed.
                  </p>
                  <div className="bg-zinc-950/50 rounded p-3 mb-3">
                    <pre className="text-xs text-zinc-300 overflow-x-auto">
{`function settleOrder(
    uint256 orderId,
    uint256 actualTokenAmount
) external`}
                    </pre>
                  </div>
                  <div className="text-xs text-zinc-400 space-y-1">
                    <div className="flex items-start gap-2">
                      <span className="text-zinc-400 min-w-[80px]">Only:</span>
                      <span>Seller (for Token projects only)</span>
                    </div>
                    <div className="flex items-start gap-2">
                      <span className="text-zinc-400 min-w-[80px]">Fee:</span>
                      <span>{settlementFeePercent}% from both sides (buyer: USDC, seller: tokens)</span>
                    </div>
                  </div>
                </div>

                <div className="bg-zinc-900/30 border border-zinc-800 rounded-lg p-4">
                  <h4 className="font-semibold mb-2 font-mono text-sm text-zinc-100">acceptProof() / settleOrderManual()</h4>
                  <p className="text-sm text-zinc-400 mb-3">
                    For Points projects: seller submits off-chain proof → admin accepts → permissionless settlement.
                  </p>
                  <div className="bg-zinc-950/50 rounded p-3 mb-3">
                    <pre className="text-xs text-zinc-300 overflow-x-auto">
{`// 1. Seller submits proof
function submitProof(uint256 orderId, string proof) external

// 2. Admin accepts proof
function acceptProof(uint256 orderId) external onlyOwner

// 3. Anyone settles
function settleOrderManual(uint256 orderId) external`}
                    </pre>
                  </div>
                  <div className="text-xs text-zinc-400 space-y-1">
                    <div className="flex items-start gap-2">
                      <span className="text-zinc-400 min-w-[80px]">Security:</span>
                      <span>Cannot settle without admin approval; cannot cancel after approval</span>
                    </div>
                    <div className="flex items-start gap-2">
                      <span className="text-zinc-400 min-w-[80px]">Deadline:</span>
                      <span>Must accept & settle before project settlement deadline</span>
                    </div>
                  </div>
                </div>

                <div className="bg-zinc-900/30 border border-zinc-800 rounded-lg p-4">
                  <h4 className="font-semibold mb-2 font-mono text-sm text-zinc-100">handleDefault()</h4>
                  <p className="text-sm text-zinc-400 mb-3">
                    Called by non-defaulting party after deadline to claim both deposits.
                  </p>
                  <div className="bg-zinc-950/50 rounded p-3 mb-3">
                    <pre className="text-xs text-zinc-300 overflow-x-auto">
{`function handleDefault(uint256 orderId) external`}
                    </pre>
                  </div>
                  <div className="text-xs text-zinc-400 space-y-1">
                    <div className="flex items-start gap-2">
                      <span className="text-zinc-400 min-w-[80px]">Timing:</span>
                      <span>Only callable after projectSettlementDeadline has passed</span>
                    </div>
                    <div className="flex items-start gap-2">
                      <span className="text-zinc-400 min-w-[80px]">Payout:</span>
                      <span>Caller receives both deposits (2× their locked amount)</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* ProjectRegistryV2 */}
            <div>
              <h3 className="text-xl font-semibold mb-4 text-cyan-400">ProjectRegistryV2</h3>
              
              <div className="space-y-4">
                <div className="bg-zinc-900/30 border border-zinc-800 rounded-lg p-4">
                  <h4 className="font-semibold mb-2 font-mono text-sm text-zinc-100">addProject()</h4>
                  <div className="bg-zinc-950/50 rounded p-3 mb-3">
                    <pre className="text-xs text-zinc-300 overflow-x-auto">
{`function addProject(
    string slug,          // URL-friendly identifier
    string name,          // Display name
    address tokenAddress, // ERC20 or POINTS_SENTINEL
    bool isPoints,
    string metadataURI    // IPFS hash
) external onlyOwner returns (bytes32 projectId)`}
                    </pre>
                  </div>
                </div>

                <div className="bg-zinc-900/30 border border-zinc-800 rounded-lg p-4">
                  <h4 className="font-semibold mb-2 font-mono text-sm text-zinc-100">getProject()</h4>
                  <div className="bg-zinc-950/50 rounded p-3 mb-3">
                    <pre className="text-xs text-zinc-300 overflow-x-auto">
{`function getProject(bytes32 projectId) 
    external view returns (Project memory)`}
                    </pre>
                  </div>
                </div>
              </div>
            </div>
          </Card>
        </>
      )}

      {/* Order Flow Section */}
      {activeSection === "orderflow" && (
        <>
          <Card className="mb-6">
            <div className="flex items-start gap-3 mb-4">
              <Zap className="w-6 h-6 text-cyan-400 mt-1" />
              <h2 className="text-2xl font-bold">Order Lifecycle</h2>
            </div>

            <div className="space-y-6">
              {/* State Machine */}
              <div>
                <h3 className="text-lg font-semibold mb-3 text-cyan-400">Order States</h3>
                <div className="bg-zinc-900/30 border border-zinc-800 rounded-lg p-4">
                  <pre className="text-xs text-zinc-300 overflow-x-auto">
{`enum Status {
    OPEN,       // Created, waiting for taker
    FUNDED,     // Both parties locked collateral
    SETTLED,    // Trade complete, funds distributed
    CANCELLED,  // Cancelled before being taken
    DEFAULTED   // Deadline passed, default claimed
}`}
                  </pre>
                </div>
              </div>

              {/* Flow Diagram */}
              <div>
                <h3 className="text-lg font-semibold mb-3 text-cyan-400">State Transitions</h3>
                <div className="bg-zinc-900/30 border border-zinc-800 rounded-lg p-4">
                  <pre className="text-xs text-zinc-300 overflow-x-auto">
{`                    ┌─────────────────────────────────┐
                    │     createOrder()               │
                    │  (maker locks collateral)       │
                    └────────────┬────────────────────┘
                                 │
                                 ▼
                         ┌───────────────┐
                    ┌────│     OPEN      │────┐
                    │    └───────────────┘    │
                    │                         │
           cancelOrder()              takeOrder()
          (before taken)           (taker locks collateral)
                    │                         │
                    ▼                         ▼
              ┌──────────┐            ┌──────────┐
              │ CANCELLED│            │  FUNDED  │
              └──────────┘            └────┬─────┘
                                           │
                         ┌─────────────────┼─────────────────┐
                         │                 │                 │
                  settleOrder()      settleOrderManual()  handleDefault()
                  (Token projects)   (Points projects)   (after deadline)
                         │                 │                 │
                         ▼                 ▼                 ▼
                   ┌──────────┐      ┌──────────┐      ┌──────────┐
                   │ SETTLED  │      │ SETTLED  │      │ DEFAULTED│
                   └──────────┘      └──────────┘      └──────────┘`}
                  </pre>
                </div>
              </div>

              {/* Public vs Private */}
              <div>
                <h3 className="text-lg font-semibold mb-3 text-cyan-400">Public vs Private Orders</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-cyan-950/20 border border-cyan-800/50 rounded-lg p-4">
                    <h4 className="font-semibold mb-2 flex items-center gap-2">
                      <Globe className="w-4 h-4 text-cyan-400" />
                      Public Orders
                    </h4>
                    <p className="text-sm text-zinc-400 mb-2">
                      <code className="text-cyan-400">allowedTaker = address(0)</code>
                    </p>
                    <p className="text-xs text-zinc-400">
                      Anyone can call <code className="text-purple-400">takeOrder()</code>. 
                      Visible in orderbook UI.
                    </p>
                  </div>

                  <div className="bg-purple-950/20 border border-purple-800/50 rounded-lg p-4">
                    <h4 className="font-semibold mb-2 flex items-center gap-2">
                      <Lock className="w-4 h-4 text-purple-400" />
                      Private Orders
                    </h4>
                    <p className="text-sm text-zinc-400 mb-2">
                      <code className="text-zinc-300">allowedTaker = 0xABC...</code>
                    </p>
                    <p className="text-xs text-zinc-400">
                      Only specified address can take. Access via shareable link.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </Card>
        </>
      )}

      {/* Settlement Section */}
      {activeSection === "settlement" && (
        <>
          <Card className="mb-6">
            <div className="flex items-start gap-3 mb-4">
              <CheckCircle className="w-6 h-6 text-cyan-400 mt-1" />
              <h2 className="text-2xl font-bold">Settlement Mechanisms</h2>
            </div>

            <div className="space-y-6">
              {/* Token Settlement */}
              <div className="bg-blue-950/20 border border-blue-800/50 rounded-lg p-5">
                <div className="flex items-center gap-2 mb-3">
                  <Badge className="bg-blue-500/20 text-blue-400 border border-blue-500/50">Token Projects</Badge>
                  <span className="text-lg font-semibold text-zinc-300">On-Chain Settlement</span>
                </div>
                
                <p className="text-sm text-zinc-400 mb-4">
                  Full trustless settlement via smart contract custody of actual tokens.
                </p>

                <div className="space-y-3 mb-4">
                  <div className="flex items-start gap-3">
                    <div className="w-6 h-6 bg-blue-600/20 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                      <span className="text-xs font-bold text-blue-400">1</span>
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-white">TGE Activated</p>
                      <p className="text-xs text-zinc-400">Admin calls <code className="text-purple-400">activateProjectTGE(projectId, tokenAddress, 4 hours)</code></p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <div className="w-6 h-6 bg-blue-600/20 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                      <span className="text-xs font-bold text-blue-400">2</span>
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-white">Seller Deposits Tokens</p>
                      <p className="text-xs text-zinc-400">Seller approves contract → calls <code className="text-purple-400">settleOrder(orderId, tokenAmount)</code></p>
                      <p className="text-xs text-zinc-500 mt-1">Contract takes custody of actual ERC20 tokens</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <div className="w-6 h-6 bg-blue-600/20 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                      <span className="text-xs font-bold text-blue-400">3</span>
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-white">Atomic Distribution</p>
                      <p className="text-xs text-zinc-400">Contract distributes:</p>
                      <ul className="text-xs text-zinc-500 ml-4 mt-1 space-y-0.5">
                        <li>• Buyer: receives tokens (minus {settlementFeePercent}% fee)</li>
                        <li>• Seller: receives USDC payment + collateral back (minus {settlementFeePercent}% fee)</li>
                        <li>• Fee collector: receives {settlementFeePercent}% from both sides</li>
                      </ul>
                    </div>
                  </div>
                </div>

                <div className="bg-blue-950/30 border border-blue-800/30 rounded p-3">
                  <p className="text-xs text-blue-300">
                    <strong>Trustless:</strong> Contract holds actual tokens. No manual verification needed.
                  </p>
                </div>
              </div>

              {/* Points Settlement */}
              <div className="bg-purple-950/20 border border-purple-800/50 rounded-lg p-5">
                <div className="flex items-center gap-2 mb-3">
                  <Badge className="bg-purple-500/20 text-purple-400 border border-purple-500/50">Points Projects</Badge>
                  <span className="text-lg font-semibold text-zinc-300">Proof-Based Settlement</span>
                </div>
                
                <p className="text-sm text-zinc-400 mb-4">
                  Off-chain transfer with on-chain proof verification workflow.
                </p>

                <div className="space-y-3 mb-4">
                  <div className="flex items-start gap-3">
                    <div className="w-6 h-6 bg-purple-600/20 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                      <span className="text-xs font-bold text-purple-400">1</span>
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-white">TGE Activated</p>
                      <p className="text-xs text-zinc-400">Admin calls <code className="text-purple-400">activateProjectTGE(projectId, POINTS_SENTINEL, 4 hours)</code></p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <div className="w-6 h-6 bg-purple-600/20 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                      <span className="text-xs font-bold text-purple-400">2</span>
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-white">Seller Transfers Off-Chain</p>
                      <p className="text-xs text-zinc-400">Seller sends points via project's platform/UI to buyer's account</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <div className="w-6 h-6 bg-purple-600/20 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                      <span className="text-xs font-bold text-purple-400">3</span>
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-white">Proof Submission</p>
                      <p className="text-xs text-zinc-400">Seller calls <code className="text-purple-400">submitProof(orderId, "screenshot_url")</code></p>
                      <p className="text-xs text-zinc-500 mt-1">Proof can be tx hash, screenshot, IPFS hash, etc.</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <div className="w-6 h-6 bg-purple-600/20 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                      <span className="text-xs font-bold text-purple-400">4</span>
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-white">Admin Verification</p>
                      <p className="text-xs text-zinc-400">Admin reviews proof → calls <code className="text-purple-400">acceptProof(orderId)</code></p>
                      <p className="text-xs text-zinc-500 mt-1">Or rejects with <code className="text-purple-400">rejectProof(orderId, reason)</code></p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <div className="w-6 h-6 bg-purple-600/20 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                      <span className="text-xs font-bold text-purple-400">5</span>
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-white">Permissionless Settlement</p>
                      <p className="text-xs text-zinc-400">Anyone calls <code className="text-purple-400">settleOrderManual(orderId)</code></p>
                      <p className="text-xs text-zinc-500 mt-1">Releases USDC to seller (minus {settlementFeePercent}% fee), returns collateral</p>
                    </div>
                  </div>
                </div>

                <div className="bg-purple-950/30 border border-purple-800/30 rounded p-3">
                  <p className="text-xs text-purple-300">
                    <strong>Security:</strong> Cannot settle without admin approval. Cannot cancel after approval.
                  </p>
                </div>
              </div>

              {/* Fee Structure */}
              <div>
                <h3 className="text-lg font-semibold mb-3 text-cyan-400">Fee Structure</h3>
                <div className="bg-zinc-900/30 border border-zinc-800 rounded-lg p-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <h4 className="font-semibold mb-2 text-sm">Settlement Fee: {settlementFeePercent}%</h4>
                      <p className="text-xs text-zinc-400 mb-2">Applied when trade completes:</p>
                      <ul className="text-xs text-zinc-500 space-y-1">
                        <li>• Buyer pays {settlementFeePercent}% in USDC</li>
                        <li>• Seller pays {settlementFeePercent}% in project tokens (Token projects) or USDC (Points projects)</li>
                      </ul>
                    </div>
                    <div>
                      <h4 className="font-semibold mb-2 text-sm">Cancellation Fee: {cancellationFeePercent}%</h4>
                      <p className="text-xs text-zinc-400 mb-2">Charged when cancelling unfilled order:</p>
                      <ul className="text-xs text-zinc-500 space-y-1">
                        <li>• Discourages spam orders</li>
                        <li>• Only applies to OPEN orders</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </Card>
        </>
      )}

      {/* Security Section */}
      {activeSection === "security" && (
        <>
          <Card className="mb-6">
            <div className="flex items-start gap-3 mb-4">
              <Shield className="w-6 h-6 text-cyan-400 mt-1" />
              <h2 className="text-2xl font-bold">Security Model</h2>
            </div>

            <div className="space-y-6">
              {/* Core Guarantees */}
              <div>
                <h3 className="text-lg font-semibold mb-3 text-cyan-400">Security Guarantees</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-green-950/20 border border-green-800/50 rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <CheckCircle className="w-4 h-4 text-green-400" />
                      <h4 className="font-semibold text-sm">Mutual Collateral</h4>
                    </div>
                    <p className="text-xs text-zinc-400">
                      Both parties lock equal value on-chain. Economic incentive for honest behavior.
                    </p>
                  </div>

                  <div className="bg-green-950/20 border border-green-800/50 rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <CheckCircle className="w-4 h-4 text-green-400" />
                      <h4 className="font-semibold text-sm">Reentrancy Protection</h4>
                    </div>
                    <p className="text-xs text-zinc-400">
                      All state-mutating functions use ReentrancyGuard. CEI pattern enforced.
                    </p>
                  </div>

                  <div className="bg-green-950/20 border border-green-800/50 rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <CheckCircle className="w-4 h-4 text-green-400" />
                      <h4 className="font-semibold text-sm">Balance-Delta Checks</h4>
                    </div>
                    <p className="text-xs text-zinc-400">
                      Protects against fee-on-transfer and rebasing tokens by measuring actual received amounts.
                    </p>
                  </div>

                  <div className="bg-green-950/20 border border-green-800/50 rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <CheckCircle className="w-4 h-4 text-green-400" />
                      <h4 className="font-semibold text-sm">Deadline Enforcement</h4>
                    </div>
                    <p className="text-xs text-zinc-400">
                      Hard deadlines for settlement. Non-defaulting party can claim both deposits after expiry.
                    </p>
                  </div>
                </div>
              </div>

              {/* Critical Protections */}
              <div>
                <h3 className="text-lg font-semibold mb-3 text-cyan-400">Critical Security Features</h3>
                <div className="space-y-3">
                  <div className="bg-zinc-900/30 border border-zinc-800 rounded-lg p-4">
                    <h4 className="font-semibold mb-2 text-sm flex items-center gap-2">
                      <Lock className="w-4 h-4 text-cyan-400" />
                      Points-Only Manual Settlement
                    </h4>
                    <p className="text-xs text-zinc-400 mb-2">
                      <code className="text-zinc-300">settleOrderManual()</code> strictly enforces Points projects only:
                    </p>
                    <div className="bg-zinc-950/50 rounded p-2">
                      <code className="text-xs text-zinc-300">
                        if (tokenAddress != POINTS_SENTINEL) revert InvalidStatus();
                      </code>
                    </div>
                    <p className="text-xs text-zinc-500 mt-2">
                      Prevents fund release for Token projects without on-chain token delivery.
                    </p>
                  </div>

                  <div className="bg-zinc-900/30 border border-zinc-800 rounded-lg p-4">
                    <h4 className="font-semibold mb-2 text-sm flex items-center gap-2">
                      <Lock className="w-4 h-4 text-cyan-400" />
                      Cancel Lockout After Proof Acceptance
                    </h4>
                    <p className="text-xs text-zinc-400 mb-2">
                      Once admin accepts proof, maker cannot cancel:
                    </p>
                    <div className="bg-zinc-950/50 rounded p-2">
                      <code className="text-xs text-zinc-300">
                        if (proofAccepted[orderId]) revert InvalidStatus();
                      </code>
                    </div>
                    <p className="text-xs text-zinc-500 mt-2">
                      Prevents rugpull where buyer cancels after seller delivered tokens off-chain.
                    </p>
                  </div>

                  <div className="bg-zinc-900/30 border border-zinc-800 rounded-lg p-4">
                    <h4 className="font-semibold mb-2 text-sm flex items-center gap-2">
                      <Lock className="w-4 h-4 text-cyan-400" />
                      No Extension After Deadline
                    </h4>
                    <p className="text-xs text-zinc-400 mb-2">
                      Admin cannot extend settlement deadline after it has passed:
                    </p>
                    <div className="bg-zinc-950/50 rounded p-2">
                      <code className="text-xs text-zinc-300">
                        if (block.timestamp &gt; deadline) revert DeadlinePassed();
                      </code>
                    </div>
                    <p className="text-xs text-zinc-500 mt-2">
                      Guarantees buyers can claim default refund once deadline expires.
                    </p>
                  </div>
                </div>
              </div>

              {/* Audit Status */}
              <div className="bg-yellow-950/20 border border-yellow-800/50 rounded-lg p-4">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="w-5 h-5 text-yellow-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm text-yellow-200 font-semibold mb-1">Audit Status</p>
                    <p className="text-xs text-zinc-400 mb-2">
                      Smart contracts have undergone internal security review but have NOT been audited by a third-party firm.
                    </p>
                    <p className="text-xs text-zinc-400">
                      Code is open source: <a href="https://github.com/nocliffcapital/otcx" target="_blank" rel="noopener noreferrer" className="text-cyan-400 hover:underline">github.com/nocliffcapital/otcx</a>
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </Card>
        </>
      )}

      {/* Integration Section */}
      {activeSection === "api" && (
        <>
          <Card className="mb-6">
            <div className="flex items-start gap-3 mb-4">
              <Terminal className="w-6 h-6 text-cyan-400 mt-1" />
              <h2 className="text-2xl font-bold">Integration Guide</h2>
            </div>

            <div className="space-y-6">
              {/* Web3 Setup */}
              <div>
                <h3 className="text-lg font-semibold mb-3 text-cyan-400">Web3 Setup</h3>
                <div className="bg-zinc-900/30 border border-zinc-800 rounded-lg p-4">
                  <p className="text-sm text-zinc-400 mb-3">Install dependencies:</p>
                  <div className="bg-zinc-950/50 rounded p-3 mb-3">
                    <pre className="text-xs text-zinc-300">
{`npm install viem wagmi @tanstack/react-query`}
                    </pre>
                  </div>
                  <p className="text-sm text-zinc-400 mb-3">Initialize Wagmi client:</p>
                  <div className="bg-zinc-950/50 rounded p-3">
                    <pre className="text-xs text-zinc-300 overflow-x-auto">
{`import { createConfig, http } from 'wagmi';
import { sepolia } from 'wagmi/chains';

const config = createConfig({
  chains: [sepolia],
  transports: {
    [sepolia.id]: http(),
  },
});`}
                    </pre>
                  </div>
                </div>
              </div>

              {/* Contract Interaction */}
              <div>
                <h3 className="text-lg font-semibold mb-3 text-cyan-400">Creating an Order</h3>
                <div className="bg-zinc-900/30 border border-zinc-800 rounded-lg p-4">
                  <div className="bg-zinc-950/50 rounded p-3">
                    <pre className="text-xs text-zinc-300 overflow-x-auto">
{`import { useWriteContract } from 'wagmi';

function CreateOrderButton() {
  const { writeContract } = useWriteContract();
  
  const createOrder = async () => {
    // 1. Approve USDC first
    await writeContract({
      address: STABLE_ADDRESS,
      abi: erc20Abi,
      functionName: 'approve',
      args: [ORDERBOOK_ADDRESS, collateralAmount],
    });
    
    // 2. Create order
    await writeContract({
      address: ORDERBOOK_ADDRESS,
      abi: ESCROW_ORDERBOOK_ABI,
      functionName: 'createOrder',
      args: [
        projectId,       // bytes32
        tokenAmount,     // uint256
        unitPrice,       // uint256
        isBuyOrder,      // bool
        expiryTimestamp, // uint256
        allowedTaker,    // address (0x0 for public)
      ],
    });
  };
  
  return <button onClick={createOrder}>Create Order</button>;
}`}
                    </pre>
                  </div>
                </div>
              </div>

              {/* Reading Data */}
              <div>
                <h3 className="text-lg font-semibold mb-3 text-cyan-400">Reading Order Data</h3>
                <div className="bg-zinc-900/30 border border-zinc-800 rounded-lg p-4">
                  <div className="bg-zinc-950/50 rounded p-3">
                    <pre className="text-xs text-zinc-300 overflow-x-auto">
{`import { useReadContract } from 'wagmi';

function OrderDisplay({ orderId }) {
  const { data: order } = useReadContract({
    address: ORDERBOOK_ADDRESS,
    abi: ESCROW_ORDERBOOK_ABI,
    functionName: 'orders',
    args: [orderId],
  });
  
  return (
    <div>
      <p>Maker: {order.maker}</p>
      <p>Status: {order.status}</p>
      <p>Token Amount: {order.tokenAmount}</p>
      <p>Unit Price: {order.unitPrice}</p>
    </div>
  );
}`}
                    </pre>
                  </div>
                </div>
              </div>

              {/* Events */}
              <div>
                <h3 className="text-lg font-semibold mb-3 text-cyan-400">Listening to Events</h3>
                <div className="bg-zinc-900/30 border border-zinc-800 rounded-lg p-4">
                  <p className="text-sm text-zinc-400 mb-3">Key events emitted by EscrowOrderBookV4:</p>
                  <div className="space-y-2 text-xs">
                    <div className="bg-zinc-950/50 rounded p-2">
                      <code className="text-zinc-300">OrderCreated(uint256 indexed id, ...)</code>
                    </div>
                    <div className="bg-zinc-950/50 rounded p-2">
                      <code className="text-zinc-300">OrderTaken(uint256 indexed id, address indexed taker)</code>
                    </div>
                    <div className="bg-zinc-950/50 rounded p-2">
                      <code className="text-zinc-300">OrderSettled(uint256 indexed id, ...)</code>
                    </div>
                    <div className="bg-zinc-950/50 rounded p-2">
                      <code className="text-zinc-300">ProofSubmitted(uint256 indexed id, string proof)</code>
                    </div>
                    <div className="bg-zinc-950/50 rounded p-2">
                      <code className="text-zinc-300">ProofAccepted(uint256 indexed id, address admin)</code>
                    </div>
                  </div>
                </div>
              </div>

              {/* ABIs */}
              <div>
                <h3 className="text-lg font-semibold mb-3 text-cyan-400">Contract ABIs</h3>
                <div className="bg-zinc-900/30 border border-zinc-800 rounded-lg p-4">
                  <p className="text-sm text-zinc-400 mb-3">
                    Full contract ABIs are available in the repository:
                  </p>
                  <div className="space-y-2 text-xs">
                    <div className="flex items-center gap-2">
                      <Code className="w-4 h-4 text-cyan-400" />
                      <code className="text-zinc-300">frontend/src/lib/abis/EscrowOrderBookV4.abi.json</code>
                    </div>
                    <div className="flex items-center gap-2">
                      <Code className="w-4 h-4 text-cyan-400" />
                      <code className="text-zinc-300">frontend/src/lib/abis/ProjectRegistryV2.abi.json</code>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </Card>
        </>
      )}

      {/* Footer Disclaimer */}
      <Card className="bg-red-950/20 border-red-800/50">
        <div className="flex items-start gap-3 mb-3">
          <AlertTriangle className="w-6 h-6 text-red-400 mt-1" />
          <h2 className="text-xl font-bold text-red-400">Developer Disclaimer</h2>
        </div>
        <p className="text-sm text-zinc-300 leading-relaxed mb-3">
          This documentation is provided for informational purposes only. By integrating with otcX:
        </p>
        <ul className="space-y-1.5 text-sm text-zinc-400">
          <li className="flex items-start gap-2">
            <div className="w-1 h-1 bg-red-400 rounded-full mt-2"></div>
            <span>You acknowledge the contracts have not been formally audited</span>
          </li>
          <li className="flex items-start gap-2">
            <div className="w-1 h-1 bg-red-400 rounded-full mt-2"></div>
            <span>You are responsible for your own security review</span>
          </li>
          <li className="flex items-start gap-2">
            <div className="w-1 h-1 bg-red-400 rounded-full mt-2"></div>
            <span>The protocol may contain bugs or vulnerabilities</span>
          </li>
          <li className="flex items-start gap-2">
            <div className="w-1 h-1 bg-red-400 rounded-full mt-2"></div>
            <span>Use at your own risk in production</span>
          </li>
        </ul>
      </Card>
      </div>
    </div>
  );
}

