import { useState, useCallback, useEffect } from 'react';

const MAX_RECENT = 10;
const STORAGE_KEY = 'seller_recent_searches';

export function useRecentSearches() {
  const [recentSearches, setRecentSearches] = useState<string[]>([]);

  const refreshRecentSearches = useCallback(async () => {
    try {
      if (typeof window !== 'undefined') {
        const local = localStorage.getItem(STORAGE_KEY);
        if (local) {
          setRecentSearches(JSON.parse(local).slice(0, MAX_RECENT));
          return;
        }
      }
      const response = await fetch('/api/search/recent?limit=10', { cache: 'no-store' });
      if (!response.ok) return;
      const data = (await response.json()) as { searches?: Array<{ query?: string }> };
      const items = (data.searches || []).map((item) => item.query || '').filter(Boolean).slice(0, MAX_RECENT);
      setRecentSearches(items);
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
      if (typeof window !== 'undefined') {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      }
      return next;
    });
    void fetch('/api/search/recent', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: trimmed }),
    }).catch(() => {});
  }, []);

  const clearRecentSearches = useCallback(() => {
    setRecentSearches([]);
    if (typeof window !== 'undefined') {
      localStorage.removeItem(STORAGE_KEY);
    }
    void fetch('/api/search/recent', { method: 'DELETE' }).catch(() => {});
  }, []);

  const removeRecentSearch = useCallback((query: string) => {
    setRecentSearches((prev) => {
      const next = prev.filter((s) => s !== query);
      if (typeof window !== 'undefined') {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      }
      return next;
    });
    void fetch(`/api/search/recent?query=${encodeURIComponent(query)}`, { method: 'DELETE' }).catch(() => {});
  }, []);

  return {
    recentSearches,
    refreshRecentSearches,
    addRecentSearch,
    clearRecentSearches,
    removeRecentSearch,
  };
}
