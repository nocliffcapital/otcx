'use client';

import { useEffect, useState } from 'react';
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
  // Temporarily disabled - Ethos API integration needs fixing
  return null;
  
  /* DISABLED
  const [reputation, setReputation] = useState<EthosScore | null>(null);
  const [loading, setLoading] = useState(true);

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
  */
  
  /* DISABLED - Ethos integration
  if (reputation.score === 0) {
    // User exists on Ethos but has 0 score
    return (
      <div className="inline-flex items-center gap-1 px-2 py-1 bg-zinc-800/30 rounded border border-zinc-700/30">
        <Shield className="w-3 h-3 text-zinc-600" />
        <span className="text-[10px] text-zinc-500">New</span>
      </div>
    );
  }

  const tier = getReputationTier(reputation.score);

  if (variant === 'compact') {
    return (
      <div className="group relative inline-flex">
        <div 
          className={`inline-flex items-center gap-1 px-2 py-1 ${tier.bgColor} rounded border border-${tier.color}/30`}
        >
          <Shield className={`w-3 h-3 ${tier.color}`} />
          <span className={`text-[10px] font-semibold ${tier.textColor}`}>
            {formatScore(reputation.score)}
          </span>
        </div>
        
        {showTooltip && (
          <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 pointer-events-none z-20">
            <div className="bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 shadow-xl min-w-[200px]">
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
                  href={`https://ethos.network/profile/address:${address}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[10px] text-cyan-400 hover:text-cyan-300 transition-colors"
                >
                  View on Ethos →
                </a>
              </div>
            </div>
          </div>
        )}
      </div>
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
  */
}

