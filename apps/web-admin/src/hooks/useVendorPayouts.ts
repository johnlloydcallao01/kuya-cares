'use client';

import { useQuery } from '@tanstack/react-query';
import { QUERY_KEYS, SHARED_QUERY_DEFAULTS } from '@encreasl/client-services';

export type PayoutRow = {
  vendorId: string;
  businessName: string;
  legalName: string;
  businessType: string;
  verificationStatus: string;
  isActive: boolean;
  logo: { id: number; url: string | null } | null;
  totalMerchants: number;
  averageRating: number;
  orders: number;
  gross: number;
  platformFees: number;
  deliveryFees: number;
  net: number;
  refunded: number;
  avgOrder: number;
  avgNet: number;
};

export type Summary = {
  totalGross: number;
  totalNet: number;
  totalPlatformFees: number;
  totalDeliveryFees: number;
  totalRefunded: number;
  totalOrders: number;
  totalVendors: number;
  activeVendors: number;
  avgPayout: number;
  avgOrder: number;
};

export type PayoutResponse = {
  meta: { range: string; days: number; generatedAt: string; periodStart: string | null; periodEnd: string };
  summary: Summary;
  vendorPayouts: { rows: PayoutRow[]; count: number };
  daily: { date: string; gross: number; net: number; orders: number }[];
  verificationBreakdown: Record<string, number>;
};

async function fetchVendorPayouts(qs: string, signal?: AbortSignal): Promise<PayoutResponse> {
  const res = await fetch(`/api/vendors/payouts?${qs}`, { signal });
  if (!res.ok) {
    const text = await res.text();
    try {
      const j = JSON.parse(text);
      throw new Error(j.error || 'Failed to load vendor payouts');
    } catch {
      throw new Error(text || 'Failed to load vendor payouts');
    }
  }
  return res.json() as Promise<PayoutResponse>;
}

/**
 * Vendor Payouts query — 3-min instant-back for cached ranges.
 * Range / filter switches must show the skeleton screen while fetching
 * (no placeholderData), so 7d/30d/90d/1y/all stay consistent with first load.
 */
export function useVendorPayouts(qs: string) {
  return useQuery({
    queryKey: QUERY_KEYS.adminVendorPayouts(qs),
    queryFn: ({ signal }) => fetchVendorPayouts(qs, signal),
    ...SHARED_QUERY_DEFAULTS,
  });
}
