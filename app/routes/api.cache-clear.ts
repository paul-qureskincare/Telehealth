/**
 * Cache Clear API Route
 * 
 * This route provides an endpoint to clear the cache for debugging purposes.
 * It clears all cached data in the configured cache provider (file or redis).
 * 
 * Endpoint: POST /api/cache-clear
 * 
 * Response:
 * - 200: Cache cleared successfully
 * - 500: Error clearing cache
 */

import { cacheManager } from '../services/cache';
import { promisify } from 'util';
import { fsync } from 'fs';

const fsyncAsync = promisify(fsync);

/**
 * Action function that handles POST requests to clear cache
 */
export async function action({ request }: { request: Request }) {
  // Only allow POST requests
  if (request.method !== 'POST') {
    return Response.json(
      { error: 'Method not allowed' },
      { status: 405 }
    );
  }

  try {
    console.log('[CacheClear] ===== CACHE CLEAR ACTION CALLED =====');
    console.log('[CacheClear] Cache provider:', cacheManager.getProviderType());

    // Clear the cache
    const startTime = Date.now();
    await cacheManager.clear();
    
    // Add extra wait to ensure file system sync completes
    // This is critical for file-based cache provider
    await new Promise(resolve => setTimeout(resolve, 500));
    
    const clearTime = Date.now() - startTime;

    console.log(`[CacheClear] ✅ Cache cleared successfully in ${clearTime}ms`);
    console.log(`[CacheClear] File system sync completed, safe to reload`);

    return Response.json(
      {
        success: true,
        message: 'Cache cleared successfully',
        provider: cacheManager.getProviderType(),
        clearTime,
      },
      {
        status: 200,
        headers: {
          // Prevent caching of this response
          'Cache-Control': 'no-cache, no-store, must-revalidate, max-age=0',
          'Pragma': 'no-cache',
          'Expires': '0',
          'Vary': 'Accept-Encoding',
        },
      }
    );
  } catch (error) {
    console.error('[CacheClear] ❌ Error clearing cache:', error);

    return Response.json(
      {
        success: false,
        error: 'Failed to clear cache',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      {
        status: 500,
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate, max-age=0',
        },
      }
    );
  }
}
