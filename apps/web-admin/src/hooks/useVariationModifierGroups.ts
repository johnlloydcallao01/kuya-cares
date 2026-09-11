'use client';

import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { QUERY_KEYS, SHARED_QUERY_DEFAULTS } from '@encreasl/client-services';

export type VariationModifierGroupDoc = {
  id: number;
  variation_id: { id: number; name: string | null; sku: string } | number | null;
  variation: { id: number; name: string | null; sku: string } | number | null;
  name: string;
  selection_type: string;
  is_required: boolean;
  min_selections: number;
  max_selections: number | null;
  sort_order: number;
  is_active: boolean;
  createdAt: string;
  updatedAt: string;
};

export type VariationModifierGroupPagination = {
  page: number;
  limit: number;
  totalDocs: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
};

export type VariationModifierGroupStats = {
  total: number;
  totalAll: number;
  filteredTotal: number;
  selectionBreakdown: Record<string, number>;
  requiredCount: number;
  optionalCount: number;
  activeCount: number;
  inactiveCount: number;
};

export type VariationModifierGroupsResponse = {
  docs: VariationModifierGroupDoc[];
  pagination: VariationModifierGroupPagination | null;
  stats: VariationModifierGroupStats | null;
};

async function fetchVariationModifierGroups(qs: string, signal?: AbortSignal): Promise<VariationModifierGroupsResponse> {
  const res = await fetch(`/api/catalog/variation-modifier-groups?${qs}`, { signal, cache: 'no-store' });
  if (!res.ok) {
    const text = await res.text();
    try {
      const j = JSON.parse(text);
      throw new Error(j.error || 'Failed to load variation modifier groups');
    } catch {
      throw new Error(text || 'Failed to load variation modifier groups');
    }
  }
  return res.json() as Promise<VariationModifierGroupsResponse>;
}

/**
 * Catalog variation modifier groups list query — 3-min instant-back.
 * Query key encodes page, limit, sort, search, and filters.
 */
export function useVariationModifierGroups(qs: string) {
  return useQuery({
    queryKey: QUERY_KEYS.adminCatalogVariationModifierGroups(qs),
    queryFn: ({ signal }) => fetchVariationModifierGroups(qs, signal),
    placeholderData: keepPreviousData,
    ...SHARED_QUERY_DEFAULTS,
  });
}