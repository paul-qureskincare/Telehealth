/**
 * Cache Configuration
 * 
 * This configuration file manages the caching mechanism for the Embeddables service.
 * It allows enabling/disabling caching and selecting different cache providers.
 * 
 * Environment Variables:
 * - CACHE_ENABLED: Enable/disable caching (true/false)
 * - CACHE_PROVIDER: Cache provider type (file/redis/supabase)
 * - CACHE_TTL: Cache time-to-live in milliseconds
 * - CACHE_DEBUG: Enable debug mode (true/false)
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

/**
 * Get cache provider from environment or use default
 */
function getCacheProvider(): 'file' | 'redis' | 'supabase' {
  const provider = process.env.CACHE_PROVIDER?.toLowerCase();
  
  if (provider === 'redis' || provider === 'supabase') {
    return provider;
  }
  
  // Default to file
  return 'file';
}

/**
 * Get boolean value from environment variable
 */
function getEnvBoolean(key: string, defaultValue: boolean): boolean {
  const value = process.env[key]?.toLowerCase();
  
  if (value === 'true' || value === '1') {
    return true;
  }
  
  if (value === 'false' || value === '0') {
    return false;
  }
  
  return defaultValue;
}

/**
 * Get number value from environment variable
 */
function getEnvNumber(key: string, defaultValue: number): number {
  const value = process.env[key];
  
  if (value) {
    const parsed = parseInt(value, 10);
    if (!isNaN(parsed)) {
      return parsed;
    }
  }
  
  return defaultValue;
}

export const cacheConfig: CacheConfig = {
  // Enable caching (default: true)
  enabled: getEnvBoolean('CACHE_ENABLED', true),
  
  // Cache provider (default: file)
  provider: getCacheProvider(),
  
  // Cache TTL: 1 hour (3600000 milliseconds)
  ttl: getEnvNumber('CACHE_TTL', 3600000),
  
  // Show debug panel on frontend (default: true)
  debug: getEnvBoolean('CACHE_DEBUG', true),
};
