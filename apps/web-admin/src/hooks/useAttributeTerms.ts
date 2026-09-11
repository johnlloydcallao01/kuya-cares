'use client';

import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { QUERY_KEYS, SHARED_QUERY_DEFAULTS } from '@encreasl/client-services';

export type AttributeTermDoc = {
  id: number;
  attribute_id: number | null;
  attribute: { id: number; name: string; slug: string; type: string } | null;
  name: string;
  slug: string;
  value: string | null;
  sort_order: number;
  is_active: boolean;
  createdAt: string;
  updatedAt: string;
};

export type AttributeOption = { id: number; name: string; slug: string; type: string };

export type AttributeTermPagination = {
  page: number;
  limit: number;
  totalDocs: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
};

export type AttributeTermStats = {
  total: number;
  totalAll: number;
  filteredTotal: number;
  perAttribute: Record<string, number>;
  activeCount: number;
  inactiveCount: number;
  globalActive?: number;
  globalInactive?: number;
};

export type AttributeTermsResponse = {
  docs: AttributeTermDoc[];
  pagination: AttributeTermPagination | null;
  stats: AttributeTermStats | null;
};

async function fetchAttributeTerms(qs: string, signal?: AbortSignal): Promise<AttributeTermsResponse> {
  const res = await fetch(`/api/catalog/attribute-terms?${qs}`, { signal, cache: 'no-store' });
  if (!res.ok) {
    const text = await res.text();
    try {
      const j = JSON.parse(text);
      throw new Error(j.error || 'Failed to load attribute terms');
    } catch {
      throw new Error(text || 'Failed to load attribute terms');
    }
  }
  return res.json() as Promise<AttributeTermsResponse>;
}

/**
 * Catalog attribute terms list query — 3-min instant-back.
 * Query key encodes page, limit, sort, search, and filters.
 */
export function useAttributeTerms(qs: string) {
  return useQuery({
    queryKey: QUERY_KEYS.adminCatalogAttributeTerms(qs),
    queryFn: ({ signal }) => fetchAttributeTerms(qs, signal),
    placeholderData: keepPreviousData,
    ...SHARED_QUERY_DEFAULTS,
  });
}