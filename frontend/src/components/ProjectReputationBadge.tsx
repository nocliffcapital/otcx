'use client';

import { useEffect, useState } from 'react';
import { Shield, ThumbsUp, ThumbsDown, Minus, TrendingUp, TrendingDown, Handshake } from 'lucide-react';
import { getTwitterReputation, getReputationTier, formatScore, extractTwitterUsername, type EthosScore } from '@/lib/ethos';

interface ProjectReputationBadgeProps {
  twitterUrl: string;
  projectName: string;
  variant?: 'default' | 'compact' | 'prominent' | 'card';
}

export default function ProjectReputationBadge({ 
  twitterUrl, 
  projectName,
  variant = 'default',
}: ProjectReputationBadgeProps) {
  const [reputation, setReputation] = useState<EthosScore | null>(null);
  const [loading, setLoading] = useState(true);
  const twitterUsername = extractTwitterUsername(twitterUrl);

  useEffect(() => {
    async function fetchReputation() {
      if (!twitterUrl) {
        setLoading(false);
        return;
      }
      
      setLoading(true);
      const data = await getTwitterReputation(twitterUrl);
      setReputation(data);
      setLoading(false);
    }

    fetchReputation();
  }, [twitterUrl]);

  // Variant styles - updated to current design
  const variants = {
    compact: {
      container: "inline-flex items-center gap-1.5 px-2 py-1 rounded border transition-all",
      icon: "w-3 h-3",
      score: "text-[10px]",
      label: "text-[10px]"
    },
    default: {
      container: "inline-flex items-center gap-2 px-3 py-1.5 rounded border transition-all",
      icon: "w-4 h-4",
      score: "text-xs",
      label: "text-xs"
    },
    prominent: {
      container: "inline-flex items-center gap-2.5 px-4 py-2.5 rounded border transition-all",
      icon: "w-5 h-5",
      score: "text-sm",
      label: "text-sm"
    }
  };

  const style = variants[variant];

  // Card variant loading state
  if (variant === 'card' && loading) {
    return (
      <div 
        className="flex flex-col rounded border animate-pulse w-full"
        style={{ backgroundColor: '#121218', borderColor: '#2b2b30' }}
      >
        <div className="px-3 pt-2 pb-1.5 border-b" style={{ borderColor: '#2b2b30' }}>
          <div className="h-3 bg-zinc-700 rounded w-20"></div>
        </div>
        <div className="p-3 flex gap-3">
          <div className="flex flex-col items-center justify-center min-w-[60px]">
            <div className="w-8 h-8 bg-zinc-700 rounded mb-1.5"></div>
            <div className="h-2.5 bg-zinc-700 rounded w-12 mb-0.5"></div>
            <div className="h-5 bg-zinc-700 rounded w-10 mb-0.5"></div>
            <div className="h-2 bg-zinc-700 rounded w-8"></div>
          </div>
          <div className="flex-1 flex flex-col gap-1.5">
            <div className="h-6 bg-zinc-700 rounded"></div>
            <div className="h-6 bg-zinc-700 rounded"></div>
            <div className="h-6 bg-zinc-700 rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  // Card variant empty state - show empty card
  if (variant === 'card' && (!reputation || reputation.score === 0)) {
    return (
      <div 
        className="flex flex-col rounded border w-full"
        style={{ backgroundColor: '#121218', borderColor: '#2b2b30' }}
      >
        <div className="px-3 pt-2 pb-1.5 border-b" style={{ borderColor: '#2b2b30' }}>
          <div className="flex items-center gap-1.5">
            <Shield className="w-3 h-3 text-zinc-400" />
            <span className="text-[10px] font-bold text-white uppercase font-mono">ETHOS BADGE</span>
          </div>
        </div>
        <div className="flex items-center justify-center p-3">
          <span className="text-[10px] text-zinc-500 font-mono">No reputation data</span>
        </div>
      </div>
    );
  }

  // Non-card variants loading state
  if (loading) {
    return (
      <div 
        className={`${style.container} animate-pulse`}
        style={{ backgroundColor: '#121218', borderColor: '#2b2b30' }}
      >
        <Shield className={`${style.icon} text-zinc-600`} />
        <span className={`${style.score} text-zinc-600`}>...</span>
      </div>
    );
  }

  // Non-card variants empty state
  if (!reputation || reputation.score === 0) {
    return null; // Don't show badge for projects with no reputation
  }

  const tier = getReputationTier(reputation.level);
  const totalReviews = reputation.positiveReviews + reputation.negativeReviews + reputation.neutralReviews;

  // Get score range based on tier
  const getScoreRange = (level?: string): string => {
    const normalizedLevel = (level || 'unknown').toLowerCase();
    const ranges: Record<string, string> = {
      'renowned': '2600-2800',
      'revered': '2400-2599',
      'distinguished': '2200-2399',
      'exemplary': '2000-2199',
      'reputable': '1800-1999',
      'established': '1600-1799',
      'known': '1400-1599',
      'neutral': '1200-1399',
      'questionable': '800-1199',
      'untrusted': '0-799',
    };
    return ranges[normalizedLevel] || '0-999';
  };

  // Card variant - compact card design
  if (variant === 'card') {
    const scoreRange = getScoreRange(reputation.level);
    
    return (
      <a
        href={`https://app.ethos.network/profile/x/${twitterUsername}`}
        target="_blank"
        rel="noopener noreferrer"
        className="flex flex-col rounded border transition-all cursor-pointer group w-full"
        style={{ backgroundColor: '#121218', borderColor: '#2b2b30' }}
        title={`Ethos Reputation Score: ${formatScore(reputation.score)}`}
      >
        {/* Compact Header */}
        <div className="px-3 pt-2 pb-1.5 border-b" style={{ borderColor: '#2b2b30' }}>
          <div className="flex items-center gap-1.5">
            <Shield className="w-3 h-3 text-zinc-400" />
            <span className="text-[10px] font-bold text-white uppercase font-mono">ETHOS BADGE</span>
          </div>
        </div>

        {/* Compact Content */}
        <div className="p-3 flex gap-3">
          {/* Left: Shield Icon & Score */}
          <div className="flex flex-col items-center justify-center min-w-[60px]">
            <Shield 
              className="w-8 h-8 mb-1.5"
              style={{ 
                stroke: tier.hexColor, 
                fill: 'none',
                strokeWidth: 2
              }}
            />
            <span 
              className="text-[10px] font-bold uppercase mb-0.5 font-mono leading-tight"
              style={{ color: tier.hexColor }}
            >
              {tier.label}
            </span>
            <span className="text-lg font-bold text-white mb-0.5 font-mono leading-tight">
              {formatScore(reputation.score)}
            </span>
            <span className="text-[9px] text-zinc-400 font-mono leading-tight">
              {scoreRange}
            </span>
          </div>

          {/* Right: Statistics - stacked vertically */}
          <div className="flex-1 flex flex-col gap-1.5">
            {/* POSITIVE */}
            <div 
              className="flex items-center justify-between px-3 py-0.5 rounded border"
              style={{ backgroundColor: 'transparent', borderColor: 'rgba(34, 197, 94, 0.5)' }}
            >
              <span className="text-[10px] text-green-400 uppercase font-mono">POSITIVE</span>
              <span className="text-xs font-bold text-green-400 font-mono">{reputation.positiveReviews}</span>
            </div>

            {/* NEUTRAL */}
            <div 
              className="flex items-center justify-between px-3 py-0.5 rounded border"
              style={{ backgroundColor: 'transparent', borderColor: 'rgba(193, 192, 182, 0.5)' }}
            >
              <span className="text-[10px] text-zinc-400 uppercase font-mono">NEUTRAL</span>
              <span className="text-xs font-bold text-zinc-400 font-mono">{reputation.neutralReviews}</span>
            </div>

            {/* NEGATIVE */}
            <div 
              className="flex items-center justify-between px-3 py-0.5 rounded border"
              style={{ backgroundColor: 'transparent', borderColor: 'rgba(239, 68, 68, 0.5)' }}
            >
              <span className="text-[10px] text-red-400 uppercase font-mono">NEGATIVE</span>
              <span className="text-xs font-bold text-red-400 font-mono">{reputation.negativeReviews}</span>
            </div>
          </div>
        </div>
      </a>
    );
  }

  // Compact variant - no review breakdown
  if (variant === 'compact') {
    return (
      <a 
        href={`https://app.ethos.network/profile/x/${twitterUsername}`}
        target="_blank"
        rel="noopener noreferrer"
        className={`${style.container} cursor-pointer group`}
        style={{ backgroundColor: '#121218', borderColor: '#2b2b30' }}
        title={`Ethos Reputation Score: ${formatScore(reputation.score)}`}
      >
        <Shield 
          className={`${style.icon} opacity-70 group-hover:opacity-100 transition-opacity`}
          style={{ color: tier.hexColor }}
        />
        <div className="flex flex-col">
          <span className={`${style.score} font-bold leading-tight`} style={{ color: tier.hexColor }}>
            {formatScore(reputation.score)}
          </span>
          <span className={`${style.label} text-zinc-400 group-hover:text-zinc-300 leading-tight`}>
            {tier.label}
          </span>
        </div>
      </a>
    );
  }

  // Prominent variant - fixed-size box with full review breakdown
  if (variant === 'prominent') {
    return (
      <a 
        href={`https://app.ethos.network/profile/x/${twitterUsername}`}
        target="_blank"
        rel="noopener noreferrer"
        className="w-[200px] p-3 rounded border transition-all cursor-pointer group"
        style={{ backgroundColor: '#121218', borderColor: '#2b2b30' }}
        title={`Ethos Reputation Score: ${formatScore(reputation.score)}`}
      >
        <div className="flex items-center gap-2 mb-2.5">
          <Shield 
            className="w-4 h-4 opacity-70 group-hover:opacity-100 transition-opacity flex-shrink-0"
            style={{ color: tier.hexColor }}
          />
          <div className="flex items-baseline gap-1.5">
            <span className="text-base font-bold leading-tight font-mono" style={{ color: tier.hexColor }}>
              {formatScore(reputation.score)}
            </span>
            <span className="text-[10px] text-zinc-400 group-hover:text-zinc-300 leading-tight font-mono">
              {tier.label}
            </span>
          </div>
        </div>
        
        {/* Review Breakdown - Always show all three */}
        <div className="space-y-1.5">
          <div className="flex items-center gap-1.5 text-[11px] font-mono">
            <ThumbsUp className="w-3 h-3 text-green-400 flex-shrink-0" />
            <span className="text-zinc-300">
              <span className="font-semibold text-green-400">{reputation.positiveReviews}</span> positive
            </span>
          </div>
          
          <div className="flex items-center gap-1.5 text-[11px] font-mono">
            <Minus className="w-3 h-3 text-zinc-400 flex-shrink-0" />
            <span className="text-zinc-300">
              <span className="font-semibold text-zinc-400">{reputation.neutralReviews}</span> neutral
            </span>
          </div>
          
          <div className="flex items-center gap-1.5 text-[11px] font-mono">
            <ThumbsDown className="w-3 h-3 text-red-400 flex-shrink-0" />
            <span className="text-zinc-300">
              <span className="font-semibold text-red-400">{reputation.negativeReviews}</span> negative
            </span>
          </div>
        </div>
      </a>
    );
  }

  // Default variant - inline with icons
  return (
    <a 
      href={`https://app.ethos.network/profile/x/${twitterUsername}`}
      target="_blank"
      rel="noopener noreferrer"
      className={`${style.container} cursor-pointer group`}
      style={{ backgroundColor: '#121218', borderColor: '#2b2b30' }}
      title={`Ethos Reputation Score: ${formatScore(reputation.score)}`}
    >
      <Shield 
        className={`${style.icon} opacity-70 group-hover:opacity-100 transition-opacity flex-shrink-0`}
        style={{ color: tier.hexColor }}
      />
      <div className="flex flex-col gap-1">
        <div className="flex items-baseline gap-1.5">
          <span className={`${style.score} font-bold leading-tight font-mono`} style={{ color: tier.hexColor }}>
            {formatScore(reputation.score)}
          </span>
          <span className={`${style.label} text-zinc-400 group-hover:text-zinc-300 leading-tight font-mono`}>
            {tier.label}
          </span>
        </div>
        
        {/* Review Breakdown */}
        {totalReviews > 0 && (
          <div className="flex items-center gap-2 text-[10px] font-mono">
            {reputation.positiveReviews > 0 && (
              <div className="flex items-center gap-1 text-green-400">
                <ThumbsUp className="w-2.5 h-2.5" />
                <span className="font-medium">{reputation.positiveReviews}</span>
              </div>
            )}
            {reputation.neutralReviews > 0 && (
              <div className="flex items-center gap-1 text-zinc-400">
                <Minus className="w-2.5 h-2.5" />
                <span className="font-medium">{reputation.neutralReviews}</span>
              </div>
            )}
            {reputation.negativeReviews > 0 && (
              <div className="flex items-center gap-1 text-red-400">
                <ThumbsDown className="w-2.5 h-2.5" />
                <span className="font-medium">{reputation.negativeReviews}</span>
              </div>
            )}
          </div>
        )}
      </div>
    </a>
  );
}
