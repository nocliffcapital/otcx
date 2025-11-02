"use client";

import { useState, useEffect } from "react";
import { Clock } from "lucide-react";

interface SettlementTimerProps {
  settlementDeadline: bigint | number;
  proof?: string;
  variant?: "default" | "compact" | "inline";
}

export function SettlementTimer({ 
  settlementDeadline, 
  proof,
  variant = "default" 
}: SettlementTimerProps) {
  const [timeRemaining, setTimeRemaining] = useState<string>("");
  const [hasProof, setHasProof] = useState<boolean>(false);
  
  // Check if proof exists
  useEffect(() => {
    if (proof && proof.length > 0) {
      setHasProof(true);
    } else {
      setHasProof(false);
    }
  }, [proof]);
  
  useEffect(() => {
    try {
      // Handle both bigint and number types
      if (!settlementDeadline) {
        setTimeRemaining("");
        return;
      }
      
      let deadlineValue: bigint;
      try {
        deadlineValue = typeof settlementDeadline === 'bigint' 
          ? settlementDeadline 
          : BigInt(Math.floor(Number(settlementDeadline)));
      } catch (err) {
        console.error('SettlementTimer: Error converting deadline:', err);
        setTimeRemaining("");
        return;
      }
      
      if (deadlineValue === 0n) {
        setTimeRemaining("");
        return;
      }

      const updateTimer = () => {
        try {
          const deadlineSeconds = Number(deadlineValue);
          const nowSeconds = Math.floor(Date.now() / 1000);
          const remaining = deadlineSeconds - nowSeconds;

          if (remaining <= 0) {
            // If deadline passed but proof exists, show different message
            if (hasProof) {
              setTimeRemaining("Proof submitted - awaiting review");
            } else {
              setTimeRemaining("Window closed");
            }
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
        } catch (err) {
          console.error('SettlementTimer: Error updating timer:', err);
        }
      };

      updateTimer();
      const interval = setInterval(updateTimer, 1000);
      return () => clearInterval(interval);
    } catch (err) {
      console.error('SettlementTimer: Error in useEffect:', err);
      setTimeRemaining("");
    }
  }, [settlementDeadline, hasProof]);

  if (!timeRemaining) return null;

  if (variant === "inline") {
    return (
      <span className="text-[10px] text-orange-400 font-mono flex items-center gap-1">
        <Clock className="w-3 h-3" />
        {timeRemaining}
      </span>
    );
  }

  if (variant === "compact") {
    return (
      <div className="flex items-center gap-1 text-[10px] text-orange-400 font-mono">
        <Clock className="w-3 h-3" />
        <span>{timeRemaining}</span>
      </div>
    );
  }

  // default variant
  return (
    <div className="flex items-center gap-1 text-[10px] text-orange-400 font-mono">
      <Clock className="w-3 h-3" />
      <span>{timeRemaining}</span>
    </div>
  );
}

