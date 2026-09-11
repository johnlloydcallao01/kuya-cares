'use client';

import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { QUERY_KEYS, SHARED_QUERY_DEFAULTS } from '@encreasl/client-services';

export type VariationDoc = {
  id: number;
  product_id: { id: number; name: string; slug: string; productType: string } | number | null;
  product?: { id: number; name: string; slug: string } | number | null;
  modifier_behavior_mode: string;
  name: string | null;
  short_description: string | null;
  image: { id: number; url: string | null; filename: string | null } | null;
  sku: string;
  base_price: number | null;
  compare_at_price: number | null;
  stock_quantity: number;
  is_visible: boolean;
  is_used_for_variations: boolean;
  sort_order: number;
  createdAt: string;
  updatedAt: string;
};

export type VariationPagination = {
  page: number;
  limit: number;
  totalDocs: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
};

export type VariationStats = {
  total: number;
  totalAll: number;
  filteredTotal: number;
  modeBreakdown: Record<string, number>;
  inStock: number;
  outOfStock: number;
  visibleCount: number;
  hiddenCount: number;
};

export type VariationsResponse = {
  docs: VariationDoc[];
  pagination: VariationPagination | null;
  stats: VariationStats | null;
};

async function fetchVariations(qs: string, signal?: AbortSignal): Promise<VariationsResponse> {
  const res = await fetch(`/api/catalog/variations?${qs}`, { signal, cache: 'no-store' });
  if (!res.ok) {
    const text = await res.text();
    try {
      const j = JSON.parse(text);
      throw new Error(j.error || 'Failed to load variations');
    } catch {
      throw new Error(text || 'Failed to load variations');
    }
  }
  return res.json() as Promise<VariationsResponse>;
}

/**
 * Catalog variations list query — 3-min instant-back.
 * Query key encodes page, limit, sort, search, and filters.
 */
export function useVariations(qs: string) {
  return useQuery({
    queryKey: QUERY_KEYS.adminCatalogVariations(qs),
    queryFn: ({ signal }) => fetchVariations(qs, signal),
    placeholderData: keepPreviousData,
    ...SHARED_QUERY_DEFAULTS,
  });
}

async function fetchProductOptions(signal?: AbortSignal): Promise<{ id: number; name: string }[]> {
  const res = await fetch('/api/products?limit=100', { signal });
  if (!res.ok) throw new Error('Failed to load products');
  const j = await res.json();
  const docsArr: any[] = j.docs || [];
  const variableOnly = docsArr.filter((d: any) => String(d.productType || '').toLowerCase() === 'variable');
  return variableOnly.map((d: any) => ({ id: d.id, name: d.name || `#${d.id}` }));
}

/**
 * Variable products for the variations filter dropdown — cached via TanStack.
 */
export function useVariationProductOptions() {
  return useQuery({
    queryKey: QUERY_KEYS.adminProducts('variation-options'),
    queryFn: ({ signal }) => fetchProductOptions(signal),
    ...SHARED_QUERY_DEFAULTS,
  });
}