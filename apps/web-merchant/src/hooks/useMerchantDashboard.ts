'use client';

import { useQuery } from '@tanstack/react-query';
import { QUERY_KEYS, SHARED_QUERY_DEFAULTS } from '@encreasl/client-services';
import type {
  ActiveDelivery,
  DailyRevenue,
  MerchantDashboardData,
  MerchantDashboardMetrics,
  OrderStatusBreakdown,
  OutletStatus,
  PendingOrder,
  RecentOrder,
  TopProduct,
} from '@/lib/dashboard-types';

export interface MerchantMetricsGroup {
  metrics: MerchantDashboardMetrics;
  outlets: OutletStatus[];
}

export interface MerchantChartsGroup {
  revenueChart: DailyRevenue[];
  orderStatusChart: OrderStatusBreakdown[];
  topProducts: TopProduct[];
}

export interface MerchantTablesGroup {
  activeDeliveries: ActiveDelivery[];
  pendingOrders: PendingOrder[];
  recentOrders: RecentOrder[];
}

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

async function fetchMerchantDashboardGroup<T>(group: 'metrics' | 'charts' | 'tables', signal?: AbortSignal): Promise<T> {
  const res = await fetch(`/api/merchant-dashboard/${group}`, { signal });
  if (!res.ok) {
    const text = await res.text();
    try {
      const j = JSON.parse(text);
      throw new Error(j.error || 'Failed to load dashboard');
    } catch {
      throw new Error(text || 'Failed to load dashboard');
    }
  }
  return res.json() as Promise<T>;
}

/**
 * Merchant dashboard overview query — 3-min instant-back.
 * Backed by the Redis-cached CMS /api/merchant/dashboard endpoint.
 *
 * @deprecated Prefer the split hooks below (useMerchantDashboardMetrics,
 * useMerchantDashboardCharts, useMerchantDashboardTables) which fetch in
 * parallel and render progressively. Kept for backward compatibility.
 */
export function useMerchantDashboard() {
  return useQuery({
    queryKey: QUERY_KEYS.merchantDashboard(),
    queryFn: ({ signal }) => fetchMerchantDashboard(signal),
    ...SHARED_QUERY_DEFAULTS,
  });
}

/**
 * Split merchant overview queries — one React Query per group sharing the
 * same merchant-dashboard/ directory. Mounted together they fetch in
 * parallel; each widget renders as soon as its own group resolves
 * (no whole-page waterfall).
 */
export function useMerchantDashboardMetrics() {
  return useQuery({
    queryKey: QUERY_KEYS.merchantDashboardMetrics,
    queryFn: ({ signal }) => fetchMerchantDashboardGroup<MerchantMetricsGroup>('metrics', signal),
    ...SHARED_QUERY_DEFAULTS,
    staleTime: 60 * 1000,
  });
}

export function useMerchantDashboardCharts() {
  return useQuery({
    queryKey: QUERY_KEYS.merchantDashboardCharts,
    queryFn: ({ signal }) => fetchMerchantDashboardGroup<MerchantChartsGroup>('charts', signal),
    ...SHARED_QUERY_DEFAULTS,
    staleTime: 5 * 60 * 1000,
  });
}

export function useMerchantDashboardTables() {
  return useQuery({
    queryKey: QUERY_KEYS.merchantDashboardTables,
    queryFn: ({ signal }) => fetchMerchantDashboardGroup<MerchantTablesGroup>('tables', signal),
    ...SHARED_QUERY_DEFAULTS,
    staleTime: 30 * 1000,
  });
}
