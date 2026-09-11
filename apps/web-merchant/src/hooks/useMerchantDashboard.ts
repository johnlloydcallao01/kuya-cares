'use client';

import { useQuery } from '@tanstack/react-query';
import { QUERY_KEYS, SHARED_QUERY_DEFAULTS } from '@encreasl/client-services';
import type { MerchantDashboardData } from '@/lib/dashboard-types';

async function fetchMerchantDashboard(signal?: AbortSignal): Promise<MerchantDashboardData> {
  const res = await fetch('/api/merchant-dashboard', { signal });
  if (!res.ok) {
    const text = await res.text();
    try {
      const j = JSON.parse(text);
      throw new Error(j.error || 'Failed to load dashboard');
    } catch {
      throw new Error(text || 'Failed to load dashboard');
    }
  }
  return res.json() as Promise<MerchantDashboardData>;
}

/**
 * Merchant dashboard overview query — 3-min instant-back.
 * Backed by the Redis-cached CMS /api/merchant/dashboard endpoint.
 */
export function useMerchantDashboard() {
  return useQuery({
    queryKey: QUERY_KEYS.merchantDashboard(),
    queryFn: ({ signal }) => fetchMerchantDashboard(signal),
    ...SHARED_QUERY_DEFAULTS,
  });
}
