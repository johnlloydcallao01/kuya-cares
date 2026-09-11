'use client';

import { useQuery } from '@tanstack/react-query';
import { QUERY_KEYS, SHARED_QUERY_DEFAULTS } from '@encreasl/client-services';

export type SecurityData = {
  stats: {
    totalUsers: number;
    activeCount: number;
    inactiveCount: number;
    lockedCount: number;
    roleBreakdown: Record<string, number>;
    activeRole: Record<string, number>;
    adminLevelBreakdown: Record<string, number>;
    adminCount: number;
    totalAdmins: number;
  };
  lockedPreview: Array<{
    id: number;
    email: string;
    firstName: string;
    lastName: string;
    role: string;
    loginAttempts: number;
    lockUntil: string | null;
    isActive: boolean;
  }>;
  auditStats: {
    totalAll: number;
    eventTypeBreakdown: Record<string, number>;
    loginSuccess: number;
    loginFailed: number;
    securityEvents: number;
  };
  authPolicy: {
    tokenExpirationDays: number;
    tokenExpirationSeconds: number;
    maxLoginAttempts: number;
    lockTimeMinutes: number;
    lockTimeMs: number;
    useAPIKey: boolean;
    cookieSecure: boolean;
    cookieSameSite: string;
  };
  passwordPolicy: {
    minLength: number;
    maxLength: number;
    requireUppercase: boolean;
    requireNumber: boolean;
    requireSpecial: boolean;
    description: string;
  };
  systemSettings: { maintenanceMode: boolean; deliveryProvider: string; hasSystemSettings: boolean };
  rateLimits: { forgotPasswordIp: string; forgotPasswordEmail: string; resetPasswordIp: string };
  recentSecurityEvents: Array<{
    id: number;
    eventType: string;
    timestamp: string;
    user: { id: number; email: string; firstName: string; lastName: string; role: string } | null;
    triggeredBy: unknown;
    ipAddress: string | null;
  }>;
  meta: { generatedAt: string };
};

async function fetchSecurityOverview(signal?: AbortSignal): Promise<SecurityData> {
  const res = await fetch('/api/security', { signal });
  if (!res.ok) {
    const text = await res.text();
    try {
      const j = JSON.parse(text);
      throw new Error(j.error || 'Failed to load security overview');
    } catch {
      throw new Error(text || 'Failed to load security overview');
    }
  }
  return res.json() as Promise<SecurityData>;
}

/**
 * Security overview singleton query — 3-min instant-back.
 * Backed by the Redis-cached CMS /api/admin/security endpoint
 * (PATCH invalidates the server cache).
 */
export function useSecurityOverview() {
  return useQuery({
    queryKey: QUERY_KEYS.adminSecurity(),
    queryFn: ({ signal }) => fetchSecurityOverview(signal),
    ...SHARED_QUERY_DEFAULTS,
  });
}