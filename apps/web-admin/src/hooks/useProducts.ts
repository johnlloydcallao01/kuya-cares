'use client';

import { useQuery } from '@tanstack/react-query';
import { QUERY_KEYS, SHARED_QUERY_DEFAULTS } from '@encreasl/client-services';

export type ProductOption = { id: number; name: string };

async function fetchProducts(qs: string, signal?: AbortSignal): Promise<ProductOption[]> {
  const res = await fetch(`/api/products?${qs}`, { signal, cache: 'no-store' });
  if (!res.ok) throw new Error('Failed to load products');
  const j = await res.json();
  const docsArr: any[] = j.docs || [];
  return docsArr.map((d: any) => ({ id: d.id, name: d.name || `#${d.id}` }));
}

/**
 * Plain product options for filter dropdowns (id + name) — cached via TanStack.
 * Backed by the already Redis-cached CMS /admin/products endpoint.
 */
export function useProducts(qs: string) {
  return useQuery({
    queryKey: QUERY_KEYS.adminProducts(qs),
    queryFn: ({ signal }) => fetchProducts(qs, signal),
    ...SHARED_QUERY_DEFAULTS,
  });
}