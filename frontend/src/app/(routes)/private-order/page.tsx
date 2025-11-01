"use client";

import { useState, useMemo } from "react";
import { Card } from "@/components/ui/Card";
import { PrivateOrderCreator } from "@/components/PrivateOrderCreator";
import { useOrderbook } from "@/hooks/useOrderbook";
import { useReadContract, useBlockNumber, useChainId } from "wagmi";
import { getExplorerUrl } from "@/lib/chains";
import { REGISTRY_ADDRESS, PROJECT_REGISTRY_ABI, slugToProjectId, ORDERBOOK_ADDRESS } from "@/lib/contracts";
import { Lock, Search, UserPlus, Users, ShieldCheck, Calendar, Coins, CheckCircle, ArrowRight, Terminal, Database, Cpu, AlertTriangle } from "lucide-react";
import { ProjectImage } from "@/components/ProjectImage";
import { Badge } from "@/components/ui/Badge";
import { Input } from "@/components/ui/Input";
import Link from "next/link";

export default function PrivateOrderPage() {
  const { address, createPrivateOrder } = useOrderbook();
  const chainId = useChainId();
  const [selectedProject, setSelectedProject] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [assetTypeFilter, setAssetTypeFilter] = useState<"all" | "points" | "tokens">("all");

  // Get current block number
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

  // Fetch all projects
  const { data: projectsData } = useReadContract({
    address: REGISTRY_ADDRESS,
    abi: PROJECT_REGISTRY_ABI,
    functionName: "getActiveProjects",
  }) as { data: any[] | undefined };

  const projects = (projectsData || []).map((p: any) => ({
    id: p.id,
    slug: p.slug || p.name?.toLowerCase().replace(/\s+/g, '-') || 'unknown',
    name: p.name,
    metadataURI: p.metadataURI,
    isPoints: p.isPoints,
    active: p.active,
    assetType: p.isPoints ? "Points" : "Tokens",
    twitterUrl: p.twitterUrl || "",
    websiteUrl: p.websiteUrl || "",
    description: p.description || "",
    tokenAddress: p.tokenAddress,
  }));

  // Filter projects based on search and asset type
  const filteredProjects = useMemo(() => {
    return projects.filter((project) => {
      // Search filter
      const matchesSearch = searchQuery.trim() === "" || 
        project.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        project.slug?.toLowerCase().includes(searchQuery.toLowerCase());
      
      // Asset type filter
      const matchesAssetType = 
        assetTypeFilter === "all" ||
        (assetTypeFilter === "points" && project.isPoints) ||
        (assetTypeFilter === "tokens" && !project.isPoints);
      
      return matchesSearch && matchesAssetType;
    });
  }, [projects, searchQuery, assetTypeFilter]);

  const handleCreateOrder = async (params: {
    amount: bigint;
    unitPrice: bigint;
    projectId: `0x${string}`;
    isSell: boolean;
    allowedTaker: `0x${string}`;
  }) => {
    try {
      setIsCreating(true);
      const result = await createPrivateOrder(params);
      return result;
    } catch (error) {
      throw error;
    } finally {
      setIsCreating(false);
    }
  };

  const selectedProjectData = projects.find(p => p.slug === selectedProject);

  return (
    <div className="relative min-h-screen" style={{ backgroundColor: '#06060c' }}>
      {/* Header */}
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
                <Lock className="w-10 h-10 text-zinc-300" />
              </div>
              <div className="min-w-0 flex-1">
                <span className="text-zinc-300/70 text-xs mb-1 block">otcX://protocol/private-order</span>
                <h1 className="text-2xl md:text-3xl font-bold text-white tracking-tight break-words">
                  PRIVATE_ORDER_CREATOR
                </h1>
                <p className="text-xs text-zinc-300/70 mt-1 break-words">
                  Address-Locked Trading • Peer-to-Peer Settlement
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

        {/* Project Selection */}
        {!selectedProject ? (
          <Card>
            <div className="mb-4">
              <h2 className="text-xl font-bold mb-4">Select a Project</h2>
              
              {/* Search and Filter */}
              <div className="flex flex-col sm:flex-row gap-3 mb-4">
                {/* Search Bar */}
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                  <Input
                    type="text"
                    placeholder="Search projects..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                  />
                </div>

                {/* Asset Type Filter */}
                <div className="flex gap-2 font-mono">
                  <button
                    onClick={() => setAssetTypeFilter("all")}
                    className={`px-4 py-2 text-xs font-medium rounded border transition-all ${
                      assetTypeFilter === "all"
                        ? "bg-zinc-700 text-zinc-300 border-zinc-500" 
                        : "text-zinc-400 hover:border-zinc-700"
                    }`}
                    style={assetTypeFilter !== "all" ? { backgroundColor: '#121218', borderColor: '#2b2b30' } : {}}
                  >
                    ALL
                  </button>
                  <button
                    onClick={() => setAssetTypeFilter("points")}
                    className={`px-4 py-2 text-xs font-medium rounded border transition-all ${
                      assetTypeFilter === "points"
                        ? "bg-purple-500/20 text-purple-400 border-purple-500/50" 
                        : "text-zinc-400 hover:border-zinc-700"
                    }`}
                    style={assetTypeFilter !== "points" ? { backgroundColor: '#121218', borderColor: '#2b2b30' } : {}}
                  >
                    POINTS
                  </button>
                  <button
                    onClick={() => setAssetTypeFilter("tokens")}
                    className={`px-4 py-2 text-xs font-medium rounded border transition-all ${
                      assetTypeFilter === "tokens"
                        ? "bg-blue-500/20 text-blue-400 border-blue-500/50" 
                        : "text-zinc-400 hover:border-zinc-700"
                    }`}
                    style={assetTypeFilter !== "tokens" ? { backgroundColor: '#121218', borderColor: '#2b2b30' } : {}}
                  >
                    TOKENS
                  </button>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              {projects.length === 0 ? (
                <div className="flex flex-col items-center px-4 py-8">
                  <div className="bg-[#121218] border border-[#2b2b30] rounded p-8 backdrop-blur-sm max-w-2xl">
                    <div className="flex items-center gap-3 mb-4 font-mono text-zinc-300">
                      <Terminal className="w-5 h-5" />
                      <span className="text-sm">otcX://protocol/private-order</span>
                    </div>
                    <div className="bg-[#06060c] border border-red-500/30 rounded p-4 mb-4 font-mono text-sm">
                      <div className="flex items-center gap-2 text-red-400 mb-2">
                        <span className="font-bold">ERROR:</span>
                        <span>No active projects found</span>
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
              ) : filteredProjects.length === 0 ? (
                <div className="flex flex-col items-center px-4 py-8">
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
                        <div>→ filter: {assetTypeFilter}</div>
                        <div>→ matches: 0</div>
                      </div>
                    </div>
                    <div className="space-y-3 font-mono text-sm">
                      <div className="text-zinc-400">
                        No projects match your current filter criteria.
                      </div>
                      <div className="text-zinc-400">
                        Try adjusting filters or check back later.
                      </div>
                    </div>
                    <div className="mt-6 pt-6 border-t border-yellow-500/30">
                      <button 
                        onClick={() => {
                          setAssetTypeFilter("all");
                        }}
                        className="w-full px-6 py-3 text-sm font-mono font-medium text-yellow-400 border border-yellow-500/30 rounded transition-all hover:bg-yellow-500/10 hover:border-yellow-500/60 flex items-center justify-center gap-2"
                      >
                        <span>↻</span> RESET FILTERS
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                filteredProjects.map((project, index) => (
                  <button
                    key={project.slug || `project-${index}`}
                    onClick={() => {
                      console.log('Clicked project:', project.slug);
                      setSelectedProject(project.slug);
                    }}
                    className="w-full bg-[#121218] border border-[#2b2b30] hover:border-zinc-500 hover:shadow-lg hover:shadow-zinc-500/20 cursor-pointer h-full group transition-all backdrop-blur-sm rounded text-left"
                  >
                    {/* Terminal-style header */}
                    <div className="bg-gradient-to-r from-[#2b2b30]/50 to-[#2b2b30]/50 border-b border-[#2b2b30] px-3 py-2 font-mono text-xs flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse"></div>
                        <span className="text-zinc-300 uppercase">{project.slug || "unknown"}</span>
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
                            fallbackText={project.name ? project.name.charAt(0).toUpperCase() : "?"}
                          />
                          <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-500 rounded-full border-2 border-black"></div>
                        </div>
                        
                        {/* Project Title */}
                        <h3 className="font-bold text-lg text-white">{project.name || "Unknown"}</h3>
                      </div>
                      
                      <div className="mt-4 text-xs font-mono text-zinc-300 group-hover:text-white transition-colors flex items-center gap-2 justify-center py-2 border border-[#2b2b30] rounded group-hover:bg-[#2b2b30]">
                        <span>SELECT PROJECT</span>
                        <span className="group-hover:translate-x-1 transition-transform">→</span>
                      </div>
                    </div>
                  </button>
                ))
              )}
            </div>
          </Card>
        ) : (
          <>
            {/* Selected Project Info */}
            <Card className="mb-6 bg-zinc-900/30 border-zinc-800">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <ProjectImage 
                    metadataURI={selectedProjectData?.metadataURI}
                    imageType="icon"
                    className="w-10 h-10 rounded object-cover border-2 border-zinc-700"
                    fallbackText={selectedProjectData?.name.charAt(0).toUpperCase()}
                  />
                  <div>
                    <h3 className="text-sm font-semibold text-white">{selectedProjectData?.name}</h3>
                    <p className="text-xs text-zinc-500">{selectedProjectData?.slug}</p>
                  </div>
                  <Badge className={`text-xs ${selectedProjectData?.assetType === "Points" ? "bg-purple-500/20 text-purple-400 border border-purple-500/50" : "bg-blue-500/20 text-blue-400 border border-blue-500/50"}`}>
                    {selectedProjectData?.assetType}
                  </Badge>
                </div>
                <button
                  onClick={() => setSelectedProject(null)}
                  className="text-xs font-mono text-zinc-400 hover:text-white transition-colors px-3 py-1.5 rounded"
                  style={{ backgroundColor: '#121218', borderColor: '#2b2b30', border: '1px solid' }}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#2b2b30'}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#121218'}
                >
                  CHANGE
                </button>
              </div>
            </Card>

            {/* Private Order Creator */}
            <PrivateOrderCreator
              projectId={slugToProjectId(selectedProject)}
              projectName={selectedProjectData?.name || selectedProject}
              assetType={selectedProjectData?.assetType || "Tokens"}
              onCreateOrder={handleCreateOrder}
              isCreating={isCreating}
            />
          </>
        )}

        {/* Info Section - How It Works */}
        <Card className="mt-6">
          <div className="mb-6">
            <h3 className="text-xl font-bold mb-2 flex items-center gap-2">
              <Lock className="w-5 h-5 text-zinc-300" />
            How Private Orders Work
          </h3>
            <p className="text-sm text-zinc-400">
              Secure peer-to-peer trading with on-chain escrow protection
            </p>
          </div>

          {/* Step-by-step flow */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Step 1 */}
            <div className="relative p-4 rounded-lg border transition-all" style={{ backgroundColor: '#121218', borderColor: '#2b2b30' }}>
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center" style={{ backgroundColor: '#2b2b30' }}>
                  <UserPlus className="w-5 h-5 text-zinc-300" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h4 className="font-semibold text-white text-sm">Step 1: Create Order</h4>
                    <span className="text-xs text-zinc-500 font-mono">Maker</span>
                  </div>
                  <p className="text-xs text-zinc-400">
                    You create a private order and specify the counterparty's address. Deposit USDC collateral to lock the order.
                  </p>
                </div>
              </div>
            </div>

            {/* Step 2 */}
            <div className="relative p-4 rounded-lg border transition-all" style={{ backgroundColor: '#121218', borderColor: '#2b2b30' }}>
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center" style={{ backgroundColor: '#2b2b30' }}>
                  <Users className="w-5 h-5 text-zinc-300" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h4 className="font-semibold text-white text-sm">Step 2: Counterparty Accepts</h4>
                    <span className="text-xs text-zinc-500 font-mono">Taker</span>
                  </div>
                  <p className="text-xs text-zinc-400">
                    The specified address receives the order link and deposits their USDC collateral to accept the trade.
                  </p>
                </div>
              </div>
            </div>

            {/* Step 3 */}
            <div className="relative p-4 rounded-lg border transition-all" style={{ backgroundColor: '#121218', borderColor: '#2b2b30' }}>
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center" style={{ backgroundColor: '#2b2b30' }}>
                  <ShieldCheck className="w-5 h-5 text-zinc-300" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h4 className="font-semibold text-white text-sm">Step 3: Order Locked</h4>
                    <span className="text-xs text-zinc-500 font-mono">Both</span>
                  </div>
                  <p className="text-xs text-zinc-400">
                    Both parties' collateral is secured in the smart contract escrow. The order is now fully locked and protected.
                  </p>
                </div>
              </div>
            </div>

            {/* Step 4 */}
            <div className="relative p-4 rounded-lg border transition-all" style={{ backgroundColor: '#121218', borderColor: '#2b2b30' }}>
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center" style={{ backgroundColor: '#2b2b30' }}>
                  <Calendar className="w-5 h-5 text-zinc-300" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h4 className="font-semibold text-white text-sm">Step 4: TGE Activation</h4>
                    <span className="text-xs text-zinc-500 font-mono">Wait</span>
                  </div>
                  <p className="text-xs text-zinc-400">
                    When the Token Generation Event happens, the admin activates settlement mode. A 4-hour settlement window begins.
                  </p>
                </div>
              </div>
            </div>

            {/* Step 5 */}
            <div className="relative p-4 rounded-lg border transition-all" style={{ backgroundColor: '#121218', borderColor: '#2b2b30' }}>
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center" style={{ backgroundColor: '#2b2b30' }}>
                  <Coins className="w-5 h-5 text-zinc-300" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h4 className="font-semibold text-white text-sm">Step 5: Seller Deposits</h4>
                    <span className="text-xs text-zinc-500 font-mono">Seller</span>
                  </div>
                  <p className="text-xs text-zinc-400">
                    The seller deposits tokens/points into escrow. For points orders, tokens are deposited based on the conversion ratio.
                  </p>
                </div>
              </div>
            </div>

            {/* Step 6 */}
            <div className="relative p-4 rounded-lg border transition-all" style={{ backgroundColor: '#121218', borderColor: '#2b2b30' }}>
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center" style={{ backgroundColor: '#2b2b30' }}>
                  <CheckCircle className="w-5 h-5 text-zinc-300" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h4 className="font-semibold text-white text-sm">Step 6: Settlement</h4>
                    <span className="text-xs text-zinc-500 font-mono">Both</span>
                  </div>
                  <p className="text-xs text-zinc-400">
                    Buyer claims their tokens/points and seller receives USDC payment. Trade complete with a small platform fee.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Key Features */}
          <div className="mt-6 pt-6 border-t border-zinc-800">
            <h4 className="text-sm font-semibold text-zinc-300 mb-3">Key Features</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="flex items-start gap-2">
                <Lock className="w-4 h-4 text-zinc-300 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-xs font-medium text-zinc-300">Address-Locked</p>
                  <p className="text-xs text-zinc-500">Only the specified address can accept</p>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <ShieldCheck className="w-4 h-4 text-zinc-300 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-xs font-medium text-zinc-300">Escrow Protected</p>
                  <p className="text-xs text-zinc-500">Smart contract holds all funds safely</p>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <ArrowRight className="w-4 h-4 text-zinc-300 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-xs font-medium text-zinc-300">Shareable Link</p>
                  <p className="text-xs text-zinc-500">Send the order link to your counterparty</p>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <Coins className="w-4 h-4 text-zinc-300 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-xs font-medium text-zinc-300">Points & Tokens</p>
                  <p className="text-xs text-zinc-500">Supports both asset types seamlessly</p>
                </div>
              </div>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}

