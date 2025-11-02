# Quick Start Guide

## Prerequisites
- Node.js 18+ installed
- Telegram account
- RPC endpoint (Infura, Alchemy, or public RPC)

## 5-Minute Setup

### 1. Create Telegram Bot (2 minutes)

1. Open Telegram → Search `@BotFather`
2. Send `/newbot`
3. Follow prompts to create bot
4. **Copy the bot token** (looks like: `123456789:ABCdefGHI...`)

### 2. Get Chat ID (1 minute)

**Option A: Channel (Recommended)**
1. Create a Telegram channel
2. Add your bot as administrator
3. Post a test message
4. Visit: `https://api.telegram.org/bot<YOUR_TOKEN>/getUpdates`
5. Find the chat ID (usually starts with `-100`)

**Option B: Personal Chat**
1. Start a chat with your bot
2. Send `/start`
3. Visit: `https://api.telegram.org/bot<YOUR_TOKEN>/getUpdates`
4. Find your chat ID (negative number)

### 3. Configure Environment (1 minute)

```bash
cd bot
cp .env.example .env
```

Edit `.env`:
```env
TELEGRAM_BOT_TOKEN=your_token_here
TELEGRAM_CHAT_ID=-1001234567890
RPC_URL=https://sepolia.infura.io/v3/YOUR_KEY
CHAIN_ID=11155111
ORDERBOOK_ADDRESS=0x824e07f0fb9076596a5e7c70c19197a410756883
REGISTRY_ADDRESS=0xYourRegistryAddress
EXPLORER_URL=https://sepolia.etherscan.io
```

**Get RPC URL (if needed):**
- Infura: https://infura.io → Sign up → Create project → Copy HTTPS URL
- Alchemy: https://alchemy.com → Sign up → Create app → Copy HTTPS URL

### 4. Install & Run (1 minute)

```bash
npm install
npm run dev
```

You should see:
```
🤖 otcX Telegram Bot Starting...
📋 Configuration:
   Chain ID: 11155111
   Orderbook: 0x824e07f0fb9076596a5e7c70c19197a410756883
   Registry: 0x...
   Chat ID: -1001234567890

📢 Monitoring:
   ✨ New markets added
   🚀 TGE activations
   🔄 Project status changes

✅ Bot is running. Press Ctrl+C to stop.
```

And a startup message in your Telegram chat!

## Test It

1. Add a new project via admin panel
2. Activate TGE for a project
3. You should receive Telegram notifications! 🎉

## Production Deployment

### Using PM2
```bash
npm run build
pm2 start dist/index.js --name otcx-bot
pm2 logs otcx-bot
pm2 save
```

### Using systemd
See `SETUP.md` for detailed systemd service configuration.

## Troubleshooting

**Bot not sending messages?**
- ✅ Check `TELEGRAM_BOT_TOKEN` is correct
- ✅ Check `TELEGRAM_CHAT_ID` is correct
- ✅ Make sure bot is added to channel/group

**No events detected?**
- ✅ Verify `RPC_URL` is accessible
- ✅ Check contract addresses are correct
- ✅ Verify `CHAIN_ID` matches deployment

**Need help?** Check `SETUP.md` for detailed troubleshooting.
