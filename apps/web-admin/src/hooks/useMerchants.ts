'use client';

import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { QUERY_KEYS, SHARED_QUERY_DEFAULTS } from '@encreasl/client-services';

export type MerchantDoc = {
  id: number;
  outletName: string;
  outletCode: string;
  vendor: { id: number; businessName: string; verificationStatus: string; businessType: string; isActive: boolean; logo: { id: number; url: string | null } | null } | null;
  contactInfo: { phone?: string; email?: string; managerName?: string; managerPhone?: string } | null;
  isActive: boolean;
  isAcceptingOrders: boolean;
  operationalStatus: string;
  timezone: string;
  merchant_categories: { id: number; name: string }[];
  activeAddress: { id: number; formatted_address: string } | null;
  media: { thumbnail: { id: number; url: string | null } | null; storeFrontImage: any } | null;
  createdAt: string;
  updatedAt: string;
};

export type MerchantPagination = {
  page: number;
  limit: number;
  totalDocs: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
};

export type MerchantStats = {
  totalMerchants: number;
  totalVendors: number;
  activeMerchants: number;
  acceptingOrders: number;
  activeVendors: number;
  operationalBreakdown: Record<string, number>;
  filteredCount: number;
};

export type MerchantsResponse = {
  docs: MerchantDoc[];
  pagination: MerchantPagination | null;
  stats: MerchantStats | null;
};

async function fetchMerchants(qs: string, signal?: AbortSignal): Promise<MerchantsResponse> {
  const res = await fetch(`/api/merchants?${qs}`, { signal, cache: 'no-store' });
  if (!res.ok) {
    const text = await res.text();
    try {
      const j = JSON.parse(text);
      throw new Error(j.error || 'Failed to load merchants');
    } catch {
      throw new Error(text || 'Failed to load merchants');
    }
  }
  return res.json() as Promise<MerchantsResponse>;
}

/**
 * Merchants list query — 3-min instant-back.
 * Query key encodes page, limit, sort, search, and filters.
 */
export function useMerchants(qs: string) {
  return useQuery({
    queryKey: QUERY_KEYS.adminMerchants(qs),
    queryFn: ({ signal }) => fetchMerchants(qs, signal),
    placeholderData: keepPreviousData,
    ...SHARED_QUERY_DEFAULTS,
  });
}