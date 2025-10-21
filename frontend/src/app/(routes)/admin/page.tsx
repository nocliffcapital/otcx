"use client";

import { useState, useEffect } from "react";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Switch } from "@/components/ui/Switch";
import { TGESettlementManager } from "@/components/TGESettlementManager";
import { useAccount, useWriteContract, useReadContract, useWaitForTransactionReceipt, usePublicClient } from "wagmi";
import { REGISTRY_ADDRESS, PROJECT_REGISTRY_ABI, ORDERBOOK_ADDRESS, ESCROW_ORDERBOOK_ABI } from "@/lib/contracts";
import { isAddress, getAddress } from "viem";
import { Plus, Edit2, AlertTriangle, PlayCircle, PauseCircle, Upload, CheckCircle } from "lucide-react";
import { uploadImageToPinata, uploadMetadataToPinata } from "@/lib/pinata";

type Project = {
  slug: string;
  name: string;
  tokenAddress: `0x${string}`;
  assetType: string;
  active: boolean;
  addedAt: bigint;
  twitterUrl: string;
  websiteUrl: string;
  description: string;
};

export default function AdminPage() {
  const { address, isConnected } = useAccount();
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingProject, setEditingProject] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "disabled">("all");
  
  const [formData, setFormData] = useState({
    slug: "",
    name: "",
    tokenAddress: "",
    assetType: "Tokens",
    twitterUrl: "",
    websiteUrl: "",
    description: "",
  });

  // Logo and icon upload state
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [iconFile, setIconFile] = useState<File | null>(null);
  const [iconPreview, setIconPreview] = useState<string | null>(null);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [uploadingIcon, setUploadingIcon] = useState(false);
  const [uploadingMetadata, setUploadingMetadata] = useState(false);

  // Read all slugs first
  const { data: slugs } = useReadContract({
    address: REGISTRY_ADDRESS,
    abi: PROJECT_REGISTRY_ABI,
    functionName: "getAllSlugs",
  }) as { data: string[] | undefined };

  // Read each project individually
  const [projects, setProjects] = useState<Project[]>([]);
  const [loadingProjects, setLoadingProjects] = useState(true);
  const publicClient = usePublicClient();

  const refetch = async () => {
    if (!publicClient || !slugs || slugs.length === 0) return;
    
    setLoadingProjects(true);
    const allProjects: Project[] = [];
    
    for (const slug of slugs) {
      try {
        const project = await publicClient.readContract({
          address: REGISTRY_ADDRESS,
          abi: PROJECT_REGISTRY_ABI,
          functionName: "getProject",
          args: [slug],
        }) as Project;
        
        allProjects.push(project);
      } catch (error) {
        console.error(`Failed to load project ${slug}:`, error);
      }
    }
    
    setProjects(allProjects);
    setLoadingProjects(false);
  };

  useEffect(() => {
    refetch();
  }, [slugs, publicClient]);

  // Read contract owner
  const { data: owner } = useReadContract({
    address: REGISTRY_ADDRESS,
    abi: PROJECT_REGISTRY_ABI,
    functionName: "owner",
  });

  // Debug logging
  useEffect(() => {
    console.log('Registry owner:', owner);
    console.log('Connected address:', address);
    console.log('Is owner:', isConnected && address && owner && address.toLowerCase() === (owner as string).toLowerCase());
  }, [owner, address, isConnected]);

  // Check if orderbook is paused
  const { data: isPausedData, refetch: refetchPaused } = useReadContract({
    address: ORDERBOOK_ADDRESS,
    abi: ESCROW_ORDERBOOK_ABI,
    functionName: "paused",
  });

  const isContractPaused = isPausedData === true;

  const isOwner = isConnected && address && owner && address.toLowerCase() === (owner as string).toLowerCase();

  // Fetch all orders for TGE management
  const { data: nextId } = useReadContract({
    address: ORDERBOOK_ADDRESS,
    abi: ESCROW_ORDERBOOK_ABI,
    functionName: "nextId",
  });

  const [orders, setOrders] = useState<Order[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(true);

  const fetchOrders = async () => {
    if (!publicClient || !nextId) return;
    setLoadingOrders(true);
    const allOrders: Order[] = [];
    const count = Number(nextId);

    for (let i = 1; i < count; i++) {
      try {
        const orderData = await publicClient.readContract({
          address: ORDERBOOK_ADDRESS,
          abi: ESCROW_ORDERBOOK_ABI,
          functionName: "orders",
          args: [BigInt(i)],
        }) as readonly [bigint, `0x${string}`, `0x${string}`, `0x${string}`, `0x${string}`, bigint, bigint, bigint, bigint, bigint, boolean, boolean, number];
        
        // Fetch settlement proof if order is in TGE_ACTIVATED or later status
        let proof: string | undefined;
        const status = Number(orderData[12]);
        if (status >= 2) { // TGE_ACTIVATED = 2
          try {
            const proofData = await publicClient.readContract({
              address: ORDERBOOK_ADDRESS,
              abi: ESCROW_ORDERBOOK_ABI,
              functionName: "settlementProof",
              args: [BigInt(i)],
            }) as string;
            if (proofData && proofData.length > 0) {
              proof = proofData;
            }
          } catch (error) {
            console.error(`Failed to load proof for order ${i}:`, error);
          }
        }
        
        // Map the raw tuple to an object structure
        allOrders.push({
          id: orderData[0],
          maker: orderData[1],
          buyer: orderData[2],
          seller: orderData[3],
          projectToken: orderData[4],
          amount: orderData[5],
          unitPrice: orderData[6],
          buyerFunds: orderData[7],
          sellerCollateral: orderData[8],
          settlementDeadline: orderData[9],
          isSell: orderData[10],
          tokensDeposited: orderData[11],
          status: orderData[12],
          proof: proof,
        });
      } catch (error) {
        console.error(`Failed to load order ${i}:`, error);
      }
    }

    console.log('Loaded orders for admin panel:', allOrders);
    setOrders(allOrders);
    setLoadingOrders(false);
  };

  useEffect(() => {
    fetchOrders();
  }, [nextId, publicClient]);

  // Write contract hook
  const { writeContract, data: hash, isPending } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  // Helper: Generate deterministic placeholder address from slug
  const generatePlaceholderAddress = (slug: string): `0x${string}` => {
    // Convert slug to hex and pad to 40 characters (20 bytes)
    let hexSlug = '';
    for (let i = 0; i < Math.min(slug.length, 20); i++) {
      hexSlug += slug.charCodeAt(i).toString(16).padStart(2, '0');
    }
    const paddedHex = hexSlug.padEnd(40, '0');
    return `0x${paddedHex}` as `0x${string}`;
  };

  // Handle form submission for adding project
  const handleAddProject = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!isAddress(formData.tokenAddress) && formData.tokenAddress !== "") {
      alert("Invalid token address");
      return;
    }

    const cleanSlug = formData.slug.toLowerCase().replace(/[^a-z0-9-]/g, '-');
    
    // If no token address provided, generate a deterministic placeholder
    const tokenAddr = formData.tokenAddress 
      ? getAddress(formData.tokenAddress) 
      : generatePlaceholderAddress(cleanSlug);

    try {
      let logoUrl = "";
      let iconUrl = "";
      
      // Step 1: Upload logo to Pinata if provided
      if (logoFile) {
        setUploadingLogo(true);
        try {
          const logoCID = await uploadImageToPinata(logoFile);
          logoUrl = `ipfs://${logoCID}`;
          console.log('✅ Logo uploaded to IPFS:', logoUrl);
        } catch (error) {
          console.error('❌ Logo upload failed:', error);
          alert(`Failed to upload logo: ${(error as Error).message}`);
          return;
        } finally {
          setUploadingLogo(false);
        }
      }

      // Step 2: Upload icon to Pinata if provided
      if (iconFile) {
        setUploadingIcon(true);
        try {
          const iconCID = await uploadImageToPinata(iconFile);
          iconUrl = `ipfs://${iconCID}`;
          console.log('✅ Icon uploaded to IPFS:', iconUrl);
        } catch (error) {
          console.error('❌ Icon upload failed:', error);
          alert(`Failed to upload icon: ${(error as Error).message}`);
          return;
        } finally {
          setUploadingIcon(false);
        }
      }

      // Step 3: Upload metadata to Pinata
      setUploadingMetadata(true);
      let metadataURI = "";
      try {
        const metadata = {
          slug: cleanSlug,
          name: formData.name,
          description: formData.description,
          twitterUrl: formData.twitterUrl,
          websiteUrl: formData.websiteUrl,
          logoUrl: logoUrl,
          iconUrl: iconUrl,
          assetType: formData.assetType,
        };
        
        const metadataCID = await uploadMetadataToPinata(metadata);
        metadataURI = `ipfs://${metadataCID}`;
        console.log('✅ Metadata uploaded to IPFS:', metadataURI);
      } catch (error) {
        console.error('❌ Metadata upload failed:', error);
        alert(`Failed to upload metadata: ${(error as Error).message}`);
        return;
      } finally {
        setUploadingMetadata(false);
      }

      // Step 3: Register on-chain
      writeContract({
        address: REGISTRY_ADDRESS,
        abi: PROJECT_REGISTRY_ABI,
        functionName: "addProject",
        args: [
          cleanSlug,
          formData.name,
          tokenAddr,
          formData.assetType,
          formData.twitterUrl,
          formData.websiteUrl,
          formData.description,
          logoUrl, // IPFS URL for logo
        ],
      });
    } catch (error) {
      console.error("Error adding project:", error);
      alert("Failed to add project. See console for details.");
    }
  };

  // Handle form submission for updating project
  const handleUpdateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!isAddress(formData.tokenAddress) && formData.tokenAddress !== "") {
      alert("Invalid token address");
      return;
    }

    // If no token address provided, generate a deterministic placeholder
    const tokenAddr = formData.tokenAddress 
      ? getAddress(formData.tokenAddress) 
      : generatePlaceholderAddress(formData.slug);

    try {
      writeContract({
        address: REGISTRY_ADDRESS,
        abi: PROJECT_REGISTRY_ABI,
        functionName: "updateProject",
        args: [
          formData.slug,
          formData.name,
          tokenAddr,
          formData.assetType,
          formData.twitterUrl,
          formData.websiteUrl,
          formData.description,
          "", // logoUrl - empty for now
        ],
      });
    } catch (error) {
      console.error("Error updating project:", error);
      alert("Failed to update project. See console for details.");
    }
  };

  // Toggle project status
  const handleToggleStatus = (slug: string, currentStatus: boolean) => {
    writeContract({
      address: REGISTRY_ADDRESS,
      abi: PROJECT_REGISTRY_ABI,
      functionName: "setProjectStatus",
      args: [slug, !currentStatus],
    });
  };

  // Pause/Unpause orderbook
  const handlePauseOrderbook = () => {
    if (!confirm(`Are you sure you want to ${isContractPaused ? 'UNPAUSE' : 'PAUSE'} the orderbook contract? This will ${isContractPaused ? 'enable' : 'disable'} all trading.`)) {
      return;
    }

    writeContract({
      address: ORDERBOOK_ADDRESS,
      abi: ESCROW_ORDERBOOK_ABI,
      functionName: isContractPaused ? "unpause" : "pause",
    });
  };

  // Load project data into form for editing
  const startEditing = (project: Project) => {
    // Check if the token address is a placeholder (generated from slug)
    const expectedPlaceholder = generatePlaceholderAddress(project.slug);
    const isPlaceholder = project.tokenAddress.toLowerCase() === expectedPlaceholder.toLowerCase();
    
    setFormData({
      slug: project.slug,
      name: project.name,
      tokenAddress: isPlaceholder ? "" : project.tokenAddress, // Show empty if placeholder
      assetType: project.assetType,
      twitterUrl: project.twitterUrl,
      websiteUrl: project.websiteUrl,
      description: project.description,
    });
    setEditingProject(project.slug);
    setShowAddForm(true);
  };

  // Handle logo file selection
  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      alert('Invalid file type. Please upload an image (PNG, JPG, GIF, or WebP).');
      return;
    }

    // Validate file size (max 5MB)
    const maxSize = 5 * 1024 * 1024;
    if (file.size > maxSize) {
      alert('File too large. Maximum size is 5MB.');
      return;
    }

    setLogoFile(file);

    // Generate preview
    const reader = new FileReader();
    reader.onload = (e) => setLogoPreview(e.target?.result as string);
    reader.readAsDataURL(file);
  };

  // Handle icon file selection
  const handleIconChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      alert('Invalid file type. Please upload an image (PNG, JPG, GIF, or WebP).');
      return;
    }

    // Validate file size (max 5MB)
    const maxSize = 5 * 1024 * 1024;
    if (file.size > maxSize) {
      alert('File too large. Maximum size is 5MB.');
      return;
    }

    setIconFile(file);

    // Generate preview
    const reader = new FileReader();
    reader.onload = (e) => setIconPreview(e.target?.result as string);
    reader.readAsDataURL(file);
  };

  // Reset form
  const resetForm = () => {
    setFormData({
      slug: "",
      name: "",
      tokenAddress: "",
      assetType: "Tokens",
      twitterUrl: "",
      websiteUrl: "",
      description: "",
    });
    setLogoFile(null);
    setLogoPreview(null);
    setIconFile(null);
    setIconPreview(null);
    setEditingProject(null);
    setShowAddForm(false);
  };

  // Refresh after successful transaction
  const [hasRefreshed, setHasRefreshed] = useState(false);
  
  useEffect(() => {
    if (isSuccess && !hasRefreshed) {
      setHasRefreshed(true);
      setTimeout(() => {
        refetch();
        refetchPaused();
        fetchOrders();
        resetForm();
      }, 2000);
    }
    // Reset the flag when hash changes (new transaction)
    if (!isSuccess && hasRefreshed) {
      setHasRefreshed(false);
    }
  }, [isSuccess, hasRefreshed]);

  if (!isConnected) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-16">
        <Card className="text-center py-12">
          <h1 className="text-3xl font-bold mb-4 text-cyan-400">Admin Panel</h1>
          <p className="text-zinc-400 mb-6">Please connect your wallet to access the admin panel.</p>
        </Card>
      </div>
    );
  }

  if (!isOwner) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-16">
        <Card className="text-center py-12 border-red-800/30 bg-red-950/20">
          <h1 className="text-3xl font-bold mb-4 text-red-400">Access Denied</h1>
          <p className="text-zinc-400 mb-4">You are not the contract owner.</p>
          <div className="bg-zinc-900/50 p-4 rounded-lg text-left text-xs space-y-2">
            <div>
              <span className="text-zinc-500">Connected Wallet:</span>
              <p className="text-white font-mono mt-1">{address}</p>
            </div>
            <div>
              <span className="text-zinc-500">Registry Owner:</span>
              <p className="text-cyan-400 font-mono mt-1">{owner as string || 'Loading...'}</p>
            </div>
            <div className="pt-2 mt-2 border-t border-zinc-800">
              <span className="text-zinc-500">Registry Address:</span>
              <p className="text-violet-400 font-mono mt-1">{REGISTRY_ADDRESS}</p>
            </div>
          </div>
          <p className="text-xs text-zinc-500 mt-4">
            ℹ️ Connect with the owner wallet or transfer ownership to access admin features
          </p>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-3 bg-gradient-to-r from-cyan-400 to-violet-400 bg-clip-text text-transparent">
          Admin Panel
        </h1>
        <p className="text-lg text-zinc-400">Manage projects on the otcX platform</p>
      </div>

      {/* Emergency Controls */}
      <Card className={`mb-6 p-4 transition-all ${
        isContractPaused 
          ? "border-red-500/50 bg-red-950/20" 
          : "border-green-500/30 bg-green-950/10"
      }`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${
              isContractPaused 
                ? "bg-red-500/20" 
                : "bg-green-500/20"
            }`}>
              <AlertTriangle className={`w-5 h-5 ${
                isContractPaused 
                  ? "text-red-400" 
                  : "text-green-400"
              }`} />
            </div>
            <div>
              <h3 className={`text-lg font-bold ${
                isContractPaused 
                  ? "text-red-400" 
                  : "text-green-400"
              }`}>
                Emergency Controls
              </h3>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-xs text-zinc-400">Orderbook Status:</span>
                {isContractPaused ? (
                  <Badge className="bg-red-600 text-white font-semibold text-xs">
                    <PauseCircle className="w-3 h-3 mr-1" />
                    PAUSED
                  </Badge>
                ) : (
                  <Badge className="bg-green-600 text-white font-semibold text-xs">
                    <PlayCircle className="w-3 h-3 mr-1" />
                    ACTIVE
                  </Badge>
                )}
              </div>
            </div>
          </div>
          
          <Button
            onClick={handlePauseOrderbook}
            disabled={isPending || isConfirming}
            variant="custom"
            className={`min-w-[150px] h-10 transition-all ${
              isContractPaused 
                ? "bg-green-600 hover:bg-green-700 border-2 border-green-500/50 shadow-lg shadow-green-500/20"
                : "bg-red-600 hover:bg-red-700 border-2 border-red-500/50 shadow-lg shadow-red-500/20"
            }`}
          >
            {isPending || isConfirming ? (
              <>
                <div className="w-4 h-4 mr-2 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Processing...
              </>
            ) : isContractPaused ? (
              <>
                <PlayCircle className="w-4 h-4 mr-2" />
                Resume Trading
              </>
            ) : (
              <>
                <PauseCircle className="w-4 h-4 mr-2" />
                Pause Trading
              </>
            )}
          </Button>
        </div>
      </Card>

      {/* Add Project Button */}
      {!showAddForm && (
        <div className="mb-6">
          <Button
            onClick={() => setShowAddForm(true)}
            variant="custom"
            className="bg-gradient-to-r from-cyan-600 to-violet-600 hover:from-cyan-700 hover:to-violet-700"
          >
            <Plus className="w-4 h-4 mr-2" />
            Add New Project
          </Button>
        </div>
      )}

      {/* Add/Edit Project Form */}
      {showAddForm && (
        <Card className="mb-8 border-cyan-500/30">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-cyan-400">
              {editingProject ? "Edit Project" : "Add New Project"}
            </h2>
            <Button
              onClick={resetForm}
              variant="custom"
              className="bg-zinc-800 hover:bg-zinc-700"
            >
              Cancel
            </Button>
          </div>

          <form onSubmit={editingProject ? handleUpdateProject : handleAddProject} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-2">
                  Project Name <span className="text-red-400">*</span>
                </label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g., Lighter"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-2">
                  Slug {editingProject && "(cannot change)"}
                </label>
                <Input
                  value={formData.slug}
                  onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
                  placeholder="e.g., lighter"
                  required
                  disabled={!!editingProject}
                  className={editingProject ? "bg-zinc-900/50 cursor-not-allowed" : ""}
                />
                <p className="text-xs text-zinc-500 mt-1">Used in URLs, lowercase only</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-2">
                  Token Address
                </label>
                <Input
                  value={formData.tokenAddress}
                  onChange={(e) => setFormData({ ...formData, tokenAddress: e.target.value })}
                  placeholder="0x... (optional if not deployed)"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-2">
                  Asset Type <span className="text-red-400">*</span>
                </label>
                <select
                  value={formData.assetType}
                  onChange={(e) => setFormData({ ...formData, assetType: e.target.value })}
                  className="w-full px-4 py-3 bg-zinc-900/50 border border-zinc-800 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
                  required
                >
                  <option value="Tokens">Tokens</option>
                  <option value="Points">Points</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-2">
                  Twitter URL
                </label>
                <Input
                  value={formData.twitterUrl}
                  onChange={(e) => setFormData({ ...formData, twitterUrl: e.target.value })}
                  placeholder="https://x.com/project"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-2">
                  Website URL
                </label>
                <Input
                  value={formData.websiteUrl}
                  onChange={(e) => setFormData({ ...formData, websiteUrl: e.target.value })}
                  placeholder="https://project.xyz"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-2">
                Description
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={3}
                placeholder="Brief description of the project..."
                className="w-full px-4 py-3 bg-zinc-900/50 border border-zinc-800 rounded-xl text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 resize-none"
              />
            </div>

            {/* Logo and Icon Upload */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Logo Upload */}
              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-2">
                  Project Logo (Full)
                </label>
                <div className="flex flex-col gap-3">
                  {/* Preview */}
                  {logoPreview && (
                    <div className="relative w-full h-32 bg-zinc-900/30 rounded-lg overflow-hidden border-2 border-cyan-500/30">
                      <img 
                        src={logoPreview} 
                        alt="Logo preview" 
                        className="w-full h-full object-contain p-2"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          setLogoFile(null);
                          setLogoPreview(null);
                        }}
                        className="absolute top-2 right-2 w-6 h-6 bg-red-600 rounded-full text-white text-xs flex items-center justify-center hover:bg-red-700"
                      >
                        ×
                      </button>
                    </div>
                  )}
                  
                  {/* Upload Button */}
                  <label className="flex items-center justify-center px-4 py-8 bg-zinc-900/50 border-2 border-dashed border-zinc-700 rounded-xl cursor-pointer hover:border-cyan-500/50 hover:bg-zinc-900/70 transition-all">
                    <div className="text-center">
                      <Upload className="w-6 h-6 mx-auto mb-2 text-zinc-400" />
                      <p className="text-xs text-zinc-300">
                        {logoFile ? 'Change' : 'Upload'} Full Logo
                      </p>
                      <p className="text-[10px] text-zinc-500 mt-1">
                        For headers & detail pages
                      </p>
                      <p className="text-[10px] text-zinc-600 mt-0.5">
                        (Recommended: 400x100px or similar)
                      </p>
                    </div>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleLogoChange}
                      className="hidden"
                    />
                  </label>
                  {logoFile && (
                    <p className="text-xs text-cyan-400 flex items-center">
                      <CheckCircle className="w-3 h-3 mr-1" />
                      {logoFile.name}
                    </p>
                  )}
                </div>
              </div>

              {/* Icon Upload */}
              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-2">
                  Project Icon (Round)
                </label>
                <div className="flex flex-col gap-3">
                  {/* Preview */}
                  {iconPreview && (
                    <div className="relative w-full h-32 bg-zinc-900/30 rounded-lg overflow-hidden border-2 border-violet-500/30 flex items-center justify-center">
                      <img 
                        src={iconPreview} 
                        alt="Icon preview" 
                        className="w-24 h-24 object-cover rounded-full border-4 border-violet-500/20"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          setIconFile(null);
                          setIconPreview(null);
                        }}
                        className="absolute top-2 right-2 w-6 h-6 bg-red-600 rounded-full text-white text-xs flex items-center justify-center hover:bg-red-700"
                      >
                        ×
                      </button>
                    </div>
                  )}
                  
                  {/* Upload Button */}
                  <label className="flex items-center justify-center px-4 py-8 bg-zinc-900/50 border-2 border-dashed border-zinc-700 rounded-xl cursor-pointer hover:border-violet-500/50 hover:bg-zinc-900/70 transition-all">
                    <div className="text-center">
                      <Upload className="w-6 h-6 mx-auto mb-2 text-zinc-400" />
                      <p className="text-xs text-zinc-300">
                        {iconFile ? 'Change' : 'Upload'} Round Icon
                      </p>
                      <p className="text-[10px] text-zinc-500 mt-1">
                        For lists & navigation
                      </p>
                      <p className="text-[10px] text-zinc-600 mt-0.5">
                        (Recommended: 256x256px square)
                      </p>
                    </div>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleIconChange}
                      className="hidden"
                    />
                  </label>
                  {iconFile && (
                    <p className="text-xs text-violet-400 flex items-center">
                      <CheckCircle className="w-3 h-3 mr-1" />
                      {iconFile.name}
                    </p>
                  )}
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-3 pt-4">
              <Button
                type="submit"
                disabled={isPending || isConfirming || uploadingLogo || uploadingIcon || uploadingMetadata}
                variant="custom"
                className="bg-gradient-to-r from-cyan-600 to-violet-600 hover:from-cyan-700 hover:to-violet-700"
              >
                {uploadingLogo ? (
                  <>
                    <Upload className="w-4 h-4 mr-2 animate-pulse" />
                    Uploading logo to IPFS...
                  </>
                ) : uploadingIcon ? (
                  <>
                    <Upload className="w-4 h-4 mr-2 animate-pulse" />
                    Uploading icon to IPFS...
                  </>
                ) : uploadingMetadata ? (
                  <>
                    <Upload className="w-4 h-4 mr-2 animate-pulse" />
                    Uploading metadata to IPFS...
                  </>
                ) : isPending || isConfirming ? (
                  "Processing..."
                ) : (
                  editingProject ? "Update Project" : "Add Project"
                )}
              </Button>
              
              {/* Progress Messages */}
              <div className="flex flex-col gap-1">
                {uploadingLogo && (
                  <p className="text-xs text-cyan-400 flex items-center">
                    <Upload className="w-3 h-3 mr-1 animate-pulse" />
                    Step 1/4: Uploading logo to IPFS...
                  </p>
                )}
                {uploadingIcon && (
                  <p className="text-xs text-violet-400 flex items-center">
                    <Upload className="w-3 h-3 mr-1 animate-pulse" />
                    Step 2/4: Uploading icon to IPFS...
                  </p>
                )}
                {uploadingMetadata && (
                  <p className="text-xs text-cyan-400 flex items-center">
                    <Upload className="w-3 h-3 mr-1 animate-pulse" />
                    Step 3/4: Uploading metadata to IPFS...
                  </p>
                )}
                {isConfirming && (
                  <p className="text-xs text-cyan-400 flex items-center">
                    ⏳ Step 4/4: Waiting for blockchain confirmation...
                  </p>
                )}
                {isSuccess && (
                  <p className="text-xs text-green-400 flex items-center">
                    <CheckCircle className="w-3 h-3 mr-1" />
                    ✓ Project added successfully!
                  </p>
                )}
              </div>
            </div>
          </form>

          {/* TGE Management for This Project - Only show when editing */}
          {editingProject && (
            <div className="mt-8 pt-8 border-t border-zinc-800">
              <h3 className="text-xl font-bold text-violet-400 mb-4">TGE Settlement Management</h3>
              <p className="text-sm text-zinc-400 mb-4">Manage settlement windows for orders in this project</p>
              
              {loadingOrders ? (
                <p className="text-sm text-zinc-400">Loading orders for this project...</p>
              ) : (
                <TGESettlementManager 
                  orders={orders.filter(o => {
                    const project = projects.find(p => p.slug === editingProject);
                    return project && o.projectToken && typeof o.projectToken === 'string' && o.projectToken.toLowerCase() === project.tokenAddress.toLowerCase();
                  })}
                  assetType={projects.find(p => p.slug === editingProject)?.assetType || "Tokens"}
                />
              )}
            </div>
          )}
        </Card>
      )}

      {/* Projects List */}
      <Card>
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold">All Projects</h2>
          
          {/* Status Filter */}
          <div className="flex items-center gap-2">
            <span className="text-sm text-zinc-400">Filter:</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as "all" | "active" | "disabled")}
              className="px-4 py-2 bg-zinc-900/50 border border-zinc-800 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500/50 transition-all"
            >
              <option value="all">All Projects</option>
              <option value="active">Active Only</option>
              <option value="disabled">Disabled Only</option>
            </select>
          </div>
        </div>
        
        {loadingProjects ? (
          <p className="text-zinc-400 text-center py-8">Loading projects...</p>
        ) : !projects || projects.length === 0 ? (
          <p className="text-zinc-400 text-center py-8">No projects found</p>
        ) : (() => {
            const filteredProjects = projects.filter((project) => {
              if (statusFilter === "all") return true;
              if (statusFilter === "active") return project.active;
              if (statusFilter === "disabled") return !project.active;
              return true;
            });
            
            return (
              <>
                {filteredProjects.length === 0 ? (
                  <p className="text-zinc-400 text-center py-8">
                    No {statusFilter === "all" ? "" : statusFilter} projects found
                  </p>
                ) : (
                  <>
                    <p className="text-sm text-zinc-500 mb-4">
                      Showing {filteredProjects.length} of {projects.length} project{projects.length !== 1 ? 's' : ''}
                    </p>
                    <div className="space-y-4">
                      {filteredProjects.map((project) => (
              <div
                key={project.slug}
                className="flex items-center justify-between p-4 bg-zinc-900/30 border border-zinc-800 rounded-lg hover:border-cyan-500/30 transition-all"
              >
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="text-lg font-semibold">{project.name}</h3>
                    <Badge className={project.active ? "bg-green-600" : "bg-zinc-600"}>
                      {project.active ? "Active" : "Inactive"}
                    </Badge>
                    <Badge className={project.assetType === "Points" ? "bg-purple-600" : "bg-blue-600"}>
                      {project.assetType}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-4 mb-1">
                    <p className="text-sm text-zinc-400">Slug: {project.slug}</p>
                    <p className="text-xs text-zinc-500">
                      Added: {new Date(Number(project.addedAt) * 1000).toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric'
                      })}
                    </p>
                  </div>
                  {project.description && (
                    <p className="text-sm text-zinc-500">{project.description}</p>
                  )}
                  <div className="flex gap-4 mt-2">
                    {project.twitterUrl && (
                      <a href={project.twitterUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-cyan-400 hover:underline">
                        Twitter
                      </a>
                    )}
                    {project.websiteUrl && (
                      <a href={project.websiteUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-cyan-400 hover:underline">
                        Website
                      </a>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-zinc-400">
                      {project.active ? "Active" : "Disabled"}
                    </span>
                    <Switch
                      checked={project.active}
                      onChange={() => handleToggleStatus(project.slug, project.active)}
                      disabled={isPending || isConfirming}
                    />
                  </div>
                  <Button
                    onClick={() => startEditing(project)}
                    variant="custom"
                    className="bg-zinc-800 hover:bg-zinc-700 border border-cyan-500/20"
                  >
                    <Edit2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
                      ))}
                    </div>
                  </>
                )}
              </>
            );
          })()}
      </Card>
    </div>
  );
}

