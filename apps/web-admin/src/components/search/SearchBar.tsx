'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useDebounce } from '@/hooks/useDebounce';
import { useRecentSearches } from '@/hooks/useRecentSearches';
import type { SearchResult, SearchSuggestion } from '@/lib/search-types';
import { SearchResults } from './SearchResults';

export function SearchBar() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [suggestions, setSuggestions] = useState<SearchSuggestion[]>([]);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const debouncedQuery = useDebounce(query, 350);
  const { recentSearches, addRecentSearch, clearRecentSearches, removeRecentSearch } = useRecentSearches();

  const fetchSuggestions = useCallback(async (q: string) => {
    if (!q || q.length < 2) {
      setSuggestions([]);
      setResults([]);
      return;
    }
    setIsLoading(true);
    try {
      const res = await fetch(`/api/search/suggestions?q=${encodeURIComponent(q)}`);
      if (res.ok) {
        const data = await res.json();
        setSuggestions(data.suggestions ?? []);
      }
    } catch {
      setSuggestions([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const fetchResults = useCallback(async (q: string) => {
    if (!q || q.length < 2) {
      setResults([]);
      return;
    }
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`);
      if (res.ok) {
        const data = await res.json();
        setResults(data.results ?? []);
      }
    } catch {
      setResults([]);
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

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const navigateTo = (href: string) => {
    addRecentSearch(query);
    setIsOpen(false);
    setQuery('');
    router.push(href);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      addRecentSearch(query);
      setIsOpen(false);
      router.push(`/search?q=${encodeURIComponent(query.trim())}`);
    }
  };

  const totalItems = suggestions.length + results.length;

  const handleKeyDown = (e: React.KeyboardEvent) => {
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
        if (results[resultIdx]) {
          navigateTo(results[resultIdx].href);
        }
      }
    } else if (e.key === 'Escape') {
      setIsOpen(false);
      inputRef.current?.blur();
    }
  };

  return (
    <div ref={containerRef} className="relative w-full hidden sm:block">
      <form className="flex w-full" onSubmit={handleSubmit}>
        <div className="flex-1 relative">
          <div className="relative flex items-center">
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                if (!isOpen) setIsOpen(true);
              }}
              onFocus={() => setIsOpen(true)}
              onKeyDown={handleKeyDown}
              placeholder="Search merchants, products, orders..."
              className="w-full h-10 pl-10 pr-4 py-2 border border-gray-300 dark:border-[#262626] rounded-l-full rounded-r-none focus:outline-none focus:ring-0 focus:border-blue-500 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-[#a1a1aa] bg-white dark:bg-[#0a0a0a] text-sm"
              autoComplete="off"
            />
            <i className="fas fa-search absolute left-3 text-gray-400" />
            {query && (
              <button
                type="button"
                aria-label="Clear"
                onClick={(e) => { e.preventDefault(); setQuery(''); inputRef.current?.focus(); }}
                className="absolute right-3 text-gray-400 dark:text-[#a1a1aa] hover:text-gray-600 dark:hover:text-white"
              >
                <i className="fas fa-times" />
              </button>
            )}
          </div>
        </div>
        <button
          type="submit"
          className="h-10 px-6 bg-gray-100 dark:bg-[#262626] border border-l-0 border-gray-300 dark:border-[#262626] rounded-r-full hover:bg-gray-200 dark:hover:bg-[#3f3f3f] text-gray-700 dark:text-white flex items-center justify-center shadow-sm"
          aria-label="Search"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </button>
      </form>

      {isOpen && (
        <SearchResults
          suggestions={suggestions}
          results={results}
          recentSearches={recentSearches}
          isLoading={isLoading}
          query={query}
          activeIndex={activeIndex}
          onSelectRecent={(q) => {
            setQuery(q);
            addRecentSearch(q);
            setIsOpen(false);
            router.push(`/search?q=${encodeURIComponent(q)}`);
          }}
          onSelectSuggestion={navigateTo}
          onSelectResult={navigateTo}
          onClearRecent={clearRecentSearches}
          onRemoveRecent={removeRecentSearch}
          mode="dropdown"
        />
      )}
    </div>
  );
}
