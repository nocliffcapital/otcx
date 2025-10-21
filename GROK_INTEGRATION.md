# Grok AI Integration Guide

## Overview

otcX integrates with xAI's Grok API to provide real-time AI-powered market analysis for each project. This feature enhances the platform with intelligent insights from crypto Twitter, sentiment analysis, and price estimates.

## Features

### 1. **Project Information Card**
Displays comprehensive project details:
- Official Twitter/X link
- Project website
- Project description
- Real-time AI analysis

### 2. **Sentiment Analysis**
Grok analyzes crypto Twitter discussions to provide:
- **Positive sentiment** percentage (green)
- **Negative sentiment** percentage (red)
- **Neutral sentiment** percentage (gray)
- Visual sentiment bar for quick assessment

### 3. **Price Estimates**
Aggregated price predictions from crypto Twitter:
- **Low estimate** (conservative target)
- **Average estimate** (consensus target)
- **High estimate** (optimistic target)
- Source attribution for transparency

### 4. **AI Summary**
A concise 2-3 sentence summary of:
- Project overview
- Current market perception
- Key talking points in the community

## Smart Caching System

To minimize API costs and ensure fast load times:
- **12-hour cache duration** per project
- In-memory caching (production: use Redis)
- Cache status displayed to users
- Automatic refresh after expiration
- Fallback to stale cache if API fails

## Setup Instructions

### 1. Get Your Grok API Key

1. Visit [https://x.ai/api](https://x.ai/api)
2. Sign up for an xAI account
3. Navigate to API Keys section
4. Create a new API key
5. Copy the key (format: `xai-...`)

### 2. Configure Environment Variables

Create or update `frontend/.env.local`:

```bash
# Required: Blockchain configuration
NEXT_PUBLIC_RPC=https://eth-sepolia.g.alchemy.com/v2/YOUR_ALCHEMY_KEY
NEXT_PUBLIC_ORDERBOOK=0x23dFa1e657686DB18D6a598dBdf75797416FDB5A
NEXT_PUBLIC_STABLE=0x76fBfc7cE378668DB249850094156338Ee546f83
NEXT_PUBLIC_STABLE_DECIMALS=6
NEXT_PUBLIC_REGISTRY=0x5DC0110b057331018693FfCf96983Fd02c91ad0e

# Optional: Grok AI Analysis
GROK_API_KEY=xai-your-actual-api-key-here
```

**Important**: The `GROK_API_KEY` is **server-side only** and never exposed to the client.

### 3. Restart the Development Server

```bash
cd frontend
npm run dev
```

## Usage

### Viewing AI Analysis

1. Navigate to any project page (e.g., `/project/lighter`)
2. The **AI Market Analysis** card appears at the top
3. View sentiment, price estimates, and summary
4. Click Twitter/Website links to verify information

### Without Grok API Key

If `GROK_API_KEY` is not configured:
- The component gracefully handles the error
- Shows a friendly "Analysis Unavailable" message
- Rest of the platform works normally
- No impact on trading functionality

## API Endpoint

### `GET /api/grok/[slug]`

Fetches AI analysis for a specific project.

**Query Parameters:**
- `name` - Project name
- `twitter` - Twitter URL
- `website` - Website URL
- `description` - Project description

**Response:**
```json
{
  "sentiment": {
    "positive": 65,
    "negative": 20,
    "neutral": 15
  },
  "priceEstimates": [
    {
      "low": "$0.50",
      "average": "$1.20",
      "high": "$2.50",
      "source": "Crypto Twitter consensus"
    }
  ],
  "summary": "Brief AI-generated summary of the project and market sentiment",
  "lastUpdated": "2025-10-20T12:00:00.000Z",
  "cached": true,
  "cacheAge": 45
}
```

## Cost Management

### Pricing Considerations
- Grok API calls are metered
- Each project generates **1 API call per 12 hours** (per server instance)
- With 4 projects and 100 unique visitors per day: ~16 API calls/day (assuming cache hits)
- Estimated cost: **$0.50 - $2.00 per day** (check xAI pricing)

### Optimization Tips

1. **Increase cache duration** for lower traffic:
   ```typescript
   const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours
   ```

2. **Use persistent caching** (Redis/Upstash) in production:
   ```typescript
   // Replace in-memory Map with Redis
   const cached = await redis.get(`grok:${slug}`);
   ```

3. **Pre-generate analysis** during off-peak hours:
   ```bash
   # Cron job to refresh cache
   curl https://yourdomain.com/api/grok/lighter
   curl https://yourdomain.com/api/grok/extended
   # ... etc
   ```

4. **Rate limiting** to prevent abuse:
   ```typescript
   // Add rate limit per IP
   const rateLimit = new RateLimit({
     interval: 60 * 1000, // 1 minute
     max: 10, // 10 requests per minute
   });
   ```

## Troubleshooting

### Error: "Grok API key not configured"
- Ensure `GROK_API_KEY` is set in `.env.local`
- Restart the Next.js server
- Check for typos in the key

### Error: "Failed to fetch analysis"
- Verify API key is valid
- Check xAI service status
- Review server logs for detailed error messages
- Ensure internet connectivity

### Analysis seems outdated
- Cache refreshes every 12 hours automatically
- Clear cache manually by restarting server
- Check `cacheAge` in the UI (shown in minutes)

### API costs too high
- Increase `CACHE_DURATION` in `route.ts`
- Implement Redis for distributed caching
- Add rate limiting per IP address
- Consider pre-generating analysis via cron

## Security Notes

1. **Never expose** `GROK_API_KEY` in client-side code
2. API calls are made from **Next.js API route** (server-side)
3. Consider adding authentication for the `/api/grok` endpoint in production
4. Implement rate limiting to prevent abuse
5. Validate and sanitize user inputs

## Future Enhancements

Potential improvements:
- [ ] Real-time sentiment tracking
- [ ] Historical sentiment charts
- [ ] Token-specific news aggregation
- [ ] Community sentiment vs actual price correlation
- [ ] Multi-language support
- [ ] Custom analysis prompts per project type

## Support

For issues with:
- **Grok API**: Contact [xAI Support](https://x.ai/support)
- **otcX Integration**: Open an issue on GitHub
- **Feature requests**: Submit a pull request

---

**Note**: AI-generated analysis is for informational purposes only. Always do your own research (DYOR). Not financial advice.


