/**
 * Redis-Based Cache Provider
 * 
 * This provider stores cache data in Redis using ioredis client.
 * Provides fast, distributed caching with automatic expiration.
 * 
 * Configuration:
 * - REDIS_URL: Connection string (e.g., redis://user:password@host:port)
 */

import Redis from 'ioredis';
import type { CacheProvider, CacheEntry } from '../types';
import { getCacheMonitor } from '../monitor-cache';

export class RedisCacheProvider implements CacheProvider {
  private client: Redis;
  private isConnected: boolean = false;

  constructor(redisUrl?: string) {
    // Use REDIS_URL from environment or provided URL
    const url = redisUrl || process.env.REDIS_URL;
    
    if (!url) {
      throw new Error('REDIS_URL environment variable is required for Redis cache provider');
    }

    // Initialize Redis client
    this.client = new Redis(url, {
      // Automatically reconnect on connection loss
      retryStrategy: (times) => {
        const delay = Math.min(times * 50, 2000);
        return delay;
      },
      // Maximum retry attempts
      maxRetriesPerRequest: 3,
      // Connection timeout
      connectTimeout: 10000,
      // Enable offline queue
      enableOfflineQueue: true,
    });

    // Connection event handlers
    this.client.on('connect', () => {
      console.log('[RedisCacheProvider] Connected to Redis');
      this.isConnected = true;
    });

    this.client.on('error', (error) => {
      console.error('[RedisCacheProvider] Redis connection error:', error);
      this.isConnected = false;
    });

    this.client.on('close', () => {
      console.log('[RedisCacheProvider] Redis connection closed');
      this.isConnected = false;
    });
  }

  /**
   * Generate Redis key with prefix
   */
  private getKey(key: string): string {
    return `embeddables-cache:${key}`;
  }

  /**
   * Check if cache entry is expired
   */
  private isExpired(entry: CacheEntry): boolean {
    const now = Date.now();
    return now - entry.timestamp > entry.ttl;
  }

  async get<T = any>(key: string): Promise<T | null> {
    try {
      const redisKey = this.getKey(key);
      
      // Get data from Redis
      const content = await this.client.get(redisKey);
      
      if (!content) {
        return null;
      }

      // Parse cache entry
      const entry: CacheEntry<T> = JSON.parse(content);

      // Check if expired (double-check even though Redis TTL should handle this)
      if (this.isExpired(entry)) {
        await this.delete(key);
        return null;
      }

      return entry.data;
    } catch (error) {
      console.error('[RedisCacheProvider] Error reading cache:', error);
      return null;
    }
  }

  async set<T = any>(key: string, data: T, ttl: number): Promise<void> {
    try {
      const redisKey = this.getKey(key);

      const entry: CacheEntry<T> = {
        data,
        timestamp: Date.now(),
        ttl,
      };

      // Convert TTL from milliseconds to seconds for Redis
      const ttlSeconds = Math.ceil(ttl / 1000);

      // Store in Redis with expiration
      await this.client.setex(redisKey, ttlSeconds, JSON.stringify(entry));

      // Save to monitoring directory
      await getCacheMonitor().saveEntry('redis', key, entry);
    } catch (error) {
      console.error('[RedisCacheProvider] Error writing cache:', error);
      throw error;
    }
  }

  async has(key: string): Promise<boolean> {
    try {
      const redisKey = this.getKey(key);
      
      // Check if key exists
      const exists = await this.client.exists(redisKey);
      
      if (exists === 0) {
        return false;
      }

      // Get and verify the entry is not expired
      const content = await this.client.get(redisKey);
      
      if (!content) {
        return false;
      }

      const entry: CacheEntry = JSON.parse(content);

      if (this.isExpired(entry)) {
        await this.delete(key);
        return false;
      }

      return true;
    } catch {
      return false;
    }
  }

  async delete(key: string): Promise<void> {
    try {
      const redisKey = this.getKey(key);
      await this.client.del(redisKey);

      // Remove from monitoring directory
      await getCacheMonitor().deleteEntry('redis', key);
    } catch (error) {
      console.error('[RedisCacheProvider] Error deleting cache:', error);
    }
  }

  async clear(): Promise<void> {
    try {
      // Find all keys with our prefix
      const keys = await this.client.keys('embeddables-cache:*');
      
      if (keys.length > 0) {
        // Delete all matching keys
        await this.client.del(...keys);
      }

      // Clear monitoring directory
      await getCacheMonitor().clearProvider('redis');
    } catch (error) {
      console.error('[RedisCacheProvider] Error clearing cache:', error);
    }
  }

  /**
   * Close Redis connection
   * Should be called when shutting down the application
   */
  async disconnect(): Promise<void> {
    try {
      await this.client.quit();
      console.log('[RedisCacheProvider] Disconnected from Redis');
    } catch (error) {
      console.error('[RedisCacheProvider] Error disconnecting from Redis:', error);
    }
  }

  /**
   * Get connection status
   */
  getConnectionStatus(): boolean {
    return this.isConnected;
  }
}
