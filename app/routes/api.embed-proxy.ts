/**
 * Embeddables Proxy API Route
 * 
 * This route proxies requests to the Embeddables engine with caching support.
 * It caches the response from the native Embed API to improve performance and
 * reduce load on the external service.
 */

import type { Route } from './+types/api.embed-proxy';
import { cacheManager, cacheConfig } from '../services/cache';

/**
 * Loader function that handles GET requests to proxy Embeddables API
 */
export async function loader({ request }: Route.LoaderArgs) {
  try {
    // Parse request URL to get query parameters
    const url = new URL(request.url);
    const loadParam = url.searchParams.get('load');
    const engineDomain = url.searchParams.get('engine_domain') || 'engine.embeddables.com';

    if (!loadParam) {
      return Response.json({ error: 'Missing load parameter' }, { status: 400 });
    }

    // Create cache key based on request parameters
    const cacheKey = `embed_${engineDomain}_${Buffer.from(loadParam).toString('base64').slice(0, 50)}`;

    // Try to get cached data first
    const cachedData = await cacheManager.get(cacheKey);
    
    if (cachedData) {
      console.log('[EmbedProxy] Serving from cache:', cacheKey);
      
      return Response.json({
        ...cachedData,
        _cache_meta: {
          cached: true,
          timestamp: Date.now(),
          source: 'cache',
        },
      });
    }

    // If no cache, fetch from native Embed API
    console.log('[EmbedProxy] Fetching from native Embed:', engineDomain);
    
    const urlRoot = engineDomain.startsWith('http') ? engineDomain : `https://${engineDomain}`;
    const embedUrl = `${urlRoot}/init?load=${encodeURIComponent(loadParam)}`;

    const embedResponse = await fetch(embedUrl, {
      signal: request.signal,
      headers: {
        'User-Agent': 'Qure-Telehealth-Proxy/1.0',
      },
    });

    if (!embedResponse.ok) {
      throw new Error(`Embed API returned ${embedResponse.status}`);
    }

    const embedData = await embedResponse.json();

    // Save to cache if caching is enabled
    if (cacheManager.isEnabled()) {
      await cacheManager.set(cacheKey, embedData);
      console.log('[EmbedProxy] Saved to cache:', cacheKey);
    }

    // Return response with cache metadata
    return Response.json({
      ...embedData,
      _cache_meta: {
        cached: false,
        timestamp: Date.now(),
        source: 'native',
        cache_enabled: cacheConfig.enabled,
      },
    });

  } catch (error) {
    console.error('[EmbedProxy] Error:', error);
    
    return Response.json(
      { 
        error: 'Failed to fetch embeddables data',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
