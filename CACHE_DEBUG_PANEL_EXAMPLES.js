/**
 * CACHE DEBUG PANEL - VISUAL BREAKDOWN EXAMPLES
 * 
 * This file shows what the debug panel looks like with actual metric data.
 * It demonstrates different scenarios and how to interpret the metrics.
 */

// ============================================
// SCENARIO 1: CACHE HIT (OPTIMAL CASE)
// ============================================

{
  cached: true,
  timestamp: 1705954200000,
  source: 'cache',
  loadTime: 42,
  cache_enabled: true,
  cache_provider: 'redis',
  cache_size_kb: 245,
  cache_get_time: 8,
  network_time: 34,
  total_time: 42
}

/*
Frontend Display:
┌─────────────────────────────────────────────┐
│ ⚡ Embed Cache Status                        │
├─────────────────────────────────────────────┤
│ Source: [CACHE]                              │
│ Cache Type: REDIS                            │
│ Load Time: 42ms                              │
│ Data Size: 245 KB                            │
│ Cache Enabled: ✓ Yes                         │
├─────────────────────────────────────────────┤
│ ⏱️  LoadTime Breakdown:                      │
│ ┌─────────────────┬──────────────────────┐  │
│ │ ████░░░░░░░░░░│                        │  │
│ │ ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░  │
│ └─────────────────┴──────────────────────┘  │
│                                              │
│ ● Cache Retrieval: 8ms (19%)                │
│ ● Network: 34ms (81%)                       │
├─────────────────────────────────────────────┤
│ ⏰ 14:30:00                                   │
│ 📦 Cache Get: 8ms                            │
│ 📊 Total Time: 42ms                          │
├─────────────────────────────────────────────┤
│ ⚡ Data served from cache for faster loading │
└─────────────────────────────────────────────┘

Interpretation:
✓ Very fast response (42ms total)
✓ Cache retrieval is efficient (8ms)
✓ Network overhead is reasonable for 245KB
→ This is the ideal scenario
*/


// ============================================
// SCENARIO 2: NATIVE FETCH (FIRST LOAD)
// ============================================

{
  cached: false,
  timestamp: 1705954210000,
  source: 'native',
  loadTime: 1245,
  cache_enabled: true,
  cache_provider: 'redis',
  cache_size_kb: 245,
  cache_check_time: 3,
  api_fetch_time: 892,
  json_parse_time: 215,
  cache_save_time: 120,
  network_overhead: 15,
  total_time: 1245
}

/*
Frontend Display:
┌──────────────────────────────────────────────┐
│ 🌐 Embed Cache Status                         │
├──────────────────────────────────────────────┤
│ Source: [NATIVE]                              │
│ Cache Type: REDIS                             │
│ Load Time: 1245ms                             │
│ Data Size: 245 KB                             │
│ Cache Enabled: ✓ Yes                          │
├──────────────────────────────────────────────┤
│ ⏱️  LoadTime Breakdown:                       │
│ ┌──────────────────────────────────────────┐ │
│ │ █░█████████░████░████░██░░░░░░░░░░░░░░░│ │
│ │ █░█████████░████░████░██░░░░░░░░░░░░░░░│ │
│ └──────────────────────────────────────────┘ │
│                                               │
│ ● Cache Check: 3ms (0%)                      │
│ ● API Fetch: 892ms (72%)       ← DOMINANT   │
│ ● JSON Parse: 215ms (17%)                    │
│ ● Cache Save: 120ms (10%)                    │
│ ● Network Overhead: 15ms (1%)                │
├──────────────────────────────────────────────┤
│ ⏰ 14:30:10                                    │
│ 🔍 Cache Check: 3ms                          │
│ 🌐 API Fetch: 892ms                          │
│ 📄 JSON Parse: 215ms                         │
│ 💾 Cache Save: 120ms                         │
│ 🔗 Network Overhead: 15ms                    │
│ 📊 Total Time: 1245ms                        │
├──────────────────────────────────────────────┤
│ 🌐 Fresh data fetched from Embeddables API   │
└──────────────────────────────────────────────┘

Interpretation:
! High total time (1245ms) - first load penalty
! API Fetch dominates (72% of time)
✓ JSON parse is reasonable for 245KB (215ms)
✓ Cache save is efficient (120ms)
→ External API is the bottleneck
→ Second request should use cache and be ~42ms
*/


// ============================================
// SCENARIO 3: VERY LARGE DATA SET
// ============================================

{
  cached: false,
  timestamp: 1705954220000,
  source: 'native',
  loadTime: 3840,
  cache_enabled: true,
  cache_provider: 'redis',
  cache_size_kb: 2048,  // Large dataset
  cache_check_time: 2,
  api_fetch_time: 1200,  // API is slow
  json_parse_time: 1850, // Parsing is very slow!
  cache_save_time: 680,  // Compression takes time
  network_overhead: 28,
  total_time: 3840
}

/*
Frontend Display:
┌────────────────────────────────────────────────┐
│ 🌐 Embed Cache Status                          │
├────────────────────────────────────────────────┤
│ Source: [NATIVE]                                │
│ Cache Type: REDIS                               │
│ Load Time: 3840ms ⚠️                            │
│ Data Size: 2048 KB                              │
│ Cache Enabled: ✓ Yes                            │
├────────────────────────────────────────────────┤
│ ⏱️  LoadTime Breakdown:                         │
│ ┌──────────────────────────────────────────┐   │
│ │ ██░████████░░░░░░░░░░░░░░░░░░░░░░░░░░  │   │
│ │ ██░████████░░░░░░░░░░░░░░░░░░░░░░░░░░  │   │
│ └──────────────────────────────────────────┘   │
│                                                 │
│ ● Cache Check: 2ms (0%)                        │
│ ● API Fetch: 1200ms (31%)                      │
│ ● JSON Parse: 1850ms (48%)     ← PROBLEM!     │
│ ● Cache Save: 680ms (18%)                      │
│ ● Network Overhead: 28ms (1%)                  │
├────────────────────────────────────────────────┤
│ ⏰ 14:30:20                                     │
│ 🔍 Cache Check: 2ms                            │
│ 🌐 API Fetch: 1200ms                           │
│ 📄 JSON Parse: 1850ms                          │
│ 💾 Cache Save: 680ms                           │
│ 📊 Total Time: 3840ms                          │
├────────────────────────────────────────────────┤
│ 🌐 Fresh data fetched from Embeddables API     │
└────────────────────────────────────────────────┘

Interpretation:
⚠️  Very slow (3840ms total) - serious performance issue
⚠️  Large dataset (2048 KB)
⚠️  JSON parsing is the bottleneck (48% = 1850ms)
! Too much data or inefficient parsing
→ Recommendations:
  1. Check if all 2048 KB is actually needed
  2. Consider data pagination/lazy loading
  3. Optimize data structure to reduce size
  4. Use compression/minification
  5. Consider API-side pagination
*/


// ============================================
// SCENARIO 4: CACHE HIT WITH LARGE DATA
// ============================================

{
  cached: true,
  timestamp: 1705954230000,
  source: 'cache',
  loadTime: 95,
  cache_enabled: true,
  cache_provider: 'redis',
  cache_size_kb: 2048,  // Same large dataset as Scenario 3
  cache_get_time: 45,   // Much faster than parsing!
  network_time: 50,
  total_time: 95
}

/*
Frontend Display:
┌────────────────────────────────────────────┐
│ ⚡ Embed Cache Status                       │
├────────────────────────────────────────────┤
│ Source: [CACHE]                             │
│ Cache Type: REDIS                           │
│ Load Time: 95ms  ✓✓✓                        │
│ Data Size: 2048 KB                          │
│ Cache Enabled: ✓ Yes                        │
├────────────────────────────────────────────┤
│ ⏱️  LoadTime Breakdown:                     │
│ ┌──────────────────────────────────────────┐ │
│ │ ███████░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░  │ │
│ │ ███████░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░  │ │
│ └──────────────────────────────────────────┘ │
│                                               │
│ ● Cache Retrieval: 45ms (47%)                │
│ ● Network: 50ms (53%)                        │
├────────────────────────────────────────────┤
│ ⏰ 14:30:30                                  │
│ 📦 Cache Get: 45ms                          │
│ 📊 Total Time: 95ms                         │
├────────────────────────────────────────────┤
│ ⚡ Data served from cache for faster loading │
└────────────────────────────────────────────┘

Comparison with Scenario 3:
❌ First load: 3840ms (JSON parse bottleneck)
✅ Cache hit: 95ms (40x faster!)

Interpretation:
✓ Cache dramatically improves performance
✓ Even with 2048 KB, retrieval is fast (45ms)
✓ This is why caching the complex data matters
→ Next requests will always use cache and be fast
*/


// ============================================
// KEY METRICS TO WATCH
// ============================================

/*
CACHE HIT - Look for:
✓ cache_get_time < 10ms     → Redis is fast
✓ network_time < 50ms       → Network overhead is minimal
✓ total_time < 100ms        → Excellent performance

NATIVE FETCH - Look for:
✓ api_fetch_time < 1000ms   → API responds quickly
⚠️  json_parse_time > 500ms  → Consider data optimization
⚠️  cache_save_time > 500ms  → Consider compression or smaller data
⚠️  total_time > 2000ms      → Performance issue exists

DATA SIZE - Look for:
✓ cache_size_kb < 500       → Small payload (good)
⚠️  cache_size_kb > 1000    → Large payload (consider splitting)
! cache_size_kb > 5000       → Very large (critical review needed)

CACHE CHECK - Look for:
✓ cache_check_time < 5ms    → Normal
! cache_check_time > 20ms    → Possible provider issue
*/
