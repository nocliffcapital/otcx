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
      setError(true);
      return;
    }

    // Add a timeout to prevent hanging
    const timeoutId = setTimeout(() => {
      setError(true);
      setLoading(false);
    }, 10000); // 10 second timeout

    async function fetchMetadata() {
      try {
        const httpUrl = ipfsToHttp(metadataURI!);
        const response = await fetch(httpUrl, {
          signal: AbortSignal.timeout(8000), // 8 second fetch timeout
        });
        
        if (!response.ok) {
          throw new Error(`Failed to fetch metadata: ${response.status}`);
        }

        const metadata = await response.json();
        const imageUri = imageType === 'icon' ? metadata.iconUrl : metadata.logoUrl;
        
        if (imageUri) {
          setImageUrl(ipfsToHttp(imageUri));
          setError(false);
        } else {
          setError(true);
        }
      } catch (err) {
        // Silently handle errors - just show fallback
        console.warn('Could not fetch project image from IPFS:', metadataURI, err);
        setError(true);
      } finally {
        clearTimeout(timeoutId);
        setLoading(false);
      }
    }

    fetchMetadata();
    
    return () => clearTimeout(timeoutId);
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

