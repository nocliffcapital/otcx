# Color Standardization Guide

## Consistent Color Coding Across OTCX Platform

### Asset Types
- **Tokens**: `bg-blue-600` (Blue)
- **Points**: `bg-purple-600` (Purple)

### Project Status / Lifecycle
- **Live/Active**: `bg-green-600` (Green)
- **Ended**: `bg-red-600/80` (Red with opacity)

### Order Types
- **Buy Orders**: `bg-green-600` or `text-green-400` (Green)
- **Sell Orders**: `bg-red-600` or `text-red-400` (Red)

### Tab Badges (Markets & Admin)
- **Live/Active Tab**: `bg-green-600` (Green)
- **Ended Tab**: `bg-red-600/70` (Red with 70% opacity) - Softer red

### Dashboard Tabs
- **Open Orders**: `bg-cyan-600` (Cyan)
- **Filled Orders**: `bg-violet-600` (Violet)
- **Ended Settlements**: `bg-green-600` (Green)

### Order Type in Dashboard
- **Private Orders**: `bg-purple-600` (Purple)

### Special States
- **TGE Active**: `bg-yellow-600` (Yellow)
- **Primary Stable**: `bg-cyan-600` (Cyan)
- **Approved Collateral**: `bg-violet-600` (Violet)

### Pricing Colors
- **Last Price**: `text-blue-400` (Blue)
- **Best Ask (Sell)**: `text-red-400` (Red)
- **Best Bid (Buy)**: `text-green-400` (Green)

## Files Updated for Consistency

### ✅ Markets Page (`frontend/src/app/(routes)/markets/page.tsx`)
- Asset types: Blue (Tokens), Purple (Points)
- Status: Green (Live), Red (Ended)
- Tab badges: Green (Live), Emerald (Ended)
- Removed "Upcoming" status completely

### ✅ Admin Page (`frontend/src/app/(routes)/admin/page.tsx`)
- Asset types: Blue (Tokens), Purple (Points)
- Status: Green (Active), Red (Ended)
- Tab badges: Green (Active), Emerald (Ended)
- Removed "Upcoming" status completely
- Collateral badges: Cyan (Primary), Violet (Approved)

### ✅ Markets Detail Page (`frontend/src/app/(routes)/markets/[slug]/page.tsx`)
- Order types: Green (Buy), Red (Sell)
- TGE Active: Yellow
- Filled orders: Blue

### ✅ Dashboard (`frontend/src/app/(routes)/dashboard/page.tsx`)
- Tab badges: Blue (Open), Violet (Filled), Emerald (Settled)
- Order types: Green (Buy), Red (Sell)
- Private orders: Purple

### ✅ Private Order Page (`frontend/src/app/(routes)/private-order/page.tsx`)
- Asset types: Blue (Tokens), Purple (Points)

### ✅ How It Works Page (`frontend/src/app/(routes)/how-it-works/page.tsx`)
- Asset types: Blue (Tokens), Purple (Points)
- Order types: Red (Sell), Green (Buy)

## Comprehensive Audit Results

### ✅ All Pages Checked:

1. **Markets Page** (`/markets`)
   - Asset types: ✅ Blue (Tokens), Purple (Points)
   - Status badges: ✅ Green (Live), Red (Ended)
   - Tab badges: ✅ Green (Live), Emerald (Ended)
   - Pricing colors: ✅ Blue (Last), Red (Ask), Green (Bid)

2. **Markets Detail Page** (`/markets/[slug]`)
   - Order sections: ✅ Green (Buy), Red (Sell), Blue (Filled)
   - TGE Active: ✅ Yellow
   - Order type badges: ✅ Red/Green with opacity

3. **Admin Page** (`/admin`)
   - Asset types: ✅ Blue (Tokens), Purple (Points)
   - Status badges: ✅ Green (Active), Red (Ended)
   - Tab badges: ✅ Green (Active), Emerald (Ended), Zinc (All)
   - Collateral: ✅ Cyan (Primary), Violet (Approved)
   - Contract status: ✅ Red (Paused), Green (Active)

4. **Dashboard** (`/dashboard`)
   - Tab badges: ✅ Cyan (Open), Violet (Filled), Emerald (Settled)
   - Order types: ✅ Green (Buy), Red (Sell)
   - Private orders: ✅ Purple, Public: Zinc

5. **Private Order Page** (`/private-order`)
   - Asset types: ✅ Blue (Tokens), Purple (Points)

6. **How It Works** (`/how-it-works`)
   - Asset types: ✅ Blue (Tokens), Purple (Points)
   - Order types: ✅ Red (Sell), Green (Buy)

## Summary

**Removed:**
- "Upcoming" status from all pages (Markets, Admin)
- Yellow badges for upcoming projects

**Fixed:**
- Dashboard "Open Orders" tab changed from Orange to Cyan
- Markets & Admin "Ended" tab badge changed from Emerald to Red (now matches status badge)
- Dashboard "Ended Settlements" tab badge changed from Emerald to Green

**Standardized:**
- All asset type badges use consistent colors across the platform
- All order type badges use consistent colors (Green = Buy, Red = Sell)
- All status badges use consistent colors (Green = Live/Active, Red = Ended)
- Tab highlighting uses consistent colors across pages
- All tab badges use distinct, consistent colors

