'use client';

import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { QUERY_KEYS, SHARED_QUERY_DEFAULTS } from '@encreasl/client-services';

export type VariationModifierGroupOverrideDoc = {
  id: number;
  variation_id: { id: number; name: string | null; sku: string } | number | null;
  variation: { id: number; name: string | null; sku: string } | number | null;
  base_modifier_group_id: { id: number; name: string } | number | null;
  base_modifier_group: { id: number; name: string } | number | null;
  mode: string;
  name_override: string | null;
  selection_type_override: string | null;
  required_behavior: string;
  min_selections_override: number | null;
  max_selections_override: number | null;
  sort_order_override: number | null;
  is_active: boolean;
  createdAt: string;
  updatedAt: string;
};

export type VariationModifierGroupOverridePagination = {
  page: number;
  limit: number;
  totalDocs: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
};

export type VariationModifierGroupOverrideStats = {
  total: number;
  totalAll: number;
  filteredTotal: number;
  modeBreakdown: Record<string, number>;
  requiredBehaviorBreakdown: Record<string, number>;
  activeCount: number;
  inactiveCount: number;
};

export type VariationModifierGroupOverridesResponse = {
  docs: VariationModifierGroupOverrideDoc[];
  pagination: VariationModifierGroupOverridePagination | null;
  stats: VariationModifierGroupOverrideStats | null;
};

async function fetchVariationModifierGroupOverrides(qs: string, signal?: AbortSignal): Promise<VariationModifierGroupOverridesResponse> {
  const res = await fetch(`/api/catalog/variation-modifier-group-overrides?${qs}`, { signal, cache: 'no-store' });
  if (!res.ok) {
    const text = await res.text();
    try {
      const j = JSON.parse(text);
      throw new Error(j.error || 'Failed to load variation modifier group overrides');
    } catch {
      throw new Error(text || 'Failed to load variation modifier group overrides');
    }
  }
  return res.json() as Promise<VariationModifierGroupOverridesResponse>;
}

/**
 * Catalog variation modifier group overrides list query — 3-min instant-back.
 * Query key encodes page, limit, sort, search, and filters.
 */
export function useVariationModifierGroupOverrides(qs: string) {
  return useQuery({
    queryKey: QUERY_KEYS.adminCatalogVariationModifierGroupOverrides(qs),
    queryFn: ({ signal }) => fetchVariationModifierGroupOverrides(qs, signal),
    placeholderData: keepPreviousData,
    ...SHARED_QUERY_DEFAULTS,
  });
}