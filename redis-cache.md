# Redis Cache Provider

## Overview
Redis cache provider is now implemented and ready to use. It provides fast, distributed caching with automatic expiration.

## Features
- ✅ Redis-based caching using `ioredis` client
- ✅ Automatic connection management with retry strategy
- ✅ TTL (Time-To-Live) support with automatic expiration
- ✅ Connection status monitoring
- ✅ Graceful error handling

## Configuration

### Environment Variables (in `.env`)

```env
# Redis Connection
REDIS_URL=redis://default:password@host:port

# Cache Provider Selection
CACHE_PROVIDER=redis    # or 'file' for file-based cache

# Optional Cache Settings
CACHE_ENABLED=true      # Enable/disable caching
CACHE_TTL=3600000       # TTL in milliseconds (default: 1 hour)
CACHE_DEBUG=true        # Show debug panel on frontend
```

## Switching Between Providers

### Use File Cache (default)
```env
CACHE_PROVIDER=file
```

### Use Redis Cache
```env
CACHE_PROVIDER=redis
REDIS_URL=redis://your-redis-url
```

## Implementation Details

### Redis Cache Provider (`redis-cache-provider.ts`)
- Stores cache entries with prefix `embeddables-cache:`
- Implements automatic expiration using Redis `SETEX` command
- Handles connection errors gracefully
- Supports reconnection with exponential backoff

### How It Works
1. When `CACHE_PROVIDER=redis`, the cache factory creates `RedisCacheProvider`
2. All cache operations (`get`, `set`, `has`, `delete`, `clear`) work through Redis
3. Redis automatically handles TTL and removes expired entries
4. Cache data is stored as JSON with metadata (data, timestamp, ttl)

## Testing
1. Set `CACHE_PROVIDER=redis` in `.env`
2. Start the server: `npm run dev`
3. First request will fetch from native Embed and cache in Redis
4. Subsequent requests will load from Redis cache
5. After TTL expires, cache refreshes automatically