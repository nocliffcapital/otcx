import TelegramBot from 'node-telegram-bot-api';
import { config } from './config';
import { MessageFormatter } from './messageFormatter';

export class OtcXTelegramBot {
  private bot: TelegramBot;

  constructor() {
    if (!config.telegram.botToken) {
      throw new Error('TELEGRAM_BOT_TOKEN is required');
    }

    this.bot = new TelegramBot(config.telegram.botToken, { polling: false });
    
    // Set parse mode to Markdown by default
    this.bot.setOptions({ parse_mode: 'Markdown' });
  }

  async sendMessage(text: string): Promise<void> {
    try {
      await this.bot.sendMessage(config.telegram.chatId, text);
      console.log(`✅ Message sent to Telegram`);
    } catch (error) {
      console.error('❌ Error sending message to Telegram:', error);
      throw error;
    }
  }

  // Event handlers
  async onProjectAdded(projectId: string, name: string, metadataURI: string): Promise<void> {
    const message = MessageFormatter.formatProjectAdded(projectId, name, metadataURI);
    await this.sendMessage(message);
  }

  async onProjectStatusChanged(projectId: string, active: boolean): Promise<void> {
    const message = MessageFormatter.formatProjectStatusChanged(projectId, active);
    await this.sendMessage(message);
  }

  async onTGEActivated(
    projectId: string,
    tokenAddress: string,
    deadline: bigint,
    conversionRatio: bigint
  ): Promise<void> {
    const message = MessageFormatter.formatTGEActivated(projectId, tokenAddress, deadline, conversionRatio);
    await this.sendMessage(message);
  }
}
