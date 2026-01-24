# Cache Debug Panel - Detailed LoadTime Metrics

## Overview
The Cache Debug Panel now provides comprehensive performance metrics that break down the LoadTime into individual components, helping you understand exactly where time is being spent in the embed loading process.

## Backend Changes (api.embed-proxy.ts)

### For Cache Hits (when data is retrieved from cache):
```typescript
_cache_meta: {
  cached: true,
  source: 'cache',
  cache_get_time: number,      // Time to retrieve from cache (Redis/File)
  network_time: number,         // Overhead (request setup, response streaming, etc)
  total_time: number,           // cache_get_time + network_time
  cache_size_kb: number,        // Size of cached data in KB
}
```

**What it tells you:**
- `cache_get_time` - How fast your cache provider (Redis) responds
- `network_time` - Browser/network overhead beyond cache retrieval

### For Native Fetches (when data is fetched from Embeddables API):
```typescript
_cache_meta: {
  cached: false,
  source: 'native',
  cache_check_time: number,     // Time spent checking if data exists in cache
  api_fetch_time: number,       // Time to fetch from Embeddables API
  json_parse_time: number,      // Time to parse JSON response
  cache_save_time: number,      // Time to save data to cache
  network_overhead: number,     // Additional overhead (request setup, etc)
  total_time: number,           // Sum of all times above
  cache_size_kb: number,        // Size of fetched data in KB
}
```

**What it tells you:**
- `cache_check_time` - Latency of cache check (typically very fast for misses)
- `api_fetch_time` - External API latency (depends on Embeddables service)
- `json_parse_time` - JavaScript JSON.parse() performance
- `cache_save_time` - How long it takes to store in cache (depends on size and provider)
- `network_overhead` - Browser/network overhead = total - fetch - parse - save

## Frontend Changes (EmbedCacheDebugPanel.tsx)

### Visual Components

1. **LoadTime Breakdown Chart**
   - Horizontal bar chart showing time distribution
   - Color-coded segments for each operation
   - Percentage labels for visual comparison
   - Hover tooltips for exact values

2. **Detailed Breakdown List**
   - Formatted as a clean list with icons
   - Shows milliseconds and percentage for each component
   - Different colors for different operation types

### Color Coding
- 🟢 **Emerald** - Cache Retrieval
- 🔵 **Blue** - API Fetch / Network
- 🟡 **Yellow** - Cache Check
- 🟣 **Purple** - JSON Parse
- 🟢 **Green** - Cache Save
- ⚫ **Slate** - Network Overhead

### Type Updates (global.d.ts)
Added new timing metrics to the `Window._embedCacheMeta` interface for TypeScript type safety.

## How to Read the Panel

### Cache Hit Example:
```
LoadTime: 45ms

LoadTime Breakdown:
  🟢 Cache Retrieval: 12ms (27%)
  🔵 Network: 33ms (73%)

📊 Total Time: 45ms
```
→ Your cache is very fast! Most time is network overhead.

### Native Fetch Example:
```
LoadTime: 1240ms

LoadTime Breakdown:
  🟡 Cache Check: 2ms (0%)
  🔵 API Fetch: 850ms (68%)
  🟣 JSON Parse: 180ms (15%)
  🟢 Cache Save: 150ms (12%)
  ⚫ Network Overhead: 58ms (5%)

📊 Total Time: 1240ms
```
→ API is the bottleneck (850ms). Consider implementing request batching or CDN.

## Enabling Debug Mode

Add to your environment or `.env` file:
```
VITE_CACHE_DEBUG=true
```

Or set it in JavaScript:
```javascript
window.__CACHE_DEBUG__ = true;
```

## Performance Optimization Tips

### If `cache_check_time` is high:
- Consider a faster cache provider (Redis vs File)
- Check cache provider connection status

### If `api_fetch_time` is high:
- Check Embeddables API performance
- Consider implementing request caching strategies
- Use a CDN if possible

### If `json_parse_time` is high:
- Your data might be too large
- Consider data compression (already enabled for Redis)
- Optimize data structure to reduce payload

### If `cache_save_time` is high:
- You might be saving very large objects
- Check if compression is enabled (for Redis)
- Consider optimizing data structure

### If `network_overhead` is high:
- Check browser network conditions
- Consider using service workers for additional caching
- Profile with browser DevTools to see if it's CSS/JS parsing
