'use client'

import { useQuery } from '@tanstack/react-query'
import { QUERY_KEYS, SHARED_QUERY_DEFAULTS } from '@encreasl/client-services'

export type EarningsSummary = {
  totalCommission: number
  totalFees: number
  grossIncome: number
  totalReversed: number
  totalAdjustments: number
  netIncome: number
  totalEntries: number
  totalOrders: number
  totalVendors: number
  memberFeeIncome: number
  paidMemberFees: number
}

export type EarningsDay = {
  date: string
  commission: number
  fees: number
  net: number
  entries: number
  orders: number
}

export type MemberFeeDay = {
  date: string
  total: number
  count: number
}

export type EarningsRule = {
  ruleId: string
  name: string
  commission: number
  fees: number
  net: number
  entries: number
}

export type EarningsSource = {
  source: string
  commission: number
  fees: number
  net: number
  entries: number
}

export type EarningsVendor = {
  vendorId: string
  businessName: string
  commission: number
  fees: number
  net: number
  entries: number
  orders: number
}

export type EarningsResponse = {
  meta: {
    range: string
    days: number
    generatedAt: string
    periodStart: string | null
    periodEnd: string
    filters: { vendor: string | null; source: string | null; rule: string | null; entry_type: string[] }
  }
  summary: EarningsSummary
  daily: EarningsDay[]
  memberFeeDaily: MemberFeeDay[]
  byRule: EarningsRule[]
  bySource: EarningsSource[]
  byVendor: EarningsVendor[]
}

async function fetchCommissionEarnings(qs: string, signal?: AbortSignal): Promise<EarningsResponse> {
  const res = await fetch(`/api/finance/commission-earnings?${qs}`, { signal })
  if (!res.ok) {
    const text = await res.text()
    try {
      const j = JSON.parse(text)
      throw new Error(j.error || 'Failed to load commission earnings')
    } catch {
      throw new Error(text || 'Failed to load commission earnings')
    }
  }
  return res.json() as Promise<EarningsResponse>
}

export function useCommissionEarnings(qs: string) {
  return useQuery({
    queryKey: QUERY_KEYS.adminCommissionEarnings(qs),
    queryFn: ({ signal }) => fetchCommissionEarnings(qs, signal),
    ...SHARED_QUERY_DEFAULTS,
  })
}
