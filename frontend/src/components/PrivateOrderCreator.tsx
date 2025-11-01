"use client";

import { useState, useEffect } from "react";
import { Card } from "./ui/Card";
import { Button } from "./ui/Button";
import { Input } from "./ui/Input";
import { Badge } from "./ui/Badge";
import { Lock, Copy, Check, AlertCircle, User, Loader2, Info, XCircle } from "lucide-react";
import { parseUnits, formatUnits, isAddress } from "viem";
import { useToast } from "./Toast";
import { STABLE_DECIMALS, ORDERBOOK_ADDRESS, ESCROW_ORDERBOOK_ABI } from "@/lib/contracts";
import { usePublicClient } from "wagmi";

interface PrivateOrderCreatorProps {
  projectId: `0x${string}`;
  projectName: string;
  assetType: string;
  onCreateOrder: (params: {
    amount: bigint;
    unitPrice: bigint;
    projectId: `0x${string}`;
    isSell: boolean;
    allowedTaker: `0x${string}`;
  }) => Promise<{ orderId: bigint }>;
  isCreating: boolean;
}

export function PrivateOrderCreator({ 
  projectId, 
  projectName,
  assetType, 
  onCreateOrder,
  isCreating 
}: PrivateOrderCreatorProps) {
  const [side, setSide] = useState<"BUY" | "SELL">("SELL");
  const [amount, setAmount] = useState("");
  const [unitPrice, setUnitPrice] = useState("");
  const [allowedTaker, setAllowedTaker] = useState("");
  const [createdOrderId, setCreatedOrderId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [minOrderValue, setMinOrderValue] = useState<bigint>(100_000_000n); // Default $100
  const toast = useToast();
  const publicClient = usePublicClient();

  const isValidAddress = allowedTaker && isAddress(allowedTaker);
  const total = amount && unitPrice 
    ? (parseFloat(amount) * parseFloat(unitPrice)).toFixed(2)
    : "0.00";
  
  const totalValue = amount && unitPrice 
    ? parseFloat(amount) * parseFloat(unitPrice)
    : 0;
  const minValue = Number(minOrderValue) / 1e6; // Convert to USDC
  const isBelowMinimum = totalValue > 0 && totalValue < minValue;

  // Fetch minimum order value on mount
  useEffect(() => {
    const fetchMinOrderValue = async () => {
      if (!publicClient) return;
      try {
        const min = await publicClient.readContract({
          address: ORDERBOOK_ADDRESS,
          abi: ESCROW_ORDERBOOK_ABI,
          functionName: "minOrderValue",
        }) as bigint;
        setMinOrderValue(min);
      } catch (error) {
        console.error("Failed to fetch min order value:", error);
      }
    };
    fetchMinOrderValue();
  }, [publicClient]);

  const handleCreate = async () => {
    if (!amount || !unitPrice || !allowedTaker || !isValidAddress) {
      toast.error("Invalid input", "Please fill all fields with valid values");
      return;
    }

    try {
      const amountBigInt = parseUnits(amount, 18);
      const priceBigInt = parseUnits(unitPrice, STABLE_DECIMALS);

      const result = await onCreateOrder({
        amount: amountBigInt,
        unitPrice: priceBigInt,
        projectId,
        isSell: side === "SELL",
        allowedTaker: allowedTaker as `0x${string}`,
      });

      // Set the actual order ID from the transaction
      setCreatedOrderId(result.orderId.toString());
      
      toast.success(
        "🔒 Private order created!",
        `Only ${allowedTaker.slice(0, 6)}...${allowedTaker.slice(-4)} can take this order`
      );
    } catch (error) {
      console.error(error);
      toast.error(
        "Transaction failed",
        error?.message || "Unable to create private order"
      );
    }
  };

  const handleCopyLink = () => {
    if (!createdOrderId) return;
    const link = `${window.location.origin}/order/${createdOrderId}?taker=${allowedTaker}`;
    navigator.clipboard.writeText(link);
    setCopied(true);
    toast.success("Link copied!", "Share this link with the recipient");
    setTimeout(() => setCopied(false), 2000);
  };

  const handleReset = () => {
    setAmount("");
    setUnitPrice("");
    setAllowedTaker("");
    setCreatedOrderId(null);
    setCopied(false);
  };

  return (
    <Card>
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-1">
          <Lock className="w-4 h-4 text-zinc-300" />
          <h3 className="text-base font-bold text-zinc-100">Order Details</h3>
        </div>
        <p className="text-xs text-zinc-400">
          Specify order details and recipient address
        </p>
      </div>

      {!createdOrderId ? (
        <div className="space-y-4">
          {/* Side Selector */}
          <div>
            <label className="text-sm font-medium text-zinc-300 mb-2 block">
              Order Type
            </label>
            <div className="flex gap-2">
              <Button
                onClick={() => setSide("SELL")}
                variant="custom"
                className="flex-1 h-9 text-sm border font-mono font-semibold uppercase"
                style={{ 
                  backgroundColor: side === 'SELL' ? 'rgba(239, 68, 68, 0.25)' : '#121218', // Red background when selected
                  borderColor: side === 'SELL' ? '#ef4444' : '#2b2b30', // Red border when selected, gray when unselected
                  color: side === 'SELL' ? '#ef4444' : '#6b7280', // Red text when selected, muted gray when unselected
                  borderWidth: side === 'SELL' ? '2px' : '1px' // Thicker border when selected
                }}
                onMouseEnter={(e) => {
                  if (side !== 'SELL') { // Only apply hover to unselected button
                    e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.1)'; // Subtle red hover
                    e.currentTarget.style.borderColor = '#ef4444';
                    e.currentTarget.style.color = '#ef4444';
                  }
                }}
                onMouseLeave={(e) => {
                  if (side !== 'SELL') {
                    e.currentTarget.style.backgroundColor = '#121218';
                    e.currentTarget.style.borderColor = '#2b2b30';
                    e.currentTarget.style.color = '#6b7280';
                  }
                }}
              >
                SELL
              </Button>
              <Button
                onClick={() => setSide("BUY")}
                variant="custom"
                className="flex-1 h-9 text-sm border font-mono font-semibold uppercase"
                style={{ 
                  backgroundColor: side === 'BUY' ? 'rgba(34, 197, 94, 0.25)' : '#121218', // Green background when selected
                  borderColor: side === 'BUY' ? '#22c55e' : '#2b2b30', // Green border when selected, gray when unselected
                  color: side === 'BUY' ? '#22c55e' : '#6b7280', // Green text when selected, muted gray when unselected
                  borderWidth: side === 'BUY' ? '2px' : '1px' // Thicker border when selected
                }}
                onMouseEnter={(e) => {
                  if (side !== 'BUY') { // Only apply hover to unselected button
                    e.currentTarget.style.backgroundColor = 'rgba(34, 197, 94, 0.1)'; // Subtle green hover
                    e.currentTarget.style.borderColor = '#22c55e';
                    e.currentTarget.style.color = '#22c55e';
                  }
                }}
                onMouseLeave={(e) => {
                  if (side !== 'BUY') {
                    e.currentTarget.style.backgroundColor = '#121218';
                    e.currentTarget.style.borderColor = '#2b2b30';
                    e.currentTarget.style.color = '#6b7280';
                  }
                }}
              >
                BUY
              </Button>
            </div>
          </div>

          {/* Recipient Address */}
          <div>
            <label className="text-sm font-medium text-zinc-300 mb-2 block">
              Recipient Address <span className="text-red-400">*</span>
            </label>
            <div className="relative">
              <Input
                type="text"
                placeholder="0x..."
                value={allowedTaker}
                onChange={(e) => setAllowedTaker(e.target.value)}
                className={`font-mono text-sm ${
                  allowedTaker && !isValidAddress 
                    ? "border-red-500/50 focus:border-red-500" 
                    : "border-zinc-700"
                }`}
              />
              {allowedTaker && (
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                  {isValidAddress ? (
                    <Check className="w-4 h-4 text-green-400" />
                  ) : (
                    <AlertCircle className="w-4 h-4 text-red-400" />
                  )}
                </div>
              )}
            </div>
            {allowedTaker && !isValidAddress && (
              <p className="text-xs text-red-400 mt-1">Invalid Ethereum address</p>
            )}
          </div>

          {/* Amount */}
          <div>
            <label className="text-sm font-medium text-zinc-300 mb-2 block">
              Amount ({assetType}) <span className="text-red-400">*</span>
            </label>
            <Input
              type="number"
              placeholder="0.0"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              step="0.01"
              min="0"
              required
            />
          </div>

          {/* Unit Price */}
          <div>
            <label className="text-sm font-medium text-zinc-300 mb-2 block">
              Price per Token (USDC) <span className="text-red-400">*</span>
            </label>
            <Input
              type="number"
              placeholder="0.00"
              value={unitPrice}
              onChange={(e) => setUnitPrice(e.target.value)}
              step="0.01"
              min="0"
              required
            />
          </div>

          {/* Total */}
          <div className={`p-3 rounded border ${
            isBelowMinimum 
              ? "bg-red-950/30 border-red-500/50" 
              : ""}
          }`} style={!isBelowMinimum ? { backgroundColor: '#121218', borderColor: '#2b2b30' } : {}}>
            <div className="flex justify-between items-center text-sm">
              <span className="text-zinc-400">Total Value:</span>
              <span className={`font-semibold ${isBelowMinimum ? "text-red-400" : "text-white"}`}>
                ${total} USDC
              </span>
            </div>
            {isBelowMinimum && (
              <div className="flex items-center gap-1.5 mt-2 text-xs text-red-400">
                <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                <span>Minimum order value is ${minValue.toFixed(2)} USDC</span>
              </div>
            )}
          </div>

          {/* Info Cards - Inline */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {/* Minimum Order Info */}
            <div className="p-3 rounded border flex flex-col h-full" style={{ backgroundColor: '#121218', borderColor: '#2b2b30' }}>
              <div className="flex gap-2">
                <Info className="w-4 h-4 text-zinc-300 flex-shrink-0 mt-0.5" />
                <div className="text-xs text-zinc-300">
                  <p className="font-semibold text-zinc-100 mb-1">Minimum Order</p>
                  <p>
                    Orders must be at least <span className="font-semibold text-white">${minValue.toFixed(2)} USDC</span> to prevent dust.
                  </p>
                </div>
              </div>
            </div>

            {/* Private Order Info */}
            <div className="p-3 rounded border flex flex-col h-full" style={{ backgroundColor: '#121218', borderColor: '#2b2b30' }}>
              <div className="flex gap-2">
                <User className="w-4 h-4 text-zinc-300 flex-shrink-0 mt-0.5" />
                <div className="text-xs text-zinc-300">
                  <p className="font-semibold text-zinc-100 mb-1">Private Order</p>
                  <p>
                    Only the specified address will be able to take this order. 
                    This order will not appear in the public orderbook.
                  </p>
                </div>
              </div>
            </div>

            {/* Cancel Order Info */}
            <div className="p-3 rounded border flex flex-col h-full" style={{ backgroundColor: '#121218', borderColor: '#2b2b30' }}>
              <div className="flex gap-2">
                <XCircle className="w-4 h-4 text-zinc-300 flex-shrink-0 mt-0.5" />
                <div className="text-xs text-zinc-300">
                  <p className="font-semibold text-zinc-100 mb-1">Cancel Anytime</p>
                  <p>
                    You can cancel this order at any time up until it has been filled by the recipient.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Create Button */}
          <Button
            onClick={handleCreate}
            disabled={!amount || !unitPrice || !isValidAddress || isCreating || isBelowMinimum}
            variant="custom"
            className="w-full font-mono h-10 text-sm disabled:opacity-50 disabled:cursor-not-allowed border"
            style={{ backgroundColor: '#2b2b30', borderColor: '#2b2b30', color: 'white' }}
          >
            {isCreating ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Creating...
              </>
            ) : (
              <span className="flex items-center gap-2">
                <Lock className="w-4 h-4" />
                Create Private {side} Order
              </span>
            )}
          </Button>
        </div>
      ) : (
        /* Success State - Show Shareable Link */
        <div className="space-y-4">
          <div className="p-4 bg-green-950/30 border-2 border-green-500/50 rounded-lg">
            <div className="flex items-start gap-3 mb-3">
              <Check className="w-6 h-6 text-green-400 flex-shrink-0" />
              <div>
                <h4 className="font-semibold text-green-400 mb-1">Private Order Created!</h4>
                <p className="text-sm text-zinc-300">
                  Order #{createdOrderId} is ready. Share the link below with the recipient.
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs text-zinc-400 block">Shareable Link:</label>
              <div className="flex gap-2">
                <Input
                  value={`${window.location.origin}/order/${createdOrderId}?taker=${allowedTaker}`}
                  readOnly
                  className="font-mono text-xs"
                />
                <Button
                  onClick={handleCopyLink}
                  variant="custom"
                  className="bg-purple-600 hover:bg-purple-700 px-4"
                >
                  {copied ? (
                    <Check className="w-4 h-4" />
                  ) : (
                    <Copy className="w-4 h-4" />
                  )}
                </Button>
              </div>
            </div>

            <div className="mt-3 p-2 bg-zinc-900/50 rounded border border-zinc-800">
              <p className="text-xs text-zinc-400">
                <strong className="text-zinc-300">Recipient:</strong>{" "}
                {allowedTaker.slice(0, 6)}...{allowedTaker.slice(-4)}
              </p>
            </div>
          </div>

          <Button
            onClick={handleReset}
            variant="custom"
            className="w-full h-10 text-sm border"
            style={{ backgroundColor: '#2b2b30', borderColor: '#2b2b30', color: 'white' }}
          >
            Create Another Private Order
          </Button>
        </div>
      )}
    </Card>
  );
}

