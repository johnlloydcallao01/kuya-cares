/**
 * @file apps/web/src/app/actions/payments.ts
 * @description Server-side payment-options action (BFF pattern).
 *
 * Single source of truth for customer-facing PayMongo rails is
 * `GET /api/payments/options` (CMS). Screens fetch through here — never a
 * hardcoded list. No auth needed (platform configuration, public like the
 * system-settings global); no user resolution.
 */

'use server';

import type { PaymentMethodId } from '@/lib/payments/catalog';

const API_BASE_URL = (process.env.NEXT_PUBLIC_API_URL || 'https://cms.kuyacares.com/api').replace(/\/+$/, '');
const SERVICE_KEY = process.env.PAYLOAD_API_KEY || process.env.NEXT_PUBLIC_PAYLOAD_API_KEY || '';

export interface PaymentOption {
  id: PaymentMethodId;
  label: string;
  hint?: string;
}

export async function getPaymentOptions(): Promise<PaymentOption[]> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (SERVICE_KEY) headers['Authorization'] = `users API-Key ${SERVICE_KEY}`;

  const res = await fetch(`${API_BASE_URL}/payments/options`, {
    headers,
    cache: 'no-store',
  });
  if (!res.ok) {
    throw new Error(`Payment options unavailable (${res.status})`);
  }
  const json = await res.json().catch(() => ({}));
  const methods = json?.data?.methods;
  if (!Array.isArray(methods) || methods.length === 0) {
    throw new Error('Payment options unavailable (empty)');
  }
  return methods
    .filter((m: any) => typeof m?.id === 'string' && typeof m?.label === 'string')
    .map((m: any) => ({ id: m.id as PaymentMethodId, label: String(m.label), hint: m.hint ?? undefined }));
}
