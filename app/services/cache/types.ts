/**
 * Cache Provider Interface
 * 
 * This interface defines the contract that all cache providers must implement.
 * This allows for easy extension to support different caching backends 
 * (file, Redis, Supabase PostgreSQL, etc.)
 */

export interface CacheEntry<T = any> {
  // Cached data
  data: T;
  
  // Timestamp when the cache was created (Unix timestamp in milliseconds)
  timestamp: number;
  
  // Time-to-live in milliseconds
  ttl: number;
}

export interface CacheProvider {
  /**
   * Get cached data by key
   * @param key - Cache key
   * @returns Cached data or null if not found or expired
   */
  get<T = any>(key: string): Promise<T | null>;
  
  /**
   * Set cached data with TTL
   * @param key - Cache key
   * @param data - Data to cache
   * @param ttl - Time-to-live in milliseconds
   */
  set<T = any>(key: string, data: T, ttl: number): Promise<void>;
  
  /**
   * Check if cache entry exists and is valid
   * @param key - Cache key
   * @returns true if cache exists and not expired
   */
  has(key: string): Promise<boolean>;
  
  /**
   * Delete cached entry
   * @param key - Cache key
   */
  delete(key: string): Promise<void>;
  
  /**
   * Clear all cache entries
   */
  clear(): Promise<void>;
}
