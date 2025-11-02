/**
 * Automatic Proof Validation System
 * Validates block explorer transaction URLs against order details
 */

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  status: 'APPROVED' | 'NOT_APPROVED' | 'MANUAL_REVIEW';
  transactionDetails?: {
    hash: string;
    from: string;
    to: string;
    tokenAddress: string;
    amount: bigint;
  };
}

/**
 * Extract transaction hash from a block explorer URL
 */
export function extractTxHash(url: string): string | null {
  // Match various block explorer URL patterns
  const patterns = [
    /\/tx\/(0x[a-fA-F0-9]{64})/i, // sepolia.etherscan.io/tx/0x...
    /\/tx\/0x([a-fA-F0-9]{64})/i, // With or without 0x prefix
    /#\/tx\/txid\/(0x[a-fA-F0-9]{64})/i, // Some explorers use #/tx/txid/
    /transaction\/(0x[a-fA-F0-9]{64})/i, // Alternative format
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) {
      // Ensure it starts with 0x
      return match[1].startsWith('0x') ? match[1] : `0x${match[1]}`;
    }
  }

  // If it's already a transaction hash (0x...)
  if (/^0x[a-fA-F0-9]{64}$/i.test(url.trim())) {
    return url.trim();
  }

  return null;
}

/**
 * Validate that URL belongs to the expected block explorer
 * This is the minimum security check - ensures users can't submit fake URLs
 */
export function validateExplorerUrl(url: string, expectedExplorer: string): boolean {
  try {
    const urlObj = new URL(url);
    const expectedObj = new URL(expectedExplorer);
    
    // Strict validation: domain must exactly match
    // This prevents phishing/fake URLs like "sepolia-etherscan.io" or "sepolia.etherscan.io.fake.com"
    return urlObj.hostname === expectedObj.hostname || 
           urlObj.hostname.endsWith('.' + expectedObj.hostname) || // Subdomain check
           (urlObj.hostname.startsWith('www.') && urlObj.hostname.replace('www.', '') === expectedObj.hostname);
  } catch {
    return false;
  }
}

/**
 * Get block explorer API endpoint based on explorer URL
 */
export function getExplorerApiUrl(explorerUrl: string, txHash: string): string | null {
  try {
    const url = new URL(explorerUrl);
    
    // Etherscan-style APIs (Sepolia, Ethereum mainnet, Arbitrum, Base, Optimism, Polygon)
    if (url.hostname.includes('etherscan.io')) {
      const apiKey = process.env.NEXT_PUBLIC_ETHERSCAN_API_KEY || '';
      const network = url.hostname.includes('sepolia') ? 'api-sepolia' : 
                      url.hostname.includes('goerli') ? 'api-goerli' : 'api';
      return `https://${network}.etherscan.io/api?module=proxy&action=eth_getTransactionByHash&txhash=${txHash}&apikey=${apiKey}`;
    } else if (url.hostname.includes('arbiscan.io')) {
      const apiKey = process.env.NEXT_PUBLIC_ARBISCAN_API_KEY || '';
      return `https://api.arbiscan.io/api?module=proxy&action=eth_getTransactionByHash&txhash=${txHash}&apikey=${apiKey}`;
    } else if (url.hostname.includes('basescan.org')) {
      const apiKey = process.env.NEXT_PUBLIC_BASESCAN_API_KEY || '';
      return `https://api.basescan.org/api?module=proxy&action=eth_getTransactionByHash&txhash=${txHash}&apikey=${apiKey}`;
    } else if (url.hostname.includes('optimistic.etherscan.io')) {
      const apiKey = process.env.NEXT_PUBLIC_OPTIMISM_API_KEY || '';
      return `https://api-optimistic.etherscan.io/api?module=proxy&action=eth_getTransactionByHash&txhash=${txHash}&apikey=${apiKey}`;
    } else if (url.hostname.includes('polygonscan.com')) {
      const apiKey = process.env.NEXT_PUBLIC_POLYGONSCAN_API_KEY || '';
      return `https://api.polygonscan.com/api?module=proxy&action=eth_getTransactionByHash&txhash=${txHash}&apikey=${apiKey}`;
    }
    
    return null;
  } catch {
    return null;
  }
}

/**
 * Fetch transaction receipt to get token transfer details (for ERC20 transfers)
 */
export async function getTokenTransferDetails(
  explorerUrl: string,
  txHash: string,
  publicClient: any // viem PublicClient
): Promise<{ from: string; to: string; tokenAddress: string; amount: bigint } | null> {
  try {
    // Try to get transaction receipt via publicClient (more reliable)
    if (publicClient) {
      const receipt = await publicClient.getTransactionReceipt({ hash: txHash as `0x${string}` });
      
      // Find ERC20 Transfer event
      const transferEvent = receipt.logs.find((log: any) => {
        // ERC20 Transfer event signature: Transfer(address,address,uint256)
        // Topic 0: keccak256("Transfer(address,address,uint256)")
        const transferTopic = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';
        return log.topics[0] === transferTopic && log.topics.length === 3;
      });

      if (transferEvent) {
        // Decode Transfer event
        const from = `0x${transferEvent.topics[1].slice(26)}`; // Remove padding
        const to = `0x${transferEvent.topics[2].slice(26)}`;
        const amount = BigInt(transferEvent.data);
        const tokenAddress = transferEvent.address.toLowerCase();
        
        return { from, to, tokenAddress, amount };
      }
    }
    
    return null;
  } catch (error) {
    console.error('Error fetching token transfer details:', error);
    return null;
  }
}

/**
 * Validate proof URL against order details
 * Returns validation result with status: "APPROVED", "NOT_APPROVED", or "MANUAL_REVIEW"
 * 
 * Minimum requirement: Always validates URL format and that it matches expected explorer (admin-set)
 * If transaction details can't be fetched: Falls back to MANUAL_REVIEW (admin opens URL)
 */
export async function validateProof(
  proofUrl: string,
  expectedExplorer: string,
  orderDetails: {
    seller: string;
    buyer: string;
    tokenAddress: string;
    amount: bigint;
    decimals?: number;
  },
  publicClient: any
): Promise<ValidationResult> {
  const errors: string[] = [];

  // STEP 1: Always validate URL format and extract transaction hash (minimum requirement)
  const txHash = extractTxHash(proofUrl);
  if (!txHash) {
    return {
      isValid: false,
      errors: ['Invalid transaction URL or hash format'],
      status: 'NOT_APPROVED',
    };
  }

  // STEP 2: Always validate explorer URL matches expected (admin set this during TGE activation)
  if (!validateExplorerUrl(proofUrl, expectedExplorer)) {
    return {
      isValid: false,
      errors: [`URL must be from expected block explorer: ${expectedExplorer}. This proof cannot be automatically validated.`],
      status: 'NOT_APPROVED',
    };
  }

  // STEP 3: Try to fetch transaction details (RPC → API → Scraping)
  let transferDetails = null;
  
  // Try RPC first (if chain matches)
  try {
    transferDetails = await getTokenTransferDetails(expectedExplorer, txHash, publicClient);
  } catch (error) {
    console.log('RPC fetch failed, trying explorer API...', error);
  }

  // If RPC failed, try Explorer API (no key needed for reads)
  if (!transferDetails) {
    try {
      transferDetails = await fetchViaExplorerAPI(expectedExplorer, txHash);
    } catch (error) {
      console.log('Explorer API failed, trying scraping...', error);
    }
  }

  // If API failed, try web scraping (final fallback)
  if (!transferDetails) {
    try {
      transferDetails = await fetchViaScraping(expectedExplorer, txHash);
    } catch (error) {
      console.log('Scraping failed, marking for manual review...', error);
    }
  }

  // If we couldn't fetch transaction details, mark for manual review
  if (!transferDetails) {
    return {
      isValid: false,
      errors: ['Could not fetch transaction details automatically. Please review manually by opening the URL.'],
      status: 'MANUAL_REVIEW',
    };
  }

  // STEP 4: If we have transaction details, validate all fields
  // Validate sender (from) matches seller
  const sellerLower = orderDetails.seller.toLowerCase();
  const fromLower = transferDetails.from.toLowerCase();
  if (fromLower !== sellerLower) {
    errors.push(`Sender address mismatch. Expected: ${orderDetails.seller}, Got: ${transferDetails.from}`);
  }

  // Validate receiver (to) matches buyer
  const buyerLower = orderDetails.buyer.toLowerCase();
  const toLower = transferDetails.to.toLowerCase();
  if (toLower !== buyerLower) {
    errors.push(`Receiver address mismatch. Expected: ${orderDetails.buyer}, Got: ${transferDetails.to}`);
  }

  // Validate token contract matches
  const expectedTokenLower = orderDetails.tokenAddress.toLowerCase();
  const tokenLower = transferDetails.tokenAddress.toLowerCase();
  if (tokenLower !== expectedTokenLower) {
    errors.push(`Token contract mismatch. Expected: ${orderDetails.tokenAddress}, Got: ${transferDetails.tokenAddress}`);
  }

  // Validate amount matches (with some tolerance for rounding)
  const amountDiff = transferDetails.amount > orderDetails.amount 
    ? transferDetails.amount - orderDetails.amount
    : orderDetails.amount - transferDetails.amount;
  
  // Allow 1% tolerance for rounding differences
  const tolerance = orderDetails.amount / BigInt(100);
  if (amountDiff > tolerance) {
    errors.push(`Amount mismatch. Expected: ${orderDetails.amount.toString()}, Got: ${transferDetails.amount.toString()}`);
  }

  // Return result based on validation
  if (errors.length === 0) {
    return {
      isValid: true,
      errors: [],
      transactionDetails: transferDetails,
      status: 'APPROVED',
    };
  } else {
    return {
      isValid: false,
      errors,
      transactionDetails: transferDetails,
      status: 'NOT_APPROVED',
    };
  }
}

/**
 * Fetch transaction details via Explorer API (no key needed for basic reads)
 */
async function fetchViaExplorerAPI(explorerUrl: string, txHash: string): Promise<{ from: string; to: string; tokenAddress: string; amount: bigint } | null> {
  try {
    const apiUrl = getExplorerApiUrl(explorerUrl, txHash);
    if (!apiUrl) return null;

    const response = await fetch(apiUrl);
    const data = await response.json();
    
    if (data.status === '1' && data.result) {
      // Parse transaction receipt from API response
      // This would need to be explorer-specific
      // For now, return null and fall back to scraping
      return null;
    }
    
    return null;
  } catch (error) {
    console.error('Explorer API fetch failed:', error);
    return null;
  }
}

/**
 * Fetch transaction details via web scraping (final fallback)
 */
async function fetchViaScraping(explorerUrl: string, txHash: string): Promise<{ from: string; to: string; tokenAddress: string; amount: bigint } | null> {
  try {
    // Construct full URL
    const txUrl = explorerUrl.includes('/tx/') 
      ? `${explorerUrl.split('/tx/')[0]}/tx/${txHash}`
      : `${explorerUrl}/tx/${txHash}`;
    
    // Note: Direct scraping from browser has CORS issues
    // This would need to be done via a backend API route
    // For now, return null and mark for manual review
    return null;
  } catch (error) {
    console.error('Scraping failed:', error);
    return null;
  }
}

