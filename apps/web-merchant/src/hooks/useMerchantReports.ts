'use client';

import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { QUERY_KEYS } from '@encreasl/client-services';
import type {
  VendorReportsCatalogGroup,
  VendorReportsData,
  VendorReportsFinancialGroup,
  VendorReportsSummaryGroup,
} from '@/lib/reports-types';

async function fetchMerchantReports(range: string, signal?: AbortSignal): Promise<VendorReportsData> {
  const res = await fetch(`/api/reports?range=${range}`, { signal });
  if (!res.ok) throw new Error('Failed to load reports');
  return res.json() as Promise<VendorReportsData>;
}

async function fetchMerchantReportsGroup<T>(group: 'summary' | 'financial' | 'catalog', range: string, signal?: AbortSignal): Promise<T> {
  const res = await fetch(`/api/reports/${group}?range=${range}`, { signal });
  if (!res.ok) throw new Error('Failed to load reports');
  return res.json() as Promise<T>;
}

/**
 * Merchant reports query — 3-min instant-back.
 * Query key encodes the range.
 * Backed by the Redis-cached CMS /api/vendor/reports endpoint.
 *
 * @deprecated Prefer the split hooks below (useMerchantReportsSummary,
 * useMerchantReportsFinancial, useMerchantReportsCatalog) which fetch in
 * parallel and render progressively. Kept for backward compatibility.
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

/**
 * Split merchant reports queries — one React Query per group sharing the
 * same reports/ directory. Mounted together they fetch in parallel with the
 * same range; each section renders as soon as its own group resolves.
 */
export function useMerchantReportsSummary(range: string) {
  return useQuery({
    queryKey: QUERY_KEYS.merchantReportsSummary(range),
    queryFn: ({ signal }) => fetchMerchantReportsGroup<VendorReportsSummaryGroup>('summary', range, signal),
    placeholderData: keepPreviousData,
    staleTime: 60 * 1000,
    gcTime: 10 * 60 * 1000,
    retry: 1,
    refetchOnWindowFocus: false,
  });
}

export function useMerchantReportsFinancial(range: string) {
  return useQuery({
    queryKey: QUERY_KEYS.merchantReportsFinancial(range),
    queryFn: ({ signal }) => fetchMerchantReportsGroup<VendorReportsFinancialGroup>('financial', range, signal),
    placeholderData: keepPreviousData,
    staleTime: 2 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    retry: 1,
    refetchOnWindowFocus: false,
  });
}

export function useMerchantReportsCatalog(range: string) {
  return useQuery({
    queryKey: QUERY_KEYS.merchantReportsCatalog(range),
    queryFn: ({ signal }) => fetchMerchantReportsGroup<VendorReportsCatalogGroup>('catalog', range, signal),
    placeholderData: keepPreviousData,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    retry: 1,
    refetchOnWindowFocus: false,
  });
}
