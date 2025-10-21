/**
 * Ethos Network API Integration
 * Documentation: https://developers.ethos.network/
 */

const ETHOS_BASE_URL = 'https://api.ethos.network';
const CLIENT_HEADER = 'otcx.fun@1.0';

export interface EthosScore {
  score: number;
  positiveReviews: number;
  negativeReviews: number;
  neutralReviews: number;
  vouchesReceived: number;
}

export interface EthosProfile {
  id: number;
  address?: string;
  score: number;
  verified: boolean;
  username?: string;
}

export interface EthosProjectVote {
  isPositive: boolean;
  comment?: string;
  voter: {
    score: number;
  };
}

/**
 * Fetch reputation score for a wallet address
 */
export async function getWalletReputation(address: string): Promise<EthosScore | null> {
  try {
    // Use v1 API with userkey format
    const response = await fetch(
      `${ETHOS_BASE_URL}/api/score/userkey:address:${address}`,
      {
        headers: {
          'X-Ethos-Client': CLIENT_HEADER,
        },
        cache: 'no-store',
      }
    );

    if (!response.ok) {
      console.log(`Ethos API returned ${response.status} for address ${address}`);
      return null;
    }

    const data = await response.json();
    console.log('Ethos wallet data for', address, ':', data);
    
    return {
      score: data.score || 0,
      positiveReviews: data.positiveReviews || 0,
      negativeReviews: data.negativeReviews || 0,
      neutralReviews: data.neutralReviews || 0,
      vouchesReceived: data.vouchesReceived || 0,
    };
  } catch (error) {
    console.error('Failed to fetch Ethos reputation:', error);
    return null;
  }
}

/**
 * Fetch profile information for a wallet address
 */
export async function getWalletProfile(address: string): Promise<EthosProfile | null> {
  try {
    const response = await fetch(
      `${ETHOS_BASE_URL}/api/v2/profiles/address/${address}`,
      {
        headers: {
          'X-Ethos-Client': CLIENT_HEADER,
        },
        cache: 'no-store',
      }
    );

    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    return {
      id: data.id,
      address: data.primaryAddress,
      score: data.score || 0,
      verified: data.verified || false,
      username: data.username,
    };
  } catch (error) {
    console.error('Failed to fetch Ethos profile:', error);
    return null;
  }
}

/**
 * Extract Twitter username from URL
 * Handles: twitter.com/username, x.com/username, @username
 */
export function extractTwitterUsername(twitterUrl: string): string | null {
  if (!twitterUrl) return null;
  
  // Remove @ if present
  const cleaned = twitterUrl.trim().replace(/^@/, '');
  
  // Extract username from URL
  const match = cleaned.match(/(?:twitter\.com|x\.com)\/([^\/\?]+)/);
  if (match) {
    return match[1];
  }
  
  // If it's just a username without domain
  if (!cleaned.includes('/') && !cleaned.includes('.')) {
    return cleaned;
  }
  
  return null;
}

/**
 * Fetch reputation for a Twitter account using Ethos
 * Example: getTwitterReputation("https://x.com/Lighter_xyz") or getTwitterReputation("Lighter_xyz")
 */
export async function getTwitterReputation(twitterUrlOrUsername: string): Promise<EthosScore | null> {
  const username = extractTwitterUsername(twitterUrlOrUsername);
  if (!username) {
    console.warn('Invalid Twitter URL or username:', twitterUrlOrUsername);
    return null;
  }

  try {
    // Use v1 API with userkey format for Twitter
    const response = await fetch(
      `${ETHOS_BASE_URL}/api/score/userkey:service:x.com:username:${username}`,
      {
        headers: {
          'X-Ethos-Client': CLIENT_HEADER,
        },
        cache: 'no-store',
      }
    );

    if (!response.ok) {
      console.log(`Ethos API returned ${response.status} for Twitter @${username}`);
      return null;
    }

    const data = await response.json();
    console.log(`Ethos Twitter data for @${username}:`, data);
    
    return {
      score: data.score || 0,
      positiveReviews: data.positiveReviews || 0,
      negativeReviews: data.negativeReviews || 0,
      neutralReviews: data.neutralReviews || 0,
      vouchesReceived: data.vouchesReceived || 0,
    };
  } catch (error) {
    console.error('Failed to fetch Twitter reputation from Ethos:', error);
    return null;
  }
}

/**
 * Fetch profile for a Twitter account
 */
export async function getTwitterProfile(twitterUrlOrUsername: string): Promise<EthosProfile | null> {
  const username = extractTwitterUsername(twitterUrlOrUsername);
  if (!username) {
    return null;
  }

  try {
    const response = await fetch(
      `${ETHOS_BASE_URL}/api/v2/profiles/service/x.com/username/${username}`,
      {
        headers: {
          'X-Ethos-Client': CLIENT_HEADER,
        },
        cache: 'no-store',
      }
    );

    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    return {
      id: data.id,
      score: data.score || 0,
      verified: data.verified || false,
      username: data.username || username,
    };
  } catch (error) {
    console.error('Failed to fetch Twitter profile from Ethos:', error);
    return null;
  }
}

/**
 * Get reputation tier based on score
 */
export function getReputationTier(score: number): {
  label: string;
  color: string;
  bgColor: string;
  textColor: string;
} {
  if (score >= 800) {
    return {
      label: 'Elite',
      color: 'text-purple-400',
      bgColor: 'bg-purple-500/20',
      textColor: 'text-purple-300',
    };
  } else if (score >= 600) {
    return {
      label: 'Trusted',
      color: 'text-green-400',
      bgColor: 'bg-green-500/20',
      textColor: 'text-green-300',
    };
  } else if (score >= 400) {
    return {
      label: 'Verified',
      color: 'text-blue-400',
      bgColor: 'bg-blue-500/20',
      textColor: 'text-blue-300',
    };
  } else if (score >= 200) {
    return {
      label: 'Active',
      color: 'text-cyan-400',
      bgColor: 'bg-cyan-500/20',
      textColor: 'text-cyan-300',
    };
  } else if (score > 0) {
    return {
      label: 'New',
      color: 'text-zinc-400',
      bgColor: 'bg-zinc-500/20',
      textColor: 'text-zinc-300',
    };
  } else {
    return {
      label: 'Unknown',
      color: 'text-zinc-500',
      bgColor: 'bg-zinc-600/20',
      textColor: 'text-zinc-400',
    };
  }
}

/**
 * Format score for display
 */
export function formatScore(score: number): string {
  if (score >= 1000) {
    return `${(score / 1000).toFixed(1)}k`;
  }
  return score.toString();
}

