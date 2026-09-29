'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import Image from '@/components/ui/ImageWrapper';
import { useCart } from '@/contexts/CartContext';
import {
  getMarketplaceProducts,
  getMarketplaceProductCategories,
  getCurrentCustomerId,
  formatPHP,
  UNCATEGORIZED_PRODUCT_CATEGORY_ID,
  isUncategorizedId,
  type MarketplaceProduct,
  type MarketplaceProductCategory,
} from '@encreasl/client-services';
import { useAddressChange } from '@/hooks/useAddressChange';
import { clearAllLocationCaches } from '@/lib/clear-location-caches';
import { getShowAll, useShowAll } from '@/lib/show-all';

interface HomeMarketplaceProductsProps {
  limit?: number;
}

const PAGE_STEP_MOBILE = 8;
const PAGE_STEP_DESKTOP = 12;

function getStep(): number {
  if (typeof window !== 'undefined' && window.innerWidth >= 1120) return PAGE_STEP_DESKTOP;
  return PAGE_STEP_MOBILE;
}

// ── Advanced filters (Shopee/Lazada-style) ───────────────────────────────
type ProductSort = 'recommended' | 'price-asc' | 'price-desc' | 'discount';

interface ProductFilters {
  minPrice: string;
  maxPrice: string;
  types: string[];
  onSale: boolean;
  inStock: boolean;
  sort: ProductSort;
}

const DEFAULT_FILTERS: ProductFilters = {
  minPrice: '',
  maxPrice: '',
  types: [],
  onSale: false,
  inStock: false,
  sort: 'recommended',
};

const PRODUCT_TYPE_OPTIONS = [
  { value: 'simple', label: 'Simple' },
  { value: 'variable', label: 'Variable' },
  { value: 'grouped', label: 'Grouped' },
];

const SORT_OPTIONS: { value: ProductSort; label: string }[] = [
  { value: 'recommended', label: 'Recommended' },
  { value: 'price-asc', label: 'Price: Low to High' },
  { value: 'price-desc', label: 'Price: High to Low' },
  { value: 'discount', label: 'Biggest Discount' },
];

function toNullableNumber(s: string): number | null {
  if (s.trim() === '') return null;
  const n = Number(s);
  return Number.isNaN(n) ? null : n;
}

function FilterToggle({ label, hint, checked, onChange }: { label: string; hint?: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="flex w-full items-center justify-between gap-3 px-1 py-2"
    >
      <span>
        <span className="block text-sm text-gray-800 text-left">{label}</span>
        {hint && <span className="block text-xs text-gray-400 text-left mt-0.5">{hint}</span>}
      </span>
      <span
        className={`w-9 h-5 shrink-0 rounded-full transition-colors ${checked ? '' : 'bg-gray-300'}`}
        style={checked ? { backgroundColor: '#239459' } : undefined}
      >
        <span className={`block w-5 h-5 rounded-full bg-white shadow transition-transform ${checked ? 'translate-x-4' : 'translate-x-0'}`} />
      </span>
    </button>
  );
}

function ProductCardSkeleton() {
  return (
    <div className="bg-white rounded-lg shadow-sm overflow-hidden animate-pulse">
      <div className="aspect-square bg-gray-200" />
      <div className="p-3 space-y-2">
        <div className="h-3.5 bg-gray-200 rounded w-full" />
        <div className="h-3.5 bg-gray-200 rounded w-2/3" />
        <div className="h-4 bg-gray-200 rounded w-1/2" />
        <div className="h-3 bg-gray-200 rounded w-3/4" />
      </div>
    </div>
  );
}

function ProductCard({ product, hideDistance = false }: { product: MarketplaceProduct; hideDistance?: boolean }) {
  const { addToCart } = useCart();
  const [adding, setAdding] = useState(false);
  const LinkComponent = Link as unknown as React.ElementType;

  const priceLabel = formatPHP(product.price);
  const compareLabel =
    product.compareAtPrice != null && product.compareAtPrice > (product.price ?? 0)
      ? formatPHP(product.compareAtPrice)
      : null;

  const handleQuickAdd = useCallback(
    async (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      // Variable/grouped items must be configured on the detail page.
      if (product.productType !== 'simple') return;
      const merchantId = Number(product.merchantId);
      const productId = Number(product.id);
      const merchantProductId = Number(product.merchantProductId);
      if (!merchantId || !productId || !merchantProductId || Number.isNaN(merchantId) || Number.isNaN(productId) || Number.isNaN(merchantProductId)) {
        return;
      }
      try {
        setAdding(true);
        await addToCart({
          merchantId,
          productId,
          merchantProductId,
          quantity: 1,
          priceAtAdd: product.price ?? 0,
          compareAtPrice: product.compareAtPrice ?? null,
        });
      } catch {
        // Cart context surfaces its own errors; keep card silent.
      } finally {
        setAdding(false);
      }
    },
    [addToCart, product],
  );

  return (
    <LinkComponent href={product.href} className="bg-white rounded-lg shadow-sm overflow-hidden block hover:shadow-md transition-shadow group">
      <div className="relative aspect-square bg-gray-100">
        {product.imageUrl ? (
          <Image src={product.imageUrl} alt={product.name} fill className="object-cover group-hover:scale-[1.02] transition-transform duration-200" />
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-300 gap-1">
            <i className="fas fa-image text-2xl" />
            <span className="text-[11px]">No image</span>
          </div>
        )}
        {product.discountPercent != null && product.discountPercent > 0 && (
          <div className="absolute top-2 left-2 bg-red-500 text-white text-[11px] font-bold px-1.5 py-0.5 rounded">
            -{product.discountPercent}%
          </div>
        )}
        {product.productType === 'simple' ? (
          <button
            type="button"
            aria-label={`Add ${product.name} to cart`}
            onClick={handleQuickAdd}
            disabled={adding}
            className="absolute bottom-2 right-2 w-8 h-8 bg-white rounded-full shadow-lg flex items-center justify-center hover:bg-gray-50 transition-colors disabled:opacity-60"
          >
            {adding ? (
              <i className="fas fa-spinner fa-spin text-[12px]" style={{ color: '#333' }} />
            ) : (
              <i className="fas fa-plus text-[12px]" style={{ color: '#333' }} />
            )}
          </button>
        ) : null}
      </div>
      <div className="p-3">
        <h3 className="text-[13px] leading-[1.35] font-normal text-gray-900 line-clamp-2 min-h-[35px]">{product.name}</h3>
        <div className="mt-1.5 flex items-baseline gap-1.5 flex-wrap">
          {priceLabel ? (
            <span className="text-[15px] font-bold text-[#ee4d2d]">{priceLabel}</span>
          ) : product.productType === 'variable' ? (
            <span className="text-[13px] font-medium text-[#239459]">Show Variations</span>
          ) : product.productType === 'grouped' ? (
            <span className="text-[13px] font-medium text-[#239459]">Show Grouped Items</span>
          ) : (
            <span className="text-[13px] text-gray-500">Price unavailable</span>
          )}
          {compareLabel && <span className="text-[11px] text-gray-400 line-through">{compareLabel}</span>}
        </div>
        <div className="mt-1.5 flex items-center justify-between gap-2 min-w-0">
          <p className="text-[11px] text-gray-500 truncate">
            <i className="fas fa-store mr-1 text-gray-400" />
            {product.merchantName}
            {!hideDistance && typeof product.distanceKm === 'number' && (
              <span className="ml-1 text-gray-400">
                • {product.distanceKm <= 0 ? '0km' : product.distanceKm < 1 ? `${Math.round(product.distanceKm * 1000)}m` : `${product.distanceKm.toFixed(1)}km`}
              </span>
            )}
          </p>
          {typeof product.rating === 'number' && (
            <span className="flex items-center gap-0.5 text-[11px] text-gray-500 shrink-0">
              <span className="text-amber-400">★</span>
              {product.rating.toFixed(1)}
            </span>
          )}
        </div>
      </div>
    </LinkComponent>
  );
}

/**
 * Marketplace products showcase for the home page — Shopee/Lazada/Amazon style.
 * Additive only: does not touch the existing Merchants / Merchant Categories sections.
 *
 * - "Shop by Product Category" pills (true `product-categories` taxonomy)
 * - "Flash Deals" rail (discounted merchant-products)
 * - "Recommended For You" responsive grid with progressive Show more
 *
 * Filtering follows the same principle as the Merchants product grid
 * (`MerchantProductsClient` / `MerchantProductGrid`): products with zero
 * categories are grouped under a special "Uncategorized" pseudo-category
 * (`slug: "uncategorized"`, `fa-store` icon) that is only shown when such
 * products exist. Pill switching filters client-side from a single pool,
 * so "All" always contains every product including uncategorized ones.
 */
export function HomeMarketplaceProducts({ limit = 48 }: HomeMarketplaceProductsProps) {
  const [categories, setCategories] = useState<MarketplaceProductCategory[]>([]);
  const [allProducts, setAllProducts] = useState<MarketplaceProduct[]>([]);
  const [activeCategoryId, setActiveCategoryId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [visibleCount, setVisibleCount] = useState<number>(PAGE_STEP_DESKTOP);
  const [filters, setFilters] = useState<ProductFilters>(DEFAULT_FILTERS);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const flashRailRef = useRef<HTMLDivElement>(null);

  // Pool sized so per-category client-side filtering stays meaningful.
  const poolLimit = Math.max(limit, 150);

  const fetchCategories = useCallback(async () => {
    try {
      const cats = await getMarketplaceProductCategories({ limit: 30 });
      setCategories(cats);
    } catch {
      setCategories([]);
    }
  }, []);

  // Location-gated pool (hard rule): ONLY products of location-qualified
  // merchants. Independent from the merchants carousel *category* filter —
  // always fetched with null there — but strictly follows the delivery
  // *location*. No customer/address → zero products, never the global pool.
  const [customerId, setCustomerId] = useState<string | null>(null);
  const [showAll] = useShowAll();

  const fetchPool = useCallback(async (cid: string | null) => {
    try {
      setIsLoading(true);
      setError(null);
      const scopeAll = getShowAll();
      if (!scopeAll && !cid) {
        setAllProducts([]);
        setActiveCategoryId(null);
        return;
      }
      const items = await getMarketplaceProducts({
        limit: poolLimit,
        merchantCategoryId: null,
        customerId: cid,
        ignoreLocation: scopeAll,
      });
      setAllProducts(items);
      // Drop a stale active pill when the new pool no longer contains it.
      setActiveCategoryId((prev) => {
        if (prev == null) return prev;
        if (isUncategorizedId(prev)) {
          return items.some((p) => !p.categoryIds || p.categoryIds.length === 0) ? prev : null;
        }
        const ids = new Set(items.flatMap((p) => (p.categoryIds || []).map(String)));
        return ids.has(prev) ? prev : null;
      });
      setVisibleCount(getStep());
    } catch {
      setError('Failed to load products. Please try again.');
      setAllProducts([]);
    } finally {
      setIsLoading(false);
    }
  }, [poolLimit]);

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  // Initial load + Show-All toggle: resolve customer, then fetch pool.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const cid = await getCurrentCustomerId().catch(() => null);
      if (cancelled) return;
      setCustomerId(cid);
      fetchPool(cid);
    })();
    return () => {
      cancelled = true;
    };
  }, [fetchPool, showAll]);

  // Delivery address change → clear + refetch location-aware pool.
  useAddressChange(
    useCallback(() => {
      clearAllLocationCaches();
      getCurrentCustomerId()
        .catch(() => null)
        .then((cid) => {
          setCustomerId(cid);
          fetchPool(cid);
        });
    }, [fetchPool]),
  );

  const handleSelectProductCategory = useCallback(
    (id: string | null) => {
      setActiveCategoryId((prev) => (id === prev ? null : id));
      setVisibleCount(getStep());
    },
    [],
  );

  // ── Product-category rail ────────────────────────────────────────────
  // Fully pool-driven (location-aware like everything else here): only
  // categories owning products in the current pool get pills — including
  // the "Uncategorized" pseudo pill, shown only when the pool actually
  // contains orphan products (zero categories).
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
        ? [
            {
              id: UNCATEGORIZED_PRODUCT_CATEGORY_ID,
              name: 'Uncategorized',
              slug: UNCATEGORIZED_PRODUCT_CATEGORY_ID,
            },
          ]
        : []),
    ],
    [categories, poolCategoryIds],
  );

  // Category-level narrowing (pills + Uncategorized), before advanced filters.
  const categoryFiltered = useMemo(() => {
    if (activeCategoryId == null) return allProducts;
    if (isUncategorizedId(activeCategoryId)) {
      return allProducts.filter((p) => !p.categoryIds || p.categoryIds.length === 0);
    }
    return allProducts.filter((p) => (p.categoryIds || []).map(String).includes(activeCategoryId));
  }, [allProducts, activeCategoryId]);

  const typeCounts = useMemo(() => {
    const counts: Record<string, number> = { simple: 0, variable: 0, grouped: 0 };
    categoryFiltered.forEach((p) => {
      if (p.productType === 'simple' || p.productType === 'variable' || p.productType === 'grouped') {
        counts[p.productType] += 1;
      }
    });
    return counts;
  }, [categoryFiltered]);

  const activeFilterCount = useMemo(() => {
    let n = 0;
    if (filters.minPrice !== '' || filters.maxPrice !== '') n += 1;
    if (filters.types.length > 0) n += 1;
    if (filters.onSale) n += 1;
    if (filters.inStock) n += 1;
    return n;
  }, [filters]);

  const filteredProducts = useMemo(() => {
    let lo = toNullableNumber(filters.minPrice);
    let hi = toNullableNumber(filters.maxPrice);
    if (lo != null && hi != null && lo > hi) {
      const t = lo;
      lo = hi;
      hi = t;
    }
    const priceBounded = lo != null || hi != null;
    const out = categoryFiltered.filter((p) => {
      if (filters.types.length > 0 && !filters.types.includes(p.productType)) return false;
      if (priceBounded) {
        // Items without a set price (e.g. variable parents) can't be ranged.
        if (p.price == null) return false;
        if (lo != null && p.price < lo) return false;
        if (hi != null && p.price > hi) return false;
      }
      if (filters.onSale && !((p.discountPercent ?? 0) > 0)) return false;
      if (filters.inStock && p.stockQuantity != null && p.stockQuantity <= 0) return false;
      return true;
    });
    switch (filters.sort) {
      case 'price-asc':
        return out.slice().sort((a, b) => (a.price ?? Number.POSITIVE_INFINITY) - (b.price ?? Number.POSITIVE_INFINITY));
      case 'price-desc':
        return out.slice().sort((a, b) => (b.price ?? Number.NEGATIVE_INFINITY) - (a.price ?? Number.NEGATIVE_INFINITY));
      case 'discount':
        return out.slice().sort((a, b) => (b.discountPercent ?? -1) - (a.discountPercent ?? -1));
      default:
        return out;
    }
  }, [categoryFiltered, filters]);

  // ── Category chips use displayCategories directly (YouTube-style) ─────
  const activeCategoryName = useMemo(() => {
    if (activeCategoryId == null) return null;
    if (isUncategorizedId(activeCategoryId)) return 'Uncategorized';
    return categories.find((c) => String(c.id) === activeCategoryId)?.name ?? null;
  }, [activeCategoryId, categories]);

  const flashDeals = useMemo(
    () =>
      allProducts
        .filter((p) => (p.discountPercent ?? 0) > 0)
        .sort((a, b) => (b.discountPercent ?? 0) - (a.discountPercent ?? 0))
        .slice(0, 12),
    [allProducts],
  );

  const visibleProducts = useMemo(() => filteredProducts.slice(0, visibleCount), [filteredProducts, visibleCount]);
  const hasMore = visibleCount < filteredProducts.length;

  const scrollFlash = useCallback((dir: 1 | -1) => {
    const el = flashRailRef.current;
    if (!el) return;
    el.scrollBy({ left: dir * Math.max(el.clientWidth * 0.7, 240), behavior: 'smooth' });
  }, []);

  const clearAllFilters = useCallback(() => {
    setFilters(DEFAULT_FILTERS);
    setActiveCategoryId(null);
    setVisibleCount(getStep());
  }, []);

  // Restart paging whenever the visible set changes.
  useEffect(() => {
    setVisibleCount(getStep());
  }, [filters, activeCategoryId]);

  // Independent drawer: lock page scroll while open so the panel scrolls
  // on its own and the page behind never moves.
  useEffect(() => {
    if (!filtersOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [filtersOpen]);

  // ── Category chips rail (YouTube-style) ────────────────────────────────
  // Native horizontal scroll with edge arrows. Filtering logic untouched.
  const chipsRef = useRef<HTMLDivElement>(null);
  const [chipsAtStart, setChipsAtStart] = useState(true);
  const [chipsAtEnd, setChipsAtEnd] = useState(false);

  const updateChipsEdges = useCallback(() => {
    const el = chipsRef.current;
    if (!el) return;
    setChipsAtStart(el.scrollLeft <= 4);
    setChipsAtEnd(el.scrollLeft + el.clientWidth >= el.scrollWidth - 4);
  }, []);

  useEffect(() => {
    updateChipsEdges();
  }, [displayCategories.length, updateChipsEdges]);

  useEffect(() => {
    window.addEventListener('resize', updateChipsEdges);
    return () => window.removeEventListener('resize', updateChipsEdges);
  }, [updateChipsEdges]);

  const scrollChips = useCallback((dir: 1 | -1) => {
    const el = chipsRef.current;
    if (!el) return;
    el.scrollBy({ left: dir * Math.max(el.clientWidth * 0.7, 160), behavior: 'smooth' });
  }, []);

  return (
    <div className="pb-6">
      {/* ── Flash Deals rail (only when discounts exist) ─────────────── */}
      {!isLoading && flashDeals.length > 0 && (
        <section className="bg-white mt-2 border-y border-gray-200">
          <div className="w-full px-2.5 py-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-[1.2rem] font-bold text-gray-900">
                <span className="text-red-500 mr-1.5"><i className="fas fa-bolt" /></span>
                Flash Deals
              </h2>
              <div className="hidden sm:flex items-center gap-2">
                <button type="button" aria-label="Scroll deals left" onClick={() => scrollFlash(-1)} className="w-8 h-8 rounded-full border border-gray-200 flex items-center justify-center hover:bg-gray-50">
                  <i className="fas fa-chevron-left text-xs text-gray-600" />
                </button>
                <button type="button" aria-label="Scroll deals right" onClick={() => scrollFlash(1)} className="w-8 h-8 rounded-full border border-gray-200 flex items-center justify-center hover:bg-gray-50">
                  <i className="fas fa-chevron-right text-xs text-gray-600" />
                </button>
              </div>
            </div>
            <div ref={flashRailRef} className="flex gap-3 overflow-x-auto pb-1 -mx-2.5 px-2.5" style={{ scrollbarWidth: 'none' }}>
              {flashDeals.map((p) => (
                <div key={`flash-${String(p.merchantProductId)}`} className="w-[140px] sm:w-[160px] shrink-0">
                  <ProductCard product={p} hideDistance={showAll} />
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ── Recommended / All Products grid ──────────────────────────── */}
      <section className="bg-white mt-2 border-y border-gray-200">
        <div className="w-full px-2.5 py-4">
          <div className="flex items-center justify-between mb-1">
            <div>
              <h2 className="text-[1.2rem] font-bold text-gray-900">{activeCategoryName ?? 'Recommended For You'}</h2>
              {!isLoading && filteredProducts.length > 0 && (
                <p className="text-xs text-gray-500 mt-0.5">{filteredProducts.length} product{filteredProducts.length === 1 ? '' : 's'} from local merchants</p>
              )}
            </div>
          </div>

          {/* ── Product Category chips ─────────────────────────────────── */}
          <div className="relative -mx-2.5">
            {isLoading && displayCategories.length === 0 ? (
              <div className="overflow-hidden px-2.5">
                <div className="flex gap-2 py-2.5">
                  {[96, 128, 84, 140, 104, 72].map((w, index) => (
                    <div key={index} className="h-8 bg-gray-200 rounded-lg animate-pulse shrink-0" style={{ width: w }} />
                  ))}
                </div>
              </div>
            ) : displayCategories.length > 0 ? (
              <>
                {!chipsAtStart && (
                  <button
                    onClick={() => scrollChips(-1)}
                    className="hidden lg:flex absolute left-2 top-1/2 -translate-y-1/2 z-10 w-8 h-8 bg-white shadow-lg rounded-full items-center justify-center hover:bg-gray-50 transition-colors"
                    aria-label="Scroll categories left"
                  >
                    <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                  </button>
                )}
                {!chipsAtEnd && (
                  <button
                    onClick={() => scrollChips(1)}
                    className="hidden lg:flex absolute right-2 top-1/2 -translate-y-1/2 z-10 w-8 h-8 bg-white shadow-lg rounded-full items-center justify-center hover:bg-gray-50 transition-colors"
                    aria-label="Scroll categories right"
                  >
                    <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                )}
                <div
                  ref={chipsRef}
                  onScroll={updateChipsEdges}
                  className="flex gap-2 overflow-x-auto px-2.5 py-2.5 [&::-webkit-scrollbar]:hidden"
                  style={{ scrollbarWidth: 'none' }}
                >
                  {displayCategories.map((c) => {
                    const id = String(c.id);
                    const active = activeCategoryId === id;
                    return (
                      <button
                        key={id}
                        type="button"
                        onClick={() => handleSelectProductCategory(id)}
                        className={`h-8 shrink-0 whitespace-nowrap rounded-lg px-3 text-sm font-medium transition-colors ${
                          active
                            ? 'bg-gray-900 text-white'
                            : 'bg-gray-100 text-gray-800 hover:bg-gray-200'
                        }`}
                      >
                        {c.name}
                      </button>
                    );
                  })}
                </div>
              </>
            ) : null}
          </div>

          {/* ── Toolbar: filters + sort ─────────────────────────────────── */}
          {!isLoading && (
            <div className="flex items-center gap-2 mb-3">
              <button
                type="button"
                onClick={() => setFiltersOpen(true)}
                className="h-9 flex items-center gap-2 rounded-lg border border-gray-300 px-3 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                aria-haspopup="dialog"
              >
                <i className="fas fa-sliders-h text-xs text-gray-500" />
                Filters
                {activeFilterCount > 0 && (
                  <span
                    className="min-w-[20px] h-5 px-1 rounded-full text-white text-xs font-bold flex items-center justify-center"
                    style={{ backgroundColor: '#239459' }}
                  >
                    {activeFilterCount}
                  </span>
                )}
              </button>
              {activeFilterCount > 0 && (
                <button
                  type="button"
                  onClick={clearAllFilters}
                  className="text-xs font-medium text-gray-500 hover:text-gray-700 underline underline-offset-2"
                >
                  Clear all
                </button>
              )}
              <div className="ml-auto flex items-center gap-2">
                <label htmlFor="home-product-sort" className="hidden sm:block text-xs text-gray-500">
                  Sort by
                </label>
                <select
                  id="home-product-sort"
                  value={filters.sort}
                  onChange={(e) => setFilters((f) => ({ ...f, sort: e.target.value as ProductSort }))}
                  className="h-9 rounded-lg border border-gray-300 bg-white px-2 text-sm font-medium text-gray-700"
                >
                  {SORT_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {isLoading ? (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-3">
              {Array.from({ length: 12 }).map((_, i) => (
                <ProductCardSkeleton key={i} />
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
                  ? 'Set your delivery address above to see products from merchants near you.'
                  : 'Try a different category or loosen your filters — new items are added daily.'}
              </p>
              {(activeCategoryId !== null || activeFilterCount > 0) && (
                <button
                  type="button"
                  onClick={clearAllFilters}
                  className="mt-3 px-4 py-2 rounded-lg border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  Clear all filters
                </button>
              )}
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-3">
                {visibleProducts.map((p) => (
                  <ProductCard key={String(p.merchantProductId)} product={p} hideDistance={showAll} />
                ))}
              </div>
              <div className="flex justify-center mt-5">
                {hasMore ? (
                  <button
                    type="button"
                    onClick={() => setVisibleCount((c) => c + getStep())}
                    className="px-8 py-2.5 rounded-lg border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                  >
                    Show More
                  </button>
                ) : filteredProducts.length > PAGE_STEP_MOBILE ? (
                  <button
                    type="button"
                    onClick={() => {
                      setVisibleCount(getStep());
                      document.getElementById('products-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    }}
                    className="px-8 py-2.5 rounded-lg border border-gray-200 text-sm font-medium text-gray-500 hover:bg-gray-50 transition-colors"
                  >
                    Show Less
                  </button>
                ) : null}
              </div>
            </>
          )}
        </div>
      </section>

      {/* ── Filters drawer (portaled to body: immune to page scroll /
          transformed ancestors; owns its scroll via overscroll-contain) ── */}
      {filtersOpen && createPortal(
        <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label="Filter products">
          <div className="absolute inset-0 bg-black/50" onClick={() => setFiltersOpen(false)} />
          <style>{`@keyframes filter-drawer-in { from { transform: translateX(100%); } to { transform: translateX(0); } }`}</style>
          <div className="absolute right-0 top-0 h-full w-[88%] max-w-md overflow-y-auto overscroll-contain bg-white shadow-xl animate-[filter-drawer-in_0.25s_ease-out]">
            <div className="sticky top-0 bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between">
              <h3 className="font-bold text-gray-900">
                Filters
                {activeFilterCount > 0 && <span className="ml-1 text-sm font-medium text-gray-500">({activeFilterCount})</span>}
              </h3>
              <button type="button" onClick={() => setFiltersOpen(false)} aria-label="Close filters" className="w-8 h-8 rounded-full hover:bg-gray-100 flex items-center justify-center">
                <i className="fas fa-times text-gray-500" />
              </button>
            </div>
            <div className="px-4 py-4 space-y-6">
              <div>
                <h4 className="text-sm font-semibold text-gray-900 mb-2">Price Range (₱)</h4>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="0"
                    inputMode="decimal"
                    placeholder="Min"
                    aria-label="Minimum price"
                    value={filters.minPrice}
                    onChange={(e) => setFilters((f) => ({ ...f, minPrice: e.target.value }))}
                    className="h-10 w-full rounded-lg border border-gray-300 px-3 text-sm text-gray-900 focus:border-[#239459] focus:outline-none"
                  />
                  <span className="text-gray-400">–</span>
                  <input
                    type="number"
                    min="0"
                    inputMode="decimal"
                    placeholder="Max"
                    aria-label="Maximum price"
                    value={filters.maxPrice}
                    onChange={(e) => setFilters((f) => ({ ...f, maxPrice: e.target.value }))}
                    className="h-10 w-full rounded-lg border border-gray-300 px-3 text-sm text-gray-900 focus:border-[#239459] focus:outline-none"
                  />
                </div>
              </div>
              <div>
                <h4 className="text-sm font-semibold text-gray-900 mb-1">Product Type</h4>
                {PRODUCT_TYPE_OPTIONS.map((o) => {
                  const checked = filters.types.includes(o.value);
                  return (
                    <button
                      key={o.value}
                      type="button"
                      role="checkbox"
                      aria-checked={checked}
                      onClick={() =>
                        setFilters((f) => ({
                          ...f,
                          types: checked ? f.types.filter((t) => t !== o.value) : [...f.types, o.value],
                        }))
                      }
                      className="flex w-full items-center gap-3 rounded-lg px-1 py-2 hover:bg-gray-50"
                    >
                      <span
                        className={`w-5 h-5 rounded border flex items-center justify-center ${checked ? 'border-[#239459] text-white' : 'border-gray-300 bg-white'}`}
                        style={checked ? { backgroundColor: '#239459' } : undefined}
                      >
                        {checked && <i className="fas fa-check text-[11px]" />}
                      </span>
                      <span className="text-sm text-gray-800">{o.label}</span>
                      <span className="ml-auto text-xs text-gray-400">{typeCounts[o.value] ?? 0}</span>
                    </button>
                  );
                })}
              </div>
              <div>
                <h4 className="text-sm font-semibold text-gray-900 mb-1">Offers & Availability</h4>
                <FilterToggle
                  label="On sale"
                  hint="Only discounted products"
                  checked={filters.onSale}
                  onChange={(v) => setFilters((f) => ({ ...f, onSale: v }))}
                />
                <FilterToggle
                  label="In stock"
                  hint="Hide out-of-stock products"
                  checked={filters.inStock}
                  onChange={(v) => setFilters((f) => ({ ...f, inStock: v }))}
                />
              </div>
            </div>
            <div className="sticky bottom-0 bg-white border-t border-gray-200 px-4 py-3 flex items-center gap-2">
              {activeFilterCount > 0 && (
                <button
                  type="button"
                  onClick={() => setFilters(DEFAULT_FILTERS)}
                  className="px-4 py-2.5 rounded-lg border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  Clear all
                </button>
              )}
              <button
                type="button"
                onClick={() => setFiltersOpen(false)}
                className="flex-1 px-4 py-2.5 rounded-lg text-white text-sm font-medium"
                style={{ backgroundColor: '#239459' }}
              >
                Show {filteredProducts.length} product{filteredProducts.length === 1 ? '' : 's'}
              </button>
            </div>
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
}

export default HomeMarketplaceProducts;
