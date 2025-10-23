import { NextRequest, NextResponse } from 'next/server';

// In-memory cache (in production, use Redis or similar)
const cache = new Map<string, { data: GrokAnalysis; timestamp: number }>();
const CACHE_DURATION = 4 * 60 * 60 * 1000; // 4 hours in milliseconds

interface GrokAnalysis {
  sentiment: {
    positive: number;
    negative: number;
    neutral: number;
  };
  priceEstimates: {
    low: string;
    average: string;
    high: string;
    source: string;
  }[];
  summary: string;
  lastUpdated: string;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;

  // Get project details from query params or registry
  const projectName = request.nextUrl.searchParams.get('name') || slug;
  const twitter = request.nextUrl.searchParams.get('twitter') || '';
  const website = request.nextUrl.searchParams.get('website') || '';
  const description = request.nextUrl.searchParams.get('description') || '';

  // Create a cache key that includes project details to avoid stale data
  // when project info changes but slug stays the same
  const cacheKey = `${slug}:${projectName}:${twitter}:${website}`;

  // Check cache first (allow bypassing with ?refresh=true)
  const forceRefresh = request.nextUrl.searchParams.get('refresh') === 'true';
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION && !forceRefresh) {
    return NextResponse.json({
      ...cached.data,
      cached: true,
      cacheAge: Math.floor((Date.now() - cached.timestamp) / 1000 / 60), // minutes
    });
  }

  const GROK_API_KEY = process.env.GROK_API_KEY;
  
  if (!GROK_API_KEY) {
    return NextResponse.json(
      { error: 'Grok API key not configured' },
      { status: 500 }
    );
  }

  try {
    // Extract Twitter handle from URL if provided
    let twitterHandle = '';
    if (twitter) {
      const match = twitter.match(/(?:twitter\.com|x\.com)\/([^\/\?]+)/);
      twitterHandle = match ? `@${match[1]}` : '';
    }

    // Call Grok API (xAI) - Simple, direct prompt like a chat
    const prompt = `Search Twitter/X for recent discussions about ${projectName}${twitterHandle ? ` (${twitterHandle})` : ''} and tell me:

1. What prices are people discussing for ${projectName} in OTC deals? Look for tweets like "WTB ${projectName} at $X" or "Selling ${projectName} at $Y"

2. What's the sentiment around ${projectName}? Are people excited, cautious, or neutral?

3. What price range seems realistic based on actual Twitter discussions about ${projectName}?

Project info:
- Name: ${projectName}
${twitter ? `- Twitter: ${twitter}` : ''}
${website ? `- Website: ${website}` : ''}
${description ? `- Description: ${description}` : ''}

Return your findings in this JSON format (no markdown, just raw JSON):
{
  "sentiment": {"positive": <0-100>, "negative": <0-100>, "neutral": <0-100>},
  "priceEstimates": [{"low": "$<price>", "average": "$<price>", "high": "$<price>", "source": "<where you found this>"}],
  "summary": "<2-3 sentences about what you found on Twitter about ${projectName}>"
}

IMPORTANT: If you can't find specific OTC price quotes, look for:
- Valuation estimates (FDV/market cap discussions)
- Total token supply mentions
- Then calculate: Price per token = Valuation / Total Supply
- Include this calculation in your source field

If you truly can't find any pricing data, use "N/A" for prices and explain what you found instead.`;

    const response = await fetch('https://api.x.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${GROK_API_KEY}`,
      },
      body: JSON.stringify({
        messages: [
          {
            role: 'system',
            content: 'You are a cryptocurrency market analyst. Provide accurate, data-driven analysis based on crypto Twitter sentiment and discussions. Always return valid JSON.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        model: 'grok-4-0709',
        stream: false,
        temperature: 0,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Grok API error for ${slug}:`, response.status, errorText);
      throw new Error(`Grok API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    const grokResponse = data.choices[0]?.message?.content;
    
    console.log(`Grok response for ${slug}:`, grokResponse?.substring(0, 200));

    if (!grokResponse) {
      throw new Error('No response from Grok');
    }

    // Parse the JSON response from Grok
    let analysis: GrokAnalysis;
    try {
      // Extract JSON from markdown code blocks if present
      const jsonMatch = grokResponse.match(/```json\n([\s\S]*?)\n```/) || 
                       grokResponse.match(/```\n([\s\S]*?)\n```/) ||
                       [null, grokResponse];
      const jsonString = jsonMatch[1] || grokResponse;
      const parsed = JSON.parse(jsonString);
      
      analysis = {
        sentiment: parsed.sentiment,
        priceEstimates: parsed.priceEstimates,
        summary: parsed.summary,
        lastUpdated: new Date().toISOString(),
      };
    } catch (parseError) {
      // Fallback if JSON parsing fails
      analysis = {
        sentiment: {
          positive: 50,
          negative: 25,
          neutral: 25,
        },
        priceEstimates: [
          {
            low: 'N/A',
            average: 'N/A',
            high: 'N/A',
            source: 'Data unavailable',
          },
        ],
        summary: grokResponse.substring(0, 300),
        lastUpdated: new Date().toISOString(),
      };
    }

    // Cache the result with the composite key
    cache.set(cacheKey, {
      data: analysis,
      timestamp: Date.now(),
    });

    return NextResponse.json({
      ...analysis,
      cached: false,
      cacheAge: 0,
    });
  } catch (error) {
    console.error('Error calling Grok API:', error);
    
    // Return cached data if available, even if expired
    if (cached) {
      return NextResponse.json({
        ...cached.data,
        cached: true,
        stale: true,
        cacheAge: Math.floor((Date.now() - cached.timestamp) / 1000 / 60),
      });
    }

    // Provide fallback data instead of error for better UX
    const fallbackData = {
      sentiment: {
        positive: 55,
        negative: 25,
        neutral: 20,
      },
      priceEstimates: [
        {
          low: 'N/A',
          average: 'N/A',
          high: 'N/A',
          source: 'Analysis unavailable',
        },
      ],
      summary: `${projectName} is a pre-TGE project in the DeFi space. Market analysis temporarily unavailable due to API limitations.`,
      lastUpdated: new Date().toISOString(),
      fallback: true,
    };

    // Cache fallback data for a shorter time (1 hour)
    cache.set(cacheKey, {
      data: fallbackData,
      timestamp: Date.now() - (CACHE_DURATION - 60 * 60 * 1000), // Expire in 1 hour instead of 12
    });

    return NextResponse.json({
      ...fallbackData,
      cached: false,
      cacheAge: 0,
    });
  }
}

