'use client'

import { useQuery } from '@tanstack/react-query'
import { QUERY_KEYS, SHARED_QUERY_DEFAULTS } from '@encreasl/client-services'

export type GatewayLocal = {
  transactionId: number
  orderId: string
  status: string
  amount: number
  refunded_amount: number
  outlet: string | null
  vendor: string | null
  commission_amount: number | null
  commission_status: string | null
} | null

export type GatewayPayment = {
  id: string
  amount: number
  currency: string
  status: string
  fee: number
  net_amount: number
  payment_intent_id: string
  payment_method: string
  method_detail: string | null
  description: string | null
  billing_name: string | null
  billing_email: string | null
  disputed: boolean
  livemode: boolean
  paid_at: string | null
  created_at: string | null
  refunds: Array<Record<string, unknown>>
  local: GatewayLocal
  reconciled: boolean
  mismatches: string[]
}

export type GatewayPaymentsResponse = {
  meta: { mode: string; limit: number; has_more: boolean; matched: number; total: number; generatedAt: string }
  payments: GatewayPayment[]
}

async function fetchGatewayPayments(qs: string, signal?: AbortSignal): Promise<GatewayPaymentsResponse> {
  const res = await fetch(`/api/finance/payments?${qs}`, { signal })
  if (!res.ok) {
    const text = await res.text()
    try {
      const j = JSON.parse(text)
      throw new Error(j.error || 'Failed to load payments')
    } catch {
      throw new Error(text || 'Failed to load payments')
    }
  }
  return res.json() as Promise<GatewayPaymentsResponse>
}

export function useGatewayPayments(qs: string) {
  return useQuery({
    queryKey: QUERY_KEYS.adminGatewayPayments(qs),
    queryFn: ({ signal }) => fetchGatewayPayments(qs, signal),
    ...SHARED_QUERY_DEFAULTS,
  })
}

export type PaymongoWallet = {
  id: string
  merchant_id: string
  available: number
  pending: number
  currency: string
  account_name: string | null
  account_number: string | null
  is_default: boolean
  livemode: boolean
}

export type PayoutLineup = {
  amount: number
  currency: string
  generation_at: string | null
  receive_at: string | null
  payments: { amount: number; count: number }
  refunds: { amount: number; count: number }
  disputes: { amount: number; count: number }
  adjustments: { amount: number; count: number }
} | null

export type GatewayAccountResponse = {
  meta: { mode: string; generatedAt: string }
  totals: { available: number; pending: number; wallets: number }
  wallets: PaymongoWallet[]
  schedule: {
    merchant_id: string
    type: string | null
    days: string | null
    options: string[]
    next: PayoutLineup
    following: PayoutLineup
  } | null
}

async function fetchGatewayAccount(signal?: AbortSignal): Promise<GatewayAccountResponse> {
  const res = await fetch('/api/finance/payments/account', { signal })
  if (!res.ok) {
    const text = await res.text()
    try {
      const j = JSON.parse(text)
      throw new Error(j.error || 'Failed to load PayMongo account')
    } catch {
      throw new Error(text || 'Failed to load PayMongo account')
    }
  }
  return res.json() as Promise<GatewayAccountResponse>
}

export function useGatewayAccount(enabled = true) {
  return useQuery({
    queryKey: QUERY_KEYS.adminGatewayAccount(),
    queryFn: ({ signal }) => fetchGatewayAccount(signal),
    ...SHARED_QUERY_DEFAULTS,
    enabled,
  })
}

export async function postPaymentRefund(body: {
  transaction_id?: number
  payment_id?: string
  amount?: number
  reason: string
  notes?: string
}) {
  const res = await fetch('/api/finance/payments/refunds', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const j = await res.json().catch(() => null)
  if (!res.ok) throw new Error(j?.error || 'Refund failed')
  return j
}

export async function postPaymentSync(transaction_id: number) {
  const res = await fetch('/api/finance/payments/sync', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ transaction_id }),
  })
  const j = await res.json().catch(() => null)
  if (!res.ok) throw new Error(j?.error || 'Sync failed')
  return j
}

export type ReceivingInstitution = { name: string; bic: string; provider: string }

export async function fetchInstitutions(provider = 'instapay'): Promise<ReceivingInstitution[]> {
  const res = await fetch(`/api/finance/payments/institutions?provider=${encodeURIComponent(provider)}`)
  const j = await res.json().catch(() => null)
  if (!res.ok) throw new Error(j?.error || 'Failed to load banks')
  return (j?.institutions ?? []) as ReceivingInstitution[]
}

export async function postSendFunds(body: {
  destination_number: string
  destination_name: string
  destination_bic: string
  amount: number
  provider?: string
  description?: string
  purpose?: string
  reference_number?: string
  wallet_id?: string
}) {
  const res = await fetch('/api/finance/payments/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const j = await res.json().catch(() => null)
  if (!res.ok) throw new Error(j?.error || 'Send failed')
  return j
}

export async function postCreateLink(body: { amount: number; description: string; remarks?: string }) {
  const res = await fetch('/api/finance/payments/links', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const j = await res.json().catch(() => null)
  if (!res.ok) throw new Error(j?.error || 'Link creation failed')
  return j?.link as { id: string | null; checkout_url: string; reference_number: string; amount: number; currency: string }
}
