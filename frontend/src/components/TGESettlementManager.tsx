"use client";

import { useState } from "react";
import { useReadContract, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { ORDERBOOK_ADDRESS, ESCROW_ORDERBOOK_ABI } from "@/lib/contracts";
import { Card } from "./ui/Card";
import { Button } from "./ui/Button";
import { Input } from "./ui/Input";
import { Badge } from "./ui/Badge";
import { Clock, PlayCircle, Plus, CheckCircle, AlertTriangle } from "lucide-react";
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

// V3 Status Names
const STATUS_NAMES = ["OPEN", "FUNDED", "TGE_ACTIVATED", "SETTLED", "DEFAULTED", "CANCELED"];

export function TGESettlementManager({ orders, assetType }: { orders: Order[]; assetType: string }) {
  const [selectedOrder, setSelectedOrder] = useState<bigint | null>(null);
  const [batchTokenAddress, setBatchTokenAddress] = useState("");
  const [tokenAddress, setTokenAddress] = useState("");
  const [conversionRatio, setConversionRatio] = useState("1.0"); // Points to tokens ratio
  const [extensionHours, setExtensionHours] = useState<4 | 24>(4);
  const [showIndividualOrders, setShowIndividualOrders] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  
  // Both Points and Tokens need TGE activation when the token launches
  // Points: seller sends tokens directly to buyer, then submits proof for admin to verify
  // Tokens: seller deposits to contract, buyer claims from contract
  const isPointsProject = assetType === "Points";

  const { writeContract, data: hash, isPending, isError, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });
  const toast = useToast();

  // Show all orders - let admin decide which to activate
  // V3 Status: 0=OPEN, 1=FUNDED, 2=TGE_ACTIVATED, 3=SETTLED, 4=DEFAULTED, 5=CANCELED
  const fundedOrders = orders.filter((o) => o.status === 1); // Only FUNDED orders for batch activation
  const eligibleOrders = orders.filter((o) => o.status <= 2); // OPEN, FUNDED, or already TGE_ACTIVATED
  const tgeOrders = orders.filter((o) => o.status === 2); // Already activated

  const handleBatchActivateTGE = () => {
    // For Points projects without on-chain tokens, allow empty address
    // We'll use a placeholder address (0x0...dead) to indicate off-chain settlement
    const isOffChainSettlement = isPointsProject && !batchTokenAddress;
    const tokenAddr = isOffChainSettlement 
      ? "0x000000000000000000000000000000000000dead" 
      : batchTokenAddress;

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
    // POINTS_SENTINEL = address(uint160(uint256(keccak256("otcX.POINTS_SENTINEL.v4"))))
    const POINTS_SENTINEL = "0x602EE57D45A64a39E996Fa8c78B3BC88B4D107E2";
    const isOffChainSettlement = isPointsProject && !batchTokenAddress;
    const tokenAddr = isOffChainSettlement 
      ? POINTS_SENTINEL 
      : batchTokenAddress;
    
    // Parse and validate conversion ratio
    const ratio = parseFloat(conversionRatio);
    if (isNaN(ratio) || ratio <= 0) {
      toast.error("Invalid conversion ratio", "Conversion ratio must be a positive number");
      return;
    }
    
    // Validate ratio range (max 10:1)
    if (ratio > 10) {
      toast.error("Conversion ratio too high", "Maximum ratio is 10:1 (1 point = 10 tokens)");
      return;
    }
    
    // Convert to 18 decimals (e.g., 1.2 -> 1.2e18)
    const ratioBigInt = BigInt(Math.floor(ratio * 1e18));
    
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

  const handleExtendSettlement = (orderId: bigint, hours: 4 | 24) => {
    if (!confirm(`Extend settlement for order #${orderId} by ${hours} hours?`)) {
      return;
    }

    writeContract({
      address: ORDERBOOK_ADDRESS,
      abi: ESCROW_ORDERBOOK_ABI,
      functionName: "extendSettlement",
      args: [orderId, BigInt(hours)],
    });
  };

  const handleManualSettle = (orderId: bigint) => {
    if (!confirm(`Manually settle order #${orderId}?\nThis should only be used for Points after off-chain verification.`)) {
      return;
    }

    writeContract({
      address: ORDERBOOK_ADDRESS,
      abi: ESCROW_ORDERBOOK_ABI,
      functionName: "manualSettle",
      args: [orderId],
    });
  };

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
    <Card className="border-violet-800/30 bg-violet-950/10">
      <div className="flex items-center gap-3 mb-6">
        <Clock className="w-6 h-6 text-violet-400" />
        <div>
          <h3 className="text-lg font-bold text-violet-400">TGE Settlement Management</h3>
          <p className="text-sm text-zinc-400">Activate TGE when the token launches</p>
        </div>
      </div>

      {/* Status Messages */}
      {isPending && (
        <div className="mb-4 p-3 bg-blue-950/30 border border-blue-800/30 rounded-lg">
          <p className="text-sm text-blue-400">⏳ Confirming transaction...</p>
        </div>
      )}
      {isConfirming && (
        <div className="mb-4 p-3 bg-blue-950/30 border border-blue-800/30 rounded-lg">
          <p className="text-sm text-blue-400">⏳ Waiting for confirmation...</p>
        </div>
      )}
      {isSuccess && (
        <div className="mb-4 p-3 bg-green-950/30 border border-green-800/30 rounded-lg">
          <p className="text-sm text-green-400">✅ Transaction confirmed! Refresh to see updated status.</p>
        </div>
      )}
      {isError && (
        <div className="mb-4 p-3 bg-red-950/30 border border-red-800/30 rounded-lg">
          <p className="text-sm text-red-400">❌ Error: {error?.message}</p>
        </div>
      )}

      {/* V4: Project-Level TGE Activation - Single Global Command */}
      <div className="mb-6 p-6 bg-gradient-to-br from-green-950/30 to-violet-950/30 border border-green-800/30 rounded-lg">
        <h4 className="text-lg font-bold text-green-400 mb-2 flex items-center gap-2">
          <PlayCircle className="w-5 h-5" />
          Activate Project TGE
        </h4>
        <p className="text-sm text-zinc-400 mb-4">
          Set global TGE flag for this project. All {fundedOrders.length} funded order(s) will become settleable.
        </p>
        
        {fundedOrders.length === 0 ? (
          <div className="p-4 bg-zinc-900/50 border border-zinc-800 rounded-lg">
            <p className="text-sm text-zinc-500 mb-2">No funded orders ready for TGE activation</p>
            <p className="text-xs text-zinc-600">Orders must have both buyer and seller collateral locked (FUNDED status)</p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-end gap-3">
              <div className="flex-1">
                <label className="text-sm text-zinc-300 mb-2 block font-medium">
                  Actual Token Address {isPointsProject && <span className="text-zinc-500 font-normal">(optional for off-chain settlement)</span>}
                </label>
                <Input
                  placeholder={isPointsProject ? "0x... (or leave empty for off-chain settlement)" : "0x... (deployed token contract)"}
                  value={batchTokenAddress}
                  onChange={(e) => setBatchTokenAddress(e.target.value)}
                  className="text-sm"
                />
              </div>
              <div className="w-48">
                <label className="text-sm text-zinc-300 mb-2 block font-medium">
                  Conversion Ratio {!isPointsProject && <span className="text-zinc-500 font-normal">(must be 1.0)</span>}
                </label>
                <Input
                  type="number"
                  step="0.01"
                  min="0.01"
                  max="10"
                  placeholder={isPointsProject ? "e.g., 1.2" : "1.0"}
                  value={conversionRatio}
                  onChange={(e) => setConversionRatio(e.target.value)}
                  className="text-sm"
                  disabled={!isPointsProject}
                />
                {isPointsProject && (
                  <p className="text-xs text-zinc-500 mt-1">Max: 10:1 (1 point = 10 tokens)</p>
                )}
              </div>
              <Button
                onClick={handleBatchActivateTGE}
                disabled={isPending || isConfirming}
                variant="custom"
                className="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 border-2 border-green-500/50 shadow-lg shadow-green-500/20 px-6 h-[42px]"
              >
                <PlayCircle className="w-5 h-5 mr-2" />
                Activate Project TGE
              </Button>
            </div>
            
            {isPointsProject && (
              <div className="p-3 bg-blue-900/20 border border-blue-500/30 rounded-lg">
                <div className="flex items-start gap-2 text-xs text-blue-300">
                  <AlertTriangle className="w-4 h-4 text-blue-400 mt-0.5" />
                  <div>
                    <p className="font-medium mb-1">Points Project Settlement</p>
                    <p className="text-blue-400/80 mb-2">
                      <strong>Option 1 (On-chain):</strong> Enter token address if token is deployed on Sepolia
                    </p>
                    <p className="text-blue-400/80">
                      <strong>Option 2 (Off-chain):</strong> Leave empty → Seller sends tokens directly to buyer → Submits proof → Admin manually settles
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Individual Orders - Advanced/Exception Cases */}
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
                      <div className="mt-3 p-3 bg-blue-900/20 border border-blue-500/30 rounded-lg">
                        <div className="flex items-start gap-2 text-xs text-blue-300">
                          <AlertTriangle className="w-4 h-4 text-blue-400 mt-0.5" />
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

      {/* Active TGE Orders - Can Extend */}
      <div>
        <h4 className="text-md font-bold text-zinc-300 mb-3 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4" />
          Active Settlement Windows ({tgeOrders.length})
        </h4>
        {tgeOrders.length === 0 ? (
          <p className="text-sm text-zinc-500">No active settlement windows</p>
        ) : (
          <div className="space-y-3">
            {tgeOrders.map((order) => (
              <div key={order.id.toString()} className="p-4 bg-zinc-900/50 rounded-lg border border-orange-800/30">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-bold text-zinc-300">Order #{order.id.toString()}</span>
                      <Badge className="bg-orange-600">TGE ACTIVE</Badge>
                      {order.tokensDeposited && (
                        <Badge className="bg-green-600">TOKENS DEPOSITED</Badge>
                      )}
                    </div>
                    <p className="text-xs text-orange-400 font-medium">
                      {formatDeadline(order.settlementDeadline)}
                    </p>
                  </div>
                </div>

                {!order.tokensDeposited && (
                  <div className="space-y-3">
                    {/* Extension buttons for all projects */}
                    <div className="flex gap-3">
                      <Button
                        onClick={() => handleExtendSettlement(order.id, 4)}
                        disabled={isPending || isConfirming}
                        variant="custom"
                        className="bg-cyan-600 hover:bg-cyan-700 border border-cyan-500/30"
                      >
                        <Plus className="w-4 h-4 mr-1" />
                        +4 Hours
                      </Button>
                      <Button
                        onClick={() => handleExtendSettlement(order.id, 24)}
                        disabled={isPending || isConfirming}
                        variant="custom"
                        className="bg-violet-600 hover:bg-violet-700 border border-violet-500/30"
                      >
                        <Plus className="w-4 h-4 mr-1" />
                        +24 Hours
                      </Button>
                    </div>
                    
                    {/* Manual settlement for Points projects */}
                    {isPointsProject && (
                      <div className="space-y-2">
                        <div className="p-3 bg-purple-900/20 border border-purple-500/30 rounded">
                          <div className="flex items-center gap-2 mb-2">
                            <AlertTriangle className="w-4 h-4 text-purple-400" />
                            <p className="text-xs font-semibold text-purple-300">
                              {order.proof ? "Submitted Proof" : "Waiting for seller to submit proof"}
                            </p>
                          </div>
                          {order.proof && (
                            <p className="text-xs text-purple-200 bg-purple-950/50 p-2 rounded font-mono break-all">
                              {order.proof}
                            </p>
                          )}
                        </div>
                        <Button
                          onClick={() => handleManualSettle(order.id)}
                          disabled={isPending || isConfirming || !order.proof}
                          variant="custom"
                          className="w-full bg-purple-600 hover:bg-purple-700 border border-purple-500/30"
                          title={order.proof ? "Verify proof and settle" : "Seller must submit proof first"}
                        >
                          <CheckCircle className="w-4 h-4 mr-1" />
                          {order.proof ? "Verify & Settle" : "Awaiting Proof"}
                        </Button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Confirmation Modal */}
      {showConfirmModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50">
          <Card className="max-w-md w-full mx-4 p-6 bg-zinc-900 border-cyan-500/30">
            <div className="mb-4">
              <h3 className="text-xl font-bold text-white mb-2">Activate Project TGE</h3>
              <p className="text-sm text-zinc-400 mb-3">
                Set global TGE flag for this entire project. This enables settlement for <span className="font-semibold text-cyan-400">{fundedOrders.length}</span> funded order(s).
              </p>
              <div className="p-3 bg-violet-950/30 border border-violet-500/30 rounded-lg">
                <p className="text-xs text-violet-300">
                  <strong>V4 Change:</strong> This is a <strong>single global command</strong> - not a batch operation. Once activated, anyone can permissionlessly settle individual orders.
                </p>
              </div>
            </div>

            <div className="space-y-3 mb-6">
              <div className="flex items-start gap-2 text-sm">
                <Clock className="w-4 h-4 text-blue-400 mt-0.5" />
                <div>
                  <p className="font-medium text-blue-400">Settlement Window</p>
                  <p className="text-zinc-400">Opens a 4-hour window for anyone to settle orders</p>
                </div>
              </div>

              <div className="flex items-start gap-2 text-sm">
                <CheckCircle className="w-4 h-4 text-green-400 mt-0.5" />
                <div>
                  <p className="font-medium text-green-400">Settlement Type</p>
                  {isPointsProject && !batchTokenAddress ? (
                    <p className="text-zinc-400">Off-chain settlement (proof-based)</p>
                  ) : (
                    <div className="text-zinc-400">
                      <p>On-chain settlement</p>
                      <p className="text-xs text-cyan-400 font-mono mt-1">{batchTokenAddress}</p>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex items-start gap-2 text-sm">
                <CheckCircle className="w-4 h-4 text-purple-400 mt-0.5" />
                <div>
                  <p className="font-medium text-purple-400">Conversion Ratio</p>
                  <p className="text-zinc-400">
                    {isPointsProject ? (
                      <>1 Point = <span className="text-purple-300 font-semibold">{conversionRatio}</span> Tokens</>
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
                className="flex-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-300"
              >
                Cancel
              </Button>
              <Button
                onClick={confirmBatchActivate}
                variant="custom"
                className="flex-1 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-700 hover:to-blue-700"
              >
                <PlayCircle className="w-4 h-4 mr-2" />
                Activate Project TGE
              </Button>
            </div>
          </Card>
        </div>
      )}
    </Card>
  );
}

