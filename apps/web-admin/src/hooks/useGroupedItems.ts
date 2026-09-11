'use client';

import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { QUERY_KEYS, SHARED_QUERY_DEFAULTS } from '@encreasl/client-services';

export type ProductBrief = { id: number; name: string; slug: string; productType: string };

export type GroupedItemDoc = {
  id: number;
  parent_product_id: ProductBrief | number | null;
  parent_product?: ProductBrief | null;
  child_product_id: ProductBrief | number | null;
  child_product?: ProductBrief | null;
  default_quantity: number;
  sort_order: number;
  createdAt: string;
  updatedAt: string;
};

export type GroupedItemPagination = {
  page: number;
  limit: number;
  totalDocs: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
};

export type GroupedItemStats = {
  total: number;
  totalAll: number;
  filteredTotal: number;
  perParent: Record<string, number>;
  totalGrouped: number;
};

export type GroupedItemsResponse = {
  docs: GroupedItemDoc[];
  pagination: GroupedItemPagination | null;
  stats: GroupedItemStats | null;
};

async function fetchGroupedItems(qs: string, signal?: AbortSignal): Promise<GroupedItemsResponse> {
  const res = await fetch(`/api/catalog/grouped-items?${qs}`, { signal, cache: 'no-store' });
  if (!res.ok) {
    const text = await res.text();
    try {
      const j = JSON.parse(text);
      throw new Error(j.error || 'Failed to load grouped items');
    } catch {
      throw new Error(text || 'Failed to load grouped items');
    }
  }
  return res.json() as Promise<GroupedItemsResponse>;
}

/**
 * Catalog grouped items list query — 3-min instant-back.
 * Query key encodes page, limit, sort, search, and parent/child filters.
 */
export function useGroupedItems(qs: string) {
  return useQuery({
    queryKey: QUERY_KEYS.adminCatalogGroupedItems(qs),
    queryFn: ({ signal }) => fetchGroupedItems(qs, signal),
    placeholderData: keepPreviousData,
    ...SHARED_QUERY_DEFAULTS,
  });
}