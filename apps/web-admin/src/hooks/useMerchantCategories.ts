'use client';

import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { QUERY_KEYS, SHARED_QUERY_DEFAULTS } from '@encreasl/client-services';

export type MerchantCategoryDoc = {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  displayOrder: number;
  isActive: boolean;
  isFeatured: boolean;
  icon: { id: number; url: string | null } | null;
  merchantCount: number;
  createdAt: string;
  updatedAt: string;
};

export type MerchantCategoryPagination = {
  page: number;
  limit: number;
  totalDocs: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
};

export type MerchantCategoryStats = {
  total: number;
  activeCount: number;
  featuredCount: number;
  inactiveCount: number;
  filteredCount: number;
};

export type MerchantCategoriesResponse = {
  docs: MerchantCategoryDoc[];
  pagination: MerchantCategoryPagination | null;
  stats: MerchantCategoryStats | null;
};

async function fetchMerchantCategories(qs: string, signal?: AbortSignal): Promise<MerchantCategoriesResponse> {
  const res = await fetch(`/api/merchant-categories?${qs}`, { signal, cache: 'no-store' });
  if (!res.ok) {
    const text = await res.text();
    try {
      const j = JSON.parse(text);
      throw new Error(j.error || 'Failed to load merchant categories');
    } catch {
      throw new Error(text || 'Failed to load merchant categories');
    }
  }
  return res.json() as Promise<MerchantCategoriesResponse>;
}

/**
 * Merchant categories list query — 3-min instant-back.
 * Query key encodes page, limit, sort, search, and filters.
 */
export function useMerchantCategories(qs: string) {
  return useQuery({
    queryKey: QUERY_KEYS.adminMerchantCategories(qs),
    queryFn: ({ signal }) => fetchMerchantCategories(qs, signal),
    placeholderData: keepPreviousData,
    ...SHARED_QUERY_DEFAULTS,
  });
}