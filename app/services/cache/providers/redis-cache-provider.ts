/**
 * Redis-Based Cache Provider
 * 
 * This provider stores cache data in Redis using ioredis client.
 * Provides fast, distributed caching with automatic expiration.
 * 
 * Configuration:
 * - REDIS_URL: Connection string (e.g., redis://user:password@host:port)
 * 
 * Performance optimizations:
 * - Singleton Redis client (reuses connections across requests)
 * - Connection pooling enabled
 * - Lazy connection (connects only when needed)
 * - DNS caching
 */

import Redis from 'ioredis';
import type { CacheProvider, CacheEntry } from '../types';
import { getCacheMonitor } from '../monitor-cache';

// Singleton Redis client instance
let redisClientInstance: Redis | null = null;
let isConnected: boolean = false;

/**
 * Get or create singleton Redis client
 * This ensures connection reuse across Lambda invocations
 */
function getRedisClient(redisUrl?: string): Redis {
  if (redisClientInstance) {
    return redisClientInstance;
  }

  // Use REDIS_URL from environment or provided URL
  const url = redisUrl || process.env.REDIS_URL;
  
  if (!url) {
    throw new Error('REDIS_URL environment variable is required for Redis cache provider');
  }

  console.log('[RedisCacheProvider] Creating new Redis client instance');

  // Initialize Redis client with optimized settings
  redisClientInstance = new Redis(url, {
    // Lazy connect - only connect when first command is sent
    lazyConnect: true,
    
    // Keep connections alive to reuse them
    keepAlive: 30000,
    
    // Connection pool settings
    maxRetriesPerRequest: 3,
    enableReadyCheck: false,
    
    // Automatically reconnect on connection loss
    retryStrategy: (times) => {
      if (times > 10) {
        console.error('[RedisCacheProvider] Max retry attempts reached');
        return null; // Stop retrying
      }
      const delay = Math.min(times * 50, 2000);
      return delay;
    },
    
    // Shorter connection timeout for faster failures
    connectTimeout: 5000,
    
    // Enable offline queue to handle commands during reconnection
    enableOfflineQueue: true,
    
    // DNS caching
    family: 4, // Use IPv4
  });

  // Connection event handlers
  redisClientInstance.on('connect', () => {
    console.log('[RedisCacheProvider] Connected to Redis');
    isConnected = true;
  });

  redisClientInstance.on('ready', () => {
    console.log('[RedisCacheProvider] Redis client ready');
    isConnected = true;
  });

  redisClientInstance.on('error', (error) => {
    console.error('[RedisCacheProvider] Redis connection error:', error.message);
    isConnected = false;
  });

  redisClientInstance.on('close', () => {
    console.log('[RedisCacheProvider] Redis connection closed');
    isConnected = false;
  });

  redisClientInstance.on('reconnecting', () => {
    console.log('[RedisCacheProvider] Reconnecting to Redis...');
  });

  return redisClientInstance;
}

export class RedisCacheProvider implements CacheProvider {
  private client: Redis;

  constructor(redisUrl?: string) {
    // Use singleton Redis client
    this.client = getRedisClient(redisUrl);
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
      // Ensure connection is established (lazy connect)
      if (!isConnected) {
        await this.client.connect();
      }

      const redisKey = this.getKey(key);
      const startTime = Date.now();
      
      // Get data from Redis
      const content = await this.client.get(redisKey);
      const fetchTime = Date.now() - startTime;
      
      if (!content) {
        // Sync cache miss to monitoring
        await getCacheMonitor().syncCacheStatus('redis', key, 'missing');
        return null;
      }

      // Parse cache entry (measure JSON.parse time)
      const parseStart = Date.now();
      const entry: CacheEntry<T> = JSON.parse(content);
      const parseTime = Date.now() - parseStart;

      // Check if expired (double-check even though Redis TTL should handle this)
      if (this.isExpired(entry)) {
        await this.delete(key);
        // Sync expired cache to monitoring
        await getCacheMonitor().syncCacheStatus('redis', key, 'missing');
        return null;
      }

      console.log(
        `[RedisCacheProvider] Cache HIT: ${key} | Redis fetch: ${fetchTime}ms | JSON parse: ${parseTime}ms | Total: ${fetchTime + parseTime}ms`
      );
      
      // Save to monitoring directory when cache is hit
      await getCacheMonitor().syncCacheStatus('redis', key, 'exists', entry);
      
      return entry.data;
    } catch (error) {
      console.error('[RedisCacheProvider] Error reading cache:', error);
      return null;
    }
  }

  async set<T = any>(key: string, data: T, ttl: number): Promise<void> {
    try {
      // Ensure connection is established (lazy connect)
      if (!isConnected) {
        await this.client.connect();
      }

      const redisKey = this.getKey(key);

      const entry: CacheEntry<T> = {
        data,
        timestamp: Date.now(),
        ttl,
      };

      // Convert TTL from milliseconds to seconds for Redis
      const ttlSeconds = Math.ceil(ttl / 1000);

      const startTime = Date.now();
      
      // Store in Redis with expiration
      await this.client.setex(redisKey, ttlSeconds, JSON.stringify(entry));
      
      const writeTime = Date.now() - startTime;
      console.log(`[RedisCacheProvider] Cache SET: ${key} | Write time: ${writeTime}ms`);

      // Save to monitoring directory
      await getCacheMonitor().saveEntry('redis', key, entry);
    } catch (error) {
      console.error('[RedisCacheProvider] Error writing cache:', error);
      throw error;
    }
  }

  async has(key: string): Promise<boolean> {
    try {
      // Ensure connection is established (lazy connect)
      if (!isConnected) {
        await this.client.connect();
      }

      const redisKey = this.getKey(key);
      
      // Check if key exists
      const exists = await this.client.exists(redisKey);
      
      if (exists === 0) {
        // Sync cache miss to monitoring
        await getCacheMonitor().syncCacheStatus('redis', key, 'missing');
        return false;
      }

      // Get and verify the entry is not expired
      const content = await this.client.get(redisKey);
      
      if (!content) {
        // Sync cache miss to monitoring
        await getCacheMonitor().syncCacheStatus('redis', key, 'missing');
        return false;
      }

      const entry: CacheEntry = JSON.parse(content);

      if (this.isExpired(entry)) {
        await this.delete(key);
        // Sync expired cache to monitoring
        await getCacheMonitor().syncCacheStatus('redis', key, 'missing');
        return false;
      }

      // Sync found cache to monitoring
      await getCacheMonitor().syncCacheStatus('redis', key, 'exists', entry);
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
    return isConnected;
  }

  /**
   * Get Redis client info for debugging
   */
  async getClientInfo(): Promise<{
    connected: boolean;
    uptime: number;
    usedMemory: string;
  }> {
    try {
      if (!isConnected) {
        await this.client.connect();
      }
      
      const info = await this.client.info('server');
      const memory = await this.client.info('memory');
      
      return {
        connected: isConnected,
        uptime: 0, // Parse from info if needed
        usedMemory: memory.split('\n').find(line => line.startsWith('used_memory_human'))?.split(':')[1]?.trim() || 'unknown',
      };
    } catch (error) {
      console.error('[RedisCacheProvider] Error getting client info:', error);
      return {
        connected: false,
        uptime: 0,
        usedMemory: 'error',
      };
    }
  }
}

/**
 * Cleanup function for graceful shutdown
 * Call this when the application is shutting down
 */
export async function closeRedisConnection(): Promise<void> {
  if (redisClientInstance) {
    try {
      await redisClientInstance.quit();
      console.log('[RedisCacheProvider] Redis connection closed gracefully');
      redisClientInstance = null;
      isConnected = false;
    } catch (error) {
      console.error('[RedisCacheProvider] Error closing Redis connection:', error);
    }
  }
}
