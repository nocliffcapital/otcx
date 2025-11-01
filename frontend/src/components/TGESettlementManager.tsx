"use client";

import { useState, useEffect } from "react";
import { useReadContract, useWriteContract, useWaitForTransactionReceipt, usePublicClient } from "wagmi";
import { ORDERBOOK_ADDRESS, ESCROW_ORDERBOOK_ABI } from "@/lib/contracts";
import { Card } from "./ui/Card";
import { Button } from "./ui/Button";
import { Input } from "./ui/Input";
import { Badge } from "./ui/Badge";
import { Clock, PlayCircle, Plus, CheckCircle, AlertTriangle, XCircle, CheckSquare, Square, X } from "lucide-react";
import { useToast } from "./Toast";

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

// V3 Status Names (V4: status at different index due to allowedTaker field)
const STATUS_NAMES = ["OPEN", "FUNDED", "SETTLED", "DEFAULTED", "CANCELED"];

export function TGESettlementManager({ orders, assetType, projectName }: { orders: Order[]; assetType: string; projectName?: string }) {
  const [selectedOrder, setSelectedOrder] = useState<bigint | null>(null);
  const [batchTokenAddress, setBatchTokenAddress] = useState("");
  const [tokenAddress, setTokenAddress] = useState("");
  const [conversionRatio, setConversionRatio] = useState("1.0"); // Points to tokens ratio
  const [extensionHours, setExtensionHours] = useState<4 | 24>(4);
  const [showIndividualOrders, setShowIndividualOrders] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [showProofManager, setShowProofManager] = useState(true);
  const [selectedOrderIds, setSelectedOrderIds] = useState<Set<bigint>>(new Set());
  const [proofStatuses, setProofStatuses] = useState<Record<string, ProofStatus>>({});
  const [rejectReason, setRejectReason] = useState("");
  const [rejectingOrderId, setRejectingOrderId] = useState<bigint | null>(null);
  
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

  // Fetch proof acceptance statuses for all orders with proofs
  useEffect(() => {
    const fetchProofStatuses = async () => {
      if (!publicClient) return;
      
      const ordersWithProofs = orders.filter(o => o.proof);
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
  }, [orders, publicClient, isSuccess]); // Refetch after successful transactions

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
  const ordersWithPendingProofs = ordersWithProofs.filter((o) => !proofStatuses[o.id.toString()]?.accepted);
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

    console.log('🚀 V4 Project TGE activation:', { projectToken, tokenAddr, settlementWindow: 14400, conversionRatio: ratioBigInt.toString(), isOffChain: isOffChainSettlement });
    
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
            <div className="flex items-start gap-3">
              <div className="flex-1">
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
                ACTIVATE PROJECT TGE
              </Button>
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
                    onClick={handleBatchAcceptProofs}
                    disabled={selectedOrderIds.size === 0 || isPending || isConfirming}
                    variant="custom"
                    className="font-mono font-semibold uppercase border"
                    style={{ backgroundColor: '#22c55e', borderColor: '#22c55e', color: 'white', opacity: selectedOrderIds.size === 0 ? 0.5 : 1 }}
                  >
                    <CheckCircle className="w-4 h-4 mr-2" />
                    ACCEPT SELECTED ({selectedOrderIds.size})
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
                  <div className="space-y-3">
                    {ordersWithPendingProofs.map((order) => (
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
                            <div className="flex items-center gap-2 mb-2">
                              <span className="text-sm font-bold text-white font-mono">ORDER #{order.id.toString()}</span>
                              <Badge className="bg-yellow-950/30 border border-yellow-500/50 text-yellow-400 text-xs font-mono font-semibold uppercase">PENDING REVIEW</Badge>
                            </div>
                            
                            <div className="p-3 rounded border mb-3" style={{ backgroundColor: '#06060c', borderColor: '#2b2b30' }}>
                              <div className="text-xs font-semibold text-zinc-300 mb-1 font-mono">SUBMITTED PROOF:</div>
                              <p className="text-xs text-zinc-400 font-mono break-all">{order.proof}</p>
                            </div>

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
                                  disabled={isPending || isConfirming}
                                  variant="custom"
                                  className="font-mono font-semibold uppercase border"
                                  style={{ backgroundColor: '#22c55e', borderColor: '#22c55e', color: 'white' }}
                                >
                                  <CheckCircle className="w-4 h-4 mr-1" />
                                  ACCEPT PROOF
                                </Button>
                                <Button
                                  onClick={() => setRejectingOrderId(order.id)}
                                  disabled={isPending || isConfirming}
                                  variant="custom"
                                  className="font-mono font-semibold uppercase border"
                                  style={{ backgroundColor: '#121218', borderColor: '#ef4444', color: '#ef4444' }}
                                >
                                  <XCircle className="w-4 h-4 mr-1" />
                                  REJECT
                                </Button>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
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
              <div className="p-3 rounded border" style={{ backgroundColor: '#06060c', borderColor: '#2b2b30' }}>
                <p className="text-xs text-zinc-300 font-mono">
                  <strong>V4 CHANGE:</strong> This is a <strong>single global command</strong> - not a batch operation. Once activated, anyone can permissionlessly settle individual orders.
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

              <div className="flex items-start gap-2 text-sm">
                <CheckCircle className="w-4 h-4 text-zinc-300 mt-0.5" />
                <div>
                  <p className="font-semibold text-zinc-300 font-mono">CONVERSION RATIO</p>
                  <p className="text-zinc-400 text-xs font-mono">
                    {isPointsProject ? (
                      <>1 Point = <span className="text-white font-semibold">{conversionRatio}</span> Tokens</>
                    ) : (
                      <>1 Token = 1 Token (1:1)</>
                    )}
                  </p>
                </div>
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
                ACTIVATE PROJECT TGE
              </Button>
            </div>
          </Card>
        </div>
      )}
    </Card>
  );
}

