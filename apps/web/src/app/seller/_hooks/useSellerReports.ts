'use client';

import { keepPreviousData, useQuery } from '@tanstack/react-query';
import type {
  VendorReportsCatalogGroup,
  VendorReportsFinancialGroup,
  VendorReportsSummaryGroup,
} from '@/app/seller/_lib/reports-types';

const queryKeys = {
  summary: (range: string) => ['seller', 'reports', 'v2', 'summary', range] as const,
  financial: (range: string) => ['seller', 'reports', 'v2', 'financial', range] as const,
  catalog: (range: string) => ['seller', 'reports', 'v2', 'catalog', range] as const,
};

async function fetchReportsGroup<T>(
  group: 'summary' | 'financial' | 'catalog',
  range: string,
  signal?: AbortSignal,
): Promise<T> {
  const response = await fetch(`/api/seller-reports/${group}?range=${encodeURIComponent(range)}`, { signal });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error || 'Failed to load reports');
  }
  return response.json() as Promise<T>;
}

export function useSellerReportsSummary(range: string) {
  return useQuery({
    queryKey: queryKeys.summary(range),
    queryFn: ({ signal }) => fetchReportsGroup<VendorReportsSummaryGroup>('summary', range, signal),
    placeholderData: keepPreviousData,
    staleTime: 60 * 1000,
    gcTime: 10 * 60 * 1000,
    retry: 1,
    refetchOnWindowFocus: false,
  });
}

export function useSellerReportsFinancial(range: string) {
  return useQuery({
    queryKey: queryKeys.financial(range),
    queryFn: ({ signal }) => fetchReportsGroup<VendorReportsFinancialGroup>('financial', range, signal),
    placeholderData: keepPreviousData,
    staleTime: 2 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    retry: 1,
    refetchOnWindowFocus: false,
  });
}

export function useSellerReportsCatalog(range: string) {
  return useQuery({
    queryKey: queryKeys.catalog(range),
    queryFn: ({ signal }) => fetchReportsGroup<VendorReportsCatalogGroup>('catalog', range, signal),
    placeholderData: keepPreviousData,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    retry: 1,
    refetchOnWindowFocus: false,
  });
}

export const sellerReportsQueryKeys = queryKeys;
