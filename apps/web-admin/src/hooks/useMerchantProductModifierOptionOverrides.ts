'use client';

import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { QUERY_KEYS, SHARED_QUERY_DEFAULTS } from '@encreasl/client-services';

export type OverrideDoc = {
  id: number;
  merchant_product_id: { id: number; display_title: string | null } | number | null;
  merchant_product: { id: number; display_title: string | null } | number | null;
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

export type MerchantProductModifierOptionOverridePagination = {
  page: number;
  limit: number;
  totalDocs: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
};

export type MerchantProductModifierOptionOverrideStats = {
  total: number;
  totalAll: number;
  filteredTotal: number;
  modeBreakdown: Record<string, number>;
  defaultBehaviorBreakdown: Record<string, number>;
  availabilityBreakdown: Record<string, number>;
  activeCount: number;
  inactiveCount: number;
};

export type MerchantProductModifierOptionOverridesResponse = {
  docs: OverrideDoc[];
  pagination: MerchantProductModifierOptionOverridePagination | null;
  stats: MerchantProductModifierOptionOverrideStats | null;
};

async function fetchMerchantProductModifierOptionOverrides(qs: string, signal?: AbortSignal): Promise<MerchantProductModifierOptionOverridesResponse> {
  const res = await fetch(`/api/catalog/merchant-product-modifier-option-overrides?${qs}`, { signal, cache: 'no-store' });
  if (!res.ok) {
    const text = await res.text();
    try {
      const j = JSON.parse(text);
      throw new Error(j.error || 'Failed to load merchant product modifier option overrides');
    } catch {
      throw new Error(text || 'Failed to load merchant product modifier option overrides');
    }
  }
  return res.json() as Promise<MerchantProductModifierOptionOverridesResponse>;
}

export function useMerchantProductModifierOptionOverrides(qs: string) {
  return useQuery({
    queryKey: QUERY_KEYS.adminCatalogMerchantProductModifierOptionOverrides(qs),
    queryFn: ({ signal }) => fetchMerchantProductModifierOptionOverrides(qs, signal),
    placeholderData: keepPreviousData,
    ...SHARED_QUERY_DEFAULTS,
  });
}
