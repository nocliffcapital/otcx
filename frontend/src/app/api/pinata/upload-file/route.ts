import { NextRequest, NextResponse } from 'next/server';

/**
 * API Route: Upload file (logo/image) to Pinata IPFS
 * 
 * Accepts multipart/form-data with a 'file' field
 * Returns the IPFS CID
 */
export async function POST(request: NextRequest) {
  try {
    // Get the file from the form data
    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      );
    }

    // Validate file type (images only)
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml'];
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { error: 'Invalid file type. Only images are allowed.' },
        { status: 400 }
      );
    }

    // Validate file size (max 5MB)
    const maxSize = 5 * 1024 * 1024; // 5MB
    if (file.size > maxSize) {
      return NextResponse.json(
        { error: 'File too large. Maximum size is 5MB.' },
        { status: 400 }
      );
    }

    // Check for Pinata credentials (JWT or API Key)
    const pinataJwt = process.env.PINATA_JWT;
    const pinataApiKey = process.env.PINATA_API_KEY;
    const pinataSecretKey = process.env.PINATA_SECRET_KEY;

    if (!pinataJwt && (!pinataApiKey || !pinataSecretKey)) {
      console.error('Pinata credentials not configured');
      return NextResponse.json(
        { error: 'IPFS upload not configured. Please add PINATA_JWT to .env.local' },
        { status: 500 }
      );
    }

    // Create form data for Pinata
    const pinataFormData = new FormData();
    pinataFormData.append('file', file);

    // Add metadata
    const metadata = JSON.stringify({
      name: file.name,
      keyvalues: {
        type: 'project-logo',
        uploadedAt: new Date().toISOString(),
        contentType: file.type
      }
    });
    pinataFormData.append('pinataMetadata', metadata);

    // Upload to Pinata (use JWT if available, otherwise API key)
    const headers: Record<string, string> = pinataJwt
      ? { 'Authorization': `Bearer ${pinataJwt}` }
      : {
          'pinata_api_key': pinataApiKey!,
          'pinata_secret_api_key': pinataSecretKey!
        };

    const response = await fetch('https://api.pinata.cloud/pinning/pinFileToIPFS', {
      method: 'POST',
      headers,
      body: pinataFormData
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

