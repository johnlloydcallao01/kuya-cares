'use client';

import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { QUERY_KEYS } from '@encreasl/client-services';
import type { VendorReportsData } from '@/lib/reports-types';

async function fetchMerchantReports(range: string, signal?: AbortSignal): Promise<VendorReportsData> {
  const res = await fetch(`/api/reports?range=${range}`, { signal });
  if (!res.ok) throw new Error('Failed to load reports');
  return res.json() as Promise<VendorReportsData>;
}

/**
 * Merchant reports query — 3-min instant-back.
 * Query key encodes the range.
 * Backed by the Redis-cached CMS /api/vendor/reports endpoint.
 */
export function useMerchantReports(range: string) {
  return useQuery({
    queryKey: QUERY_KEYS.merchantReports(range),
    queryFn: ({ signal }) => fetchMerchantReports(range, signal),
    placeholderData: keepPreviousData,
    staleTime: 3 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    retry: 1,
    refetchOnWindowFocus: false,
  });
}