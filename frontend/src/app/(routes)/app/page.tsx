"use client";

import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import ProjectReputationBadge from "@/components/ProjectReputationBadge";
import { ProjectImage } from "@/components/ProjectImage";
import { useReadContract, usePublicClient } from "wagmi";
import { REGISTRY_ADDRESS, PROJECT_REGISTRY_ABI, ORDERBOOK_ADDRESS, ESCROW_ORDERBOOK_ABI, STABLE_DECIMALS } from "@/lib/contracts";
import { useEffect, useState } from "react";
import { formatUnits } from "viem";

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
  orderCount: number;
  totalVolume: number;  // Total USDC volume across all orders
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

  // Fetch full project details including Twitter URLs and metadata URI
  useEffect(() => {
    if (!publicClient || !projectsData) return;
    
    async function fetchProjectDetails() {
      const fullProjects: Project[] = [];
      
      for (const proj of projectsData as Project[]) {
        try {
          const fullProject = await publicClient.readContract({
            address: REGISTRY_ADDRESS,
            abi: PROJECT_REGISTRY_ABI,
            functionName: "getProject",
            args: [proj.slug],
          }) as { name: string; twitterUrl: string; websiteUrl: string; description: string; logoUrl: string };
          
          fullProjects.push({
            slug: proj.slug,
            name: fullProject.name || proj.name,
            tokenAddress: proj.tokenAddress,
            assetType: proj.assetType,
            active: proj.active,
            addedAt: proj.addedAt,
            twitterUrl: fullProject.twitterUrl || '',
            websiteUrl: fullProject.websiteUrl || '',
            description: fullProject.description || '',
            metadataURI: fullProject.logoUrl || '', // logoUrl is now being used as metadataURI
          });
        } catch (error) {
          console.error(`Failed to fetch details for ${proj.slug}:`, error);
          // Fallback to basic project data
          fullProjects.push(proj);
        }
      }
      
      setProjects(fullProjects);
    }
    
    fetchProjectDetails();
  }, [publicClient, projectsData]);

  useEffect(() => {
    if (!publicClient || !projects || projects.length === 0) return;

    const fetchStats = async () => {
      try {
        setLoadingStats(true);
        
        // Get next order ID
        const nextId = await publicClient.readContract({
          address: ORDERBOOK_ADDRESS,
          abi: ESCROW_ORDERBOOK_ABI,
          functionName: "nextId",
        }) as bigint;

        // Fetch all orders in parallel for better performance
        const allOrders: Array<{ projectToken: string; amount: bigint; unitPrice: bigint; isSell: boolean; status: number }> = [];
        const orderPromises: Promise<void>[] = [];
        
        for (let i = 1n; i < nextId; i++) {
          const orderPromise = (async (orderId: bigint) => {
            try {
              const orderData = await publicClient.readContract({
                address: ORDERBOOK_ADDRESS,
                abi: ESCROW_ORDERBOOK_ABI,
                functionName: "orders",
                args: [orderId],
              }) as readonly [bigint, `0x${string}`, `0x${string}`, `0x${string}`, `0x${string}`, bigint, bigint, bigint, bigint, bigint, boolean, boolean, number];

              allOrders.push({
                projectToken: orderData[4],  // Fixed: removed expiry field
                amount: orderData[5],
                unitPrice: orderData[6],
                isSell: orderData[10],
                status: orderData[12],
              });
            } catch {
              // Skip failed orders
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

        // Calculate stats for each project
        const stats: Record<string, ProjectStats> = {};
        
        (projects as Project[]).forEach((project) => {
          const projectOrders = allOrders.filter(
            o => typeof o.projectToken === 'string' && o.projectToken.toLowerCase() === project.tokenAddress.toLowerCase() && o.status === 0
          );

          const sellOrders = projectOrders.filter(o => o.isSell);
          const buyOrders = projectOrders.filter(o => !o.isSell);

          const lowestAsk = sellOrders.length > 0
            ? Math.min(...sellOrders.map(o => parseFloat(formatUnits(o.unitPrice, STABLE_DECIMALS))))
            : null;

          const highestBid = buyOrders.length > 0
            ? Math.max(...buyOrders.map(o => parseFloat(formatUnits(o.unitPrice, STABLE_DECIMALS))))
            : null;

          // Calculate total volume (amount * price for all orders)
          const totalVolume = projectOrders.reduce((sum, order) => {
            const amount = parseFloat(formatUnits(order.amount, 18));
            const price = parseFloat(formatUnits(order.unitPrice, STABLE_DECIMALS));
            return sum + (amount * price);
          }, 0);

          stats[project.slug] = {
            lowestAsk,
            highestBid,
            orderCount: projectOrders.length,
            totalVolume,
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

  // Filter projects based on search query and asset type
  const filteredProjects = projects 
    ? (projects as Project[]).filter(project => {
        const matchesSearch = project.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          project.slug.toLowerCase().includes(searchQuery.toLowerCase()) ||
          project.assetType.toLowerCase().includes(searchQuery.toLowerCase());
        
        const matchesAssetType = assetFilter === "all" || project.assetType === assetFilter;
        
        return matchesSearch && matchesAssetType;
      })
    : [];

  return (
    <div className="relative min-h-screen">
      {/* Corner accents - tech frame */}
      <div className="fixed top-16 left-0 w-24 h-24 border-t-2 border-l-2 border-cyan-500/20 pointer-events-none"></div>
      <div className="fixed top-16 right-0 w-24 h-24 border-t-2 border-r-2 border-violet-500/20 pointer-events-none"></div>
      
      <div className="relative mx-auto max-w-6xl px-4 py-8">
        <div className="mb-8">
          <div className="flex items-center justify-between mb-3">
            <h1 className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
              Explore Markets
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
        
        {/* Search Bar and Request Button */}
        <div className="flex gap-4 items-center justify-between">
          <div className="relative w-full max-w-md">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
              <svg className="h-5 w-5 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <input
              type="text"
              placeholder="Search projects..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-12 pr-4 py-3 bg-zinc-900/50 border border-zinc-800 rounded-xl text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute inset-y-0 right-0 pr-4 flex items-center text-zinc-400 hover:text-white transition-colors"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
          
          <Link href="/request">
            <Button
              variant="custom"
              className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 whitespace-nowrap"
            >
              + Request Project
            </Button>
          </Link>
        </div>

        {/* Asset Type Filter */}
        <div className="flex gap-2 mt-4">
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
      </div>

      {isLoading && (
        <div className="text-center text-zinc-400 py-8">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-400"></div>
          <p className="mt-4">Loading projects...</p>
        </div>
      )}

      {!isLoading && projects && projects.length === 0 && (
        <div className="text-center text-zinc-400 py-8">No active projects found</div>
      )}

      {!isLoading && filteredProjects.length === 0 && projects && projects.length > 0 && (
        <div className="text-center py-12">
          <div className="text-5xl mb-4">🔍</div>
          <p className="text-zinc-400 text-lg mb-2">No projects match your search</p>
          <p className="text-zinc-500 text-sm">Try searching for something else</p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredProjects.map((project) => {
          const stats = projectStats[project.slug];
          
          return (
            <Link key={project.slug} href={`/project/${project.slug}`}>
              <Card className="hover:border-blue-500/50 hover:scale-[1.02] hover:shadow-blue-500/20 cursor-pointer h-full group transition-all duration-500 ease-out">
                <div className="flex items-start gap-3 mb-3">
                  {/* Project Icon */}
                  <ProjectImage 
                    metadataURI={project.metadataURI}
                    imageType="icon"
                    className="w-12 h-12 rounded-full object-cover flex-shrink-0 border-2 border-zinc-700 group-hover:border-blue-500/50 transition-all"
                    fallbackText={project.name.charAt(0).toUpperCase()}
                  />
                  
                  {/* Project Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-lg">{project.name}</h3>
                        <p className="text-xs text-zinc-400 mt-1">@{project.slug}</p>
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
                      <span className="text-zinc-400">Best Ask:</span>
                      <span className="font-semibold text-red-400">
                        {stats.lowestAsk !== null ? `$${stats.lowestAsk.toFixed(4)}` : "—"}
                      </span>
                    </div>
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-zinc-400">Best Bid:</span>
                      <span className="font-semibold text-green-400">
                        {stats.highestBid !== null ? `$${stats.highestBid.toFixed(4)}` : "—"}
                      </span>
                    </div>
                    <div className="flex justify-between items-center text-sm border-t border-zinc-800 pt-2 mt-2">
                      <span className="text-zinc-400">Total Volume:</span>
                      <span className="font-semibold text-blue-400">
                        ${stats.totalVolume.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                    </div>
                    {stats.orderCount > 0 && (
                      <div className="text-xs text-zinc-500 mt-2">
                        {stats.orderCount} active order{stats.orderCount !== 1 ? 's' : ''}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="mb-3 space-y-2">
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
      </div>
    </div>
  );
}
