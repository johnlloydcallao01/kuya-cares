'use client';

import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { QUERY_KEYS, SHARED_QUERY_DEFAULTS } from '@encreasl/client-services';

export type TagDoc = {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  color: string | null;
  tag_type: string;
  parent_tag_id: { id: number; name: string; slug: string } | null;
  usage_count: number;
  is_active: boolean;
  is_featured: boolean;
  productCount: number;
  groupCount: number;
  createdAt: string;
  updatedAt: string;
};

export type TagPagination = {
  page: number;
  limit: number;
  totalDocs: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
};

export type TagStats = {
  total: number;
  activeCount: number;
  featuredCount: number;
  inactiveCount: number;
  topLevelCount: number;
  filteredCount: number;
  tagTypeBreakdown: Record<string, number>;
};

export type TagsResponse = {
  docs: TagDoc[];
  pagination: TagPagination | null;
  stats: TagStats | null;
};

async function fetchTags(qs: string, signal?: AbortSignal): Promise<TagsResponse> {
  const res = await fetch(`/api/catalog/tags?${qs}`, { signal, cache: 'no-store' });
  if (!res.ok) {
    const text = await res.text();
    try {
      const j = JSON.parse(text);
      throw new Error(j.error || 'Failed to load tags');
    } catch {
      throw new Error(text || 'Failed to load tags');
    }
  }
  return res.json() as Promise<TagsResponse>;
}

/**
 * Catalog tags list query — 3-min instant-back.
 * Query key encodes page, limit, sort, search, and filters.
 */
export function useTags(qs: string) {
  return useQuery({
    queryKey: QUERY_KEYS.adminCatalogTags(qs),
    queryFn: ({ signal }) => fetchTags(qs, signal),
    placeholderData: keepPreviousData,
    ...SHARED_QUERY_DEFAULTS,
  });
}