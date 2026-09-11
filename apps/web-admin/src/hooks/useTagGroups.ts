'use client';

import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { QUERY_KEYS, SHARED_QUERY_DEFAULTS } from '@encreasl/client-services';

export type TagGroupDoc = {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  color: string | null;
  icon: string | null;
  is_filterable: boolean;
  is_searchable: boolean;
  display_order: number;
  is_active: boolean;
  tagCount: number;
  createdAt: string;
  updatedAt: string;
};

export type TagGroupPagination = {
  page: number;
  limit: number;
  totalDocs: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
};

export type TagGroupStats = {
  total: number;
  activeCount: number;
  inactiveCount: number;
  filterableCount: number;
  searchableCount: number;
  filteredCount: number;
};

export type TagGroupsResponse = {
  docs: TagGroupDoc[];
  pagination: TagGroupPagination | null;
  stats: TagGroupStats | null;
};

async function fetchTagGroups(qs: string, signal?: AbortSignal): Promise<TagGroupsResponse> {
  const res = await fetch(`/api/catalog/tag-groups?${qs}`, { signal, cache: 'no-store' });
  if (!res.ok) {
    const text = await res.text();
    try {
      const j = JSON.parse(text);
      throw new Error(j.error || 'Failed to load tag groups');
    } catch {
      throw new Error(text || 'Failed to load tag groups');
    }
  }
  return res.json() as Promise<TagGroupsResponse>;
}

/**
 * Catalog tag groups list query — 3-min instant-back.
 * Query key encodes page, limit, sort, search, and filters.
 */
export function useTagGroups(qs: string) {
  return useQuery({
    queryKey: QUERY_KEYS.adminCatalogTagGroups(qs),
    queryFn: ({ signal }) => fetchTagGroups(qs, signal),
    placeholderData: keepPreviousData,
    ...SHARED_QUERY_DEFAULTS,
  });
}