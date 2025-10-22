"use client";

import React, { useState } from "react";
import { useAccount, useWriteContract, useWaitForTransactionReceipt, useReadContract } from "wagmi";
import { ORDERBOOK_ADDRESS, ESCROW_ORDERBOOK_ABI, REGISTRY_ADDRESS, PROJECT_REGISTRY_ABI, ERC20_ABI } from "@/lib/contracts";
import { Button } from "./ui/Button";
import { Input } from "./ui/Input";
import { Badge } from "./ui/Badge";
import { Clock, PlayCircle, Plus, CheckCircle, AlertCircle } from "lucide-react";
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
    settlementDeadline: bigint;
    proof?: string;
  };
  isOwner: boolean;
  projectSlug?: string; // Optional: if we know the project slug
}

export function TGEOrderControls({ order, isOwner }: TGEOrderControlsProps) {
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

  // Get the actual token address from the contract
  // Fetch actual token address (for Token projects post-TGE)
  // The mapping is actualTokenAddress[orderId], NOT actualTokenAddress[projectToken]
  const { data: actualTokenAddress } = useReadContract({
    address: ORDERBOOK_ADDRESS,
    abi: ESCROW_ORDERBOOK_ABI,
    functionName: "actualTokenAddress",
    args: [order.id],
  });

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

  const hasApproval = tokenAllowance && order.amount ? (tokenAllowance as bigint) >= (order.amount as bigint) : false;

  // Get project's assetType from the order's projectToken
  // We'll use a simple mapping approach - check against known project addresses
  // In a real implementation, you'd query the registry or pass this info down
  const [projectAssetType, setProjectAssetType] = useState<string | null>(null);

  // Fetch all slugs and find matching project
  const { data: allSlugs } = useReadContract({
    address: REGISTRY_ADDRESS,
    abi: PROJECT_REGISTRY_ABI,
    functionName: "getAllSlugs",
  });

  // Use the first slug to read a project and check if it matches
  React.useEffect(() => {
    const findProjectType = async () => {
      if (!allSlugs || (allSlugs as string[]).length === 0) return;
      
      // Try each slug to find the matching project
      for (const slug of allSlugs as string[]) {
        try {
          // Use a simple approach: check via publicClient if we had it, or just use known addresses
          // For now, we'll use a hardcoded mapping based on deployment
          // You can improve this by reading from contract
          const knownProjects: Record<string, string> = {
            "0x000000000000000000000000006C696768746572": "Points",
            "0x0000000000000000000000657874656e64656400": "Points", 
            "0x0000000000000000000000007061636966696361": "Tokens",
            "0x0000000076617269617469006f6E616c00000000": "Tokens",
            "0x7465737400000000000000000000000000000000": "Tokens", // test project
            "0x706f696e74737465737400000000000000000000": "Points", // pointstest project
          };
          
          const assetType = knownProjects[order.projectToken?.toLowerCase()];
          if (assetType) {
            setProjectAssetType(assetType);
            return;
          }
        } catch (error) {
          console.error("Error finding project:", error);
        }
      }
    };

    findProjectType();
  }, [allSlugs, order.projectToken]);

  const isTokenProject = projectAssetType === "Tokens";
  const isPointsProject = projectAssetType === "Points";

  const isSeller = address && order.seller && address.toLowerCase() === order.seller.toLowerCase();
  const isBuyer = address && order.buyer && address.toLowerCase() === order.buyer.toLowerCase();

  // V3 Status: 0=OPEN, 1=FUNDED, 2=TGE_ACTIVATED, 3=SETTLED, 4=DEFAULTED, 5=CANCELED
  const status = Number(order.status);
  const deadline = order.settlementDeadline ? Number(order.settlementDeadline) * 1000 : 0;
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
      args: [ORDERBOOK_ADDRESS, order.amount],
    });
  };

  const handleDepositTokens = () => {
    if (!confirm(`Deposit tokens for order #${order.id}?`)) {
      return;
    }

    writeContract({
      address: ORDERBOOK_ADDRESS,
      abi: ESCROW_ORDERBOOK_ABI,
      functionName: "depositTokensForSettlement",
      args: [order.id],
    });
  };

  const handleClaimTokens = () => {
    if (!confirm(`Claim tokens for order #${order.id}?`)) {
      return;
    }

    writeContract({
      address: ORDERBOOK_ADDRESS,
      abi: ESCROW_ORDERBOOK_ABI,
      functionName: "claimTokens",
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

  const handleSubmitProof = () => {
    if (!proof || proof.trim().length === 0) {
      toast.error("Invalid proof", "Please enter proof (transaction hash, screenshot link, etc.)");
      return;
    }

    // Show confirmation modal
    setShowProofConfirmModal(true);
  };

  const confirmSubmitProof = () => {
    toast.info("⏳ Submitting proof...", "Transaction pending");

    writeContract({
      address: ORDERBOOK_ADDRESS,
      abi: ESCROW_ORDERBOOK_ABI,
      functionName: "submitProof",
      args: [order.id, proof],
    });
    
    setShowProofConfirmModal(false);
    setShowProofInput(false);
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

  // Don't show anything for completed/canceled/expired orders
  if (status >= 4) return null;

  return (
    <div className="space-y-2">
      {/* Status Messages - Only show transaction status, not settlement status (already shown at top) */}
      {isPending && <p className="text-xs text-blue-400">⏳ Confirming transaction...</p>}
      {isConfirming && <p className="text-xs text-blue-400">⏳ Waiting for confirmation...</p>}
      {isSuccess && <p className="text-xs text-green-400">✅ Transaction confirmed!</p>}
      {isError && <p className="text-xs text-red-400">❌ Error: {error?.message}</p>}

      {/* Admin Controls - Activate TGE (TOKENS ONLY) */}
      {isOwner && isTokenProject && (status === 0 || status === 1) && (
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
      {isOwner && status === 2 && !order.tokensDeposited && (
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
      {isOwner && submittedProof && (submittedProof as string).length > 0 && status === 2 && (
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
      {isSeller && isPointsProject && status === 2 && !submittedProof && (
        <>
          {!showProofInput ? (
            <Button
              onClick={() => setShowProofInput(true)}
              variant="custom"
              className="bg-purple-600 hover:bg-purple-700 border border-purple-500/30 text-xs h-8 w-auto"
              disabled={isPending || isConfirming}
            >
              <CheckCircle className="w-3 h-3 mr-1" />
              Submit Proof
            </Button>
          ) : (
            <div className="flex items-end gap-2">
              <div className="flex-1">
                <label className="text-xs text-zinc-400 mb-1 block">Proof (tx hash, link, etc.)</label>
                <Input
                  placeholder="0x... or screenshot link"
                  value={proof}
                  onChange={(e) => setProof(e.target.value)}
                  className="text-xs h-8"
                />
              </div>
              <Button
                onClick={handleSubmitProof}
                disabled={isPending || isConfirming || !proof}
                variant="custom"
                className="bg-purple-600 hover:bg-purple-700 border border-purple-500/30 text-xs h-8"
              >
                Submit
              </Button>
              <Button
                onClick={() => setShowProofInput(false)}
                variant="custom"
                className="bg-zinc-700 hover:bg-zinc-600 text-xs h-8"
              >
                Cancel
              </Button>
            </div>
          )}
        </>
      )}

      {/* Proof Submitted - Show to Seller (POINTS ONLY) */}
      {isSeller && isPointsProject && submittedProof && (submittedProof as string).length > 0 && status === 2 && (
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
      {isSeller && isTokenProject && status === 2 && !order.tokensDeposited && !isOverdue && (
        <div className="space-y-2">
          {!hasApproval ? (
            <div>
              <Button
                onClick={handleApproveTokens}
                disabled={isPending || isConfirming || !actualTokenAddress}
                variant="custom"
                className="bg-cyan-600 hover:bg-cyan-700 border border-cyan-500/30 text-[11px] h-7 w-full"
              >
                <CheckCircle className="w-3 h-3 mr-1" />
                1. Approve Tokens
              </Button>
              {isConfirming && (
                <p className="text-xs text-blue-400 mt-1">⏳ Confirming approval...</p>
              )}
            </div>
          ) : (
            <Button
              onClick={handleDepositTokens}
              disabled={isPending || isConfirming}
              variant="custom"
              className="bg-blue-600 hover:bg-blue-700 border border-blue-500/30 text-[11px] h-7 w-full"
            >
              <CheckCircle className="w-3 h-3 mr-1" />
              2. Deposit Tokens
            </Button>
          )}
          {hasApproval && (
            <p className="text-xs text-green-400">✓ Tokens approved - ready to deposit</p>
          )}
        </div>
      )}

      {/* Buyer Controls - Claim or Default */}
      {isBuyer && status === 3 && (
        <Button
          onClick={handleClaimTokens}
          disabled={isPending || isConfirming}
          variant="custom"
          className="bg-green-600 hover:bg-green-700 border border-green-500/30 text-xs h-8"
        >
          <CheckCircle className="w-3 h-3 mr-1" />
          Claim Tokens
        </Button>
      )}
      {isBuyer && status === 2 && isOverdue && !order.tokensDeposited && (
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
      {isBuyer && isPointsProject && status === 2 && submittedProof && (submittedProof as string).length > 0 && (
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

      {/* Proof Submission Confirmation Modal */}
      {showProofConfirmModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="max-w-md w-full mx-4 p-6 bg-zinc-900 border border-red-500/30 rounded-lg">
            <div className="mb-4">
              <div className="flex items-center gap-2 mb-2">
                <AlertCircle className="w-6 h-6 text-red-400" />
                <h3 className="text-xl font-bold text-red-400">⚠️ WARNING</h3>
              </div>
              <p className="text-sm text-zinc-300 mb-3">
                You are about to submit proof of token transfer. Please verify the following:
              </p>
            </div>

            <div className="space-y-3 mb-6 bg-red-950/20 border border-red-500/30 rounded p-3">
              <div className="flex items-start gap-2 text-sm">
                <CheckCircle className="w-4 h-4 text-yellow-400 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-medium text-yellow-400">Buyer Address (Recipient)</p>
                  <p className="text-zinc-400 font-mono text-xs break-all">{order.buyer}</p>
                </div>
              </div>

              <div className="flex items-start gap-2 text-sm">
                <CheckCircle className="w-4 h-4 text-cyan-400 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-medium text-cyan-400">Your Proof</p>
                  <p className="text-zinc-300 text-xs break-all">{proof}</p>
                </div>
              </div>

              <div className="border-t border-red-500/30 pt-3 mt-3">
                <p className="text-xs text-red-300 font-semibold">
                  ⚠️ If this proof is incorrect or fraudulent:
                </p>
                <ul className="text-xs text-red-200 mt-2 space-y-1 pl-4">
                  <li>• The buyer can report it to the admin</li>
                  <li>• The admin will verify the proof</li>
                  <li>• <span className="font-bold text-red-400">You will LOSE your collateral + buyer gets their payment back</span></li>
                </ul>
              </div>
            </div>

            <div className="flex gap-3">
              <Button
                onClick={() => {
                  setShowProofConfirmModal(false);
                }}
                variant="custom"
                className="flex-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 h-8 text-sm"
              >
                Cancel
              </Button>
              <Button
                onClick={confirmSubmitProof}
                variant="custom"
                className="flex-1 bg-gradient-to-r from-red-600 to-orange-600 hover:from-red-700 hover:to-orange-700 font-semibold h-8 text-sm"
              >
                <CheckCircle className="w-3.5 h-3.5 mr-1.5" />
                Confirm and Submit
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

