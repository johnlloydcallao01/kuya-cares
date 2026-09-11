'use client';

import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { QUERY_KEYS, SHARED_QUERY_DEFAULTS } from '@encreasl/client-services';

export type UserDoc = {
  id: number;
  email: string;
  firstName: string;
  lastName: string;
  middleName: string | null;
  nameExtension: string | null;
  phone: string | null;
  username: string | null;
  gender: string | null;
  civilStatus: string | null;
  nationality: string | null;
  birthDate: string | null;
  placeOfBirth: string | null;
  completeAddress: string | null;
  role: string;
  isActive: boolean;
  lastLogin: string | null;
  profilePicture: { id: number; url: string | null; filename: string | null } | null;
  createdAt: string;
  updatedAt: string;
};

export type UserPagination = {
  page: number;
  limit: number;
  totalDocs: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
};

export type UserStats = {
  totalUsers: number;
  totalAll: number;
  filteredTotal: number;
  roleBreakdown: Record<string, number>;
  genderBreakdown: Record<string, number>;
  civilBreakdown: Record<string, number>;
  activeCount: number;
  inactiveCount: number;
};

export type UsersResponse = {
  docs: UserDoc[];
  pagination: UserPagination | null;
  stats: UserStats | null;
};

async function fetchUsers(qs: string, signal?: AbortSignal): Promise<UsersResponse> {
  const res = await fetch(`/api/users?${qs}`, { signal });
  if (!res.ok) {
    const text = await res.text();
    try {
      const j = JSON.parse(text);
      throw new Error(j.error || 'Failed to load users');
    } catch {
      throw new Error(text || 'Failed to load users');
    }
  }
  return res.json() as Promise<UsersResponse>;
}

/**
 * Users list query — 3-min instant-back.
 * Query key encodes page, limit, sort, search, and filters.
 */
export function useUsers(qs: string) {
  return useQuery({
    queryKey: QUERY_KEYS.adminUsers(qs),
    queryFn: ({ signal }) => fetchUsers(qs, signal),
    placeholderData: keepPreviousData,
    ...SHARED_QUERY_DEFAULTS,
  });
}

export type UserDependencies = {
  user: { id: number; email: string; firstName: string; lastName: string; role: string; isActive: boolean };
  counts: Record<string, number>;
  totalDirect: number;
  totalLinked: number;
  previews: Record<string, unknown[]>;
  groups: Record<string, string[]>;
};

async function fetchUserDependencies(userId: string | number, signal?: AbortSignal): Promise<UserDependencies> {
  const res = await fetch(`/api/users/${userId}/dependencies`, { signal });
  const text = await res.text();
  let j: Record<string, unknown> = {};
  try {
    j = JSON.parse(text);
  } catch {
    throw new Error(text || 'Failed to load dependencies');
  }
  if (!res.ok) throw new Error((j.error as string) || (j.details as string) || 'Failed to load dependencies');
  return j as unknown as UserDependencies;
}

/**
 * Per-user dependencies preview (delete inspection modal) — cached via TanStack.
 * Only runs while the modal is open. Backed by the Redis-cached CMS endpoint.
 */
export function useUserDependencies(userId: string | number | null) {
  return useQuery({
    queryKey: QUERY_KEYS.adminUserDependencies(userId ?? 'none'),
    queryFn: ({ signal }) => fetchUserDependencies(userId as string | number, signal),
    enabled: userId != null,
    ...SHARED_QUERY_DEFAULTS,
  });
}