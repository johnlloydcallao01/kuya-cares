'use client';

import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { QUERY_KEYS, SHARED_QUERY_DEFAULTS } from '@encreasl/client-services';

export type AuditDoc = {
  id: number;
  user: { id: number; email: string; firstName: string; lastName: string; role: string } | null;
  userId: number | null;
  eventType: string;
  eventData: unknown;
  triggeredBy: { id: number; email: string; firstName: string; lastName: string; role: string } | null;
  triggeredById: number | null;
  timestamp: string | null;
  createdAt: string;
  updatedAt: string;
  ipAddress: string | null;
  userAgent: string | null;
};

export type AuditPagination = {
  page: number;
  limit: number;
  totalDocs: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
};

export type AuditStats = {
  totalEvents: number;
  totalAll: number;
  filteredTotal: number;
  eventTypeBreakdown: Record<string, number>;
  loginSuccessCount: number;
  loginFailedCount: number;
  securityCount: number;
  uniqueUsers: number;
};

export type AuditResponse = {
  docs: AuditDoc[];
  pagination: AuditPagination | null;
  stats: AuditStats | null;
};

async function fetchAuditLogs(qs: string, signal?: AbortSignal): Promise<AuditResponse> {
  const res = await fetch(`/api/audit?${qs}`, { signal });
  if (!res.ok) {
    const text = await res.text();
    try {
      const j = JSON.parse(text);
      throw new Error(j.error || 'Failed to load audit logs');
    } catch {
      throw new Error(text || 'Failed to load audit logs');
    }
  }
  return res.json() as Promise<AuditResponse>;
}

/**
 * Audit logs list query — 3-min instant-back.
 * Query key encodes page, limit, sort, search, and filters.
 */
export function useAuditLogs(qs: string) {
  return useQuery({
    queryKey: QUERY_KEYS.adminAudit(qs),
    queryFn: ({ signal }) => fetchAuditLogs(qs, signal),
    placeholderData: keepPreviousData,
    ...SHARED_QUERY_DEFAULTS,
  });
}