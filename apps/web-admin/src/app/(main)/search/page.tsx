'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from '@/components/ui/LinkWrapper';
import { ClientOnly } from '@/components/ClientOnly';
import type { SearchResult, SearchCategory } from '@/lib/search-types';
import { SEARCH_CATEGORY_LABELS, SEARCH_CATEGORY_COLORS } from '@/lib/search-types';
import { Search, Store, Package, ShoppingBag, Users, Truck, RefreshCw } from '@/components/ui/IconWrapper';

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
    return <img src={thumbnail} alt={title} className="h-10 w-10 flex-shrink-0 rounded-lg object-cover border border-gray-200 dark:border-[#262626] bg-white dark:bg-[#171717]" />;
  }

  return (
    <span className={`flex-shrink-0 p-2 rounded-lg ${SEARCH_CATEGORY_COLORS[type].replace('100', '50').replace('800', '700')} dark:bg-opacity-20`}>
      {CATEGORY_ICONS[type]}
    </span>
  );
}

function SearchSkeleton(){
  return (
    <div className="space-y-6 py-5 px-2.5">
      <div className="h-8 w-48 bg-gray-200 dark:bg-[#262626] rounded animate-pulse" />
      <div className="space-y-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="animate-pulse">
            <div className="flex items-center gap-4 p-4 bg-white dark:bg-[#171717] border border-gray-200 dark:border-[#262626] rounded-lg">
              <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-gray-100 dark:bg-[#262626]" />
              <div className="flex-1 min-w-0 space-y-2">
                <div className="h-4 w-3/4 bg-gray-100 dark:bg-[#262626] rounded" />
                <div className="h-3 w-1/2 bg-gray-100 dark:bg-[#262626] rounded" />
              </div>
              <div className="flex-shrink-0 w-24 h-6 rounded-full bg-gray-100 dark:bg-[#262626]" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function SearchPageContent() {
  const searchParams = useSearchParams();
  const query = searchParams.get('q') ?? '';

  const [results, setResults] = useState<SearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const fetchResults = useCallback(async (q: string) => {
    if (!q || q.length < 2) {
      setResults([]);
      return;
    }
    setIsLoading(true);
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(q)}&limit=10`);
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
    fetchResults(query);
  }, [query, fetchResults]);

  const counts = ALL_CATEGORIES.reduce(
    (acc, cat) => {
      acc[cat] = results.filter((r) => r.type === cat).length;
      return acc;
    },
    {} as Record<SearchCategory, number>,
  );

  // vendor-style skeleton rows
  const skeletonRows = Array.from({ length: 6 }).map((_, i) => (
    <div key={i} className="animate-pulse">
      <div className="flex items-center gap-4 p-4 bg-white dark:bg-[#171717] border border-gray-200 dark:border-[#262626] rounded-lg">
        <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-gray-100 dark:bg-[#262626]" />
        <div className="flex-1 min-w-0 space-y-2">
          <div className="h-4 w-3/4 bg-gray-100 dark:bg-[#262626] rounded" />
          <div className="h-3 w-1/2 bg-gray-100 dark:bg-[#262626] rounded" />
        </div>
        <div className="flex-shrink-0 w-24 h-6 rounded-full bg-gray-100 dark:bg-[#262626]" />
      </div>
    </div>
  ));

  return (
    <div className="space-y-6 py-5 px-2.5">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white tracking-tight flex items-center gap-2">
            <span className="h-8 w-8 rounded-lg bg-[#eba236] text-white flex items-center justify-center">
              <Search className="w-4 h-4" />
            </span>
            {query ? (
              <>Search results for "{query}"</>
            ) : (
              'Search'
            )}
          </h1>
          <p className="text-sm text-gray-500 dark:text-[#a1a1aa] mt-1">
            {query ? (
              isLoading ? (
                <span className="inline-block h-4 w-24 animate-pulse rounded bg-gray-200 dark:bg-[#262626]" aria-label="Loading result count" />
              ) : (
                `${results.length} result${results.length !== 1 ? 's' : ''} found`
              )
            ) : (
              'Search the admin panel — merchants, products, orders, customers, drivers, vendors'
            )}
          </p>
        </div>
        <button
          onClick={() => { /* refresh */ }}
          disabled={isLoading}
          className="h-9 w-9 inline-flex items-center justify-center bg-white dark:bg-[#171717] border border-gray-200 dark:border-[#262626] rounded-xl hover:bg-gray-50 dark:hover:bg-[#262626] disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 text-gray-600 dark:text-[#a1a1aa] ${isLoading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Loading skeleton */}
      {isLoading && (
        <div className="space-y-2">
          {skeletonRows}
        </div>
      )}

      {/* Empty State */}
      {!isLoading && query && results.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 px-6 text-center bg-white dark:bg-[#171717] rounded-xl border border-gray-200 dark:border-[#262626]">
          <div className="h-16 w-16 bg-[#eba236]/10 dark:bg-[#eba236]/15 rounded-2xl flex items-center justify-center mb-4">
            <Search className="w-8 h-8 text-[#eba236]" />
          </div>
          <h2 className="text-lg font-medium text-gray-900 dark:text-white mb-1">No results found</h2>
          <p className="text-sm text-gray-500 dark:text-[#a1a1aa]">
            Try searching for merchants, products, orders, or customers
          </p>
        </div>
      )}

      {/* Results List */}
      {!isLoading && results.length > 0 && (
        <div className="space-y-6">
          {ALL_CATEGORIES.map((category) => {
            const categoryResults = results.filter((result) => result.type === category);
            if (categoryResults.length === 0) return null;

            return (
              <section key={category} aria-labelledby={`search-section-${category}`}>
                <div className="flex items-center gap-2 mb-2 px-1">
                  <span className={`p-1.5 rounded-lg ${SEARCH_CATEGORY_COLORS[category].replace('100', '50').replace('800', '700')} dark:bg-opacity-20`}>
                    {CATEGORY_ICONS[category]}
                  </span>
                  <h2 id={`search-section-${category}`} className="text-base font-semibold text-gray-900 dark:text-white">
                    {SEARCH_CATEGORY_LABELS[category]}
                  </h2>
                  <span className="text-sm text-gray-500 dark:text-[#a1a1aa]">{counts[category]}</span>
                </div>
                <div className="bg-white dark:bg-[#171717] rounded-xl border border-gray-200 dark:border-[#262626] shadow-sm overflow-hidden divide-y divide-gray-100 dark:divide-[#262626]">
                  {categoryResults.map((result) => (
                    <div key={`${result.type}-${result.id}`}>
                      <Link
                        href={result.href as any}
                        className="flex items-center gap-4 p-4 hover:bg-gray-50 dark:hover:bg-[#0a0a0a]/50 transition"
                      >
                        <ThumbnailOrIcon thumbnail={result.thumbnail} title={result.title} type={result.type} />
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-gray-900 dark:text-white truncate">{result.title}</div>
                          <div className="text-sm text-gray-500 dark:text-[#a1a1aa] truncate">{result.subtitle}</div>
                        </div>
                      </Link>
                    </div>
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      )}

      {/* No query state */}
      {!query && (
        <div className="flex flex-col items-center justify-center py-16 px-6 text-center bg-white dark:bg-[#171717] rounded-xl border border-gray-200 dark:border-[#262626]">
          <div className="h-16 w-16 bg-[#eba236]/10 dark:bg-[#eba236]/15 rounded-2xl flex items-center justify-center mb-4">
            <Search className="w-8 h-8 text-[#eba236]" />
          </div>
          <h2 className="text-lg font-medium text-gray-900 dark:text-white mb-1">Search the admin panel</h2>
          <p className="text-sm text-gray-500 dark:text-[#a1a1aa]">
            Search for merchants, products, orders, customers, drivers, vendors
          </p>
        </div>
      )}
    </div>
  );
}

export default function SearchPage(){
  // Pure CSR: `q` comes from the URL — server prerenders with q=null while the
  // client hydrates with the real ?q= value, so the heading/empty-state would
  // differ → React #441. Render post-mount only.
  return (
    <ClientOnly fallback={<SearchSkeleton />}>
      <SearchPageContent />
    </ClientOnly>
  );
}
