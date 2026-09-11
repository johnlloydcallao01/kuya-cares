'use client';

import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { QUERY_KEYS, SHARED_QUERY_DEFAULTS } from '@encreasl/client-services';

export type VendorGroup = {
  vendor: { id: number; businessName: string; legalName: string; businessType: string; verificationStatus: string; isActive: boolean; logo: { id: number; url: string | null } | null };
  totalMerchants: number;
  totalProducts: number;
  totalProductsFiltered: number;
};

export type MerchantProductPagination = {
  page: number;
  limit: number;
  totalDocs: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
};

export type MerchantProductStats = {
  totalVendors: number;
  totalMerchants: number;
  totalMerchantProducts: number;
  activeMerchants: number;
  filteredVendors: number;
  totalProducts: number;
};

export type MerchantProductsResponse = {
  vendors: VendorGroup[];
  pagination: MerchantProductPagination | null;
  stats: MerchantProductStats | null;
};

async function fetchMerchantProducts(qs: string, signal?: AbortSignal): Promise<MerchantProductsResponse> {
  const res = await fetch(`/api/merchant-products?${qs}`, { signal, cache: 'no-store' });
  if (!res.ok) {
    const text = await res.text();
    try {
      const j = JSON.parse(text);
      throw new Error(j.error || 'Failed to load merchant products');
    } catch {
      throw new Error(text || 'Failed to load merchant products');
    }
  }
  return res.json() as Promise<MerchantProductsResponse>;
}

/**
 * Merchant products (vendor-encapsulated) list query — 3-min instant-back.
 * Query key encodes page, limit, sort, search, and filters.
 */
export function useMerchantProducts(qs: string) {
  return useQuery({
    queryKey: QUERY_KEYS.adminMerchantProducts(qs),
    queryFn: ({ signal }) => fetchMerchantProducts(qs, signal),
    placeholderData: keepPreviousData,
    ...SHARED_QUERY_DEFAULTS,
  });
}