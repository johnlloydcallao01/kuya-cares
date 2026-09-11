'use client';

import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { QUERY_KEYS, SHARED_QUERY_DEFAULTS } from '@encreasl/client-services';

export type RedemptionDoc = {
  id: number;
  coupon: unknown;
  order: unknown;
  customer: unknown;
  code_snapshot: string;
  food_discount: number;
  delivery_discount: number;
  total_discount: number;
  funded_by: string;
  vendor_share_pct: number;
  platform_share: number;
  vendor_share: number;
  status: string;
  held_until: string | null;
  createdAt: string;
  updatedAt: string;
};

export type RedemptionPagination = {
  page: number;
  limit: number;
  totalDocs: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
};

export type RedemptionStats = {
  filteredTotal: number;
  pageDiscounted: number;
};

export type CouponRedemptionsResponse = {
  docs: RedemptionDoc[];
  pagination: RedemptionPagination | null;
  stats: RedemptionStats | null;
};

async function fetchCouponRedemptions(qs: string, signal?: AbortSignal): Promise<CouponRedemptionsResponse> {
  const res = await fetch(`/api/coupons/redemptions?${qs}`, { signal });
  if (!res.ok) {
    const text = await res.text();
    try {
      const j = JSON.parse(text);
      throw new Error(j.error || 'Failed to load usage');
    } catch {
      throw new Error(text || 'Failed to load usage');
    }
  }
  return res.json() as Promise<CouponRedemptionsResponse>;
}

/**
 * Coupon redemptions list query — 3-min instant-back.
 * Query key encodes page, limit, coupon/order filters, and status.
 */
export function useCouponRedemptions(qs: string) {
  return useQuery({
    queryKey: QUERY_KEYS.adminCouponRedemptions(qs),
    queryFn: ({ signal }) => fetchCouponRedemptions(qs, signal),
    placeholderData: keepPreviousData,
    ...SHARED_QUERY_DEFAULTS,
  });
}