export const ORDERBOOK_ADDRESS = process.env.NEXT_PUBLIC_ORDERBOOK as `0x${string}`;
export const STABLE_ADDRESS = process.env.NEXT_PUBLIC_STABLE as `0x${string}`;
export const STABLE_DECIMALS = Number(process.env.NEXT_PUBLIC_STABLE_DECIMALS || 6);
export const REGISTRY_ADDRESS = process.env.NEXT_PUBLIC_REGISTRY as `0x${string}`;

export const ERC20_ABI = [
  { "type": "function", "name": "approve", "inputs": [{ "name": "spender", "type": "address" }, { "name": "amount", "type": "uint256" }], "outputs": [{ "name": "", "type": "bool" }], "stateMutability": "nonpayable" },
  { "type": "function", "name": "allowance", "inputs": [{ "name": "owner", "type": "address" }, { "name": "spender", "type": "address" }], "outputs": [{ "name": "", "type": "uint256" }], "stateMutability": "view" },
  { "type": "function", "name": "balanceOf", "inputs": [{ "name": "account", "type": "address" }], "outputs": [{ "name": "", "type": "uint256" }], "stateMutability": "view" },
  { "type": "function", "name": "decimals", "inputs": [], "outputs": [{ "name": "", "type": "uint8" }], "stateMutability": "view" },
  { "type": "function", "name": "mint", "inputs": [{ "name": "to", "type": "address" }, { "name": "amount", "type": "uint256" }], "outputs": [], "stateMutability": "nonpayable" }
] as const;

// V2 ABI with TGE settlement support
export const ESCROW_ORDERBOOK_ABI = [
  { "type": "constructor", "inputs": [{ "name": "stableToken", "type": "address", "internalType": "address" }], "stateMutability": "nonpayable" },
  { "type": "function", "name": "activateTGE", "inputs": [{ "name": "id", "type": "uint256" }, { "name": "actualToken", "type": "address" }], "outputs": [], "stateMutability": "nonpayable" },
  { "type": "function", "name": "batchActivateTGE", "inputs": [{ "name": "projectToken", "type": "address" }, { "name": "actualToken", "type": "address" }], "outputs": [], "stateMutability": "nonpayable" },
  { "type": "function", "name": "actualTokenAddress", "inputs": [{ "name": "", "type": "uint256" }], "outputs": [{ "name": "", "type": "address" }], "stateMutability": "view" },
  { "type": "function", "name": "cancel", "inputs": [{ "name": "id", "type": "uint256" }], "outputs": [], "stateMutability": "nonpayable" },
  { "type": "function", "name": "claimTokens", "inputs": [{ "name": "id", "type": "uint256" }], "outputs": [], "stateMutability": "nonpayable" },
  { "type": "function", "name": "createBuyOrder", "inputs": [
    { "name": "amount", "type": "uint256" },
    { "name": "unitPrice", "type": "uint256" },
    { "name": "projectToken", "type": "address" }
  ], "outputs": [{ "name": "id", "type": "uint256" }], "stateMutability": "nonpayable" },
  { "type": "function", "name": "createSellOrder", "inputs": [
    { "name": "amount", "type": "uint256" },
    { "name": "unitPrice", "type": "uint256" },
    { "name": "projectToken", "type": "address" }
  ], "outputs": [{ "name": "id", "type": "uint256" }], "stateMutability": "nonpayable" },
  { "type": "function", "name": "defaultSeller", "inputs": [{ "name": "id", "type": "uint256" }], "outputs": [], "stateMutability": "nonpayable" },
  { "type": "function", "name": "depositBuyerFunds", "inputs": [{ "name": "id", "type": "uint256" }], "outputs": [], "stateMutability": "nonpayable" },
  { "type": "function", "name": "depositSellerCollateral", "inputs": [{ "name": "id", "type": "uint256" }], "outputs": [], "stateMutability": "nonpayable" },
  { "type": "function", "name": "depositTokensForSettlement", "inputs": [{ "name": "id", "type": "uint256" }], "outputs": [], "stateMutability": "nonpayable" },
  { "type": "function", "name": "extendSettlement", "inputs": [{ "name": "id", "type": "uint256" }, { "name": "extensionHours", "type": "uint256" }], "outputs": [], "stateMutability": "nonpayable" },
  { "type": "function", "name": "getOrder", "inputs": [{ "name": "id", "type": "uint256" }], "outputs": [{
    "type": "tuple", "components": [
      { "name": "id", "type": "uint256" },
      { "name": "maker", "type": "address" },
      { "name": "buyer", "type": "address" },
      { "name": "seller", "type": "address" },
      { "name": "projectToken", "type": "address" },
      { "name": "amount", "type": "uint256" },
      { "name": "unitPrice", "type": "uint256" },
      { "name": "buyerFunds", "type": "uint256" },
      { "name": "sellerCollateral", "type": "uint256" },
      { "name": "settlementDeadline", "type": "uint64" },
      { "name": "isSell", "type": "bool" },
      { "name": "tokensDeposited", "type": "bool" },
      { "name": "status", "type": "uint8" }
    ]
  }], "stateMutability": "view" },
  { "type": "function", "name": "getSettlementStatus", "inputs": [{ "name": "id", "type": "uint256" }], "outputs": [
    { "name": "tgeActivated", "type": "bool" },
    { "name": "deadline", "type": "uint64" },
    { "name": "tokensDeposited", "type": "bool" },
    { "name": "isOverdue", "type": "bool" }
  ], "stateMutability": "view" },
  { "type": "function", "name": "manualSettle", "inputs": [{ "name": "id", "type": "uint256" }], "outputs": [], "stateMutability": "nonpayable" },
  { "type": "function", "name": "nextId", "inputs": [], "outputs": [{ "name": "", "type": "uint256" }], "stateMutability": "view" },
  { "type": "function", "name": "proofSubmittedAt", "inputs": [{ "name": "", "type": "uint256" }], "outputs": [{ "name": "", "type": "uint64" }], "stateMutability": "view" },
  { "type": "function", "name": "settlementProof", "inputs": [{ "name": "", "type": "uint256" }], "outputs": [{ "name": "", "type": "string" }], "stateMutability": "view" },
  { "type": "function", "name": "submitProof", "inputs": [{ "name": "id", "type": "uint256" }, { "name": "proof", "type": "string" }], "outputs": [], "stateMutability": "nonpayable" },
  { "type": "function", "name": "orders", "inputs": [{ "name": "", "type": "uint256" }], "outputs": [
    { "name": "id", "type": "uint256" },
    { "name": "maker", "type": "address" },
    { "name": "buyer", "type": "address" },
    { "name": "seller", "type": "address" },
    { "name": "projectToken", "type": "address" },
    { "name": "amount", "type": "uint256" },
    { "name": "unitPrice", "type": "uint256" },
    { "name": "buyerFunds", "type": "uint256" },
    { "name": "sellerCollateral", "type": "uint256" },
    { "name": "settlementDeadline", "type": "uint64" },
    { "name": "isSell", "type": "bool" },
    { "name": "tokensDeposited", "type": "bool" },
    { "name": "status", "type": "uint8" }
  ], "stateMutability": "view" },
  { "type": "function", "name": "owner", "inputs": [], "outputs": [{ "name": "", "type": "address" }], "stateMutability": "view" },
  { "type": "function", "name": "pause", "inputs": [], "outputs": [], "stateMutability": "nonpayable" },
  { "type": "function", "name": "paused", "inputs": [], "outputs": [{ "name": "", "type": "bool" }], "stateMutability": "view" },
  { "type": "function", "name": "takeBuyOrder", "inputs": [{ "name": "id", "type": "uint256" }], "outputs": [], "stateMutability": "nonpayable" },
  { "type": "function", "name": "takeSellOrder", "inputs": [{ "name": "id", "type": "uint256" }], "outputs": [], "stateMutability": "nonpayable" },
  { "type": "function", "name": "stable", "inputs": [], "outputs": [{ "name": "", "type": "address" }], "stateMutability": "view" },
  { "type": "function", "name": "stableDecimals", "inputs": [], "outputs": [{ "name": "", "type": "uint8" }], "stateMutability": "view" },
  { "type": "function", "name": "transferOwnership", "inputs": [{ "name": "newOwner", "type": "address" }], "outputs": [], "stateMutability": "nonpayable" },
  { "type": "function", "name": "unpause", "inputs": [], "outputs": [], "stateMutability": "nonpayable" }
] as const;

export const PROJECT_REGISTRY_ABI = [
  { "type": "function", "name": "addProject", "inputs": [
    { "name": "slug", "type": "string" },
    { "name": "name", "type": "string" },
    { "name": "tokenAddress", "type": "address" },
    { "name": "assetType", "type": "string" },
    { "name": "twitterUrl", "type": "string" },
    { "name": "websiteUrl", "type": "string" },
    { "name": "description", "type": "string" },
    { "name": "logoUrl", "type": "string" }
  ], "outputs": [], "stateMutability": "nonpayable" },
  { "type": "function", "name": "getActiveProjects", "inputs": [], "outputs": [{
    "name": "", "type": "tuple[]", "components": [
      { "name": "slug", "type": "string" },
      { "name": "name", "type": "string" },
      { "name": "tokenAddress", "type": "address" },
      { "name": "assetType", "type": "string" },
      { "name": "active", "type": "bool" },
      { "name": "addedAt", "type": "uint256" },
      { "name": "twitterUrl", "type": "string" },
      { "name": "websiteUrl", "type": "string" },
      { "name": "description", "type": "string" },
      { "name": "logoUrl", "type": "string" }
    ]
  }], "stateMutability": "view" },
  { "type": "function", "name": "getAllSlugs", "inputs": [], "outputs": [{ "name": "", "type": "string[]" }], "stateMutability": "view" },
  { "type": "function", "name": "getProject", "inputs": [{ "name": "slug", "type": "string" }], "outputs": [{
    "name": "", "type": "tuple", "components": [
      { "name": "slug", "type": "string" },
      { "name": "name", "type": "string" },
      { "name": "tokenAddress", "type": "address" },
      { "name": "assetType", "type": "string" },
      { "name": "active", "type": "bool" },
      { "name": "addedAt", "type": "uint256" },
      { "name": "twitterUrl", "type": "string" },
      { "name": "websiteUrl", "type": "string" },
      { "name": "description", "type": "string" },
      { "name": "logoUrl", "type": "string" }
    ]
  }], "stateMutability": "view" },
  { "type": "function", "name": "getProjectCount", "inputs": [], "outputs": [{ "name": "", "type": "uint256" }], "stateMutability": "view" },
  { "type": "function", "name": "owner", "inputs": [], "outputs": [{ "name": "", "type": "address" }], "stateMutability": "view" },
  { "type": "function", "name": "projects", "inputs": [{ "name": "", "type": "string" }], "outputs": [
    { "name": "slug", "type": "string" },
    { "name": "name", "type": "string" },
    { "name": "tokenAddress", "type": "address" },
    { "name": "assetType", "type": "string" },
    { "name": "active", "type": "bool" },
    { "name": "addedAt", "type": "uint256" },
    { "name": "twitterUrl", "type": "string" },
    { "name": "websiteUrl", "type": "string" },
    { "name": "description", "type": "string" },
    { "name": "logoUrl", "type": "string" }
  ], "stateMutability": "view" },
  { "type": "function", "name": "setProjectStatus", "inputs": [
    { "name": "slug", "type": "string" },
    { "name": "active", "type": "bool" }
  ], "outputs": [], "stateMutability": "nonpayable" },
  { "type": "function", "name": "slugExists", "inputs": [{ "name": "", "type": "string" }], "outputs": [{ "name": "", "type": "bool" }], "stateMutability": "view" },
  { "type": "function", "name": "slugs", "inputs": [{ "name": "", "type": "uint256" }], "outputs": [{ "name": "", "type": "string" }], "stateMutability": "view" },
  { "type": "function", "name": "transferOwnership", "inputs": [{ "name": "newOwner", "type": "address" }], "outputs": [], "stateMutability": "nonpayable" },
  { "type": "function", "name": "updateProject", "inputs": [
    { "name": "slug", "type": "string" },
    { "name": "name", "type": "string" },
    { "name": "tokenAddress", "type": "address" },
    { "name": "assetType", "type": "string" },
    { "name": "twitterUrl", "type": "string" },
    { "name": "websiteUrl", "type": "string" },
    { "name": "description", "type": "string" },
    { "name": "logoUrl", "type": "string" }
  ], "outputs": [], "stateMutability": "nonpayable" }
] as const;
