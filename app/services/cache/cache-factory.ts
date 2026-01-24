/**
 * Cache Factory
 * 
 * Factory for creating cache provider instances based on configuration.
 * This allows easy switching between different cache providers.
 */

import type { CacheProvider } from './types';
import { FileCacheProvider } from './providers/file-cache-provider';

export type CacheProviderType = 'file' | 'redis' | 'supabase';

export class CacheFactory {
  /**
   * Create cache provider instance based on type
   */
  static createProvider(type: CacheProviderType): CacheProvider {
    switch (type) {
      case 'file':
        return new FileCacheProvider();
      
      case 'redis':
        // TODO: Implement Redis cache provider in the future
        throw new Error('Redis cache provider is not implemented yet');
      
      case 'supabase':
        // TODO: Implement Supabase PostgreSQL cache provider in the future
        throw new Error('Supabase cache provider is not implemented yet');
      
      default:
        throw new Error(`Unknown cache provider type: ${type}`);
    }
  }
}
