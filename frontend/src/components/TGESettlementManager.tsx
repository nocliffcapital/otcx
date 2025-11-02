"use client";

import { useState, useEffect } from "react";
import { useReadContract, useWriteContract, useWaitForTransactionReceipt, usePublicClient, useChainId } from "wagmi";
import { ORDERBOOK_ADDRESS, ESCROW_ORDERBOOK_ABI } from "@/lib/contracts";
import { Card } from "./ui/Card";
import { Button } from "./ui/Button";
import { Input } from "./ui/Input";
import { Badge } from "./ui/Badge";
import { Clock, PlayCircle, Plus, CheckCircle, AlertTriangle, XCircle, CheckSquare, Square, X, ExternalLink, Loader2, Download } from "lucide-react";
import { useToast } from "./Toast";
import { getExplorerUrl, getChainConfig } from "@/lib/chains";
import { validateProof, ValidationResult } from "@/lib/proofValidation";
import * as XLSX from 'xlsx';

interface Order {
  id: bigint;
  maker: string;
  buyer: string;
  seller: string;
  projectToken: string;
  amount: bigint;
  unitPrice: bigint;
  buyerFunds: bigint;
  sellerCollateral: bigint;
  expiry: bigint;
  settlementDeadline: bigint;
  isSell: boolean;
  tokensDeposited: boolean;
  status: number;
  proof?: string; // For Points projects: seller submits proof of token transfer
}

interface ProofStatus {
  accepted: boolean;
  acceptedAt?: bigint;
}

interface ProofValidationStatus {
  result: ValidationResult | null;
  loading: boolean;
}

// V3 Status Names (V4: status at different index due to allowedTaker field)
const STATUS_NAMES = ["OPEN", "FUNDED", "SETTLED", "DEFAULTED", "CANCELED"];

// Store block explorer URLs per project (projectToken -> explorer URL)
const projectExplorerUrls: Record<string, string> = {};

// Get stored explorer URL for a project
export const getProjectExplorerUrl = (projectToken: string): string | null => {
  return projectExplorerUrls[projectToken.toLowerCase()] || null;
};

export function TGESettlementManager({ orders, assetType, projectName }: { orders: Order[]; assetType: string; projectName?: string }) {
  const chainId = useChainId();
  const [selectedOrder, setSelectedOrder] = useState<bigint | null>(null);
  const [batchTokenAddress, setBatchTokenAddress] = useState("");
  const [tokenAddress, setTokenAddress] = useState("");
  const [conversionRatio, setConversionRatio] = useState("1.0"); // Points to tokens ratio
  const [blockExplorerUrl, setBlockExplorerUrl] = useState(""); // Block explorer URL for proof validation
  const [extensionHours, setExtensionHours] = useState<4 | 24>(4);
  const [showIndividualOrders, setShowIndividualOrders] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [showProofManager, setShowProofManager] = useState(true);
  const [selectedOrderIds, setSelectedOrderIds] = useState<Set<bigint>>(new Set());
  const [proofStatuses, setProofStatuses] = useState<Record<string, ProofStatus>>({});
  const [proofValidations, setProofValidations] = useState<Record<string, ProofValidationStatus>>({});
  const [rejectReason, setRejectReason] = useState("");
  const [rejectingOrderId, setRejectingOrderId] = useState<bigint | null>(null);
  const [validatingOrderId, setValidatingOrderId] = useState<bigint | null>(null);

  // Get default explorer URL for current chain
  const defaultExplorer = getChainConfig(chainId)?.explorer || "";
  
  // Load saved explorer URL for this project on mount
  useEffect(() => {
    if (orders.length > 0) {
      const projectToken = orders[0]?.projectToken.toLowerCase();
      if (projectToken && projectExplorerUrls[projectToken]) {
        setBlockExplorerUrl(projectExplorerUrls[projectToken]);
      } else if (defaultExplorer) {
        setBlockExplorerUrl(defaultExplorer);
      }
    }
  }, [orders, defaultExplorer]);
  
  // Both Points and Tokens need TGE activation when the token launches
  // Points: seller sends tokens directly to buyer, then submits proof for admin to verify
  // Tokens: seller deposits to contract, buyer claims from contract
  const isPointsProject = assetType === "Points";

  const { writeContract, data: hash, isPending, isError, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });
  const toast = useToast();
  const publicClient = usePublicClient();

  // Read POINTS_SENTINEL from contract
  const { data: pointsSentinel } = useReadContract({
    address: ORDERBOOK_ADDRESS,
    abi: ESCROW_ORDERBOOK_ABI,
    functionName: "POINTS_SENTINEL",
  }) as { data: `0x${string}` | undefined };

  // Get projectId from first order (all orders in same project)
  const projectId = orders.length > 0 ? (orders[0]?.projectToken as `0x${string}`) : undefined;

  // Read TGE activation status for this project
  const { data: projectTgeActivated } = useReadContract({
    address: ORDERBOOK_ADDRESS,
    abi: ESCROW_ORDERBOOK_ABI,
    functionName: "projectTgeActivated",
    args: projectId ? [projectId] : undefined,
    query: {
      enabled: !!projectId,
      refetchInterval: 5000, // Refresh every 5 seconds
    },
  }) as { data: boolean | undefined };

  // Read settlement deadline for this project
  const { data: projectSettlementDeadline } = useReadContract({
    address: ORDERBOOK_ADDRESS,
    abi: ESCROW_ORDERBOOK_ABI,
    functionName: "projectSettlementDeadline",
    args: projectId ? [projectId] : undefined,
    query: {
      enabled: !!projectId && projectTgeActivated === true,
      refetchInterval: 1000, // Refresh every second for timer
    },
  }) as { data: bigint | undefined };

  // Timer state for countdown display
  const [timeRemaining, setTimeRemaining] = useState<string>("");
  
  // Update countdown timer
  useEffect(() => {
    if (!projectSettlementDeadline || !projectTgeActivated) {
      setTimeRemaining("");
      return;
    }

    const updateTimer = () => {
      const deadlineSeconds = Number(projectSettlementDeadline);
      const nowSeconds = Math.floor(Date.now() / 1000);
      const remaining = deadlineSeconds - nowSeconds;

      if (remaining <= 0) {
        setTimeRemaining("Settlement window closed");
        return;
      }

      const hours = Math.floor(remaining / 3600);
      const minutes = Math.floor((remaining % 3600) / 60);
      const seconds = remaining % 60;

      if (hours > 0) {
        setTimeRemaining(`${hours}h ${minutes}m ${seconds}s`);
      } else if (minutes > 0) {
        setTimeRemaining(`${minutes}m ${seconds}s`);
      } else {
        setTimeRemaining(`${seconds}s`);
      }
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [projectSettlementDeadline, projectTgeActivated]);

  // Create a stable string representation of orders with proofs for dependency tracking
  const ordersWithProofsKey = orders
    .filter(o => o.proof)
    .map(o => o.id.toString())
    .sort()
    .join(',');

  // Fetch proof acceptance statuses for all orders with proofs
  useEffect(() => {
    const fetchProofStatuses = async () => {
      if (!publicClient) return;
      
      const ordersWithProofs = orders.filter(o => o.proof);
      
      if (ordersWithProofs.length === 0) {
        setProofStatuses({});
        return;
      }
      
      const statuses: Record<string, ProofStatus> = {};
      
      for (const order of ordersWithProofs) {
        try {
          const accepted = await publicClient.readContract({
            address: ORDERBOOK_ADDRESS,
            abi: ESCROW_ORDERBOOK_ABI,
            functionName: "proofAccepted",
            args: [order.id],
          }) as boolean;
          
          let acceptedAt: bigint | undefined;
          if (accepted) {
            acceptedAt = await publicClient.readContract({
              address: ORDERBOOK_ADDRESS,
              abi: ESCROW_ORDERBOOK_ABI,
              functionName: "proofAcceptedAt",
              args: [order.id],
            }) as bigint;
          }
          
          statuses[order.id.toString()] = { accepted, acceptedAt };
        } catch (error) {
          console.error(`Failed to fetch proof status for order ${order.id}:`, error);
        }
      }
      
      setProofStatuses(statuses);
    };
    
    fetchProofStatuses();
  }, [ordersWithProofsKey, publicClient, isSuccess]); // Use stable string key instead of orders array

  // Validate all pending proofs automatically
  useEffect(() => {
    const validateAllProofs = async () => {
      if (!publicClient || !isPointsProject) return;
      
      const ordersWithProofs = orders.filter(o => o.status === 1 && o.proof && !proofStatuses[o.id.toString()]?.accepted);
      
      if (ordersWithProofs.length === 0) {
        setProofValidations({});
        return;
      }

      const expectedExplorer = getProjectExplorerUrl(ordersWithProofs[0].projectToken) || defaultExplorer;
      if (!expectedExplorer) return;

      // Initialize validation states
      const newValidations: Record<string, ProofValidationStatus> = {};
      ordersWithProofs.forEach(order => {
        newValidations[order.id.toString()] = { result: null, loading: true };
      });
      setProofValidations(newValidations);

      // Validate each proof
      for (const order of ordersWithProofs) {
        if (!order.proof) continue;
        
        try {
          setValidatingOrderId(order.id);
          
          // Fetch actual token address and conversion ratio from contract (stored during TGE activation)
          let tokenAddress = "0x0000000000000000000000000000000000000000";
          let conversionRatio = 1.0;
          
          try {
            const projectTokenAddress = await publicClient.readContract({
              address: ORDERBOOK_ADDRESS,
              abi: ESCROW_ORDERBOOK_ABI,
              functionName: "projectTokenAddress",
              args: [order.projectToken as `0x${string}`],
            }) as string;
            
            // For Points projects, tokenAddress might be POINTS_SENTINEL
            // In that case, we need the actual token address from the project registry
            if (projectTokenAddress && projectTokenAddress.toLowerCase() !== (pointsSentinel?.toLowerCase() || '')) {
              tokenAddress = projectTokenAddress;
            }
            
            // Fetch conversion ratio
            const ratioBigInt = await publicClient.readContract({
              address: ORDERBOOK_ADDRESS,
              abi: ESCROW_ORDERBOOK_ABI,
              functionName: "projectConversionRatio",
              args: [order.projectToken as `0x${string}`],
            }) as bigint;
            
            conversionRatio = Number(ratioBigInt) / 1e18;
          } catch (error) {
            console.error(`Failed to fetch token address/conversion ratio for order ${order.id}:`, error);
          }
          
          // For Points projects, calculate actual token amount (points * conversion ratio)
          // For Token projects, amount is already in tokens (conversion ratio = 1.0)
          const actualTokenAmount = order.amount * BigInt(Math.round(conversionRatio * 1e18)) / BigInt(1e18);
          
          const result = await validateProof(
            order.proof,
            expectedExplorer,
            {
              seller: order.seller,
              buyer: order.buyer,
              tokenAddress: tokenAddress,
              amount: actualTokenAmount, // Use converted amount for Points projects
              decimals: 18,
            },
            publicClient
          );

          setProofValidations(prev => ({
            ...prev,
            [order.id.toString()]: { result, loading: false }
          }));
        } catch (error) {
          console.error(`Failed to validate proof for order ${order.id}:`, error);
          setProofValidations(prev => ({
            ...prev,
            [order.id.toString()]: { 
              result: { 
                isValid: false, 
                errors: ['Validation failed'], 
                status: 'MANUAL_REVIEW' 
              }, 
              loading: false 
            }
          }));
        }
      }
      
      setValidatingOrderId(null);
    };

    // Only validate if we have orders with proofs and an expected explorer URL
    if (orders.length > 0 && publicClient) {
      const projectToken = orders[0]?.projectToken;
      const expectedExplorer = getProjectExplorerUrl(projectToken) || defaultExplorer;
      if (expectedExplorer) {
        validateAllProofs();
      }
    }
  }, [ordersWithProofsKey, publicClient, defaultExplorer, isPointsProject, proofStatuses]);

  // Handle transaction success
  useEffect(() => {
    if (isSuccess && hash) {
      toast.success("Transaction confirmed!", "Changes will be reflected shortly");
    }
  }, [isSuccess, hash, toast]);

  // Handle transaction errors
  useEffect(() => {
    if (error && hash) {
      toast.error(
        "Transaction failed",
        error.message || "Please check the console for details"
      );
    }
  }, [error, hash, toast]);

  // Show all orders - let admin decide which to activate
  // V4 Status: 0=OPEN, 1=FUNDED, 2=SETTLED, 3=DEFAULTED, 4=CANCELED
  const fundedOrders = orders.filter((o) => o.status === 1); // Only FUNDED orders for batch activation
  const ordersWithProofs = orders.filter((o) => o.status === 1 && o.proof); // FUNDED with proof submitted
  const ordersWithAcceptedProofs = ordersWithProofs.filter((o) => proofStatuses[o.id.toString()]?.accepted);
  
  // Filter pending proofs by deadline - admin can only accept AFTER deadline
  const now = Date.now();
  const ordersWithPendingProofs = ordersWithProofs.filter((o) => {
    if (proofStatuses[o.id.toString()]?.accepted) return false;
    // Check if deadline has passed (deadline is in seconds, convert to milliseconds)
    const deadlineMs = Number(o.settlementDeadline) * 1000;
    return deadlineMs > 0 && now > deadlineMs; // Only show if deadline has passed
  });
  
  const eligibleOrders = orders.filter((o) => o.status <= 1); // OPEN or FUNDED

  const handleBatchActivateTGE = () => {
    // For Points projects without on-chain tokens, we use POINTS_SENTINEL for off-chain settlement
    const isOffChainSettlement = isPointsProject && !batchTokenAddress;

    if (!isOffChainSettlement && (!batchTokenAddress || !batchTokenAddress.match(/^0x[a-fA-F0-9]{40}$/))) {
      toast.error("Invalid token address", "Please enter a valid token address (0x...) or leave empty for off-chain settlement (Points only)");
      return;
    }

    if (fundedOrders.length === 0) {
      toast.error("No funded orders", "No funded orders to activate");
      return;
    }

    // Get the projectToken from the first order (all orders in this project have the same projectToken)
    const projectToken = orders[0]?.projectToken;
    if (!projectToken) {
      toast.error("No orders found", "No orders found for this project");
      return;
    }

    // Show confirmation modal
    setShowConfirmModal(true);
  };

  const confirmBatchActivate = () => {
    if (!pointsSentinel) {
      toast.error("Contract not ready", "Please wait for contract data to load");
      return;
    }
    
    const isOffChainSettlement = isPointsProject && !batchTokenAddress;
    const tokenAddr = isOffChainSettlement 
      ? pointsSentinel 
      : batchTokenAddress;
    
    // Parse and validate conversion ratio
    const ratio = parseFloat(conversionRatio);
    if (isNaN(ratio) || ratio <= 0) {
      toast.error("Invalid conversion ratio", "Conversion ratio must be a positive number");
      return;
    }
    
    // Validate block explorer URL (required for Points projects)
    if (isPointsProject && (!blockExplorerUrl || !blockExplorerUrl.match(/^https?:\/\//))) {
      toast.error("Invalid block explorer URL", "Please enter a valid block explorer URL (e.g., https://sepolia.etherscan.io)");
      return;
    }
    
    // Convert to 18 decimals with high precision
    // For very small numbers (e.g., 0.0000001), use scientific notation
    // For very large numbers (e.g., 1000000), multiply by 1e18
    const ratioBigInt = BigInt(Math.round(ratio * 1e18));
    
    // For token projects, ratio must be 1.0 (1:1)
    if (!isPointsProject && ratio !== 1.0) {
      toast.error("Invalid ratio for token project", "Token projects must use 1:1 conversion ratio");
      return;
    }
    
    // Get projectId from first order (all orders share same projectId)
    const projectToken = orders[0]?.projectToken;

    // Store block explorer URL for this project
    if (isPointsProject && blockExplorerUrl) {
      projectExplorerUrls[projectToken.toLowerCase()] = blockExplorerUrl;
    }

    console.log('🚀 V4 Project TGE activation:', { projectToken, tokenAddr, settlementWindow: 14400, conversionRatio: ratioBigInt.toString(), isOffChain: isOffChainSettlement, explorerUrl: blockExplorerUrl });
    
    toast.info("⏳ Activating TGE...", "Transaction pending");
    
    // V4: Project-level TGE activation with conversion ratio
    writeContract({
      address: ORDERBOOK_ADDRESS,
      abi: ESCROW_ORDERBOOK_ABI,
      functionName: "activateProjectTGE",
      args: [projectToken as `0x${string}`, tokenAddr as `0x${string}`, 14400n, ratioBigInt], // 4 hours + conversion ratio
    });
    
    setShowConfirmModal(false);
  };

  const handleActivateTGE = (orderId: bigint) => {
    // V4: Individual order activation removed - use project-level batch activation instead
    toast.error("Feature removed", "V4 uses project-level TGE activation. Use the batch activation button above.");
    return;
  };

  const handleManualSettle = (orderId: bigint) => {
    if (!confirm(`Manually settle order #${orderId}?\nThis should only be used for Points after off-chain verification.`)) {
      return;
    }

    toast.info("Settling order manually", `Order #${orderId}`);

    writeContract({
      address: ORDERBOOK_ADDRESS,
      abi: ESCROW_ORDERBOOK_ABI,
      functionName: "settleOrderManual",
      args: [orderId],
    });
  };

  // Toggle order selection for batch operations
  const toggleOrderSelection = (orderId: bigint) => {
    const newSelection = new Set(selectedOrderIds);
    if (newSelection.has(orderId)) {
      newSelection.delete(orderId);
    } else {
      newSelection.add(orderId);
    }
    setSelectedOrderIds(newSelection);
  };

  // Select/deselect all orders
  const toggleSelectAll = () => {
    if (selectedOrderIds.size === ordersWithPendingProofs.length) {
      setSelectedOrderIds(new Set());
    } else {
      setSelectedOrderIds(new Set(ordersWithPendingProofs.map(o => o.id)));
    }
  };

  // Batch accept proofs
  const handleBatchAcceptProofs = () => {
    if (selectedOrderIds.size === 0) {
      toast.error("No orders selected", "Please select at least one order");
      return;
    }

    const orderIdsArray = Array.from(selectedOrderIds);
    
    toast.info("Accepting proofs", `Processing ${orderIdsArray.length} order(s)...`);
    
    writeContract({
      address: ORDERBOOK_ADDRESS,
      abi: ESCROW_ORDERBOOK_ABI,
      functionName: "acceptProofBatch",
      args: [orderIdsArray],
    });

    // Clear selection after submission
    setSelectedOrderIds(new Set());
  };

  // Individual accept proof
  const handleAcceptProof = (orderId: bigint) => {
    toast.info("Accepting proof", `Order #${orderId}`);
    
    writeContract({
      address: ORDERBOOK_ADDRESS,
      abi: ESCROW_ORDERBOOK_ABI,
      functionName: "acceptProof",
      args: [orderId],
    });
  };

  // Individual reject proof
  const handleRejectProof = (orderId: bigint, reason: string) => {
    if (!reason || reason.trim().length === 0) {
      toast.error("Reason required", "Please provide a reason for rejection");
      return;
    }

    toast.info("Rejecting proof", `Order #${orderId}`);
    
    writeContract({
      address: ORDERBOOK_ADDRESS,
      abi: ESCROW_ORDERBOOK_ABI,
      functionName: "rejectProof",
      args: [orderId, reason],
    });

    setRejectingOrderId(null);
    setRejectReason("");
  };

  // Export all proof data to CSV
  const exportToCSV = () => {
    const allOrdersWithProofs = [...ordersWithPendingProofs, ...ordersWithAcceptedProofs];
    
    const csvHeaders = [
      'Order ID',
      'Status',
      'Validation Status',
      'Seller',
      'Buyer',
      'Amount (Tokens)',
      'Unit Price (USDC)',
      'Total Value (USDC)',
      'Proof URL',
      'Expected Explorer',
      'URL Matches Explorer',
      'RPC Validation',
      'Transaction Hash',
      'Transaction From',
      'Transaction To',
      'Transaction Token Address',
      'Transaction Amount',
      'Validation Errors',
      'Proof Accepted',
      'Proof Accepted At',
      'Settlement Deadline',
    ];

    const csvRows = allOrdersWithProofs.map(order => {
      const validation = proofValidations[order.id.toString()];
      const validationResult = validation?.result;
      const proofStatus = proofStatuses[order.id.toString()];
      const expectedExplorer = getProjectExplorerUrl(order.projectToken) || defaultExplorer;
      const urlMatches = expectedExplorer && order.proof?.toLowerCase().includes(new URL(expectedExplorer).hostname.toLowerCase());
      
      const validationErrors = validationResult?.errors ? validationResult.errors.join('; ') : '';
      const proofAccepted = proofStatus?.accepted ? 'Yes' : 'No';
      const proofAcceptedAt = proofStatus?.acceptedAt ? new Date(Number(proofStatus.acceptedAt) * 1000).toISOString() : '';
      const settlementDeadline = order.settlementDeadline ? new Date(Number(order.settlementDeadline) * 1000).toISOString() : '';
      const totalValue = (Number(order.amount) / 1e18) * (Number(order.unitPrice) / 1e6);

      return [
        order.id.toString(),
        order.status === 1 ? 'FUNDED' : STATUS_NAMES[order.status],
        validationResult?.status || 'PENDING',
        order.seller,
        order.buyer,
        (Number(order.amount) / 1e18).toLocaleString(),
        (Number(order.unitPrice) / 1e6).toLocaleString(),
        totalValue.toLocaleString(),
        order.proof || '',
        expectedExplorer || '',
        urlMatches ? 'Yes' : 'No',
        validationResult?.transactionDetails ? 'Success' : validationResult?.status === 'MANUAL_REVIEW' ? 'Failed' : 'N/A',
        validationResult?.transactionDetails?.hash || '',
        validationResult?.transactionDetails?.from || '',
        validationResult?.transactionDetails?.to || '',
        validationResult?.transactionDetails?.tokenAddress || '',
        validationResult?.transactionDetails?.amount ? (Number(validationResult.transactionDetails.amount) / 1e18).toLocaleString() : '',
        validationErrors,
        proofAccepted,
        proofAcceptedAt,
        settlementDeadline,
      ];
    });

    const csvContent = [
      csvHeaders.join(','),
      ...csvRows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')),
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `proof-review-${projectName || 'data'}-${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    toast.success('CSV exported', `Downloaded ${allOrdersWithProofs.length} records`);
  };

  // Export all proof data to XLSX
  const exportToXLSX = () => {
    const allOrdersWithProofs = [...ordersWithPendingProofs, ...ordersWithAcceptedProofs];
    
    const worksheetData = allOrdersWithProofs.map(order => {
      const validation = proofValidations[order.id.toString()];
      const validationResult = validation?.result;
      const proofStatus = proofStatuses[order.id.toString()];
      const expectedExplorer = getProjectExplorerUrl(order.projectToken) || defaultExplorer;
      const urlMatches = expectedExplorer && order.proof?.toLowerCase().includes(new URL(expectedExplorer).hostname.toLowerCase());
      
      return {
        'Order ID': order.id.toString(),
        'Status': order.status === 1 ? 'FUNDED' : STATUS_NAMES[order.status],
        'Validation Status': validationResult?.status || 'PENDING',
        'Seller': order.seller,
        'Buyer': order.buyer,
        'Amount (Tokens)': Number(order.amount) / 1e18,
        'Unit Price (USDC)': Number(order.unitPrice) / 1e6,
        'Total Value (USDC)': (Number(order.amount) / 1e18) * (Number(order.unitPrice) / 1e6),
        'Proof URL': order.proof || '',
        'Expected Explorer': expectedExplorer || '',
        'URL Matches Explorer': urlMatches ? 'Yes' : 'No',
        'RPC Validation': validationResult?.transactionDetails ? 'Success' : validationResult?.status === 'MANUAL_REVIEW' ? 'Failed' : 'N/A',
        'Transaction Hash': validationResult?.transactionDetails?.hash || '',
        'Transaction From': validationResult?.transactionDetails?.from || '',
        'Transaction To': validationResult?.transactionDetails?.to || '',
        'Transaction Token Address': validationResult?.transactionDetails?.tokenAddress || '',
        'Transaction Amount': validationResult?.transactionDetails?.amount ? Number(validationResult.transactionDetails.amount) / 1e18 : '',
        'Validation Errors': validationResult?.errors ? validationResult.errors.join('; ') : '',
        'Proof Accepted': proofStatus?.accepted ? 'Yes' : 'No',
        'Proof Accepted At': proofStatus?.acceptedAt ? new Date(Number(proofStatus.acceptedAt) * 1000).toISOString() : '',
        'Settlement Deadline': order.settlementDeadline ? new Date(Number(order.settlementDeadline) * 1000).toISOString() : '',
      };
    });

    const worksheet = XLSX.utils.json_to_sheet(worksheetData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Proof Review');
    
    XLSX.writeFile(workbook, `proof-review-${projectName || 'data'}-${new Date().toISOString().split('T')[0]}.xlsx`);
    
    toast.success('XLSX exported', `Downloaded ${allOrdersWithProofs.length} records`);
  };

  // Batch settle accepted orders
  const formatDeadline = (deadline: bigint) => {
    if (deadline === 0n) return "N/A";
    const date = new Date(Number(deadline) * 1000);
    const now = Date.now();
    const diff = date.getTime() - now;
    
    if (diff < 0) return "⚠️ OVERDUE";
    
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    
    return `${hours}h ${minutes}m remaining`;
  };

  return (
    <Card className="max-h-[85vh] overflow-y-auto" style={{ backgroundColor: '#121218', borderColor: '#2b2b30' }}>
      <div className="flex items-center justify-between mb-6 sticky top-0 backdrop-blur-sm z-10 pb-4 border-b" style={{ borderColor: '#2b2b30' }}>
        <div className="flex items-center gap-3 flex-1">
          <div className="p-2 rounded border flex items-center justify-center" style={{ backgroundColor: '#2b2b30', borderColor: '#2b2b30' }}>
            <Clock className="w-5 h-5 text-zinc-300" />
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-bold text-white font-mono">
              {isPointsProject ? "POINTS_TGE_MANAGEMENT" : "TGE_SETTLEMENT_MANAGEMENT"} {projectName && `• ${projectName.toUpperCase()}`}
            </h3>
            <p className="text-xs text-zinc-400 font-mono mt-1">
              {isPointsProject 
                ? "Workflow: Activate TGE → Sellers Submit Proofs → Admin Approves → Anyone Settles Permissionlessly" 
                : "Activate TGE when the token launches"}
            </p>
          </div>
        </div>
      </div>

      {/* Toast notifications handle all messages */}

      {/* V4: Project-Level TGE Activation - Single Global Command */}
      <div className="mb-6 p-6 rounded border" style={{ backgroundColor: '#121218', borderColor: '#2b2b30' }}>
        <h4 className="text-lg font-bold text-zinc-300 mb-2 flex items-center gap-2 font-mono">
          <PlayCircle className="w-5 h-5" />
          {isPointsProject ? "STEP_1: ACTIVATE_PROJECT_TGE" : "ACTIVATE_PROJECT_TGE"}
        </h4>
        <p className="text-xs text-zinc-400 mb-4 font-mono">
          {isPointsProject 
            ? `Activate TGE for ${fundedOrders.length} funded order(s). Sellers will then have 4 hours to submit proofs.`
            : `Set global TGE flag for this project. All ${fundedOrders.length} funded order(s) will become settleable.`}
        </p>
        
        {fundedOrders.length === 0 ? (
          <div className="p-4 rounded border" style={{ backgroundColor: '#06060c', borderColor: '#2b2b30' }}>
            <p className="text-sm text-zinc-500 mb-2 font-mono">No funded orders ready for TGE activation</p>
            <p className="text-xs text-zinc-600 font-mono">Orders must have both buyer and seller collateral locked (FUNDED status)</p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-start gap-3 flex-wrap">
              <div className="flex-1 min-w-[200px]">
                <label className="text-sm text-zinc-300 mb-2 block font-medium">
                  Actual Token Address {isPointsProject && <span className="text-zinc-500 font-normal">(optional)</span>}
                </label>
                <Input
                  placeholder={isPointsProject ? "0x... (or leave empty for off-chain settlement)" : "0x... (deployed token contract)"}
                  value={batchTokenAddress}
                  onChange={(e) => setBatchTokenAddress(e.target.value)}
                  className="text-sm"
                />
              </div>
              <div className="w-64">
                <label className="text-sm text-zinc-300 mb-2 block font-medium">
                  Conversion Ratio {isPointsProject && <span className="text-zinc-500 font-normal">(1 point = ? tokens)</span>}
                </label>
                <Input
                  type="text"
                  placeholder={isPointsProject ? "e.g., 1.2 or 0.0001 or 100000" : "1.0"}
                  value={conversionRatio}
                  onChange={(e) => setConversionRatio(e.target.value)}
                  className="text-sm font-mono"
                  disabled={!isPointsProject}
                />
              </div>
              {isPointsProject && (
                <div className="flex-1 min-w-[300px]">
                  <label className="text-sm text-zinc-300 mb-2 block font-medium">
                    Block Explorer URL <span className="text-red-400">*</span>
                  </label>
                  <Input
                    placeholder="https://sepolia.etherscan.io"
                    value={blockExplorerUrl}
                    onChange={(e) => setBlockExplorerUrl(e.target.value)}
                    className="text-sm font-mono"
                  />
                  <p className="text-xs text-zinc-500 mt-1">Users will submit transaction URLs from this explorer</p>
                </div>
              )}
              {projectTgeActivated ? (
                <div className="flex flex-col items-center justify-center px-6 py-2 mt-7 font-mono font-semibold uppercase border rounded min-h-[42px]"
                  style={{ backgroundColor: '#22c55e', borderColor: '#22c55e', color: 'white' }}
                >
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-5 h-5" />
                    <span>ACTIVATED</span>
                  </div>
                  {timeRemaining && (
                    <div className="text-xs mt-1 flex items-center gap-1 font-normal">
                      <Clock className="w-3 h-3" />
                      <span>{timeRemaining}</span>
                    </div>
                  )}
                </div>
              ) : (
                <Button
                  onClick={handleBatchActivateTGE}
                  disabled={isPending || isConfirming}
                  variant="custom"
                  className="px-6 h-[42px] mt-7 font-mono font-semibold uppercase border"
                  style={{ backgroundColor: '#22c55e', borderColor: '#22c55e', color: 'white' }}
                  onMouseEnter={(e) => {
                    if (!isPending && !isConfirming) {
                      e.currentTarget.style.backgroundColor = '#16a34a';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isPending && !isConfirming) {
                      e.currentTarget.style.backgroundColor = '#22c55e';
                    }
                  }}
                >
                  <PlayCircle className="w-5 h-5 mr-2" />
                  ACTIVATE
                </Button>
              )}
            </div>
            
            {isPointsProject && (
              <div className="p-3 rounded border" style={{ backgroundColor: '#121218', borderColor: '#2b2b30' }}>
                <div className="flex items-start gap-2 text-xs text-zinc-300">
                  <AlertTriangle className="w-4 h-4 text-red-400 mt-0.5" />
                  <div>
                    <p className="font-semibold mb-1 font-mono">POINTS PROJECT SETTLEMENT</p>
                    <p className="text-zinc-400 mb-2 font-mono">
                      <strong>Option 1 (On-chain):</strong> Enter token address if token is deployed on Sepolia
                    </p>
                    <p className="text-zinc-400 font-mono">
                      <strong>Option 2 (Off-chain):</strong> Leave empty → Seller sends tokens directly to buyer → Submits proof → Admin manually settles
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Step 2 Placeholder: Waiting for proofs (Points Projects) */}
      {isPointsProject && fundedOrders.length > 0 && ordersWithProofs.length === 0 && (
        <div className="mb-6 p-6 rounded border" style={{ backgroundColor: '#121218', borderColor: '#2b2b30' }}>
          <div className="flex items-center gap-2 text-lg font-bold text-zinc-300 mb-2 font-mono">
            <Clock className="w-6 h-6" />
            <span>STEP_2: WAITING_FOR_PROOFS</span>
          </div>
          <p className="text-sm text-zinc-400 font-mono">
            {fundedOrders.length} order(s) funded. Sellers must deliver tokens off-chain and submit proof (IPFS hash or transaction proof) before the deadline.
          </p>
        </div>
      )}

      {/* V4: Proof Management Section (Points Projects Only) */}
      {isPointsProject && ordersWithProofs.length > 0 && (
        <div className="mb-6">
          <div className="flex items-center gap-2 text-lg font-bold text-zinc-300 mb-4 font-mono">
            <CheckCircle className="w-6 h-6 text-zinc-300" />
            <span>STEP_3: PROOF_MANAGEMENT • {ordersWithProofs.length} PROOF(S) SUBMITTED</span>
          </div>

          <div className="space-y-6 p-6 rounded border" style={{ backgroundColor: '#121218', borderColor: '#2b2b30' }}>
            {/* Summary Stats */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-4 rounded border" style={{ backgroundColor: '#06060c', borderColor: '#2b2b30' }}>
                  <div className="flex items-center gap-3">
                    <Clock className="w-8 h-8 text-zinc-300" />
                    <div>
                      <div className="text-xs text-zinc-400 font-mono">PENDING REVIEW</div>
                      <div className="text-2xl font-bold text-white">{ordersWithPendingProofs.length}</div>
                    </div>
                  </div>
                </div>

                <div className="p-4 rounded border" style={{ backgroundColor: '#06060c', borderColor: '#2b2b30' }}>
                  <div className="flex items-center gap-3">
                    <CheckCircle className="w-8 h-8 text-green-400" />
                    <div>
                      <div className="text-xs text-zinc-400 font-mono">ACCEPTED</div>
                      <div className="text-2xl font-bold text-green-400">{ordersWithAcceptedProofs.length}</div>
                    </div>
                  </div>
                </div>

                <div className="p-4 rounded border" style={{ backgroundColor: '#06060c', borderColor: '#2b2b30' }}>
                  <div className="flex items-center gap-3">
                    <PlayCircle className="w-8 h-8 text-zinc-300" />
                    <div>
                      <div className="text-xs text-zinc-400 font-mono">SELECTED</div>
                      <div className="text-2xl font-bold text-white">{selectedOrderIds.size}</div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Export Buttons */}
              {(ordersWithPendingProofs.length > 0 || ordersWithAcceptedProofs.length > 0) && (
                <div className="flex flex-wrap gap-3 p-4 rounded border mb-4" style={{ backgroundColor: '#06060c', borderColor: '#2b2b30' }}>
                  <Button
                    onClick={exportToCSV}
                    variant="custom"
                    className="font-mono font-semibold uppercase border"
                    style={{ backgroundColor: '#2b2b30', borderColor: '#2b2b30', color: 'white' }}
                  >
                    <Download className="w-4 h-4 mr-2" />
                    EXPORT CSV
                  </Button>
                  <Button
                    onClick={exportToXLSX}
                    variant="custom"
                    className="font-mono font-semibold uppercase border"
                    style={{ backgroundColor: '#2b2b30', borderColor: '#2b2b30', color: 'white' }}
                  >
                    <Download className="w-4 h-4 mr-2" />
                    EXPORT XLSX
                  </Button>
                </div>
              )}

              {/* Batch Actions */}
              {ordersWithPendingProofs.length > 0 && (
                <div className="flex flex-wrap gap-3 p-4 rounded border" style={{ backgroundColor: '#06060c', borderColor: '#2b2b30' }}>
                  <Button
                    onClick={toggleSelectAll}
                    variant="custom"
                    className="font-mono font-semibold uppercase border"
                    style={{ backgroundColor: '#2b2b30', borderColor: '#2b2b30', color: 'white' }}
                  >
                    {selectedOrderIds.size === ordersWithPendingProofs.length ? (
                      <>
                        <Square className="w-4 h-4 mr-2" />
                        DESELECT ALL
                      </>
                    ) : (
                      <>
                        <CheckSquare className="w-4 h-4 mr-2" />
                        SELECT ALL ({ordersWithPendingProofs.length})
                      </>
                    )}
                  </Button>

                  <Button
                    onClick={() => {
                      // Only accept proofs that are validated as APPROVED
                      const approvedOrderIds = ordersWithPendingProofs
                        .filter(o => {
                          const validation = proofValidations[o.id.toString()];
                          return validation?.result?.status === 'APPROVED';
                        })
                        .map(o => o.id);
                      
                      const toAccept = Array.from(selectedOrderIds).filter(id => 
                        approvedOrderIds.includes(id)
                      );
                      
                      if (toAccept.length === 0 && selectedOrderIds.size > 0) {
                        toast.error("No approved proofs selected", "Only proofs validated as APPROVED can be accepted in bulk. Please select approved proofs or accept manually.");
                        return;
                      }
                      
                      if (toAccept.length > 0) {
                        toast.info("Accepting approved proofs", `Processing ${toAccept.length} approved proof(s)...`);
                        writeContract({
                          address: ORDERBOOK_ADDRESS,
                          abi: ESCROW_ORDERBOOK_ABI,
                          functionName: "acceptProofBatch",
                          args: [toAccept],
                        });
                        setSelectedOrderIds(new Set());
                      } else {
                        handleBatchAcceptProofs();
                      }
                    }}
                    disabled={selectedOrderIds.size === 0 || isPending || isConfirming}
                    variant="custom"
                    className="font-mono font-semibold uppercase border"
                    style={{ backgroundColor: '#22c55e', borderColor: '#22c55e', color: 'white', opacity: selectedOrderIds.size === 0 ? 0.5 : 1 }}
                  >
                    <CheckCircle className="w-4 h-4 mr-2" />
                    ACCEPT SELECTED ({selectedOrderIds.size})
                  </Button>
                  <Button
                    onClick={() => {
                      // Select only approved proofs
                      const approvedOrderIds = ordersWithPendingProofs
                        .filter(o => {
                          const validation = proofValidations[o.id.toString()];
                          return validation?.result?.status === 'APPROVED';
                        })
                        .map(o => o.id);
                      
                      setSelectedOrderIds(new Set(approvedOrderIds));
                      if (approvedOrderIds.length > 0) {
                        toast.success(`Selected ${approvedOrderIds.length} approved proofs`, "You can now accept them in bulk");
                      } else {
                        toast.info("No approved proofs", "No proofs have been validated as APPROVED yet");
                      }
                    }}
                    variant="custom"
                    className="font-mono font-semibold uppercase border"
                    style={{ backgroundColor: '#22c55e', borderColor: '#22c55e', color: 'white' }}
                  >
                    <CheckSquare className="w-4 h-4 mr-2" />
                    SELECT APPROVED
                  </Button>
                </div>
              )}

              {/* Pending Proofs List */}
              {ordersWithPendingProofs.length > 0 && (
                <div>
                  <h5 className="text-sm font-bold text-zinc-300 mb-3 flex items-center gap-2 font-mono">
                    <Clock className="w-4 h-4 text-zinc-300" />
                    PENDING REVIEW ({ordersWithPendingProofs.length})
                  </h5>
                  <div className="mb-3 p-3 rounded border" style={{ backgroundColor: '#1f1f15', borderColor: '#ca8a04' }}>
                    <div className="flex items-start gap-2 text-xs text-yellow-400 font-mono">
                      <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                      <div>
                        <p className="font-semibold mb-1">ADMIN REVIEW PERIOD</p>
                        <p className="text-yellow-300/80">Proofs can only be accepted AFTER the 4-hour submission deadline has passed. Sellers have exactly 4 hours to submit their proofs.</p>
                      </div>
                    </div>
                  </div>
                  <div className="space-y-4">
                    {ordersWithPendingProofs.map((order) => {
                      const validation = proofValidations[order.id.toString()];
                      const isLoading = validation?.loading || validatingOrderId === order.id;
                      const validationResult = validation?.result;
                      const expectedExplorer = getProjectExplorerUrl(order.projectToken) || defaultExplorer;
                      
                      return (
                        <div key={order.id.toString()} className="p-4 rounded border" style={{ backgroundColor: '#121218', borderColor: '#2b2b30' }}>
                          <div className="flex items-start gap-4">
                            {/* Checkbox */}
                            <button
                              onClick={() => toggleOrderSelection(order.id)}
                              className="mt-1 p-1 hover:bg-zinc-800 rounded transition-colors"
                            >
                              {selectedOrderIds.has(order.id) ? (
                                <CheckSquare className="w-5 h-5 text-green-400" />
                              ) : (
                                <Square className="w-5 h-5 text-zinc-500" />
                              )}
                            </button>

                            {/* Order Details */}
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-3">
                                <span className="text-sm font-bold text-white font-mono">ORDER #{order.id.toString()}</span>
                                {isLoading ? (
                                  <Badge className="bg-blue-950/30 border border-blue-500/50 text-blue-400 text-xs font-mono font-semibold uppercase flex items-center gap-1">
                                    <Loader2 className="w-3 h-3 animate-spin" />
                                    VALIDATING...
                                  </Badge>
                                ) : validationResult?.status === 'APPROVED' ? (
                                  <Badge className="bg-green-950/30 border border-green-500/50 text-green-400 text-xs font-mono font-semibold uppercase">✓ APPROVED</Badge>
                                ) : validationResult?.status === 'NOT_APPROVED' ? (
                                  <Badge className="bg-red-950/30 border border-red-500/50 text-red-400 text-xs font-mono font-semibold uppercase">✗ NOT APPROVED</Badge>
                                ) : validationResult?.status === 'MANUAL_REVIEW' ? (
                                  <Badge className="bg-yellow-950/30 border border-yellow-500/50 text-yellow-400 text-xs font-mono font-semibold uppercase">⚠ MANUAL REVIEW</Badge>
                                ) : (
                                  <Badge className="bg-yellow-950/30 border border-yellow-500/50 text-yellow-400 text-xs font-mono font-semibold uppercase">PENDING REVIEW</Badge>
                                )}
                              </div>
                              
                              {/* Proof URL */}
                              <div className="p-3 rounded border mb-3" style={{ backgroundColor: '#06060c', borderColor: '#2b2b30' }}>
                                <div className="flex items-center justify-between mb-1">
                                  <div className="text-xs font-semibold text-zinc-300 font-mono">PROOF URL:</div>
                                  {order.proof && (
                                    <a
                                      href={order.proof}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1"
                                    >
                                      <ExternalLink className="w-3 h-3" />
                                      OPEN
                                    </a>
                                  )}
                                </div>
                                <p className="text-xs text-zinc-400 font-mono break-all">{order.proof}</p>
                              </div>

                              {/* Validation Results */}
                              {validationResult && !isLoading && (
                                <div className="space-y-3 mb-3">
                                  {/* URL Match Check */}
                                  <div className="p-2 rounded border" style={{ backgroundColor: '#06060c', borderColor: '#2b2b30' }}>
                                    <div className="flex items-center gap-2 mb-1">
                                      {expectedExplorer && order.proof?.toLowerCase().includes(new URL(expectedExplorer).hostname.toLowerCase()) ? (
                                        <>
                                          <CheckCircle className="w-3 h-3 text-green-400" />
                                          <span className="text-xs font-semibold text-green-400 font-mono">URL MATCHES EXPLORER</span>
                                        </>
                                      ) : (
                                        <>
                                          <XCircle className="w-3 h-3 text-red-400" />
                                          <span className="text-xs font-semibold text-red-400 font-mono">URL DOES NOT MATCH EXPLORER</span>
                                        </>
                                      )}
                                    </div>
                                    {expectedExplorer && (
                                      <p className="text-xs text-zinc-500 font-mono">Expected: {expectedExplorer}</p>
                                    )}
                                  </div>

                                  {/* RPC Validation Results */}
                                  {validationResult.transactionDetails ? (
                                    <div className="p-3 rounded border" style={{ backgroundColor: '#06060c', borderColor: '#22c55e' }}>
                                      <div className="flex items-center gap-2 mb-2">
                                        <CheckCircle className="w-4 h-4 text-green-400" />
                                        <span className="text-xs font-semibold text-green-400 font-mono">RPC VALIDATION SUCCESSFUL</span>
                                      </div>
                                      <div className="space-y-1 text-xs font-mono">
                                        <div className="flex items-center gap-2">
                                          <span className="text-zinc-400">From:</span>
                                          <span className={validationResult.transactionDetails.from.toLowerCase() === order.seller.toLowerCase() ? 'text-green-400' : 'text-red-400'}>
                                            {validationResult.transactionDetails.from}
                                            {validationResult.transactionDetails.from.toLowerCase() === order.seller.toLowerCase() ? ' ✓' : ' ✗'}
                                          </span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                          <span className="text-zinc-400">To:</span>
                                          <span className={validationResult.transactionDetails.to.toLowerCase() === order.buyer.toLowerCase() ? 'text-green-400' : 'text-red-400'}>
                                            {validationResult.transactionDetails.to}
                                            {validationResult.transactionDetails.to.toLowerCase() === order.buyer.toLowerCase() ? ' ✓' : ' ✗'}
                                          </span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                          <span className="text-zinc-400">Amount:</span>
                                          <span className={validationResult.isValid ? 'text-green-400' : 'text-red-400'}>
                                            {(Number(validationResult.transactionDetails.amount) / 1e18).toLocaleString()} tokens
                                            {validationResult.isValid ? ' ✓' : ' ✗'}
                                          </span>
                                        </div>
                                      </div>
                                    </div>
                                  ) : validationResult.status === 'MANUAL_REVIEW' ? (
                                    <div className="p-3 rounded border" style={{ backgroundColor: '#1f1f15', borderColor: '#ca8a04' }}>
                                      <div className="flex items-center gap-2 mb-1">
                                        <AlertTriangle className="w-4 h-4 text-yellow-400" />
                                        <span className="text-xs font-semibold text-yellow-400 font-mono">RPC VALIDATION FAILED</span>
                                      </div>
                                      <p className="text-xs text-yellow-300/80 font-mono">Could not fetch transaction details automatically. Please review manually by opening the URL above.</p>
                                    </div>
                                  ) : null}

                                  {/* Validation Errors */}
                                  {validationResult.errors && validationResult.errors.length > 0 && (
                                    <div className="p-3 rounded border" style={{ backgroundColor: '#1f1f15', borderColor: '#ef4444' }}>
                                      <div className="flex items-center gap-2 mb-2">
                                        <XCircle className="w-4 h-4 text-red-400" />
                                        <span className="text-xs font-semibold text-red-400 font-mono">VALIDATION ERRORS:</span>
                                      </div>
                                      <ul className="space-y-1">
                                        {validationResult.errors.map((error, idx) => (
                                          <li key={idx} className="text-xs text-red-300 font-mono">• {error}</li>
                                        ))}
                                      </ul>
                                    </div>
                                  )}

                                  {/* Order Details for Reference */}
                                  <div className="p-2 rounded border" style={{ backgroundColor: '#06060c', borderColor: '#2b2b30' }}>
                                    <div className="text-xs font-semibold text-zinc-400 mb-1 font-mono">ORDER DETAILS:</div>
                                    <div className="space-y-1 text-xs font-mono">
                                      <div className="flex items-center gap-2">
                                        <span className="text-zinc-500">Seller:</span>
                                        <span className="text-zinc-300">{order.seller}</span>
                                      </div>
                                      <div className="flex items-center gap-2">
                                        <span className="text-zinc-500">Buyer:</span>
                                        <span className="text-zinc-300">{order.buyer}</span>
                                      </div>
                                      <div className="flex items-center gap-2">
                                        <span className="text-zinc-500">Amount:</span>
                                        <span className="text-zinc-300">{(Number(order.amount) / 1e18).toLocaleString()} tokens</span>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              )}

                              {/* Actions */}
                              {rejectingOrderId === order.id ? (
                                <div className="flex gap-2">
                                  <Input
                                    placeholder="Reason for rejection..."
                                    value={rejectReason}
                                    onChange={(e) => setRejectReason(e.target.value)}
                                    className="flex-1 text-sm"
                                  />
                                  <Button
                                    onClick={() => handleRejectProof(order.id, rejectReason)}
                                    disabled={!rejectReason || isPending}
                                    variant="custom"
                                    className="font-mono font-semibold uppercase border"
                                    style={{ backgroundColor: '#ef4444', borderColor: '#ef4444', color: 'white' }}
                                  >
                                    CONFIRM
                                  </Button>
                                  <Button
                                    onClick={() => {
                                      setRejectingOrderId(null);
                                      setRejectReason("");
                                    }}
                                    variant="custom"
                                    className="font-mono font-semibold uppercase border"
                                    style={{ backgroundColor: '#2b2b30', borderColor: '#2b2b30', color: 'white' }}
                                  >
                                    CANCEL
                                  </Button>
                                </div>
                              ) : (
                                <div className="flex gap-2">
                                  <Button
                                    onClick={() => handleAcceptProof(order.id)}
                                    disabled={isPending || isConfirming || isLoading}
                                    variant="custom"
                                    className="font-mono font-semibold uppercase border"
                                    style={{ 
                                      backgroundColor: validationResult?.status === 'APPROVED' ? '#22c55e' : '#22c55e',
                                      borderColor: validationResult?.status === 'APPROVED' ? '#22c55e' : '#22c55e',
                                      color: 'white',
                                      opacity: isLoading ? 0.5 : 1
                                    }}
                                  >
                                    <CheckCircle className="w-4 h-4 mr-1" />
                                    ACCEPT PROOF
                                  </Button>
                                  <Button
                                    onClick={() => setRejectingOrderId(order.id)}
                                    disabled={isPending || isConfirming || isLoading}
                                    variant="custom"
                                    className="font-mono font-semibold uppercase border"
                                    style={{ backgroundColor: '#121218', borderColor: '#ef4444', color: '#ef4444', opacity: isLoading ? 0.5 : 1 }}
                                  >
                                    <XCircle className="w-4 h-4 mr-1" />
                                    REJECT
                                  </Button>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Accepted Proofs List */}
              {ordersWithAcceptedProofs.length > 0 && (
                <div>
                  <div className="mb-3">
                    <h5 className="text-sm font-bold text-green-400 flex items-center gap-2 mb-2 font-mono">
                      <CheckCircle className="w-4 h-4 text-green-400" />
                      STEP_4: PERMISSIONLESS_SETTLEMENT • {ordersWithAcceptedProofs.length} READY
                    </h5>
                    <div className="p-3 rounded border" style={{ backgroundColor: '#121218', borderColor: '#2b2b30' }}>
                      <div className="flex items-start gap-2 text-xs text-zinc-300">
                        <AlertTriangle className="w-4 h-4 text-red-400 mt-0.5 flex-shrink-0" />
                        <div>
                          <p className="font-semibold mb-1 font-mono">FULLY PERMISSIONLESS!</p>
                          <p className="text-zinc-400 font-mono">
                            Once proofs are accepted, <strong>anyone</strong> can settle these orders by calling the contract directly.
                            Buyers/sellers can settle themselves—no need to wait for admin action!
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="space-y-3">
                    {ordersWithAcceptedProofs.map((order) => {
                      const status = proofStatuses[order.id.toString()];
                      return (
                        <div key={order.id.toString()} className="p-4 rounded border" style={{ backgroundColor: '#121218', borderColor: '#22c55e' }}>
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-2">
                                <span className="text-sm font-bold text-white font-mono">ORDER #{order.id.toString()}</span>
                                <Badge className="bg-green-950/30 border border-green-500/50 text-green-400 text-xs font-mono font-semibold uppercase">ACCEPTED</Badge>
                                {status?.acceptedAt && (
                                  <span className="text-xs text-zinc-500 font-mono">
                                    {new Date(Number(status.acceptedAt) * 1000).toLocaleString()}
                                  </span>
                                )}
                              </div>
                              
                              <div className="p-3 rounded border" style={{ backgroundColor: '#06060c', borderColor: '#2b2b30' }}>
                                <div className="text-xs font-semibold text-zinc-300 mb-1 font-mono">VERIFIED PROOF:</div>
                                <p className="text-xs text-zinc-400 font-mono break-all">{order.proof}</p>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

            {ordersWithProofs.length === 0 && (
              <div className="text-center py-8 text-zinc-500 font-mono">
                No proofs submitted yet. Sellers must submit proof after delivering tokens.
              </div>
            )}
          </div>
        </div>
      )}

      {/* Individual Orders - Advanced/Exception Cases (Hidden for Points projects - use batch operations) */}
      {!isPointsProject && (
        <div className="mb-6">
          <button
            onClick={() => setShowIndividualOrders(!showIndividualOrders)}
            className="flex items-center gap-2 text-sm text-zinc-400 hover:text-zinc-300 transition-colors mb-3"
          >
            <span className="text-lg">{showIndividualOrders ? "▼" : "▶"}</span>
            <span>Individual Orders (Advanced) - {eligibleOrders.length} order(s)</span>
          </button>
        
        {showIndividualOrders && (
          <div className="pl-6 border-l-2 border-zinc-800">
            <p className="text-xs text-zinc-500 mb-3">
              Only use individual activation if you need to activate orders separately or exclude specific orders
            </p>
            {eligibleOrders.length === 0 ? (
              <p className="text-sm text-zinc-500">All orders are already activated or completed</p>
            ) : (
              <div className="space-y-3">
                {eligibleOrders.map((order) => (
              <div key={order.id.toString()} className="p-4 bg-zinc-900/50 rounded-lg border border-zinc-800/50">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-bold text-zinc-300">Order #{order.id.toString()}</span>
                      <Badge className={
                        order.status === 0 ? "bg-zinc-600" :
                        order.status === 1 ? "bg-yellow-600" :
                        "bg-orange-600"
                      }>
                        {STATUS_NAMES[order.status]}
                      </Badge>
                    </div>
                    <p className="text-xs text-zinc-500">
                      {order.status === 0 ? "Awaiting counterparty" :
                       order.status === 1 ? "Buyer & Seller collateral locked" :
                       "TGE already activated"}
                    </p>
                  </div>
                </div>
                
                    <div className="flex items-end gap-3">
                      <div className="flex-1">
                        <label className="text-xs text-zinc-400 mb-1 block">Actual Token Address</label>
                        <Input
                          placeholder="0x..."
                          value={selectedOrder === order.id ? tokenAddress : ""}
                          onChange={(e) => {
                            setSelectedOrder(order.id);
                            setTokenAddress(e.target.value);
                          }}
                          onFocus={() => setSelectedOrder(order.id)}
                          className="text-sm"
                        />
                      </div>
                      <Button
                        onClick={() => handleActivateTGE(order.id)}
                        disabled={isPending || isConfirming || selectedOrder !== order.id || !tokenAddress}
                        variant="custom"
                        className="bg-green-600 hover:bg-green-700 border border-green-500/30"
                      >
                        <PlayCircle className="w-4 h-4 mr-1" />
                        Start 4h Window
                      </Button>
                    </div>
                    
                    {/* Show settlement instructions based on asset type */}
                    {isPointsProject && (
                      <div className="mt-3 p-3 rounded border" style={{ backgroundColor: '#121218', borderColor: '#2b2b30' }}>
                        <div className="flex items-start gap-2 text-xs text-zinc-300">
                          <AlertTriangle className="w-4 h-4 text-red-400 mt-0.5" />
                          <div>
                            <p className="font-medium mb-1">Points Project Settlement</p>
                            <p className="text-blue-400/80">After TGE: Seller sends tokens directly to buyer → Submits proof → Admin manually settles</p>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
        </div>
      )}

      {/* V4 Note: No separate "Active Settlement Windows" section needed */}
      {/* In V4, orders stay as FUNDED during settlement. Project-level deadline is managed via extendSettlementDeadline(projectId) */}
      {/* Proof management section above handles all Points settlement workflows */}

      {/* Confirmation Modal */}
      {showConfirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0, 0, 0, 0.75)' }}>
          <Card className="max-w-md w-full p-6 font-mono" style={{ backgroundColor: '#121218', borderColor: '#2b2b30' }}>
            <div className="mb-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-xl font-bold text-white font-mono">ACTIVATE PROJECT TGE</h3>
                <button
                  onClick={() => setShowConfirmModal(false)}
                  className="text-zinc-400 hover:text-white transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <p className="text-xs text-zinc-400 mb-3 font-mono">
                Set global TGE flag for this entire project. This enables settlement for <span className="font-semibold text-green-400">{fundedOrders.length}</span> funded order(s).
              </p>
              <div className="p-3 rounded border flex items-start gap-2" style={{ backgroundColor: '#1f1f15', borderColor: '#ca8a04' }}>
                <AlertTriangle className="w-4 h-4 text-yellow-400 mt-0.5 flex-shrink-0" />
                <p className="text-xs text-yellow-400 font-mono">
                  <strong>WARNING:</strong> This action is <strong>NOT REVERSIBLE</strong>. Once activated, the TGE settlement window cannot be undone.
                </p>
              </div>
            </div>

            <div className="space-y-3 mb-6">
              <div className="flex items-start gap-2 text-sm">
                <Clock className="w-4 h-4 text-zinc-300 mt-0.5" />
                <div>
                  <p className="font-semibold text-zinc-300 font-mono">SETTLEMENT WINDOW</p>
                  <p className="text-zinc-400 text-xs font-mono">Opens a 4-hour window for anyone to settle orders</p>
                </div>
              </div>

              <div className="flex items-start gap-2 text-sm">
                <CheckCircle className="w-4 h-4 text-green-400 mt-0.5" />
                <div>
                  <p className="font-semibold text-green-400 font-mono">SETTLEMENT TYPE</p>
                  {isPointsProject && !batchTokenAddress ? (
                    <p className="text-zinc-400 text-xs font-mono">Off-chain settlement (proof-based)</p>
                  ) : (
                    <div className="text-zinc-400">
                      <p className="text-xs font-mono">On-chain settlement</p>
                      <p className="text-xs text-green-400 font-mono mt-1">{batchTokenAddress}</p>
                    </div>
                  )}
                </div>
              </div>

              <div className="p-3 rounded border" style={{ backgroundColor: '#06060c', borderColor: '#2b2b30' }}>
                <div className="flex items-center gap-2 mb-2">
                  <AlertTriangle className="w-4 h-4 text-yellow-400" />
                  <p className="font-semibold text-yellow-400 text-sm font-mono uppercase">Conversion Ratio</p>
                </div>
                <div className="mb-2">
                  <p className="text-base font-bold text-white font-mono">
                    {isPointsProject ? (
                      <>1 Point = <span className="text-green-400">{conversionRatio}</span> Tokens</>
                    ) : (
                      <>1 Token = 1 Token (1:1)</>
                    )}
                  </p>
                </div>
                <p className="text-xs text-yellow-400 font-mono">
                  ⚠️ Please <strong>DOUBLE CHECK</strong> this ratio before activating - it cannot be changed after activation.
                </p>
              </div>
            </div>

            <div className="flex gap-3">
              <Button
                onClick={() => setShowConfirmModal(false)}
                variant="custom"
                className="flex-1 border font-mono font-semibold uppercase"
                style={{ backgroundColor: '#2b2b30', borderColor: '#2b2b30', color: 'white' }}
              >
                CANCEL
              </Button>
              <Button
                onClick={confirmBatchActivate}
                variant="custom"
                className="flex-1 border font-mono font-semibold uppercase"
                style={{ backgroundColor: '#22c55e', borderColor: '#22c55e', color: 'white' }}
              >
                <PlayCircle className="w-4 h-4 mr-2" />
                ACTIVATE
              </Button>
            </div>
          </Card>
        </div>
      )}
    </Card>
  );
}

