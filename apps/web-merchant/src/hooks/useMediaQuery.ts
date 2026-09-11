import { useState, useEffect } from 'react';

/**
 * Custom hook for responsive media queries.
 *
 * Returns `false` during SSR and on the first client render to avoid
 * hydration mismatches, then updates to the matched value after mount.
 *
 * @param query - A media query string, e.g. '(min-width: 1024px)'
 * @returns Whether the media query currently matches.
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    const mql = window.matchMedia(query);
    setMatches(mql.matches);

    const handler = (e: MediaQueryListEvent) => setMatches(e.matches);
    mql.addEventListener('change', handler);
    return () => mql.removeEventListener('change', handler);
  }, [query]);

  return matches;
}
