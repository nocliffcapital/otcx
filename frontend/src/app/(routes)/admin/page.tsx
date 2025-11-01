"use client";

import { useState, useEffect } from "react";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Switch } from "@/components/ui/Switch";
import { TGESettlementManager } from "@/components/TGESettlementManager";
import { useAccount, useWriteContract, useReadContract, useWaitForTransactionReceipt, usePublicClient, useBlockNumber, useChainId } from "wagmi";
import { getExplorerUrl } from "@/lib/chains";
import { REGISTRY_ADDRESS, PROJECT_REGISTRY_ABI, ORDERBOOK_ADDRESS, ESCROW_ORDERBOOK_ABI, slugToProjectId } from "@/lib/contracts";
import { isAddress, getAddress } from "viem";
import { Plus, Edit2, AlertTriangle, PlayCircle, PauseCircle, Upload, CheckCircle, Settings, DollarSign, Shield, Coins, Trash2, Terminal, Database, Cpu, ChevronDown } from "lucide-react";
import { uploadImageToPinata, uploadMetadataToPinata } from "@/lib/pinata";
import { useToast } from "@/components/Toast";
import { ProjectImage } from "@/components/ProjectImage";

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
  const chainId = useChainId();
  const toast = useToast();
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingProject, setEditingProject] = useState<string | null>(null);
  const [showTGEManager, setShowTGEManager] = useState(false);
  const [tgeProjectSlug, setTgeProjectSlug] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<"active" | "ended" | "all">("active");
  const [projectTgeStatus, setProjectTgeStatus] = useState<Record<string, boolean>>({});
  
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
  const [newMinOrderValue, setNewMinOrderValue] = useState("");
  const [showFeeManager, setShowFeeManager] = useState(false);

  // V3: Use getActiveProjects to fetch all projects directly
  const [projects, setProjects] = useState<Project[]>([]);
  const [loadingProjects, setLoadingProjects] = useState(true);
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

  const refetch = async () => {
    if (!publicClient) {
      console.log('⚠️ Public client not ready');
      setLoadingProjects(false);
      return;
    }
    
    console.log('🔍 Fetching all projects from registry...');
    setLoadingProjects(true);
    
    try {
      // V4: Get all project IDs (includes both active and inactive projects)
      const projectIds = await publicClient.readContract({
        address: REGISTRY_ADDRESS,
        abi: PROJECT_REGISTRY_ABI,
        functionName: "getAllProjectIds",
      }) as `0x${string}`[];
      
      console.log('📋 Project IDs:', projectIds);
      
      // Fetch each project individually
      const projectPromises = projectIds.map(async (id) => {
        const project = await publicClient.readContract({
          address: REGISTRY_ADDRESS,
          abi: PROJECT_REGISTRY_ABI,
          functionName: "getProject",
          args: [id],
        }) as any;
        
        // Derive slug from name (lowercase, no spaces, no special chars)
        const slug = project.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
        
        return {
          ...project,
          slug,
        };
      });
      
      const allProjects = await Promise.all(projectPromises);
      
      console.log('✅ Projects loaded:', allProjects);
      setProjects(allProjects);

      // Fetch TGE status for each project
      const tgeStatusMap: Record<string, boolean> = {};
      for (const project of allProjects) {
        try {
          const tgeActivated = await publicClient.readContract({
            address: ORDERBOOK_ADDRESS,
            abi: ESCROW_ORDERBOOK_ABI,
            functionName: "projectTgeActivated",
            args: [project.id],
          }) as boolean;
          tgeStatusMap[project.slug] = tgeActivated;
        } catch (error) {
          console.error(`Failed to fetch TGE status for ${project.slug}:`, error);
          tgeStatusMap[project.slug] = false;
        }
      }
      setProjectTgeStatus(tgeStatusMap);
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

  const { data: minOrderValue, refetch: refetchMinOrderValue } = useReadContract({
    address: ORDERBOOK_ADDRESS,
    abi: ESCROW_ORDERBOOK_ABI,
    functionName: "minOrderValue",
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
  const { isLoading: isConfirming, isSuccess, error } = useWaitForTransactionReceipt({ hash });

  // Handle form submission for adding project
  const handleAddProject = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!isAddress(formData.tokenAddress) && formData.tokenAddress !== "") {
      toast.error("Invalid token address", "Please enter a valid Ethereum address");
      return;
    }

    const cleanSlug = formData.slug.toLowerCase().replace(/[^a-z0-9-]/g, '-');
    
    // Token address handling:
    // - Points projects: Must be address(0)
    // - Token projects: address(0) if pre-TGE, or deployed contract address
    const isPointsProject = formData.assetType === "Points";
    const tokenAddr = formData.tokenAddress 
      ? getAddress(formData.tokenAddress) 
      : "0x0000000000000000000000000000000000000000" as `0x${string}`;

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
          toast.error("Upload failed", `Failed to upload logo: ${(error as Error).message}`);
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
          toast.error("Upload failed", `Failed to upload icon: ${(error as Error).message}`);
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
        toast.error("Upload failed", `Failed to upload metadata: ${(error as Error).message}`);
        return;
      } finally {
        setUploadingMetadata(false);
      }

      // Step 4: Register on-chain (V3)
      toast.info(
        "Adding project",
        "Transaction pending..."
      );

      writeContract({
        address: REGISTRY_ADDRESS,
        abi: PROJECT_REGISTRY_ABI,
        functionName: "addProject",
        args: [
          cleanSlug,           // string slug
          formData.name,       // string name
          tokenAddr,           // address tokenAddress (address(0) for Points)
          isPointsProject,     // bool isPoints (V3: replaces assetType string)
          metadataURI,         // string metadataURI (V3: replaces individual fields)
        ],
      });
    } catch (error) {
      console.error("Error adding project:", error);
      toast.error("Failed to add project", "See console for details");
    }
  };

  // V3: Handle form submission for updating project
  const handleUpdateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!isAddress(formData.tokenAddress) && formData.tokenAddress !== "") {
      toast.error("Invalid token address", "Please enter a valid Ethereum address");
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
            // V4: updateProject(bytes32 id, string name, address tokenAddress)
            // Note: Active status is managed separately via setProjectStatus()
            toast.info(
              "Updating project",
              "Transaction pending..."
            );

            writeContract({
              address: REGISTRY_ADDRESS,
              abi: PROJECT_REGISTRY_ABI,
              functionName: "updateProject",
              args: [projectId, formData.name, tokenAddr],
            });
          }, 2000);
        } catch (error) {
          console.error('❌ Failed to update metadata:', error);
          toast.error("Update failed", `Failed to update metadata: ${(error as Error).message}`);
          return;
        } finally {
          setUploadingMetadata(false);
        }
      } else {
        // No metadata changes, just update on-chain data
        toast.info(
          "Updating project",
          "Transaction pending..."
        );

        writeContract({
          address: REGISTRY_ADDRESS,
          abi: PROJECT_REGISTRY_ABI,
          functionName: "updateProject",
          args: [projectId, formData.name, tokenAddr],
        });
      }
    } catch (error) {
      console.error("Error updating project:", error);
      toast.error("Failed to update project", "See console for details");
    }
  };

  // V3: Toggle project status using projectId directly
  const handleToggleStatus = (projectId: `0x${string}`, currentStatus: boolean) => {
    toast.info(
      `${!currentStatus ? 'Activating' : 'Deactivating'} project`,
      "Transaction pending..."
    );

    writeContract({
      address: REGISTRY_ADDRESS,
      abi: PROJECT_REGISTRY_ABI,
      functionName: "setProjectStatus",
      args: [projectId, !currentStatus],
    });
  };

  // V4: Handle updating token address for Points projects that converted to tokens
  const handleUpdateTokenAddress = (projectId: `0x${string}`, projectName: string) => {
    const newTokenAddress = prompt(
      `Enter the new token address for ${projectName}:\n\n` +
      `⚠️ This function is for Points projects that have converted to on-chain tokens.\n` +
      `The token contract must be deployed on-chain.`,
      ""
    );
    
    if (!newTokenAddress) return;
    
    // Validate address format
    if (!isAddress(newTokenAddress)) {
      toast.error("Invalid address", "Please enter a valid Ethereum address");
      return;
    }
    
    const confirmed = confirm(
      `Update token address for ${projectName}?\n\n` +
      `New Address: ${newTokenAddress}\n\n` +
      `This will allow the project to use token-based settlement instead of proof-based settlement.`
    );
    
    if (!confirmed) return;
    
    toast.info(
      "Updating token address",
      "Transaction pending..."
    );

    writeContract({
      address: REGISTRY_ADDRESS,
      abi: PROJECT_REGISTRY_ABI,
      functionName: "updateTokenAddress",
      args: [projectId, getAddress(newTokenAddress)],
    });
  };

  // Pause/Unpause orderbook
  const handlePauseOrderbook = () => {
    if (!confirm(`Are you sure you want to ${isContractPaused ? 'UNPAUSE' : 'PAUSE'} the orderbook contract? This will ${isContractPaused ? 'enable' : 'disable'} all trading.`)) {
      return;
    }

    toast.info(
      `${isContractPaused ? 'Resuming' : 'Pausing'} trading`,
      "Transaction pending..."
    );

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
      toast.error("Invalid fee", `Fee must be between 0 and ${(Number(maxFeeBps || 500) / 100).toFixed(2)}%`);
      return;
    }

    if (!confirm(`Update settlement fee to ${(feeBps / 100).toFixed(2)}%?`)) {
      return;
    }

    toast.info("Updating settlement fee", "Transaction pending");
    
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
      toast.error("Invalid fee", `Fee must be between 0 and ${(Number(maxFeeBps || 500) / 100).toFixed(2)}%`);
      return;
    }

    if (!confirm(`Update cancellation fee to ${(feeBps / 100).toFixed(2)}%?`)) {
      return;
    }

    toast.info("Updating cancellation fee", "Transaction pending");
    
    writeContract({
      address: ORDERBOOK_ADDRESS,
      abi: ESCROW_ORDERBOOK_ABI,
      functionName: "setCancellationFee",
      args: [BigInt(feeBps)],
    });
  };

  // V4: Update minimum order value
  const handleUpdateMinOrderValue = () => {
    const valueUSD = Number(newMinOrderValue);
    if (isNaN(valueUSD) || valueUSD <= 0) {
      toast.error("Invalid value", "Minimum order value must be greater than 0");
      return;
    }

    // Convert USD to stable decimals (e.g., 100 USD -> 100 * 10^6 for USDC)
    const stableDecimals = 6; // USDC has 6 decimals
    const valueInStableUnits = BigInt(Math.floor(valueUSD * (10 ** stableDecimals)));

    if (!confirm(`Update minimum order value to $${valueUSD}?`)) {
      return;
    }

    toast.info("Updating minimum order value", "Transaction pending");
    
    writeContract({
      address: ORDERBOOK_ADDRESS,
      abi: ESCROW_ORDERBOOK_ABI,
      functionName: "setMinOrderValue",
      args: [valueInStableUnits],
    });
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
      toast.error("Invalid file type", "Please upload an image (PNG, JPG, GIF, or WebP)");
      return;
    }

    // Validate file size (max 5MB)
    const maxSize = 5 * 1024 * 1024;
    if (file.size > maxSize) {
      toast.error("File too large", "Maximum size is 5MB");
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
      toast.error("Invalid file type", "Please upload an image (PNG, JPG, GIF, or WebP)");
      return;
    }

    // Validate file size (max 5MB)
    const maxSize = 5 * 1024 * 1024;
    if (file.size > maxSize) {
      toast.error("File too large", "Maximum size is 5MB");
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

  const openTGEManager = (slug: string) => {
    setTgeProjectSlug(slug);
    setShowTGEManager(true);
  };

  const closeTGEManager = () => {
    setTgeProjectSlug(null);
    setShowTGEManager(false);
  };

  // Refresh after successful transaction
  const [hasRefreshed, setHasRefreshed] = useState(false);
  
  // Handle transaction errors
  useEffect(() => {
    if (error && hash) {
      toast.error(
        "Transaction failed",
        (error as Error)?.message || "Please check the console for details"
      );
    }
  }, [error, hash, toast]);

  useEffect(() => {
    if (isSuccess && !hasRefreshed) {
      setHasRefreshed(true);
      toast.success("Transaction confirmed!", "Changes will be reflected shortly");
      setTimeout(() => {
        refetch();
        refetchPaused();
        refetchSettlementFee(); // V4: Refetch settlement fee
        refetchCancellationFee(); // V4: Refetch cancellation fee
        refetchMinOrderValue(); // V4: Refetch min order value
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
          <div className="p-4 rounded text-left text-xs space-y-2" style={{ backgroundColor: '#121218', border: '1px solid #2b2b30' }}>
            <div>
              <span className="text-zinc-500">Connected Wallet:</span>
              <p className="text-white font-mono mt-1">{address}</p>
            </div>
            <div>
              <span className="text-zinc-500">Registry Owner:</span>
              <p className="text-zinc-100 font-mono mt-1">{owner as string || 'Loading...'}</p>
            </div>
            <div className="pt-2 mt-2 border-t" style={{ borderColor: '#2b2b30' }}>
              <span className="text-zinc-500">Registry Address:</span>
              <p className="text-zinc-100 font-mono mt-1">{REGISTRY_ADDRESS}</p>
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
              <Settings className="w-10 h-10 text-zinc-300" />
            </div>
            <div className="min-w-0 flex-1">
              <span className="text-zinc-300/70 text-xs mb-1 block">otcX://protocol/admin/control-panel</span>
              <h1 className="text-2xl md:text-3xl font-bold text-white tracking-tight break-words">
                ADMIN_CONTROL_PANEL
              </h1>
              <p className="text-xs text-zinc-300/70 mt-1 break-words">
                Platform Management • System Configuration
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

      {/* Emergency Controls */}
      <Card className="mb-6 p-4 transition-all" style={{ backgroundColor: '#121218', borderColor: '#2b2b30' }}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg" style={{ backgroundColor: '#2b2b30' }}>
              <AlertTriangle className="w-5 h-5 text-red-400" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-zinc-100">
                Emergency Controls
              </h3>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-xs text-zinc-400">Orderbook Status:</span>
                {isContractPaused ? (
                  <div className={`flex items-center gap-2 px-3 py-1.5 rounded border ${
                    'bg-red-950/30 border-red-500/50'
                  }`}>
                    <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                    <span className="text-xs font-mono font-semibold text-red-400">
                      PAUSED
                    </span>
                  </div>
                ) : (
                  <div className={`flex items-center gap-2 px-3 py-1.5 rounded border ${
                    'bg-green-950/30 border-green-500/50'
                  }`}>
                    <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                    <span className="text-xs font-mono font-semibold text-green-400">
                      ACTIVE
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>
          
          <Button
            onClick={handlePauseOrderbook}
            disabled={isPending || isConfirming}
            variant="custom"
            className={`min-w-[150px] h-10 border font-mono uppercase ${
              isContractPaused ? '' : 'bg-red-600 hover:bg-red-700'
            }`}
            style={isContractPaused ? { backgroundColor: '#2b2b30', borderColor: '#2b2b30', color: 'white' } : { borderColor: '#dc2626', color: 'white' }}
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
      <Card className="mb-6 p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg" style={{ backgroundColor: '#2b2b30' }}>
              <DollarSign className="w-5 h-5 text-zinc-300" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-zinc-100">Fee Configuration</h3>
              <p className="text-sm text-zinc-400">
                Manage protocol fees for settlement and cancellations
              </p>
            </div>
          </div>
          <Button
            onClick={() => setShowFeeManager(!showFeeManager)}
            variant="custom"
            className="text-zinc-100 border"
            style={{ backgroundColor: '#2b2b30', borderColor: '#2b2b30' }}
          >
            {showFeeManager ? "Hide" : "Manage Fees"}
          </Button>
        </div>

        {/* Current Fee Display */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          <div className="p-4 rounded border" style={{ backgroundColor: '#121218', borderColor: '#2b2b30' }}>
            <div className="text-xs text-zinc-500 mb-1">Settlement Fee</div>
            <div className="text-2xl font-bold text-zinc-100">
              {settlementFeeBps ? `${(Number(settlementFeeBps) / 100).toFixed(2)}%` : "Loading..."}
            </div>
            <div className="text-xs text-zinc-600 mt-1">
              {settlementFeeBps && `${settlementFeeBps.toString()} BPS`}
            </div>
          </div>
          
          <div className="p-4 rounded border" style={{ backgroundColor: '#121218', borderColor: '#2b2b30' }}>
            <div className="text-xs text-zinc-500 mb-1">Cancellation Fee</div>
            <div className="text-2xl font-bold text-zinc-100">
              {cancellationFeeBps ? `${(Number(cancellationFeeBps) / 100).toFixed(2)}%` : "Loading..."}
            </div>
            <div className="text-xs text-zinc-600 mt-1">
              {cancellationFeeBps && `${cancellationFeeBps.toString()} BPS`}
            </div>
          </div>
          
          <div className="p-4 rounded border" style={{ backgroundColor: '#121218', borderColor: '#2b2b30' }}>
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
        <div className="p-4 rounded border mb-4" style={{ backgroundColor: '#121218', borderColor: '#2b2b30' }}>
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs text-zinc-500 mb-1">Fee Collector Address</div>
              {feeCollector ? (
                <a 
                  href={`https://blockscan.com/address/${feeCollector}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm font-mono text-zinc-300 hover:text-zinc-100 underline decoration-dotted hover:decoration-solid transition-all"
                >
                  {feeCollector}
                </a>
              ) : (
                <div className="text-sm font-mono text-zinc-300">Loading...</div>
              )}
            </div>
            <Badge className="bg-zinc-700 text-zinc-300 border-zinc-600">
              Fees Auto-Transferred
            </Badge>
          </div>
        </div>

        {/* Fee Update Forms */}
        {showFeeManager && (
          <div className="space-y-4 pt-4 border-t" style={{ borderColor: '#2b2b30' }}>
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

            {/* Update Minimum Order Value */}
            <div className="space-y-3 pt-4 border-t" style={{ borderColor: '#2b2b30' }}>
              <label className="text-sm font-medium text-zinc-300">
                Update Minimum Order Value (USD)
              </label>
              <div className="flex gap-2 items-start">
                <div className="flex-1">
                  <div className="flex gap-2">
                    <Input
                      type="number"
                      value={newMinOrderValue}
                      onChange={(e) => setNewMinOrderValue(e.target.value)}
                      placeholder={minOrderValue ? `Current: $${(Number(minOrderValue) / 1e6).toFixed(0)}` : "e.g. 100"}
                      className="flex-1"
                      min="1"
                    />
                    <Button
                      onClick={handleUpdateMinOrderValue}
                      disabled={!newMinOrderValue || isPending}
                      variant="custom"
                      className="bg-violet-600 hover:bg-violet-700 text-white"
                    >
                      Update
                    </Button>
                  </div>
                  <p className="text-xs text-zinc-500 mt-2">
                    Prevents dust orders and ensures meaningful trading volume. Current: <span className="text-zinc-100 font-medium">${minOrderValue ? (Number(minOrderValue) / 1e6).toFixed(0) : 'Loading...'}</span>
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </Card>


      {/* Add/Edit Project Form - Modal */}
      {showAddForm && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4 overflow-y-auto">
          <Card className="w-full max-w-4xl my-8 p-4" data-edit-form>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-bold text-zinc-100">
                {editingProject ? `Edit ${formData.name || 'Project'}` : "Add New Project"}
              </h2>
              <Button
                onClick={resetForm}
                variant="custom"
                className="text-sm px-3 py-1.5 border"
                style={{ backgroundColor: '#2b2b30', borderColor: '#2b2b30' }}
              >
                ✕ Close
              </Button>
            </div>

          <form onSubmit={editingProject ? handleUpdateProject : handleAddProject} className="space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1">
                  Project Name <span className="text-red-400">*</span>
                </label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g., Lighter"
                  required
                  className="text-sm py-2"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1">
                  Slug {editingProject && "(cannot change)"}
                </label>
                <Input
                  value={formData.slug}
                  onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
                  placeholder="e.g., lighter"
                  required
                  disabled={!!editingProject}
                  className={`text-sm py-2 ${editingProject ? "cursor-not-allowed" : ""}`}
                  style={editingProject ? { backgroundColor: '#121218', opacity: 0.5 } : {}}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1">
                  Token Address
                </label>
                <Input
                  value={formData.tokenAddress}
                  onChange={(e) => setFormData({ ...formData, tokenAddress: e.target.value })}
                  placeholder="0x... (optional if not deployed)"
                  className="text-xs py-2 font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1">
                  Asset Type <span className="text-red-400">*</span>
                </label>
                <div className="relative">
                  <select
                    value={formData.assetType}
                    onChange={(e) => setFormData({ ...formData, assetType: e.target.value })}
                    className="w-full pl-3 pr-10 py-2 text-sm rounded text-white focus:outline-none appearance-none"
                    style={{ backgroundColor: '#121218', borderColor: '#2b2b30', border: '1px solid' }}
                    required
                  >
                    <option value="Tokens">Tokens</option>
                    <option value="Points">Points</option>
                  </select>
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
                    <ChevronDown className="w-4 h-4 text-zinc-400" />
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1">
                  Twitter URL
                </label>
                <Input
                  value={formData.twitterUrl}
                  onChange={(e) => setFormData({ ...formData, twitterUrl: e.target.value })}
                  placeholder="https://x.com/project"
                  className="text-sm py-2"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1">
                  Website URL
                </label>
                <Input
                  value={formData.websiteUrl}
                  onChange={(e) => setFormData({ ...formData, websiteUrl: e.target.value })}
                  placeholder="https://project.xyz"
                  className="text-sm py-2"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1">
                Description
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={2}
                placeholder="Brief description of the project..."
                className="w-full px-3 py-2 text-sm rounded text-white placeholder-zinc-500 focus:outline-none resize-none"
                style={{ backgroundColor: '#121218', borderColor: '#2b2b30', border: '1px solid' }}
              />
            </div>

            {/* Logo and Icon Upload */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {/* Logo Upload */}
              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1">
                  Project Logo (Full)
                </label>
                <div className="flex flex-col gap-2">
                  {/* Preview */}
                  {logoPreview && (
                    <div className="relative w-full h-20 rounded overflow-hidden border" style={{ backgroundColor: '#121218', borderColor: '#2b2b30' }}>
                      <img 
                        src={logoPreview} 
                        alt="Logo preview" 
                        className="w-full h-full object-contain p-1"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          setLogoFile(null);
                          setLogoPreview(null);
                        }}
                        className="absolute top-1 right-1 w-5 h-5 bg-red-600 rounded-full text-white text-xs flex items-center justify-center hover:bg-red-700"
                      >
                        ×
                      </button>
                    </div>
                  )}
                  
                  {/* Upload Button */}
                  <label className="flex items-center justify-center px-3 py-4 border border-dashed rounded cursor-pointer transition-all hover:opacity-80"
                    style={{ backgroundColor: '#121218', borderColor: '#2b2b30' }}>
                    <div className="text-center">
                      <Upload className="w-4 h-4 mx-auto mb-1 text-zinc-400" />
                      <p className="text-[10px] text-zinc-300">
                        {logoFile ? 'Change' : 'Upload'} Logo
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
                    <p className="text-[10px] text-zinc-300 flex items-center truncate">
                      <CheckCircle className="w-3 h-3 mr-1 flex-shrink-0" />
                      {logoFile.name}
                    </p>
                  )}
                </div>
              </div>

              {/* Icon Upload */}
              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1">
                  Project Icon (Round)
                </label>
                <div className="flex flex-col gap-2">
                  {/* Preview */}
                  {iconPreview && (
                    <div className="relative w-full h-20 rounded overflow-hidden border flex items-center justify-center" style={{ backgroundColor: '#121218', borderColor: '#2b2b30' }}>
                      <img 
                        src={iconPreview} 
                        alt="Icon preview" 
                        className="w-16 h-16 object-cover rounded-full border-2"
                        style={{ borderColor: '#2b2b30' }}
                      />
                      <button
                        type="button"
                        onClick={() => {
                          setIconFile(null);
                          setIconPreview(null);
                        }}
                        className="absolute top-1 right-1 w-5 h-5 bg-red-600 rounded-full text-white text-xs flex items-center justify-center hover:bg-red-700"
                      >
                        ×
                      </button>
                    </div>
                  )}
                  
                  {/* Upload Button */}
                  <label className="flex items-center justify-center px-3 py-4 border border-dashed rounded cursor-pointer transition-all hover:opacity-80"
                    style={{ backgroundColor: '#121218', borderColor: '#2b2b30' }}>
                    <div className="text-center">
                      <Upload className="w-4 h-4 mx-auto mb-1 text-zinc-400" />
                      <p className="text-[10px] text-zinc-300">
                        {iconFile ? 'Change' : 'Upload'} Icon
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
                    <p className="text-[10px] text-zinc-300 flex items-center truncate">
                      <CheckCircle className="w-3 h-3 mr-1 flex-shrink-0" />
                      {iconFile.name}
                    </p>
                  )}
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-2 pt-1">
              <Button
                type="submit"
                disabled={isPending || isConfirming || uploadingLogo || uploadingIcon || uploadingMetadata}
                variant="custom"
                className="text-sm py-2 font-mono uppercase border"
                style={{ backgroundColor: '#2b2b30', borderColor: '#2b2b30', color: 'white' }}
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
                  <p className="text-xs text-zinc-300 flex items-center">
                    <Upload className="w-3 h-3 mr-1 animate-pulse" />
                    Step 1/4: Uploading logo to IPFS...
                  </p>
                )}
                {uploadingIcon && (
                  <p className="text-xs text-zinc-300 flex items-center">
                    <Upload className="w-3 h-3 mr-1 animate-pulse" />
                    Step 2/4: Uploading icon to IPFS...
                  </p>
                )}
                {uploadingMetadata && (
                  <p className="text-xs text-zinc-300 flex items-center">
                    <Upload className="w-3 h-3 mr-1 animate-pulse" />
                    Step 3/4: Uploading metadata to IPFS...
                  </p>
                )}
                {isConfirming && (
                  <p className="text-xs text-zinc-300 flex items-center">
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

          </Card>
        </div>
      )}

      {/* TGE Management Modal - Separate from Edit */}
      {showTGEManager && tgeProjectSlug && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4 overflow-y-auto">
          <Card className="w-full max-w-5xl my-8 p-4">
            <div className="flex items-center justify-end mb-3">
              <Button
                onClick={closeTGEManager}
                variant="custom"
                className="text-sm px-3 py-1.5 border"
                style={{ backgroundColor: '#2b2b30', borderColor: '#2b2b30' }}
              >
                ✕ Close
              </Button>
            </div>
            
            {loadingOrders ? (
              <p className="text-sm text-zinc-400">Loading orders for this project...</p>
            ) : (
              <TGESettlementManager 
                orders={orders.filter(o => {
                  const project = projects.find(p => p.slug === tgeProjectSlug);
                  if (!project) return false;
                  // V3: Compare projectId (bytes32) from order with project.id
                  return o.projectToken && typeof o.projectToken === 'string' && o.projectToken.toLowerCase() === project.id.toLowerCase();
                })}
                assetType={projects.find(p => p.slug === tgeProjectSlug)?.isPoints ? "Points" : "Tokens"}
                projectName={projects.find(p => p.slug === tgeProjectSlug)?.name}
              />
            )}
          </Card>
        </div>
      )}

      {/* Projects List */}
      <Card>
        <div className="mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-2xl font-bold">All Projects</h2>
            <Button
              onClick={() => setShowAddForm(true)}
              variant="custom"
              className="text-sm font-mono text-zinc-100 border px-4 py-2"
              style={{ backgroundColor: '#2b2b30', borderColor: '#2b2b30' }}
            >
              <Plus className="w-4 h-4 mr-2" />
              Add New Project
            </Button>
          </div>
          
          {/* Status Tabs */}
          {/* Tabs - Terminal Style (matching markets page) */}
          <div className="flex items-center gap-2 mb-6 rounded border p-1" style={{ backgroundColor: '#121218', borderColor: '#2b2b30' }}>
            <button
              onClick={() => setStatusFilter("active")}
              className={`flex items-center gap-2 px-4 py-2 text-sm font-mono font-medium transition-all rounded ${
                statusFilter === "active"
                  ? "bg-green-500/20 text-green-400 border border-green-500/50"
                  : "text-zinc-400 hover:text-zinc-300 hover:bg-[#2b2b30]"
              }`}
            >
              <div className={`w-2 h-2 rounded-full ${statusFilter === "active" ? "bg-green-400 animate-pulse" : "bg-zinc-600"}`}></div>
              <span>LIVE</span>
              <span className="text-xs px-1.5 py-0.5 rounded bg-green-500/30">
                {projects.filter(p => p.active && !projectTgeStatus[p.slug]).length}
              </span>
            </button>
            <button
              onClick={() => setStatusFilter("ended")}
              className={`flex items-center gap-2 px-4 py-2 text-sm font-mono font-medium transition-all rounded ${
                statusFilter === "ended"
                  ? "bg-red-500/20 text-red-400 border border-red-500/50"
                  : "text-zinc-400 hover:text-zinc-300 hover:bg-[#2b2b30]"
              }`}
            >
              <div className={`w-2 h-2 rounded-full ${statusFilter === "ended" ? "bg-red-400" : "bg-zinc-600"}`}></div>
              <span>ENDED</span>
              <span className="text-xs px-1.5 py-0.5 rounded bg-red-500/30">
                {projects.filter(p => projectTgeStatus[p.slug]).length}
              </span>
            </button>
            <button
              onClick={() => setStatusFilter("all")}
              className={`flex items-center gap-2 px-4 py-2 text-sm font-mono font-medium transition-all rounded ${
                statusFilter === "all"
                  ? "bg-zinc-700 text-zinc-300 border border-zinc-500"
                  : "text-zinc-400 hover:text-zinc-300 hover:bg-[#2b2b30]"
              }`}
            >
              <div className={`w-2 h-2 rounded-full ${statusFilter === "all" ? "bg-zinc-400" : "bg-zinc-600"}`}></div>
              <span>ALL</span>
              <span className="text-xs px-1.5 py-0.5 rounded bg-zinc-500/30">
                {projects.length}
              </span>
            </button>
          </div>
        </div>
        
        {loadingProjects ? (
          <p className="text-zinc-400 text-center py-8">Loading projects...</p>
        ) : !projects || projects.length === 0 ? (
          <div className="flex flex-col items-center px-4 py-12">
            <div className="bg-[#121218] border border-[#2b2b30] rounded p-8 backdrop-blur-sm max-w-2xl w-full">
              <div className="flex items-center gap-3 mb-4 font-mono text-zinc-300">
                <Terminal className="w-5 h-5" />
                <span className="text-sm">otcX://protocol/admin/projects</span>
              </div>
              <div className="bg-[#06060c] border border-red-500/30 rounded p-4 mb-4 font-mono text-sm">
                <div className="flex items-center gap-2 text-red-400 mb-2">
                  <span className="font-bold">EMPTY:</span>
                  <span>No projects found</span>
                </div>
                <div className="text-zinc-500 text-xs space-y-1 pl-4">
                  <div>→ registry.getActiveProjects(): []</div>
                  <div>→ total_projects = 0</div>
                  <div>→ status: EMPTY_STATE</div>
                </div>
              </div>
              <div className="space-y-3 font-mono text-sm">
                <div className="text-zinc-400">You haven’t added any projects yet.</div>
                <div className="text-zinc-400">Use the button above to create your first project.</div>
              </div>
            </div>
          </div>
        ) : (() => {
            const filteredProjects = projects.filter((project) => {
              if (statusFilter === "all") return true;
              if (statusFilter === "active") return project.active && !projectTgeStatus[project.slug];
              if (statusFilter === "ended") return projectTgeStatus[project.slug];
              return true;
            });
            
            return (
              <div className="mt-6">
                {filteredProjects.length === 0 ? (
                  <div className="flex flex-col items-center px-4 py-12">
                    <div className="bg-[#121218] border border-yellow-500/30 rounded p-8 backdrop-blur-sm max-w-2xl w-full">
                      <div className="flex items-center gap-3 mb-4 font-mono text-yellow-400">
                        <Terminal className="w-5 h-5" />
                        <span className="text-sm">otcX://protocol/admin/filter</span>
                      </div>
                      <div className="bg-[#06060c] border border-yellow-500/30 rounded p-4 mb-4 font-mono text-sm">
                        <div className="flex items-center gap-2 text-yellow-400 mb-2">
                          <span className="font-bold">WARN:</span>
                          <span>No results for current filter</span>
                        </div>
                        <div className="text-zinc-500 text-xs space-y-1 pl-4">
                          <div>→ filter: {statusFilter}</div>
                          <div>→ matches: 0</div>
                        </div>
                      </div>
                      <div className="text-zinc-400 font-mono text-sm">Try switching tabs or adding a new project.</div>
                    </div>
                  </div>
                ) : (
                  <>
                    <p className="text-sm text-zinc-500 mb-4">
                      Showing {filteredProjects.length} of {projects.length} project{projects.length !== 1 ? 's' : ''}
                    </p>
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead>
                          <tr>
                            <th className="text-left py-3 px-4 text-xs font-bold text-zinc-300 uppercase tracking-wider">Project</th>
                            <th className="text-left py-3 px-4 text-xs font-bold text-zinc-300 uppercase tracking-wider">Type</th>
                            <th className="text-left py-3 px-4 text-xs font-bold text-zinc-300 uppercase tracking-wider">Lifecycle</th>
                            <th className="text-left py-3 px-4 text-xs font-bold text-zinc-300 uppercase tracking-wider">Slug</th>
                            <th className="text-left py-3 px-4 text-xs font-bold text-zinc-300 uppercase tracking-wider">Added</th>
                            <th className="text-left py-3 px-4 text-xs font-bold text-zinc-300 uppercase tracking-wider">Token Address</th>
                            <th className="text-center py-3 px-4 text-xs font-bold text-zinc-300 uppercase tracking-wider">Status</th>
                            <th className="text-center py-3 px-4 text-xs font-bold text-zinc-300 uppercase tracking-wider">TGE</th>
                            <th className="text-right py-3 px-4 text-xs font-bold text-zinc-300 uppercase tracking-wider">Edit</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filteredProjects.map((project) => (
                            <tr 
                              key={project.slug}
                              className="border-b border-[#2b2b30]/50 hover:bg-[#2b2b30]/50 transition-all"
                            >
                              {/* Project Name */}
                              <td className="py-4 px-4">
                                <div className="flex items-center gap-2">
                                  <ProjectImage 
                                    metadataURI={project.metadataURI}
                                    imageType="icon"
                                    className="w-8 h-8 rounded object-cover flex-shrink-0 border border-zinc-700"
                                    fallbackText={project.name.charAt(0).toUpperCase()}
                                  />
                                  <span className="text-base font-semibold text-white">{project.name}</span>
                                </div>
                              </td>

                              {/* Type */}
                              <td className="py-4 px-4">
                                <Badge className={project.isPoints 
                                  ? "bg-purple-500/20 text-purple-400 border border-purple-500/50" 
                                  : "bg-blue-500/20 text-blue-400 border border-blue-500/50"
                                }>
                                  {project.isPoints ? "Points" : "Tokens"}
                                </Badge>
                              </td>

                              {/* Lifecycle */}
                              <td className="py-4 px-4">
                                {projectTgeStatus[project.slug] ? (
                                  <Badge className="bg-red-950/30 border border-red-500/50 text-red-400">Ended</Badge>
                                ) : (
                                  <Badge className="bg-green-950/30 border border-green-500/50 text-green-400">Active</Badge>
                                )}
                              </td>

                              {/* Slug */}
                              <td className="py-4 px-4">
                                <span className="text-sm text-zinc-400 font-mono">{project.slug}</span>
                              </td>

                              {/* Added Date */}
                              <td className="py-4 px-4">
                                <span className="text-sm text-zinc-400">
                                  {new Date(Number(project.addedAt) * 1000).toLocaleDateString('en-US', {
                                    year: 'numeric',
                                    month: 'short',
                                    day: 'numeric'
                                  })}
                                </span>
                              </td>

                              {/* Token Address */}
                              <td className="py-4 px-4">
                                <div className="flex items-center gap-2">
                                  {project.tokenAddress && project.tokenAddress !== '0x0000000000000000000000000000000000000000' ? (
                                    <span className="text-xs text-zinc-500 font-mono">
                                      {project.tokenAddress.slice(0, 6)}...{project.tokenAddress.slice(-4)}
                                    </span>
                                  ) : (
                                    <span className="text-xs text-zinc-600">—</span>
                                  )}
                                  {/* Show edit icon for Points projects */}
                                  {project.isPoints && (
                                    <button
                                      onClick={() => handleUpdateTokenAddress(project.id, project.name)}
                                      className="p-1 rounded hover:bg-amber-600/20 text-amber-400 transition-colors disabled:opacity-50"
                                      disabled={isPending || isConfirming}
                                      title={project.tokenAddress && project.tokenAddress !== '0x0000000000000000000000000000000000000000' 
                                        ? "Update token address" 
                                        : "Add token address"}
                                    >
                                      <Edit2 className="w-3.5 h-3.5" />
                                    </button>
                                  )}
                                </div>
                              </td>

                              {/* Status Toggle */}
                              <td className="py-4 px-4">
                                <div className="flex items-center justify-center gap-2">
                                  <span className="text-xs text-zinc-400">
                                    {project.active ? "On" : "Off"}
                                  </span>
                                  <Switch
                                    checked={project.active}
                                    onChange={() => handleToggleStatus(project.id, project.active)}
                                    disabled={isPending || isConfirming}
                                  />
                                </div>
                              </td>

                              {/* TGE Button */}
                              <td className="py-4 px-4 text-center">
                                <Button
                                  onClick={() => openTGEManager(project.slug)}
                                  variant="custom"
                                  className="hover:opacity-80 text-white border text-xs px-2 py-1 bg-red-600 hover:bg-red-700"
                                  style={{ borderColor: '#dc2626' }}
                                >
                                  <AlertTriangle className="w-3 h-3 mr-1 inline" />
                                  TGE
                                </Button>
                              </td>

                              {/* Edit Button */}
                              <td className="py-4 px-4 text-right">
                                <Button
                                  onClick={() => startEditing(project)}
                                  variant="custom"
                                  className="hover:opacity-80 text-zinc-300 border text-xs px-2 py-1"
                                  style={{ backgroundColor: '#2b2b30', borderColor: '#2b2b30' }}
                                >
                                  <Edit2 className="w-3 h-3 mr-1 inline" />
                                  Edit
                                </Button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </>
                )}
              </div>
            );
          })()}
      </Card>
      </div>
    </div>
  );
}

