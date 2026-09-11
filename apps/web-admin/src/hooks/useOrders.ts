'use client';

import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { QUERY_KEYS, SHARED_QUERY_DEFAULTS } from '@encreasl/client-services';

export type OrderDoc = {
  id: number | string;
  orderNumber: string;
  order_number?: string;
  status: string;
  fulfillment_type: string;
  fulfillmentType?: string;
  total: number;
  subtotal: number;
  delivery_fee: number;
  deliveryFee?: number;
  platform_fee: number;
  platformFee?: number;
  placed_at: string | null;
  placedAt?: string | null;
  notes: string | null;
  lalamove: {
    orderId: string | null;
    serviceType: string | null;
    status: string | null;
    trackingLink: string | null;
  } | null;
  merchant: {
    id: number | string;
    outletName: string;
    outletCode: string;
    vendor: { businessName: string; logo: { url: string | null } | null };
  } | null;
  customer: {
    id: number | string;
    email: string;
    user: { firstName: string; lastName: string } | null;
    phone?: string | null;
  } | null;
  createdAt: string;
  updatedAt: string;
};

export type OrderPagination = {
  page: number;
  limit: number;
  totalDocs: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
};

export type OrderStats = {
  totalAll: number;
  filteredTotal: number;
  totalRevenue: number;
  averageOrderValue: number;
  statusBreakdown: Record<string, number>;
  fulfillmentBreakdown: Record<string, number>;
  totalOrders?: number;
  pendingCount?: number;
  deliveredCount?: number;
};

export type OrdersResponse = {
  docs: OrderDoc[];
  pagination: OrderPagination | null;
  stats: OrderStats | null;
};

async function fetchOrders(qs: string, signal?: AbortSignal): Promise<OrdersResponse> {
  const res = await fetch(`/api/orders?${qs}`, { signal, cache: 'no-store' });
  if (!res.ok) {
    const text = await res.text();
    try {
      const j = JSON.parse(text);
      throw new Error(j.error || 'Failed to load orders');
    } catch {
      throw new Error(text || 'Failed to load orders');
    }
  }
  return res.json() as Promise<OrdersResponse>;
}

/**
 * Orders list query — 3-min instant-back.
 * Query key encodes page, limit, sort, search, and filters.
 */
export function useOrders(qs: string) {
  return useQuery({
    queryKey: QUERY_KEYS.adminOrders(qs),
    queryFn: ({ signal }) => fetchOrders(qs, signal),
    placeholderData: keepPreviousData,
    ...SHARED_QUERY_DEFAULTS,
  });
}