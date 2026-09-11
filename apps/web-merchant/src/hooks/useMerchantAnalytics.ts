'use client';

import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { QUERY_KEYS } from '@encreasl/client-services';
import type { VendorAnalyticsData } from '@/lib/analytics-types';

async function fetchMerchantAnalytics(qs: string, signal?: AbortSignal): Promise<VendorAnalyticsData> {
  const res = await fetch(`/api/analytics?${qs}`, { signal });
  if (!res.ok) throw new Error('Failed to load analytics');
  return res.json() as Promise<VendorAnalyticsData>;
}

/**
 * Merchant analytics query — 3-min instant-back.
 * Query key encodes range, search, and filters.
 * Backed by the Redis-cached CMS /api/vendor/analytics endpoint.
 */
export function useMerchantAnalytics(qs: string) {
  return useQuery({
    queryKey: QUERY_KEYS.merchantAnalytics(qs),
    queryFn: ({ signal }) => fetchMerchantAnalytics(qs, signal),
    placeholderData: keepPreviousData,
    staleTime: 3 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    retry: 1,
    refetchOnWindowFocus: false,
  });
}