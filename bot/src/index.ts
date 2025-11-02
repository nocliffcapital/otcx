import { OtcXTelegramBot } from './telegramBot';
import { EventListener } from './eventListener';
import { config } from './config';

async function main() {
  console.log('🤖 otcX Telegram Bot Starting...');
  console.log('📋 Configuration:');
  console.log(`   Chain ID: ${config.blockchain.chainId}`);
  console.log(`   Orderbook: ${config.contracts.orderbook}`);
  console.log(`   Registry: ${config.contracts.registry}`);
  console.log(`   Chat ID: ${config.telegram.chatId}`);
  console.log('\n📢 Monitoring:');
  console.log('   ✨ New markets added');
  console.log('   🚀 TGE activations');
  console.log('   🔄 Project status changes\n');

  try {
    // Initialize Telegram bot
    const telegramBot = new OtcXTelegramBot();
    
    // Send startup message
    await telegramBot.sendMessage('🚀 *otcX Bot Started*\n\nMonitoring blockchain events...');

    // Initialize event listener
    const eventListener = new EventListener(telegramBot);
    
    // Start listening
    await eventListener.start();

    // Graceful shutdown
    process.on('SIGINT', async () => {
      console.log('\n🛑 Shutting down...');
      eventListener.stop();
      await telegramBot.sendMessage('🛑 *otcX Bot Stopped*\n\nBot is shutting down.');
      process.exit(0);
    });

    process.on('SIGTERM', async () => {
      console.log('\n🛑 Shutting down...');
      eventListener.stop();
      await telegramBot.sendMessage('🛑 *otcX Bot Stopped*\n\nBot is shutting down.');
      process.exit(0);
    });

    console.log('✅ Bot is running. Press Ctrl+C to stop.');
  } catch (error) {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  }
}

main();
