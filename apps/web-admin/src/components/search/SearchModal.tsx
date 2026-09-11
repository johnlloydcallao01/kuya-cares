'use client';

import React, { useCallback, useEffect, useMemo, useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import { useDebounce } from '@/hooks/useDebounce';
import { useRecentSearches } from '@/hooks/useRecentSearches';
import type { SearchResult, SearchSuggestion, SearchCategory } from '@/lib/search-types';
import { SEARCH_CATEGORY_LABELS, SEARCH_CATEGORY_COLORS } from '@/lib/search-types';
import { Search, ArrowLeft, X, Store, Package, ShoppingBag, Users, Truck, Loader2, Clock } from '@/components/ui/IconWrapper';

type Props = {
  isOpen: boolean;
  onClose: () => void;
  initialQuery?: string;
};

const CATEGORY_ICONS: Record<SearchCategory, React.ReactNode> = {
  merchants: <Store className="w-4 h-4" />,
  products: <Package className="w-4 h-4" />,
  orders: <ShoppingBag className="w-4 h-4" />,
  customers: <Users className="w-4 h-4" />,
  drivers: <Truck className="w-4 h-4" />,
  vendors: <Store className="w-4 h-4" />,
};

const ALL_CATEGORIES: SearchCategory[] = ['merchants', 'products', 'orders', 'customers', 'drivers', 'vendors'];

function ThumbnailOrIcon({ thumbnail, title, type }: { thumbnail?: string; title: string; type: SearchCategory }) {
  if (thumbnail) {
    return <img src={thumbnail} alt={title} className="h-8 w-8 rounded-md object-cover border border-gray-200 dark:border-[#262626] bg-white dark:bg-[#171717]" />;
  }

  return <span className={`flex-shrink-0 p-1.5 rounded-lg ${SEARCH_CATEGORY_COLORS[type]}`}>{CATEGORY_ICONS[type]}</span>;
}

export default function SearchModal({ isOpen, onClose, initialQuery = '' }: Props) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState(initialQuery);
  const [activeCategory, setActiveCategory] = useState<SearchCategory | 'all'>('all');
  const [suggestions, setSuggestions] = useState<SearchSuggestion[]>([]);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);

  const debouncedQuery = useDebounce(query, 350);
  const { recentSearches, addRecentSearch, clearRecentSearches, removeRecentSearch, refreshRecentSearches } = useRecentSearches();

  // Lock body scroll when open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      refreshRecentSearches();
      setTimeout(() => inputRef.current?.focus(), 100);
    } else {
      document.body.style.overflow = '';
      setQuery(initialQuery);
      setSuggestions([]);
      setResults([]);
      setActiveCategory('all');
      setActiveIndex(-1);
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen, initialQuery, refreshRecentSearches]);

  // Fetch suggestions
  const fetchSuggestions = useCallback(async (q: string) => {
    if (!q || q.length < 2) {
      setSuggestions([]);
      return;
    }
    try {
      const res = await fetch(`/api/search/suggestions?q=${encodeURIComponent(q)}`);
      if (res.ok) {
        const data = await res.json();
        setSuggestions(data.suggestions ?? []);
      }
    } catch {
      setSuggestions([]);
    }
  }, []);

  // Fetch full results
  const fetchResults = useCallback(async (q: string) => {
    if (!q || q.length < 2) {
      setResults([]);
      return;
    }
    setIsLoading(true);
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`);
      if (res.ok) {
        const data = await res.json();
        setResults(data.results ?? []);
      }
    } catch {
      setResults([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      fetchSuggestions(debouncedQuery);
      fetchResults(debouncedQuery);
    }
  }, [debouncedQuery, isOpen, fetchSuggestions, fetchResults]);

  useEffect(() => {
    setActiveIndex(-1);
  }, [debouncedQuery]);

  const filteredResults = activeCategory === 'all'
    ? results
    : results.filter((r) => r.type === activeCategory);

  const counts = useMemo(() => {
    return ALL_CATEGORIES.reduce(
      (acc, cat) => {
        acc[cat] = results.filter((r) => r.type === cat).length;
        return acc;
      },
      {} as Record<SearchCategory, number>,
    );
  }, [results]);

  const navigateTo = (href: string) => {
    addRecentSearch(query);
    onClose();
    router.push(href);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      addRecentSearch(query);
      onClose();
      router.push(`/search?q=${encodeURIComponent(query.trim())}`);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    const totalItems = suggestions.length + filteredResults.length;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((prev) => (prev < totalItems - 1 ? prev + 1 : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((prev) => (prev > 0 ? prev - 1 : totalItems - 1));
    } else if (e.key === 'Enter' && activeIndex >= 0) {
      e.preventDefault();
      if (activeIndex < suggestions.length) {
        navigateTo(suggestions[activeIndex].href);
      } else {
        const resultIdx = activeIndex - suggestions.length;
        if (filteredResults[resultIdx]) {
          navigateTo(filteredResults[resultIdx].href);
        }
      }
    } else if (e.key === 'Escape') {
      onClose();
    }
  };

  if (!isOpen) return null;

  if (typeof window === 'undefined') return null;

  return createPortal(
    <div className="fixed inset-0 z-[100] bg-white dark:bg-[#0a0a0a] flex flex-col">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-200 dark:border-[#262626] bg-white dark:bg-[#171717]">
        <button onClick={onClose} className="p-1 -ml-1 flex-shrink-0">
          <ArrowLeft className="w-5 h-5 text-gray-600 dark:text-[#a1a1aa]" />
        </button>

        <form onSubmit={handleSubmit} className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-[#a1a1aa]" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search merchants, products, orders..."
            className="w-full h-10 pl-10 pr-4 rounded-full border border-gray-300 dark:border-[#262626] bg-white dark:bg-[#0a0a0a] text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-[#a1a1aa] shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
            autoComplete="off"
          />
          {query && (
            <button
              type="button"
              onClick={() => { setQuery(''); inputRef.current?.focus(); }}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-[#a1a1aa] hover:text-gray-600 dark:hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          )}
          {isLoading && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2">
              <Loader2 className="w-4 h-4 text-gray-400 dark:text-[#a1a1aa] animate-spin" />
            </div>
          )}
        </form>
      </div>

      {/* Category Tabs */}
      {query && results.length > 0 && (
        <div className="flex gap-2 px-4 py-2 border-b border-gray-100 dark:border-[#262626] overflow-x-auto">
          <button
            onClick={() => setActiveCategory('all')}
            className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
              activeCategory === 'all'
                ? 'bg-gray-900 dark:bg-white dark:text-black text-white'
                : 'bg-gray-100 dark:bg-[#262626] text-gray-600 dark:text-[#a1a1aa] hover:bg-gray-200 dark:hover:bg-[#3f3f3f]'
            }`}
          >
            All ({results.length})
          </button>
          {ALL_CATEGORIES.map((cat) => (
            counts[cat] > 0 && (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={`flex-shrink-0 flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                  activeCategory === cat
                    ? 'bg-gray-900 dark:bg-white dark:text-black text-white'
                    : 'bg-gray-100 dark:bg-[#262626] text-gray-600 dark:text-[#a1a1aa] hover:bg-gray-200 dark:hover:bg-[#3f3f3f]'
                }`}
              >
                {CATEGORY_ICONS[cat]}
                {SEARCH_CATEGORY_LABELS[cat]} ({counts[cat]})
              </button>
            )
          ))}
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {/* Loading */}
        {isLoading && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 text-gray-400 dark:text-[#a1a1aa] animate-spin" />
          </div>
        )}

        {/* Recent Searches (when empty) */}
        {!isLoading && recentSearches.length > 0 && !query && (
          <div className="p-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold text-gray-500 dark:text-[#a1a1aa] uppercase tracking-wider">Recent Searches</span>
              <button onClick={clearRecentSearches} className="text-xs text-gray-400 dark:text-[#a1a1aa] hover:text-gray-600 dark:hover:text-white">Clear all</button>
            </div>
            <div className="space-y-1">
              {recentSearches.map((search) => (
                <div key={search} className="flex items-center group">
                  <button
                    onClick={() => {
                      setQuery(search);
                      addRecentSearch(search);
                    }}
                    className="flex-1 flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-gray-700 dark:text-[#a1a1aa] hover:bg-gray-100 dark:hover:bg-[#262626]"
                  >
                    <Clock className="w-4 h-4 text-gray-400 dark:text-[#a1a1aa]" />
                    <span>{search}</span>
                  </button>
                  <button
                    onClick={() => removeRecentSearch(search)}
                    className="p-2 opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <X className="w-3 h-3 text-gray-400 dark:text-[#a1a1aa]" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Suggestions */}
        {!isLoading && query && suggestions.length > 0 && (
          <div className="p-4">
            <span className="text-xs font-semibold text-gray-500 dark:text-[#a1a1aa] uppercase tracking-wider">Suggestions</span>
            <div className="mt-2 space-y-0.5">
              {suggestions.map((suggestion, i) => (
                <button
                  key={suggestion.id}
                  onClick={() => navigateTo(suggestion.href)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-left transition-colors ${
                    activeIndex === i ? 'bg-gray-100 dark:bg-[#262626]' : 'hover:bg-gray-50 dark:hover:bg-[#262626]'
                  }`}
                >
                  <ThumbnailOrIcon thumbnail={suggestion.thumbnail} title={suggestion.label} type={suggestion.type} />
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-gray-900 dark:text-white truncate">{suggestion.label}</div>
                    <div className="text-xs text-gray-500 dark:text-[#a1a1aa] truncate">{suggestion.subtitle}</div>
                  </div>
                  <span className={`flex-shrink-0 text-[10px] font-medium px-1.5 py-0.5 rounded ${SEARCH_CATEGORY_COLORS[suggestion.type]}`}>
                    {suggestion.type}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Results */}
        {!isLoading && query && filteredResults.length > 0 && (
          <div className="p-4">
            <span className="text-xs font-semibold text-gray-500 dark:text-[#a1a1aa] uppercase tracking-wider">Results</span>
            <div className="mt-2 space-y-0.5">
              {filteredResults.map((result, i) => (
                <button
                  key={`${result.type}-${result.id}`}
                  onClick={() => navigateTo(result.href)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-left transition-colors ${
                    activeIndex === suggestions.length + i ? 'bg-gray-100 dark:bg-[#262626]' : 'hover:bg-gray-50 dark:hover:bg-[#262626]'
                  }`}
                >
                  <ThumbnailOrIcon thumbnail={result.thumbnail} title={result.title} type={result.type} />
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-gray-900 dark:text-white truncate">{result.title}</div>
                    <div className="text-xs text-gray-500 dark:text-[#a1a1aa] truncate">{result.subtitle}</div>
                  </div>
                  <span className={`flex-shrink-0 text-[10px] font-medium px-1.5 py-0.5 rounded ${SEARCH_CATEGORY_COLORS[result.type]}`}>
                    {result.type}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* No Results */}
        {!isLoading && query && suggestions.length === 0 && results.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Search className="w-12 h-12 text-gray-300 dark:text-[#262626] mb-3" />
            <h3 className="text-base font-medium text-gray-900 dark:text-white mb-1">No results found</h3>
            <p className="text-sm text-gray-500 dark:text-[#a1a1aa]">
              Try searching for merchants, products, orders, or customers
            </p>
          </div>
        )}

        {/* View All Results */}
        {!isLoading && query && results.length > 0 && (
          <div className="p-4 border-t border-gray-100 dark:border-[#262626]">
            <button
              onClick={handleSubmit}
              className="w-full text-center text-sm text-gray-600 dark:text-[#a1a1aa] hover:text-gray-900 dark:hover:text-white font-medium py-2"
            >
              View all results for &ldquo;{query}&rdquo; &rarr;
            </button>
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}
