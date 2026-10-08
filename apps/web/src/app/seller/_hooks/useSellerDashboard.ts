'use client';

import { useQuery } from '@tanstack/react-query';
import { SHARED_QUERY_DEFAULTS } from '@encreasl/client-services';
import type {
  MerchantChartsGroup,
  MerchantMetricsGroup,
  MerchantTablesGroup,
} from '@/app/seller/_lib/dashboard-types';

async function fetchSellerDashboardGroup<T>(
  group: 'metrics' | 'charts' | 'tables',
  signal?: AbortSignal,
): Promise<T> {
  const response = await fetch(`/api/seller-dashboard/${group}`, { signal });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error || 'Failed to load dashboard');
  }
  return response.json() as Promise<T>;
}

export function useSellerDashboardMetrics() {
  return useQuery({
    queryKey: ['seller', 'dashboard', 'v2', 'metrics'],
    queryFn: ({ signal }) => fetchSellerDashboardGroup<MerchantMetricsGroup>('metrics', signal),
    ...SHARED_QUERY_DEFAULTS,
    staleTime: 60 * 1000,
  });
}

export function useSellerDashboardCharts() {
  return useQuery({
    queryKey: ['seller', 'dashboard', 'v2', 'charts'],
    queryFn: ({ signal }) => fetchSellerDashboardGroup<MerchantChartsGroup>('charts', signal),
    ...SHARED_QUERY_DEFAULTS,
    staleTime: 5 * 60 * 1000,
  });
}

export function useSellerDashboardTables() {
  return useQuery({
    queryKey: ['seller', 'dashboard', 'v2', 'tables'],
    queryFn: ({ signal }) => fetchSellerDashboardGroup<MerchantTablesGroup>('tables', signal),
    ...SHARED_QUERY_DEFAULTS,
    staleTime: 30 * 1000,
  });
}
