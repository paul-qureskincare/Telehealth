/**
 * Cache Manager
 * 
 * Main cache manager that handles caching logic based on configuration.
 * Provides a simple API for caching operations with automatic provider selection.
 */

import { cacheConfig } from '../../config/cache.config';
import { CacheFactory } from './cache-factory';
import type { CacheProvider } from './types';
import { initializeCacheMonitor } from './monitor-cache';

export class CacheManager {
  private provider: CacheProvider;
  private enabled: boolean;
  private ttl: number;
  private providerType: 'file' | 'redis' | 'supabase';

  constructor() {
    this.enabled = cacheConfig.enabled;
    this.ttl = cacheConfig.ttl;
    this.providerType = cacheConfig.provider;
    this.provider = CacheFactory.createProvider(cacheConfig.provider);

    // Initialize cache monitor - saves to /cache/file/ or /cache/redis/ based on CACHE_SAVE setting
    initializeCacheMonitor(cacheConfig.save);
  }

  /**
   * Check if caching is enabled
   */
  isEnabled(): boolean {
    return this.enabled;
  }

  /**
   * Get the current cache provider type
   */
  getProviderType(): 'file' | 'redis' | 'supabase' {
    return this.providerType;
  }

  /**
   * Get cached data
   */
  async get<T = any>(key: string): Promise<T | null> {
    console.log(`[CacheManager] get() called - enabled: ${this.enabled}, key: ${key}`);
    
    if (!this.enabled) {
      console.log(`[CacheManager] Caching is disabled, returning null`);
      return null;
    }

    try {
      const result = await this.provider.get<T>(key);
      console.log(`[CacheManager] get() result: ${result !== null ? '✅ HIT' : '❌ MISS'}`);
      return result;
    } catch (error) {
      console.error('[CacheManager] Error getting cache:', error);
      return null;
    }
  }

  /**
   * Set cached data
   */
  async set<T = any>(key: string, data: T): Promise<void> {
    console.log(`[CacheManager] set() called - enabled: ${this.enabled}, key: ${key}`);
    
    if (!this.enabled) {
      console.log(`[CacheManager] Caching is disabled, skipping set`);
      return;
    }

    try {
      console.log(`[CacheManager] Calling provider.set() with ttl: ${this.ttl}`);
      await this.provider.set(key, data, this.ttl);
      console.log(`[CacheManager] ✅ Provider set() completed`);
    } catch (error) {
      console.error('[CacheManager] Error setting cache:', error);
    }
  }

  /**
   * Check if cache exists
   */
  async has(key: string): Promise<boolean> {
    if (!this.enabled) {
      return false;
    }

    try {
      return await this.provider.has(key);
    } catch {
      return false;
    }
  }

  /**
   * Delete cache entry
   */
  async delete(key: string): Promise<void> {
    try {
      await this.provider.delete(key);
    } catch (error) {
      console.error('[CacheManager] Error deleting cache:', error);
    }
  }

  /**
   * Clear all cache
   */
  async clear(): Promise<void> {
    try {
      await this.provider.clear();
    } catch (error) {
      console.error('[CacheManager] Error clearing cache:', error);
    }
  }
}

// Export singleton instance
export const cacheManager = new CacheManager();
