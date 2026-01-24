/**
 * Embed Cache Debug Panel
 * 
 * This component displays debugging information about the cache status
 * for the Embeddables service. It shows whether data was loaded from cache
 * or fetched from the native API, along with performance metrics.
 */

import { useState, useEffect } from 'react';

interface CacheMeta {
  cached: boolean;
  timestamp: number;
  source: 'cache' | 'native';
  loadTime: number;
  cache_enabled?: boolean;
}

export function EmbedCacheDebugPanel() {
  const [cacheMeta, setCacheMeta] = useState<CacheMeta | null>(null);
  const [isVisible, setIsVisible] = useState(true);
  const [debugEnabled, setDebugEnabled] = useState(false);

  useEffect(() => {
    // Check if CACHE_DEBUG is enabled from window global
    const debugFlag = (window as any).__CACHE_DEBUG__ === 'true' || (window as any).__CACHE_DEBUG__ === true;
    setDebugEnabled(debugFlag);

    // Listen for embed loaded event
    const handleEmbedLoaded = () => {
      if (window._embedCacheMeta) {
        setCacheMeta(window._embedCacheMeta);
      }
    };

    window.addEventListener('embed-loaded', handleEmbedLoaded);

    // Check if already loaded
    if (window._embedCacheMeta) {
      setCacheMeta(window._embedCacheMeta);
    }

    return () => {
      window.removeEventListener('embed-loaded', handleEmbedLoaded);
    };
  }, []);

  if (!cacheMeta || !isVisible || !debugEnabled) {
    return null;
  }

  const sourceColor = cacheMeta.source === 'cache' 
    ? 'bg-green-500' 
    : 'bg-blue-500';

  const sourceIcon = cacheMeta.source === 'cache' ? '⚡' : '🌐';

  return (
    <div className="fixed bottom-4 right-4 bg-black/90 text-white rounded-lg shadow-2xl p-4 max-w-sm z-50 border border-gray-700">
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
        <div className="flex items-center justify-between">
          <span className="text-gray-300">Source:</span>
          <span className={`${sourceColor} px-2 py-1 rounded text-xs font-semibold text-white`}>
            {cacheMeta.source === 'cache' ? 'CACHE' : 'NATIVE'}
          </span>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-gray-300">Load Time:</span>
          <span className="font-mono text-green-400">{cacheMeta.loadTime}ms</span>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-gray-300">Cache Enabled:</span>
          <span className={cacheMeta.cache_enabled !== false ? 'text-green-400' : 'text-red-400'}>
            {cacheMeta.cache_enabled !== false ? '✓ Yes' : '✗ No'}
          </span>
        </div>

        <div className="text-xs text-gray-400 mt-3 pt-3 border-t border-gray-700">
          <div>Timestamp: {new Date(cacheMeta.timestamp).toLocaleTimeString()}</div>
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
    </div>
  );
}
