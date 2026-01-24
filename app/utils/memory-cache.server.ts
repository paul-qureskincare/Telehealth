// In-memory cache implementation for Vercel Lambda environments
// This cache stores data in process memory with TTL support

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
}

type CacheStore = Record<string, CacheEntry<any>>;

// Global cache store - persists across requests in the same Lambda container
const cacheStore: CacheStore = {};

/**
 * Set a value in the cache
 * @param key - The cache key
 * @param data - The data to cache
 * @param ttl - Time to live in milliseconds
 */
export function cacheSet<T>(key: string, data: T, ttl: number): void {
  cacheStore[key] = {
    data,
    timestamp: Date.now(),
    ttl,
  };
}

/**
 * Get a value from the cache
 * @param key - The cache key
 * @returns The cached data or null if not found or expired
 */
export function cacheGet<T>(key: string): T | null {
  const entry = cacheStore[key];

  if (!entry) {
    return null;
  }

  // Check if cache has expired
  const age = Date.now() - entry.timestamp;
  if (age > entry.ttl) {
    delete cacheStore[key];
    return null;
  }

  return entry.data as T;
}

/**
 * Check if a cache key is valid (exists and not expired)
 * @param key - The cache key
 * @returns true if the key exists and hasn't expired
 */
export function cacheIsValid(key: string): boolean {
  const entry = cacheStore[key];

  if (!entry) {
    return false;
  }

  // Check if cache has expired
  const age = Date.now() - entry.timestamp;
  if (age > entry.ttl) {
    delete cacheStore[key];
    return false;
  }

  return true;
}

/**
 * Delete a cache entry
 * @param key - The cache key
 */
export function cacheDelete(key: string): void {
  delete cacheStore[key];
}

/**
 * Clear all cache entries
 */
export function cacheClear(): void {
  for (const key in cacheStore) {
    delete cacheStore[key];
  }
}

/**
 * Get cache statistics (for debugging)
 */
export function cacheStats() {
  return {
    keys: Object.keys(cacheStore).length,
    entries: Object.entries(cacheStore).map(([key, entry]) => ({
      key,
      age: Date.now() - entry.timestamp,
      ttl: entry.ttl,
      expired: Date.now() - entry.timestamp > entry.ttl,
    })),
  };
}
