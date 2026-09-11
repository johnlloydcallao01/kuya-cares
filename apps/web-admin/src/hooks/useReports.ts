'use client';

import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { QUERY_KEYS, SHARED_QUERY_DEFAULTS } from '@encreasl/client-services';
import type { ReportsData } from '@/lib/reports-types';

async function fetchReports(range: string, signal?: AbortSignal): Promise<ReportsData> {
  const res = await fetch(`/api/reports?range=${range}`, { signal });
  if (!res.ok) throw new Error('Failed to load reports');
  return res.json() as Promise<ReportsData>;
}

/**
 * Reports query — 3-min instant-back.
 * Range changes keep previous slice via placeholderData while refetching.
 */
export function useReports(range: string) {
  return useQuery({
    queryKey: QUERY_KEYS.adminReports(range),
    queryFn: ({ signal }) => fetchReports(range, signal),
    placeholderData: keepPreviousData,
    ...SHARED_QUERY_DEFAULTS,
  });
}
