'use client';

import { useQuery } from '@tanstack/react-query';
import { QUERY_KEYS, SHARED_QUERY_DEFAULTS } from '@encreasl/client-services';

export type CustomerAddressStats = {
  totalAll: number;
  activeCount: number;
  savedCount: number;
  verifiedCount: number;
  totalActiveCustomers: number;
  [key: string]: unknown;
};

async function fetchCustomerAddressStats(qs: string, signal?: AbortSignal): Promise<CustomerAddressStats | null> {
  const res = await fetch(`/api/customers/addresses?${qs}`, { signal });
  if (!res.ok) throw new Error('Failed to load address stats');
  const j = await res.json();
  return (j.stats as CustomerAddressStats) || null;
}

/**
 * Customer address aggregate stats (stats-only fetch) — cached via TanStack.
 * Backed by the Redis-cached CMS /admin/customers/addresses endpoint.
 */
export function useCustomerAddressStats(qs: string) {
  return useQuery({
    queryKey: QUERY_KEYS.adminCustomerAddresses(qs),
    queryFn: ({ signal }) => fetchCustomerAddressStats(qs, signal),
    ...SHARED_QUERY_DEFAULTS,
  });
}