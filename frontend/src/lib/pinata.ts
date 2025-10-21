/**
 * Pinata IPFS Upload Helpers
 * 
 * Phase 1: Admin uploads logos and metadata to Pinata
 * Both files and JSON are stored on IPFS for decentralized, permanent storage
 */

export interface ProjectMetadata {
  slug: string;
  description: string;
  twitterUrl?: string;
  websiteUrl?: string;
  logoUrl: string;  // ipfs:// URL for full logo
  iconUrl: string;  // ipfs:// URL for round icon
  tags?: string[];
  // Add more fields as needed
}

/**
 * Upload an image file to Pinata
 * @param file - The logo/image file (File object from input)
 * @returns IPFS CID (content identifier)
 */
export async function uploadImageToPinata(file: File): Promise<string> {
  const formData = new FormData();
  formData.append('file', file);
  
  // Optional: Add metadata about the file
  const pinataMetadata = JSON.stringify({
    name: file.name,
    keyvalues: {
      type: 'project-logo',
      uploadedAt: new Date().toISOString()
    }
  });
  formData.append('pinataMetadata', pinataMetadata);

  const response = await fetch('/api/pinata/upload-file', {
    method: 'POST',
    body: formData
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to upload image to Pinata');
  }

  const { cid } = await response.json();
  return cid;
}

/**
 * Upload JSON metadata to Pinata
 * @param metadata - Project metadata object
 * @returns IPFS CID (content identifier)
 */
export async function uploadMetadataToPinata(metadata: ProjectMetadata): Promise<string> {
  const response = await fetch('/api/pinata/upload-json', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(metadata)
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to upload metadata to Pinata');
  }

  const { cid } = await response.json();
  return cid;
}

/**
 * Fetch metadata from IPFS
 * @param ipfsUri - IPFS URI (ipfs://Qm... or https://ipfs.io/ipfs/Qm...)
 * @returns Parsed metadata object
 */
export async function fetchMetadataFromIPFS(ipfsUri: string): Promise<ProjectMetadata> {
  // Convert ipfs:// to https:// gateway URL
  const httpUrl = ipfsUri.startsWith('ipfs://')
    ? `https://gateway.pinata.cloud/ipfs/${ipfsUri.slice(7)}`
    : ipfsUri;

  const response = await fetch(httpUrl);
  if (!response.ok) {
    throw new Error('Failed to fetch metadata from IPFS');
  }

  return response.json();
}

/**
 * Convert IPFS URI to HTTP gateway URL
 * @param ipfsUri - IPFS URI (ipfs://Qm...)
 * @param gateway - Gateway to use (default: Pinata)
 * @returns HTTP URL
 */
export function ipfsToHttp(ipfsUri: string, gateway = 'https://gateway.pinata.cloud/ipfs/'): string {
  if (!ipfsUri) return '';
  if (ipfsUri.startsWith('http')) return ipfsUri;
  if (ipfsUri.startsWith('ipfs://')) {
    return `${gateway}${ipfsUri.slice(7)}`;
  }
  return `${gateway}${ipfsUri}`;
}

/**
 * Helper to get optimized image URL from IPFS
 * Pinata supports query parameters for image optimization
 */
export function getOptimizedImageUrl(
  ipfsUri: string,
  options?: {
    width?: number;
    height?: number;
    quality?: number;
  }
): string {
  const baseUrl = ipfsToHttp(ipfsUri);
  
  if (!options) return baseUrl;
  
  const params = new URLSearchParams();
  if (options.width) params.set('img-width', options.width.toString());
  if (options.height) params.set('img-height', options.height.toString());
  if (options.quality) params.set('img-quality', options.quality.toString());
  
  const queryString = params.toString();
  return queryString ? `${baseUrl}?${queryString}` : baseUrl;
}

