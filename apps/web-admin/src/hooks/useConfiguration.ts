'use client';

import { useQuery } from '@tanstack/react-query';
import { QUERY_KEYS, SHARED_QUERY_DEFAULTS } from '@encreasl/client-services';

export type ConfigData = {
  systemSettings: {
    maintenanceMode: boolean;
    deliveryProvider: 'lalamove' | 'native';
    lalamove: {
      apiKeyMasked: string | null;
      hasApiKey: boolean;
      apiSecretMasked: string | null;
      hasApiSecret: boolean;
      market: string;
      sandbox: boolean;
    };
    native: { riderAppUrl: string | null };
    hasSystemSettings: boolean;
    updatedAt: string | null;
    createdAt: string | null;
  };
  runtimeEnv: {
    lalamove: {
      sandbox: boolean;
      hasApiKey: boolean;
      hasApiSecret: boolean;
      market: string;
      baseUrl: string;
      priorityFee: string;
      hasEnvKeys: boolean;
    };
    paymongo: {
      sandbox: boolean;
      hasPublicKey: boolean;
      hasSecretKey: boolean;
      hasWebhookSecret: boolean;
      publicKeyMasked: string | null;
      secretKeyMasked: string | null;
      webhookSecretMasked: string | null;
      webhookUrl: string;
    };
    cors: { hasSecret: boolean; secretLength: number };
  };
  divergence: { lalamoveApiKeyMismatch: string | null; marketMismatch: string | null; sandboxMismatch: string | null };
  authPolicy: { tokenExpirationDays: number; tokenExpirationSeconds?: number; maxLoginAttempts: number; lockTimeMinutes: number };
  meta: { generatedAt: string };
};

async function fetchConfiguration(signal?: AbortSignal): Promise<ConfigData> {
  const res = await fetch('/api/configuration', { signal });
  if (!res.ok) {
    const text = await res.text();
    try {
      const j = JSON.parse(text);
      throw new Error(j.error || 'Failed to load configuration');
    } catch {
      throw new Error(text || 'Failed to load configuration');
    }
  }
  return res.json() as Promise<ConfigData>;
}

/**
 * Platform configuration singleton query — 3-min instant-back.
 * Backed by the Redis-cached CMS /api/admin/configuration endpoint
 * (PATCH invalidates the server cache).
 */
export function useConfiguration() {
  return useQuery({
    queryKey: QUERY_KEYS.adminConfiguration(),
    queryFn: ({ signal }) => fetchConfiguration(signal),
    ...SHARED_QUERY_DEFAULTS,
  });
}