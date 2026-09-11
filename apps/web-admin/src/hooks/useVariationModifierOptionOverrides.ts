'use client';

import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { QUERY_KEYS, SHARED_QUERY_DEFAULTS } from '@encreasl/client-services';

export type VariationModifierOptionOverrideDoc = {
  id: number;
  variation_id: { id: number; name: string | null; sku: string } | number | null;
  variation: { id: number; name: string | null; sku: string } | number | null;
  base_modifier_option_id: { id: number; name: string } | number | null;
  base_modifier_option: { id: number; name: string } | number | null;
  mode: string;
  name_override: string | null;
  price_adjustment_override: number | null;
  default_behavior: string;
  availability_behavior: string;
  sort_order_override: number | null;
  is_active: boolean;
  createdAt: string;
  updatedAt: string;
};

export type VariationModifierOptionOverridePagination = {
  page: number;
  limit: number;
  totalDocs: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
};

export type VariationModifierOptionOverrideStats = {
  total: number;
  totalAll: number;
  filteredTotal: number;
  modeBreakdown: Record<string, number>;
  defaultBehaviorBreakdown: Record<string, number>;
  availabilityBreakdown: Record<string, number>;
  activeCount: number;
  inactiveCount: number;
};

export type VariationModifierOptionOverridesResponse = {
  docs: VariationModifierOptionOverrideDoc[];
  pagination: VariationModifierOptionOverridePagination | null;
  stats: VariationModifierOptionOverrideStats | null;
};

async function fetchVariationModifierOptionOverrides(qs: string, signal?: AbortSignal): Promise<VariationModifierOptionOverridesResponse> {
  const res = await fetch(`/api/catalog/variation-modifier-option-overrides?${qs}`, { signal, cache: 'no-store' });
  if (!res.ok) {
    const text = await res.text();
    try {
      const j = JSON.parse(text);
      throw new Error(j.error || 'Failed to load variation modifier option overrides');
    } catch {
      throw new Error(text || 'Failed to load variation modifier option overrides');
    }
  }
  return res.json() as Promise<VariationModifierOptionOverridesResponse>;
}

/**
 * Catalog variation modifier option overrides list query — 3-min instant-back.
 * Query key encodes page, limit, sort, search, and filters.
 */
export function useVariationModifierOptionOverrides(qs: string) {
  return useQuery({
    queryKey: QUERY_KEYS.adminCatalogVariationModifierOptionOverrides(qs),
    queryFn: ({ signal }) => fetchVariationModifierOptionOverrides(qs, signal),
    placeholderData: keepPreviousData,
    ...SHARED_QUERY_DEFAULTS,
  });
}