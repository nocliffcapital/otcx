"use client";

import React, { useState, useEffect } from "react";
import { useAccount, useWriteContract, useWaitForTransactionReceipt, useReadContract } from "wagmi";
import { ORDERBOOK_ADDRESS, ESCROW_ORDERBOOK_ABI, REGISTRY_ADDRESS, PROJECT_REGISTRY_ABI, ERC20_ABI } from "@/lib/contracts";
import { Button } from "./ui/Button";
import { Input } from "./ui/Input";
import { Badge } from "./ui/Badge";
import { Clock, PlayCircle, Plus, CheckCircle, AlertCircle, DollarSign, Loader2, Link as LinkIcon, ChevronDown, Square, CheckSquare2, Copy, Check } from "lucide-react";
import { useToast } from "./Toast";
import { getProjectExplorerUrl } from "./TGESettlementManager";
import { useChainId } from "wagmi";
import { getChainConfig } from "@/lib/chains";

interface TGEOrderControlsProps {
  order: {
    id: bigint;
    projectToken: string;
    amount: bigint;
    unitPrice: bigint;
    seller: string;
    buyer: string;
    maker: string;
    status: number;
    tokensDeposited: boolean;
    settlementDeadline?: bigint; // V2/V3 only - not used in V4
    proof?: string;
  };
  isOwner: boolean;
  projectSlug?: string; // Optional: if we know the project slug
  projectTgeActivated?: boolean; // V4: Whether TGE is activated for this project
}

export function TGEOrderControls({ order, isOwner, projectTgeActivated = false }: TGEOrderControlsProps) {
  const { address } = useAccount();
  const chainId = useChainId();
  
  // Get expected block explorer URL for this project
  const expectedExplorerUrl = getProjectExplorerUrl(order.projectToken) || getChainConfig(chainId)?.explorer || "";
  const [tokenAddress, setTokenAddress] = useState("");
  const [showTGEInput, setShowTGEInput] = useState(false);
  const [proof, setProof] = useState("");
  const [showProofInput, setShowProofInput] = useState(false);
  const [showProofConfirmModal, setShowProofConfirmModal] = useState(false);
  const [showProofDetails, setShowProofDetails] = useState(false);
  const [showBuyerProofDetails, setShowBuyerProofDetails] = useState(false);
  const [checkedAmount, setCheckedAmount] = useState(false);
  const [checkedAddress, setCheckedAddress] = useState(false);
  const [checkedExplorer, setCheckedExplorer] = useState(false);
  const [buyerAddressCopied, setBuyerAddressCopied] = useState(false);

  const { writeContract, data: hash, isPending, isError, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });
  const toast = useToast();

  // Read submitted proof
  const { data: submittedProof } = useReadContract({
    address: ORDERBOOK_ADDRESS,
    abi: ESCROW_ORDERBOOK_ABI,
    functionName: "settlementProof",
    args: [order.id],
  });

  const { data: proofTimestamp } = useReadContract({
    address: ORDERBOOK_ADDRESS,
    abi: ESCROW_ORDERBOOK_ABI,
    functionName: "proofSubmittedAt",
    args: [order.id],
  });

  // V4: Read if proof has been accepted by admin
  const { data: proofAccepted } = useReadContract({
    address: ORDERBOOK_ADDRESS,
    abi: ESCROW_ORDERBOOK_ABI,
    functionName: "proofAccepted",
    args: [order.id],
  });

  const { data: proofAcceptedAt } = useReadContract({
    address: ORDERBOOK_ADDRESS,
    abi: ESCROW_ORDERBOOK_ABI,
    functionName: "proofAcceptedAt",
    args: [order.id],
  });

  // V4: Read project-level settlement deadline
  const { data: projectDeadline } = useReadContract({
    address: ORDERBOOK_ADDRESS,
    abi: ESCROW_ORDERBOOK_ABI,
    functionName: "projectSettlementDeadline",
    args: [order.projectToken as `0x${string}`],
  });

  // V4: Read project token address (POINTS_SENTINEL for points, actual token for tokens)
  const { data: projectTokenAddress } = useReadContract({
    address: ORDERBOOK_ADDRESS,
    abi: ESCROW_ORDERBOOK_ABI,
    functionName: "projectTokenAddress",
    args: [order.projectToken as `0x${string}`],
  });

  // V4: Read conversion ratio (e.g., 1.2e18 = 1 point = 1.2 tokens)
  const { data: conversionRatio } = useReadContract({
    address: ORDERBOOK_ADDRESS,
    abi: ESCROW_ORDERBOOK_ABI,
    functionName: "projectConversionRatio",
    args: [order.projectToken as `0x${string}`],
  });

  // Read POINTS_SENTINEL from contract
  const { data: pointsSentinel } = useReadContract({
    address: ORDERBOOK_ADDRESS,
    abi: ESCROW_ORDERBOOK_ABI,
    functionName: "POINTS_SENTINEL",
  }) as { data: `0x${string}` | undefined };

  // For backward compatibility with V2/V3
  const actualTokenAddress = projectTokenAddress;

  // Check token allowance for deposit - poll every 2 seconds
  const { data: tokenAllowance } = useReadContract({
    address: actualTokenAddress as `0x${string}` | undefined,
    abi: ERC20_ABI,
    functionName: "allowance",
    args: address && actualTokenAddress ? [address, ORDERBOOK_ADDRESS] : undefined,
    query: {
      refetchInterval: 2000, // Poll every 2 seconds
      enabled: !!(address && actualTokenAddress), // Only poll when we have both address and token
    },
  });

  // Calculate actual token amount based on conversion ratio
  // For Points: amount * conversionRatio (e.g., 100 points * 1.2 = 120 tokens)
  // For Tokens: amount * 1.0 (1:1 ratio)
  const ratio = conversionRatio ? Number(conversionRatio) / 1e18 : 1.0;
  const actualTokenAmount = (Number(order.amount) / 1e18) * ratio;
  const actualTokenAmountBigInt = order.amount && conversionRatio ? 
    (BigInt(order.amount) * BigInt(conversionRatio)) / BigInt(1e18) : 
    order.amount;

  const hasApproval = tokenAllowance && actualTokenAmountBigInt ? 
    (tokenAllowance as bigint) >= (actualTokenAmountBigInt as bigint) : false;

  // Show success/error toasts based on transaction status
  useEffect(() => {
    if (isSuccess && hash) {
      toast.success("Transaction Confirmed", "Your action was completed successfully");
    }
  }, [isSuccess, hash]); // Removed toast from dependencies - it's stable

  useEffect(() => {
    if (isError && error) {
      const errorMessage = error.message.length > 100 
        ? error.message.substring(0, 100) + "..." 
        : error.message;
      toast.error("❌ Transaction Failed", errorMessage);
    }
  }, [isError, error]); // Removed toast from dependencies - it's stable

  // V4: Determine project type from token address read from contract
  const isPointsProject = projectTokenAddress && pointsSentinel && 
    (projectTokenAddress as string).toLowerCase() === (pointsSentinel as string).toLowerCase();
  const isTokenProject = projectTokenAddress && !isPointsProject;

  const isSeller = address && order.seller && address.toLowerCase() === order.seller.toLowerCase();
  const isBuyer = address && order.buyer && address.toLowerCase() === order.buyer.toLowerCase();

  // V4 Status: 0=OPEN, 1=FUNDED, 2=SETTLED, 3=DEFAULTED, 4=CANCELED
  // In V4, orders stay as FUNDED (1) during settlement - there's no TGE_ACTIVATED status
  const status = Number(order.status);
  // V4: Use project-level deadline, not order-level
  const deadline = projectDeadline ? Number(projectDeadline) * 1000 : 0;
  const isOverdue = deadline > 0 && Date.now() > deadline;

  const handleActivateTGE = () => {
    if (!tokenAddress || !tokenAddress.match(/^0x[a-fA-F0-9]{40}$/)) {
      alert("Please enter a valid token address");
      return;
    }

    if (!confirm(`Activate TGE for order #${order.id}?\nThis will start a 4-hour settlement window.`)) {
      return;
    }

    // V4: Individual order TGE activation removed - admin must use project-level activation
    toast.error("Feature removed", "V4 uses project-level TGE activation. Please use the admin panel to activate TGE for all orders in this project.");
    return;
  };

  const handleExtendSettlement = (hours: 4 | 24) => {
    if (!confirm(`Extend settlement for order #${order.id} by ${hours} hours?`)) {
      return;
    }

    toast.info("Extending settlement", `Adding ${hours} hours to deadline`);

    writeContract({
      address: ORDERBOOK_ADDRESS,
      abi: ESCROW_ORDERBOOK_ABI,
      functionName: "extendSettlement",
      args: [order.id, BigInt(hours)],
    });
  };

  const handleApproveTokens = () => {
    if (!actualTokenAddress) {
      toast.error("Token Not Ready", "Token address not found. Please wait for TGE activation.");
      return;
    }

    toast.info("🔐 Approving Tokens", "Please confirm the transaction in your wallet");

    writeContract({
      address: actualTokenAddress as `0x${string}`,
      abi: ERC20_ABI,
      functionName: "approve",
      args: [ORDERBOOK_ADDRESS, actualTokenAmountBigInt],
    });
  };

  const handleSettleOrder = () => {
    toast.info("🚀 Settling Order", "Please confirm the transaction in your wallet");

    writeContract({
      address: ORDERBOOK_ADDRESS,
      abi: ESCROW_ORDERBOOK_ABI,
      functionName: "settleOrder",
      args: [order.id],
    });
  };

  const handleDefaultSeller = () => {
    toast.info("⚠️ Defaulting Seller", "Please confirm the transaction in your wallet");

    writeContract({
      address: ORDERBOOK_ADDRESS,
      abi: ESCROW_ORDERBOOK_ABI,
      functionName: "defaultSeller",
      args: [order.id],
    });
  };

  const confirmSubmitProof = () => {
    if (!proof || proof.trim().length === 0) {
      toast.error("Invalid proof", "Please enter proof (transaction link or hash)");
      return;
    }

    if (!checkedAmount || !checkedAddress || !checkedExplorer) {
      toast.error("Please check all boxes", "You must confirm all three requirements before submitting");
      return;
    }

    toast.info("⏳ Submitting proof...", "Transaction pending");

    writeContract({
      address: ORDERBOOK_ADDRESS,
      abi: ESCROW_ORDERBOOK_ABI,
      functionName: "submitProof",
      args: [order.id, proof],
    });
    
    setShowProofConfirmModal(false);
    setProof("");
    // Reset checkboxes
    setCheckedAmount(false);
    setCheckedAddress(false);
    setCheckedExplorer(false);
  };

  const [shouldSettleAfterAccept, setShouldSettleAfterAccept] = useState(false);

  const handleAcceptProofAsBuyer = () => {
    toast.info("Accepting Proof", "Please confirm the transaction in your wallet");

    writeContract({
      address: ORDERBOOK_ADDRESS,
      abi: ESCROW_ORDERBOOK_ABI,
      functionName: "acceptProofAsBuyer",
      args: [order.id],
    });
  };

  const handleAcceptAndSettle = () => {
    // Mark that we should settle after accepting
    setShouldSettleAfterAccept(true);
    handleAcceptProofAsBuyer();
  };

  const handleManualSettle = () => {
    toast.info("Settling Order", "Please confirm the transaction in your wallet");

    writeContract({
      address: ORDERBOOK_ADDRESS,
      abi: ESCROW_ORDERBOOK_ABI,
      functionName: "settleOrderManual",
      args: [order.id],
    });
  };

  // After proof acceptance succeeds, automatically settle if requested
  useEffect(() => {
    if (isSuccess && hash && shouldSettleAfterAccept && proofAccepted) {
      setShouldSettleAfterAccept(false);
      // Small delay to ensure state is updated
      setTimeout(() => {
        handleManualSettle();
      }, 500);
    }
  }, [isSuccess, hash, shouldSettleAfterAccept, proofAccepted]);

  const formatDeadline = () => {
    if (deadline === 0) return null;
    const now = Date.now();
    const diff = deadline - now;
    
    if (diff < 0) return <Badge className="bg-red-600">⚠️ OVERDUE</Badge>;
    
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    
    return (
      <Badge className="bg-orange-600">
        <Clock className="w-3 h-3 mr-1" />
        {hours}h {minutes}m left
      </Badge>
    );
  };

  // V4: Determine if order is in settlement (FUNDED + TGE activated)
  const isInSettlement = status === 1 && projectTgeActivated;
  
  // Don't show anything for completed/canceled orders (SETTLED=2, DEFAULTED=3, CANCELED=4)
  if (status >= 2) return null;
  
  // Only show settlement controls if TGE is activated for this project
  if (!projectTgeActivated) return null;

  return (
    <div className="space-y-2">
      {/* Toast notifications handle all messages */}

      {/* Admin Controls - Activate TGE (TOKENS ONLY) - V4: This is now project-level */}
      {isOwner && isTokenProject && !projectTgeActivated && (
        <div className="space-y-2">
          <Badge className="bg-blue-600 text-xs mb-1">Token Project - On-Chain Settlement</Badge>
          {!showTGEInput ? (
            <Button
              onClick={() => setShowTGEInput(true)}
              variant="custom"
              className="bg-green-600 hover:bg-green-700 border border-green-500/30 text-xs h-8"
              disabled={isPending || isConfirming}
            >
              <PlayCircle className="w-3 h-3 mr-1" />
              Activate TGE
            </Button>
          ) : (
            <div className="flex items-end gap-2">
              <div className="flex-1">
                <label className="text-xs text-zinc-400 mb-1 block">Token Address</label>
                <Input
                  placeholder="0x..."
                  value={tokenAddress}
                  onChange={(e) => setTokenAddress(e.target.value)}
                  className="text-xs h-8"
                />
              </div>
              <Button
                onClick={handleActivateTGE}
                disabled={isPending || isConfirming || !tokenAddress}
                variant="custom"
                className="bg-green-600 hover:bg-green-700 border border-green-500/30 text-xs h-8"
              >
                Start 4h
              </Button>
              <Button
                onClick={() => setShowTGEInput(false)}
                variant="custom"
                className="bg-zinc-700 hover:bg-zinc-600 text-xs h-8"
              >
                Cancel
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Admin Controls - Extend Settlement */}
      {isOwner && isInSettlement && !order.tokensDeposited && (
        <div className="flex gap-2">
          <Button
            onClick={() => handleExtendSettlement(4)}
            disabled={isPending || isConfirming}
            variant="custom"
            className="bg-cyan-600 hover:bg-cyan-700 border border-cyan-500/30 text-xs h-8"
          >
            <Plus className="w-3 h-3 mr-1" />
            +4 Hours
          </Button>
          <Button
            onClick={() => handleExtendSettlement(24)}
            disabled={isPending || isConfirming}
            variant="custom"
            className="bg-violet-600 hover:bg-violet-700 border border-violet-500/30 text-xs h-8"
          >
            <Plus className="w-3 h-3 mr-1" />
            +24 Hours
          </Button>
        </div>
      )}

      {/* Proof Display - Show to Admin (pending review) */}
      {isOwner && submittedProof && (submittedProof as string).length > 0 && !proofAccepted && isInSettlement && (
        <div className="bg-purple-950/30 border border-purple-800/30 rounded-lg p-3">
          <div className="flex items-center gap-2 mb-2">
            <AlertCircle className="w-4 h-4 text-purple-400" />
            <span className="text-xs font-bold text-purple-400">⏳ Proof Pending Review</span>
            {proofTimestamp && (
              <span className="text-xs text-zinc-500">
                {new Date(Number(proofTimestamp) * 1000).toLocaleString()}
              </span>
            )}
          </div>
          <div className="bg-zinc-900/50 rounded p-2 mb-2">
            <p className="text-xs text-zinc-300 break-all">{submittedProof as string}</p>
          </div>
          <p className="text-xs text-zinc-400 mb-2">
            ⚠️ Go to Admin panel to accept/reject this proof. After acceptance, anyone can settle.
          </p>
        </div>
      )}

      {/* Proof Accepted - Anyone Can Settle (Admin view) */}
      {isOwner && proofAccepted && isInSettlement && (
        <div className="bg-green-950/30 border border-green-800/30 rounded-lg p-3">
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle className="w-4 h-4 text-green-400" />
            <span className="text-xs font-bold text-green-400">✅ Proof Accepted - Ready to Settle</span>
            {proofAcceptedAt && (
              <span className="text-xs text-zinc-500">
                {new Date(Number(proofAcceptedAt) * 1000).toLocaleString()}
              </span>
            )}
          </div>
          {submittedProof && (
            <div className="bg-zinc-900/50 rounded p-2 mb-2">
              <p className="text-xs text-zinc-300 break-all">{submittedProof as string}</p>
            </div>
          )}
          <Button
            onClick={handleManualSettle}
            variant="custom"
            className="bg-green-600 hover:bg-green-700 border border-green-500/30 text-xs h-8 w-full"
            disabled={isPending || isConfirming}
          >
            <CheckCircle className="w-3 h-3 mr-1" />
            Settle Order (Permissionless)
          </Button>
          <p className="text-xs text-green-400 mt-2">
            ℹ️ Buyer can also settle this themselves - it's permissionless after acceptance!
          </p>
        </div>
      )}

      {/* Seller Controls - Submit Proof (POINTS ONLY) */}
      {isSeller && isPointsProject && isInSettlement && !submittedProof && (
        <Button
          onClick={() => setShowProofConfirmModal(true)}
          variant="custom"
          className="text-xs h-8 px-3 border font-mono font-semibold uppercase whitespace-nowrap"
          style={{ 
            backgroundColor: '#121218', 
            borderColor: '#a855f7', // Purple border
            color: '#a855f7', // Purple text
          }}
          disabled={isPending || isConfirming}
          onMouseEnter={(e) => {
            if (!e.currentTarget.disabled) {
              e.currentTarget.style.backgroundColor = 'rgba(168, 85, 247, 0.15)'; // Subtle purple glow
              e.currentTarget.style.borderColor = 'rgba(168, 85, 247, 0.6)'; // Brighter purple border
              e.currentTarget.style.color = '#a855f7';
            }
          }}
          onMouseLeave={(e) => {
            if (!e.currentTarget.disabled) {
              e.currentTarget.style.backgroundColor = '#121218';
              e.currentTarget.style.borderColor = '#a855f7';
              e.currentTarget.style.color = '#a855f7';
            }
          }}
        >
          <CheckCircle className="w-3 h-3 mr-1.5" />
          SUBMIT PROOF
        </Button>
      )}

      {/* Proof Submitted - Show to Seller (POINTS ONLY) */}
      {isSeller && isPointsProject && submittedProof && (submittedProof as string).length > 0 && isInSettlement && (
        <div className="bg-green-950/30 border border-green-800/30 rounded-lg">
          <button
            onClick={() => setShowProofDetails(!showProofDetails)}
            className="w-full p-3 flex items-center justify-between hover:bg-green-950/50 transition-colors rounded-lg"
          >
            <div className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-green-400 flex-shrink-0" />
              <span className="text-xs font-bold text-green-400">Proof Submitted</span>
            </div>
            <ChevronDown 
              className={`w-4 h-4 text-green-400 transition-transform flex-shrink-0 ${showProofDetails ? 'rotate-180' : ''}`}
            />
          </button>
          {showProofDetails && (
            <div className="px-3 pb-3 space-y-2 border-t border-green-800/30 pt-3">
              <div className="bg-zinc-900/50 rounded p-2 text-right">
                <p className="text-xs text-zinc-400 mb-1 font-mono">Transaction URL:</p>
                <a 
                  href={submittedProof as string} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-xs text-green-400 break-all hover:text-green-300 hover:underline font-mono block text-right"
                >
                  {submittedProof as string}
                </a>
              </div>
              {proofTimestamp && (
                <div className="bg-zinc-900/50 rounded p-2 text-right">
                  <p className="text-xs text-zinc-400 mb-1 font-mono">Submitted At:</p>
                  <p className="text-xs text-zinc-300 font-mono">
                    {new Date(Number(proofTimestamp) * 1000).toLocaleString()}
                  </p>
                </div>
              )}
              <div className="bg-blue-950/30 border border-blue-800/30 rounded p-2 text-right">
                <div className="flex items-center justify-end gap-2">
                  <Clock className="w-3 h-3 text-blue-400 flex-shrink-0" />
                    <p className="text-xs text-blue-400 font-mono">Awaiting Review</p>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Seller Controls - Approve & Deposit Tokens (TOKENS ONLY) */}
      {isSeller && isTokenProject && isInSettlement && !order.tokensDeposited && !isOverdue && (
        <div className="space-y-2">
          {!hasApproval ? (
            <div>
              <Button
                onClick={handleApproveTokens}
                disabled={isPending || isConfirming || !actualTokenAddress}
                variant="custom"
                className="bg-cyan-600 hover:bg-cyan-700 border border-cyan-500/30 text-[11px] h-7 w-full"
              >
              {isPending || isConfirming ? (
                <>
                  <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                  Approving...
                </>
              ) : (
                  <>
                    <CheckCircle className="w-3 h-3 mr-1" />
                    1. Approve Tokens
                  </>
                )}
              </Button>
            </div>
          ) : (
            <Button
              onClick={handleSettleOrder}
              disabled={isPending || isConfirming}
              variant="custom"
              className="bg-green-600 hover:bg-green-700 border border-green-500/30 text-[11px] h-7 w-full"
            >
              {isPending || isConfirming ? (
                <>
                  <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                  Settling...
                </>
              ) : (
                <>
                  <CheckCircle className="w-3 h-3 mr-1" />
                  2. Settle Order
                </>
              )}
            </Button>
          )}
          {hasApproval && (
            <p className="text-xs text-green-400">✓ Tokens approved - click to settle</p>
          )}
        </div>
      )}

      {/* Buyer - Order Settled (no action needed) */}
      {isBuyer && status === 2 && (
        <div className="p-3 bg-green-950/30 border border-green-500/30 rounded-lg">
          <p className="text-xs text-green-400 text-center">
            ✅ Order Settled - Tokens delivered
          </p>
        </div>
      )}
      {isBuyer && isInSettlement && isOverdue && !order.tokensDeposited && (
        <Button
          onClick={handleDefaultSeller}
          disabled={isPending || isConfirming}
          variant="custom"
          className="bg-red-600 hover:bg-red-700 border border-red-500/30 text-xs h-8"
        >
          <AlertCircle className="w-3 h-3 mr-1" />
          Default Seller (Get 2x)
        </Button>
      )}

      {/* Buyer Views Proof (POINTS ONLY) */}
      {isBuyer && isPointsProject && isInSettlement && submittedProof && (submittedProof as string).length > 0 && !proofAccepted && (
        <div className="bg-blue-950/30 border border-blue-800/30 rounded-lg">
          <button
            onClick={() => setShowBuyerProofDetails(!showBuyerProofDetails)}
            className="w-full p-3 flex items-center justify-between hover:bg-blue-950/50 transition-colors rounded-lg"
          >
            <div className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-blue-400 flex-shrink-0" />
              <span className="text-xs font-bold text-blue-400">Seller Submitted Proof</span>
            </div>
            <ChevronDown 
              className={`w-4 h-4 text-blue-400 transition-transform flex-shrink-0 ${showBuyerProofDetails ? 'rotate-180' : ''}`}
            />
          </button>
          {showBuyerProofDetails && (
            <div className="px-3 pb-3 space-y-2 border-t border-blue-800/30 pt-3">
              <div className="bg-zinc-900/50 rounded p-2 text-right">
                <p className="text-xs text-zinc-400 mb-1 font-mono">Transaction URL:</p>
                <a 
                  href={submittedProof as string} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-xs text-blue-400 break-all hover:text-blue-300 hover:underline font-mono block text-right"
                >
                  {submittedProof as string}
                </a>
              </div>
              {proofTimestamp && (
                <div className="bg-zinc-900/50 rounded p-2 text-right">
                  <p className="text-xs text-zinc-400 mb-1 font-mono">Submitted At:</p>
                  <p className="text-xs text-zinc-300 font-mono">
                    {new Date(Number(proofTimestamp) * 1000).toLocaleString()}
                  </p>
                </div>
              )}
              {!proofAccepted && (
                <div className="bg-yellow-950/30 border border-yellow-800/30 rounded p-2 text-right mb-2">
                  <div className="flex items-center justify-end gap-2">
                    <Clock className="w-3 h-3 text-yellow-400 flex-shrink-0" />
                    <p className="text-xs text-yellow-400 font-mono">Waiting for Review</p>
                  </div>
                </div>
              )}
              {!proofAccepted && (
                <Button
                  onClick={handleAcceptAndSettle}
                  disabled={isPending || isConfirming}
                  variant="custom"
                  className="w-full border font-mono font-semibold uppercase text-xs h-8"
                  style={{ 
                    backgroundColor: '#22c55e', 
                    borderColor: '#22c55e', 
                    color: 'white'
                  }}
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
                  <CheckCircle className="w-3 h-3 mr-1.5" />
                  ACCEPT & SETTLE
                </Button>
              )}
            </div>
          )}
        </div>
      )}

      {/* Buyer Can Settle Permissionlessly (POINTS ONLY) - Proof Accepted! */}
      {isBuyer && isPointsProject && isInSettlement && proofAccepted && (
        <div className="bg-green-950/30 border border-green-800/30 rounded-lg p-3">
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle className="w-4 h-4 text-green-400" />
            <span className="text-xs font-bold text-green-400">✅ Proof Accepted</span>
            {proofAcceptedAt && (
              <span className="text-xs text-zinc-500">
                {new Date(Number(proofAcceptedAt) * 1000).toLocaleString()}
              </span>
            )}
          </div>
          {submittedProof && (
            <div className="bg-zinc-900/50 rounded p-2 mb-2">
              <p className="text-xs text-zinc-300 break-all font-mono">{submittedProof as string}</p>
            </div>
          )}
          <Button
            onClick={handleManualSettle}
            variant="custom"
            className="bg-green-600 hover:bg-green-700 border border-green-500/30 text-xs h-8 w-full"
            disabled={isPending || isConfirming}
          >
            <CheckCircle className="w-3 h-3 mr-1" />
            Settle Order (Permissionless)
          </Button>
          <p className="text-xs text-green-400 mt-2">
            🎉 You can settle this order yourself - no need to wait for admin!
          </p>
        </div>
      )}

      {/* Proof Submission Modal */}
      {showProofConfirmModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="max-w-md w-full mx-4 p-6 bg-zinc-900 border border-purple-500/30 rounded-lg">
            <div className="mb-4">
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle className="w-6 h-6 text-purple-400" />
                <h3 className="text-xl font-bold text-purple-400">Submit Settlement Proof</h3>
              </div>
              <p className="text-sm text-zinc-400 mb-3">
                Confirm you have transferred the tokens off-chain to the buyer
              </p>
            </div>

            {/* Transfer Details */}
            <div className="space-y-3 mb-4 bg-purple-950/20 border border-purple-500/30 rounded p-3">
              <div className="flex items-start gap-2 text-sm">
                <DollarSign className="w-4 h-4 text-cyan-400 mt-0.5 flex-shrink-0" />
                <div className="flex-1">
                  <p className="font-medium text-cyan-400">Amount to Transfer</p>
                  <p className="text-white text-lg font-bold">
                    {actualTokenAmount.toLocaleString()} tokens
                  </p>
                  {ratio !== 1.0 && (
                    <p className="text-xs text-purple-400 mt-1">
                      {(Number(order.amount) / 1e18).toLocaleString()} points × {ratio} ratio
                    </p>
                  )}
                  <p className="text-xs text-zinc-500 mt-0.5">
                    Off-chain transfer to buyer's address
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-2 text-sm border-t border-purple-500/20 pt-3">
                <AlertCircle className="w-4 h-4 text-yellow-400 mt-0.5 flex-shrink-0" />
                <div className="flex-1">
                  <p className="font-medium text-yellow-400 mb-1">Buyer Address (Recipient)</p>
                  <div className="flex items-center gap-2 bg-zinc-950/50 p-2 rounded mt-1">
                    <p className="text-zinc-300 font-mono text-xs break-all flex-1">
                      {order.buyer}
                    </p>
                    <button
                      onClick={async () => {
                        try {
                          await navigator.clipboard.writeText(order.buyer);
                          setBuyerAddressCopied(true);
                          setTimeout(() => setBuyerAddressCopied(false), 2000);
                        } catch (err) {
                          console.error('Failed to copy:', err);
                        }
                      }}
                      className="flex-shrink-0 p-1 hover:bg-zinc-800/50 rounded transition-colors"
                      title="Copy address"
                    >
                      {buyerAddressCopied ? (
                        <Check className="w-4 h-4 text-green-400" />
                      ) : (
                        <Copy className="w-4 h-4 text-zinc-400 hover:text-zinc-300" />
                      )}
                    </button>
                  </div>
                </div>
              </div>

              {expectedExplorerUrl && (
                <div className="flex items-start gap-2 text-sm border-t border-purple-500/20 pt-3">
                  <LinkIcon className="w-4 h-4 text-purple-400 mt-0.5 flex-shrink-0" />
                  <div className="flex-1">
                    <p className="font-medium text-purple-400">Expected Block Explorer</p>
                    <p className="text-zinc-300 font-mono text-xs break-all bg-zinc-950/50 p-2 rounded mt-1">
                      {expectedExplorerUrl}
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Proof Input */}
            <div className="mb-4">
              <label className="text-sm font-medium text-zinc-300 mb-2 flex items-center gap-2 text-left">
                <LinkIcon className="w-4 h-4" />
                Transaction URL
              </label>
              <Input
                placeholder="block explorer link"
                value={proof}
                onChange={(e) => setProof(e.target.value)}
                className="text-sm"
              />
              {proof && proof.trim().length > 0 && (
                <div className="bg-zinc-950/50 border border-zinc-800/50 rounded p-2 mt-2">
                  <a
                    href={proof.trim()}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-purple-400 hover:text-purple-300 hover:underline font-mono break-all block text-left"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {proof.trim()}
                  </a>
                </div>
              )}
            </div>

            {/* Confirmation Checkboxes */}
            <div className="mb-4 space-y-3 bg-zinc-950/30 border border-zinc-800/50 rounded p-3">
              <p className="text-xs font-semibold text-zinc-300 mb-2 font-mono uppercase text-left">Confirm Before Submitting:</p>
              
              <label 
                className="flex items-start gap-3 cursor-pointer group text-left"
                onClick={() => setCheckedAmount(!checkedAmount)}
              >
                <div className="mt-0.5 flex-shrink-0">
                  {checkedAmount ? (
                    <CheckSquare2 className="w-5 h-5 text-green-400" />
                  ) : (
                    <Square className="w-5 h-5 text-zinc-500 group-hover:text-zinc-400" />
                  )}
                </div>
                <span className="text-xs text-zinc-300 font-mono flex-1 text-left">
                  I sent the correct amount of tokens ({actualTokenAmount.toLocaleString()} tokens)
                </span>
              </label>

              <label 
                className="flex items-start gap-3 cursor-pointer group text-left"
                onClick={() => setCheckedAddress(!checkedAddress)}
              >
                <div className="mt-0.5 flex-shrink-0">
                  {checkedAddress ? (
                    <CheckSquare2 className="w-5 h-5 text-green-400" />
                  ) : (
                    <Square className="w-5 h-5 text-zinc-500 group-hover:text-zinc-400" />
                  )}
                </div>
                <span className="text-xs text-zinc-300 font-mono flex-1 text-left">
                  I sent them to the correct buyer address as shown above ({order.buyer.slice(0, 6)}...{order.buyer.slice(-4)})
                </span>
              </label>

              <label 
                className="flex items-start gap-3 cursor-pointer group text-left"
                onClick={() => setCheckedExplorer(!checkedExplorer)}
              >
                <div className="mt-0.5 flex-shrink-0">
                  {checkedExplorer ? (
                    <CheckSquare2 className="w-5 h-5 text-green-400" />
                  ) : (
                    <Square className="w-5 h-5 text-zinc-500 group-hover:text-zinc-400" />
                  )}
                </div>
                <span className="text-xs text-zinc-300 font-mono flex-1 text-left">
                  I pasted the transaction URL from the specified block explorer{expectedExplorerUrl ? ` (${(() => { try { return new URL(expectedExplorerUrl).hostname; } catch { return expectedExplorerUrl; } })()})` : ''}
                </span>
              </label>
            </div>

            {/* Warning */}
            <div className="bg-red-950/20 border border-red-500/30 rounded p-3 mb-4">
              <p className="text-xs text-red-300 font-semibold mb-2 text-left">
                ⚠️ Important Warning
              </p>
              <ul className="text-xs text-red-200 space-y-1 pl-4 text-left">
                <li className="text-left">• Ensure you've transferred the exact amount to the correct address</li>
                <li className="text-left">• The admin will verify your proof before releasing funds</li>
                <li className="text-left">• <span className="font-bold text-red-400">Fraudulent proof = You LOSE your collateral</span></li>
              </ul>
            </div>

            <div className="flex gap-3">
              <Button
                onClick={() => {
                  setShowProofConfirmModal(false);
                  setProof("");
                  setCheckedAmount(false);
                  setCheckedAddress(false);
                  setCheckedExplorer(false);
                }}
                variant="custom"
                className="flex-1 border font-mono font-semibold uppercase h-9 text-sm"
                style={{ 
                  backgroundColor: '#121218', 
                  borderColor: '#2b2b30', 
                  color: '#ffffff',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = '#2b2b30';
                  e.currentTarget.style.borderColor = '#3f3f46';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = '#121218';
                  e.currentTarget.style.borderColor = '#2b2b30';
                }}
              >
                CANCEL
              </Button>
              <Button
                onClick={confirmSubmitProof}
                disabled={!proof || proof.trim().length === 0 || !checkedAmount || !checkedAddress || !checkedExplorer}
                variant="custom"
                className="flex-1 border font-mono font-semibold uppercase h-9 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ 
                  backgroundColor: '#121218', 
                  borderColor: '#a855f7', // Purple border
                  color: '#a855f7', // Purple text
                }}
                onMouseEnter={(e) => {
                  if (!e.currentTarget.disabled) {
                    e.currentTarget.style.backgroundColor = 'rgba(168, 85, 247, 0.15)';
                    e.currentTarget.style.borderColor = 'rgba(168, 85, 247, 0.6)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!e.currentTarget.disabled) {
                    e.currentTarget.style.backgroundColor = '#121218';
                    e.currentTarget.style.borderColor = '#a855f7';
                  }
                }}
              >
                <CheckCircle className="w-4 h-4 mr-1.5" />
                SETTLE WITH PROOF
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

