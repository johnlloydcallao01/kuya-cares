'use client';

import { useQuery } from '@tanstack/react-query';
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
  view?: 'merchant' | 'vendor' | 'all';
  selectedVendor?: VendorGroup['vendor'] | null;
  docs?: MerchantProductRow[];
  allViewStats?: {
    totalAssignments: number;
    activeAssignments: number;
    filteredAssignments: number;
  };
  vendors?: VendorGroup[];
  pagination: MerchantProductPagination | null;
  stats?: MerchantProductStats | null;
};

export type MerchantProductRow = {
  id: number;
  merchantProductId: number;
  createdAt: string;
  priceOverride: number | null;
  stockQuantity: number | null;
  isActive: boolean;
  isAvailable: boolean;
  product: {
    id: number;
    name: string;
    slug: string;
    sku: string | null;
    productType: string;
    approvalStatus: string;
    basePrice: number | null;
    primaryImage: { id: number; url: string | null } | null;
  } | null;
  merchant: {
    id: number;
    outletName: string;
    outletCode: string;
    isActive: boolean;
    operationalStatus: string;
  } | null;
  vendor: { id: number; businessName: string } | null;
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
  const currentView = new URLSearchParams(qs).get('view') ?? 'merchant';
  const currentVendor = new URLSearchParams(qs).get('vendor');
  return useQuery({
    queryKey: QUERY_KEYS.adminMerchantProducts(qs),
    queryFn: ({ signal }) => fetchMerchantProducts(qs, signal),
    placeholderData: (previousData, previousQuery) => {
      const previousParams = typeof previousQuery?.queryKey[2] === 'string'
        ? new URLSearchParams(previousQuery.queryKey[2])
        : null;
      return previousParams?.get('view') === currentView &&
        previousParams?.get('vendor') === currentVendor
        ? previousData
        : undefined;
    },
    ...SHARED_QUERY_DEFAULTS,
  });
}