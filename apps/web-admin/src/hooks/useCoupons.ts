'use client';

import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { QUERY_KEYS, SHARED_QUERY_DEFAULTS } from '@encreasl/client-services';

export type CouponDoc = {
  id: number;
  code: string;
  description: string | null;
  status: string;
  discount_type: string;
  amount: number;
  max_discount_amount: number | null;
  applies_to: string;
  free_delivery: boolean;
  delivery_discount_cap: number | null;
  vendor: { id: number; businessName: string } | number | null;
  merchant_scope: string;
  merchants: unknown[];
  menu_items: unknown[];
  excluded_menu_items: unknown[];
  menu_categories: unknown[];
  excluded_menu_categories: unknown[];
  exclude_promo_items: boolean;
  minimum_basket: number | null;
  maximum_basket: number | null;
  limit_per_order_items: number | null;
  individual_use: boolean;
  max_coupons_per_order: number;
  starts_at: string | null;
  expires_at: string | null;
  usage_limit: number;
  usage_limit_per_user: number;
  usage_count: number;
  email_restrictions: string[];
  phone_restrictions: string[];
  first_order_only: boolean;
  allowed_payment_methods: string[];
  time_windows: unknown[];
  funded_by: string;
  vendor_share_pct: number;
  createdAt: string;
  updatedAt: string;
};

export type CouponPagination = {
  page: number;
  limit: number;
  totalDocs: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
};

export type CouponStats = {
  totalAll: number;
  filteredTotal: number;
  statusBreakdown: Record<string, number>;
  totalUsage: number;
};

export type CouponsResponse = {
  docs: CouponDoc[];
  pagination: CouponPagination | null;
  stats: CouponStats | null;
};

async function fetchCoupons(qs: string, signal?: AbortSignal): Promise<CouponsResponse> {
  const res = await fetch(`/api/coupons?${qs}`, { signal });
  if (!res.ok) {
    const text = await res.text();
    try {
      const j = JSON.parse(text);
      throw new Error(j.error || 'Failed to load coupons');
    } catch {
      throw new Error(text || 'Failed to load coupons');
    }
  }
  return res.json() as Promise<CouponsResponse>;
}

/**
 * Coupons list query — 3-min instant-back.
 * Query key encodes page, limit, sort, search, and filters.
 */
export function useCoupons(qs: string) {
  return useQuery({
    queryKey: QUERY_KEYS.adminCoupons(qs),
    queryFn: ({ signal }) => fetchCoupons(qs, signal),
    placeholderData: keepPreviousData,
    ...SHARED_QUERY_DEFAULTS,
  });
}