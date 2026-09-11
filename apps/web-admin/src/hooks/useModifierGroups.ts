'use client';

import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { QUERY_KEYS, SHARED_QUERY_DEFAULTS } from '@encreasl/client-services';

export type ModifierGroupDoc = {
  id: number;
  product_id: { id: number; name: string; slug: string } | number | null;
  product: { id: number; name: string; slug: string } | number | null;
  name: string;
  selection_type: string;
  is_required: boolean;
  min_selections: number;
  max_selections: number | null;
  sort_order: number;
  createdAt: string;
  updatedAt: string;
};

export type ModifierGroupPagination = {
  page: number;
  limit: number;
  totalDocs: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
};

export type ModifierGroupStats = {
  total: number;
  totalAll: number;
  filteredTotal: number;
  selectionBreakdown: Record<string, number>;
  requiredCount: number;
  optionalCount: number;
};

export type ModifierGroupsResponse = {
  docs: ModifierGroupDoc[];
  pagination: ModifierGroupPagination | null;
  stats: ModifierGroupStats | null;
};

async function fetchModifierGroups(qs: string, signal?: AbortSignal): Promise<ModifierGroupsResponse> {
  const res = await fetch(`/api/catalog/modifier-groups?${qs}`, { signal, cache: 'no-store' });
  if (!res.ok) {
    const text = await res.text();
    try {
      const j = JSON.parse(text);
      throw new Error(j.error || 'Failed to load modifier groups');
    } catch {
      throw new Error(text || 'Failed to load modifier groups');
    }
  }
  return res.json() as Promise<ModifierGroupsResponse>;
}

/**
 * Catalog modifier groups list query — 3-min instant-back.
 * Query key encodes page, limit, sort, search, and filters.
 */
export function useModifierGroups(qs: string) {
  return useQuery({
    queryKey: QUERY_KEYS.adminCatalogModifierGroups(qs),
    queryFn: ({ signal }) => fetchModifierGroups(qs, signal),
    placeholderData: keepPreviousData,
    ...SHARED_QUERY_DEFAULTS,
  });
}