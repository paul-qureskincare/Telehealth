# Cache Monitoring Feature

## Overview

The cache monitoring feature allows you to save a copy of all cached data to the filesystem for visibility and debugging purposes.

## How It Works

When `CACHE_SAVE=true` is set in your `.env` file:

1. **File Provider Cache** → Saved to `/cache/file/`
2. **Redis Provider Cache** → Saved to `/cache/redis/`

Each cache entry is saved with additional metadata including:
- Original cache key
- Timestamp (when the cache was created)
- TTL (time-to-live in milliseconds)
- Expiration time (calculated)
- Expiration time (in ISO format for readability)
- The actual cached data
- Saved time (when the monitor saved the file)

## Configuration

Add to your `.env` file:

```env
# Enable cache monitoring (true or false)
CACHE_SAVE=true
```

## Example Monitor Output

### File Cache (`/cache/file/`)

```json
{
  "key": "embeddable:product:123",
  "timestamp": 1704067200000,
  "ttl": 3600000,
  "expiresAt": 1704070800000,
  "expiresAtISO": "2024-01-01T02:00:00.000Z",
  "data": {
    "id": "123",
    "name": "Product Name",
    "price": 99.99
  },
  "savedAt": "2024-01-01T01:00:00.123Z"
}
```

### Redis Cache (`/cache/redis/`)

Same structure as file cache, but shows Redis-stored data.

## Monitoring Benefits

1. **Debugging** - See exactly what data is being cached
2. **Performance Analysis** - Monitor cache hit rates and data size
3. **Expiration Tracking** - See when cached data will expire
4. **Multi-Provider Visibility** - Monitor both file and Redis cache separately
5. **Zero Performance Impact** - Monitoring happens asynchronously

## Directory Structure

```
your-project/
├── cache/
│   ├── file/              # File provider cache mirror
│   │   ├── key_1.json
│   │   ├── key_2.json
│   │   └── ...
│   └── redis/             # Redis provider cache mirror
│       ├── key_1.json
│       ├── key_2.json
│       └── ...
├── .env
└── ...
```

## Usage in Development

1. **Enable monitoring** in `.env`:
   ```env
   CACHE_SAVE=true
   ```

2. **Watch the cache directory** to see real-time cache operations:
   ```bash
   # Terminal 1
   npm run dev

   # Terminal 2 (watch cache directory)
   watch -n 1 'ls -la cache/file/ && echo "---" && ls -la cache/redis/'
   ```

3. **Inspect cache files** to verify cached data:
   ```bash
   cat cache/file/embeddable_product_123.json | jq .
   ```

## Disabling Monitoring

Set `CACHE_SAVE=false` or remove the line from `.env`. The monitoring system will have zero overhead when disabled.

## Note

- Monitor files are only created when cache entries are set
- Files are deleted when cache entries are deleted
- All cache operations (set, delete, clear) are reflected in the monitoring directory
- Monitoring works for both file-based and Redis providers
