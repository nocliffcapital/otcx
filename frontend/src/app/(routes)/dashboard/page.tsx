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
import { useReadContract, usePublicClient } from "wagmi";
import { User, TrendingUp, Clock, CheckCircle2, Lock, DollarSign, ArrowUpRight, ArrowDownRight, FileText, Search, AlertCircle, Link as LinkIcon, Copy, Loader2 } from "lucide-react";

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
    <div className="relative min-h-screen">
      {/* Corner accents */}
      <div className="fixed top-16 left-0 w-24 h-24 border-t-2 border-l-2 border-cyan-500/20 pointer-events-none"></div>
      <div className="fixed top-16 right-0 w-24 h-24 border-t-2 border-r-2 border-violet-500/20 pointer-events-none"></div>

      <div className="relative mx-auto max-w-7xl px-4 py-8">
        <h1 className="text-3xl md:text-4xl font-bold mb-3 flex items-center gap-3">
          <User className="w-8 h-8 md:w-10 md:h-10 text-cyan-400" />
          <span className="bg-gradient-to-r from-cyan-400 to-violet-400 bg-clip-text text-transparent">
            Dashboard
          </span>
        </h1>
        <p className="text-zinc-400 mb-6">Track and manage all your OTC orders</p>

        {/* Settlement Alerts */}
        {address && !loading && orders.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            {/* Current Settlements (In Settlement - TGE Activated) */}
            <Card className={`p-4 transition-all ${
              stats.inSettlement > 0
                ? "border-yellow-500/50 bg-yellow-950/30 shadow-lg shadow-yellow-500/20 ring-2 ring-yellow-500/30 animate-pulse"
                : "border-blue-500/30 bg-blue-950/20"
            }`}>
              <div className="flex items-start gap-3">
                <div className={`p-2 rounded-lg ${
                  stats.inSettlement > 0
                    ? "bg-yellow-500/30"
                    : "bg-blue-500/20"
                }`}>
                  <Clock className={`w-6 h-6 ${
                    stats.inSettlement > 0
                      ? "text-yellow-400"
                      : "text-blue-400"
                  }`} />
                </div>
                <div className="flex-1">
                  <h3 className={`text-sm font-semibold mb-1 ${
                    stats.inSettlement > 0
                      ? "text-yellow-400"
                      : "text-blue-400"
                  }`}>Current Settlements</h3>
                  {stats.inSettlement > 0 ? (
                    <p className="text-xs text-zinc-200 font-medium">
                      <AlertCircle className="w-3 h-3 inline mr-1 text-yellow-400" />
                      You have <span className="font-bold text-yellow-300 text-sm">{stats.inSettlement}</span> order(s) requiring action!
                    </p>
                  ) : (
                    <p className="text-xs text-zinc-400">No orders in settlement</p>
                  )}
                </div>
              </div>
            </Card>

            {/* Completed Settlements (Settled) */}
            <Card className="p-4 border-emerald-500/30 bg-emerald-950/20">
              <div className="flex items-start gap-3">
                <div className="p-2 bg-emerald-500/20 rounded-lg">
                  <CheckCircle2 className="w-6 h-6 text-emerald-400" />
                </div>
                <div className="flex-1">
                  <h3 className="text-sm font-semibold text-emerald-400 mb-1">Completed Settlements</h3>
                  {stats.settled > 0 ? (
                    <p className="text-xs text-zinc-300">
                      <CheckCircle2 className="w-3 h-3 inline mr-1" />
                      You have <span className="font-bold text-emerald-400">{stats.settled}</span> completed settlement(s)
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
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-2 mb-6">
            {/* Total Orders */}
            <Card className="p-2 border-cyan-500/30 bg-cyan-950/10">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-cyan-500/20 rounded-lg flex-shrink-0">
                  <FileText className="w-4 h-4 text-cyan-400" />
                </div>
                <div className="flex flex-col justify-center min-h-[28px]">
                  <div className="text-lg font-bold text-cyan-400 leading-none text-left">{stats.total}</div>
                  <div className="text-[9px] text-zinc-400 leading-none mt-0.5 text-left">Total Orders</div>
                </div>
              </div>
            </Card>
            
            {/* Total Volume */}
            <Card className="p-2 border-violet-500/30 bg-violet-950/10">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-violet-500/20 rounded-lg flex-shrink-0">
                  <DollarSign className="w-4 h-4 text-violet-400" />
                </div>
                <div className="flex flex-col justify-center min-h-[28px]">
                  <div className="text-lg font-bold text-violet-400 leading-none text-left">
                    ${stats.totalVolume.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                  </div>
                  <div className="text-[9px] text-zinc-400 leading-none mt-0.5 text-left">Total Volume</div>
                </div>
              </div>
            </Card>

            {/* Buy Orders */}
            <Card className="p-2 border-green-500/30 bg-green-950/10">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-green-500/20 rounded-lg flex-shrink-0">
                  <ArrowUpRight className="w-4 h-4 text-green-400" />
                </div>
                <div className="flex flex-col justify-center min-h-[28px]">
                  <div className="text-lg font-bold text-green-400 leading-none text-left">{stats.buyOrders}</div>
                  <div className="text-[9px] text-zinc-400 leading-none mt-0.5 text-left">Buy Orders</div>
                </div>
              </div>
            </Card>

            {/* Sell Orders */}
            <Card className="p-2 border-red-500/30 bg-red-950/10">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-red-500/20 rounded-lg flex-shrink-0">
                  <ArrowDownRight className="w-4 h-4 text-red-400" />
                </div>
                <div className="flex flex-col justify-center min-h-[28px]">
                  <div className="text-lg font-bold text-red-400 leading-none text-left">{stats.sellOrders}</div>
                  <div className="text-[9px] text-zinc-400 leading-none mt-0.5 text-left">Sell Orders</div>
                </div>
              </div>
            </Card>
            
            {/* Active Orders */}
            <Card className="p-2 border-orange-500/30 bg-orange-950/10">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-orange-500/20 rounded-lg flex-shrink-0">
                  <Clock className="w-4 h-4 text-orange-400" />
                </div>
                <div className="flex flex-col justify-center min-h-[28px]">
                  <div className="text-lg font-bold text-orange-400 leading-none text-left">{stats.active}</div>
                  <div className="text-[9px] text-zinc-400 leading-none mt-0.5 text-left">Active</div>
                </div>
              </div>
            </Card>
            
            {/* In Settlement */}
            <Card className="p-2 border-blue-500/30 bg-blue-950/10">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-blue-500/20 rounded-lg flex-shrink-0">
                  <TrendingUp className="w-4 h-4 text-blue-400" />
                </div>
                <div className="flex flex-col justify-center min-h-[28px]">
                  <div className="text-lg font-bold text-blue-400 leading-none text-left">{stats.inSettlement}</div>
                  <div className="text-[9px] text-zinc-400 leading-none mt-0.5 text-left">Settlement</div>
                </div>
              </div>
            </Card>
            
            {/* Settled */}
            <Card className="p-2 border-emerald-500/30 bg-emerald-950/10">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-emerald-500/20 rounded-lg flex-shrink-0">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                </div>
                <div className="flex flex-col justify-center min-h-[28px]">
                  <div className="text-lg font-bold text-emerald-400 leading-none text-left">{stats.settled}</div>
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
            <Loader2 className="w-8 h-8 animate-spin text-cyan-400 mx-auto mb-4" />
            <p className="text-zinc-400">Loading your orders...</p>
          </Card>
        )}

        {address && !loading && orders.length === 0 && (
          <Card className="p-6 text-center">
            <p className="text-zinc-400">You haven&apos;t created any orders yet</p>
          </Card>
        )}

        {/* Tabs */}
        {address && !loading && orders.length > 0 && (
          <div className="mb-6">
            <div className="flex items-center gap-2 border-b border-zinc-800 mb-4">
              <button
                onClick={() => setActiveTab("open")}
                className={`px-4 py-2 text-sm font-medium transition-all relative ${
                  activeTab === "open"
                    ? "text-cyan-400"
                    : "text-zinc-400 hover:text-zinc-300"
                }`}
              >
                Open Orders
                {activeTab === "open" && (
                  <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-cyan-400"></div>
                )}
                <Badge className="ml-2 bg-orange-600 text-xs">
                  {stats.active}
                </Badge>
              </button>
              <button
                onClick={() => setActiveTab("filled")}
                className={`px-4 py-2 text-sm font-medium transition-all relative ${
                  activeTab === "filled"
                    ? "text-cyan-400"
                    : "text-zinc-400 hover:text-zinc-300"
                }`}
              >
                Filled Orders
                {activeTab === "filled" && (
                  <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-cyan-400"></div>
                )}
                <Badge className="ml-2 bg-blue-600 text-xs">
                  {stats.funded}
                </Badge>
              </button>
              <button
                onClick={() => setActiveTab("settlement")}
                className={`px-4 py-2 text-sm font-medium transition-all relative ${
                  activeTab === "settlement"
                    ? "text-violet-400"
                    : "text-zinc-400 hover:text-zinc-300"
                }`}
              >
                In Settlement
                {activeTab === "settlement" && (
                  <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-violet-400"></div>
                )}
                <Badge className="ml-2 bg-violet-600 text-xs">
                  {stats.inSettlement}
                </Badge>
              </button>
              <button
                onClick={() => setActiveTab("ended")}
                className={`px-4 py-2 text-sm font-medium transition-all relative ${
                  activeTab === "ended"
                    ? "text-cyan-400"
                    : "text-zinc-400 hover:text-zinc-300"
                }`}
              >
                Ended Settlements
                {activeTab === "ended" && (
                  <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-cyan-400"></div>
                )}
                <Badge className="ml-2 bg-emerald-600 text-xs">
                  {orders.filter(o => o.status === 2 || o.status === 3 || o.status === 4).length}
                </Badge>
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
                  className="w-full pl-10 pr-4 py-2 bg-zinc-900 border border-zinc-700 rounded-lg text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-cyan-500 transition-all"
                />
              </div>

              {/* Side Filter */}
              <select
                value={sideFilter}
                onChange={(e) => setSideFilter(e.target.value as "all" | "buy" | "sell")}
                className="px-4 py-2 bg-zinc-900 border border-zinc-700 rounded-lg text-sm text-zinc-100 focus:outline-none focus:border-cyan-500 transition-all cursor-pointer"
              >
                <option value="all">All Sides</option>
                <option value="buy">Buy Only</option>
                <option value="sell">Sell Only</option>
              </select>

              {/* Include Canceled (only for "ended" tab) */}
              {activeTab === "ended" && (
                <button
                  onClick={() => setShowCanceled(!showCanceled)}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg bg-zinc-800/50 hover:bg-zinc-800 border border-zinc-700 transition-all text-sm whitespace-nowrap"
                >
                  <div className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-all ${
                    showCanceled 
                      ? 'bg-cyan-600 border-cyan-600' 
                      : 'border-zinc-600'
                  }`}>
                    {showCanceled && (
                      <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </div>
                  <span className="text-zinc-300">Include canceled</span>
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
                <tr className="border-b border-zinc-800">
                  <th className="text-left py-3 px-4 text-xs font-semibold text-zinc-400 uppercase tracking-wider">Project</th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-zinc-400 uppercase tracking-wider">Type</th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-zinc-400 uppercase tracking-wider">Side</th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-zinc-400 uppercase tracking-wider">Status</th>
                  <th className="text-right py-3 px-4 text-xs font-semibold text-zinc-400 uppercase tracking-wider">Amount</th>
                  <th className="text-right py-3 px-4 text-xs font-semibold text-zinc-400 uppercase tracking-wider">Price</th>
                  <th className="text-right py-3 px-4 text-xs font-semibold text-zinc-400 uppercase tracking-wider">Total</th>
                  <th className="text-center py-3 px-4 text-xs font-semibold text-zinc-400 uppercase tracking-wider">Progress</th>
                  <th className="text-center py-3 px-4 text-xs font-semibold text-zinc-400 uppercase tracking-wider">Escrow</th>
                  <th className="text-right py-3 px-4 text-xs font-semibold text-zinc-400 uppercase tracking-wider">Actions</th>
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
                className="border-b border-zinc-800/50 hover:bg-zinc-900/50 transition-all group"
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
                    <Badge className="bg-purple-600 text-xs flex items-center gap-1 w-fit">
                      <Lock className="w-3 h-3" />
                      Private
                    </Badge>
                  ) : (
                    <Badge className="bg-zinc-700 text-xs w-fit">
                      Public
                    </Badge>
                  )}
                </td>

                {/* Side */}
                <td className="py-4 px-4">
                  <Badge className={order.isSell ? "bg-red-600 text-xs" : "bg-green-600 text-xs"}>
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
                  <span className="font-medium text-cyan-400 text-sm">
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
                    <div className={`w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold ${
                      order.status >= 0 ? 'bg-orange-500 text-white' : 'bg-zinc-800 text-zinc-600'
                    }`}>1</div>
                    <div className={`h-0.5 w-3 ${order.status >= 1 ? 'bg-blue-500' : 'bg-zinc-800'}`}></div>
                    <div className={`w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold ${
                      order.status >= 1 ? 'bg-blue-500 text-white' : 'bg-zinc-800 text-zinc-600'
                    }`}>2</div>
                    <div className={`h-0.5 w-3 ${order.status >= 2 ? 'bg-violet-600' : 'bg-zinc-800'}`}></div>
                    <div className={`w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold ${
                      order.status >= 2 ? 'bg-violet-600 text-white' : 'bg-zinc-800 text-zinc-600'
                    }`}>3</div>
                    <div className={`h-0.5 w-3 ${order.status === 3 ? 'bg-emerald-600' : order.status >= 4 ? 'bg-red-700' : 'bg-zinc-800'}`}></div>
                    <div className={`w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold ${
                      order.status === 3 ? 'bg-emerald-600 text-white' : 
                      order.status === 4 ? 'bg-orange-600 text-white' : 
                      order.status === 5 ? 'bg-red-700 text-white' : 
                      'bg-zinc-800 text-zinc-600'
                    }`}>{order.status === 3 ? '✓' : order.status === 4 ? 'D' : order.status === 5 ? '✗' : '4'}</div>
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
                        className="bg-purple-600 hover:bg-purple-700 text-xs px-2 py-1 whitespace-nowrap h-7"
                        title="Copy shareable link"
                      >
                        <Copy className="w-3 h-3 mr-1 inline" />
                        Copy Link
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
                        className="bg-cyan-600 hover:bg-cyan-700 text-xs px-2 py-1 whitespace-nowrap h-7"
                      >
                        {locking === order.id.toString() ? (
                          <Loader2 className="w-3 h-3 mr-1 inline animate-spin" />
                        ) : (
                          <Lock className="w-3 h-3 mr-1 inline" />
                        )}
                        {locking === order.id.toString() ? "Locking..." : "Lock"}
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
                        className="bg-red-600 hover:bg-red-700 text-xs px-2 py-1 h-7"
                      >
                        {canceling === order.id.toString() ? (
                          <>
                            <Loader2 className="w-3 h-3 mr-1 inline animate-spin" />
                            Canceling...
                          </>
                        ) : "Cancel"}
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
