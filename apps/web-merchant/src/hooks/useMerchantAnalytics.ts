'use client';

import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { QUERY_KEYS } from '@encreasl/client-services';
import type {
  VendorAnalyticsData,
  VendorChartsGroup,
  VendorSummaryGroup,
  VendorTopsGroup,
} from '@/lib/analytics-types';

async function fetchMerchantAnalytics(qs: string, signal?: AbortSignal): Promise<VendorAnalyticsData> {
  const res = await fetch(`/api/analytics?${qs}`, { signal });
  if (!res.ok) throw new Error('Failed to load analytics');
  return res.json() as Promise<VendorAnalyticsData>;
}

async function fetchMerchantAnalyticsGroup<T>(group: 'summary' | 'charts' | 'tops', qs: string, signal?: AbortSignal): Promise<T> {
  const res = await fetch(`/api/analytics/${group}?${qs}`, { signal });
  if (!res.ok) throw new Error('Failed to load analytics');
  return res.json() as Promise<T>;
}

/**
 * Merchant analytics query — 3-min instant-back.
 * Query key encodes range, search, and filters.
 * Backed by the Redis-cached CMS /api/vendor/analytics endpoint.
 *
 * @deprecated Prefer the split hooks below (useMerchantAnalyticsSummary,
 * useMerchantAnalyticsCharts, useMerchantAnalyticsTops) which fetch in
 * parallel and render progressively. Kept for backward compatibility.
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

/**
 * Split merchant analytics queries — one React Query per group sharing the
 * same analytics/ directory. Mounted together they fetch in parallel with the
 * same qs; each section renders as soon as its own group resolves.
 * keepPreviousData preserves the filter-change UX per group.
 */
export function useMerchantAnalyticsSummary(qs: string) {
  return useQuery({
    queryKey: QUERY_KEYS.merchantAnalyticsSummary(qs),
    queryFn: ({ signal }) => fetchMerchantAnalyticsGroup<VendorSummaryGroup>('summary', qs, signal),
    placeholderData: keepPreviousData,
    staleTime: 3 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    retry: 1,
    refetchOnWindowFocus: false,
  });
}

export function useMerchantAnalyticsCharts(qs: string) {
  return useQuery({
    queryKey: QUERY_KEYS.merchantAnalyticsCharts(qs),
    queryFn: ({ signal }) => fetchMerchantAnalyticsGroup<VendorChartsGroup>('charts', qs, signal),
    placeholderData: keepPreviousData,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    retry: 1,
    refetchOnWindowFocus: false,
  });
}

export function useMerchantAnalyticsTops(qs: string) {
  return useQuery({
    queryKey: QUERY_KEYS.merchantAnalyticsTops(qs),
    queryFn: ({ signal }) => fetchMerchantAnalyticsGroup<VendorTopsGroup>('tops', qs, signal),
    placeholderData: keepPreviousData,
    staleTime: 60 * 1000,
    gcTime: 10 * 60 * 1000,
    retry: 1,
    refetchOnWindowFocus: false,
  });
}
