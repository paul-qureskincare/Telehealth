/**
 * Global TypeScript type definitions
 */

import 'react';

declare global {
  interface Window {
    initEmbeddables?: () => void;
    _embedCacheMeta?: {
      cached: boolean;
      timestamp: number;
      source: 'cache' | 'native';
      loadTime: number;
      cache_enabled?: boolean;
      cache_provider?: 'file' | 'redis' | 'supabase';
      cache_size_kb?: number;
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
    };
  }
}

declare module 'react' {
  namespace JSX {
    interface IntrinsicElements {
      savvy: React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement> & { id: string }, HTMLElement>;
      embeddable: React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement>;
    }
  }
}

export {};
