'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import type { SearchSuggestion, SearchResult, SearchCategory } from '@/lib/search-types';
import { SEARCH_CATEGORY_LABELS, SEARCH_CATEGORY_COLORS } from '@/lib/search-types';
import { Search, Clock, X, Store, Package, ShoppingBag } from '@/components/ui/IconWrapper';

const CATEGORY_ICONS: Record<SearchCategory, React.ReactNode> = {
  merchants: <Store className="w-4 h-4" />,
  products: <Package className="w-4 h-4" />,
  orders: <ShoppingBag className="w-4 h-4" />,
};

const CATEGORY_COLORS = SEARCH_CATEGORY_COLORS;

function ThumbnailOrIcon({ thumbnail, title, type }: { thumbnail?: string; title: string; type: SearchCategory }) {
  if (thumbnail) {
    return <img src={thumbnail} alt={title} className="h-8 w-8 rounded-md object-cover border border-gray-200 dark:border-[#262626] bg-white dark:bg-[#171717]" />;
  }

  return <span className={`flex-shrink-0 p-1 rounded ${CATEGORY_COLORS[type]}`}>{CATEGORY_ICONS[type]}</span>;
}

interface SearchResultsProps {
  suggestions: SearchSuggestion[];
  results: SearchResult[];
  recentSearches: string[];
  isLoading: boolean;
  query: string;
  activeIndex: number;
  onSelectRecent: (query: string) => void;
  onSelectSuggestion: (href: string) => void;
  onSelectResult: (href: string) => void;
  onClearRecent: () => void;
  onRemoveRecent: (query: string) => void;
  mode?: 'dropdown' | 'inline';
}

export function SearchResults({
  suggestions,
  results,
  recentSearches,
  isLoading,
  query,
  activeIndex,
  onSelectRecent,
  onSelectSuggestion,
  onSelectResult,
  onClearRecent,
  onRemoveRecent,
  mode = 'dropdown',
}: SearchResultsProps) {
  const router = useRouter();
  const isDropdown = mode === 'dropdown';

  const handleViewAll = () => {
    if (query.trim()) {
      router.push(`/search?q=${encodeURIComponent(query.trim())}`);
    }
  };

  const containerClass = isDropdown
    ? 'absolute top-full left-0 right-0 mt-1 bg-white dark:bg-[#171717] border border-gray-200 dark:border-[#262626] rounded-lg shadow-lg z-50 max-h-96 overflow-y-auto'
    : 'flex-1 overflow-y-auto';

  return (
    <div className={containerClass}>
      {isLoading && (
        <div className="flex items-center justify-center py-6">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-gray-900 dark:border-white" />
        </div>
      )}

      {!isLoading && recentSearches.length > 0 && !query && (
        <div className="p-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-gray-500 dark:text-[#a1a1aa] uppercase tracking-wider">Recent Searches</span>
            <button onClick={onClearRecent} className="text-xs text-gray-400 dark:text-[#a1a1aa] hover:text-gray-600 dark:hover:text-white">Clear all</button>
          </div>
          <div className="space-y-1">
            {recentSearches.map((search) => (
              <div key={search} className="flex items-center group">
                <button
                  onClick={() => onSelectRecent(search)}
                  className="flex-1 flex items-center gap-2 px-2 py-1.5 rounded text-sm text-gray-700 dark:text-[#a1a1aa] hover:bg-gray-100 dark:hover:bg-[#262626]"
                >
                  <Clock className="w-3.5 h-3.5 text-gray-400 dark:text-[#a1a1aa]" />
                  <span>{search}</span>
                </button>
                <button
                  onClick={() => onRemoveRecent(search)}
                  className="p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <X className="w-3 h-3 text-gray-400 dark:text-[#a1a1aa]" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {!isLoading && query && suggestions.length > 0 && (
        <div className="p-3">
          <span className="text-xs font-semibold text-gray-500 dark:text-[#a1a1aa] uppercase tracking-wider">Suggestions</span>
          <div className="mt-1 space-y-0.5">
            {suggestions.map((suggestion, i) => (
              <button
                key={suggestion.id}
                onClick={() => onSelectSuggestion(suggestion.href)}
                className={`w-full flex items-center gap-3 px-2 py-2 rounded text-sm text-left transition-colors ${
                  activeIndex === i ? 'bg-gray-100 dark:bg-[#262626]' : 'hover:bg-gray-50 dark:hover:bg-[#262626]'
                }`}
              >
                <ThumbnailOrIcon thumbnail={suggestion.thumbnail} title={suggestion.label} type={suggestion.type} />
                <div className="flex-1 min-w-0">
<div className="font-medium text-gray-900 dark:text-white truncate">{suggestion.label}</div>
                    <div className="text-xs text-gray-500 dark:text-[#a1a1aa] truncate">{suggestion.subtitle}</div>
                </div>
                <span className={`flex-shrink-0 text-[10px] font-medium px-1.5 py-0.5 rounded ${CATEGORY_COLORS[suggestion.type]}`}>
                  {suggestion.type}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {!isLoading && query && suggestions.length === 0 && results.length === 0 && (
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <Search className="w-8 h-8 text-gray-300 dark:text-[#262626] mb-2" />
          <p className="text-sm text-gray-500 dark:text-[#a1a1aa]">No results found for &ldquo;{query}&rdquo;</p>
          <p className="text-xs text-gray-400 dark:text-[#a1a1aa] mt-1">Try searching for merchants, products, or orders</p>
        </div>
      )}

      {!isLoading && query && results.length > 0 && (
        <div className="p-3">
          <span className="text-xs font-semibold text-gray-500 dark:text-[#a1a1aa] uppercase tracking-wider">Results</span>
          <div className="mt-1 space-y-0.5">
            {results.slice(0, 5).map((result, i) => (
              <button
                key={result.id}
                onClick={() => onSelectResult(result.href)}
                className={`w-full flex items-center gap-3 px-2 py-2 rounded text-sm text-left transition-colors ${
                  activeIndex === suggestions.length + i ? 'bg-gray-100 dark:bg-[#262626]' : 'hover:bg-gray-50 dark:hover:bg-[#262626]'
                }`}
              >
                <ThumbnailOrIcon thumbnail={result.thumbnail} title={result.title} type={result.type} />
                <div className="flex-1 min-w-0">
<div className="font-medium text-gray-900 dark:text-white truncate">{result.title}</div>
                    <div className="text-xs text-gray-500 dark:text-[#a1a1aa] truncate">{result.subtitle}</div>
                </div>
                <span className={`flex-shrink-0 text-[10px] font-medium px-1.5 py-0.5 rounded ${CATEGORY_COLORS[result.type]}`}>
                  {result.type}
                </span>
              </button>
            ))}
          </div>

          {results.length > 5 && (
            <button
              onClick={handleViewAll}
              className="mt-2 w-full text-center text-sm text-gray-600 dark:text-[#a1a1aa] hover:text-gray-900 dark:hover:text-white font-medium py-2"
            >
              View all {results.length} results &rarr;
            </button>
          )}
        </div>
      )}

      {!isLoading && query && results.length > 0 && (
        <div className="border-t border-gray-100 dark:border-[#262626] p-2">
          <button
            onClick={handleViewAll}
            className="w-full text-center text-sm text-gray-600 dark:text-[#a1a1aa] hover:text-gray-900 dark:hover:text-white font-medium py-1.5"
          >
            View all results for &ldquo;{query}&rdquo;
          </button>
        </div>
      )}
    </div>
  );
}
