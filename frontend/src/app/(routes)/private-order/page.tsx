"use client";

import { useState, useMemo } from "react";
import { Card } from "@/components/ui/Card";
import { PrivateOrderCreator } from "@/components/PrivateOrderCreator";
import { useOrderbook } from "@/hooks/useOrderbook";
import { useReadContract } from "wagmi";
import { REGISTRY_ADDRESS, PROJECT_REGISTRY_ABI, slugToProjectId } from "@/lib/contracts";
import { Lock, Search, UserPlus, Users, ShieldCheck, Calendar, Coins, CheckCircle, ArrowRight } from "lucide-react";
import { ProjectImage } from "@/components/ProjectImage";
import { Badge } from "@/components/ui/Badge";
import { Input } from "@/components/ui/Input";

export default function PrivateOrderPage() {
  const { address, createPrivateOrder } = useOrderbook();
  const [selectedProject, setSelectedProject] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [assetTypeFilter, setAssetTypeFilter] = useState<"all" | "points" | "tokens">("all");

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
    <div className="relative min-h-screen">
      {/* Header */}
      <div className="relative mx-auto max-w-7xl px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl md:text-4xl font-bold flex items-center gap-3 mb-3">
            <Lock className="w-8 h-8 md:w-10 md:h-10 text-cyan-400" />
            <span className="bg-gradient-to-r from-cyan-400 to-violet-400 bg-clip-text text-transparent">
              Create Private Order
            </span>
          </h1>
          <p className="text-lg text-zinc-400">
            Create an order that only a specific address can fill. Perfect for negotiated trades.
          </p>
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
                <div className="flex gap-2">
                  <button
                    onClick={() => setAssetTypeFilter("all")}
                    className={`px-4 py-2 text-sm font-medium rounded-lg transition-all ${
                      assetTypeFilter === "all"
                        ? "bg-cyan-600 text-white"
                        : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700"
                    }`}
                  >
                    All
                  </button>
                  <button
                    onClick={() => setAssetTypeFilter("points")}
                    className={`px-4 py-2 text-sm font-medium rounded-lg transition-all ${
                      assetTypeFilter === "points"
                        ? "bg-purple-600 text-white"
                        : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700"
                    }`}
                  >
                    Points
                  </button>
                  <button
                    onClick={() => setAssetTypeFilter("tokens")}
                    className={`px-4 py-2 text-sm font-medium rounded-lg transition-all ${
                      assetTypeFilter === "tokens"
                        ? "bg-blue-600 text-white"
                        : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700"
                    }`}
                  >
                    Tokens
                  </button>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              {projects.length === 0 ? (
                <p className="text-zinc-400 text-center py-8">No projects available</p>
              ) : filteredProjects.length === 0 ? (
                <p className="text-zinc-400 text-center py-8">No projects match your filters</p>
              ) : (
                filteredProjects.map((project, index) => (
                  <button
                    key={project.slug || `project-${index}`}
                    onClick={() => {
                      console.log('Clicked project:', project.slug);
                      setSelectedProject(project.slug);
                    }}
                    className="w-full p-4 bg-zinc-900/50 hover:bg-zinc-800/50 border border-zinc-800 hover:border-purple-500/50 rounded-lg transition-all text-left group"
                  >
                    <div className="flex items-center gap-3">
                      <ProjectImage 
                        metadataURI={project.metadataURI}
                        imageType="icon"
                        className="w-10 h-10 rounded-full object-cover border-2 border-zinc-700 group-hover:border-purple-500/50 transition-all"
                        fallbackText={project.name ? project.name.charAt(0).toUpperCase() : "?"}
                      />
                      <div className="flex-1">
                        <h3 className="font-semibold text-white">{project.name || "Unknown"}</h3>
                        <p className="text-xs text-zinc-500">{project.slug || "unknown"}</p>
                      </div>
                      <Badge className={project.assetType === "Points" ? "bg-purple-600" : "bg-blue-600"}>
                        {project.assetType}
                      </Badge>
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
                    className="w-10 h-10 rounded-full object-cover border-2 border-zinc-700"
                    fallbackText={selectedProjectData?.name.charAt(0).toUpperCase()}
                  />
                  <div>
                    <h3 className="text-sm font-semibold text-white">{selectedProjectData?.name}</h3>
                    <p className="text-xs text-zinc-500">{selectedProjectData?.slug}</p>
                  </div>
                  <Badge className={`${selectedProjectData?.assetType === "Points" ? "bg-purple-600" : "bg-blue-600"} text-xs`}>
                    {selectedProjectData?.assetType}
                  </Badge>
                </div>
                <button
                  onClick={() => setSelectedProject(null)}
                  className="text-xs text-zinc-400 hover:text-purple-400 transition-colors px-3 py-1.5 rounded-lg hover:bg-zinc-800/50"
                >
                  Change
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
        <Card className="mt-6 bg-gradient-to-br from-zinc-900/50 to-zinc-900/30 border-zinc-800">
          <div className="mb-6">
            <h3 className="text-xl font-bold mb-2 flex items-center gap-2">
              <Lock className="w-5 h-5 text-purple-400" />
              How Private Orders Work
            </h3>
            <p className="text-sm text-zinc-400">
              Secure peer-to-peer trading with on-chain escrow protection
            </p>
          </div>

          {/* Step-by-step flow */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Step 1 */}
            <div className="relative p-4 bg-zinc-800/30 rounded-lg border border-zinc-700/50 hover:border-purple-500/50 transition-all group">
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 w-10 h-10 rounded-full bg-purple-500/20 border border-purple-500/50 flex items-center justify-center group-hover:bg-purple-500/30 transition-all">
                  <UserPlus className="w-5 h-5 text-purple-400" />
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
            <div className="relative p-4 bg-zinc-800/30 rounded-lg border border-zinc-700/50 hover:border-blue-500/50 transition-all group">
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 w-10 h-10 rounded-full bg-blue-500/20 border border-blue-500/50 flex items-center justify-center group-hover:bg-blue-500/30 transition-all">
                  <Users className="w-5 h-5 text-blue-400" />
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
            <div className="relative p-4 bg-zinc-800/30 rounded-lg border border-zinc-700/50 hover:border-green-500/50 transition-all group">
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 w-10 h-10 rounded-full bg-green-500/20 border border-green-500/50 flex items-center justify-center group-hover:bg-green-500/30 transition-all">
                  <ShieldCheck className="w-5 h-5 text-green-400" />
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
            <div className="relative p-4 bg-zinc-800/30 rounded-lg border border-zinc-700/50 hover:border-yellow-500/50 transition-all group">
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 w-10 h-10 rounded-full bg-yellow-500/20 border border-yellow-500/50 flex items-center justify-center group-hover:bg-yellow-500/30 transition-all">
                  <Calendar className="w-5 h-5 text-yellow-400" />
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
            <div className="relative p-4 bg-zinc-800/30 rounded-lg border border-zinc-700/50 hover:border-cyan-500/50 transition-all group">
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 w-10 h-10 rounded-full bg-cyan-500/20 border border-cyan-500/50 flex items-center justify-center group-hover:bg-cyan-500/30 transition-all">
                  <Coins className="w-5 h-5 text-cyan-400" />
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
            <div className="relative p-4 bg-zinc-800/30 rounded-lg border border-zinc-700/50 hover:border-emerald-500/50 transition-all group">
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 w-10 h-10 rounded-full bg-emerald-500/20 border border-emerald-500/50 flex items-center justify-center group-hover:bg-emerald-500/30 transition-all">
                  <CheckCircle className="w-5 h-5 text-emerald-400" />
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
                <Lock className="w-4 h-4 text-purple-400 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-xs font-medium text-zinc-300">Address-Locked</p>
                  <p className="text-xs text-zinc-500">Only the specified address can accept</p>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <ShieldCheck className="w-4 h-4 text-green-400 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-xs font-medium text-zinc-300">Escrow Protected</p>
                  <p className="text-xs text-zinc-500">Smart contract holds all funds safely</p>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <ArrowRight className="w-4 h-4 text-blue-400 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-xs font-medium text-zinc-300">Shareable Link</p>
                  <p className="text-xs text-zinc-500">Send the order link to your counterparty</p>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <Coins className="w-4 h-4 text-cyan-400 mt-0.5 flex-shrink-0" />
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

