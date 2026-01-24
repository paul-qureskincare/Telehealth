/**
 * Savvy Container Component
 * 
 * Client-only component that renders the <savvy> element to avoid hydration errors.
 * The element is only rendered after React hydration completes on the client.
 * After rendering, it notifies parent component that the container is ready.
 */

import { useEffect, useState } from 'react';

interface SavvyContainerProps {
  onReady?: () => void;
}

export function SavvyContainer({ onReady }: SavvyContainerProps) {
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    // Set mounted flag after hydration
    setIsMounted(true);
  }, []);

  useEffect(() => {
    // Notify parent when container is ready
    if (isMounted && onReady) {
      // Small delay to ensure DOM is fully updated
      const timer = setTimeout(() => {
        onReady();
      }, 50);
      
      return () => clearTimeout(timer);
    }
  }, [isMounted, onReady]);

  // Don't render on server to avoid hydration mismatch
  if (!isMounted) {
    return null;
  }

  // Render the custom element only on client
  return (
    <div 
      id="savvy-container"
      suppressHydrationWarning
      dangerouslySetInnerHTML={{ 
        __html: '<savvy id="flow_2571d52dhga9i00bfhde72a48gj"></savvy>' 
      }} 
    />
  );
}
