'use client';

import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { QUERY_KEYS, SHARED_QUERY_DEFAULTS } from '@encreasl/client-services';

export type ActivityKey = 'wishlists' | 'carts' | 'searches' | 'views';

export type ActivityDoc = {
  id: number | string;
  customer: {
    id: number | string | null;
    email: string;
    firstName: string;
    lastName: string;
    profilePicture: { id: number; url: string | null; filename: string | null } | null;
  } | null;
  merchant: string;
  product: string;
  itemType: string;
  query: string;
  scope: string;
  source: string;
  status: string;
  quantity: number;
  subtotal: number;
  priceAtAdd: number;
  frequency: number;
  viewCount: number;
  lastViewedAt: string | null;
  updatedAt: string | null;
  createdAt: string | null;
};

export type ActivityPagination = {
  page: number;
  limit: number;
  totalDocs: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
};

export type ActivityStats = {
  total: number;
};

export type ActivityResponse = {
  docs: ActivityDoc[];
  pagination: ActivityPagination;
  stats: ActivityStats;
  meta: { title: string };
};

async function fetchActivity(activity: ActivityKey, qs: string, signal?: AbortSignal): Promise<ActivityResponse> {
  const res = await fetch(`/api/activity/${activity}?${qs}`, { signal });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error || 'Failed to load customer activity');
  return json as ActivityResponse;
}

/**
 * Customer activity list query (wishlists, carts, searches, views) — 3-min instant-back.
 * Query key encodes the activity tab plus page, limit, sort, and search.
 */
export function useActivity(activity: ActivityKey, qs: string) {
  return useQuery({
    queryKey: QUERY_KEYS.adminActivity(activity, qs),
    queryFn: ({ signal }) => fetchActivity(activity, qs, signal),
    placeholderData: keepPreviousData,
    ...SHARED_QUERY_DEFAULTS,
  });
}