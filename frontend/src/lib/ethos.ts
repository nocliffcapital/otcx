/**
 * Ethos Network API Integration
 * Documentation: https://developers.ethos.network/
 */

const ETHOS_BASE_URL = 'https://api.ethos.network';
const CLIENT_HEADER = 'otcx.fun@1.0';

export interface EthosScore {
  score: number;
  level?: string; // API returns: "unknown", "new", "known", "trusted", "elite"
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
    console.log('🔍 Fetching Ethos profile for:', address);
    
    // First, get the score and level
    const scoreResponse = await fetch(
      `${ETHOS_BASE_URL}/api/v2/score/address?address=${address}`,
      {
        headers: {
          'X-Ethos-Client': CLIENT_HEADER,
        },
        cache: 'no-store',
      }
    );

    if (!scoreResponse.ok) {
      console.log(`❌ Ethos v2 score API returned ${scoreResponse.status} for address ${address}`);
      return null;
    }

    const scoreData = await scoreResponse.json();
    console.log('✅ Ethos v2 score API SUCCESS for', address);
    console.log('Score data:', scoreData);
    
    // Then, get full user data with stats via users endpoint
    const usersResponse = await fetch(
      `${ETHOS_BASE_URL}/api/v2/users/by/address`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Ethos-Client': CLIENT_HEADER,
        },
        body: JSON.stringify({
          addresses: [address],
        }),
        cache: 'no-store',
      }
    );

    let stats = {
      positiveReviews: 0,
      negativeReviews: 0,
      neutralReviews: 0,
      vouchesReceived: 0,
    };

    if (usersResponse.ok) {
      const usersData = await usersResponse.json();
      console.log('✅ Ethos v2 users API SUCCESS');
      console.log('Users data:', usersData);
      
      // Extract stats from the first user in the response
      if (usersData && usersData.length > 0) {
        const user = usersData[0];
        if (user?.stats) {
          stats = {
            positiveReviews: user.stats.review?.received?.positive || 0,
            negativeReviews: user.stats.review?.received?.negative || 0,
            neutralReviews: user.stats.review?.received?.neutral || 0,
            vouchesReceived: user.stats.vouch?.received?.count || 0,
          };
        }
      }
    } else {
      console.log('⚠️ Users API not available, stats will be zero');
    }
    
    return {
      score: scoreData.score || 0,
      level: scoreData.level || 'unknown',
      ...stats,
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
 * Fetch reputation for a Twitter account using Ethos v2 API
 * Example: getTwitterReputation("https://x.com/Lighter_xyz") or getTwitterReputation("Lighter_xyz")
 */
export async function getTwitterReputation(twitterUrlOrUsername: string): Promise<EthosScore | null> {
  const username = extractTwitterUsername(twitterUrlOrUsername);
  if (!username) {
    console.warn('Invalid Twitter URL or username:', twitterUrlOrUsername);
    return null;
  }

  try {
    console.log('🔍 Fetching Ethos profile for Twitter @', username);
    
    // Use v2 API to get user data by Twitter username
    const response = await fetch(
      `${ETHOS_BASE_URL}/api/v2/user/by/x/${username}`,
      {
        headers: {
          'X-Ethos-Client': CLIENT_HEADER,
        },
        cache: 'no-store',
      }
    );

    if (!response.ok) {
      console.log(`❌ Ethos v2 user API returned ${response.status} for Twitter @${username}`);
      return null;
    }

    const data = await response.json();
    
    // Extract score and stats from the response
    const score = data.score || 0;
    const stats = data.stats || {};
    
    // Calculate level based on Ethos official score ranges
    let level = 'unknown';
    if (score >= 2600) {
      level = 'renowned';
    } else if (score >= 2400) {
      level = 'revered';
    } else if (score >= 2200) {
      level = 'distinguished';
    } else if (score >= 2000) {
      level = 'exemplary';
    } else if (score >= 1800) {
      level = 'reputable';
    } else if (score >= 1600) {
      level = 'established';
    } else if (score >= 1400) {
      level = 'known';
    } else if (score >= 1200) {
      level = 'neutral';
    } else if (score >= 800) {
      level = 'questionable';
    } else if (score > 0) {
      level = 'untrusted';
    }
    
    return {
      score,
      level,
      positiveReviews: stats.review?.received?.positive || 0,
      negativeReviews: stats.review?.received?.negative || 0,
      neutralReviews: stats.review?.received?.neutral || 0,
      vouchesReceived: stats.vouch?.received?.count || 0,
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
 * Get reputation tier based on Ethos official score ranges
 */
export function getReputationTier(level?: string): {
  label: string;
  color: string;
  bgColor: string;
  textColor: string;
} {
  const normalizedLevel = (level || 'unknown').toLowerCase();
  
  switch (normalizedLevel) {
    case 'renowned': // 2600-2800 - Purple
      return {
        label: 'Renowned',
        color: 'text-purple-500',
        bgColor: 'bg-purple-500/5',
        textColor: 'text-zinc-400',
      };
    case 'revered': // 2400-2599 - Light Purple
      return {
        label: 'Revered',
        color: 'text-purple-400',
        bgColor: 'bg-purple-400/5',
        textColor: 'text-zinc-400',
      };
    case 'distinguished': // 2200-2399 - Light Green
      return {
        label: 'Distinguished',
        color: 'text-green-300',
        bgColor: 'bg-green-300/5',
        textColor: 'text-zinc-400',
      };
    case 'exemplary': // 2000-2199 - Green
      return {
        label: 'Exemplary',
        color: 'text-green-500',
        bgColor: 'bg-green-500/5',
        textColor: 'text-zinc-400',
      };
    case 'reputable': // 1800-1999 - Blue
      return {
        label: 'Reputable',
        color: 'text-blue-400',
        bgColor: 'bg-blue-500/5',
        textColor: 'text-zinc-400',
      };
    case 'established': // 1600-1799 - Light Blue
      return {
        label: 'Established',
        color: 'text-cyan-400',
        bgColor: 'bg-cyan-400/5',
        textColor: 'text-zinc-400',
      };
    case 'known': // 1400-1599 - Blue/Grey
      return {
        label: 'Known',
        color: 'text-slate-300',
        bgColor: 'bg-slate-400/5',
        textColor: 'text-zinc-400',
      };
    case 'neutral': // 1200-1399 - White
      return {
        label: 'Neutral',
        color: 'text-zinc-200',
        bgColor: 'bg-zinc-200/5',
        textColor: 'text-zinc-400',
      };
    case 'questionable': // 800-1199 - Yellow
      return {
        label: 'Questionable',
        color: 'text-yellow-400',
        bgColor: 'bg-yellow-400/5',
        textColor: 'text-zinc-400',
      };
    case 'untrusted': // 0-799 - Red
      return {
        label: 'Untrusted',
        color: 'text-red-500',
        bgColor: 'bg-red-500/5',
        textColor: 'text-zinc-400',
      };
    case 'unknown':
    default:
      return {
        label: 'Unknown',
        color: 'text-zinc-500',
        bgColor: 'bg-zinc-600/5',
        textColor: 'text-zinc-500',
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

