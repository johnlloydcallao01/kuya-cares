'use client';

import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { QUERY_KEYS, SHARED_QUERY_DEFAULTS } from '@encreasl/client-services';
import { getStoredToken } from '@/lib/auth';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'https://cms.tap2goph.com/api';

export type MediaUsageEntry = {
  collection: string;
  label: string;
  count: number;
};

export type MediaItem = {
  id: number | string;
  filename: string;
  alt: string;
  url: string | null;
  cloudinaryPublicId: string | null;
  mimeType: string;
  type: 'image' | 'video' | 'other';
  filesize: number;
  width: number | null;
  height: number | null;
  createdAt: string | null;
  updatedAt: string | null;
  usage: {
    total: number;
    references: MediaUsageEntry[];
  };
};

export type MediaLibraryResponse = {
  docs: MediaItem[];
  totalDocs: number;
  totalPages: number;
  page: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
};

async function fetchMediaLibrary(qs: string, signal?: AbortSignal): Promise<MediaLibraryResponse> {
  const headers: Record<string, string> = {};
  const storedToken = getStoredToken();
  if (storedToken) headers['Authorization'] = `JWT ${storedToken}`;
  const res = await fetch(`${API_BASE_URL}/media/library?${qs}`, {
    credentials: 'include',
    headers,
    signal,
  });
  if (!res.ok) throw new Error(`Failed to load media (${res.status})`);
  return res.json() as Promise<MediaLibraryResponse>;
}

/**
 * Media library list query — 3-min instant-back.
 * Query key encodes page, limit, search, and type.
 * Only runs once auth is resolved (localStorage JWT required by direct CMS call).
 */
export function useMediaLibrary(qs: string, enabled: boolean) {
  return useQuery({
    queryKey: QUERY_KEYS.adminMediaLibrary(qs),
    queryFn: ({ signal }) => fetchMediaLibrary(qs, signal),
    enabled,
    placeholderData: keepPreviousData,
    ...SHARED_QUERY_DEFAULTS,
  });
}