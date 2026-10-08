'use client';

import { keepPreviousData, useQuery } from '@tanstack/react-query';
import type {
  VendorChartsGroup,
  VendorSummaryGroup,
  VendorTopsGroup,
} from '@/app/seller/_lib/analytics-types';

const queryKeys = {
  summary: (query: string) => ['seller', 'analytics', 'v2', 'summary', query] as const,
  charts: (query: string) => ['seller', 'analytics', 'v2', 'charts', query] as const,
  tops: (query: string) => ['seller', 'analytics', 'v2', 'tops', query] as const,
};

async function fetchAnalyticsGroup<T>(
  group: 'summary' | 'charts' | 'tops',
  query: string,
  signal?: AbortSignal,
): Promise<T> {
  const response = await fetch(`/api/seller-analytics/${group}?${query}`, { signal });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error || 'Failed to load analytics');
  }
  return response.json() as Promise<T>;
}

export function useSellerAnalyticsSummary(query: string) {
  return useQuery({
    queryKey: queryKeys.summary(query),
    queryFn: ({ signal }) => fetchAnalyticsGroup<VendorSummaryGroup>('summary', query, signal),
    placeholderData: keepPreviousData,
    staleTime: 3 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    retry: 1,
    refetchOnWindowFocus: false,
  });
}

export function useSellerAnalyticsCharts(query: string) {
  return useQuery({
    queryKey: queryKeys.charts(query),
    queryFn: ({ signal }) => fetchAnalyticsGroup<VendorChartsGroup>('charts', query, signal),
    placeholderData: keepPreviousData,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    retry: 1,
    refetchOnWindowFocus: false,
  });
}

export function useSellerAnalyticsTops(query: string) {
  return useQuery({
    queryKey: queryKeys.tops(query),
    queryFn: ({ signal }) => fetchAnalyticsGroup<VendorTopsGroup>('tops', query, signal),
    placeholderData: keepPreviousData,
    staleTime: 60 * 1000,
    gcTime: 10 * 60 * 1000,
    retry: 1,
    refetchOnWindowFocus: false,
  });
}

export const sellerAnalyticsQueryKeys = queryKeys;
