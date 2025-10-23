#!/bin/bash

# Script to update .env.local with correct V4 contract addresses
# Run this from the project root

ENV_FILE="frontend/.env.local"

echo "🔄 Updating contract addresses in $ENV_FILE..."

# Backup the old file
cp "$ENV_FILE" "$ENV_FILE.backup.$(date +%Y%m%d_%H%M%S)"

# Update addresses
sed -i '' 's|NEXT_PUBLIC_ORDERBOOK=.*|NEXT_PUBLIC_ORDERBOOK=0x95a7cB49A83cd4b889bF9Be36E24e65b92B51eb7|g' "$ENV_FILE"
sed -i '' 's|NEXT_PUBLIC_REGISTRY=.*|NEXT_PUBLIC_REGISTRY=0x76E06a3b4e1E42eB9D1f6dC6BcA46E4C227AA7CA|g' "$ENV_FILE"
sed -i '' 's|NEXT_PUBLIC_STABLE=.*|NEXT_PUBLIC_STABLE=0xd5d56a9Cd59550c6D95569620F7eb89C1E4c9101|g' "$ENV_FILE"

echo "✅ Updated addresses:"
echo "   ORDERBOOK: 0x95a7cB49A83cd4b889bF9Be36E24e65b92B51eb7 (NEW V4)"
echo "   REGISTRY:  0x76E06a3b4e1E42eB9D1f6dC6BcA46E4C227AA7CA"
echo "   STABLE:    0xd5d56a9Cd59550c6D95569620F7eb89C1E4c9101"
echo ""
echo "📋 Backup saved to: $ENV_FILE.backup.$(date +%Y%m%d_%H%M%S)"
echo ""
echo "⚠️  IMPORTANT: Restart your frontend server now!"
echo "   Press Ctrl+C in your terminal running 'npm run dev'"
echo "   Then run 'npm run dev' again"

