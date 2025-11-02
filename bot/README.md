# otcX Telegram Bot

A Telegram bot that monitors the otcX smart contracts and posts notifications for:
- ✨ New markets added
- 📦 Order status changes (created, funded, settled, canceled, defaulted)
- 🚀 TGE activations
- 📝 Proof submissions and reviews
- ✅ Project status changes

## Setup

### 1. Create a Telegram Bot

1. Open Telegram and search for [@BotFather](https://t.me/botfather)
2. Send `/newbot` and follow the instructions
3. Save the bot token you receive
4. Get your chat ID:
   - Add the bot to your channel/group
   - Send a message to the channel
   - Visit `https://api.telegram.org/bot<YOUR_BOT_TOKEN>/getUpdates`
   - Look for `"chat":{"id":<CHAT_ID>}` in the response

### 2. Install Dependencies

```bash
cd bot
npm install
```

### 3. Configure Environment

Create a `.env` file (copy from `.env.example`):

```bash
cp .env.example .env
```

Edit `.env` with your configuration:

```env
# Telegram Bot Configuration
TELEGRAM_BOT_TOKEN=your_bot_token_here
TELEGRAM_CHAT_ID=your_chat_id_here

# Blockchain Configuration
RPC_URL=https://sepolia.infura.io/v3/your_key_here
CHAIN_ID=11155111

# Contract Addresses
ORDERBOOK_ADDRESS=0x...
REGISTRY_ADDRESS=0x...

# Optional: Explorer URL for links
EXPLORER_URL=https://sepolia.etherscan.io
```

### 4. Build and Run

**Development mode:**
```bash
npm run dev
```

**Production mode:**
```bash
npm run build
npm start
```

## Running as a Service

### Using PM2

```bash
# Install PM2 globally
npm install -g pm2

# Start the bot
pm2 start dist/index.js --name otcx-bot

# View logs
pm2 logs otcx-bot

# Stop the bot
pm2 stop otcx-bot
```

### Using systemd (Linux)

Create `/etc/systemd/system/otcx-bot.service`:

```ini
[Unit]
Description=otcX Telegram Bot
After=network.target

[Service]
Type=simple
User=your-user
WorkingDirectory=/path/to/otcx/bot
ExecStart=/usr/bin/node dist/index.js
Restart=always
RestartSec=10
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
```

Then:
```bash
sudo systemctl enable otcx-bot
sudo systemctl start otcx-bot
sudo systemctl status otcx-bot
```

## Features

The bot monitors and posts notifications for:

### Project Registry Events
- **ProjectAdded**: New market listed
- **ProjectStatusChanged**: Project activated/deactivated

### TGE Events
- **ProjectTGEActivated**: TGE activated for a project (4-hour settlement window begins)

## Configuration

All configuration is done via environment variables in `.env`. Required variables:

- `TELEGRAM_BOT_TOKEN`: Your Telegram bot token
- `TELEGRAM_CHAT_ID`: Chat ID where notifications should be sent
- `RPC_URL`: Ethereum RPC endpoint (Infura, Alchemy, etc.)
- `CHAIN_ID`: Chain ID (1 for mainnet, 11155111 for Sepolia)
- `ORDERBOOK_ADDRESS`: EscrowOrderBookV4 contract address
- `REGISTRY_ADDRESS`: ProjectRegistryV2 contract address

## Troubleshooting

### Bot not sending messages
- Verify `TELEGRAM_BOT_TOKEN` is correct
- Verify `TELEGRAM_CHAT_ID` is correct and bot has access to the chat
- Check that bot is not blocked or muted

### Events not detected
- Verify `RPC_URL` is accessible and correct
- Check contract addresses are correct
- Verify network/chain ID matches deployment

### High RPC usage
- The bot polls every 12 seconds by default
- Consider using a private RPC endpoint for better reliability
- Adjust polling interval in `eventListener.ts` if needed

## License

MIT
