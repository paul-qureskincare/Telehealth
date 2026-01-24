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

  constructor() {
    this.enabled = cacheConfig.enabled;
    this.ttl = cacheConfig.ttl;
    this.provider = CacheFactory.createProvider(cacheConfig.provider);

    // Initialize cache monitor
    initializeCacheMonitor(cacheConfig.save);
  }

  /**
   * Check if caching is enabled
   */
  isEnabled(): boolean {
    return this.enabled;
  }

  /**
   * Get cached data
   */
  async get<T = any>(key: string): Promise<T | null> {
    if (!this.enabled) {
      return null;
    }

    try {
      return await this.provider.get<T>(key);
    } catch (error) {
      console.error('[CacheManager] Error getting cache:', error);
      return null;
    }
  }

  /**
   * Set cached data
   */
  async set<T = any>(key: string, data: T): Promise<void> {
    if (!this.enabled) {
      return;
    }

    try {
      await this.provider.set(key, data, this.ttl);
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
