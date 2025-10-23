"use client";

import React, { useState } from "react";
import { useAccount, useWriteContract, useWaitForTransactionReceipt, useReadContract } from "wagmi";
import { ORDERBOOK_ADDRESS, ESCROW_ORDERBOOK_ABI, REGISTRY_ADDRESS, PROJECT_REGISTRY_ABI, ERC20_ABI } from "@/lib/contracts";
import { Button } from "./ui/Button";
import { Input } from "./ui/Input";
import { Badge } from "./ui/Badge";
import { Clock, PlayCircle, Plus, CheckCircle, AlertCircle, DollarSign } from "lucide-react";
import { useToast } from "./Toast";

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
  const [tokenAddress, setTokenAddress] = useState("");
  const [showTGEInput, setShowTGEInput] = useState(false);
  const [proof, setProof] = useState("");
  const [showProofInput, setShowProofInput] = useState(false);
  const [showProofConfirmModal, setShowProofConfirmModal] = useState(false);

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

  // V4: Determine project type from token address read from contract
  // POINTS_SENTINEL = address(uint160(uint256(keccak256("otcX.POINTS_SENTINEL.v4"))))
  const POINTS_SENTINEL = "0x602EE57D45A64a39E996Fa8c78B3BC88B4D107E2";
  const isPointsProject = projectTokenAddress && 
    (projectTokenAddress as string).toLowerCase() === POINTS_SENTINEL.toLowerCase();
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
    alert("V4 uses project-level TGE activation. Please use the admin panel to activate TGE for all orders in this project.");
    return;
  };

  const handleExtendSettlement = (hours: 4 | 24) => {
    if (!confirm(`Extend settlement for order #${order.id} by ${hours} hours?`)) {
      return;
    }

    writeContract({
      address: ORDERBOOK_ADDRESS,
      abi: ESCROW_ORDERBOOK_ABI,
      functionName: "extendSettlement",
      args: [order.id, BigInt(hours)],
    });
  };

  const handleApproveTokens = () => {
    if (!actualTokenAddress) {
      alert("Token address not found. Please wait for TGE activation.");
      return;
    }

    writeContract({
      address: actualTokenAddress as `0x${string}`,
      abi: ERC20_ABI,
      functionName: "approve",
      args: [ORDERBOOK_ADDRESS, actualTokenAmountBigInt],
    });
  };

  const handleSettleOrder = () => {
    if (!confirm(`Settle order #${order.id}?\nThis will transfer tokens and complete the settlement.`)) {
      return;
    }

    writeContract({
      address: ORDERBOOK_ADDRESS,
      abi: ESCROW_ORDERBOOK_ABI,
      functionName: "settleOrder",
      args: [order.id],
    });
  };

  const handleDefaultSeller = () => {
    if (!confirm(`Default seller for order #${order.id}?\nYou will receive your payment back + seller's collateral.`)) {
      return;
    }

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

    toast.info("⏳ Submitting proof...", "Transaction pending");

    writeContract({
      address: ORDERBOOK_ADDRESS,
      abi: ESCROW_ORDERBOOK_ABI,
      functionName: "submitProof",
      args: [order.id, proof],
    });
    
    setShowProofConfirmModal(false);
    setProof("");
  };

  const handleManualSettle = () => {
    if (!confirm(`Manually settle order #${order.id}?\nMake sure you've verified the proof first!`)) {
      return;
    }

    writeContract({
      address: ORDERBOOK_ADDRESS,
      abi: ESCROW_ORDERBOOK_ABI,
      functionName: "manualSettle",
      args: [order.id],
    });
  };

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
      {/* Status Messages - Only show transaction status, not settlement status (already shown at top) */}
      {isPending && <p className="text-xs text-blue-400">⏳ Confirming transaction...</p>}
      {isConfirming && <p className="text-xs text-blue-400">⏳ Waiting for confirmation...</p>}
      {isSuccess && <p className="text-xs text-green-400">✅ Transaction confirmed!</p>}
      {isError && <p className="text-xs text-red-400">❌ Error: {error?.message}</p>}

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

      {/* Proof Display - Show to Admin */}
      {isOwner && submittedProof && (submittedProof as string).length > 0 && isInSettlement && (
        <div className="bg-purple-950/30 border border-purple-800/30 rounded-lg p-3">
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle className="w-4 h-4 text-purple-400" />
            <span className="text-xs font-bold text-purple-400">Proof Submitted</span>
            {proofTimestamp && (
              <span className="text-xs text-zinc-500">
                {new Date(Number(proofTimestamp) * 1000).toLocaleString()}
              </span>
            )}
          </div>
          <div className="bg-zinc-900/50 rounded p-2 mb-2">
            <p className="text-xs text-zinc-300 break-all">{submittedProof as string}</p>
          </div>
          <Button
            onClick={handleManualSettle}
            variant="custom"
            className="bg-purple-600 hover:bg-purple-700 border border-purple-500/30 text-xs h-8 w-full"
            disabled={isPending || isConfirming}
          >
            <CheckCircle className="w-3 h-3 mr-1" />
            Verify & Settle
          </Button>
        </div>
      )}

      {/* Seller Controls - Submit Proof (POINTS ONLY) */}
      {isSeller && isPointsProject && isInSettlement && !submittedProof && (
        <Button
          onClick={() => setShowProofConfirmModal(true)}
          variant="custom"
          className="bg-purple-600 hover:bg-purple-700 border border-purple-500/30 text-xs h-8 w-auto"
          disabled={isPending || isConfirming}
        >
          <CheckCircle className="w-3 h-3 mr-1" />
          Submit Proof
        </Button>
      )}

      {/* Proof Submitted - Show to Seller (POINTS ONLY) */}
      {isSeller && isPointsProject && submittedProof && (submittedProof as string).length > 0 && isInSettlement && (
        <div className="bg-green-950/30 border border-green-800/30 rounded-lg p-3">
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle className="w-4 h-4 text-green-400" />
            <span className="text-xs font-bold text-green-400">Proof Submitted - Awaiting Admin Review</span>
          </div>
          <div className="bg-zinc-900/50 rounded p-2">
            <p className="text-xs text-zinc-300 break-all">{submittedProof as string}</p>
          </div>
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
                    <div className="w-3 h-3 mr-1 border-2 border-white border-t-transparent rounded-full animate-spin" />
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
                  <div className="w-3 h-3 mr-1 border-2 border-white border-t-transparent rounded-full animate-spin" />
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
      {isBuyer && isPointsProject && isInSettlement && submittedProof && (submittedProof as string).length > 0 && (
        <div className="bg-blue-950/30 border border-blue-800/30 rounded-lg p-3">
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle className="w-4 h-4 text-blue-400" />
            <span className="text-xs font-bold text-blue-400">Seller Submitted Proof</span>
          </div>
          <div className="bg-zinc-900/50 rounded p-2">
            <p className="text-xs text-zinc-300 break-all font-mono">{submittedProof as string}</p>
          </div>
          <p className="text-xs text-zinc-400 mt-2">
            ⏳ Waiting for admin to verify and settle this order
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
                  <p className="font-medium text-yellow-400">Buyer Address (Recipient)</p>
                  <p className="text-zinc-300 font-mono text-xs break-all bg-zinc-950/50 p-2 rounded mt-1">
                    {order.buyer}
                  </p>
                </div>
              </div>
            </div>

            {/* Proof Input */}
            <div className="mb-4">
              <label className="text-sm font-medium text-zinc-300 mb-2 block">
                Proof of Transfer (Transaction Link or Hash)
              </label>
              <Input
                placeholder="0x... or block explorer link"
                value={proof}
                onChange={(e) => setProof(e.target.value)}
                className="text-sm"
              />
            </div>

            {/* Warning */}
            <div className="bg-red-950/20 border border-red-500/30 rounded p-3 mb-4">
              <p className="text-xs text-red-300 font-semibold mb-2">
                ⚠️ Important Warning
              </p>
              <ul className="text-xs text-red-200 space-y-1 pl-4">
                <li>• Ensure you've transferred the exact amount to the correct address</li>
                <li>• The admin will verify your proof before releasing funds</li>
                <li>• <span className="font-bold text-red-400">Fraudulent proof = You LOSE your collateral</span></li>
              </ul>
            </div>

            <div className="flex gap-3">
              <Button
                onClick={() => {
                  setShowProofConfirmModal(false);
                  setProof("");
                }}
                variant="custom"
                className="flex-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 h-9 text-sm"
              >
                Cancel
              </Button>
              <Button
                onClick={confirmSubmitProof}
                disabled={!proof || proof.trim().length === 0}
                variant="custom"
                className="flex-1 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 font-semibold h-9 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <CheckCircle className="w-4 h-4 mr-1.5" />
                Submit Proof
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

