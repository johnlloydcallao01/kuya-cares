'use client';

import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { QUERY_KEYS, SHARED_QUERY_DEFAULTS } from '@encreasl/client-services';

export type EmergencyContactDoc = {
  id: number;
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
  userId: number | null;
  firstName: string;
  middleName: string | null;
  lastName: string;
  contactNumber: string;
  relationship: string;
  completeAddress: string;
  isPrimary: boolean;
  createdAt: string;
  updatedAt: string;
};

export type EmergencyContactPagination = {
  page: number;
  limit: number;
  totalDocs: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
};

export type EmergencyContactStats = {
  totalEmergencyContacts: number;
  totalAll: number;
  filteredTotal: number;
  relationshipBreakdown: Record<string, number>;
  primaryCount: number;
  nonPrimaryCount: number;
};

export type EmergencyContactsResponse = {
  docs: EmergencyContactDoc[];
  pagination: EmergencyContactPagination | null;
  stats: EmergencyContactStats | null;
};

async function fetchEmergencyContacts(qs: string, signal?: AbortSignal): Promise<EmergencyContactsResponse> {
  const res = await fetch(`/api/emergency-contacts?${qs}`, { signal });
  if (!res.ok) {
    const text = await res.text();
    try {
      const j = JSON.parse(text);
      throw new Error(j.error || 'Failed to load emergency contacts');
    } catch {
      throw new Error(text || 'Failed to load emergency contacts');
    }
  }
  return res.json() as Promise<EmergencyContactsResponse>;
}

/**
 * Emergency contacts list query — 3-min instant-back.
 * Query key encodes page, limit, sort, search, and filters.
 */
export function useEmergencyContacts(qs: string) {
  return useQuery({
    queryKey: QUERY_KEYS.adminEmergencyContacts(qs),
    queryFn: ({ signal }) => fetchEmergencyContacts(qs, signal),
    placeholderData: keepPreviousData,
    ...SHARED_QUERY_DEFAULTS,
  });
}