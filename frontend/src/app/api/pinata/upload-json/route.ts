import { NextRequest, NextResponse } from 'next/server';

/**
 * API Route: Upload JSON metadata to Pinata IPFS
 * 
 * Accepts JSON body with project metadata
 * Returns the IPFS CID
 */
export async function POST(request: NextRequest) {
  try {
    // Get the metadata from request body
    const metadata = await request.json();

    if (!metadata || typeof metadata !== 'object') {
      return NextResponse.json(
        { error: 'Invalid metadata format' },
        { status: 400 }
      );
    }

    // Validate required fields
    if (!metadata.slug || !metadata.name) {
      return NextResponse.json(
        { error: 'Missing required fields: slug and name' },
        { status: 400 }
      );
    }

    // Check for Pinata credentials
    const pinataApiKey = process.env.PINATA_API_KEY;
    const pinataSecretKey = process.env.PINATA_SECRET_KEY;

    if (!pinataApiKey || !pinataSecretKey) {
      console.error('Pinata credentials not configured');
      return NextResponse.json(
        { error: 'IPFS upload not configured' },
        { status: 500 }
      );
    }

    // Upload to Pinata
    const response = await fetch('https://api.pinata.cloud/pinning/pinJSONToIPFS', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'pinata_api_key': pinataApiKey,
        'pinata_secret_api_key': pinataSecretKey
      },
      body: JSON.stringify({
        pinataContent: metadata,
        pinataMetadata: {
          name: `otcx-${metadata.slug}`,
          keyvalues: {
            type: 'project-metadata',
            slug: metadata.slug,
            uploadedAt: new Date().toISOString()
          }
        }
      })
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('Pinata upload failed:', error);
      return NextResponse.json(
        { error: 'Failed to upload to IPFS' },
        { status: response.status }
      );
    }

    const result = await response.json();
    
    return NextResponse.json({
      cid: result.IpfsHash,
      size: result.PinSize,
      timestamp: result.Timestamp
    });

  } catch (error) {
    console.error('Upload error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

