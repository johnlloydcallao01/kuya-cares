'use client';

import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { QUERY_KEYS, SHARED_QUERY_DEFAULTS } from '@encreasl/client-services';

export type OverrideDoc = {
  id: number;
  merchant_product_id: { id: number; display_title: string | null } | number | null;
  merchant_product: { id: number; display_title: string | null } | number | null;
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

export type MerchantProductModifierGroupOverridePagination = {
  page: number;
  limit: number;
  totalDocs: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
};

export type MerchantProductModifierGroupOverrideStats = {
  total: number;
  totalAll: number;
  filteredTotal: number;
  modeBreakdown: Record<string, number>;
  requiredBehaviorBreakdown: Record<string, number>;
  activeCount: number;
  inactiveCount: number;
};

export type MerchantProductModifierGroupOverridesResponse = {
  docs: OverrideDoc[];
  pagination: MerchantProductModifierGroupOverridePagination | null;
  stats: MerchantProductModifierGroupOverrideStats | null;
};

async function fetchMerchantProductModifierGroupOverrides(qs: string, signal?: AbortSignal): Promise<MerchantProductModifierGroupOverridesResponse> {
  const res = await fetch(`/api/catalog/merchant-product-modifier-group-overrides?${qs}`, { signal, cache: 'no-store' });
  if (!res.ok) {
    const text = await res.text();
    try {
      const j = JSON.parse(text);
      throw new Error(j.error || 'Failed to load merchant product modifier group overrides');
    } catch {
      throw new Error(text || 'Failed to load merchant product modifier group overrides');
    }
  }
  return res.json() as Promise<MerchantProductModifierGroupOverridesResponse>;
}

/**
 * Catalog merchant product modifier group overrides list query — 3-min instant-back.
 * Query key encodes page, limit, sort, search, and filters.
 */
export function useMerchantProductModifierGroupOverrides(qs: string) {
  return useQuery({
    queryKey: QUERY_KEYS.adminCatalogMerchantProductModifierGroupOverrides(qs),
    queryFn: ({ signal }) => fetchMerchantProductModifierGroupOverrides(qs, signal),
    placeholderData: keepPreviousData,
    ...SHARED_QUERY_DEFAULTS,
  });
}
