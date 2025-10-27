"use client";

import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import ProjectReputationBadge from "@/components/ProjectReputationBadge";
import { ProjectImage } from "@/components/ProjectImage";
import { useReadContract, usePublicClient } from "wagmi";
import { REGISTRY_ADDRESS, PROJECT_REGISTRY_ABI, ORDERBOOK_ADDRESS, ESCROW_ORDERBOOK_ABI, STABLE_DECIMALS, slugToProjectId } from "@/lib/contracts";
import { useEffect, useState } from "react";
import { formatUnits } from "viem";
import { TrendingUp, SearchX, DollarSign, Clock, Activity } from "lucide-react";

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

  const [projectStats, setProjectStats] = useState<Record<string, ProjectStats>>({});
  const [loadingStats, setLoadingStats] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [assetFilter, setAssetFilter] = useState<"all" | "Tokens" | "Points">("all");
  const [viewMode, setViewMode] = useState<"cards" | "list">("list");
  const [marketTab, setMarketTab] = useState<"live" | "ended">("live");
  const [sortBy, setSortBy] = useState<"name" | "price" | "volume" | "orders">("volume");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");
  const [projectTgeStatus, setProjectTgeStatus] = useState<Record<string, boolean>>({});

  // V3: getActiveProjects returns full structs with metadataURI
  // No need to fetch individually - metadata is on IPFS
  useEffect(() => {
    if (!projectsData) {
      return;
    }
    
    try {
      // V3: Projects from getActiveProjects already have all on-chain data
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
      
      setProjects(mappedProjects);
    } catch (error) {
      console.error('[V3] Error mapping projects:', error);
    }
  }, [projectsData]);

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
              // V3 Order struct: id, maker, buyer, seller, projectId, amount, unitPrice, buyerFunds, sellerCollateral, settlementDeadline, isSell, status
              const orderData = await publicClient.readContract({
                address: ORDERBOOK_ADDRESS,
                abi: ESCROW_ORDERBOOK_ABI,
                functionName: "orders",
                args: [orderId],
              }) as readonly [bigint, `0x${string}`, `0x${string}`, `0x${string}`, `0x${string}`, bigint, bigint, bigint, bigint, bigint, boolean, number];

              allOrders.push({
                id: orderData[0],
                projectToken: orderData[4],  // projectId (bytes32)
                amount: orderData[5],
                unitPrice: orderData[6],
                isSell: orderData[10],
                status: orderData[11],  // V3: status is at index 11 (removed tokensDeposited)
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
          
          // V3: OPEN orders (status 0) - these show in the orderbook
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

          // Calculate total volume (amount * price for all matched orders)
          const totalVolume = filledOrders.reduce((sum, order) => {
            const amount = parseFloat(formatUnits(order.amount, 18));
            const price = parseFloat(formatUnits(order.unitPrice, STABLE_DECIMALS));
            return sum + (amount * price);
          }, 0);

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
    <div className="relative min-h-screen">
      {/* Corner accents - tech frame */}
      <div className="fixed top-16 left-0 w-24 h-24 border-t-2 border-l-2 border-amber-500/20 pointer-events-none"></div>
      <div className="fixed top-16 right-0 w-24 h-24 border-t-2 border-r-2 border-blue-500/20 pointer-events-none"></div>
      
      <div className="relative mx-auto max-w-7xl px-4 py-8">
        <div className="mb-8">
          <div className="flex items-center justify-between mb-3">
            <h1 className="text-3xl md:text-4xl font-bold flex items-center gap-3">
              <TrendingUp className="w-8 h-8 md:w-10 md:h-10 text-cyan-400" />
              <span className="bg-gradient-to-r from-cyan-400 to-violet-400 bg-clip-text text-transparent">
                Explore Markets
              </span>
            </h1>
            <div className={`flex items-center gap-2 px-4 py-2 rounded-lg border-2 ${
              isOrderbookPaused 
                ? 'bg-red-950/30 border-red-500/50' 
                : 'bg-green-950/30 border-green-500/50'
            }`}>
              <div className={`w-2 h-2 rounded-full ${
                isOrderbookPaused ? 'bg-red-500 animate-pulse' : 'bg-green-500'
              }`} />
              <span className={`text-sm font-semibold ${
                isOrderbookPaused ? 'text-red-400' : 'text-green-400'
              }`}>
                {isOrderbookPaused ? 'Trading Paused' : 'Trading Active'}
              </span>
            </div>
          </div>
          <p className="text-lg text-zinc-400 mb-6">
            Browse pre-TGE OTC markets for tokens and points
          </p>

        {/* Top Stats Cards */}
        {!loadingStats && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-6">
            {/* 24h Volume */}
            <Card className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-zinc-800/50 rounded-xl">
                    <DollarSign className="w-6 h-6 text-zinc-400" />
                  </div>
                  <div>
                    <h3 className="text-xs text-zinc-400 uppercase tracking-wide mb-1">Pre-market 24h Vol</h3>
                    <p className="text-2xl font-bold text-white">
                      ${globalStats.total24hVolume.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                    </p>
                    <p className="text-xs text-zinc-500 mt-0.5">
                      {globalStats.totalTrades} Total Trades
                    </p>
                  </div>
                </div>
              </div>
            </Card>

            {/* Total Projects */}
            <Card className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-zinc-800/50 rounded-xl">
                    <Activity className="w-6 h-6 text-zinc-400" />
                  </div>
                  <div>
                    <h3 className="text-xs text-zinc-400 uppercase tracking-wide mb-1">Total Projects</h3>
                    <p className="text-2xl font-bold text-white">
                      {globalStats.totalMarkets}
                    </p>
                    <p className="text-xs text-zinc-500 mt-0.5">
                      {globalStats.liveMarkets} Live Markets
                    </p>
                  </div>
                </div>
              </div>
            </Card>

            {/* In Settlement */}
            <Card className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-zinc-800/50 rounded-xl">
                    <Clock className="w-6 h-6 text-zinc-400" />
                  </div>
                  <div>
                    <h3 className="text-xs text-zinc-400 uppercase tracking-wide mb-1">In Settlement</h3>
                    <p className="text-2xl font-bold text-white">
                      {projects.filter(p => projectTgeStatus[p.slug]).length}
                    </p>
                    <p className="text-xs text-zinc-500 mt-0.5">
                      {projects.filter(p => projectTgeStatus[p.slug]).length > 0 ? 'Active settlements' : 'No active settlements'}
                    </p>
                  </div>
                </div>
              </div>
            </Card>
          </div>
        )}

        {/* Tabs */}
        <div className="flex items-center gap-2 border-b border-zinc-800 mb-6">
          <button
            onClick={() => setMarketTab("live")}
            className={`px-4 py-2 text-sm font-medium transition-all relative ${
              marketTab === "live"
                ? "text-green-400"
                : "text-zinc-400 hover:text-zinc-300"
            }`}
          >
            Live
            {marketTab === "live" && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-green-400"></div>
            )}
            <Badge className="ml-2 bg-green-600 text-xs">
              {projects.filter(p => p.active && !projectTgeStatus[p.slug]).length}
            </Badge>
          </button>
          <button
            onClick={() => setMarketTab("ended")}
            className={`px-4 py-2 text-sm font-medium transition-all relative ${
              marketTab === "ended"
                ? "text-emerald-400"
                : "text-zinc-400 hover:text-zinc-300"
            }`}
          >
            Ended
            {marketTab === "ended" && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-emerald-400"></div>
            )}
            <Badge className="ml-2 bg-red-600/70 text-xs">
              {projects.filter(p => projectTgeStatus[p.slug]).length}
            </Badge>
          </button>
        </div>
        
        {/* Search Bar and Request Button */}
        <div className="flex gap-4 items-center justify-between">
          <div className="relative w-full max-w-md">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <svg className="h-4 w-4 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <input
              type="text"
              placeholder="Search projects..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 text-sm bg-zinc-900/50 border border-zinc-800 rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-zinc-400 hover:text-white transition-colors"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
          
          <Link href="/request">
            <button className="px-4 py-2 text-sm font-medium text-zinc-400 border border-zinc-700 rounded-lg whitespace-nowrap transition-colors hover:bg-zinc-800 hover:text-white hover:border-zinc-600">
              + Request Project
            </button>
          </Link>
        </div>

        {/* Asset Type Filter and View Toggle */}
        <div className="flex items-center justify-between mt-4">
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="custom"
              onClick={() => setAssetFilter("all")}
              className={assetFilter === "all" ? "bg-cyan-600 hover:bg-cyan-700" : "bg-zinc-800 hover:bg-zinc-700"}
            >
              All
            </Button>
            <Button
              size="sm"
              variant="custom"
              onClick={() => setAssetFilter("Tokens")}
              className={assetFilter === "Tokens" ? "bg-blue-600 hover:bg-blue-700" : "bg-zinc-800 hover:bg-zinc-700"}
            >
              Tokens
            </Button>
            <Button
              size="sm"
              variant="custom"
              onClick={() => setAssetFilter("Points")}
              className={assetFilter === "Points" ? "bg-purple-600 hover:bg-purple-700" : "bg-zinc-800 hover:bg-zinc-700"}
            >
              Points
            </Button>
          </div>

          {/* View Toggle */}
          <div className="flex gap-2">
            <button
              onClick={() => setViewMode("list")}
              className={`p-2 rounded-lg transition-all ${
                viewMode === "list" 
                  ? "bg-cyan-600 text-white" 
                  : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700"
              }`}
              title="List View"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            <button
              onClick={() => setViewMode("cards")}
              className={`p-2 rounded-lg transition-all ${
                viewMode === "cards" 
                  ? "bg-cyan-600 text-white" 
                  : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700"
              }`}
              title="Card View"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {isLoading && (
        <div className="text-center text-zinc-400 py-8">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-400"></div>
          <p className="mt-4">Loading projects...</p>
        </div>
      )}

      {/* Card View */}
      {viewMode === "cards" && !isLoading && projects && projects.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 px-4">
          <div className="w-20 h-20 rounded-full bg-gradient-to-br from-cyan-500/20 to-violet-500/20 flex items-center justify-center mb-6">
            <svg className="w-10 h-10 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
            </svg>
          </div>
          <h3 className="text-2xl font-bold mb-3 bg-gradient-to-r from-cyan-400 to-violet-400 bg-clip-text text-transparent">
            No Active Projects
          </h3>
          <p className="text-zinc-400 text-center max-w-md mb-6">
            There are currently no projects listed on the platform. Check back soon or request a new project to get started.
          </p>
          <Link href="/request">
            <button className="px-6 py-3 text-sm font-medium text-zinc-400 border border-zinc-700 rounded-lg whitespace-nowrap transition-colors hover:bg-zinc-800 hover:text-white hover:border-zinc-600">
              + Request a Project
            </button>
          </Link>
        </div>
      )}

      {viewMode === "cards" && projects && projects.length > 0 && (
        <>
        {filteredProjects.length === 0 && projects && projects.length > 0 ? (
          <div className="text-center py-12">
            <div className="flex justify-center mb-4">
              <SearchX className="w-16 h-16 text-zinc-600" />
            </div>
            <p className="text-zinc-400 text-lg mb-2">No projects match your search</p>
            <p className="text-zinc-500 text-sm">Try searching for something else</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredProjects.map((project) => {
          const stats = projectStats[project.slug];
          
          return (
            <Link key={project.slug} href={`/markets/${project.slug}`}>
              <Card className="hover:border-blue-500/30 hover:scale-[1.02] hover:shadow-lg hover:shadow-blue-500/10 cursor-pointer h-full group transition-all duration-500 ease-out">
                <div className="flex items-center gap-3 mb-3">
                  {/* Project Icon */}
                  <ProjectImage 
                    metadataURI={project.metadataURI}
                    imageType="icon"
                    className="w-12 h-12 rounded-full object-cover flex-shrink-0 border-2 border-zinc-700 group-hover:border-blue-500/50 transition-all"
                    fallbackText={project.name.charAt(0).toUpperCase()}
                  />
                  
                  {/* Project Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-lg">{project.name}</h3>
                      </div>
                      <Badge className={project.assetType === "Points" ? "bg-purple-600" : "bg-blue-600"}>
                        {project.assetType}
                      </Badge>
                    </div>
                    {project.twitterUrl && (
                      <div className="mt-2">
                        <ProjectReputationBadge 
                          twitterUrl={project.twitterUrl}
                          projectName={project.name}
                          variant="compact"
                        />
                      </div>
                    )}
                  </div>
                </div>
                
                {/* Price Stats */}
                {!loadingStats && stats ? (
                  <div className="mb-3 space-y-2">
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-zinc-400">Last Price:</span>
                      <span className="font-semibold text-blue-400">
                        {stats.lastPrice !== null ? `$${formatPrice(stats.lastPrice)}` : "—"}
                      </span>
                    </div>
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-zinc-400">Best Ask:</span>
                      <span className="font-semibold text-red-400">
                        {stats.lowestAsk !== null ? `$${formatPrice(stats.lowestAsk)}` : "—"}
                      </span>
                    </div>
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-zinc-400">Best Bid:</span>
                      <span className="font-semibold text-green-400">
                        {stats.highestBid !== null ? `$${formatPrice(stats.highestBid)}` : "—"}
                      </span>
                    </div>
                    <div className="flex justify-between items-center text-sm border-t border-zinc-800 pt-2 mt-2">
                      <span className="text-zinc-400">Total Volume:</span>
                      <span className="font-semibold text-white">
                        ${stats.totalVolume.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                    </div>
                    <div className="text-xs text-zinc-500 mt-2">
                      {stats.orderCount} active order{stats.orderCount !== 1 ? 's' : ''}
                    </div>
                  </div>
                ) : (
                  <div className="mb-3 space-y-2">
                    <div className="h-4 bg-zinc-800/50 rounded animate-pulse"></div>
                    <div className="h-4 bg-zinc-800/50 rounded animate-pulse"></div>
                    <div className="h-4 bg-zinc-800/50 rounded animate-pulse"></div>
                    <div className="h-4 bg-zinc-800/50 rounded animate-pulse"></div>
                  </div>
                )}
                
                <div className="text-sm text-zinc-400 group-hover:text-blue-400 transition-colors flex items-center gap-2">
                  <span>View Orderbook</span>
                  <span className="group-hover:translate-x-1 transition-transform">→</span>
                </div>
              </Card>
            </Link>
          );
        })}
        </div>
        )}
        </>
      )}

      {/* List View - Table */}
      {viewMode === "list" && (
        <div className="overflow-x-auto">
          <table className="w-full table-fixed">
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
            <thead>
              <tr className="border-b border-zinc-800">
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
                    className="flex items-center gap-1 hover:text-cyan-400 transition-colors text-xs font-semibold text-zinc-400 uppercase tracking-wider"
                  >
                    Project
                    {sortBy === "name" && (
                      <span>{sortDirection === "asc" ? "↑" : "↓"}</span>
                    )}
                  </button>
                </th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-zinc-400 uppercase tracking-wider">Type</th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-zinc-400 uppercase tracking-wider">Status</th>
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
                    className="flex items-center justify-end gap-1 hover:text-cyan-400 transition-colors text-xs font-semibold text-zinc-400 uppercase tracking-wider ml-auto"
                  >
                    Last Price
                    {sortBy === "price" && (
                      <span>{sortDirection === "asc" ? "↑" : "↓"}</span>
                    )}
                  </button>
                </th>
                <th className="text-right py-3 px-4 text-xs font-semibold text-zinc-400 uppercase tracking-wider">Best Ask</th>
                <th className="text-right py-3 px-4 text-xs font-semibold text-zinc-400 uppercase tracking-wider">Best Bid</th>
                <th className="text-right py-3 px-4 text-xs font-semibold text-zinc-400 uppercase tracking-wider whitespace-nowrap">24h Volume</th>
                <th className="text-right py-3 px-4 whitespace-nowrap">
                  <div className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">
                    Total Volume
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
                    className="flex items-center justify-end gap-1 hover:text-cyan-400 transition-colors text-xs font-semibold text-zinc-400 uppercase tracking-wider ml-auto"
                  >
                    Orders
                    {sortBy === "orders" && (
                      <span>{sortDirection === "asc" ? "↑" : "↓"}</span>
                    )}
                  </button>
                </th>
                <th className="py-3 px-4"></th> {/* Arrow */}
              </tr>
            </thead>
            <tbody>
              {!projects || projects.length === 0 ? (
                <tr>
                  <td colSpan={11} className="py-12 text-center">
                    <div className="flex flex-col items-center">
                      <div className="w-20 h-20 rounded-full bg-gradient-to-br from-cyan-500/20 to-violet-500/20 flex items-center justify-center mb-6">
                        <svg className="w-10 h-10 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                        </svg>
                      </div>
                      <h3 className="text-2xl font-bold mb-3 bg-gradient-to-r from-cyan-400 to-violet-400 bg-clip-text text-transparent">
                        No Active Projects
                      </h3>
                      <p className="text-zinc-400 text-center max-w-md mb-6">
                        There are currently no projects listed on the platform. Check back soon or request a new project to get started.
                      </p>
                      <Link href="/request">
                        <button className="px-6 py-3 text-sm font-medium text-zinc-400 border border-zinc-700 rounded-lg whitespace-nowrap transition-colors hover:bg-zinc-800 hover:text-white hover:border-zinc-600">
                          + Request a Project
                        </button>
                      </Link>
                    </div>
                  </td>
                </tr>
              ) : filteredProjects.length === 0 ? (
                <tr>
                  <td colSpan={11} className="py-12 text-center">
                    <div className="flex flex-col items-center">
                      <SearchX className="w-16 h-16 text-zinc-600 mb-4" />
                      <p className="text-zinc-400 text-lg mb-2">No projects match your search</p>
                      <p className="text-zinc-500 text-sm">Try searching for something else</p>
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
                    className="border-b border-zinc-800/50 hover:bg-zinc-900/50 cursor-pointer group transition-all"
                  >
                    {/* Icon */}
                    <td className="py-4 px-4">
                      <div className="w-10 h-10 rounded-full overflow-hidden border-2 border-zinc-700 group-hover:border-blue-500/50 transition-all flex-shrink-0">
                        <ProjectImage 
                          metadataURI={project.metadataURI}
                          imageType="icon"
                          className="w-full h-full object-cover"
                          fallbackText={project.name.charAt(0).toUpperCase()}
                        />
                      </div>
                    </td>
                    {/* Token Name */}
                    <td className="py-4 px-4">
                      <span className="font-semibold text-base text-white">{project.name}</span>
                    </td>
                    {/* Type */}
                    <td className="py-4 px-4">
                      <Badge className={`${project.assetType === "Points" ? "bg-purple-600" : "bg-blue-600"} text-xs`}>
                        {project.assetType}
                      </Badge>
                    </td>
                    {/* Status */}
                    <td className="py-4 px-4">
                      {(() => {
                        const tgeActivated = projectTgeStatus[project.slug] || false;
                        // TGE activation takes priority over active status
                        if (tgeActivated) {
                          return <Badge className="bg-red-600/80 text-xs">Ended</Badge>;
                        } else {
                          return <Badge className="bg-green-600 text-xs">Live</Badge>;
                        }
                      })()}
                    </td>
                    {/* Last Price */}
                    <td className="py-4 px-4 text-right">
                      {!loadingStats && stats ? (
                        <span className="font-semibold text-blue-400">
                          {stats.lastPrice !== null ? `$${formatPrice(stats.lastPrice)}` : "—"}
                        </span>
                      ) : (
                        <div className="h-6 w-20 bg-zinc-800/50 rounded animate-pulse ml-auto"></div>
                      )}
                    </td>
                    {/* Best Ask */}
                    <td className="py-4 px-4 text-right">
                      {!loadingStats && stats ? (
                        <span className="font-semibold text-red-400">
                          {stats.lowestAsk !== null ? `$${formatPrice(stats.lowestAsk)}` : "—"}
                        </span>
                      ) : (
                        <div className="h-6 w-20 bg-zinc-800/50 rounded animate-pulse ml-auto"></div>
                      )}
                    </td>
                    {/* Best Bid */}
                    <td className="py-4 px-4 text-right">
                      {!loadingStats && stats ? (
                        <span className="font-semibold text-green-400">
                          {stats.highestBid !== null ? `$${formatPrice(stats.highestBid)}` : "—"}
                        </span>
                      ) : (
                        <div className="h-6 w-20 bg-zinc-800/50 rounded animate-pulse ml-auto"></div>
                      )}
                    </td>
                    {/* 24h Volume */}
                    <td className="py-4 px-4 text-right">
                      {!loadingStats && stats ? (
                        <span className="font-semibold text-zinc-400">
                          ${stats.totalVolume.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                        </span>
                      ) : (
                        <div className="h-6 w-20 bg-zinc-800/50 rounded animate-pulse ml-auto"></div>
                      )}
                    </td>
                    {/* Total Volume */}
                    <td className="py-4 px-4 text-right">
                      {!loadingStats && stats ? (
                        <span className="font-semibold text-white">
                          ${stats.totalVolume.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                        </span>
                      ) : (
                        <div className="h-6 w-20 bg-zinc-800/50 rounded animate-pulse ml-auto"></div>
                      )}
                    </td>
                    {/* Orders */}
                    <td className="py-4 px-4 text-right">
                      {!loadingStats && stats ? (
                        <span className="font-semibold text-zinc-300">{stats.orderCount}</span>
                      ) : (
                        <div className="h-6 w-16 bg-zinc-800/50 rounded animate-pulse ml-auto"></div>
                      )}
                    </td>
                    {/* Arrow */}
                    <td className="py-4 px-4 text-right">
                      <span className="text-zinc-400 group-hover:text-blue-400 group-hover:translate-x-1 transition-all inline-block">
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
