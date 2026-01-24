/**
 * Cache Configuration
 * 
 * This configuration file manages the caching mechanism for the Embeddables service.
 * It allows enabling/disabling caching and selecting different cache providers.
 */

export interface CacheConfig {
  // Enable or disable caching mechanism
  enabled: boolean;
  
  // Cache provider type (file, redis, supabase, etc.)
  provider: 'file' | 'redis' | 'supabase';
  
  // Cache time-to-live in milliseconds (default: 1 hour)
  ttl: number;
  
  // Enable debug mode to display cache status on frontend
  debug: boolean;
}

export const cacheConfig: CacheConfig = {
  // Enable caching by default
  enabled: true,
  
  // Use file-based caching as default provider
  provider: 'file',
  
  // Cache TTL: 1 hour (3600000 milliseconds)
  ttl: 3600000,
  
  // Show debug panel on frontend
  debug: true,
};
