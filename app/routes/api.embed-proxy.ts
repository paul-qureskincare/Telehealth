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
  console.log('[EmbedProxy] ===== LOADER CALLED =====');
  try {
    const totalStartTime = Date.now();
    
    // Parse request URL to get query parameters
    const url = new URL(request.url);
    const loadParam = url.searchParams.get('load');
    const engineDomain = url.searchParams.get('engine_domain') || 'engine.embeddables.com';

    console.log('[EmbedProxy] loadParam:', loadParam?.substring(0, 50));
    console.log('[EmbedProxy] engineDomain:', engineDomain);

    if (!loadParam) {
      console.log('[EmbedProxy] ❌ Missing load parameter');
      return Response.json({ error: 'Missing load parameter' }, { status: 400 });
    }

    // Create cache key based on request parameters
    const cacheKey = `embed_${engineDomain}_${Buffer.from(loadParam).toString('base64').slice(0, 50)}`;
    console.log('[EmbedProxy] cacheKey:', cacheKey);

    // Try to get cached data first
    console.log('[EmbedProxy] Checking cache...');
    const cacheGetStartTime = Date.now();
    const cachedData = await cacheManager.get(cacheKey);
    const cacheGetTime = Date.now() - cacheGetStartTime;
    
    if (cachedData) {
      const totalTime = Date.now() - totalStartTime;
      
      // Calculate cache size in KB
      const cacheDataString = JSON.stringify(cachedData);
      const cacheSizeBytes = Buffer.byteLength(cacheDataString, 'utf-8');
      const cacheSizeKB = Math.round(cacheSizeBytes / 1024);
      
      console.log(`[EmbedProxy] ✅ CACHE HIT: ${cacheKey} | Size: ${cacheSizeKB} KB | Cache get: ${cacheGetTime}ms | Total: ${totalTime}ms`);
      
      return Response.json({
        ...cachedData,
        _cache_meta: {
          cached: true,
          timestamp: Date.now(),
          source: 'cache',
          cache_provider: cacheManager.getProviderType(),
          cache_get_time: cacheGetTime,
          total_time: totalTime,
          cache_size_kb: cacheSizeKB,
        },
      }, {
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0',
        },
      });
    }

    // If no cache, fetch from native Embed API
    console.log(`[EmbedProxy] ❌ CACHE MISS, fetching from native Embed: ${engineDomain}`);
    
    const urlRoot = engineDomain.startsWith('http') ? engineDomain : `https://${engineDomain}`;
    const embedUrl = `${urlRoot}/init?load=${encodeURIComponent(loadParam)}`;
    console.log('[EmbedProxy] embedUrl:', embedUrl.substring(0, 100));

    const fetchStartTime = Date.now();
    const embedResponse = await fetch(embedUrl, {
      signal: request.signal,
      headers: {
        'User-Agent': 'Qure-Telehealth-Proxy/1.0',
      },
    });
    const fetchTime = Date.now() - fetchStartTime;

    if (!embedResponse.ok) {
      console.log(`[EmbedProxy] ❌ Embed API error: ${embedResponse.status}`);
      throw new Error(`Embed API returned ${embedResponse.status}`);
    }

    const parseStartTime = Date.now();
    const embedData = await embedResponse.json();
    const parseTime = Date.now() - parseStartTime;
    console.log('[EmbedProxy] Parsed response, now saving to cache...');

    // Save to cache if caching is enabled
    if (cacheManager.isEnabled()) {
      console.log('[EmbedProxy] cacheManager.isEnabled() = true, calling set()...');
      const cacheSaveStartTime = Date.now();
      await cacheManager.set(cacheKey, embedData);
      const cacheSaveTime = Date.now() - cacheSaveStartTime;
      console.log(`[EmbedProxy] ✅ Saved to cache: ${cacheKey} | Save time: ${cacheSaveTime}ms`);
    } else {
      console.log('[EmbedProxy] Caching is disabled');
    }

    const totalTime = Date.now() - totalStartTime;
    
    // Calculate data size in KB
    const dataString = JSON.stringify(embedData);
    const dataSizeBytes = Buffer.byteLength(dataString, 'utf-8');
    const dataSizeKB = Math.round(dataSizeBytes / 1024);
    
    console.log(`[EmbedProxy] ✅ Native fetch completed | Size: ${dataSizeKB} KB | API fetch: ${fetchTime}ms | JSON parse: ${parseTime}ms | Total: ${totalTime}ms`);

    // Return response with cache metadata and no-cache headers
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
        cache_size_kb: dataSizeKB,
      },
    }, {
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
      },
    });

  } catch (error) {
    console.error('[EmbedProxy] ❌ Error:', error);
    
    return Response.json(
      { 
        error: 'Failed to fetch embeddables data',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
