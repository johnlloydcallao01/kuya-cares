'use client';

import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { QUERY_KEYS, SHARED_QUERY_DEFAULTS } from '@encreasl/client-services';

export type ModifierOptionDoc = {
  id: number;
  modifier_group_id: { id: number; name: string } | number | null;
  modifier_group: { id: number; name: string } | number | null;
  name: string;
  price_adjustment: number;
  is_default: boolean;
  is_available: boolean;
  sort_order: number;
  createdAt: string;
  updatedAt: string;
};

export type ModifierOptionPagination = {
  page: number;
  limit: number;
  totalDocs: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
};

export type ModifierOptionStats = {
  total: number;
  totalAll: number;
  filteredTotal: number;
  availableCount: number;
  unavailableCount: number;
  defaultCount: number;
};

export type ModifierOptionsResponse = {
  docs: ModifierOptionDoc[];
  pagination: ModifierOptionPagination | null;
  stats: ModifierOptionStats | null;
};

async function fetchModifierOptions(qs: string, signal?: AbortSignal): Promise<ModifierOptionsResponse> {
  const res = await fetch(`/api/catalog/modifier-options?${qs}`, { signal, cache: 'no-store' });
  if (!res.ok) {
    const text = await res.text();
    try {
      const j = JSON.parse(text);
      throw new Error(j.error || 'Failed to load modifier options');
    } catch {
      throw new Error(text || 'Failed to load modifier options');
    }
  }
  return res.json() as Promise<ModifierOptionsResponse>;
}

/**
 * Catalog modifier options list query — 3-min instant-back.
 * Query key encodes page, limit, sort, search, and filters.
 */
export function useModifierOptions(qs: string) {
  return useQuery({
    queryKey: QUERY_KEYS.adminCatalogModifierOptions(qs),
    queryFn: ({ signal }) => fetchModifierOptions(qs, signal),
    placeholderData: keepPreviousData,
    ...SHARED_QUERY_DEFAULTS,
  });
}