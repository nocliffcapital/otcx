import dotenv from 'dotenv';

dotenv.config();

export const config = {
  telegram: {
    botToken: process.env.TELEGRAM_BOT_TOKEN || '',
    chatId: process.env.TELEGRAM_CHAT_ID || '',
  },
  blockchain: {
    rpcUrl: process.env.RPC_URL || '',
    chainId: parseInt(process.env.CHAIN_ID || '11155111'),
  },
  contracts: {
    orderbook: (process.env.ORDERBOOK_ADDRESS || '') as `0x${string}`,
    registry: (process.env.REGISTRY_ADDRESS || '') as `0x${string}`,
  },
  explorer: {
    url: process.env.EXPLORER_URL || 'https://sepolia.etherscan.io',
  },
};

// Validate required config
if (!config.telegram.botToken) {
  throw new Error('TELEGRAM_BOT_TOKEN is required');
}
if (!config.telegram.chatId) {
  throw new Error('TELEGRAM_CHAT_ID is required');
}
if (!config.blockchain.rpcUrl) {
  throw new Error('RPC_URL is required');
}
if (!config.contracts.orderbook) {
  throw new Error('ORDERBOOK_ADDRESS is required');
}
if (!config.contracts.registry) {
  throw new Error('REGISTRY_ADDRESS is required');
}
