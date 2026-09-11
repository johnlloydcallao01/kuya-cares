'use client';

import { useQuery } from '@tanstack/react-query';
import { QUERY_KEYS, SHARED_QUERY_DEFAULTS } from '@encreasl/client-services';
import type { DashboardData } from '@/lib/dashboard-types';

async function fetchDashboard(signal?: AbortSignal): Promise<DashboardData> {
  const res = await fetch('/api/dashboard', { signal });
  if (!res.ok) throw new Error('Failed to load dashboard');
  return res.json() as Promise<DashboardData>;
}

/**
 * Dashboard overview query — 3-min instant-back.
 * Cached data renders instantly on back-nav (no skeleton);
 * background refetch only when stale. Reduces CMS + 6x payload.find hits.
 */
export function useDashboard() {
  return useQuery({
    queryKey: QUERY_KEYS.adminDashboard,
    queryFn: ({ signal }) => fetchDashboard(signal),
    ...SHARED_QUERY_DEFAULTS,
  });
}
