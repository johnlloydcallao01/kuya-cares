import { useState, useCallback, useEffect } from 'react';

const MAX_RECENT = 10;

export function useRecentSearches() {
  const [recentSearches, setRecentSearches] = useState<string[]>([]);

  const refreshRecentSearches = useCallback(async () => {
    try {
      const response = await fetch('/api/search/recent?limit=10', { cache: 'no-store' });
      if (!response.ok) return;
      const data = await response.json() as { searches?: Array<{ query?: string }> };
      setRecentSearches((data.searches || []).map((item) => item.query || '').filter(Boolean).slice(0, MAX_RECENT));
    } catch {
      setRecentSearches([]);
    }
  }, []);

  useEffect(() => {
    void refreshRecentSearches();
  }, [refreshRecentSearches]);

  const addRecentSearch = useCallback((query: string) => {
    const trimmed = query.trim();
    if (!trimmed) return;

    setRecentSearches((prev) => {
      const filtered = prev.filter((s) => s.toLowerCase() !== trimmed.toLowerCase());
      const next = [trimmed, ...filtered].slice(0, MAX_RECENT);
      void fetch('/api/search/recent', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ query: trimmed }) });
      return next;
    });
  }, []);

  const clearRecentSearches = useCallback(() => {
    setRecentSearches([]);
    void fetch('/api/search/recent', { method: 'DELETE' });
  }, []);

  const removeRecentSearch = useCallback((query: string) => {
    setRecentSearches((prev) => {
      const next = prev.filter((s) => s !== query);
      void fetch(`/api/search/recent?query=${encodeURIComponent(query)}`, { method: 'DELETE' });
      return next;
    });
  }, []);

  return {
    recentSearches,
    refreshRecentSearches,
    addRecentSearch,
    clearRecentSearches,
    removeRecentSearch,
  };
}
