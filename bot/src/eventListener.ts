import { createPublicClient, http, PublicClient, getEventSignature, decodeEventLog } from 'viem';
import { mainnet, sepolia } from 'viem/chains';
import { config } from './config';
import { OtcXTelegramBot } from './telegramBot';

// Event signatures for EscrowOrderBookV4
const ESCROW_EVENTS = {
  ProjectTGEActivated: 'ProjectTGEActivated(bytes32,address,uint64,uint256)',
} as const;

// Event signatures for ProjectRegistryV2
const REGISTRY_EVENTS = {
  ProjectAdded: 'ProjectAdded(bytes32,string,string)',
  ProjectStatusChanged: 'ProjectStatusChanged(bytes32,bool)',
  ProjectUpdated: 'ProjectUpdated(bytes32,string,address)',
} as const;

export class EventListener {
  private publicClient: PublicClient;
  private telegramBot: OtcXTelegramBot;
  private isRunning: boolean = false;
  private pollInterval: NodeJS.Timeout | null = null;

  constructor(telegramBot: OtcXTelegramBot) {
    const chain = config.blockchain.chainId === 1 ? mainnet : sepolia;
    
    this.publicClient = createPublicClient({
      chain,
      transport: http(config.blockchain.rpcUrl),
    });
    
    this.telegramBot = telegramBot;
  }

  async start(): Promise<void> {
    if (this.isRunning) {
      console.log('⚠️ Event listener is already running');
      return;
    }

    console.log('🚀 Starting event listener...');
    this.isRunning = true;

    // Get the latest block to start listening from
    let lastBlock = await this.publicClient.getBlockNumber();
    console.log(`📦 Starting from block ${lastBlock}`);

    // Start polling for new events every 12 seconds (block time on Ethereum)
    this.pollInterval = setInterval(async () => {
      lastBlock = await this.pollEvents(lastBlock);
    }, 12000);

    // Initial poll
    lastBlock = await this.pollEvents(lastBlock);
  }

  stop(): void {
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }
    this.isRunning = false;
    console.log('🛑 Event listener stopped');
  }

  private async pollEvents(fromBlock: bigint): Promise<bigint> {
    try {
      const currentBlock = await this.publicClient.getBlockNumber();
      
      if (currentBlock <= fromBlock) {
        return fromBlock; // No new blocks
      }

      // Fetch events from both contracts
      await Promise.all([
        this.fetchEscrowEvents(fromBlock, currentBlock),
        this.fetchRegistryEvents(fromBlock, currentBlock),
      ]);
      
      return currentBlock; // Return new block number
    } catch (error) {
      console.error('❌ Error polling events:', error);
      return fromBlock;
    }
  }

  private async fetchEscrowEvents(fromBlock: bigint, toBlock: bigint): Promise<void> {
    try {
      const logs = await this.publicClient.getLogs({
        address: config.contracts.orderbook,
        fromBlock,
        toBlock,
        strict: false, // Don't fail if block doesn't exist yet
      });

      for (const log of logs) {
        try {
          await this.handleEscrowEvent(log);
        } catch (error) {
          console.error('❌ Error handling escrow event:', error);
        }
      }
    } catch (error) {
      console.error('❌ Error fetching escrow events:', error);
    }
  }

  private async fetchRegistryEvents(fromBlock: bigint, toBlock: bigint): Promise<void> {
    try {
      const logs = await this.publicClient.getLogs({
        address: config.contracts.registry,
        fromBlock,
        toBlock,
        strict: false,
      });

      for (const log of logs) {
        try {
          await this.handleRegistryEvent(log);
        } catch (error) {
          console.error('❌ Error handling registry event:', error);
        }
      }
    } catch (error) {
      console.error('❌ Error fetching registry events:', error);
    }
  }

  private async handleEscrowEvent(log: any): Promise<void> {
    const eventSignature = log.topics[0];
    
    // Only handle TGE activation
    if (eventSignature === getEventSignature(ESCROW_EVENTS.ProjectTGEActivated)) {
      const decoded = decodeEventLog({
        abi: [{
          type: 'event',
          name: 'ProjectTGEActivated',
          inputs: [
            { type: 'bytes32', indexed: true, name: 'projectId' },
            { type: 'address', indexed: false, name: 'tokenAddress' },
            { type: 'uint64', indexed: false, name: 'deadline' },
            { type: 'uint256', indexed: false, name: 'conversionRatio' },
          ],
        }],
        data: log.data,
        topics: log.topics,
      });
      
      await this.telegramBot.onTGEActivated(
        decoded.args.projectId as string,
        decoded.args.tokenAddress as string,
        decoded.args.deadline as bigint,
        decoded.args.conversionRatio as bigint
      );
    }
  }

  private async handleRegistryEvent(log: any): Promise<void> {
    const eventSignature = log.topics[0];
    
    if (eventSignature === getEventSignature(REGISTRY_EVENTS.ProjectAdded)) {
      const decoded = decodeEventLog({
        abi: [{
          type: 'event',
          name: 'ProjectAdded',
          inputs: [
            { type: 'bytes32', indexed: true, name: 'id' },
            { type: 'string', indexed: false, name: 'name' },
            { type: 'string', indexed: false, name: 'metadataURI' },
          ],
        }],
        data: log.data,
        topics: log.topics,
      });
      
      await this.telegramBot.onProjectAdded(
        decoded.args.id as string,
        decoded.args.name as string,
        decoded.args.metadataURI as string
      );
    } else if (eventSignature === getEventSignature(REGISTRY_EVENTS.ProjectStatusChanged)) {
      const decoded = decodeEventLog({
        abi: [{
          type: 'event',
          name: 'ProjectStatusChanged',
          inputs: [
            { type: 'bytes32', indexed: true, name: 'id' },
            { type: 'bool', indexed: false, name: 'active' },
          ],
        }],
        data: log.data,
        topics: log.topics,
      });
      
      await this.telegramBot.onProjectStatusChanged(
        decoded.args.id as string,
        decoded.args.active as boolean
      );
    }
  }
}
