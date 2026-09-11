'use client';

import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { QUERY_KEYS, SHARED_QUERY_DEFAULTS } from '@encreasl/client-services';

export type CustomerDoc = {
  id: number;
  customerId: number | null;
  userId: number;
  email: string;
  srn: string | null;
  couponCode: string | null;
  enrollmentDate: string | null;
  currentLevel: string;
  activeAddress: {
    id: number;
    formatted_address: string;
    locality: string | null;
    postal_code: string | null;
    address_type: string | null;
  } | null;
  activeAddressId: number | null;
  user: {
    id: number;
    email: string;
    firstName: string;
    lastName: string;
    middleName: string | null;
    phone: string | null;
    username: string | null;
    role: string;
    isActive: boolean;
    profilePicture: { id: number; url: string | null; filename: string | null } | null;
    createdAt: string;
  } | null;
  isActive: boolean;
  orderCount: number;
  addressCount: number;
  createdAt: string;
  updatedAt: string;
};

export type CustomerPagination = {
  page: number;
  limit: number;
  totalDocs: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
};

export type CustomerStats = {
  totalCustomers: number;
  totalAll: number;
  filteredTotal: number;
  levelBreakdown: Record<string, number>;
  activeCount: number;
  inactiveCount: number;
  enrollmentThisMonth: number;
  withActiveAddressCount?: number;
  withoutActiveAddressCount?: number;
};

export type CustomersResponse = {
  docs: CustomerDoc[];
  pagination: CustomerPagination | null;
  stats: CustomerStats | null;
};

async function fetchCustomers(qs: string, signal?: AbortSignal): Promise<CustomersResponse> {
  const res = await fetch(`/api/customers?${qs}`, { signal });
  if (!res.ok) {
    const text = await res.text();
    try {
      const j = JSON.parse(text);
      throw new Error(j.error || 'Failed to load customers');
    } catch {
      throw new Error(text || 'Failed to load customers');
    }
  }
  return res.json() as Promise<CustomersResponse>;
}

/**
 * Customers list query — 3-min instant-back.
 * Query key encodes page, limit, sort, search, and filters.
 */
export function useCustomers(qs: string) {
  return useQuery({
    queryKey: QUERY_KEYS.adminCustomers(qs),
    queryFn: ({ signal }) => fetchCustomers(qs, signal),
    placeholderData: keepPreviousData,
    ...SHARED_QUERY_DEFAULTS,
  });
}