'use client';

import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { QUERY_KEYS, SHARED_QUERY_DEFAULTS } from '@encreasl/client-services';

export type OverrideDoc = {
  id: number;
  merchant_product_id: { id: number; display_title: string | null } | number | null;
  merchant_product: { id: number; display_title: string | null } | number | null;
  variation_id: { id: number; name: string | null; sku: string } | number | null;
  variation: { id: number; name: string | null; sku: string } | number | null;
  target_option_source: string;
  base_modifier_option_id: { id: number; name: string } | number | null;
  base_modifier_option: { id: number; name: string } | number | null;
  variation_modifier_option_id: { id: number; name: string } | number | null;
  variation_modifier_option: { id: number; name: string } | number | null;
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

export type Pagination = {
  page: number;
  limit: number;
  totalDocs: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
};

export type Stats = {
  total: number;
  totalAll: number;
  filteredTotal: number;
  modeBreakdown: Record<string, number>;
  sourceBreakdown: Record<string, number>;
  activeCount: number;
  inactiveCount: number;
};

export type MerchantVariationModifierOptionOverridesResponse = {
  docs: OverrideDoc[];
  pagination: Pagination | null;
  stats: Stats | null;
};

async function fetchMerchantVariationModifierOptionOverrides(qs: string, signal?: AbortSignal): Promise<MerchantVariationModifierOptionOverridesResponse> {
  const res = await fetch(`/api/catalog/merchant-variation-modifier-option-overrides?${qs}`, { signal, cache: 'no-store' });
  if (!res.ok) {
    const text = await res.text();
    try {
      const j = JSON.parse(text);
      throw new Error(j.error || 'Failed to load merchant variation modifier option overrides');
    } catch {
      throw new Error(text || 'Failed to load merchant variation modifier option overrides');
    }
  }
  return res.json() as Promise<MerchantVariationModifierOptionOverridesResponse>;
}

export function useMerchantVariationModifierOptionOverrides(qs: string) {
  return useQuery({
    queryKey: QUERY_KEYS.adminCatalogMerchantVariationModifierOptionOverrides(qs),
    queryFn: ({ signal }) => fetchMerchantVariationModifierOptionOverrides(qs, signal),
    placeholderData: keepPreviousData,
    ...SHARED_QUERY_DEFAULTS,
  });
}
