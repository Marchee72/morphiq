/**
 * Media Cache Service for Exercises Dataset
 * Hotlinks images/GIFs from jsDelivr CDN and caches in Cache Storage for offline use.
 */

const CDN_BASE_URL = 'https://cdn.jsdelivr.net/gh/hasaneyldrm/exercises-dataset@main/';
const CACHE_NAME = 'morphiq-exercise-media';

export function getCdnUrl(relPath: string): string {
  if (!relPath) return '';
  if (relPath.startsWith('http://') || relPath.startsWith('https://')) {
    return relPath;
  }
  const cleanPath = relPath.startsWith('/') ? relPath.slice(1) : relPath;
  return `${CDN_BASE_URL}${cleanPath}`;
}

export async function fetchCachedMedia(relPath: string): Promise<string> {
  const fullUrl = getCdnUrl(relPath);
  if (!fullUrl) return '';

  if (typeof window === 'undefined' || !('caches' in window)) {
    return fullUrl;
  }

  try {
    const cache = await window.caches.open(CACHE_NAME);
    const cachedResponse = await cache.match(fullUrl);
    if (cachedResponse) {
      const blob = await cachedResponse.blob();
      return URL.createObjectURL(blob);
    }

    const response = await fetch(fullUrl, { mode: 'cors' });
    if (response.ok) {
      cache.put(fullUrl, response.clone()).catch(() => {});
      const blob = await response.blob();
      return URL.createObjectURL(blob);
    }
  } catch {
    // Fallback to direct CDN URL on network or cache error
  }

  return fullUrl;
}
