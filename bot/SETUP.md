# Telegram Bot Setup Guide

Follow these steps to set up and run the otcX Telegram bot.

## Step 1: Create a Telegram Bot

1. **Open Telegram** and search for [@BotFather](https://t.me/botfather)

2. **Send `/newbot`** and follow the instructions:
   - Choose a name for your bot (e.g., "otcX Notifications")
   - Choose a username (e.g., "otcx_notifications_bot")
   - You'll receive a bot token like: `123456789:ABCdefGHIjklMNOpqrsTUVwxyz`

3. **Save your bot token** - you'll need it in Step 3

## Step 2: Get Your Chat ID

You need to send the bot messages to a Telegram chat (channel or group).

### Option A: Personal Chat
1. Start a chat with your bot
2. Send any message to the bot
3. Visit: `https://api.telegram.org/bot<YOUR_BOT_TOKEN>/getUpdates`
   - Replace `<YOUR_BOT_TOKEN>` with your actual token
4. Look for `"chat":{"id":<CHAT_ID>}` in the response
   - Personal chats have negative IDs (e.g., `-123456789`)

### Option B: Channel (Recommended)
1. Create a new Telegram channel
2. Add your bot as an administrator
3. Post a message in the channel
4. Visit: `https://api.telegram.org/bot<YOUR_BOT_TOKEN>/getUpdates`
5. Look for the channel ID (usually starts with `-100`)

### Option C: Group
1. Create a new Telegram group
2. Add your bot to the group
3. Send a message in the group
4. Visit: `https://api.telegram.org/bot<YOUR_BOT_TOKEN>/getUpdates`
5. Look for the group ID (usually negative, e.g., `-123456789`)

**Note:** Channel IDs typically look like `-1001234567890` and group IDs like `-123456789`.

## Step 3: Set Up Environment Variables

1. **Navigate to the bot directory:**
   ```bash
   cd bot
   ```

2. **Create a `.env` file:**
   ```bash
   cp .env.example .env
   ```

3. **Edit `.env` with your configuration:**
   ```env
   # Telegram Bot Configuration
   TELEGRAM_BOT_TOKEN=123456789:ABCdefGHIjklMNOpqrsTUVwxyz
   TELEGRAM_CHAT_ID=-1001234567890

   # Blockchain Configuration
   RPC_URL=https://sepolia.infura.io/v3/YOUR_INFURA_KEY
   CHAIN_ID=11155111

   # Contract Addresses
   ORDERBOOK_ADDRESS=0xYourOrderbookAddress
   REGISTRY_ADDRESS=0xYourRegistryAddress

   # Explorer URL (optional, for links in messages)
   EXPLORER_URL=https://sepolia.etherscan.io
   ```

### Getting an RPC URL

You need an Ethereum RPC endpoint. Options:

**Infura (Free tier available):**
1. Go to [infura.io](https://infura.io)
2. Create an account
3. Create a new project
4. Copy the HTTPS endpoint (e.g., `https://sepolia.infura.io/v3/YOUR_KEY`)

**Alchemy (Free tier available):**
1. Go to [alchemy.com](https://alchemy.com)
2. Create an account
3. Create a new app
4. Copy the HTTPS URL (e.g., `https://eth-sepolia.g.alchemy.com/v2/YOUR_KEY`)

**Public RPC (Less reliable, for testing only):**
- Sepolia: `https://rpc.sepolia.org`
- Mainnet: `https://eth.llamarpc.com`

### Finding Contract Addresses

If you deployed the contracts yourself, use those addresses.

Otherwise, check:
- Deployment scripts in `contracts/script/`
- Broadcast artifacts in `contracts/broadcast/`
- Environment variables in your frontend

## Step 4: Install Dependencies

```bash
cd bot
npm install
```

## Step 5: Build and Run

### Development Mode (with auto-reload):
```bash
npm run dev
```

### Production Mode:
```bash
npm run build
npm start
```

## Step 6: Verify It's Working

1. The bot should send a startup message to your Telegram chat:
   ```
   🚀 otcX Bot Started
   
   Monitoring blockchain events...
   ```

2. Test by triggering an event (e.g., add a new project via admin panel)

3. You should receive notifications in Telegram when:
   - ✨ A new market is added
   - 🚀 TGE is activated for a project
   - 🔄 Project status changes (activated/deactivated)

## Running in Production

### Using PM2 (Recommended)

1. **Install PM2 globally:**
   ```bash
   npm install -g pm2
   ```

2. **Build the bot:**
   ```bash
   npm run build
   ```

3. **Start with PM2:**
   ```bash
   pm2 start dist/index.js --name otcx-bot
   ```

4. **View logs:**
   ```bash
   pm2 logs otcx-bot
   ```

5. **Stop the bot:**
   ```bash
   pm2 stop otcx-bot
   ```

6. **Restart on reboot:**
   ```bash
   pm2 save
   pm2 startup
   ```

### Using Docker

Create a `Dockerfile`:
```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
RUN npm run build
CMD ["node", "dist/index.js"]
```

Then:
```bash
docker build -t otcx-bot .
docker run -d --name otcx-bot --env-file .env otcx-bot
```

### Using systemd (Linux)

1. **Create service file** `/etc/systemd/system/otcx-bot.service`:
   ```ini
   [Unit]
   Description=otcX Telegram Bot
   After=network.target

   [Service]
   Type=simple
   User=your-username
   WorkingDirectory=/path/to/otcx/bot
   ExecStart=/usr/bin/node dist/index.js
   Restart=always
   RestartSec=10
   Environment=NODE_ENV=production

   [Install]
   WantedBy=multi-user.target
   ```

2. **Enable and start:**
   ```bash
   sudo systemctl enable otcx-bot
   sudo systemctl start otcx-bot
   sudo systemctl status otcx-bot
   ```

## Troubleshooting

### Bot not sending messages
- ✅ Verify `TELEGRAM_BOT_TOKEN` is correct
- ✅ Verify `TELEGRAM_CHAT_ID` is correct
- ✅ Make sure bot is added to the channel/group
- ✅ Check bot has permission to send messages in the channel

### Events not detected
- ✅ Verify `RPC_URL` is accessible (test with curl or Postman)
- ✅ Check contract addresses are correct
- ✅ Verify `CHAIN_ID` matches your deployment
- ✅ Check bot logs for errors

### High RPC usage
- The bot polls every 12 seconds
- Consider using a private RPC endpoint for better rate limits
- Adjust polling interval in `src/eventListener.ts` if needed

### Bot stops after a while
- Use PM2 or systemd to auto-restart
- Check logs for errors: `pm2 logs otcx-bot` or `journalctl -u otcx-bot -f`

## Configuration Reference

| Variable | Required | Description |
|----------|----------|-------------|
| `TELEGRAM_BOT_TOKEN` | ✅ Yes | Token from @BotFather |
| `TELEGRAM_CHAT_ID` | ✅ Yes | Chat/Channel ID to send messages |
| `RPC_URL` | ✅ Yes | Ethereum RPC endpoint |
| `CHAIN_ID` | ✅ Yes | Chain ID (1 for mainnet, 11155111 for Sepolia) |
| `ORDERBOOK_ADDRESS` | ✅ Yes | EscrowOrderBookV4 contract address |
| `REGISTRY_ADDRESS` | ✅ Yes | ProjectRegistryV2 contract address |
| `EXPLORER_URL` | ❌ No | Block explorer URL for links (defaults to Sepolia) |

## Next Steps

Once the bot is running:
1. Add a test project to verify notifications work
2. Activate TGE for a project to test TGE notifications
3. Monitor logs to ensure everything is working smoothly

Need help? Check the main README.md or open an issue!
