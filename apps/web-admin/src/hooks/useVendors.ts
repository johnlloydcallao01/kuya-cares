'use client';

import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { QUERY_KEYS, SHARED_QUERY_DEFAULTS } from '@encreasl/client-services';

export type VendorDoc = {
  id: number;
  businessName: string;
  legalName: string;
  businessRegistrationNumber: string;
  taxIdentificationNumber: string | null;
  primaryContactEmail: string;
  primaryContactPhone: string;
  websiteUrl: string | null;
  businessType: string;
  cuisineTypes: unknown;
  isActive: boolean;
  verificationStatus: string;
  onboardingDate: string | null;
  averageRating: number;
  totalReviews: number;
  totalOrders: number;
  totalMerchants: number;
  storedTotalMerchants: number;
  description: string | null;
  operatingHours: unknown;
  socialMediaLinks: any;
  logo: { id: number; url: string | null; filename: string | null } | null;
  businessLicense: any;
  taxCertificate: any;
  owner: { id: number; email: string; firstName: string; lastName: string; role: string } | null;
  createdAt: string;
  updatedAt: string;
  merchantsPreview?: any[];
};

export type Pagination = {
  page: number;
  limit: number;
  totalDocs: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
};

export type Stats = {
  totalVendors: number;
  totalAll: number;
  filteredTotal: number;
  verificationBreakdown: Record<string, number>;
  businessTypeBreakdown: Record<string, number>;
  activeCount: number;
  inactiveCount: number;
};

export type VendorsResponse = {
  docs: VendorDoc[];
  pagination: Pagination | null;
  stats: Stats | null;
};
async function fetchVendors(qs: string, signal?: AbortSignal): Promise<VendorsResponse> {
  const res = await fetch(`/api/vendors?${qs}`, { signal, cache: 'no-store' });
  if (!res.ok) {
    const text = await res.text();
    try {
      const j = JSON.parse(text);
      throw new Error(j.error || 'Failed to load vendors');
    } catch {
      throw new Error(text || 'Failed to load vendors');
    }
  }
  return res.json() as Promise<VendorsResponse>;
}

/**
 * Vendors list query — 3-min instant-back.
 * Query key encodes page, limit, sort, search, and filters.
 */
export function useVendors(qs: string) {
  return useQuery({
    queryKey: QUERY_KEYS.adminVendors(qs),
    queryFn: ({ signal }) => fetchVendors(qs, signal),
    placeholderData: keepPreviousData,
    ...SHARED_QUERY_DEFAULTS,
  });
}
