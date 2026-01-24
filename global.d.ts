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
      cache_size_kb?: number;
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
