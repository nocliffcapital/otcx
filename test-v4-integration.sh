#!/bin/bash
echo "🔍 V4 Integration Check"
echo "========================"
echo ""

echo "✅ Checking ABI imports..."
echo "  - contracts.ts should import EscrowOrderBookV4ABI"
grep -n "EscrowOrderBookV4ABI" frontend/src/lib/contracts.ts && echo "    ✅ V4 ABI imported" || echo "    ❌ Still using V3 ABI"

echo ""
echo "✅ Checking environment variables..."
echo "  - .env.local should have Sepolia contract addresses"
if [ -f frontend/.env.local ]; then
  echo "    ✅ .env.local exists"
  grep "NEXT_PUBLIC_ORDERBOOK" frontend/.env.local | head -1
  grep "NEXT_PUBLIC_REGISTRY" frontend/.env.local | head -1
else
  echo "    ❌ .env.local not found"
fi

echo ""
echo "✅ Checking for deprecated function calls..."
echo "  - Searching for old V3 functions..."
OLD_FUNCS=$(grep -r "batchActivateTGE\|activateTGE" frontend/src --include="*.tsx" --include="*.ts" | grep -v "activateProjectTGE" | grep -v "// V4:" | grep -v "comment" | wc -l)
if [ "$OLD_FUNCS" -eq 0 ]; then
  echo "    ✅ No deprecated function calls found"
else
  echo "    ⚠️  Found $OLD_FUNCS potential deprecated function calls:"
  grep -rn "batchActivateTGE\|\"activateTGE\"" frontend/src --include="*.tsx" --include="*.ts" | grep -v "activateProjectTGE" | grep -v "// V4:"
fi

echo ""
echo "✅ Checking V4 specific features..."
echo "  - Looking for activateProjectTGE usage..."
grep -rn "activateProjectTGE" frontend/src --include="*.tsx" --include="*.ts" | head -3

echo ""
echo "✅ Checking for V4 ABI file..."
if [ -f frontend/src/lib/abis/EscrowOrderBookV4.abi.json ]; then
  echo "    ✅ V4 ABI file exists"
  V4_FUNCS=$(grep -o '"name":"[^"]*"' frontend/src/lib/abis/EscrowOrderBookV4.abi.json | grep "activateProjectTGE" | wc -l)
  if [ "$V4_FUNCS" -gt 0 ]; then
    echo "    ✅ V4 functions found in ABI"
  else
    echo "    ❌ V4 functions not found in ABI"
  fi
else
  echo "    ❌ V4 ABI file not found"
fi

echo ""
echo "========================"
echo "📋 Summary"
echo "========================"
