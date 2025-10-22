'use client';

import { useEffect, useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Shield, CheckCircle2, AlertCircle } from 'lucide-react';
import { getWalletReputation, getReputationTier, formatScore, type EthosScore } from '@/lib/ethos';

interface ReputationBadgeProps {
  address: string;
  variant?: 'compact' | 'full';
  showTooltip?: boolean;
}

export default function ReputationBadge({ 
  address, 
  variant = 'compact',
  showTooltip = true 
}: ReputationBadgeProps) {
  const [reputation, setReputation] = useState<EthosScore | null>(null);
  const [loading, setLoading] = useState(true);
  const [isHovered, setIsHovered] = useState(false);
  const [tooltipPosition, setTooltipPosition] = useState({ top: 0, left: 0 });
  const badgeRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    async function fetchReputation() {
      // Check for zero address or invalid address
      if (!address || address === '0x0000000000000000000000000000000000000000') {
        setLoading(false);
        setReputation(null);
        return;
      }
      
      setLoading(true);
      const data = await getWalletReputation(address);
      setReputation(data);
      setLoading(false);
    }

    fetchReputation();
  }, [address]);

  useEffect(() => {
    if (isHovered && badgeRef.current) {
      const rect = badgeRef.current.getBoundingClientRect();
      setTooltipPosition({
        top: rect.top - 10,
        left: rect.left + rect.width / 2,
      });
    }
  }, [isHovered]);

  if (loading) {
    return (
      <div className="inline-flex items-center gap-1 px-2 py-1 bg-zinc-800/50 rounded animate-pulse">
        <Shield className="w-3 h-3 text-zinc-600" />
        <span className="text-[10px] text-zinc-600">...</span>
      </div>
    );
  }

  // Show a subtle "No Rep" badge if reputation exists but score is 0
  if (!reputation) {
    return null; // API error or no data
  }
  
  if (reputation.score === 0) {
    // User exists on Ethos but has 0 score
    return (
      <div className="inline-flex items-center gap-1 px-2 py-1 bg-zinc-800/30 rounded border border-zinc-700/30">
        <Shield className="w-3 h-3 text-zinc-600" />
        <span className="text-[10px] text-zinc-500">New</span>
      </div>
    );
  }

  const tier = getReputationTier(reputation.level);

  const handleMouseEnter = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    setIsHovered(true);
  };

  const handleMouseLeave = () => {
    timeoutRef.current = setTimeout(() => {
      setIsHovered(false);
    }, 150);
  };

  if (variant === 'compact') {
    const tooltipContent = showTooltip && isHovered && (
      <div 
        ref={tooltipRef}
        className="fixed pointer-events-auto z-[9999] transition-opacity duration-200"
        style={{
          top: `${tooltipPosition.top}px`,
          left: `${tooltipPosition.left}px`,
          transform: 'translate(-50%, -100%)',
        }}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        <div className="bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 shadow-2xl min-w-[200px]">
              <div className="flex items-center justify-between mb-2">
                <span className={`text-xs font-bold ${tier.color}`}>{tier.label}</span>
                <span className="text-xs text-zinc-400">Score: {reputation.score}</span>
              </div>
              <div className="space-y-1 text-[10px] text-zinc-400">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-3 h-3 text-green-400" />
                  <span>{reputation.positiveReviews} positive reviews</span>
                </div>
                {reputation.negativeReviews > 0 && (
                  <div className="flex items-center gap-2">
                    <AlertCircle className="w-3 h-3 text-red-400" />
                    <span>{reputation.negativeReviews} negative reviews</span>
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <Shield className="w-3 h-3 text-blue-400" />
                  <span>{reputation.vouchesReceived} vouches</span>
                </div>
              </div>
              <div className="mt-2 pt-2 border-t border-zinc-700">
                <a 
                  href={`https://app.ethos.network/profile/${address}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[10px] text-cyan-400 hover:text-cyan-300 transition-colors"
                >
                  View on Ethos →
                </a>
              </div>
            </div>
          </div>
    );

    return (
      <>
              <div 
                ref={badgeRef}
                className="inline-flex"
                onMouseEnter={handleMouseEnter}
                onMouseLeave={handleMouseLeave}
              >
                <div 
                  className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-zinc-800/30 rounded border border-zinc-700/30 cursor-help group"
                >
                  <Shield className={`w-2.5 h-2.5 ${tier.color} opacity-70 group-hover:opacity-100`} />
                  <span className={`text-[10px] font-semibold ${tier.textColor}`}>
                    {formatScore(reputation.score)}
                  </span>
                </div>
              </div>
        {typeof window !== 'undefined' && createPortal(tooltipContent, document.body)}
      </>
    );
  }

  // Full variant
  return (
    <div className={`flex items-center gap-2 px-3 py-2 ${tier.bgColor} rounded-lg border border-${tier.color}/30`}>
      <Shield className={`w-4 h-4 ${tier.color}`} />
      <div className="flex flex-col">
        <span className={`text-xs font-bold ${tier.color}`}>{tier.label}</span>
        <span className="text-[10px] text-zinc-400">Score: {reputation.score}</span>
      </div>
      <div className="flex flex-col items-end text-[10px] text-zinc-400">
        <span className="text-green-400">+{reputation.positiveReviews}</span>
        {reputation.negativeReviews > 0 && (
          <span className="text-red-400">-{reputation.negativeReviews}</span>
        )}
      </div>
    </div>
  );
}

