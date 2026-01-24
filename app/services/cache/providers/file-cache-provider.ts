/**
 * File-Based Cache Provider
 * 
 * This provider stores cache data in the file system using temporary directory.
 * Works both locally (using os.tmpdir()) and on Vercel serverless (using /tmp).
 * 
 * Note: On Vercel, /tmp is ephemeral and limited to 512MB. Files may not persist
 * between cold starts, but can persist within the same execution environment.
 */

import { promises as fs } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import type { CacheProvider, CacheEntry } from '../types';
import { getCacheMonitor } from '../monitor-cache';

export class FileCacheProvider implements CacheProvider {
  private cacheDir: string;

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
        return null;
      }

      // Read and parse cache file
      const content = await fs.readFile(filePath, 'utf-8');
      const entry: CacheEntry<T> = JSON.parse(content);

      // Check if expired
      if (this.isExpired(entry)) {
        await this.delete(key);
        return null;
      }

      return entry.data;
    } catch (error) {
      console.error('[FileCacheProvider] Error reading cache:', error);
      return null;
    }
  }

  async set<T = any>(key: string, data: T, ttl: number): Promise<void> {
    try {
      await this.ensureCacheDir();
      const filePath = this.getFilePath(key);

      const entry: CacheEntry<T> = {
        data,
        timestamp: Date.now(),
        ttl,
      };

      await fs.writeFile(filePath, JSON.stringify(entry), 'utf-8');

      // Save to monitoring directory
      await getCacheMonitor().saveEntry('file', key, entry);
    } catch (error) {
      console.error('[FileCacheProvider] Error writing cache:', error);
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
        return false;
      }

      // Read and check if expired
      const content = await fs.readFile(filePath, 'utf-8');
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
      await this.ensureCacheDir();
      const files = await fs.readdir(this.cacheDir);
      
      await Promise.all(
        files.map(file => 
          fs.unlink(join(this.cacheDir, file)).catch(() => {})
        )
      );

      // Clear monitoring directory
      await getCacheMonitor().clearProvider('file');
    } catch (error) {
      console.error('[FileCacheProvider] Error clearing cache:', error);
    }
  }
}
