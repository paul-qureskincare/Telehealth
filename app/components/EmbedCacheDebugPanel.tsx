/**
 * Embed Cache Debug Panel
 * 
 * This component displays debugging information about the cache status
 * for the Embeddables service. It shows whether data was loaded from cache
 * or fetched from the native API, along with detailed performance metrics
 * and LoadTime breakdown.
 */

import { useState, useEffect } from 'react';

interface CacheMeta {
  cached: boolean;
  timestamp: number;
  source: 'cache' | 'native';
  loadTime: number;
  cache_enabled?: boolean;
  cache_provider?: 'file' | 'redis' | 'supabase';
  cache_size_kb?: number; // Legacy field for backward compatibility
  uncompressed_size_kb?: number;
  compressed_size_kb?: number;
  compression_ratio?: number;
  is_compressed?: boolean;
  // Cache hit metrics
  cache_get_time?: number;
  network_time?: number;
  // Native fetch metrics
  cache_check_time?: number;
  api_fetch_time?: number;
  json_parse_time?: number;
  cache_save_time?: number;
  network_overhead?: number;
  // Total
  total_time?: number;
}

interface TimingBreakdown {
  label: string;
  value: number;
  color: string;
  percentage: number;
}

export function EmbedCacheDebugPanel() {
  const [cacheMeta, setCacheMeta] = useState<CacheMeta | null>(null);
  const [isVisible, setIsVisible] = useState(true);
  const [debugEnabled, setDebugEnabled] = useState(false);
  const [timingBreakdown, setTimingBreakdown] = useState<TimingBreakdown[]>([]);
  const [isClearing, setIsClearing] = useState(false);

  useEffect(() => {
    // Check if CACHE_DEBUG is enabled from window global
    const debugFlag = (window as any).__CACHE_DEBUG__ === 'true' || (window as any).__CACHE_DEBUG__ === true;
    setDebugEnabled(debugFlag);

    // Listen for embed loaded event
    const handleEmbedLoaded = () => {
      if (window._embedCacheMeta) {
        setCacheMeta(window._embedCacheMeta);
        calculateTimingBreakdown(window._embedCacheMeta);
      }
    };

    window.addEventListener('embed-loaded', handleEmbedLoaded);

    // Check if already loaded
    if (window._embedCacheMeta) {
      setCacheMeta(window._embedCacheMeta);
      calculateTimingBreakdown(window._embedCacheMeta);
    }

    return () => {
      window.removeEventListener('embed-loaded', handleEmbedLoaded);
    };
  }, []);

  // Clear cache function
  const handleClearCache = async () => {
    setIsClearing(true);
    try {
      console.log('[DebugPanel] Calling cache clear endpoint...');
      const response = await fetch('/api/cache-clear', {
        method: 'POST',
      });
      
      const result = await response.json();
      
      if (response.ok && result.success) {
        console.log(`[DebugPanel] ✅ Cache cleared successfully (${result.provider}, ${result.clearTime}ms)`);
        
        // Wait for file system sync to complete before reloading
        // The server waits 500ms, we add extra 1.5s on client to be safe
        console.log('[DebugPanel] ⏳ Waiting for file system sync...');
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        console.log('[DebugPanel] 🔄 Reloading page to fetch fresh data...');
        window.location.reload();
      } else {
        console.error('[DebugPanel] ❌ Failed to clear cache:', result.message);
        alert(`Failed to clear cache: ${result.message}`);
        setIsClearing(false);
      }
    } catch (error) {
      console.error('[DebugPanel] Error clearing cache:', error);
      alert(`Error clearing cache: ${error instanceof Error ? error.message : 'Unknown error'}`);
      setIsClearing(false);
    }
  };

  // Calculate timing breakdown for visual representation
  const calculateTimingBreakdown = (meta: CacheMeta) => {
    const breakdown: TimingBreakdown[] = [];
    
    if (meta.cached) {
      // Cache hit breakdown
      if (meta.cache_get_time) {
        breakdown.push({
          label: 'Cache Retrieval',
          value: meta.cache_get_time,
          color: 'bg-emerald-500',
          percentage: 0,
        });
      }
      if (meta.network_time) {
        breakdown.push({
          label: 'Network',
          value: meta.network_time,
          color: 'bg-blue-500',
          percentage: 0,
        });
      }
    } else {
      // Native fetch breakdown
      if (meta.cache_check_time) {
        breakdown.push({
          label: 'Cache Check',
          value: meta.cache_check_time,
          color: 'bg-yellow-500',
          percentage: 0,
        });
      }
      if (meta.api_fetch_time) {
        breakdown.push({
          label: 'API Fetch',
          value: meta.api_fetch_time,
          color: 'bg-blue-500',
          percentage: 0,
        });
      }
      if (meta.json_parse_time) {
        breakdown.push({
          label: 'JSON Parse',
          value: meta.json_parse_time,
          color: 'bg-purple-500',
          percentage: 0,
        });
      }
      if (meta.cache_save_time && meta.cache_save_time > 0) {
        breakdown.push({
          label: 'Cache Save',
          value: meta.cache_save_time,
          color: 'bg-green-500',
          percentage: 0,
        });
      }
      if (meta.network_overhead && meta.network_overhead > 0) {
        breakdown.push({
          label: 'Network Overhead',
          value: meta.network_overhead,
          color: 'bg-slate-500',
          percentage: 0,
        });
      }
    }

    // Calculate percentages
    const total = breakdown.reduce((sum, item) => sum + item.value, 0);
    if (total > 0) {
      breakdown.forEach((item) => {
        item.percentage = Math.round((item.value / total) * 100);
      });
    }

    setTimingBreakdown(breakdown);
  };

  if (!cacheMeta || !isVisible || !debugEnabled) {
    return null;
  }

  const sourceColor = cacheMeta.source === 'cache' 
    ? 'bg-green-500' 
    : 'bg-blue-500';

  const sourceIcon = cacheMeta.source === 'cache' ? '⚡' : '🌐';

  return (
    <div className="fixed bottom-4 right-4 bg-black/90 text-white rounded-lg shadow-2xl p-4 max-w-lg z-50 border border-gray-700">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-2xl">{sourceIcon}</span>
          <h3 className="font-bold text-sm">Embed Cache Status</h3>
        </div>
        <button
          onClick={() => setIsVisible(false)}
          className="text-gray-400 hover:text-white transition-colors ml-2"
          aria-label="Close"
        >
          ✕
        </button>
      </div>

      <div className="space-y-2 text-sm">
        {/* Source and Type */}
        <div className="flex items-center justify-between">
          <span className="text-gray-300">Source:</span>
          <span className={`${sourceColor} px-2 py-1 rounded text-xs font-semibold text-white`}>
            {cacheMeta.source === 'cache' ? 'CACHE' : 'NATIVE'}
          </span>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-gray-300">Cache Type:</span>
          <span className="font-mono text-blue-400">
            {cacheMeta.cache_provider?.toUpperCase() || 'unknown'}
          </span>
        </div>

        {/* Load Time */}
        <div className="flex items-center justify-between">
          <span className="text-gray-300">Load Time:</span>
          <span className="font-mono text-green-400 font-bold">{cacheMeta.loadTime}ms</span>
        </div>

        {/* Data Size - show compressed size if available, otherwise uncompressed */}
        {(cacheMeta.compressed_size_kb !== undefined || cacheMeta.uncompressed_size_kb !== undefined || cacheMeta.cache_size_kb !== undefined) && (
          <div className="space-y-1">
            {cacheMeta.compressed_size_kb !== undefined && cacheMeta.is_compressed ? (
              <>
                <div className="flex items-center justify-between">
                  <span className="text-gray-300">Data Size (Redis):</span>
                  <span className="font-mono text-yellow-400 font-bold">{cacheMeta.compressed_size_kb} KB</span>
                </div>
                {cacheMeta.uncompressed_size_kb !== undefined && (
                  <div className="flex items-center justify-between">
                    <span className="text-gray-300 text-xs">Uncompressed:</span>
                    <span className="font-mono text-gray-400 text-xs">
                      {cacheMeta.uncompressed_size_kb} KB
                      {cacheMeta.compression_ratio && (
                        <span className="text-green-400 ml-1">
                          ({cacheMeta.compression_ratio.toFixed(1)}% saved)
                        </span>
                      )}
                    </span>
                  </div>
                )}
              </>
            ) : (
              <div className="flex items-center justify-between">
                <span className="text-gray-300">Data Size:</span>
                <span className="font-mono text-yellow-400">
                  {cacheMeta.uncompressed_size_kb || cacheMeta.cache_size_kb} KB
                </span>
              </div>
            )}
          </div>
        )}

        <div className="flex items-center justify-between">
          <span className="text-gray-300">Cache Enabled:</span>
          <span className={cacheMeta.cache_enabled !== false ? 'text-green-400' : 'text-red-400'}>
            {cacheMeta.cache_enabled !== false ? '✓ Yes' : '✗ No'}
          </span>
        </div>

        {/* Timing Breakdown Section */}
        {timingBreakdown.length > 0 && (
          <div className="mt-4 pt-3 border-t border-gray-700">
            <p className="text-xs font-semibold text-gray-300 mb-2">⏱️ LoadTime Breakdown:</p>
            
            {/* Visual bar chart */}
            <div className="flex gap-0.5 mb-2 h-6 rounded overflow-hidden bg-gray-900">
              {timingBreakdown.map((item) => (
                <div
                  key={item.label}
                  className={`${item.color} transition-all`}
                  style={{ flex: `${Math.max(item.percentage, 5)}` }}
                  title={`${item.label}: ${item.value}ms (${item.percentage}%)`}
                />
              ))}
            </div>

            {/* Detailed breakdown */}
            <div className="space-y-1 text-xs">
              {timingBreakdown.map((item) => (
                <div key={item.label} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${item.color}`} />
                    <span className="text-gray-400">{item.label}:</span>
                  </div>
                  <span className="font-mono text-gray-200">
                    {item.value}ms <span className="text-gray-500">({item.percentage}%)</span>
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Debug details */}
        <div className="text-xs text-gray-400 mt-3 pt-3 border-t border-gray-700 space-y-1">
          <div>⏰ {new Date(cacheMeta.timestamp).toLocaleTimeString()}</div>
          
          {cacheMeta.source === 'cache' && cacheMeta.cache_get_time !== undefined && (
            <div>📦 Cache Get: {cacheMeta.cache_get_time}ms</div>
          )}
          
          {cacheMeta.source === 'native' && (
            <>
              {cacheMeta.cache_check_time !== undefined && (
                <div>🔍 Cache Check: {cacheMeta.cache_check_time}ms</div>
              )}
              {cacheMeta.api_fetch_time !== undefined && (
                <div>🌐 API Fetch: {cacheMeta.api_fetch_time}ms</div>
              )}
              {cacheMeta.json_parse_time !== undefined && (
                <div>📄 JSON Parse: {cacheMeta.json_parse_time}ms</div>
              )}
              {cacheMeta.cache_save_time !== undefined && cacheMeta.cache_save_time > 0 && (
                <div>💾 Cache Save: {cacheMeta.cache_save_time}ms</div>
              )}
              {cacheMeta.network_overhead !== undefined && cacheMeta.network_overhead > 0 && (
                <div>🔗 Network Overhead: {cacheMeta.network_overhead}ms</div>
              )}
            </>
          )}
          
          {cacheMeta.total_time !== undefined && (
            <div className="font-semibold text-gray-300 pt-1">
              📊 Total Time: {cacheMeta.total_time}ms
            </div>
          )}
        </div>
      </div>

      {cacheMeta.source === 'cache' && (
        <div className="mt-3 pt-3 border-t border-gray-700">
          <p className="text-xs text-gray-400">
            ⚡ Data served from cache for faster loading
          </p>
        </div>
      )}

      {cacheMeta.source === 'native' && (
        <div className="mt-3 pt-3 border-t border-gray-700">
          <p className="text-xs text-gray-400">
            🌐 Fresh data fetched from Embeddables API
          </p>
        </div>
      )}

      {/* Clear Cache Button */}
      <div className="mt-3 pt-3 border-t border-gray-700">
        <button
          onClick={handleClearCache}
          disabled={isClearing}
          className="w-full bg-red-600 hover:bg-red-700 disabled:bg-gray-600 disabled:opacity-50 text-white text-xs font-semibold py-2 px-3 rounded transition-colors duration-200"
        >
          {isClearing ? '🔄 Clearing...' : '🗑️ Clear Cache'}
        </button>
      </div>
    </div>
  );
}
