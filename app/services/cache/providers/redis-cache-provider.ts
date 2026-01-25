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
 * - Gzip compression (10-15x size reduction for JSON data)
 */

import Redis from 'ioredis';
import { gzip, gunzip } from 'zlib';
import { promisify } from 'util';
import type { CacheProvider, CacheEntry } from '../types';
import { getCacheMonitor } from '../monitor-cache';

// Promisify zlib functions for async/await
const gzipAsync = promisify(gzip);
const gunzipAsync = promisify(gunzip);

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
  private compressionEnabled: boolean = true; // Enable compression by default

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

  /**
   * Compress data using gzip
   */
  private async compress(data: string): Promise<Buffer> {
    return await gzipAsync(Buffer.from(data, 'utf-8'));
  }

  /**
   * Decompress data using gunzip
   */
  private async decompress(data: Buffer): Promise<string> {
    const decompressed = await gunzipAsync(data);
    return decompressed.toString('utf-8');
  }

  /**
   * Check if data is compressed (starts with gzip magic number)
   */
  private isCompressed(data: Buffer | string): boolean {
    if (typeof data === 'string') {
      return false;
    }
    // Check for gzip magic number: 0x1f 0x8b
    return data.length >= 2 && data[0] === 0x1f && data[1] === 0x8b;
  }

  async get<T = any>(key: string): Promise<T | null> {
    try {
      // Ensure connection is established (lazy connect)
      if (!isConnected) {
        await this.client.connect();
      }

      const redisKey = this.getKey(key);
      const startTime = Date.now();
      
      // Get data from Redis as Buffer to preserve compression
      const content = await this.client.getBuffer(redisKey);
      const fetchTime = Date.now() - startTime;
      
      if (!content) {
        // Sync cache miss to monitoring
        await getCacheMonitor().syncCacheStatus('redis', key, 'missing');
        return null;
      }

      let jsonString: string;
      let decompressTime = 0;

      // Check if data is compressed
      if (this.isCompressed(content)) {
        const decompressStart = Date.now();
        jsonString = await this.decompress(content);
        decompressTime = Date.now() - decompressStart;
        
        const originalSize = content.length;
        const decompressedSize = Buffer.byteLength(jsonString, 'utf-8');
        const compressionRatio = ((1 - originalSize / decompressedSize) * 100).toFixed(1);
        
        console.log(
          `[RedisCacheProvider] ✅ CACHE DECOMPRESSED: ${(originalSize / 1024).toFixed(1)} KB → ${(decompressedSize / 1024).toFixed(1)} KB (saved ${compressionRatio}%)`
        );
      } else {
        // Backward compatibility: handle uncompressed data
        jsonString = content.toString('utf-8');
        console.log(`[RedisCacheProvider] ⚠️  Cache data is not compressed (backward compatibility mode)`);
      }

      // Parse cache entry (measure JSON.parse time)
      const parseStart = Date.now();
      const entry: CacheEntry<T> = JSON.parse(jsonString);
      const parseTime = Date.now() - parseStart;

      // Check if expired (double-check even though Redis TTL should handle this)
      if (this.isExpired(entry)) {
        await this.delete(key);
        // Sync expired cache to monitoring
        await getCacheMonitor().syncCacheStatus('redis', key, 'missing');
        return null;
      }

      const totalTime = fetchTime + decompressTime + parseTime;
      console.log(
        `[RedisCacheProvider] Cache HIT: ${key} | Redis fetch: ${fetchTime}ms | Decompress: ${decompressTime}ms | JSON parse: ${parseTime}ms | Total: ${totalTime}ms`
      );
      
      // Save to monitoring directory when cache is hit
      await getCacheMonitor().syncCacheStatus('redis', key, 'exists', entry);
      
      return entry.data;
    } catch (error) {
      console.error('[RedisCacheProvider] Error reading cache:', error);
      return null;
    }
  }

  async getWithMeta<T = any>(key: string): Promise<import('../types').CacheResultWithMeta<T> | null> {
    try {
      // Ensure connection is established (lazy connect)
      if (!isConnected) {
        await this.client.connect();
      }

      const redisKey = this.getKey(key);
      const startTime = Date.now();
      
      // Get data from Redis as Buffer to preserve compression
      const content = await this.client.getBuffer(redisKey);
      const fetchTime = Date.now() - startTime;
      
      if (!content) {
        // Sync cache miss to monitoring
        await getCacheMonitor().syncCacheStatus('redis', key, 'missing');
        return null;
      }

      let jsonString: string;
      let decompressTime = 0;
      const compressedSize = content.length;
      let isCompressed = false;

      // Check if data is compressed
      if (this.isCompressed(content)) {
        isCompressed = true;
        const decompressStart = Date.now();
        jsonString = await this.decompress(content);
        decompressTime = Date.now() - decompressStart;
        
        const decompressedSize = Buffer.byteLength(jsonString, 'utf-8');
        const compressionRatio = ((1 - compressedSize / decompressedSize) * 100).toFixed(1);
        
        console.log(
          `[RedisCacheProvider] ✅ CACHE DECOMPRESSED: ${(compressedSize / 1024).toFixed(1)} KB → ${(decompressedSize / 1024).toFixed(1)} KB (saved ${compressionRatio}%)`
        );
      } else {
        // Backward compatibility: handle uncompressed data
        jsonString = content.toString('utf-8');
        console.log(`[RedisCacheProvider] ⚠️  Cache data is not compressed (backward compatibility mode)`);
      }

      const uncompressedSize = Buffer.byteLength(jsonString, 'utf-8');

      // Parse cache entry (measure JSON.parse time)
      const parseStart = Date.now();
      const entry: CacheEntry<T> = JSON.parse(jsonString);
      const parseTime = Date.now() - parseStart;

      // Check if expired (double-check even though Redis TTL should handle this)
      if (this.isExpired(entry)) {
        await this.delete(key);
        // Sync expired cache to monitoring
        await getCacheMonitor().syncCacheStatus('redis', key, 'missing');
        return null;
      }

      const totalTime = fetchTime + decompressTime + parseTime;
      console.log(
        `[RedisCacheProvider] Cache HIT (with meta): ${key} | Redis fetch: ${fetchTime}ms | Decompress: ${decompressTime}ms | JSON parse: ${parseTime}ms | Total: ${totalTime}ms`
      );
      
      // Save to monitoring directory when cache is hit
      await getCacheMonitor().syncCacheStatus('redis', key, 'exists', entry);

      return {
        data: entry.data,
        metadata: {
          compressedSize: isCompressed ? compressedSize : undefined,
          uncompressedSize,
          compressionRatio: isCompressed ? parseFloat(((1 - compressedSize / uncompressedSize) * 100).toFixed(1)) : undefined,
          isCompressed,
        },
      };
    } catch (error) {
      console.error('[RedisCacheProvider] Error reading cache with meta:', error);
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
      const jsonString = JSON.stringify(entry);
      const originalSize = Buffer.byteLength(jsonString, 'utf-8');
      
      let compressTime = 0;
      let finalData: Buffer | string = jsonString;
      let compressed = false;

      // Compress data if compression is enabled
      if (this.compressionEnabled) {
        const compressStart = Date.now();
        finalData = await this.compress(jsonString);
        compressTime = Date.now() - compressStart;
        compressed = true;

        const compressedSize = finalData.length;
        const compressionRatio = ((1 - compressedSize / originalSize) * 100).toFixed(1);
        
        console.log(
          `[RedisCacheProvider] ✅ CACHE COMPRESSED: ${(originalSize / 1024).toFixed(1)} KB → ${(compressedSize / 1024).toFixed(1)} KB (saved ${compressionRatio}%) in ${compressTime}ms`
        );
      }
      
      // Store in Redis with expiration
      await this.client.setex(redisKey, ttlSeconds, finalData);
      
      const writeTime = Date.now() - startTime - compressTime;
      const totalTime = Date.now() - startTime;
      
      console.log(
        `[RedisCacheProvider] Cache SET: ${key} | Compress: ${compressTime}ms | Write: ${writeTime}ms | Total: ${totalTime}ms | Compressed: ${compressed}`
      );

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
      const content = await this.client.getBuffer(redisKey);
      
      if (!content) {
        // Sync cache miss to monitoring
        await getCacheMonitor().syncCacheStatus('redis', key, 'missing');
        return false;
      }

      // Decompress if needed
      let jsonString: string;
      if (this.isCompressed(content)) {
        jsonString = await this.decompress(content);
      } else {
        jsonString = content.toString('utf-8');
      }

      const entry: CacheEntry = JSON.parse(jsonString);

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
      console.log('[RedisCacheProvider] 🗑️ Starting Redis cache clear');
      
      // Find all keys with our prefix
      const keys = await this.client.keys('embeddables-cache:*');
      console.log(`[RedisCacheProvider] Found ${keys.length} keys to delete`);
      
      if (keys.length > 0) {
        // Delete all matching keys
        await this.client.del(...keys);
        console.log(`[RedisCacheProvider] ✅ Deleted ${keys.length} keys from Redis`);
      } else {
        console.log(`[RedisCacheProvider] No keys to delete`);
      }

      // Clear monitoring directory
      await getCacheMonitor().clearProvider('redis');
      console.log(`[RedisCacheProvider] ✅ Monitoring directory cleared`);
    } catch (error) {
      console.error('[RedisCacheProvider] ❌ Error clearing cache:', error);
      throw error;
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
   * Enable or disable compression
   */
  setCompressionEnabled(enabled: boolean): void {
    this.compressionEnabled = enabled;
    console.log(`[RedisCacheProvider] Compression ${enabled ? 'enabled' : 'disabled'}`);
  }

  /**
   * Check if compression is enabled
   */
  isCompressionEnabled(): boolean {
    return this.compressionEnabled;
  }

  /**
   * Get Redis client info for debugging
   */
  async getClientInfo(): Promise<{
    connected: boolean;
    uptime: number;
    usedMemory: string;
    compressionEnabled: boolean;
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
        compressionEnabled: this.compressionEnabled,
      };
    } catch (error) {
      console.error('[RedisCacheProvider] Error getting client info:', error);
      return {
        connected: false,
        uptime: 0,
        usedMemory: 'error',
        compressionEnabled: this.compressionEnabled,
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
