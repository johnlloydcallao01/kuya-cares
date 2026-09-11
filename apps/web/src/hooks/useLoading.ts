import { useState, useEffect, useCallback } from 'react';

/**
 * PERFORMANCE-OPTIMIZED LOADING HOOKS
 *
 * Following Google's Core Web Vitals best practices:
 * - Only use skeleton screens for DYNAMIC content that requires network requests
 * - Never artificially delay rendering of static content
 * - Skeleton screens should appear ONLY while waiting for real data
 * - Static pages should render immediately without skeleton delays
 */

/**
 * Hook for REAL data loading states (API calls, database queries, etc.)
 * Only use this when you have actual network requests or async operations
 *
 * @example
 * const { isLoading, data, error, refetch } = useDataLoading();
 *
 * useEffect(() => {
 *   refetch(() => fetch('/api/data').then(res => res.json()));
 * }, [refetch]);
 */
export function useDataLoading<T>() {
  const [isLoading, setIsLoading] = useState(false);
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<Error | null>(null);

  const refetch = useCallback(async (asyncOperation: () => Promise<T>) => {
    let isMounted = true;

    try {
      setIsLoading(true);
      setError(null);
      const result = await asyncOperation();

      if (isMounted) {
        setData(result);
      }
    } catch (err) {
      if (isMounted) {
        setError(err instanceof Error ? err : new Error('Unknown error'));
      }
    } finally {
      if (isMounted) {
        setIsLoading(false);
      }
    }
  }, []);

  return { isLoading, data, error, refetch };
}

/**
 * Hook for component-level loading states
 * Use this when you have actual async operations that need loading indicators
 */
export function useAsyncLoading() {
  const [isLoading, setIsLoading] = useState(false);

  const startLoading = () => setIsLoading(true);
  const stopLoading = () => setIsLoading(false);

  const withLoading = async <T>(operation: () => Promise<T>): Promise<T> => {
    try {
      setIsLoading(true);
      const result = await operation();
      return result;
    } finally {
      setIsLoading(false);
    }
  };

  return { isLoading, startLoading, stopLoading, withLoading };
}

/**
 * @deprecated DO NOT USE for static content
 * This hook artificially delays rendering and hurts Core Web Vitals
 * Only use for demonstration or when you have REAL loading requirements
 */
export function useSimulatedLoading(duration: number = 1500) {
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    console.warn('⚠️ useSimulatedLoading is deprecated and hurts performance. Only use for real loading states.');
    const timer = setTimeout(() => {
      setIsLoading(false);
    }, duration);

    return () => clearTimeout(timer);
  }, [duration]);

  return isLoading;
}

/**
 * @deprecated DO NOT USE for static pages
 * This hook artificially delays rendering and hurts LCP performance
 * Static pages should render immediately without artificial delays
 */
export function usePageLoading() {
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    console.warn('⚠️ usePageLoading is deprecated and hurts LCP performance. Remove artificial delays for static content.');
    const timer = setTimeout(() => {
      setIsLoading(false);
    }, 1200);

    return () => clearTimeout(timer);
  }, []);

  return isLoading;
}
