"use client";

import { useState, useEffect } from "react";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Switch } from "@/components/ui/Switch";
import { TGESettlementManager } from "@/components/TGESettlementManager";
import { useAccount, useWriteContract, useReadContract, useWaitForTransactionReceipt, usePublicClient } from "wagmi";
import { REGISTRY_ADDRESS, PROJECT_REGISTRY_ABI, ORDERBOOK_ADDRESS, ESCROW_ORDERBOOK_ABI, slugToProjectId } from "@/lib/contracts";
import { isAddress, getAddress } from "viem";
import { Plus, Edit2, AlertTriangle, PlayCircle, PauseCircle, Upload, CheckCircle, Settings, DollarSign, Shield, Coins, Trash2 } from "lucide-react";
import { uploadImageToPinata, uploadMetadataToPinata } from "@/lib/pinata";
import { useToast } from "@/components/Toast";

// V3 Project structure
type Project = {
  id: `0x${string}`; // bytes32 projectId
  slug: string;
  name: string;
  metadataURI: string;
  isPoints: boolean;
  active: boolean;
  addedAt: bigint;
  tokenAddress: `0x${string}`; // Actual token address (set during TGE)
};

export default function AdminPage() {
  const { address, isConnected } = useAccount();
  const toast = useToast();
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingProject, setEditingProject] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "disabled">("all");
  const [collateralToRemove, setCollateralToRemove] = useState<string | null>(null);
  
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

  // V4: Fee management state
  const [newSettlementFee, setNewSettlementFee] = useState("");
  const [newCancellationFee, setNewCancellationFee] = useState("");
  const [newCollateralAddress, setNewCollateralAddress] = useState("");
  const [showFeeManager, setShowFeeManager] = useState(false);
  const [showCollateralManager, setShowCollateralManager] = useState(false);

  // V3: Use getActiveProjects to fetch all projects directly
  const [projects, setProjects] = useState<Project[]>([]);
  const [loadingProjects, setLoadingProjects] = useState(true);
  const publicClient = usePublicClient();

  const refetch = async () => {
    if (!publicClient) {
      console.log('⚠️ Public client not ready');
      setLoadingProjects(false);
      return;
    }
    
    console.log('🔍 Fetching all projects from registry...');
    setLoadingProjects(true);
    
    try {
      // V3: getActiveProjects returns all projects (both active and inactive)
      const rawProjects = await publicClient.readContract({
        address: REGISTRY_ADDRESS,
        abi: PROJECT_REGISTRY_ABI,
        functionName: "getActiveProjects",
      }) as any[];
      
      // V3: Contract doesn't return slug, need to derive it from name or fetch from metadata
      // For now, we'll derive slug from name (lowercase, no spaces)
      const allProjects: Project[] = rawProjects.map((proj: any) => ({
        ...proj,
        slug: proj.name.toLowerCase().replace(/\s+/g, '-'),
      }));
      
      console.log('✅ Projects loaded:', allProjects);
      setProjects(allProjects);
    } catch (error) {
      console.error('❌ Failed to load projects:', error);
      setProjects([]);
    } finally {
      setLoadingProjects(false);
    }
  };

  useEffect(() => {
    refetch();
  }, [publicClient]);

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

  // V4: Read fee configuration
  const { data: settlementFeeBps, refetch: refetchSettlementFee } = useReadContract({
    address: ORDERBOOK_ADDRESS,
    abi: ESCROW_ORDERBOOK_ABI,
    functionName: "settlementFeeBps",
  }) as { data: bigint | undefined; refetch: () => void };

  const { data: cancellationFeeBps, refetch: refetchCancellationFee } = useReadContract({
    address: ORDERBOOK_ADDRESS,
    abi: ESCROW_ORDERBOOK_ABI,
    functionName: "cancellationFeeBps",
  }) as { data: bigint | undefined; refetch: () => void };

  const { data: maxFeeBps } = useReadContract({
    address: ORDERBOOK_ADDRESS,
    abi: ESCROW_ORDERBOOK_ABI,
    functionName: "MAX_FEE_BPS",
  }) as { data: bigint | undefined };

  const { data: feeCollector } = useReadContract({
    address: ORDERBOOK_ADDRESS,
    abi: ESCROW_ORDERBOOK_ABI,
    functionName: "feeCollector",
  }) as { data: string | undefined };

  // V4: Read approved collateral
  const { data: approvedCollateral, refetch: refetchCollateral } = useReadContract({
    address: ORDERBOOK_ADDRESS,
    abi: ESCROW_ORDERBOOK_ABI,
    functionName: "getApprovedCollateral",
  }) as { data: `0x${string}`[] | undefined; refetch: () => void };

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
        }) as readonly [bigint, `0x${string}`, `0x${string}`, `0x${string}`, `0x${string}`, bigint, bigint, bigint, bigint, bigint, boolean, number];
        
        // Fetch settlement proof if order is in TGE_ACTIVATED or later status
        let proof: string | undefined;
        const status = Number(orderData[11]); // V3: status at index 11
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
        
        // Map the raw tuple to an object structure (V3: no tokensDeposited)
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
          tokensDeposited: false, // V3: removed from contract, always false
          status: orderData[11], // V3: status at index 11
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

      // Step 4: Register on-chain (V3)
      const isPoints = formData.assetType === "Points";
      writeContract({
        address: REGISTRY_ADDRESS,
        abi: PROJECT_REGISTRY_ABI,
        functionName: "addProject",
        args: [
          cleanSlug,           // string slug
          formData.name,       // string name
          tokenAddr,           // address tokenAddress
          isPoints,            // bool isPoints (V3: replaces assetType string)
          metadataURI,         // string metadataURI (V3: replaces individual fields)
        ],
      });
    } catch (error) {
      console.error("Error adding project:", error);
      alert("Failed to add project. See console for details.");
    }
  };

  // V3: Handle form submission for updating project
  const handleUpdateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!isAddress(formData.tokenAddress) && formData.tokenAddress !== "") {
      alert("Invalid token address");
      return;
    }

    // V3: Convert slug to projectId (bytes32) using keccak256
    const projectId = slugToProjectId(formData.slug);
    
    // Token address (use zero address if empty)
    const tokenAddr = formData.tokenAddress 
      ? getAddress(formData.tokenAddress) 
      : "0x0000000000000000000000000000000000000000" as `0x${string}`;

    // Get current project to check if metadata needs updating
    const currentProject = projects.find(p => p.slug === formData.slug);
    const active = currentProject?.active ?? true;

    try {
      console.log('Updating project with:', { projectId, name: formData.name, tokenAddr, active });
      
      // Check if Twitter/Website URLs have changed - if so, update metadata
      if (formData.twitterUrl || formData.websiteUrl || formData.description) {
        console.log('📦 Metadata fields provided, will update metadata URI...');
        
        // Fetch existing metadata to preserve logo/icon
        let existingMetadata: any = {};
        if (currentProject?.metadataURI) {
          try {
            const { fetchMetadataFromIPFS } = await import('@/lib/pinata');
            existingMetadata = await fetchMetadataFromIPFS(currentProject.metadataURI);
            console.log('✅ Fetched existing metadata:', existingMetadata);
          } catch (error) {
            console.warn('⚠️ Could not fetch existing metadata, will create new:', error);
          }
        }
        
        // Create updated metadata, preserving logos from existing data
        setUploadingMetadata(true);
        try {
          const metadata = {
            slug: formData.slug,
            name: formData.name,
            description: formData.description || existingMetadata.description || "",
            twitterUrl: formData.twitterUrl || existingMetadata.twitterUrl || "",
            websiteUrl: formData.websiteUrl || existingMetadata.websiteUrl || "",
            logoUrl: existingMetadata.logoUrl || "",
            iconUrl: existingMetadata.iconUrl || "",
            assetType: formData.assetType,
          };
          
          const { uploadMetadataToPinata } = await import('@/lib/pinata');
          const metadataCID = await uploadMetadataToPinata(metadata);
          const metadataURI = `ipfs://${metadataCID}`;
          console.log('✅ New metadata uploaded to IPFS:', metadataURI);
          
          // Update metadata URI on-chain
          writeContract({
            address: REGISTRY_ADDRESS,
            abi: PROJECT_REGISTRY_ABI,
            functionName: "updateMetadata",
            args: [projectId, metadataURI],
          });
          
          // Wait a bit for the metadata update to complete, then update the rest
          setTimeout(() => {
            // V3: updateProject(bytes32 id, string name, address tokenAddress, bool active)
            writeContract({
              address: REGISTRY_ADDRESS,
              abi: PROJECT_REGISTRY_ABI,
              functionName: "updateProject",
              args: [projectId, formData.name, tokenAddr, active],
            });
          }, 2000);
        } catch (error) {
          console.error('❌ Failed to update metadata:', error);
          alert(`Failed to update metadata: ${(error as Error).message}`);
          return;
        } finally {
          setUploadingMetadata(false);
        }
      } else {
        // No metadata changes, just update on-chain data
        writeContract({
          address: REGISTRY_ADDRESS,
          abi: PROJECT_REGISTRY_ABI,
          functionName: "updateProject",
          args: [projectId, formData.name, tokenAddr, active],
        });
      }
    } catch (error) {
      console.error("Error updating project:", error);
      alert("Failed to update project. See console for details.");
    }
  };

  // V3: Toggle project status using projectId directly
  const handleToggleStatus = (projectId: `0x${string}`, currentStatus: boolean) => {
    writeContract({
      address: REGISTRY_ADDRESS,
      abi: PROJECT_REGISTRY_ABI,
      functionName: "setProjectStatus",
      args: [projectId, !currentStatus],
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

  // V4: Update settlement fee
  const handleUpdateSettlementFee = () => {
    const feeBps = Number(newSettlementFee);
    if (isNaN(feeBps) || feeBps < 0 || feeBps > Number(maxFeeBps || 500)) {
      alert(`Fee must be between 0 and ${(Number(maxFeeBps || 500) / 100).toFixed(2)}%`);
      return;
    }

    if (!confirm(`Update settlement fee to ${(feeBps / 100).toFixed(2)}%?`)) {
      return;
    }

    writeContract({
      address: ORDERBOOK_ADDRESS,
      abi: ESCROW_ORDERBOOK_ABI,
      functionName: "setSettlementFee",
      args: [BigInt(feeBps)],
    });
  };

  // V4: Update cancellation fee
  const handleUpdateCancellationFee = () => {
    const feeBps = Number(newCancellationFee);
    if (isNaN(feeBps) || feeBps < 0 || feeBps > Number(maxFeeBps || 500)) {
      alert(`Fee must be between 0 and ${(Number(maxFeeBps || 500) / 100).toFixed(2)}%`);
      return;
    }

    if (!confirm(`Update cancellation fee to ${(feeBps / 100).toFixed(2)}%?`)) {
      return;
    }

    writeContract({
      address: ORDERBOOK_ADDRESS,
      abi: ESCROW_ORDERBOOK_ABI,
      functionName: "setCancellationFee",
      args: [BigInt(feeBps)],
    });
  };

  // V4: Approve new collateral
  const handleApproveCollateral = () => {
    if (!isAddress(newCollateralAddress)) {
      alert("Invalid token address");
      return;
    }

    if (!confirm(`Approve ${newCollateralAddress} as collateral?`)) {
      return;
    }

    writeContract({
      address: ORDERBOOK_ADDRESS,
      abi: ESCROW_ORDERBOOK_ABI,
      functionName: "approveCollateral",
      args: [newCollateralAddress as `0x${string}`],
    });
    
    // Clear input after transaction is sent
    setNewCollateralAddress("");
  };

  // V4: Remove collateral
  const handleRemoveCollateral = (tokenAddress: string) => {
    setCollateralToRemove(tokenAddress);
  };

  const confirmRemoveCollateral = () => {
    if (!collateralToRemove) return;

    writeContract({
      address: ORDERBOOK_ADDRESS,
      abi: ESCROW_ORDERBOOK_ABI,
      functionName: "removeCollateral",
      args: [collateralToRemove as `0x${string}`],
    });

    toast.info("Transaction sent", "Removing collateral from whitelist...");
    setCollateralToRemove(null);
  };

  // V3: Load project data into form for editing (mainly for setting token address during TGE)
  const startEditing = async (project: Project) => {
    // Fetch existing metadata to populate form
    let metadata: any = {};
    if (project.metadataURI) {
      try {
        const { fetchMetadataFromIPFS } = await import('@/lib/pinata');
        metadata = await fetchMetadataFromIPFS(project.metadataURI);
      } catch (error) {
        console.error('Could not fetch metadata:', error);
      }
    }
    
    const newFormData = {
      slug: project.slug,
      name: project.name,
      tokenAddress: project.tokenAddress && project.tokenAddress !== '0x0000000000000000000000000000000000000000' 
        ? project.tokenAddress 
        : "",
      assetType: project.isPoints ? "Points" : "Tokens",
      twitterUrl: metadata.twitterUrl || "",
      websiteUrl: metadata.websiteUrl || "",
      description: metadata.description || "",
    };
    
    setFormData(newFormData);
    setEditingProject(project.slug);
    setShowAddForm(true);
    
    // Scroll to form
    setTimeout(() => {
      const formElement = document.querySelector('[data-edit-form]');
      if (formElement) {
        formElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 100);
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
        refetchCollateral(); // V4: Refetch collateral whitelist
        refetchSettlementFee(); // V4: Refetch settlement fee
        refetchCancellationFee(); // V4: Refetch cancellation fee
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
    <div className="mx-auto max-w-7xl px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl md:text-4xl font-bold mb-3 flex items-center gap-3">
          <Settings className="w-8 h-8 md:w-10 md:h-10 text-cyan-400" />
          <span className="bg-gradient-to-r from-cyan-400 to-violet-400 bg-clip-text text-transparent">
            Admin Panel
          </span>
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

      {/* V4: Fee Management */}
      <Card className="mb-6 p-6 border-cyan-500/30 bg-cyan-950/10">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-cyan-500/20">
              <DollarSign className="w-5 h-5 text-cyan-400" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-cyan-400">Fee Configuration</h3>
              <p className="text-sm text-zinc-400">
                Manage protocol fees for settlement and cancellations
              </p>
            </div>
          </div>
          <Button
            onClick={() => setShowFeeManager(!showFeeManager)}
            variant="custom"
            className="bg-cyan-600/20 hover:bg-cyan-600/30 text-cyan-400 border border-cyan-500/30"
          >
            {showFeeManager ? "Hide" : "Manage Fees"}
          </Button>
        </div>

        {/* Current Fee Display */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          <div className="bg-zinc-900/50 p-4 rounded-lg border border-zinc-800">
            <div className="text-xs text-zinc-500 mb-1">Settlement Fee</div>
            <div className="text-2xl font-bold text-cyan-400">
              {settlementFeeBps ? `${(Number(settlementFeeBps) / 100).toFixed(2)}%` : "Loading..."}
            </div>
            <div className="text-xs text-zinc-600 mt-1">
              {settlementFeeBps && `${settlementFeeBps.toString()} BPS`}
            </div>
          </div>
          
          <div className="bg-zinc-900/50 p-4 rounded-lg border border-zinc-800">
            <div className="text-xs text-zinc-500 mb-1">Cancellation Fee</div>
            <div className="text-2xl font-bold text-orange-400">
              {cancellationFeeBps ? `${(Number(cancellationFeeBps) / 100).toFixed(2)}%` : "Loading..."}
            </div>
            <div className="text-xs text-zinc-600 mt-1">
              {cancellationFeeBps && `${cancellationFeeBps.toString()} BPS`}
            </div>
          </div>
          
          <div className="bg-zinc-900/50 p-4 rounded-lg border border-zinc-800">
            <div className="text-xs text-zinc-500 mb-1">Maximum Fee Cap</div>
            <div className="text-2xl font-bold text-red-400">
              {maxFeeBps ? `${(Number(maxFeeBps) / 100).toFixed(2)}%` : "Loading..."}
            </div>
            <div className="text-xs text-zinc-600 mt-1">
              {maxFeeBps && `${maxFeeBps.toString()} BPS`}
            </div>
          </div>
        </div>

        {/* Fee Collector Display */}
        <div className="bg-zinc-900/50 p-4 rounded-lg border border-zinc-800 mb-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs text-zinc-500 mb-1">Fee Collector Address</div>
              <div className="text-sm font-mono text-violet-400">
                {feeCollector || "Loading..."}
              </div>
            </div>
            <Badge className="bg-violet-600/20 text-violet-400 border-violet-500/30">
              Fees Auto-Transferred
            </Badge>
          </div>
        </div>

        {/* Fee Update Forms */}
        {showFeeManager && (
          <div className="space-y-4 pt-4 border-t border-zinc-800">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Update Settlement Fee */}
              <div className="space-y-3">
                <label className="text-sm font-medium text-zinc-300">
                  Update Settlement Fee (BPS)
                </label>
                <div className="flex gap-2">
                  <Input
                    type="number"
                    value={newSettlementFee}
                    onChange={(e) => setNewSettlementFee(e.target.value)}
                    placeholder="e.g. 50 = 0.5%"
                    className="flex-1"
                    min="0"
                    max={maxFeeBps ? Number(maxFeeBps) : 500}
                  />
                  <Button
                    onClick={handleUpdateSettlementFee}
                    disabled={!newSettlementFee || isPending}
                    variant="custom"
                    className="bg-cyan-600 hover:bg-cyan-700 text-white"
                  >
                    Update
                  </Button>
                </div>
                <p className="text-xs text-zinc-500">
                  Applied to both stable and token sides during settlement
                </p>
              </div>

              {/* Update Cancellation Fee */}
              <div className="space-y-3">
                <label className="text-sm font-medium text-zinc-300">
                  Update Cancellation Fee (BPS)
                </label>
                <div className="flex gap-2">
                  <Input
                    type="number"
                    value={newCancellationFee}
                    onChange={(e) => setNewCancellationFee(e.target.value)}
                    placeholder="e.g. 10 = 0.1%"
                    className="flex-1"
                    min="0"
                    max={maxFeeBps ? Number(maxFeeBps) : 500}
                  />
                  <Button
                    onClick={handleUpdateCancellationFee}
                    disabled={!newCancellationFee || isPending}
                    variant="custom"
                    className="bg-orange-600 hover:bg-orange-700 text-white"
                  >
                    Update
                  </Button>
                </div>
                <p className="text-xs text-zinc-500">
                  Applied immediately when orders are cancelled
                </p>
              </div>
            </div>
          </div>
        )}
      </Card>

      {/* V4: Collateral Whitelist Management */}
      <Card className="mb-6 p-6 border-violet-500/30 bg-violet-950/10">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-violet-500/20">
              <Shield className="w-5 h-5 text-violet-400" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-violet-400">Collateral Whitelist</h3>
              <p className="text-sm text-zinc-400">
                Manage approved tokens for order collateral
              </p>
            </div>
          </div>
          <Button
            onClick={() => setShowCollateralManager(!showCollateralManager)}
            variant="custom"
            className="bg-violet-600/20 hover:bg-violet-600/30 text-violet-400 border border-violet-500/30"
          >
            {showCollateralManager ? "Hide" : "Manage Collateral"}
          </Button>
        </div>

        {/* Approved Collateral List */}
        <div className="space-y-2">
          <div className="text-sm font-medium text-zinc-300 mb-3">
            Approved Tokens ({approvedCollateral?.length || 0})
          </div>
          
          {approvedCollateral && approvedCollateral.length > 0 ? (
            <div className="grid grid-cols-1 gap-2">
              {approvedCollateral.map((tokenAddr, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between bg-zinc-900/50 p-3 rounded-lg border border-zinc-800"
                >
                  <div className="flex items-center gap-3">
                    <Coins className="w-4 h-4 text-violet-400" />
                    <div>
                      <div className="text-sm font-mono text-white">{tokenAddr}</div>
                      <div className="text-xs text-zinc-500">
                        {idx === 0 && "Primary Stable (Cannot Remove)"}
                      </div>
                    </div>
                  </div>
                  
                  {idx !== 0 && (
                    <Button
                      onClick={() => handleRemoveCollateral(tokenAddr)}
                      disabled={isPending}
                      variant="custom"
                      className="bg-red-600/20 hover:bg-red-600/30 text-red-400 border border-red-500/30 text-xs px-3 py-1"
                    >
                      <Trash2 className="w-3 h-3 mr-1" />
                      Remove
                    </Button>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-zinc-500">
              No approved collateral found
            </div>
          )}
        </div>

        {/* Add New Collateral */}
        {showCollateralManager && (
          <div className="mt-4 pt-4 border-t border-zinc-800">
            <label className="text-sm font-medium text-zinc-300 block mb-3">
              Approve New Collateral Token
            </label>
            <div className="flex gap-2">
              <Input
                type="text"
                value={newCollateralAddress}
                onChange={(e) => setNewCollateralAddress(e.target.value)}
                placeholder="0x... Token Address"
                className="flex-1 font-mono text-sm"
              />
              <Button
                onClick={handleApproveCollateral}
                disabled={!newCollateralAddress || isPending}
                variant="custom"
                className="bg-violet-600 hover:bg-violet-700 text-white"
              >
                <Plus className="w-4 h-4 mr-2" />
                Approve
              </Button>
            </div>
            <p className="text-xs text-zinc-500 mt-2">
              ⚠️ Only approve trusted ERC20 tokens. Token must have code deployed and valid decimals.
            </p>
          </div>
        )}
      </Card>

      {/* Add Project Button */}
      {!showAddForm && (
        <div className="mb-6">
          <Button
            onClick={() => {
              resetForm(); // Clear any editing state
              setShowAddForm(true);
            }}
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
        <Card className="mb-8 border-cyan-500/30" data-edit-form>
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-2xl font-bold text-cyan-400">
                {editingProject ? `Edit ${formData.name || 'Project'}` : "Add New Project"}
              </h2>
            </div>
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
                        (Max height: 48px, max width: 200px)
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
                    <div className="relative w-full h-32 bg-zinc-900/30 rounded-lg overflow-hidden border-2 border-blue-500/30 flex items-center justify-center">
                      <img 
                        src={iconPreview} 
                        alt="Icon preview" 
                        className="w-24 h-24 object-cover rounded-full border-4 border-blue-500/20"
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
                        (Displayed: 40-48px round)
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
                    if (!project) return false;
                    // V3: Compare projectId (bytes32) from order with project.id
                    return o.projectToken && typeof o.projectToken === 'string' && o.projectToken.toLowerCase() === project.id.toLowerCase();
                  })}
                  assetType={projects.find(p => p.slug === editingProject)?.isPoints ? "Points" : "Tokens"}
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
                    <Badge className={project.isPoints ? "bg-purple-600" : "bg-blue-600"}>
                      {project.isPoints ? "Points" : "Tokens"}
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
                  {project.metadataURI && (
                    <p className="text-xs text-zinc-500 truncate max-w-md">
                      Metadata: {project.metadataURI}
                    </p>
                  )}
                  {project.tokenAddress && project.tokenAddress !== '0x0000000000000000000000000000000000000000' && (
                    <p className="text-xs text-zinc-500 truncate max-w-md">
                      Token: {project.tokenAddress}
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-3">
                  <Button
                    onClick={() => startEditing(project)}
                    variant="custom"
                    className="bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 border border-blue-500/30 text-sm px-3 py-1.5"
                  >
                    Edit
                  </Button>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-zinc-400">
                      {project.active ? "Active" : "Disabled"}
                    </span>
                    <Switch
                      checked={project.active}
                      onChange={() => handleToggleStatus(project.id, project.active)}
                      disabled={isPending || isConfirming}
                    />
                  </div>
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

      {/* Remove Collateral Confirmation Modal */}
      {collateralToRemove && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50">
          <Card className="max-w-md w-full mx-4 p-6 bg-zinc-900 border-red-500/30">
            <div className="mb-4">
              <h3 className="text-xl font-bold text-white mb-2 flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-red-400" />
                Remove Collateral
              </h3>
              <p className="text-sm text-zinc-400 mb-3">
                Are you sure you want to remove this token from the approved collateral whitelist?
              </p>
              <div className="p-3 bg-zinc-800/50 rounded-lg border border-zinc-700">
                <div className="text-xs text-zinc-500 mb-1">Token Address</div>
                <div className="text-sm font-mono text-red-400 break-all">{collateralToRemove}</div>
              </div>
            </div>

            <div className="space-y-3 mb-6">
              <div className="flex items-start gap-2 text-sm text-yellow-400 bg-yellow-950/20 p-3 rounded-lg border border-yellow-500/30">
                <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-medium">Important</p>
                  <p className="text-xs text-yellow-300/80 mt-1">
                    Existing orders using this collateral will not be affected. Only new orders will be prevented from using this token.
                  </p>
                </div>
              </div>
            </div>

            <div className="flex gap-3">
              <Button
                onClick={() => setCollateralToRemove(null)}
                variant="custom"
                className="flex-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-300"
              >
                Cancel
              </Button>
              <Button
                onClick={confirmRemoveCollateral}
                disabled={isPending}
                variant="custom"
                className="flex-1 bg-red-600 hover:bg-red-700 text-white"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Remove Collateral
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}

