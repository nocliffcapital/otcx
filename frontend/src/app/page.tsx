"use client";

import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import ProjectReputationBadge from "@/components/ProjectReputationBadge";
import { ProjectImage } from "@/components/ProjectImage";
import { useReadContract, usePublicClient, useBlockNumber } from "wagmi";
import { REGISTRY_ADDRESS, PROJECT_REGISTRY_ABI, ORDERBOOK_ADDRESS, ESCROW_ORDERBOOK_ABI, STABLE_DECIMALS, slugToProjectId } from "@/lib/contracts";
import { useEffect, useState } from "react";
import { formatUnits } from "viem";
import { TrendingUp, SearchX, DollarSign, Clock, Activity, Terminal, Cpu, Zap, Database, GitBranch, Code2, Network } from "lucide-react";

// Smart decimal formatting based on price
function formatPrice(price: number): string {
  if (price >= 100) return price.toFixed(2);     // $100+ → 2 decimals
  if (price >= 10) return price.toFixed(3);      // $10-$99 → 3 decimals
  if (price >= 1) return price.toFixed(4);       // $1-$9 → 4 decimals
  return price.toFixed(6);                       // <$1 → 6 decimals
}

type Project = {
  slug: string;
  name: string;
  tokenAddress: `0x${string}`;
  assetType: string;
  active: boolean;
  addedAt: bigint;
  twitterUrl?: string;
  websiteUrl?: string;
  description?: string;
  metadataURI?: string;
};

type ProjectStats = {
  lowestAsk: number | null;  // Lowest sell price
  highestBid: number | null;  // Highest buy price
  lastPrice: number | null;  // Last filled order price
  orderCount: number;
  totalVolume: number;  // Total USDC volume across all orders
  tradeCount: number;  // Number of filled/matched orders (trades)
};

export default function ProjectsPage() {
  const publicClient = usePublicClient();
  const { data: projectsData, isLoading } = useReadContract({
    address: REGISTRY_ADDRESS,
    abi: PROJECT_REGISTRY_ABI,
    functionName: "getActiveProjects",
  });
  
  const [projects, setProjects] = useState<Project[]>([]);

  // Check if orderbook is paused
  const { data: isPausedData } = useReadContract({
    address: ORDERBOOK_ADDRESS,
    abi: ESCROW_ORDERBOOK_ABI,
    functionName: "paused",
  });
  const isOrderbookPaused = isPausedData === true;

  // Get current block number for nerdy display
  const { data: blockNumber } = useBlockNumber({ watch: true });

  const [projectStats, setProjectStats] = useState<Record<string, ProjectStats>>({});
  const [loadingStats, setLoadingStats] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [assetFilter, setAssetFilter] = useState<"all" | "Tokens" | "Points">("all");
  // Default to cards for 1-3 projects, list for 4+ projects
  // Initial value will be updated in useEffect based on project count
  const [viewMode, setViewMode] = useState<"cards" | "list">("cards");
  const [marketTab, setMarketTab] = useState<"live" | "ended">("live");
  const [sortBy, setSortBy] = useState<"name" | "price" | "volume" | "orders">("volume");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");
  const [projectTgeStatus, setProjectTgeStatus] = useState<Record<string, boolean>>({});

  // V4: getActiveProjects returns only active projects with full metadata
  // Inactive projects are filtered out on-chain for efficiency
  useEffect(() => {
    if (!projectsData) {
      console.log('[DEBUG] No projectsData:', projectsData);
      return;
    }
    
    console.log('[DEBUG] Received projectsData:', projectsData);
    console.log('[DEBUG] Registry address:', REGISTRY_ADDRESS);
    console.log('[DEBUG] Type of projectsData:', typeof projectsData, Array.isArray(projectsData));
    
    try {
      // V4: Projects from getActiveProjects have all on-chain data
      // metadataURI points to IPFS for logo, description, twitter, website
      const mappedProjects = (projectsData as any[]).map((proj) => {
        return {
          slug: proj.name.toLowerCase().replace(/\s+/g, '-'), // Derive slug from name for now
          name: proj.name,
          tokenAddress: proj.tokenAddress,
          assetType: proj.isPoints ? 'Points' : 'Tokens', // V3: isPoints (bool) -> assetType (string)
          active: proj.active,
          addedAt: proj.addedAt,
          metadataURI: proj.metadataURI || '',
          // V3: twitterUrl, websiteUrl, description are in IPFS metadata
          // ProjectImage component will fetch them when needed
          twitterUrl: '',
          websiteUrl: '',
          description: '',
        };
      });
      
      console.log('[DEBUG] Mapped projects:', mappedProjects);
      setProjects(mappedProjects);
    } catch (error) {
      console.error('[V3] Error mapping projects:', error);
      console.error('[DEBUG] Error details:', error);
    }
  }, [projectsData]);

  // Set default view mode based on project count: cards for 1-3 projects, list for 4+
  useEffect(() => {
    if (projects.length > 0) {
      const projectCount = projects.length;
      // Only set default if we're at initial state (no user preference stored)
      // Default to cards for 1-3 projects, list for 4+ projects
      if (projectCount <= 3) {
        setViewMode("cards");
      } else {
        setViewMode("list");
      }
    }
  }, [projects.length]);

  useEffect(() => {
    if (!publicClient || !projects || projects.length === 0) return;

    let isInitialLoad = true;

    const fetchStats = async () => {
      try {
        // Only show loading spinner on initial load, not on refreshes
        if (isInitialLoad) {
          setLoadingStats(true);
          isInitialLoad = false;
        }
        
        // Get next order ID
        const nextId = await publicClient.readContract({
          address: ORDERBOOK_ADDRESS,
          abi: ESCROW_ORDERBOOK_ABI,
          functionName: "nextId",
        }) as bigint;

        // Fetch all orders in parallel for better performance
        const allOrders: Array<{ id: bigint; projectToken: string; amount: bigint; unitPrice: bigint; isSell: boolean; status: number }> = [];
        const orderPromises: Promise<void>[] = [];
        
        for (let i = 1n; i < nextId; i++) {
          const orderPromise = (async (orderId: bigint) => {
            try {
              // V4 Order struct: id, maker, buyer, seller, projectId, amount, unitPrice, buyerFunds, sellerCollateral, settlementDeadline, isSell, allowedTaker, status
              const orderData = await publicClient.readContract({
                address: ORDERBOOK_ADDRESS,
                abi: ESCROW_ORDERBOOK_ABI,
                functionName: "orders",
                args: [orderId],
              }) as readonly [bigint, `0x${string}`, `0x${string}`, `0x${string}`, `0x${string}`, bigint, bigint, bigint, bigint, bigint, boolean, `0x${string}`, number];

              allOrders.push({
                id: orderData[0],
                projectToken: orderData[4],  // projectId (bytes32)
                amount: orderData[5],
                unitPrice: orderData[6],
                isSell: orderData[10],
                status: orderData[12],  // V4: status is at index 12 (after allowedTaker at index 11)
              });
            } catch (err) {
              console.error(`Failed to fetch order ${orderId}:`, err);
            }
          })(i);
          
          orderPromises.push(orderPromise);
        }
        
        // Wait for all orders with a timeout
        await Promise.race([
          Promise.all(orderPromises),
          new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout fetching orders')), 30000))
        ]).catch(err => {
          console.warn('Some orders failed to load:', err);
        });

        // Fetch TGE status for each project
        const tgeStatusMap: Record<string, boolean> = {};
        const tgePromises = (projects as Project[]).map(async (project) => {
          try {
            const projectId = slugToProjectId(project.slug);
            const tgeActivated = await publicClient.readContract({
              address: ORDERBOOK_ADDRESS,
              abi: ESCROW_ORDERBOOK_ABI,
              functionName: "projectTgeActivated",
              args: [projectId],
            }) as boolean;
            tgeStatusMap[project.slug] = tgeActivated;
          } catch (err) {
            console.error(`Failed to fetch TGE status for ${project.slug}:`, err);
            tgeStatusMap[project.slug] = false;
          }
        });

        await Promise.all(tgePromises);
        setProjectTgeStatus(tgeStatusMap);

        // Calculate stats for each project
        const stats: Record<string, ProjectStats> = {};
        
        // V3: Filter orders by projectId (bytes32) instead of tokenAddress
        (projects as Project[]).forEach((project) => {
          const projectId = slugToProjectId(project.slug);
          
          // Get all orders for this project
          const allProjectOrders = allOrders.filter(
            o => typeof o.projectToken === 'string' && 
            o.projectToken.toLowerCase() === projectId.toLowerCase()
          );
          
          // V4: OPEN orders (status 0) - these show in the orderbook
          const openOrders = allProjectOrders.filter(o => o.status === 0);
          
          // V3: "Filled" orders for volume/price calculation = FUNDED (1), TGE_ACTIVATED (2), SETTLED (3)
          // These are orders that have been matched and have real price data
          const filledOrders = allProjectOrders
            .filter(o => o.status === 1 || o.status === 2 || o.status === 3)
            .sort((a, b) => Number(b.id) - Number(a.id));

          // For orderbook display: only OPEN orders
          const sellOrders = openOrders.filter(o => o.isSell);
          const buyOrders = openOrders.filter(o => !o.isSell);

          const lowestAsk = sellOrders.length > 0
            ? Math.min(...sellOrders.map(o => parseFloat(formatUnits(o.unitPrice, STABLE_DECIMALS))))
            : null;

          const highestBid = buyOrders.length > 0
            ? Math.max(...buyOrders.map(o => parseFloat(formatUnits(o.unitPrice, STABLE_DECIMALS))))
            : null;
          
          // Last price from most recent filled/matched order (highest ID = most recent)
          const lastPrice = filledOrders.length > 0
            ? parseFloat(formatUnits(filledOrders[0].unitPrice, STABLE_DECIMALS))
            : null;

          // Calculate total volume from filled orders (actual trades)
          const filledVolume = filledOrders.reduce((sum, order) => {
            const amount = parseFloat(formatUnits(order.amount, 18));
            const price = parseFloat(formatUnits(order.unitPrice, STABLE_DECIMALS));
            return sum + (amount * price);
          }, 0);
          
          // Calculate potential volume from open orders
          const openVolume = openOrders.reduce((sum, order) => {
            const amount = parseFloat(formatUnits(order.amount, 18));
            const price = parseFloat(formatUnits(order.unitPrice, STABLE_DECIMALS));
            return sum + (amount * price);
          }, 0);
          
          // Total volume = filled + open orders
          const totalVolume = filledVolume + openVolume;

          stats[project.slug] = {
            lowestAsk,
            highestBid,
            lastPrice,
            orderCount: openOrders.length, // Only count OPEN orders
            totalVolume,
            tradeCount: filledOrders.length, // Number of filled/matched orders
          };
        });

        setProjectStats(stats);
      } catch (error) {
        console.error("Error fetching project stats:", error);
      } finally {
        setLoadingStats(false);
      }
    };

    fetchStats();
    
    // Refresh every 30 seconds
    const interval = setInterval(fetchStats, 30000);
    return () => clearInterval(interval);
  }, [publicClient, projects]);

  // Calculate global stats
  const globalStats = {
    total24hVolume: Object.values(projectStats).reduce((sum, stats) => sum + stats.totalVolume, 0),
    totalTrades: Object.values(projectStats).reduce((sum, stats) => sum + (stats.tradeCount || 0), 0),
    liveMarkets: projects.filter(p => p.active).length,  // Active = open for trading
    totalMarkets: projects.length,
  };

  // Filter projects based on search query, asset type, and market tab
  const filteredProjects = projects 
    ? (projects as Project[])
        .filter(project => {
          const matchesSearch = project.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            project.slug.toLowerCase().includes(searchQuery.toLowerCase()) ||
            project.assetType.toLowerCase().includes(searchQuery.toLowerCase());
          
          const matchesAssetType = assetFilter === "all" || project.assetType === assetFilter;
          
          // Market tab filtering
          const tgeActivated = projectTgeStatus[project.slug] || false;
          const matchesTab = 
            marketTab === "live" ? (project.active && !tgeActivated) :  // Live = active AND TGE not activated
            marketTab === "ended" ? tgeActivated :  // Ended = TGE has been activated (regardless of active status)
            false;
          
          return matchesSearch && matchesAssetType && matchesTab;
        })
        .sort((a, b) => {
          const statsA = projectStats[a.slug];
          const statsB = projectStats[b.slug];
          
          let comparison = 0;
          switch (sortBy) {
            case "name":
              comparison = a.name.localeCompare(b.name);
              break;
            case "price":
              const priceA = statsA?.lastPrice || statsA?.lowestAsk || 0;
              const priceB = statsB?.lastPrice || statsB?.lowestAsk || 0;
              comparison = priceA - priceB;
              break;
            case "volume":
              comparison = (statsA?.totalVolume || 0) - (statsB?.totalVolume || 0);
              break;
            case "orders":
              comparison = (statsA?.orderCount || 0) - (statsB?.orderCount || 0);
              break;
          }
          
          return sortDirection === "asc" ? comparison : -comparison;
        })
    : [];

  return (
    <div className="relative min-h-screen" style={{ backgroundColor: '#06060c' }}>
      {/* Cyberpunk scanlines effect */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute inset-0 bg-gradient-to-b from-[#2b2b30]/30 via-transparent to-[#2b2b30]/30"></div>
        <div className="absolute inset-0" style={{
          backgroundImage: 'repeating-linear-gradient(0deg, rgba(0,0,0,0.15) 0px, transparent 1px, transparent 2px, rgba(0,0,0,0.15) 3px)',
          backgroundSize: '100% 3px'
        }}></div>
      </div>

      {/* Corner tech brackets */}
      <div className="fixed top-16 left-0 w-32 h-32 pointer-events-none">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-[#2b2b30] to-transparent"></div>
        <div className="absolute top-0 left-0 w-1 h-full bg-gradient-to-b from-[#2b2b30] to-transparent"></div>
      </div>
      <div className="fixed top-16 right-0 w-32 h-32 pointer-events-none">
        <div className="absolute top-0 right-0 w-full h-1 bg-gradient-to-l from-[#2b2b30] to-transparent"></div>
        <div className="absolute top-0 right-0 w-1 h-full bg-gradient-to-b from-[#2b2b30] to-transparent"></div>
      </div>
      
      <div className="relative mx-auto max-w-7xl px-4 py-8">
        <div className="mb-8">
          {/* Terminal-style header */}
          <div className="border border-[#2b2b30] rounded-lg p-4 mb-6 backdrop-blur-sm font-mono" style={{ backgroundColor: '#121218' }}>
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <div className="border rounded flex items-center justify-center flex-shrink-0" style={{ 
                  width: '56px', 
                  height: '56px',
                  borderColor: '#2b2b30'
                }}>
                  <TrendingUp className="w-10 h-10 text-zinc-300" />
                </div>
                <div className="min-w-0 flex-1">
                  <span className="text-zinc-300 text-xs mb-1 block">otcX://protocol/markets/v4</span>
                  <h1 className="text-2xl md:text-3xl font-bold text-white tracking-tight break-words">
                    MARKETS_EXPLORER
                  </h1>
                  <p className="text-xs text-zinc-300/70 mt-1 break-words">
                    Pre-TGE OTC Protocol • Sepolia Testnet
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

        {/* Top Stats - Terminal Style */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
          {/* Total Volume */}
          <div className="border border-[#2b2b30] rounded p-4 backdrop-blur-sm hover:border-zinc-500 transition-all" style={{ backgroundColor: '#121218' }}>
            <div className="flex items-center gap-2 mb-2">
              <Zap className="w-4 h-4 text-zinc-300" />
              <span className="text-xs font-mono text-zinc-300 uppercase">TOTAL VOLUME</span>
            </div>
            <div className="font-mono">
              {loadingStats ? (
                <div className="h-8 w-32 bg-[#2b2b30] rounded animate-pulse mb-1"></div>
              ) : (
                <div className="text-2xl font-bold text-white mb-1">
                  ${globalStats.total24hVolume.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                </div>
              )}
              <div className="text-xs text-zinc-500">
                <span className="text-green-400">{loadingStats ? '...' : globalStats.totalTrades}</span> trades completed
              </div>
            </div>
          </div>

          {/* Projects Live */}
          <div className="border border-green-500/30 rounded p-4 backdrop-blur-sm hover:border-green-500/60 transition-all" style={{ backgroundColor: '#121218' }}>
            <div className="flex items-center gap-2 mb-2">
              <Activity className="w-4 h-4 text-green-400" />
              <span className="text-xs font-mono text-green-400 uppercase">PROJECTS LIVE</span>
            </div>
            <div className="font-mono">
              {loadingStats ? (
                <div className="h-8 w-16 bg-[#2b2b30] rounded animate-pulse mb-1"></div>
              ) : (
                <div className="text-2xl font-bold text-white mb-1">
                  {globalStats.liveMarkets}
                </div>
              )}
              <div className="text-xs text-zinc-500">
                <span className="text-green-400 animate-pulse">●</span> trading now
              </div>
            </div>
          </div>

          {/* Total Ended */}
          <div className="border border-red-500/30 rounded p-4 backdrop-blur-sm hover:border-red-500/60 transition-all" style={{ backgroundColor: '#121218' }}>
            <div className="flex items-center gap-2 mb-2">
              <Clock className="w-4 h-4 text-red-400" />
              <span className="text-xs font-mono text-red-400 uppercase">TOTAL ENDED</span>
            </div>
            <div className="font-mono">
              {loadingStats ? (
                <div className="h-8 w-16 bg-[#2b2b30] rounded animate-pulse mb-1"></div>
              ) : (
                <div className="text-2xl font-bold text-white mb-1">
                  {projects.filter(p => projectTgeStatus[p.slug]).length}
                </div>
              )}
              <div className="text-xs text-zinc-500">
                markets closed
              </div>
            </div>
          </div>

          {/* Currently in Settlement */}
          <div className="border border-orange-500/30 rounded p-4 backdrop-blur-sm hover:border-orange-500/60 transition-all" style={{ backgroundColor: '#121218' }}>
            <div className="flex items-center gap-2 mb-2">
              <GitBranch className="w-4 h-4 text-orange-400" />
              <span className="text-xs font-mono text-orange-400 uppercase">IN SETTLEMENT</span>
            </div>
            <div className="font-mono">
              {loadingStats ? (
                <div className="h-8 w-16 bg-[#2b2b30] rounded animate-pulse mb-1"></div>
              ) : (
                <div className="text-2xl font-bold text-white mb-1">
                  {projects.filter(p => projectTgeStatus[p.slug]).length}
                </div>
              )}
              <div className="text-xs text-zinc-500">
                <span className="text-orange-400">●</span> active settlements
              </div>
            </div>
          </div>
        </div>

        {/* Tabs - Terminal Style */}
        <div className="flex items-center gap-2 mb-6 rounded border p-1" style={{ backgroundColor: '#121218', borderColor: '#2b2b30' }}>
          <button
            onClick={() => setMarketTab("live")}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-mono font-medium transition-all rounded ${
              marketTab === "live"
                ? "bg-green-500/20 text-green-400 border border-green-500/50"
                : "text-zinc-400 hover:text-zinc-300 hover:bg-[#2b2b30]"
            }`}
          >
            <div className={`w-2 h-2 rounded-full ${marketTab === "live" ? "bg-green-400 animate-pulse" : "bg-zinc-600"}`}></div>
            <span>LIVE</span>
            <span className="text-xs px-1.5 py-0.5 rounded bg-green-500/30">
              {projects.filter(p => p.active && !projectTgeStatus[p.slug]).length}
            </span>
          </button>
          <button
            onClick={() => setMarketTab("ended")}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-mono font-medium transition-all rounded ${
              marketTab === "ended"
                ? "bg-red-500/20 text-red-400 border border-red-500/50"
                : "text-zinc-400 hover:text-zinc-300 hover:bg-[#2b2b30]"
            }`}
          >
            <div className={`w-2 h-2 rounded-full ${marketTab === "ended" ? "bg-red-400" : "bg-zinc-600"}`}></div>
            <span>ENDED</span>
            <span className="text-xs px-1.5 py-0.5 rounded bg-red-500/30">
              {projects.filter(p => projectTgeStatus[p.slug]).length}
            </span>
          </button>
        </div>
        
        {/* Search Bar and Request Button */}
        <div className="flex gap-4 items-center justify-between mb-4">
          <div className="relative w-full max-w-md">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Terminal className="h-4 w-4 text-zinc-300" />
            </div>
            <input
              type="text"
              placeholder="Search projects..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 text-sm font-mono border border-[#2b2b30] rounded text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-zinc-500 focus:border-zinc-500 transition-all"
              style={{ backgroundColor: '#121218' }}
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-zinc-300 hover:text-white transition-colors"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>

          <Link href="/request">
            <button className="px-4 py-2.5 text-sm font-mono font-medium text-zinc-300 border border-[#2b2b30] rounded whitespace-nowrap transition-all hover:bg-[#2b2b30] hover:border-zinc-500 flex items-center gap-2">
              <span>+</span> REQUEST PROJECT
            </button>
          </Link>
        </div>

        {/* Asset Type Filter and View Toggle */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex gap-2 font-mono">
            <button
              onClick={() => setAssetFilter("all")}
              className={`px-4 py-2 text-xs font-medium rounded border transition-all ${
                assetFilter === "all" 
                  ? "bg-zinc-700 text-zinc-300 border-zinc-500" 
                  : "text-zinc-400 hover:border-zinc-700"
              }`}
              style={assetFilter !== "all" ? { backgroundColor: '#121218', borderColor: '#2b2b30' } : {}}
            >
              ALL
            </button>
            <button
              onClick={() => setAssetFilter("Tokens")}
              className={`px-4 py-2 text-xs font-medium rounded border transition-all ${
                assetFilter === "Tokens" 
                  ? "bg-blue-500/20 text-blue-400 border-blue-500/50" 
                  : "text-zinc-400 hover:border-zinc-700"
              }`}
              style={assetFilter !== "Tokens" ? { backgroundColor: '#121218', borderColor: '#2b2b30' } : {}}
            >
              TOKENS
            </button>
            <button
              onClick={() => setAssetFilter("Points")}
              className={`px-4 py-2 text-xs font-medium rounded border transition-all ${
                assetFilter === "Points" 
                  ? "bg-purple-500/20 text-purple-400 border-purple-500/50" 
                  : "text-zinc-400 hover:border-zinc-700"
              }`}
              style={assetFilter !== "Points" ? { backgroundColor: '#121218', borderColor: '#2b2b30' } : {}}
            >
              POINTS
            </button>
          </div>

          {/* View Toggle */}
          <div className="flex gap-2 rounded border p-1" style={{ backgroundColor: '#121218', borderColor: '#2b2b30' }}>
            <button
              onClick={() => setViewMode("list")}
              className={`p-2 rounded transition-all ${
                viewMode === "list" 
                  ? "bg-zinc-700 text-zinc-300 border border-zinc-500" 
                  : "text-zinc-400 hover:bg-[#2b2b30]"
              }`}
              title="List View"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            <button
              onClick={() => setViewMode("cards")}
              className={`p-2 rounded transition-all ${
                viewMode === "cards" 
                  ? "bg-zinc-700 text-zinc-300 border border-zinc-500" 
                  : "text-zinc-400 hover:bg-[#2b2b30]"
              }`}
              title="Card View"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {isLoading && (
        <div className="text-center text-zinc-400 py-8">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-zinc-400"></div>
          <p className="mt-4">Loading projects...</p>
        </div>
      )}

      {/* Card View */}
      {viewMode === "cards" && !isLoading && projects && projects.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 px-4">
          <div className="border border-[#2b2b30] rounded p-8 backdrop-blur-sm max-w-2xl" style={{ backgroundColor: '#121218' }}>
            <div className="flex items-center gap-3 mb-4 font-mono text-zinc-300">
              <Terminal className="w-5 h-5" />
              <span className="text-sm">otcX://protocol/markets</span>
            </div>
            <div className="bg-[#06060c] border border-red-500/30 rounded p-4 mb-4 font-mono text-sm">
              <div className="flex items-center gap-2 text-red-400 mb-2">
                <span className="font-bold">ERROR:</span>
                <span>No active markets found</span>
              </div>
              <div className="text-zinc-500 text-xs space-y-1 pl-4">
                <div>→ query returned 0 results</div>
                <div>→ registry.getActiveProjects() = []</div>
                <div>→ status: EMPTY_STATE</div>
              </div>
            </div>
            <div className="space-y-3 font-mono text-sm">
              <div className="text-zinc-400">
                No projects are currently listed on the platform.
              </div>
              <div className="text-zinc-400">
                Check back soon or submit a new project request.
              </div>
            </div>
            <div className="mt-6 pt-6 border-t border-[#2b2b30]">
              <Link href="/request">
                <button className="w-full px-6 py-3 text-sm font-mono font-medium text-zinc-300 border border-[#2b2b30] rounded transition-all hover:bg-[#2b2b30] hover:border-zinc-500 flex items-center justify-center gap-2">
                  <span>+</span> REQUEST NEW PROJECT
                </button>
              </Link>
            </div>
          </div>
        </div>
      )}

      {viewMode === "cards" && projects && projects.length > 0 && (
        <>
        {filteredProjects.length === 0 && projects && projects.length > 0 ? (
          <div className="flex flex-col items-center justify-center py-12 px-4">
            <div className="bg-[#121218] border border-yellow-500/30 rounded p-8 backdrop-blur-sm max-w-2xl">
              <div className="flex items-center gap-3 mb-4 font-mono text-yellow-400">
                <Terminal className="w-5 h-5" />
                <span className="text-sm">otcX://protocol/search</span>
              </div>
              <div className="bg-[#06060c] border border-yellow-500/30 rounded p-4 mb-4 font-mono text-sm">
                <div className="flex items-center gap-2 text-yellow-400 mb-2">
                  <span className="font-bold">WARN:</span>
                  <span>No results found for query</span>
                </div>
                <div className="text-zinc-500 text-xs space-y-1 pl-4">
                  <div>→ search_query: &quot;{searchQuery}&quot;</div>
                  <div>→ filter: {assetFilter}</div>
                  <div>→ matches: 0</div>
                </div>
              </div>
              <div className="space-y-3 font-mono text-sm">
                <div className="text-zinc-400">
                  No projects match your current search criteria.
                </div>
                <div className="text-zinc-400">
                  Try adjusting filters or search terms.
                </div>
              </div>
              <div className="mt-6 pt-6 border-t border-yellow-500/30">
                <button 
                  onClick={() => {
                    setSearchQuery("");
                    setAssetFilter("all");
                  }}
                  className="w-full px-6 py-3 text-sm font-mono font-medium text-yellow-400 border border-yellow-500/30 rounded transition-all hover:bg-yellow-500/10 hover:border-yellow-500/60 flex items-center justify-center gap-2"
                >
                  <span>↻</span> RESET FILTERS
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredProjects.map((project) => {
          const stats = projectStats[project.slug];
          const spread = stats?.lowestAsk && stats?.highestBid 
            ? ((stats.lowestAsk - stats.highestBid) / stats.highestBid * 100).toFixed(2)
            : null;
          
          return (
            <Link key={project.slug} href={`/markets/${project.slug}`}>
              <div className="bg-[#121218] border border-[#2b2b30] hover:border-zinc-500 hover:shadow-lg hover:shadow-zinc-500/20 cursor-pointer h-full group transition-all backdrop-blur-sm rounded">
                {/* Terminal-style header */}
                <div className="bg-gradient-to-r from-[#2b2b30]/50 to-[#2b2b30]/50 border-b border-[#2b2b30] px-3 py-2 font-mono text-xs flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse"></div>
                    <span className="text-zinc-300 uppercase">{project.slug}</span>
                  </div>
                  <Badge className={`text-xs font-mono ${project.assetType === "Points" ? "bg-purple-500/20 text-purple-400 border border-purple-500/50" : "bg-blue-500/20 text-blue-400 border border-blue-500/50"}`}>
                    {project.assetType}
                  </Badge>
                </div>

                <div className="p-4">
                  <div className="flex items-center gap-3 mb-4">
                    {/* Project Icon */}
                    <div className="relative">
                      <ProjectImage 
                        metadataURI={project.metadataURI}
                        imageType="icon"
                        className="w-14 h-14 rounded object-cover flex-shrink-0 border-2 border-[#2b2b30] group-hover:border-zinc-500 transition-all"
                        fallbackText={project.name.charAt(0).toUpperCase()}
                      />
                      <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-500 rounded-full border-2 border-black"></div>
                    </div>
                    
                    {/* Project Info */}
                    <div className="flex-1 min-w-0">
                      <h3 className="font-bold text-lg text-white mb-0.5">{project.name}</h3>
                      <div className="font-mono text-xs text-zinc-500">
                        ID: {slugToProjectId(project.slug).slice(0, 10)}...
                      </div>
                    </div>
                  </div>
                  
                  {/* Price Stats - Terminal Style */}
                  {!loadingStats && stats ? (
                    <div className="space-y-2 font-mono text-xs">
                      <div className="flex justify-between items-center bg-[#06060c] px-2 py-1.5 rounded">
                        <span className="text-zinc-500">last_price</span>
                        <span className="font-bold text-zinc-300">
                          {stats.lastPrice !== null ? `$${formatPrice(stats.lastPrice)}` : "null"}
                        </span>
                      </div>
                      <div className="flex justify-between items-center bg-[#06060c] px-2 py-1.5 rounded">
                        <span className="text-zinc-500">best_ask</span>
                        <span className="font-bold text-red-400">
                          {stats.lowestAsk !== null ? `$${formatPrice(stats.lowestAsk)}` : "null"}
                        </span>
                      </div>
                      <div className="flex justify-between items-center bg-[#06060c] px-2 py-1.5 rounded">
                        <span className="text-zinc-500">best_bid</span>
                        <span className="font-bold text-green-400">
                          {stats.highestBid !== null ? `$${formatPrice(stats.highestBid)}` : "null"}
                        </span>
                      </div>
                      <div className="flex justify-between items-center bg-[#06060c] px-2 py-1.5 rounded">
                        <span className="text-zinc-500">spread</span>
                        <span className="font-bold text-orange-400">
                          {spread ? `${spread}%` : "null"}
                        </span>
                      </div>
                      <div className="flex justify-between items-center bg-gradient-to-r from-[#2b2b30]/50 to-[#2b2b30]/50 px-2 py-1.5 rounded border border-[#2b2b30] mt-3">
                        <span className="text-zinc-300">volume</span>
                        <span className="font-bold text-white">
                          ${stats.totalVolume.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                        </span>
                      </div>
                      <div className="text-xs text-zinc-600 mt-2 flex items-center justify-between">
                        <span>{stats.orderCount} orders</span>
                        <span>{stats.tradeCount} trades</span>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <div className="h-6 bg-[#2b2b30] rounded animate-pulse"></div>
                      <div className="h-6 bg-[#2b2b30] rounded animate-pulse"></div>
                      <div className="h-6 bg-[#2b2b30] rounded animate-pulse"></div>
                    </div>
                  )}
                  
                  <div className="mt-4 text-xs font-mono text-zinc-300 group-hover:text-white transition-colors flex items-center gap-2 justify-center py-2 border border-[#2b2b30] rounded group-hover:bg-[#2b2b30]">
                    <span>ENTER MARKET</span>
                    <span className="group-hover:translate-x-1 transition-transform">→</span>
                  </div>
                </div>
              </div>
            </Link>
          );
        })}
        </div>
        )}
        </>
      )}

      {/* List View - Terminal Table */}
      {viewMode === "list" && (
        <div className="overflow-x-auto bg-[#121218] border border-[#2b2b30] rounded backdrop-blur-sm">
          <table className="w-full table-fixed font-mono text-xs">
            <colgroup>
              <col style={{ width: '60px' }} />
              <col style={{ width: '180px' }} />
              <col style={{ width: '100px' }} />
              <col style={{ width: '110px' }} />
              <col style={{ width: '130px' }} />
              <col style={{ width: '110px' }} />
              <col style={{ width: '110px' }} />
              <col style={{ width: '110px' }} />
              <col style={{ width: '130px' }} />
              <col style={{ width: '100px' }} />
              <col style={{ width: '60px' }} />
            </colgroup>
            <thead className="bg-gradient-to-r from-[#2b2b30]/50 to-[#2b2b30]/50">
              <tr className="border-b border-[#2b2b30]">
                <th className="text-left py-3 px-4"></th>
                <th className="text-left py-3 px-4">
                  <button
                    onClick={() => {
                      if (sortBy === "name") {
                        setSortDirection(sortDirection === "asc" ? "desc" : "asc");
                      } else {
                        setSortBy("name");
                        setSortDirection("asc");
                      }
                    }}
                    className="flex items-center gap-1 hover:text-white transition-colors text-xs font-bold text-zinc-300 uppercase tracking-wider"
                  >
                    project
                    {sortBy === "name" && (
                      <span>{sortDirection === "asc" ? "↑" : "↓"}</span>
                    )}
                  </button>
                </th>
                <th className="text-left py-3 px-4 text-xs font-bold text-zinc-300 uppercase tracking-wider">type</th>
                <th className="text-left py-3 px-4 text-xs font-bold text-zinc-300 uppercase tracking-wider">status</th>
                <th className="text-right py-3 px-4">
                  <button
                    onClick={() => {
                      if (sortBy === "price") {
                        setSortDirection(sortDirection === "asc" ? "desc" : "asc");
                      } else {
                        setSortBy("price");
                        setSortDirection("desc");
                      }
                    }}
                    className="flex items-center justify-end gap-1 hover:text-white transition-colors text-xs font-bold text-zinc-300 uppercase tracking-wider ml-auto"
                  >
                    last_price
                    {sortBy === "price" && (
                      <span>{sortDirection === "asc" ? "↑" : "↓"}</span>
                    )}
                  </button>
                </th>
                <th className="text-right py-3 px-4 text-xs font-bold text-zinc-300 uppercase tracking-wider">best_ask</th>
                <th className="text-right py-3 px-4 text-xs font-bold text-zinc-300 uppercase tracking-wider">best_bid</th>
                <th className="text-right py-3 px-4 text-xs font-bold text-zinc-300 uppercase tracking-wider whitespace-nowrap">trades</th>
                <th className="text-right py-3 px-4 whitespace-nowrap">
                  <div className="text-xs font-bold text-zinc-300 uppercase tracking-wider">
                    volume
                  </div>
                </th>
                <th className="text-right py-3 px-4">
                  <button
                    onClick={() => {
                      if (sortBy === "orders") {
                        setSortDirection(sortDirection === "asc" ? "desc" : "asc");
                      } else {
                        setSortBy("orders");
                        setSortDirection("desc");
                      }
                    }}
                    className="flex items-center justify-end gap-1 hover:text-white transition-colors text-xs font-bold text-zinc-300 uppercase tracking-wider ml-auto"
                  >
                    orders
                    {sortBy === "orders" && (
                      <span>{sortDirection === "asc" ? "↑" : "↓"}</span>
                    )}
                  </button>
                </th>
                <th className="py-3 px-4"></th>
              </tr>
            </thead>
            <tbody>
              {!projects || projects.length === 0 ? (
                <tr>
                  <td colSpan={11} className="py-12">
                    <div className="flex flex-col items-center px-4">
                      <div className="bg-[#121218] border border-[#2b2b30] rounded p-8 backdrop-blur-sm max-w-2xl">
                        <div className="flex items-center gap-3 mb-4 font-mono text-zinc-300">
                          <Terminal className="w-5 h-5" />
                          <span className="text-sm">otcX://protocol/markets</span>
                        </div>
                        <div className="bg-[#06060c] border border-red-500/30 rounded p-4 mb-4 font-mono text-sm">
                          <div className="flex items-center gap-2 text-red-400 mb-2">
                            <span className="font-bold">ERROR:</span>
                            <span>No active markets found</span>
                          </div>
                          <div className="text-zinc-500 text-xs space-y-1 pl-4">
                            <div>→ query returned 0 results</div>
                            <div>→ registry.getActiveProjects() = []</div>
                            <div>→ status: EMPTY_STATE</div>
                          </div>
                        </div>
                        <div className="space-y-3 font-mono text-sm">
                          <div className="text-zinc-400">
                            No projects are currently listed on the platform.
                          </div>
                          <div className="text-zinc-400">
                            Check back soon or submit a new project request.
                          </div>
                        </div>
                        <div className="mt-6 pt-6 border-t border-[#2b2b30]">
                          <Link href="/request">
                            <button className="w-full px-6 py-3 text-sm font-mono font-medium text-zinc-300 border border-[#2b2b30] rounded transition-all hover:bg-[#2b2b30] hover:border-zinc-500 flex items-center justify-center gap-2">
                              <span>+</span> REQUEST NEW PROJECT
                            </button>
                          </Link>
                        </div>
                      </div>
                    </div>
                  </td>
                </tr>
              ) : filteredProjects.length === 0 ? (
                <tr>
                  <td colSpan={11} className="py-12">
                    <div className="flex flex-col items-center px-4">
                      <div className="bg-[#121218] border border-yellow-500/30 rounded p-8 backdrop-blur-sm max-w-2xl">
                        <div className="flex items-center gap-3 mb-4 font-mono text-yellow-400">
                          <Terminal className="w-5 h-5" />
                          <span className="text-sm">otcX://protocol/search</span>
                        </div>
                        <div className="bg-[#06060c] border border-yellow-500/30 rounded p-4 mb-4 font-mono text-sm">
                          <div className="flex items-center gap-2 text-yellow-400 mb-2">
                            <span className="font-bold">WARN:</span>
                            <span>No results found for query</span>
                          </div>
                          <div className="text-zinc-500 text-xs space-y-1 pl-4">
                            <div>→ search_query: &quot;{searchQuery}&quot;</div>
                            <div>→ filter: {assetFilter}</div>
                            <div>→ matches: 0</div>
                          </div>
                        </div>
                        <div className="space-y-3 font-mono text-sm">
                          <div className="text-zinc-400">
                            No projects match your current search criteria.
                          </div>
                          <div className="text-zinc-400">
                            Try adjusting filters or search terms.
                          </div>
                        </div>
                        <div className="mt-6 pt-6 border-t border-yellow-500/30">
                          <button 
                            onClick={() => {
                              setSearchQuery("");
                              setAssetFilter("all");
                            }}
                            className="w-full px-6 py-3 text-sm font-mono font-medium text-yellow-400 border border-yellow-500/30 rounded transition-all hover:bg-yellow-500/10 hover:border-yellow-500/60 flex items-center justify-center gap-2"
                          >
                            <span>↻</span> RESET FILTERS
                          </button>
                        </div>
                      </div>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredProjects.map((project) => {
                const stats = projectStats[project.slug];
                
                return (
                  <tr 
                    key={project.slug}
                    onClick={() => window.location.href = `/markets/${project.slug}`}
                    className="border-b border-[#2b2b30]/50 hover:bg-[#2b2b30]/50 cursor-pointer group transition-all"
                  >
                    {/* Icon */}
                    <td className="py-3 px-4">
                      <div className="w-10 h-10 rounded overflow-hidden border-2 border-[#2b2b30] group-hover:border-zinc-500 transition-all flex-shrink-0">
                        <ProjectImage 
                          metadataURI={project.metadataURI}
                          imageType="icon"
                          className="w-full h-full object-cover"
                          fallbackText={project.name.charAt(0).toUpperCase()}
                        />
          </div>
                    </td>
                    {/* Token Name */}
                    <td className="py-3 px-4">
                      <span className="font-bold text-white">{project.name}</span>
                    </td>
                    {/* Type */}
                    <td className="py-3 px-4">
                      <span className={`px-2 py-0.5 rounded text-xs font-bold ${
                        project.assetType === "Points" 
                          ? "bg-purple-500/20 text-purple-400 border border-purple-500/50" 
                          : "bg-blue-500/20 text-blue-400 border border-blue-500/50"
                      }`}>
                        {project.assetType}
                      </span>
                    </td>
                    {/* Status */}
                    <td className="py-3 px-4">
                      {(() => {
                        const tgeActivated = projectTgeStatus[project.slug] || false;
                        if (tgeActivated) {
                          return (
                            <div className="flex items-center gap-1">
                              <div className="w-2 h-2 rounded-full bg-red-400"></div>
                              <span className="text-red-400">ENDED</span>
                            </div>
                          );
                        } else {
                          return (
                            <div className="flex items-center gap-1">
                              <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse"></div>
                              <span className="text-green-400">LIVE</span>
                            </div>
                          );
                        }
                      })()}
                    </td>
                    {/* Last Price */}
                    <td className="py-3 px-4 text-right">
                      {!loadingStats && stats ? (
                        <span className="font-bold text-zinc-300">
                          {stats.lastPrice !== null ? `$${formatPrice(stats.lastPrice)}` : "null"}
                        </span>
                      ) : (
                        <div className="h-5 w-20 bg-[#2b2b30] rounded animate-pulse ml-auto"></div>
                      )}
                    </td>
                    {/* Best Ask */}
                    <td className="py-3 px-4 text-right">
                      {!loadingStats && stats ? (
                        <span className="font-bold text-red-400">
                          {stats.lowestAsk !== null ? `$${formatPrice(stats.lowestAsk)}` : "null"}
                        </span>
                      ) : (
                        <div className="h-5 w-20 bg-[#2b2b30] rounded animate-pulse ml-auto"></div>
                      )}
                    </td>
                    {/* Best Bid */}
                    <td className="py-3 px-4 text-right">
                      {!loadingStats && stats ? (
                        <span className="font-bold text-green-400">
                          {stats.highestBid !== null ? `$${formatPrice(stats.highestBid)}` : "null"}
                        </span>
                      ) : (
                        <div className="h-5 w-20 bg-[#2b2b30] rounded animate-pulse ml-auto"></div>
                      )}
                    </td>
                    {/* Trades */}
                    <td className="py-3 px-4 text-right">
                      {!loadingStats && stats ? (
                        <span className="font-bold text-zinc-400">
                          {stats.tradeCount}
                        </span>
                      ) : (
                        <div className="h-5 w-20 bg-[#2b2b30] rounded animate-pulse ml-auto"></div>
                      )}
                    </td>
                    {/* Total Volume */}
                    <td className="py-3 px-4 text-right">
                      {!loadingStats && stats ? (
                        <span className="font-bold text-white">
                          ${stats.totalVolume.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                        </span>
                      ) : (
                        <div className="h-5 w-20 bg-[#2b2b30] rounded animate-pulse ml-auto"></div>
                      )}
                    </td>
                    {/* Orders */}
                    <td className="py-3 px-4 text-right">
                      {!loadingStats && stats ? (
                        <span className="font-bold text-zinc-300">{stats.orderCount}</span>
                      ) : (
                        <div className="h-5 w-16 bg-[#2b2b30] rounded animate-pulse ml-auto"></div>
                      )}
                    </td>
                    {/* Arrow */}
                    <td className="py-3 px-4 text-right">
                      <span className="text-zinc-300/50 group-hover:text-zinc-300 group-hover:translate-x-1 transition-all inline-block font-bold">
                        →
                      </span>
                    </td>
                  </tr>
                );
                })
              )}
            </tbody>
          </table>
        </div>
      )}
      </div>
    </div>
  );
}
