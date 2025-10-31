'use client';

import { useEffect, useState } from 'react';
import { Shield, ThumbsUp, ThumbsDown, Minus } from 'lucide-react';
import { getTwitterReputation, getReputationTier, formatScore, extractTwitterUsername, type EthosScore } from '@/lib/ethos';

interface ProjectReputationBadgeProps {
  twitterUrl: string;
  projectName: string;
  variant?: 'default' | 'compact' | 'prominent';
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

  // Variant styles
  const variants = {
    compact: {
      container: "inline-flex items-center gap-1.5 px-2 py-1 bg-zinc-800/30 hover:bg-zinc-800/50 rounded border border-zinc-700/30 hover:border-zinc-700/50",
      icon: "w-3 h-3",
      score: "text-[10px]",
      label: "text-[10px]"
    },
    default: {
      container: "inline-flex items-center gap-2 px-3 py-1.5 bg-zinc-800/30 hover:bg-zinc-800/50 rounded-lg border border-zinc-700/30 hover:border-zinc-700/50",
      icon: "w-4 h-4",
      score: "text-xs",
      label: "text-xs"
    },
    prominent: {
      container: "inline-flex items-center gap-2.5 px-4 py-2.5 bg-gradient-to-br from-zinc-800/40 to-zinc-900/40 hover:from-zinc-800/60 hover:to-zinc-900/60 rounded-xl border-2 border-zinc-700/40 hover:border-zinc-600/60 shadow-lg",
      icon: "w-5 h-5",
      score: "text-sm",
      label: "text-sm"
    }
  };

  const style = variants[variant];

  if (loading) {
    return (
      <div className={`${style.container} animate-pulse`}>
        <Shield className={`${style.icon} text-zinc-600`} />
        <span className={`${style.score} text-zinc-600`}>...</span>
      </div>
    );
  }

  if (!reputation || reputation.score === 0) {
    return null; // Don't show badge for projects with no reputation
  }

  const tier = getReputationTier(reputation.level);

  // Compact variant - no review breakdown
  if (variant === 'compact') {
    return (
      <a 
        href={`https://app.ethos.network/profile/x/${twitterUsername}`}
        target="_blank"
        rel="noopener noreferrer"
        className={`${style.container} transition-all cursor-pointer group`}
        title={`Ethos Reputation Score: ${formatScore(reputation.score)}`}
      >
        <Shield 
          className={`${style.icon} opacity-70 group-hover:opacity-100 transition-opacity`}
          style={{ color: tier.hexColor }}
        />
        <div className="flex flex-col">
          <span className={`${style.score} font-bold ${tier.textColor} leading-tight`}>
            {formatScore(reputation.score)}
          </span>
          <span className={`${style.label} text-zinc-500 group-hover:text-zinc-400 leading-tight`}>
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
        className="w-[200px] p-3 bg-gradient-to-br from-zinc-800/40 to-zinc-900/40 hover:from-zinc-800/60 hover:to-zinc-900/60 rounded-xl border-2 border-zinc-700/40 hover:border-zinc-600/60 shadow-lg transition-all cursor-pointer group"
        title={`Ethos Reputation Score: ${formatScore(reputation.score)}`}
      >
        <div className="flex items-center gap-2 mb-2.5">
          <Shield 
            className="w-4 h-4 opacity-70 group-hover:opacity-100 transition-opacity flex-shrink-0"
            style={{ color: tier.hexColor }}
          />
          <div className="flex items-baseline gap-1.5">
            <span className="text-base font-bold leading-tight" style={{ color: tier.hexColor }}>
              {formatScore(reputation.score)}
            </span>
            <span className="text-[10px] text-zinc-400 group-hover:text-zinc-300 leading-tight">
              {tier.label}
            </span>
          </div>
        </div>
        
        {/* Review Breakdown - Always show all three */}
        <div className="space-y-1.5">
          <div className="flex items-center gap-1.5 text-[11px]">
            <ThumbsUp className="w-3 h-3 text-green-400 flex-shrink-0" />
            <span className="text-zinc-300">
              <span className="font-semibold text-green-400">{reputation.positiveReviews}</span> positive
            </span>
          </div>
          
          <div className="flex items-center gap-1.5 text-[11px]">
            <Minus className="w-3 h-3 text-zinc-400 flex-shrink-0" />
            <span className="text-zinc-300">
              <span className="font-semibold text-zinc-400">{reputation.neutralReviews}</span> neutral
            </span>
          </div>
          
          <div className="flex items-center gap-1.5 text-[11px]">
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
  const totalReviews = reputation.positiveReviews + reputation.negativeReviews + reputation.neutralReviews;

  return (
    <a 
      href={`https://app.ethos.network/profile/x/${twitterUsername}`}
      target="_blank"
      rel="noopener noreferrer"
      className={`${style.container} transition-all cursor-pointer group`}
      title={`Ethos Reputation Score: ${formatScore(reputation.score)}`}
    >
      <Shield 
        className={`${style.icon} opacity-70 group-hover:opacity-100 transition-opacity flex-shrink-0`}
        style={{ color: tier.hexColor }}
      />
      <div className="flex flex-col gap-1">
        <div className="flex items-baseline gap-1.5">
          <span className={`${style.score} font-bold ${tier.textColor} leading-tight`}>
        {formatScore(reputation.score)}
      </span>
          <span className={`${style.label} text-zinc-500 group-hover:text-zinc-400 leading-tight`}>
        {tier.label}
      </span>
        </div>
        
        {/* Review Breakdown */}
        {totalReviews > 0 && (
          <div className="flex items-center gap-2 text-[10px]">
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
