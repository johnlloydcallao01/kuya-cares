'use client';

import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { QUERY_KEYS, SHARED_QUERY_DEFAULTS } from '@encreasl/client-services';

export type OrderItemDoc = {
  id: number | string;
  order: {
    id: number | string;
    status?: string;
    placed_at?: string | null;
    merchant?: { id: number | string; name?: string } | number | string | null;
  } | null;
  product: { id: number | string; name?: string; slug?: string } | null;
  merchant_product: { id: number | string; display_title?: string } | null;
  product_name_snapshot: string | null;
  price_at_purchase: number | string | null;
  quantity: number;
  options_snapshot: Record<string, unknown> | unknown[] | null;
  total_price: number | string | null;
  createdAt: string;
  updatedAt?: string;
};

export type OrderItemPagination = {
  page: number;
  limit: number;
  totalDocs: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
};

export type OrderItemStats = {
  filteredTotal?: number;
  totalAll?: number;
  totalDocs?: number;
  totalRevenue?: number;
  totalQuantity?: number;
  uniqueOrders?: number;
  withModifiers?: number;
  withModifiersCount?: number;
  [key: string]: unknown;
};

export type OrderItemsResponse = {
  docs: OrderItemDoc[];
  pagination: OrderItemPagination | null;
  stats: OrderItemStats | null;
};

async function fetchOrderItems(qs: string, signal?: AbortSignal): Promise<OrderItemsResponse> {
  const res = await fetch(`/api/order-items?${qs}`, { signal });
  if (!res.ok) {
    const text = await res.text();
    try {
      const j = JSON.parse(text);
      throw new Error(j.error || 'Failed to load order items');
    } catch {
      throw new Error(text || 'Failed to load order items');
    }
  }
  return res.json() as Promise<OrderItemsResponse>;
}

/**
 * Order items list query — 3-min instant-back.
 * Query key encodes page, limit, sort, search, and filters.
 */
export function useOrderItems(qs: string) {
  return useQuery({
    queryKey: QUERY_KEYS.adminOrderItems(qs),
    queryFn: ({ signal }) => fetchOrderItems(qs, signal),
    placeholderData: keepPreviousData,
    ...SHARED_QUERY_DEFAULTS,
  });
}