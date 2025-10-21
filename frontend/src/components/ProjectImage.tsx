'use client';

import { useState, useEffect } from 'react';
import { ipfsToHttp } from '@/lib/pinata';

interface ProjectImageProps {
  metadataURI?: string;
  imageType: 'icon' | 'logo';
  className?: string;
  fallbackText?: string;
}

/**
 * Component that fetches metadata from IPFS and displays the appropriate image
 * Handles loading states and fallbacks
 */
export function ProjectImage({ 
  metadataURI, 
  imageType, 
  className = '', 
  fallbackText = '?' 
}: ProjectImageProps) {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!metadataURI) {
      setLoading(false);
      return;
    }

    async function fetchMetadata() {
      try {
        const httpUrl = ipfsToHttp(metadataURI!);
        const response = await fetch(httpUrl);
        
        if (!response.ok) {
          throw new Error('Failed to fetch metadata');
        }

        const metadata = await response.json();
        const imageUri = imageType === 'icon' ? metadata.iconUrl : metadata.logoUrl;
        
        if (imageUri) {
          setImageUrl(ipfsToHttp(imageUri));
        } else {
          setError(true);
        }
      } catch (err) {
        console.error('Error fetching project image:', err);
        setError(true);
      } finally {
        setLoading(false);
      }
    }

    fetchMetadata();
  }, [metadataURI, imageType]);

  // Loading state
  if (loading) {
    return (
      <div className={`${className} bg-zinc-800/50 animate-pulse flex items-center justify-center`}>
        <div className="w-4 h-4 border-2 border-zinc-600 border-t-zinc-400 rounded-full animate-spin" />
      </div>
    );
  }

  // Error or no image
  if (error || !imageUrl) {
    return (
      <div className={`${className} bg-gradient-to-br from-zinc-800 to-zinc-900 flex items-center justify-center text-zinc-500 font-bold`}>
        {fallbackText}
      </div>
    );
  }

  // Success - show image
  return (
    <img 
      src={imageUrl} 
      alt={`Project ${imageType}`}
      className={className}
      onError={() => setError(true)}
    />
  );
}

