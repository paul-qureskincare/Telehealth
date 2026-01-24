# Redis Cache Provider

## Overview
Redis cache provider is now implemented and ready to use. It provides fast, distributed caching with automatic expiration.

## Performance Optimizations ⚡

### Singleton Pattern
- **Single Redis Client**: One shared client instance across all requests
- **Connection Reuse**: Eliminates connection overhead on every request
- **Lambda Optimization**: Persists connections between Lambda invocations in Vercel

### Connection Pooling
- **Keep-Alive**: Maintains connections for 30 seconds
- **Lazy Connect**: Only connects when first command is sent
- **DNS Caching**: Uses IPv4 with DNS caching enabled
- **Fast Timeout**: 5-second connection timeout for quick failures

### Expected Performance
- **First Request (Cold Start)**: ~50-100ms (includes connection establishment)
- **Subsequent Requests (Warm)**: ~5-15ms (reuses existing connection)
- **Cache Hit**: ~10-20ms total (Redis fetch + JSON parse)
- **Cache Miss**: ~5-10ms (just Redis check)

## Features
- ✅ Redis-based caching using `ioredis` client
- ✅ **Singleton pattern** for connection reuse
- ✅ **Connection pooling** for optimal performance
- ✅ Automatic connection management with retry strategy
- ✅ TTL (Time-To-Live) support with automatic expiration
- ✅ Connection status monitoring
- ✅ Graceful error handling
- ✅ Lazy connection (connects only when needed)

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
- **Singleton Redis client** - shared across all requests
- Stores cache entries with prefix `embeddables-cache:`
- Implements automatic expiration using Redis `SETEX` command
- Handles connection errors gracefully
- Supports reconnection with exponential backoff (max 10 retries)
- Lazy connection - connects only when first command is sent

### How It Works
1. When `CACHE_PROVIDER=redis`, the cache factory creates `RedisCacheProvider`
2. First request creates a singleton Redis client (reused for all subsequent requests)
3. All cache operations (`get`, `set`, `has`, `delete`, `clear`) work through Redis
4. Redis automatically handles TTL and removes expired entries
5. Cache data is stored as JSON with metadata (data, timestamp, ttl)
6. Connection persists between Lambda invocations for optimal performance

### Region Configuration
- **Frontend (Vercel)**: Deployed in `iad1` (AWS US-East-1, Virginia)
- **Redis**: Should be in the same region for minimal latency
- Current setup: Redis in `us-east-1-4` (optimal for Vercel deployment)

## Testing
1. Set `CACHE_PROVIDER=redis` in `.env`
2. Start the server: `npm run dev`
3. First request will fetch from native Embed and cache in Redis
4. Subsequent requests will load from Redis cache
5. After TTL expires, cache refreshes automatically