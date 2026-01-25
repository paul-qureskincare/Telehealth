/**
 * File-Based Cache Provider
 * 
 * This provider stores cache data in the file system using temporary directory.
 * Works both locally (using os.tmpdir()) and on Vercel serverless (using /tmp).
 * 
 * Features:
 * - Gzip compression to reduce file size (10-15x reduction for JSON)
 * - Metadata tracking for compression ratio
 * 
 * Note: On Vercel, /tmp is ephemeral and limited to 512MB. Files may not persist
 * between cold starts, but can persist within the same execution environment.
 */

import { promises as fs } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { gzip, gunzip } from 'zlib';
import { promisify } from 'util';
import type { CacheProvider, CacheEntry } from '../types';
import { getCacheMonitor } from '../monitor-cache';

const gzipAsync = promisify(gzip);
const gunzipAsync = promisify(gunzip);

export class FileCacheProvider implements CacheProvider {
  private cacheDir: string;
  private compressionEnabled: boolean = true;

  constructor() {
    // Use /tmp on Vercel, os.tmpdir() locally
    const baseDir = process.env.VERCEL ? '/tmp' : tmpdir();
    this.cacheDir = join(baseDir, 'embeddables-cache');
  }

  /**
   * Ensure cache directory exists
   */
  private async ensureCacheDir(): Promise<void> {
    try {
      await fs.access(this.cacheDir);
    } catch {
      await fs.mkdir(this.cacheDir, { recursive: true });
    }
  }

  /**
   * Get file path for cache key
   */
  private getFilePath(key: string): string {
    // Sanitize key to create valid filename
    const sanitizedKey = key.replace(/[^a-z0-9_-]/gi, '_');
    return join(this.cacheDir, `${sanitizedKey}.json`);
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
      await this.ensureCacheDir();
      const filePath = this.getFilePath(key);
      
      // Check if file exists
      try {
        await fs.access(filePath);
      } catch {
        // Sync cache miss to monitoring
        await getCacheMonitor().syncCacheStatus('file', key, 'missing');
        return null;
      }

      // Read cache file as buffer
      const buffer = await fs.readFile(filePath);
      
      // Try to decompress if compression is enabled
      let content: string;
      try {
        // Try to decompress
        const decompressed = await gunzipAsync(buffer);
        content = decompressed.toString('utf-8');
      } catch {
        // Not compressed, read as plain text
        content = buffer.toString('utf-8');
      }

      const entry: CacheEntry<T> = JSON.parse(content);

      // Check if expired
      if (this.isExpired(entry)) {
        await this.delete(key);
        // Sync expired cache to monitoring
        await getCacheMonitor().syncCacheStatus('file', key, 'missing');
        return null;
      }

      // Sync found cache to monitoring
      await getCacheMonitor().syncCacheStatus('file', key, 'exists', entry);
      return entry.data;
    } catch (error) {
      console.error('[FileCacheProvider] Error reading cache:', error);
      return null;
    }
  }

  async getWithMeta<T = any>(key: string): Promise<import('../types').CacheResultWithMeta<T> | null> {
    try {
      await this.ensureCacheDir();
      const filePath = this.getFilePath(key);

      // Check if file exists
      try {
        await fs.access(filePath);
      } catch {
        // Sync cache miss to monitoring
        await getCacheMonitor().syncCacheStatus('file', key, 'missing');
        return null;
      }

      // Read cache file
      const buffer = await fs.readFile(filePath);
      
      // Try to decompress if compression is enabled
      let content: string;
      let isCompressed = false;
      let compressedSize = 0;

      try {
        // Try to decompress
        const decompressed = await gunzipAsync(buffer);
        content = decompressed.toString('utf-8');
        isCompressed = true;
        compressedSize = buffer.byteLength;
        console.log(`[FileCacheProvider] ✅ Decompressed cache: ${(compressedSize / 1024).toFixed(1)} KB → ${(Buffer.byteLength(content) / 1024).toFixed(1)} KB`);
      } catch {
        // Not compressed, read as plain text
        content = buffer.toString('utf-8');
      }

      const entry: CacheEntry<T> = JSON.parse(content);

      // Check if expired
      if (this.isExpired(entry)) {
        await this.delete(key);
        // Sync expired cache to monitoring
        await getCacheMonitor().syncCacheStatus('file', key, 'missing');
        return null;
      }

      // Calculate sizes
      const uncompressedSize = Buffer.byteLength(content, 'utf-8');
      const compressionRatio = isCompressed ? ((1 - compressedSize / uncompressedSize) * 100) : undefined;

      // Sync found cache to monitoring
      await getCacheMonitor().syncCacheStatus('file', key, 'exists', entry);
      
      return {
        data: entry.data,
        metadata: {
          uncompressedSize,
          compressedSize: isCompressed ? compressedSize : undefined,
          isCompressed,
          compressionRatio: compressionRatio ? parseFloat(compressionRatio.toFixed(1)) : undefined,
        },
      };
    } catch (error) {
      console.error('[FileCacheProvider] Error reading cache with meta:', error);
      return null;
    }
  }

  async set<T = any>(key: string, data: T, ttl: number): Promise<void> {
    try {
      console.log(`[FileCacheProvider] set() called - key: ${key}`);
      await this.ensureCacheDir();
      const filePath = this.getFilePath(key);

      const entry: CacheEntry<T> = {
        data,
        timestamp: Date.now(),
        ttl,
      };

      const jsonString = JSON.stringify(entry);
      const uncompressedSize = Buffer.byteLength(jsonString, 'utf-8');

      console.log(`[FileCacheProvider] Writing cache file: ${filePath}`);
      
      // Compress if enabled
      let bufferToWrite: Buffer;
      if (this.compressionEnabled) {
        const compressStartTime = Date.now();
        bufferToWrite = await gzipAsync(jsonString);
        const compressTime = Date.now() - compressStartTime;
        const compressedSize = bufferToWrite.byteLength;
        const compressionRatio = ((1 - compressedSize / uncompressedSize) * 100).toFixed(1);
        
        console.log(
          `[FileCacheProvider] ✅ CACHE COMPRESSED: ${(uncompressedSize / 1024).toFixed(1)} KB → ${(compressedSize / 1024).toFixed(1)} KB (saved ${compressionRatio}%) in ${compressTime}ms`
        );
      } else {
        bufferToWrite = Buffer.from(jsonString, 'utf-8');
      }

      await fs.writeFile(filePath, bufferToWrite);
      console.log(`[FileCacheProvider] ✅ Wrote to: ${filePath}`);

      // Save to monitoring directory
      console.log(`[FileCacheProvider] About to call getCacheMonitor().saveEntry()`);
      const monitor = getCacheMonitor();
      console.log(`[FileCacheProvider] Got monitor instance, calling saveEntry...`);
      await monitor.saveEntry('file', key, entry);
      console.log(`[FileCacheProvider] ✅ saveEntry() completed`);
    } catch (error) {
      console.error('[FileCacheProvider] ❌ Error writing cache:', error);
      throw error;
    }
  }

  async has(key: string): Promise<boolean> {
    try {
      await this.ensureCacheDir();
      const filePath = this.getFilePath(key);

      // Check if file exists
      try {
        await fs.access(filePath);
      } catch {
        // Sync cache miss to monitoring
        await getCacheMonitor().syncCacheStatus('file', key, 'missing');
        return false;
      }

      // Read and check if expired
      const content = await fs.readFile(filePath, 'utf-8');
      const entry: CacheEntry = JSON.parse(content);

      if (this.isExpired(entry)) {
        await this.delete(key);
        // Sync expired cache to monitoring
        await getCacheMonitor().syncCacheStatus('file', key, 'missing');
        return false;
      }

      // Sync found cache to monitoring
      await getCacheMonitor().syncCacheStatus('file', key, 'exists', entry);
      return true;
    } catch {
      return false;
    }
  }

  async delete(key: string): Promise<void> {
    try {
      const filePath = this.getFilePath(key);
      await fs.unlink(filePath);

      // Remove from monitoring directory
      await getCacheMonitor().deleteEntry('file', key);
    } catch {
      // Ignore errors if file doesn't exist
    }
  }

  async clear(): Promise<void> {
    try {
      console.log(`[FileCacheProvider] 🗑️ Starting cache clear for directory: ${this.cacheDir}`);
      await this.ensureCacheDir();
      const files = await fs.readdir(this.cacheDir);
      
      console.log(`[FileCacheProvider] Found ${files.length} files to delete`);
      
      await Promise.all(
        files.map(file => 
          fs.unlink(join(this.cacheDir, file)).catch((err) => {
            console.error(`[FileCacheProvider] Error deleting ${file}:`, err);
          })
        )
      );

      console.log(`[FileCacheProvider] ✅ All cache files deleted`);

      // Clear monitoring directory
      await getCacheMonitor().clearProvider('file');
      console.log(`[FileCacheProvider] ✅ Monitoring directory cleared`);
    } catch (error) {
      console.error('[FileCacheProvider] ❌ Error clearing cache:', error);
      throw error;
    }
  }
}
