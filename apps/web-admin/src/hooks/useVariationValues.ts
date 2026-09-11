'use client';

import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { QUERY_KEYS, SHARED_QUERY_DEFAULTS } from '@encreasl/client-services';

export type VariationValueDoc = {
  id: number;
  variation_id: number | null;
  variation: { id: number; sku: string; name: string | null; product: { id: number; name: string; slug: string; productType: string } | number | null } | null;
  variationBrief?: { id: number; sku: string; name: string | null; product: any } | null;
  attribute_id: number | null;
  attribute: { id: number; name: string; slug: string; type: string } | null;
  term_id: number | null;
  term: { id: number; name: string; slug: string; value: string | null } | null;
  createdAt: string;
  updatedAt: string;
};

export type VariationValuePagination = {
  page: number;
  limit: number;
  totalDocs: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
};

export type VariationValueStats = {
  total: number;
  totalAll: number;
  filteredTotal: number;
  perVariation: Record<string, number>;
  perAttribute: Record<string, number>;
  perTerm: Record<string, number>;
};

export type VariationValuesResponse = {
  docs: VariationValueDoc[];
  pagination: VariationValuePagination | null;
  stats: VariationValueStats | null;
};

async function fetchVariationValues(qs: string, signal?: AbortSignal): Promise<VariationValuesResponse> {
  const res = await fetch(`/api/catalog/variation-values?${qs}`, { signal, cache: 'no-store' });
  if (!res.ok) {
    const text = await res.text();
    try {
      const j = JSON.parse(text);
      throw new Error(j.error || 'Failed to load variation values');
    } catch {
      throw new Error(text || 'Failed to load variation values');
    }
  }
  return res.json() as Promise<VariationValuesResponse>;
}

/**
 * Catalog variation values list query — 3-min instant-back.
 * Query key encodes page, limit, sort, search, and filters.
 */
export function useVariationValues(qs: string) {
  return useQuery({
    queryKey: QUERY_KEYS.adminCatalogVariationValues(qs),
    queryFn: ({ signal }) => fetchVariationValues(qs, signal),
    placeholderData: keepPreviousData,
    ...SHARED_QUERY_DEFAULTS,
  });
}