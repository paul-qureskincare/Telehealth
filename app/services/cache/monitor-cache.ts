/**
 * Cache Monitor Utility
 *
 * This utility saves cache data to a monitoring directory for visibility.
 * Useful for debugging and monitoring cache operations.
 *
 * Directory structure:
 * - /cache/file/ → For file provider cache
 * - /cache/redis/ → For Redis provider cache
 */

import { promises as fs } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { CacheEntry } from './types';

// Get __dirname equivalent for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

class CacheMonitor {
  private isEnabled: boolean;
  private baseMonitorDir: string;

  constructor(enabled: boolean) {
    this.isEnabled = enabled;
    // Use __dirname to get the directory of this file, then navigate to project root
    // app/services/cache/monitor-cache.ts -> project root is ../../.. (4 levels up)
    const projectRoot = resolve(__dirname, '../../..');
    this.baseMonitorDir = join(projectRoot, 'cache');
    
    // Log the base monitor directory for debugging
    console.log('[CacheMonitor] Initialized with base directory:', this.baseMonitorDir);
  }

  /**
   * Get monitor directory based on provider type
   */
  private getMonitorDir(provider: 'file' | 'redis'): string {
    return join(this.baseMonitorDir, provider);
  }

  /**
   * Ensure monitor directory exists
   */
  private async ensureMonitorDir(provider: 'file' | 'redis'): Promise<void> {
    console.log(`[CacheMonitor] ensureMonitorDir called - isEnabled: ${this.isEnabled}, provider: ${provider}`);
    
    if (!this.isEnabled) {
      console.log(`[CacheMonitor] Monitor is disabled, skipping ensureMonitorDir`);
      return;
    }

    try {
      const monitorDir = this.getMonitorDir(provider);
      console.log(`[CacheMonitor] Creating directory: ${monitorDir}`);
      await fs.mkdir(monitorDir, { recursive: true });
      console.log(`[CacheMonitor] ✅ Directory created/exists: ${monitorDir}`);
    } catch (error) {
      console.error('[CacheMonitor] ❌ Error creating monitor directory:', error);
    }
  }

  /**
   * Save cache entry to monitor directory
   */
  async saveEntry<T = any>(
    provider: 'file' | 'redis',
    key: string,
    entry: CacheEntry<T>
  ): Promise<void> {
    console.log(`[CacheMonitor] saveEntry called - isEnabled: ${this.isEnabled}, provider: ${provider}, key: ${key}`);
    
    if (!this.isEnabled) {
      console.log('[CacheMonitor] Monitoring is disabled, skipping save');
      return;
    }

    try {
      await this.ensureMonitorDir(provider);

      // Sanitize key for filename
      const sanitizedKey = key.replace(/[^a-z0-9_-]/gi, '_');
      const monitorDir = this.getMonitorDir(provider);
      const filePath = join(monitorDir, `${sanitizedKey}.json`);

      // Create monitor data with additional metadata
      const monitorData = {
        key,
        timestamp: entry.timestamp,
        ttl: entry.ttl,
        expiresAt: entry.timestamp + entry.ttl,
        expiresAtISO: new Date(entry.timestamp + entry.ttl).toISOString(),
        data: entry.data,
        savedAt: new Date().toISOString(),
      };

      await fs.writeFile(filePath, JSON.stringify(monitorData, null, 2), 'utf-8');
      console.log(`[CacheMonitor] ✅ Saved ${provider} cache entry to: ${filePath}`);
    } catch (error) {
      console.error('[CacheMonitor] ❌ Error saving cache entry:', error);
    }
  }

  /**
   * Delete cache entry from monitor directory
   */
  async deleteEntry(provider: 'file' | 'redis', key: string): Promise<void> {
    if (!this.isEnabled) {
      return;
    }

    try {
      const sanitizedKey = key.replace(/[^a-z0-9_-]/gi, '_');
      const monitorDir = this.getMonitorDir(provider);
      const filePath = join(monitorDir, `${sanitizedKey}.json`);

      await fs.unlink(filePath);
    } catch {
      // Ignore errors if file doesn't exist
    }
  }

  /**
   * Clear all monitor entries for a provider
   */
  async clearProvider(provider: 'file' | 'redis'): Promise<void> {
    if (!this.isEnabled) {
      return;
    }

    try {
      const monitorDir = this.getMonitorDir(provider);

      try {
        const files = await fs.readdir(monitorDir);
        await Promise.all(
          files.map((file) =>
            fs.unlink(join(monitorDir, file)).catch(() => {})
          )
        );
      } catch {
        // Directory might not exist, that's fine
      }
    } catch (error) {
      console.error('[CacheMonitor] Error clearing monitor entries:', error);
    }
  }

  /**
   * Sync cache status to monitoring directory
   * Creates/updates monitor files with cache metadata regardless of actual cache existence
   * Useful for monitoring cache operations without the actual cached data
   */
  async syncCacheStatus<T = any>(
    provider: 'file' | 'redis',
    key: string,
    status: 'exists' | 'missing',
    entry?: CacheEntry<T>
  ): Promise<void> {
    console.log(`[CacheMonitor] syncCacheStatus called - provider: ${provider}, key: ${key}, status: ${status}`);
    
    if (!this.isEnabled) {
      console.log('[CacheMonitor] Monitoring is disabled, skipping sync');
      return;
    }

    try {
      await this.ensureMonitorDir(provider);

      // Sanitize key for filename
      const sanitizedKey = key.replace(/[^a-z0-9_-]/gi, '_');
      const monitorDir = this.getMonitorDir(provider);
      const filePath = join(monitorDir, `${sanitizedKey}.json`);

      if (status === 'missing') {
        // Create monitor data indicating cache miss/deletion
        const monitorData = {
          key,
          status: 'missing',
          syncedAt: new Date().toISOString(),
          data: null,
        };
        await fs.writeFile(filePath, JSON.stringify(monitorData, null, 2), 'utf-8');
        console.log(`[CacheMonitor] ✅ Synced ${provider} cache status (missing) to: ${filePath}`);
      } else if (entry) {
        // Create monitor data with entry information
        const monitorData = {
          key,
          status: 'exists',
          timestamp: entry.timestamp,
          ttl: entry.ttl,
          expiresAt: entry.timestamp + entry.ttl,
          expiresAtISO: new Date(entry.timestamp + entry.ttl).toISOString(),
          data: entry.data,
          syncedAt: new Date().toISOString(),
        };
        await fs.writeFile(filePath, JSON.stringify(monitorData, null, 2), 'utf-8');
        console.log(`[CacheMonitor] ✅ Synced ${provider} cache status (exists) to: ${filePath}`);
      }
    } catch (error) {
      console.error('[CacheMonitor] ❌ Error syncing cache status:', error);
    }
  }
}

/**
 * Create singleton monitor instance
 * Will be initialized when cache manager is created
 */
let monitor: CacheMonitor | null = null;

export function initializeCacheMonitor(enabled: boolean): void {
  monitor = new CacheMonitor(enabled);
}

/**
 * Get cache monitor instance
 */
export function getCacheMonitor(): CacheMonitor {
  if (!monitor) {
    monitor = new CacheMonitor(false);
  }
  return monitor;
}
