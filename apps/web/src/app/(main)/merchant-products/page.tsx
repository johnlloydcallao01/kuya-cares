'use client';

import React, { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useWindowVirtualizer } from '@tanstack/react-virtual';
import { ProductCard } from '@/components/sections/MarketplaceProductCard';
import {
  getMarketplaceProducts,
  getMarketplaceProductCategories,
  getCurrentCustomerId,
  UNCATEGORIZED_PRODUCT_CATEGORY_ID,
  isUncategorizedId,
  type MarketplaceProduct,
  type MarketplaceProductCategory,
} from '@encreasl/client-services';
import { useAddressChange } from '@/hooks/useAddressChange';
import { clearAllLocationCaches } from '@/lib/clear-location-caches';
import { getShowAll, useShowAll } from '@/lib/show-all';

/** Static first-page size for the pre-mount (SSR-safe) fallback grid. */
const STATIC_FIRST_PAGE = 24;

export default function MerchantProductsPage() {
  return (
    <Suspense fallback={<MerchantProductsShell />}>
      <MerchantProductsContent />
    </Suspense>
  );
}

function MerchantProductsShell() {
  return (
    <div className="min-h-screen bg-gray-50" style={{ backgroundColor: '#f9fafb' }}>
      <div className="w-full px-2.5 py-4">
        <div className="h-6 w-48 bg-gray-200 rounded animate-pulse mb-2" />
        <div className="h-4 w-64 bg-gray-200 rounded animate-pulse mb-4" />
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-3">
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className="bg-white rounded-lg shadow-sm overflow-hidden animate-pulse">
              <div className="aspect-square bg-gray-200" />
              <div className="p-3 space-y-2">
                <div className="h-3.5 bg-gray-200 rounded w-full" />
                <div className="h-3.5 bg-gray-200 rounded w-2/3" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/**
 * Responsive column count matching the grid breakpoints
 * (base 2 / md 3 / lg 4 / xl 5 / 2xl 6).
 */
function useColumnCount(): number {
  const getCols = useCallback(() => {
    if (typeof window === 'undefined') return 2;
    const w = window.innerWidth;
    if (w >= 1536) return 6;
    if (w >= 1280) return 5;
    if (w >= 1024) return 4;
    if (w >= 768) return 3;
    return 2;
  }, []);
  const [cols, setCols] = useState<number>(() => getCols());
  useEffect(() => {
    setCols(getCols());
    const onResize = () => setCols(getCols());
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [getCols]);
  return cols;
}

/**
 * Facebook-feed style virtualized product grid: only the viewport +
 * overscan rows stay mounted — offscreen cards (and their images) are
 * unmounted as you scroll, so a 500-item feed costs ~2-3 rows of DOM
 * instead of 500 cards. `key={cols}` remounts on breakpoint change so
 * measurements match the new column width.
 */
function VirtualProductGrid({
  products,
  hideDistance,
}: {
  products: MarketplaceProduct[];
  hideDistance: boolean;
}) {
  const [mounted, setMounted] = useState(false);
  const cols = useColumnCount();
  useEffect(() => {
    setMounted(true);
  }, []);
  if (!mounted) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-3 mt-2">
        {products.slice(0, STATIC_FIRST_PAGE).map((p) => (
          <ProductCard key={String(p.merchantProductId)} product={p} hideDistance={hideDistance} />
        ))}
      </div>
    );
  }
  return <VirtualizedGridInner key={cols} cols={cols} products={products} hideDistance={hideDistance} />;
}

function VirtualizedGridInner({
  products,
  hideDistance,
  cols,
}: {
  products: MarketplaceProduct[];
  hideDistance: boolean;
  cols: number;
}) {
  const virtualizer = useWindowVirtualizer({
    count: products.length,
    estimateSize: () => 340,
    overscan: cols * 2,
    lanes: cols,
    scrollMargin: 72,
  });
  const virtualItems = virtualizer.getVirtualItems();
  return (
    <div
      className="mt-2"
      style={{ position: 'relative', width: '100%', height: `${virtualizer.getTotalSize()}px` }}
    >
      {virtualItems.map((vi) => {
        const p = products[vi.index];
        return (
          <div
            key={String(p.merchantProductId)}
            data-index={vi.index}
            ref={virtualizer.measureElement}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: `${100 / cols}%`,
              transform: `translateX(${vi.lane * 100}%) translateY(${vi.start}px)`,
              paddingLeft: 6,
              paddingRight: 6,
              paddingBottom: 12,
            }}
          >
            <ProductCard product={p} hideDistance={hideDistance} />
          </div>
        );
      })}
    </div>
  );
}

function MerchantProductsContent() {
  const searchParams = useSearchParams();
  const [customerId, setCustomerId] = useState<string | null>(null);
  const [allProducts, setAllProducts] = useState<MarketplaceProduct[]>([]);
  const [categories, setCategories] = useState<MarketplaceProductCategory[]>([]);
  const [activeCategoryId, setActiveCategoryId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAll] = useShowAll();

  const fetchCategories = useCallback(async () => {
    try {
      const cats = await getMarketplaceProductCategories({ limit: 30 });
      setCategories(cats);
    } catch {
      setCategories([]);
    }
  }, []);

  // Full eligible window (up to 500): ONLY products of location-qualified
  // merchants — the same hard rule as the home Recommended section.
  // No customer/address → zero products, never the global pool.
  const fetchPool = useCallback(async (cid: string | null) => {
    try {
      setIsLoading(true);
      setError(null);
      const scopeAll = getShowAll();
      if (!scopeAll && !cid) {
        setAllProducts([]);
        return;
      }
      const items = await getMarketplaceProducts({
        limit: 40,
        merchantCategoryId: null,
        customerId: cid,
        ignoreLocation: scopeAll,
        // Full window for the listing page (home passes the same; the
        // 40-item ceiling lives only in the home grid display).
        cap: 500,
      });
      setAllProducts(items);
    } catch {
      setError('Failed to load products. Please try again.');
      setAllProducts([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  // Resolve identity once, then load.
  useEffect(() => {
    let cancelled = false;
    getCurrentCustomerId()
      .catch(() => null)
      .then((cid) => {
        if (cancelled) return;
        setCustomerId(cid ?? null);
        fetchPool(cid ?? null);
      });
    return () => {
      cancelled = true;
    };
  }, [fetchPool, showAll]);

  // Preselect pill from home Show All (?category=<id>).
  useEffect(() => {
    const cat = searchParams.get('category');
    if (cat) setActiveCategoryId(cat);
  }, [searchParams]);

  // Delivery address change → clear + refetch location-aware pool.
  useAddressChange(
    useCallback(() => {
      clearAllLocationCaches();
      getCurrentCustomerId()
        .catch(() => null)
        .then((cid) => {
          setCustomerId(cid ?? null);
          fetchPool(cid ?? null);
        });
    }, [fetchPool]),
  );

  // Pool-driven pills (same as home): only categories owning products
  // in the current location-gated pool get pills.
  const poolCategoryIds = useMemo(() => {
    const s = new Set<string>();
    allProducts.forEach((p) => (p.categoryIds || []).forEach((id) => s.add(String(id))));
    return s;
  }, [allProducts]);

  const poolHasOrphans = useMemo(
    () => allProducts.some((p) => !p.categoryIds || p.categoryIds.length === 0),
    [allProducts],
  );

  const displayCategories = useMemo<MarketplaceProductCategory[]>(
    () => [
      ...categories.filter((c) => poolCategoryIds.has(String(c.id))),
      ...(poolHasOrphans
        ? [{ id: UNCATEGORIZED_PRODUCT_CATEGORY_ID, name: 'Uncategorized', slug: UNCATEGORIZED_PRODUCT_CATEGORY_ID }]
        : []),
    ],
    [categories, poolCategoryIds, poolHasOrphans],
  );

  const filteredProducts = useMemo(() => {
    if (activeCategoryId == null) return allProducts;
    if (isUncategorizedId(activeCategoryId)) {
      return allProducts.filter((p) => !p.categoryIds || p.categoryIds.length === 0);
    }
    return allProducts.filter((p) => (p.categoryIds || []).map(String).includes(activeCategoryId));
  }, [allProducts, activeCategoryId]);

  return (
    <div className="min-h-screen bg-gray-50 pb-6" style={{ backgroundColor: '#f9fafb' }}>
      <section className="bg-white mt-2 border-y border-gray-200">
        <div className="w-full px-2.5 py-4">
          <Link href="/" className="inline-flex items-center gap-1.5 text-xs font-medium text-gray-500 hover:text-gray-700 mb-2">
            <i className="fas fa-arrow-left" />
            Back to home
          </Link>
          <h1 className="text-[1.2rem] font-bold text-gray-900">All Products</h1>
          {!isLoading && !error && filteredProducts.length > 0 && (
            <p className="text-xs text-gray-500 mt-0.5">
              {filteredProducts.length} product{filteredProducts.length === 1 ? '' : 's'} from local merchants
            </p>
          )}

          {/* Category pills */}
          {!isLoading && displayCategories.length > 0 && (
            <div className="flex gap-2 overflow-x-auto py-2.5" style={{ scrollbarWidth: 'none' }}>
              {displayCategories.map((c) => {
                const id = String(c.id);
                const active = activeCategoryId === id;
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => {
                      setActiveCategoryId((prev) => (prev === id ? null : id));
                      window.scrollTo({ top: 0 });
                    }}
                    className={`h-8 shrink-0 whitespace-nowrap rounded-lg px-3 text-sm font-medium transition-colors ${
                      active ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-800 hover:bg-gray-200'
                    }`}
                  >
                    {c.name}
                  </button>
                );
              })}
            </div>
          )}

          {isLoading && allProducts.length === 0 ? (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-3 mt-2">
              {Array.from({ length: 12 }).map((_, i) => (
                <div key={i} className="bg-white rounded-lg shadow-sm overflow-hidden animate-pulse">
                  <div className="aspect-square bg-gray-200" />
                  <div className="p-3 space-y-2">
                    <div className="h-3.5 bg-gray-200 rounded w-full" />
                    <div className="h-3.5 bg-gray-200 rounded w-2/3" />
                  </div>
                </div>
              ))}
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <p className="text-gray-500 mb-3">{error}</p>
              <button
                type="button"
                onClick={() => fetchPool(customerId)}
                className="px-4 py-2 rounded-lg text-white text-sm font-medium"
                style={{ backgroundColor: '#239459' }}
              >
                Try Again
              </button>
            </div>
          ) : filteredProducts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <i className="fas fa-box-open text-3xl text-gray-300 mb-3" />
              <p className="font-medium text-gray-900">No products found</p>
              <p className="text-sm text-gray-500 mt-1">
                {customerId == null && !showAll
                  ? 'Set your delivery address to see products from merchants near you.'
                  : 'Try a different category — new items are added daily.'}
              </p>
            </div>
          ) : (
            <>
              <VirtualProductGrid products={filteredProducts} hideDistance={showAll} />
              <div className="flex flex-col items-center gap-2 mt-3 pb-2">
                <p className="text-xs text-gray-400 pt-2">You&apos;re all caught up</p>
                {filteredProducts.length > 12 && (
                  <button
                    type="button"
                    onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
                    className="px-8 py-2.5 rounded-lg border border-gray-200 text-sm font-medium text-gray-500 hover:bg-gray-50 transition-colors"
                  >
                    Back to top
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      </section>
    </div>
  );
}
