/**
 * @file apps/cms/src/app/api/admin/finance/payments/gateway.ts
 * @description Shared PayMongo gateway helpers (server-side only — secret key never leaves CMS).
 * Docs: https://docs.paymongo.com/reference/list-all-payments
 */

export type PaymongoMode = 'sandbox' | 'live'

export function paymongoConfig(): { mode: PaymongoMode; secretKey: string } {
  const isSandbox = process.env.PAYMONGO_SANDBOX === 'true'
  const secretKey = (isSandbox ? process.env.PAYMONGO_SANDBOX_API_KEY : process.env.PAYMONGO_SECRET_KEY_LIVE)?.trim()
  if (!secretKey) throw new Error('PAYMONGO_SECRET_NOT_CONFIGURED')
  return { mode: isSandbox ? 'sandbox' : 'live', secretKey }
}

export function paymongoAuthHeader(secretKey: string): string {
  return `Basic ${Buffer.from(`${secretKey}:`).toString('base64')}`
}

export async function paymongoFetch(
  secretKey: string,
  path: string,
  init?: { method?: string; body?: unknown; idempotencyKey?: string; timeoutMs?: number },
): Promise<{ ok: boolean; status: number; data: any }> {
  const headers: Record<string, string> = { Authorization: paymongoAuthHeader(secretKey) }
  if (init?.body !== undefined) headers['Content-Type'] = 'application/json'
  if (init?.idempotencyKey) headers['Idempotency-Key'] = init.idempotencyKey
  const res = await fetch(`https://api.paymongo.com${path}`, {
    method: init?.method ?? 'GET',
    headers,
    body: init?.body !== undefined ? JSON.stringify(init.body) : undefined,
    signal: AbortSignal.timeout(init?.timeoutMs ?? 20000),
  })
  const data = await res.json().catch(() => null)
  return { ok: res.ok, status: res.status, data }
}

export function paymongoErrorMessage(data: any, status: number): string {
  const detail = data?.errors?.[0]?.detail
  return typeof detail === 'string' && detail ? detail : `PayMongo request failed (${status})`
}

export const REFUND_REASONS = ['duplicate', 'fraudulent', 'others'] as const
