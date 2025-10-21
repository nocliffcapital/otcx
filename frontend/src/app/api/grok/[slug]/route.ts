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

  // Check cache first (allow bypassing with ?refresh=true)
  const forceRefresh = request.nextUrl.searchParams.get('refresh') === 'true';
  const cached = cache.get(slug);
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION && !forceRefresh) {
    return NextResponse.json({
      ...cached.data,
      cached: true,
      cacheAge: Math.floor((Date.now() - cached.timestamp) / 1000 / 60), // minutes
    });
  }

  // Get project details from query params or registry
  const projectName = request.nextUrl.searchParams.get('name') || slug;
  const twitter = request.nextUrl.searchParams.get('twitter') || '';
  const website = request.nextUrl.searchParams.get('website') || '';
  const description = request.nextUrl.searchParams.get('description') || '';

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

    // Call Grok API (xAI)
    const prompt = `Analyze the cryptocurrency/DeFi project ${twitterHandle ? `"${twitterHandle}"` : `called "${projectName}"`}.

${twitterHandle ? `CRITICAL: Search Twitter/X using "${twitterHandle}" for the LATEST tweets and discussions about this project's TOKEN PRICE. Look for recent price discussions, OTC deals, valuation estimates, and FDV (Fully Diluted Valuation) mentions from the past 24-48 hours.` : ''}

Provide:
1. **Sentiment Analysis**: Based on recent social media discussions (positive/negative/neutral percentages)
2. **Price Estimates**: What prices are people ACTUALLY discussing and trading at RIGHT NOW on Twitter? Look for:
   - OTC deals being mentioned
   - Price per token estimates
   - Valuation/FDV discussions
   - "Buying at X" or "Selling at Y" posts
3. **Summary**: 2-sentence project description and current market sentiment

${description ? `Context: ${description}` : ''}
${twitter ? `Twitter: ${twitter}` : ''}
${website ? `Website: ${website}` : ''}

IMPORTANT: Price estimates should reflect REAL current discussions, not generic guesses. If you see Twitter discussions mentioning "$100" or "$150", use those actual numbers.

Return ONLY valid JSON (no markdown, no code blocks):
{
  "sentiment": {"positive": 65, "negative": 20, "neutral": 15},
  "priceEstimates": [{"low": "$90", "average": "$120", "high": "$150", "source": "Twitter OTC market"}],
  "summary": "Brief summary based on latest discussions."
}`;

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
        model: 'grok-2-1212',
        stream: false,
        temperature: 0.7,
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

    // Cache the result
    cache.set(slug, {
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
    cache.set(slug, {
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

