'use client';

import { useEffect, useState } from 'react';
import { Shield } from 'lucide-react';
import { getTwitterReputation, getReputationTier, formatScore, extractTwitterUsername, type EthosScore } from '@/lib/ethos';

interface ProjectReputationBadgeProps {
  twitterUrl: string;
  projectName: string;
}

export default function ProjectReputationBadge({ 
  twitterUrl, 
  projectName,
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

  if (loading) {
    return (
      <div className="inline-flex items-center gap-1.5 px-2 py-1 bg-zinc-800/30 rounded border border-zinc-700/30 animate-pulse">
        <Shield className="w-3 h-3 text-zinc-600" />
        <span className="text-[10px] text-zinc-600">...</span>
      </div>
    );
  }

  if (!reputation || reputation.score === 0) {
    return null; // Don't show badge for projects with no reputation
  }

  const tier = getReputationTier(reputation.level);

  return (
    <a 
      href={`https://app.ethos.network/profile/x/${twitterUsername}`}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1.5 px-2 py-1 bg-zinc-800/30 hover:bg-zinc-800/50 rounded border border-zinc-700/30 hover:border-zinc-700/50 transition-all cursor-pointer group"
    >
      <Shield 
        className="w-3 h-3 opacity-70 group-hover:opacity-100 transition-opacity" 
        style={{ color: tier.hexColor }}
      />
      <span className={`text-[10px] font-semibold ${tier.textColor}`}>
        {formatScore(reputation.score)}
      </span>
      <span className="text-[10px] text-zinc-500 group-hover:text-zinc-400">
        {tier.label}
      </span>
    </a>
  );
}
