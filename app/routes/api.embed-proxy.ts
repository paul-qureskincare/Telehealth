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
    const totalStartTime = Date.now();
    
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
    const cacheGetStartTime = Date.now();
    const cachedData = await cacheManager.get(cacheKey);
    const cacheGetTime = Date.now() - cacheGetStartTime;
    
    if (cachedData) {
      const totalTime = Date.now() - totalStartTime;
      console.log(`[EmbedProxy] Serving from cache: ${cacheKey} | Cache get: ${cacheGetTime}ms | Total: ${totalTime}ms`);
      
      return Response.json({
        ...cachedData,
        _cache_meta: {
          cached: true,
          timestamp: Date.now(),
          source: 'cache',
          cache_provider: cacheManager.getProviderType(),
          cache_get_time: cacheGetTime,
          total_time: totalTime,
        },
      });
    }

    // If no cache, fetch from native Embed API
    console.log(`[EmbedProxy] Cache miss, fetching from native Embed: ${engineDomain} | Cache get time: ${cacheGetTime}ms`);
    
    const urlRoot = engineDomain.startsWith('http') ? engineDomain : `https://${engineDomain}`;
    const embedUrl = `${urlRoot}/init?load=${encodeURIComponent(loadParam)}`;

    const fetchStartTime = Date.now();
    const embedResponse = await fetch(embedUrl, {
      signal: request.signal,
      headers: {
        'User-Agent': 'Qure-Telehealth-Proxy/1.0',
      },
    });
    const fetchTime = Date.now() - fetchStartTime;

    if (!embedResponse.ok) {
      throw new Error(`Embed API returned ${embedResponse.status}`);
    }

    const parseStartTime = Date.now();
    const embedData = await embedResponse.json();
    const parseTime = Date.now() - parseStartTime;

    // Save to cache if caching is enabled
    if (cacheManager.isEnabled()) {
      const cacheSaveStartTime = Date.now();
      await cacheManager.set(cacheKey, embedData);
      const cacheSaveTime = Date.now() - cacheSaveStartTime;
      console.log(`[EmbedProxy] Saved to cache: ${cacheKey} | Save time: ${cacheSaveTime}ms`);
    }

    const totalTime = Date.now() - totalStartTime;
    console.log(`[EmbedProxy] Native fetch completed | API fetch: ${fetchTime}ms | JSON parse: ${parseTime}ms | Total: ${totalTime}ms`);

    // Return response with cache metadata
    return Response.json({
      ...embedData,
      _cache_meta: {
        cached: false,
        timestamp: Date.now(),
        source: 'native',
        cache_enabled: cacheConfig.enabled,
        cache_provider: cacheManager.getProviderType(),
        cache_get_time: cacheGetTime,
        api_fetch_time: fetchTime,
        json_parse_time: parseTime,
        total_time: totalTime,
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
