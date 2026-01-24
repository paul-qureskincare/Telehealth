import { cacheGet, cacheSet, cacheIsValid as memCacheIsValid } from "./memory-cache.server";

// TTL for cache entries (15 minutes)
export const TTL_MS = 15 * 60 * 1000;

/**
 * Get data from cache by key
 */
export function getCached<T>(key: string): T | null {
  return cacheGet<T>(key);
}

/**
 * Set data in cache with TTL
 */
export function setCached<T>(key: string, data: T, ttl: number = TTL_MS): void {
  cacheSet(key, data, ttl);
}

/**
 * Check if cache key is valid (exists and not expired)
 */
export function isCacheValid(key: string): boolean {
  return memCacheIsValid(key);
}
