'use client';

import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { QUERY_KEYS, SHARED_QUERY_DEFAULTS } from '@encreasl/client-services';
import type { AnalyticsData } from '@/lib/analytics-types';

async function fetchAnalytics(qs: string, signal?: AbortSignal): Promise<AnalyticsData> {
  const res = await fetch(`/api/analytics?${qs}`, { signal });
  if (!res.ok) throw new Error('Failed to load analytics');
  return res.json() as Promise<AnalyticsData>;
}

/**
 * Analytics query — same 3-min instant-back philosophy as overview.
 * qs encodes range + search + filters, so each combination caches separately.
 * placeholderData keeps the previous slice visible while the new one loads
 * (no focus loss, no full skeleton on filter change).
 */
export function useAnalytics(qs: string) {
  return useQuery({
    queryKey: QUERY_KEYS.adminAnalytics(qs),
    queryFn: ({ signal }) => fetchAnalytics(qs, signal),
    placeholderData: keepPreviousData,
    ...SHARED_QUERY_DEFAULTS,
  });
}
