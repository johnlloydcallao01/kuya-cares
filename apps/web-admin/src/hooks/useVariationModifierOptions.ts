'use client';

import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { QUERY_KEYS, SHARED_QUERY_DEFAULTS } from '@encreasl/client-services';

export type VariationModifierOptionDoc = {
  id: number;
  variation_modifier_group_id: { id: number; name: string } | number | null;
  variation_modifier_group: { id: number; name: string } | number | null;
  name: string;
  price_adjustment: number;
  is_default: boolean;
  is_available: boolean;
  sort_order: number;
  createdAt: string;
  updatedAt: string;
};

export type VariationModifierOptionPagination = {
  page: number;
  limit: number;
  totalDocs: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
};

export type VariationModifierOptionStats = {
  total: number;
  totalAll: number;
  filteredTotal: number;
  availableCount: number;
  unavailableCount: number;
  defaultCount: number;
};

export type VariationModifierOptionsResponse = {
  docs: VariationModifierOptionDoc[];
  pagination: VariationModifierOptionPagination | null;
  stats: VariationModifierOptionStats | null;
};

async function fetchVariationModifierOptions(qs: string, signal?: AbortSignal): Promise<VariationModifierOptionsResponse> {
  const res = await fetch(`/api/catalog/variation-modifier-options?${qs}`, { signal, cache: 'no-store' });
  if (!res.ok) {
    const text = await res.text();
    try {
      const j = JSON.parse(text);
      throw new Error(j.error || 'Failed to load variation modifier options');
    } catch {
      throw new Error(text || 'Failed to load variation modifier options');
    }
  }
  return res.json() as Promise<VariationModifierOptionsResponse>;
}

/**
 * Catalog variation modifier options list query — 3-min instant-back.
 * Query key encodes page, limit, sort, search, and filters.
 */
export function useVariationModifierOptions(qs: string) {
  return useQuery({
    queryKey: QUERY_KEYS.adminCatalogVariationModifierOptions(qs),
    queryFn: ({ signal }) => fetchVariationModifierOptions(qs, signal),
    placeholderData: keepPreviousData,
    ...SHARED_QUERY_DEFAULTS,
  });
}