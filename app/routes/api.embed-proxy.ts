/**
 * Embeddables Proxy API Route
 * 
 * This route proxies requests to the Embeddables engine with caching support.
 * It caches the response from the native Embed API to improve performance and
 * reduce load on the external service.
 * 
 * Caching Strategy:
 * 1. Server-side cache (Redis/File) - fast data retrieval
 * 2. CDN Edge cache (Vercel) - eliminates Lambda calls
 * 3. Browser cache - instant page loads
 * 
 * Performance:
 * - First request: ~1000ms (fetch from API)
 * - Cached on server: ~200ms (Lambda + Redis)
 * - Cached on CDN: ~50-100ms (Edge only)
 * - Cached in browser: ~0ms (instant)
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

    // Try to get cached data first with metadata
    console.log('[EmbedProxy] Checking cache...');
    const cacheGetStartTime = Date.now();
    const cachedResult = await cacheManager.getWithMeta(cacheKey);
    const cacheGetTime = Date.now() - cacheGetStartTime;
    
    if (cachedResult) {
      const totalTime = Date.now() - totalStartTime;
      const { data: cachedData, metadata } = cachedResult;
      
      // Calculate sizes in KB
      const uncompressedKB = Math.round(metadata.uncompressedSize / 1024);
      const compressedKB = metadata.compressedSize ? Math.round(metadata.compressedSize / 1024) : undefined;
      
      // Calculate remaining time (network, request setup, etc)
      const networkTime = totalTime - cacheGetTime;
      
      console.log(`[EmbedProxy] ✅ CACHE HIT: ${cacheKey}`);
      console.log(`[EmbedProxy]   - Uncompressed size: ${uncompressedKB} KB`);
      if (compressedKB) {
        console.log(`[EmbedProxy]   - Compressed size: ${compressedKB} KB (${metadata.compressionRatio?.toFixed(1)}% saved)`);
      }
      console.log(`[EmbedProxy]   - Cache fetch time: ${cacheGetTime}ms`);
      console.log(`[EmbedProxy]   - Network time: ${networkTime}ms`);
      console.log(`[EmbedProxy]   - Total time: ${totalTime}ms`);
      
      // Return response with CDN caching headers
      // Vercel Edge will cache this response and serve it directly without Lambda
      return Response.json({
        ...cachedData,
        _cache_meta: {
          cached: true,
          timestamp: Date.now(),
          source: 'cache',
          cache_provider: cacheManager.getProviderType(),
          cache_get_time: cacheGetTime,
          network_time: networkTime,
          total_time: totalTime,
          uncompressed_size_kb: uncompressedKB,
          compressed_size_kb: compressedKB,
          compression_ratio: metadata.compressionRatio,
          is_compressed: metadata.isCompressed,
        },
      }, {
        headers: {
          // CDN Edge caching - cache for 1 hour, serve stale for 24 hours while revalidating
          'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
          // Vercel-specific CDN cache control
          'CDN-Cache-Control': 'public, max-age=3600',
          // Tell Vercel to cache this at the Edge
          'Vercel-CDN-Cache-Control': 'max-age=3600',
          // Vary header to cache different versions based on query params
          'Vary': 'Accept-Encoding',
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
    console.log('[EmbedProxy] ✅ Parsed response from Embed API');

    // Save to cache if caching is enabled
    let cacheSaveTime = 0;
    if (cacheManager.isEnabled()) {
      console.log('[EmbedProxy] 💾 Saving to cache...');
      const cacheSaveStartTime = Date.now();
      await cacheManager.set(cacheKey, embedData);
      cacheSaveTime = Date.now() - cacheSaveStartTime;
      console.log(`[EmbedProxy] ✅ Saved to cache: ${cacheKey} | Save time: ${cacheSaveTime}ms`);
    } else {
      console.log('[EmbedProxy] ⚠️  Caching is disabled');
    }

    const totalTime = Date.now() - totalStartTime;
    
    // Calculate data size in KB
    const dataString = JSON.stringify(embedData);
    const dataSizeBytes = Buffer.byteLength(dataString, 'utf-8');
    const dataSizeKB = Math.round(dataSizeBytes / 1024);
    
    // Calculate network overhead (request setup, response streaming, etc)
    const networkOverhead = totalTime - fetchTime - parseTime - cacheSaveTime;
    
    console.log(`[EmbedProxy] ✅ Native fetch completed | Size: ${dataSizeKB} KB | API fetch: ${fetchTime}ms | JSON parse: ${parseTime}ms | Cache save: ${cacheSaveTime}ms | Network overhead: ${networkOverhead}ms | Total: ${totalTime}ms`);

    // Return response with short CDN cache (will be cached after first request)
    return Response.json({
      ...embedData,
      _cache_meta: {
        cached: false,
        timestamp: Date.now(),
        source: 'native',
        cache_enabled: cacheConfig.enabled,
        cache_provider: cacheManager.getProviderType(),
        cache_check_time: cacheGetTime,
        api_fetch_time: fetchTime,
        json_parse_time: parseTime,
        cache_save_time: cacheSaveTime,
        network_overhead: networkOverhead,
        total_time: totalTime,
        cache_size_kb: dataSizeKB,
      },
    }, {
      headers: {
        // Short CDN cache for native fetches (10 seconds)
        // This allows quick revalidation while still benefiting from CDN
        'Cache-Control': 'public, s-maxage=10, stale-while-revalidate=3600',
        'CDN-Cache-Control': 'public, max-age=10',
        'Vary': 'Accept-Encoding',
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
