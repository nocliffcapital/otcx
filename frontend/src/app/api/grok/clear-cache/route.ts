import { NextRequest, NextResponse } from 'next/server';

// This should match the cache from the main route
// In a production app, you'd use Redis or a shared cache
// For now, this is a simple endpoint to help with testing

export async function POST(request: NextRequest) {
  // Simple auth check (you can add a secret key here)
  const authHeader = request.headers.get('authorization');
  
  // For now, allow anyone to clear cache (remove in production or add proper auth)
  return NextResponse.json({
    message: 'Cache is stored in-memory per serverless function instance. To clear cache, trigger a new deployment or wait for cache TTL (4 hours).',
    info: 'Use ?refresh=true parameter on the main endpoint to bypass cache for a single request.',
  });
}

export async function GET() {
  return NextResponse.json({
    message: 'Use POST to clear cache',
    info: 'Cache is stored per serverless function instance and clears on cold starts',
  });
}

