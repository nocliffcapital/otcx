"use client";

import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { ProjectImage } from "@/components/ProjectImage";
import { useMyOrders } from "@/hooks/useOrders";
import { useOrderbook } from "@/hooks/useOrderbook";
import { useToast } from "@/components/Toast";
import ReputationBadge from "@/components/ReputationBadge";
import { TGEOrderControls } from "@/components/TGEOrderControls";
import { formatUnits } from "viem";
import { STABLE_DECIMALS, REGISTRY_ADDRESS, PROJECT_REGISTRY_ABI, ORDERBOOK_ADDRESS, ESCROW_ORDERBOOK_ABI } from "@/lib/contracts";
import { useState, useEffect, useMemo } from "react";
import { useReadContract, usePublicClient, useBlockNumber } from "wagmi";
import { User, TrendingUp, Clock, CheckCircle2, Lock, DollarSign, ArrowUpRight, ArrowDownRight, FileText, Search, AlertCircle, Link as LinkIcon, Copy, Loader2, Terminal, Database, Cpu, ChevronDown } from "lucide-react";
import Link from "next/link";

// V4: Simplified status enum (no TGE_ACTIVATED status)
const STATUS_LABELS = [
  "OPEN",            // 0
  "FUNDED",          // 1
  "SETTLED",         // 2
  "DEFAULTED",       // 3
  "CANCELED"         // 4
];
const STATUS_COLORS = [
  "bg-orange-500",   // OPEN
  "bg-blue-500",     // FUNDED
  "bg-emerald-600",  // SETTLED
  "bg-red-700",      // DEFAULTED
  "bg-gray-600"      // CANCELED
];

export default function MyOrdersPage() {
  const { address, cancel, takeSellOrder, takeBuyOrder } = useOrderbook();
  const { orders, loading, refresh } = useMyOrders(address);
  const toast = useToast();
  const [canceling, setCanceling] = useState<string | null>(null);
  const [locking, setLocking] = useState<string | null>(null);
  const [projectNames, setProjectNames] = useState<Record<string, string>>({});
  const [projectMetadata, setProjectMetadata] = useState<Record<string, string>>({}); // token address -> metadataURI
  const [projectTgeStatus, setProjectTgeStatus] = useState<Record<string, boolean>>({}); // projectId -> TGE activated
  const [showCanceled, setShowCanceled] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [sideFilter, setSideFilter] = useState<"all" | "buy" | "sell">("all");
  const [activeTab, setActiveTab] = useState<"open" | "filled" | "settlement" | "ended">("open");

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

  // Fetch all projects to map token addresses to names and metadata URIs
  const { data: projects } = useReadContract({
    address: REGISTRY_ADDRESS,
    abi: PROJECT_REGISTRY_ABI,
    functionName: "getActiveProjects",
  });

  // V4: Map projectId (bytes32) -> name, metadataURI, and TGE status
  // Orders store projectId in the projectToken field
  useEffect(() => {
    if (!projects || !publicClient) return;
    
    const nameMap: Record<string, string> = {};
    const metadataMap: Record<string, string> = {};
    
    // Fetch TGE status for all projects
    const fetchTgeStatuses = async () => {
      const tgeStatusMap: Record<string, boolean> = {};
      
      for (const proj of projects as Array<{ id: string; name: string; metadataURI: string }>) {
        try {
          // V4: projectId (bytes32) is stored in proj.id
          nameMap[proj.id.toLowerCase()] = proj.name;
          metadataMap[proj.id.toLowerCase()] = proj.metadataURI || '';
          
          // Fetch TGE status from contract
          const tgeActivated = await publicClient.readContract({
            address: ORDERBOOK_ADDRESS,
            abi: ESCROW_ORDERBOOK_ABI,
            functionName: "projectTgeActivated",
            args: [proj.id as `0x${string}`],
          }) as boolean;
          
          tgeStatusMap[proj.id.toLowerCase()] = tgeActivated;
        } catch (error) {
          console.error(`Failed to process project ${proj.name}:`, error);
          tgeStatusMap[proj.id.toLowerCase()] = false;
        }
      }
      
      setProjectTgeStatus(tgeStatusMap);
    };
    
    setProjectNames(nameMap);
    setProjectMetadata(metadataMap);
    fetchTgeStatuses();
  }, [projects, publicClient]);

  // Filter orders based on tab, search, side filter, and showCanceled toggle
  const filteredOrders = useMemo(() => {
    let filtered = orders;

    // V4: Tab filtering (adjusted for new status enum)
    if (activeTab === "open") {
      // Only OPEN orders (not yet filled)
      filtered = filtered.filter(o => o.status === 0);
    } else if (activeTab === "filled") {
      // FUNDED orders (filled but not yet settled)
      filtered = filtered.filter(o => o.status === 1);
    } else if (activeTab === "settlement") {
      // V4: In Settlement = FUNDED (1) AND project TGE activated
      filtered = filtered.filter(o => 
        o.status === 1 && projectTgeStatus[o.projectToken.toLowerCase()]
      );
    } else if (activeTab === "ended") {
      // V4: SETTLED (2), DEFAULTED (3), CANCELED (4)
      filtered = filtered.filter(o => o.status === 2 || o.status === 3 || o.status === 4);
    }

    // Side filter
    if (sideFilter === "buy") {
      filtered = filtered.filter(o => !o.isSell);
    } else if (sideFilter === "sell") {
      filtered = filtered.filter(o => o.isSell);
    }

    // Search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(o => {
        const projectName = projectNames[o.projectToken.toLowerCase()] || "";
        const orderId = o.id.toString();
        return projectName.toLowerCase().includes(query) || orderId.includes(query);
      });
    }

    // Canceled filter (only for "ended" tab)
    if (activeTab === "ended" && !showCanceled) {
      filtered = filtered.filter(o => o.status !== 4); // V4: CANCELED is status 4
    }

    return filtered;
  }, [orders, activeTab, sideFilter, searchQuery, showCanceled, projectNames, projectTgeStatus]);

  // Calculate summary stats (always based on all orders)
  const stats = useMemo(() => {
    // V4: In Settlement = FUNDED (1) AND project TGE activated
    const inSettlement = orders.filter(o => 
      o.status === 1 && projectTgeStatus[o.projectToken.toLowerCase()]
    ).length;

    const active = orders.filter(o => o.status === 0).length; // OPEN
    const funded = orders.filter(o => o.status === 1).length; // FUNDED
    const settled = orders.filter(o => o.status === 2).length; // SETTLED (V4: status 2)
    const canceled = orders.filter(o => o.status === 4).length; // CANCELED (V4: status 4)

    // Calculate total volume (sum of all order values in USDC)
    const totalVolume = orders.reduce((sum, order) => {
      const orderValue = (order.amount * order.unitPrice) / BigInt(10 ** 18); // Convert to USDC decimals
      return sum + Number(formatUnits(orderValue, STABLE_DECIMALS));
    }, 0);

    // Buy vs Sell breakdown
    const buyOrders = orders.filter(o => !o.isSell).length;
    const sellOrders = orders.filter(o => o.isSell).length;

    // Calculate average order size
    const avgOrderSize = orders.length > 0 ? totalVolume / orders.length : 0;

    return { 
      inSettlement, 
      active, 
      funded, 
      settled, 
      canceled, 
      total: orders.length,
      totalVolume,
      buyOrders,
      sellOrders,
      avgOrderSize
    };
  }, [orders, projectTgeStatus]);

  const handleCancel = async (orderId: bigint) => {
    try {
      setCanceling(orderId.toString());
      await cancel(orderId);
      toast.success(
        "Order canceled successfully!",
        "Your order has been removed from the orderbook."
      );
      // Refresh orders immediately after canceling
      setTimeout(() => refresh(), 2000); // Wait 2s for blockchain to update
    } catch (error) {
      console.error(error);
      toast.error(
        "Cancellation failed",
        error?.message || "Unable to cancel order. Please try again."
      );
    } finally {
      setCanceling(null);
    }
  };

  const handleCopyPrivateLink = (orderId: bigint, allowedTaker: string) => {
    const baseUrl = window.location.origin;
    const link = `${baseUrl}/order/${orderId}?taker=${allowedTaker}`;
    navigator.clipboard.writeText(link);
    toast.success("Link copied!", "Share this link with the intended recipient");
  };

  const handleLockCollateral = async (order: { id: bigint; isSell: boolean; amount: bigint; unitPrice: bigint }) => {
    try {
      setLocking(order.id.toString());
      // Convert from 24 decimals to 6 decimals (USDC)
      // amount is 18 decimals, unitPrice is 6 decimals, so divide by 10^18
      const total = (order.amount * order.unitPrice) / BigInt(10 ** 18);
      
      toast.info("Locking collateral", "Transaction pending");
      
      if (order.isSell) {
        // I'm the seller, need to lock seller collateral
        await takeSellOrder(order.id, total);
      } else {
        // I'm the buyer, need to lock buyer funds
        await takeBuyOrder(order.id, total);
      }
      
      toast.success(
        "Collateral locked successfully!",
        "Your order is now fully funded."
      );
      setTimeout(() => refresh(), 2000);
    } catch (error) {
      console.error(error);
      toast.error(
        "Failed to lock collateral",
        error?.message || "Unable to lock collateral. Please try again."
      );
    } finally {
      setLocking(null);
    }
  };

  return (
    <div className="relative min-h-screen" style={{ backgroundColor: '#06060c' }}>
      <div className="relative mx-auto max-w-7xl px-4 py-8">
        {/* Terminal-style header */}
        <div className="border rounded p-4 mb-6 backdrop-blur-sm font-mono" style={{ backgroundColor: '#121218', borderColor: '#2b2b30' }}>
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0 flex-1">
              <div className="border rounded flex items-center justify-center flex-shrink-0" style={{ 
                width: '56px', 
                height: '56px',
                borderColor: '#2b2b30'
              }}>
                <User className="w-10 h-10 text-zinc-300" />
              </div>
              <div className="min-w-0 flex-1">
                <span className="text-zinc-300 text-xs mb-1 block">otcX://protocol/dashboard</span>
                <h1 className="text-2xl md:text-3xl font-bold text-white tracking-tight break-words">
                  USER_DASHBOARD
                </h1>
                <p className="text-xs text-zinc-300/70 mt-1 break-words">
                  Order Management • Portfolio Tracking
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

        {/* Settlement Alerts */}
        {address && !loading && orders.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            {/* Current Settlements (In Settlement - TGE Activated) */}
            <Card className={`p-4 transition-all ${
              stats.inSettlement > 0
                ? "border-zinc-600 ring-2 ring-zinc-600/30 animate-pulse"
                : ""
            }`}>
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-lg bg-zinc-800/50">
                  <Clock className="w-6 h-6 text-zinc-400" />
                </div>
                <div className="flex-1">
                  <h3 className="text-sm font-semibold mb-1 text-white">Current Settlements</h3>
                  {stats.inSettlement > 0 ? (
                    <p className="text-xs text-zinc-200 font-medium">
                      <AlertCircle className="w-3 h-3 inline mr-1 text-zinc-400" />
                      You have <span className="font-bold text-white text-sm">{stats.inSettlement}</span> order(s) requiring action!
                    </p>
                  ) : (
                    <p className="text-xs text-zinc-400">No orders in settlement</p>
                  )}
                </div>
              </div>
            </Card>

            {/* Completed Settlements (Settled) */}
            <Card className="p-4">
              <div className="flex items-start gap-3">
                <div className="p-2 bg-zinc-800/50 rounded-lg">
                  <CheckCircle2 className="w-6 h-6 text-zinc-400" />
                </div>
                <div className="flex-1">
                  <h3 className="text-sm font-semibold text-white mb-1">Completed Settlements</h3>
                  {stats.settled > 0 ? (
                    <p className="text-xs text-zinc-300">
                      <CheckCircle2 className="w-3 h-3 inline mr-1" />
                      You have <span className="font-bold text-white">{stats.settled}</span> completed settlement(s)
                    </p>
                  ) : (
                    <p className="text-xs text-zinc-400">No completed settlements</p>
                  )}
                </div>
              </div>
            </Card>
          </div>
        )}

        {/* Summary Stats */}
        {address && !loading && orders.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7 gap-2 mb-6">
            {/* Total Orders */}
            <Card className="p-2">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-zinc-800/50 rounded-lg flex-shrink-0">
                  <FileText className="w-4 h-4 text-zinc-400" />
                </div>
                <div className="flex flex-col justify-center min-h-[28px]">
                  <div className="text-lg font-bold text-white leading-none text-left">{stats.total}</div>
                  <div className="text-[9px] text-zinc-400 leading-none mt-0.5 text-left">Total Orders</div>
                </div>
              </div>
            </Card>
            
            {/* Total Volume */}
            <Card className="p-2">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-zinc-800/50 rounded-lg flex-shrink-0">
                  <DollarSign className="w-4 h-4 text-zinc-400" />
                </div>
                <div className="flex flex-col justify-center min-h-[28px]">
                  <div className="text-lg font-bold text-white leading-none text-left">
                    ${stats.totalVolume.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                  </div>
                  <div className="text-[9px] text-zinc-400 leading-none mt-0.5 text-left">Total Volume</div>
                </div>
              </div>
            </Card>

            {/* Buy Orders */}
            <Card className="p-2">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-zinc-800/50 rounded-lg flex-shrink-0">
                  <ArrowUpRight className="w-4 h-4 text-zinc-400" />
                </div>
                <div className="flex flex-col justify-center min-h-[28px]">
                  <div className="text-lg font-bold text-white leading-none text-left">{stats.buyOrders}</div>
                  <div className="text-[9px] text-zinc-400 leading-none mt-0.5 text-left">Buy Orders</div>
                </div>
              </div>
            </Card>

            {/* Sell Orders */}
            <Card className="p-2">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-zinc-800/50 rounded-lg flex-shrink-0">
                  <ArrowDownRight className="w-4 h-4 text-zinc-400" />
                </div>
                <div className="flex flex-col justify-center min-h-[28px]">
                  <div className="text-lg font-bold text-white leading-none text-left">{stats.sellOrders}</div>
                  <div className="text-[9px] text-zinc-400 leading-none mt-0.5 text-left">Sell Orders</div>
                </div>
              </div>
            </Card>
            
            {/* Active Orders */}
            <Card className="p-2">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-zinc-800/50 rounded-lg flex-shrink-0">
                  <Clock className="w-4 h-4 text-zinc-400" />
                </div>
                <div className="flex flex-col justify-center min-h-[28px]">
                  <div className="text-lg font-bold text-white leading-none text-left">{stats.active}</div>
                  <div className="text-[9px] text-zinc-400 leading-none mt-0.5 text-left">Active</div>
                </div>
              </div>
            </Card>
            
            {/* In Settlement */}
            <Card className="p-2">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-zinc-800/50 rounded-lg flex-shrink-0">
                  <TrendingUp className="w-4 h-4 text-zinc-400" />
                </div>
                <div className="flex flex-col justify-center min-h-[28px]">
                  <div className="text-lg font-bold text-white leading-none text-left">{stats.inSettlement}</div>
                  <div className="text-[9px] text-zinc-400 leading-none mt-0.5 text-left">Settlement</div>
                </div>
              </div>
            </Card>
            
            {/* Settled */}
            <Card className="p-2">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-zinc-800/50 rounded-lg flex-shrink-0">
                  <CheckCircle2 className="w-4 h-4 text-zinc-400" />
                </div>
                <div className="flex flex-col justify-center min-h-[28px]">
                  <div className="text-lg font-bold text-white leading-none text-left">{stats.settled}</div>
                  <div className="text-[9px] text-zinc-400 leading-none mt-0.5 text-left">Settled</div>
                </div>
              </div>
            </Card>
          </div>
        )}
      
        {!address && (
          <Card className="p-6 text-center">
            <p className="text-zinc-400">Connect your wallet to view your orders</p>
          </Card>
        )}

        {address && loading && (
          <Card className="p-6 text-center">
            <Loader2 className="w-8 h-8 animate-spin text-zinc-400 mx-auto mb-4" />
            <p className="text-zinc-400">Loading your orders...</p>
          </Card>
        )}

        {address && !loading && orders.length === 0 && (
          <div className="flex flex-col items-center px-4 py-8">
            <div className="bg-[#121218] border border-[#2b2b30] rounded p-8 backdrop-blur-sm max-w-2xl">
              <div className="flex items-center gap-3 mb-4 font-mono text-zinc-300">
                <Terminal className="w-5 h-5" />
                <span className="text-sm">otcX://protocol/dashboard</span>
              </div>
              <div className="bg-[#06060c] border border-blue-500/30 rounded p-4 mb-4 font-mono text-sm">
                <div className="flex items-center gap-2 text-blue-400 mb-2">
                  <span className="font-bold">INFO:</span>
                  <span>No orders found for address</span>
                </div>
                <div className="text-zinc-500 text-xs space-y-1 pl-4">
                  <div>→ wallet: {address?.slice(0, 6)}...{address?.slice(-4)}</div>
                  <div>→ orders.length = 0</div>
                  <div>→ status: EMPTY_DASHBOARD</div>
                </div>
              </div>
              <div className="space-y-3 font-mono text-sm">
                <div className="text-zinc-400">
                  You haven&apos;t created any orders yet.
                </div>
                <div className="text-zinc-400">
                  Start trading by exploring the available markets.
                </div>
              </div>
              <div className="mt-6 pt-6 border-t border-[#2b2b30]">
                <Link href="/">
                  <button className="w-full px-6 py-3 text-sm font-mono font-medium text-zinc-300 border border-[#2b2b30] rounded transition-all hover:bg-[#2b2b30] hover:border-zinc-500 flex items-center justify-center gap-2">
                    <span>→</span> EXPLORE MARKETS
                  </button>
                </Link>
              </div>
            </div>
          </div>
        )}

        {/* Tabs - Terminal Style (matching markets page) */}
        {address && !loading && orders.length > 0 && (
          <div className="mb-6">
            <div className="flex items-center gap-2 mb-6 rounded border p-1" style={{ backgroundColor: '#121218', borderColor: '#2b2b30' }}>
              <button
                onClick={() => setActiveTab("open")}
                className={`flex items-center gap-2 px-4 py-2 text-sm font-mono font-medium transition-all rounded ${
                  activeTab === "open"
                    ? "bg-blue-500/20 text-blue-400 border border-blue-500/50"
                    : "text-zinc-400 hover:text-zinc-300 hover:bg-[#2b2b30]"
                }`}
              >
                <div className={`w-2 h-2 rounded-full ${activeTab === "open" ? "bg-blue-400 animate-pulse" : "bg-zinc-600"}`}></div>
                <span>OPEN</span>
                <span className="text-xs px-1.5 py-0.5 rounded bg-blue-500/30">
                  {stats.active}
                </span>
              </button>
              <button
                onClick={() => setActiveTab("filled")}
                className={`flex items-center gap-2 px-4 py-2 text-sm font-mono font-medium transition-all rounded ${
                  activeTab === "filled"
                    ? "bg-green-500/20 text-green-400 border border-green-500/50"
                    : "text-zinc-400 hover:text-zinc-300 hover:bg-[#2b2b30]"
                }`}
              >
                <div className={`w-2 h-2 rounded-full ${activeTab === "filled" ? "bg-green-400" : "bg-zinc-600"}`}></div>
                <span>FILLED</span>
                <span className="text-xs px-1.5 py-0.5 rounded bg-green-500/30">
                  {stats.funded}
                </span>
              </button>
              <button
                onClick={() => setActiveTab("settlement")}
                className={`flex items-center gap-2 px-4 py-2 text-sm font-mono font-medium transition-all rounded ${
                  activeTab === "settlement"
                    ? "bg-orange-500/20 text-orange-400 border border-orange-500/50"
                    : "text-zinc-400 hover:text-zinc-300 hover:bg-[#2b2b30]"
                }`}
              >
                <div className={`w-2 h-2 rounded-full ${activeTab === "settlement" ? "bg-orange-400 animate-pulse" : "bg-zinc-600"}`}></div>
                <span>SETTLEMENT</span>
                <span className="text-xs px-1.5 py-0.5 rounded bg-orange-500/30">
                  {stats.inSettlement}
                </span>
              </button>
              <button
                onClick={() => setActiveTab("ended")}
                className={`flex items-center gap-2 px-4 py-2 text-sm font-mono font-medium transition-all rounded ${
                  activeTab === "ended"
                    ? "bg-red-500/20 text-red-400 border border-red-500/50"
                    : "text-zinc-400 hover:text-zinc-300 hover:bg-[#2b2b30]"
                }`}
              >
                <div className={`w-2 h-2 rounded-full ${activeTab === "ended" ? "bg-red-400" : "bg-zinc-600"}`}></div>
                <span>ENDED</span>
                <span className="text-xs px-1.5 py-0.5 rounded bg-red-500/30">
                  {orders.filter(o => o.status === 2 || o.status === 3 || o.status === 4).length}
                </span>
              </button>
            </div>

            {/* Search and Filters */}
            <div className="flex flex-col md:flex-row gap-3 mb-4">
              {/* Search */}
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                <input
                  type="text"
                  placeholder="Search by project name or order ID..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 rounded text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none font-mono"
                  style={{ backgroundColor: '#121218', borderColor: '#2b2b30', border: '1px solid' }}
                />
              </div>

              {/* Side Filter */}
              <div className="relative">
                <select
                  value={sideFilter}
                  onChange={(e) => setSideFilter(e.target.value as "all" | "buy" | "sell")}
                  className="pl-4 pr-10 py-2 rounded text-sm text-zinc-100 focus:outline-none font-mono cursor-pointer appearance-none"
                  style={{ backgroundColor: '#121218', borderColor: '#2b2b30', border: '1px solid' }}
                >
                  <option value="all">ALL SIDES</option>
                  <option value="buy">BUY ONLY</option>
                  <option value="sell">SELL ONLY</option>
                </select>
                <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
                  <ChevronDown className="w-4 h-4 text-zinc-400" />
                </div>
              </div>

              {/* Include Canceled (only for "ended" tab) */}
              {activeTab === "ended" && (
                <button
                  onClick={() => setShowCanceled(!showCanceled)}
                  className="flex items-center gap-2 px-4 py-2 rounded border text-sm whitespace-nowrap font-mono transition-all"
                  style={{ 
                    backgroundColor: showCanceled ? '#2b2b30' : '#121218', 
                    borderColor: '#2b2b30',
                    color: 'white'
                  }}
                >
                  <div className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-all ${
                    showCanceled 
                      ? 'bg-[#2b2b30] border-[#2b2b30]' 
                      : 'border-[#2b2b30]'
                  }`}>
                    {showCanceled && (
                      <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </div>
                  <span>INCLUDE CANCELED</span>
                </button>
              )}
            </div>

            {/* Results count */}
            <div className="text-sm text-zinc-400 mb-4">
              Showing {filteredOrders.length} of {orders.length} orders
            </div>
          </div>
        )}

        {/* Orders Table */}
        {address && !loading && filteredOrders.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b" style={{ borderColor: '#2b2b30' }}>
                  <th className="text-left py-3 px-4 text-xs font-bold text-zinc-300 uppercase tracking-wider font-mono">Project</th>
                  <th className="text-left py-3 px-4 text-xs font-bold text-zinc-300 uppercase tracking-wider font-mono">Type</th>
                  <th className="text-left py-3 px-4 text-xs font-bold text-zinc-300 uppercase tracking-wider font-mono">Side</th>
                  <th className="text-left py-3 px-4 text-xs font-bold text-zinc-300 uppercase tracking-wider font-mono">Status</th>
                  <th className="text-right py-3 px-4 text-xs font-bold text-zinc-300 uppercase tracking-wider font-mono">Amount</th>
                  <th className="text-right py-3 px-4 text-xs font-bold text-zinc-300 uppercase tracking-wider font-mono">Price</th>
                  <th className="text-right py-3 px-4 text-xs font-bold text-zinc-300 uppercase tracking-wider font-mono">Total</th>
                  <th className="text-center py-3 px-4 text-xs font-bold text-zinc-300 uppercase tracking-wider font-mono">Progress</th>
                  <th className="text-center py-3 px-4 text-xs font-bold text-zinc-300 uppercase tracking-wider font-mono">Escrow</th>
                  <th className="text-right py-3 px-4 text-xs font-bold text-zinc-300 uppercase tracking-wider font-mono">Actions</th>
                </tr>
              </thead>
              <tbody>
        {filteredOrders.map((order) => {
            // Calculate total in stable decimals (USD value)
            // amount is 18 decimals, unitPrice is 6 decimals, so divide by 10^18
            const total = (order.amount * order.unitPrice) / BigInt(10 ** 18);
            const hasSellerLock = order.sellerCollateral > 0n;
            const hasBuyerLock = order.buyerFunds > 0n;
            const canCancel = order.status === 0 && (
              (order.isSell && !hasBuyerLock) || 
              (!order.isSell && !hasSellerLock)
            );
            // V4: In Settlement = FUNDED (1) AND project TGE activated
            const isInSettlement = order.status === 1 && projectTgeStatus[order.projectToken.toLowerCase()];
            
            // Determine user's role in this order
            const iAmSeller = order.seller.toLowerCase() === address?.toLowerCase();
            const iAmBuyer = order.buyer.toLowerCase() === address?.toLowerCase();

            return (
              <tr 
                key={order.id.toString()}
                className="border-b transition-all group"
                style={{ borderColor: '#2b2b30' }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#2b2b30'}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
              >
                {/* Project */}
                <td className="py-4 px-4">
                  <div className="flex items-center gap-2">
                    <ProjectImage 
                      metadataURI={projectMetadata[order.projectToken.toLowerCase()]}
                      imageType="icon"
                      className="w-8 h-8 rounded-full object-cover border-2 border-zinc-700"
                      fallbackText={(projectNames[order.projectToken.toLowerCase()] || "?").charAt(0).toUpperCase()}
                    />
                    <span className="text-sm font-medium text-white">
                      {projectNames[order.projectToken.toLowerCase()] || "Unknown"}
                    </span>
                  </div>
                </td>

                {/* Type */}
                <td className="py-4 px-4">
                  {order.allowedTaker && order.allowedTaker !== "0x0000000000000000000000000000000000000000" ? (
                    <Badge className="bg-purple-500/20 text-purple-400 border border-purple-500/50 text-xs flex items-center gap-1 w-fit">
                      <Lock className="w-3 h-3" />
                      PRIVATE
                    </Badge>
                  ) : (
                    <Badge className="text-zinc-300 text-xs w-fit" style={{ backgroundColor: '#121218', borderColor: '#2b2b30', border: '1px solid' }}>
                      PUBLIC
                    </Badge>
                  )}
                </td>

                {/* Side */}
                <td className="py-4 px-4">
                  <Badge className={order.isSell ? "bg-red-500/20 text-red-400 border border-red-500/50 text-xs" : "bg-green-500/20 text-green-400 border border-green-500/50 text-xs"}>
                    {order.isSell ? "SELL" : "BUY"}
                  </Badge>
                </td>

                {/* Status */}
                <td className="py-4 px-4">
                  <div className="flex flex-col gap-1">
                    <Badge className={`${STATUS_COLORS[order.status]} text-xs w-fit`}>
                      {STATUS_LABELS[order.status]}
                    </Badge>
                    {isInSettlement && order.settlementDeadline > 0n && (() => {
                      const deadline = Number(order.settlementDeadline) * 1000;
                      const now = Date.now();
                      const remaining = deadline - now;
                      if (remaining > 0) {
                        const hours = Math.floor(remaining / (1000 * 60 * 60));
                        const minutes = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60));
                        return (
                          <span className="text-[10px] text-red-400">
                            ⏰ {hours}h {minutes}m left
                          </span>
                        );
                      }
                      return null;
                    })()}
                  </div>
                </td>

                {/* Amount */}
                <td className="py-4 px-4 text-right">
                  <span className="font-medium text-white text-sm">
                    {formatUnits(order.amount, 18)}
                  </span>
                </td>

                {/* Price */}
                <td className="py-4 px-4 text-right">
                  <span className="font-medium text-white text-sm font-mono">
                    ${formatUnits(order.unitPrice, STABLE_DECIMALS)}
                  </span>
                </td>

                {/* Total */}
                <td className="py-4 px-4 text-right">
                  <span className="font-semibold text-white text-sm">
                    ${formatUnits(total, STABLE_DECIMALS)}
                  </span>
                </td>

                {/* Progress */}
                <td className="py-4 px-4">
                  <div className="flex items-center gap-1 justify-center">
                    <div className={`w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold font-mono ${
                      order.status >= 0 ? 'text-white' : 'text-zinc-600'
                    }`} style={{ backgroundColor: order.status >= 0 ? '#f97316' : '#121218', border: `1px solid ${order.status >= 0 ? '#f97316' : '#2b2b30'}` }}>1</div>
                    <div className={`h-0.5 w-3`} style={{ backgroundColor: order.status >= 1 ? '#3b82f6' : '#2b2b30' }}></div>
                    <div className={`w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold font-mono ${
                      order.status >= 1 ? 'text-white' : 'text-zinc-600'
                    }`} style={{ backgroundColor: order.status >= 1 ? '#3b82f6' : '#121218', border: `1px solid ${order.status >= 1 ? '#3b82f6' : '#2b2b30'}` }}>2</div>
                    <div className={`h-0.5 w-3`} style={{ backgroundColor: order.status >= 2 ? '#8b5cf6' : '#2b2b30' }}></div>
                    <div className={`w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold font-mono ${
                      order.status >= 2 ? 'text-white' : 'text-zinc-600'
                    }`} style={{ backgroundColor: order.status >= 2 ? '#8b5cf6' : '#121218', border: `1px solid ${order.status >= 2 ? '#8b5cf6' : '#2b2b30'}` }}>3</div>
                    <div className={`h-0.5 w-3`} style={{ backgroundColor: order.status === 3 ? '#10b981' : order.status >= 4 ? '#dc2626' : '#2b2b30' }}></div>
                    <div className={`w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold font-mono ${
                      order.status === 3 ? 'text-white' : 
                      order.status === 4 ? 'text-white' : 
                      order.status === 5 ? 'text-white' : 
                      'text-zinc-600'
                    }`} style={{ 
                      backgroundColor: order.status === 3 ? '#10b981' : 
                        order.status === 4 ? '#ea580c' : 
                        order.status === 5 ? '#dc2626' : 
                        '#121218',
                      border: `1px solid ${order.status === 3 ? '#10b981' : order.status === 4 ? '#ea580c' : order.status === 5 ? '#dc2626' : '#2b2b30'}`
                    }}>{order.status === 3 ? '✓' : order.status === 4 ? 'D' : order.status === 5 ? '✗' : '4'}</div>
                  </div>
                </td>

                {/* Escrow Status */}
                <td className="py-4 px-4">
                  <div className="flex flex-col gap-1 items-center">
                    <div className="flex items-center gap-1">
                      <span className="text-[10px] text-zinc-500">S:</span>
                      {hasSellerLock ? (
                        <span className="text-[10px] text-green-400">✓</span>
                      ) : (
                        <span className="text-[10px] text-zinc-600">○</span>
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="text-[10px] text-zinc-500">B:</span>
                      {hasBuyerLock ? (
                        <span className="text-[10px] text-green-400">✓</span>
                      ) : (
                        <span className="text-[10px] text-zinc-600">○</span>
                      )}
                    </div>
                  </div>
                </td>

                {/* Actions */}
                <td className="py-4 px-4 text-right">
                  <div className="flex gap-2 justify-end">
                    {isInSettlement && (
                      <TGEOrderControls 
                        order={order} 
                        isOwner={false} 
                        projectTgeActivated={projectTgeStatus[order.projectToken.toLowerCase()]}
                      />
                    )}
                    
                    {/* Copy Private Link button for private orders */}
                    {order.allowedTaker && order.allowedTaker !== "0x0000000000000000000000000000000000000000" && order.status === 0 && (
                      <Button
                        size="sm"
                        variant="custom"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleCopyPrivateLink(order.id, order.allowedTaker);
                        }}
                        className="text-xs px-2 py-1 whitespace-nowrap h-7 font-mono border"
                        style={{ backgroundColor: '#2b2b30', borderColor: '#2b2b30', color: 'white' }}
                        title="Copy shareable link"
                      >
                        <Copy className="w-3 h-3 mr-1 inline" />
                        COPY LINK
                      </Button>
                    )}
                    
                    {order.status === 0 && (
                      (order.isSell && !hasSellerLock) || (!order.isSell && !hasBuyerLock)
                    ) && (
                      <Button
                        size="sm"
                        variant="custom"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleLockCollateral(order);
                        }}
                        disabled={!!locking}
                        className="text-xs px-2 py-1 whitespace-nowrap h-7 font-mono border"
                        style={{ backgroundColor: '#2b2b30', borderColor: '#2b2b30', color: 'white' }}
                      >
                        {locking === order.id.toString() ? (
                          <Loader2 className="w-3 h-3 mr-1 inline animate-spin" />
                        ) : (
                          <Lock className="w-3 h-3 mr-1 inline" />
                        )}
                        {locking === order.id.toString() ? "LOCKING..." : "LOCK"}
                      </Button>
                    )}
                    
                    {canCancel && (
                      <Button
                        size="sm"
                        variant="custom"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleCancel(order.id);
                        }}
                        disabled={!!canceling}
                        className="text-xs px-2 py-1 h-7 font-mono border"
                        style={{ backgroundColor: '#2b2b30', borderColor: '#2b2b30', color: 'white' }}
                      >
                        {canceling === order.id.toString() ? (
                          <>
                            <Loader2 className="w-3 h-3 mr-1 inline animate-spin" />
                            CANCELING...
                          </>
                        ) : "CANCEL"}
                      </Button>
                    )}
                  </div>
                </td>
              </tr>
            );
          })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
