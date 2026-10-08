'use client'

import React, { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import {
  AlertCircle,
  Calendar,
  CheckCircle,
  Clock,
  Crown,
  DollarSign,
  Info,
  Receipt,
  RefreshCw,
  ShieldAlert,
  Sparkles,
  Store,
  Tag,
  X,
} from 'lucide-react'
import { ClientOnly } from '@/app/seller/_components/ClientOnly'

type SubStatus = 'active' | 'trialing' | 'pending' | 'past_due' | 'grace' | 'suspended' | 'cancelled' | 'expired' | 'none'
type VendorProfile = { id: string; businessName: string }

type SubscriptionPayload = {
  subscription?: {
    status?: string | null
    current_period_end?: string | null
    currentPeriodEnd?: string | null
    trial_ends_at?: string | null
    trialEndsAt?: string | null
    grace_ends_at?: string | null
    cancelAtPeriodEnd?: boolean | null
    cancel_at_period_end?: boolean | null
    scheduledPlan?: string | { slug?: string; name?: string } | null
    scheduled_plan?: string | { slug?: string; name?: string } | null
    scheduledEffectiveAt?: string | null
    scheduled_effective_at?: string | null
    plan_snapshot?: {
      name?: string
      price?: number
      currency?: string
      commission_percent?: number
      commissionPercent?: number
    } | null
  } | null
  plan?: { slug?: string; name?: string; trial_days?: number; trialDays?: number } | null
  trial?: { active?: boolean; endsAt?: string | null; ends_at?: string | null } | null
  grace?: { active?: boolean; daysLeft?: number | null; days_left?: number | null } | null
  entitlements?: { canPublishOutlet?: boolean; canCreateCoupon?: boolean; maxOutlets?: number; max_outlets?: number } | null
  usage?: Record<string, number | null | undefined> | null
  invoices?: Array<{
    id: number | string
    amount?: number
    total?: number
    currency?: string
    status?: string
    createdAt?: string
    created_at?: string
    paid_at?: string | null
  }> | null
  [key: string]: unknown
}

type PaywalledInfo = { code: string; subscriptionStatus: SubStatus; requiredPlan?: string | null }

function formatCurrency(amount: number, currency = 'PHP') {
  try {
    return new Intl.NumberFormat('en-PH', {
      style: 'currency',
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount)
  } catch {
    return `₱${Number(amount || 0).toFixed(2)}`
  }
}

function formatDate(value: string | null | undefined) {
  if (!value) return '—'
  try {
    return new Date(value).toLocaleDateString('en-PH', {
      timeZone: 'Asia/Manila',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
  } catch {
    return String(value).slice(0, 10)
  }
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return '—'
  try {
    return new Date(value).toLocaleString('en-PH', {
      timeZone: 'Asia/Manila',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return String(value).slice(0, 16)
  }
}

function numberOr(value: number | null | undefined, fallback: number) {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

function usageValue(usage: SubscriptionPayload['usage'], ...keys: string[]) {
  if (!usage) return undefined
  for (const key of keys) {
    const value = usage[key]
    if (typeof value === 'number') return value
  }
  return undefined
}

function subscriptionBadge(status: string) {
  if (status === 'active' || status === 'trialing') return 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-900/20 dark:text-emerald-300'
  if (status === 'past_due' || status === 'grace' || status === 'pending') return 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-300'
  if (status === 'suspended') return 'border-red-200 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-300'
  if (status === 'cancelled' || status === 'expired') return 'border-zinc-200 bg-zinc-100 text-zinc-700 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300'
  return 'border-gray-200 bg-gray-100 text-gray-700 dark:border-[#333] dark:bg-[#262626] dark:text-[#a1a1aa]'
}

function invoiceBadge(status: string) {
  if (status === 'paid' || status === 'succeeded') return 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-900/20 dark:text-emerald-300'
  if (status === 'pending' || status === 'open') return 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-300'
  if (status === 'failed' || status === 'void') return 'border-red-200 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-300'
  return 'border-gray-200 bg-gray-100 text-gray-700 dark:border-[#333] dark:bg-[#262626] dark:text-[#a1a1aa]'
}

async function parseResponse(response: Response) {
  try {
    return await response.json() as Record<string, unknown>
  } catch {
    return {}
  }
}

function responseError(data: Record<string, unknown>, fallback: string) {
  return typeof data.error === 'string' ? data.error : fallback
}

function SubscriptionSkeleton() {
  return (
    <div className="space-y-6 px-2.5 py-5">
      <div className="h-8 w-48 animate-pulse rounded bg-gray-200 dark:bg-[#262626]" />
      <div className="h-44 animate-pulse rounded-xl border border-gray-200 bg-gray-100 dark:border-[#262626] dark:bg-[#171717]" />
      <div className="h-32 animate-pulse rounded-xl bg-gray-100 dark:bg-[#171717]" />
    </div>
  )
}

function SubscriptionContent() {
  const [profiles, setProfiles] = useState<VendorProfile[]>([])
  const [vendorId, setVendorId] = useState('')
  const [data, setData] = useState<SubscriptionPayload | null>(null)
  const [paywalled, setPaywalled] = useState<PaywalledInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [actionOk, setActionOk] = useState<string | null>(null)
  const [showCancel, setShowCancel] = useState(false)
  const [cancelAtEnd, setCancelAtEnd] = useState(true)
  const [cancelReason, setCancelReason] = useState('')
  const [coupon, setCoupon] = useState('')

  const load = useCallback(async (preferredVendorId = '', hard = false) => {
    if (hard) {
      setData(null)
      setPaywalled(null)
    }
    setLoading(true)
    setError(null)
    try {
      const profilesResponse = await fetch('/api/seller-membership/profiles', { cache: 'no-store' })
      const profilesData = await parseResponse(profilesResponse)
      if (!profilesResponse.ok) throw new Error(responseError(profilesData, 'Failed to load vendor profiles'))
      const nextProfiles = Array.isArray(profilesData.docs) ? profilesData.docs as VendorProfile[] : []
      const queryVendorId = typeof window !== 'undefined'
        ? new URLSearchParams(window.location.search).get('vendorId')
        : null
      const selected = nextProfiles.find((profile) => profile.id === preferredVendorId)
        ?? nextProfiles.find((profile) => profile.id === queryVendorId)
        ?? nextProfiles[0]
      setProfiles(nextProfiles)
      setVendorId(selected?.id ?? '')
      if (!selected) {
        setData(null)
        setPaywalled(null)
        return
      }

      const response = await fetch(
        `/api/seller-membership/subscription?${new URLSearchParams({ vendorId: selected.id })}`,
        { cache: 'no-store' },
      )
      const result = await parseResponse(response) as SubscriptionPayload & {
        code?: string
        subscriptionStatus?: string
        requiredPlan?: string
      }
      if (response.status === 402) {
        setData(null)
        setPaywalled({
          code: String(result.code || 'SUBSCRIPTION_REQUIRED'),
          subscriptionStatus: (String(result.subscriptionStatus || 'none').toLowerCase() || 'none') as SubStatus,
          requiredPlan: result.requiredPlan ?? null,
        })
        return
      }
      if (!response.ok) throw new Error(responseError(result, 'Failed to load subscription'))
      setData(result)
      setPaywalled(null)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Failed to load subscription')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load('', true)
  }, [load])

  const sub = data?.subscription
  const status = String(sub?.status || '').toLowerCase()
  const trialEndsAt = data?.trial?.endsAt ?? data?.trial?.ends_at ?? sub?.trial_ends_at ?? sub?.trialEndsAt ?? null
  const trialActive = Boolean(data?.trial?.active) || status === 'trialing'
  const trialDaysLeft = trialEndsAt ? Math.max(0, Math.ceil((new Date(trialEndsAt).getTime() - Date.now()) / 86400000)) : 0
  const graceDaysLeft = numberOr(data?.grace?.daysLeft ?? data?.grace?.days_left, 0)
  const graceActive = Boolean(data?.grace?.active) || status === 'grace' || status === 'past_due'
  const periodEnd = sub?.current_period_end ?? sub?.currentPeriodEnd ?? null
  const cancelAtPeriodEnd = Boolean(sub?.cancelAtPeriodEnd ?? sub?.cancel_at_period_end ?? false)
  const scheduledPlan = sub?.scheduledPlan ?? sub?.scheduled_plan ?? null
  const scheduledName = typeof scheduledPlan === 'string'
    ? scheduledPlan
    : scheduledPlan?.name || scheduledPlan?.slug || null
  const scheduledAt = sub?.scheduledEffectiveAt ?? sub?.scheduled_effective_at ?? null
  const snapshot = sub?.plan_snapshot
  const entitlements = data?.entitlements
  const invoices = useMemo(() => Array.isArray(data?.invoices) ? data.invoices.slice(0, 5) : [], [data?.invoices])
  const planTrialDays = numberOr(data?.plan?.trial_days ?? data?.plan?.trialDays, 0)

  const usageRows = [
    {
      label: 'Outlets',
      used: usageValue(data?.usage, 'outlets', 'outlets_used', 'merchants_used', 'merchants'),
      limit: numberOr(entitlements?.maxOutlets ?? entitlements?.max_outlets, -1),
    },
    {
      label: 'Products',
      used: usageValue(data?.usage, 'products', 'products_used'),
      limit: usageValue(data?.usage, 'products_limit', 'max_products'),
    },
    {
      label: 'Orders this cycle',
      used: usageValue(data?.usage, 'ordersThisCycle', 'orders_current_period', 'orders'),
      limit: usageValue(data?.usage, 'orders_limit', 'max_orders'),
    },
  ]

  async function mutate(kind: 'Renew' | 'Cancel' | 'Trial' | 'Coupon', body: Record<string, unknown>) {
    if (busy || !vendorId) return
    setBusy(kind)
    setActionError(null)
    setActionOk(null)
    try {
      const payload = {
        ...body,
        vendorId,
        idempotencyKey: globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`,
      }
      const response = await fetch(`/api/seller-membership/${kind.toLowerCase()}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const result = await parseResponse(response) as {
        error?: string
        message?: string
        checkoutUrl?: string
        effectiveAt?: string
      }
      if (!response.ok) throw new Error(result.error || result.message || `${kind} failed`)
      if (result.checkoutUrl) {
        window.location.href = result.checkoutUrl
        return
      }
      setActionOk(result.effectiveAt ? `${kind} confirmed — effective ${formatDate(result.effectiveAt)}.` : `${kind} confirmed.`)
      if (kind === 'Coupon') setCoupon('')
      await load(vendorId)
    } catch (caught) {
      setActionError(caught instanceof Error ? caught.message : `${kind} failed`)
    } finally {
      setBusy(null)
    }
  }

  function selectProfile(nextVendorId: string) {
    const url = new URL(window.location.href)
    url.searchParams.set('vendorId', nextVendorId)
    window.history.replaceState({}, '', url)
    void load(nextVendorId, true)
  }

  return (
    <div className="space-y-6 px-2.5 py-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-bold tracking-tight text-gray-900 dark:text-white sm:text-2xl">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#239459] text-white"><Receipt className="h-4 w-4" /></span>
            My Subscription
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-[#a1a1aa]">Status, trial and grace periods, entitlements, usage, and recent invoices.</p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/seller/billing/plans" className="inline-flex items-center gap-2 rounded-lg bg-[#239459] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#215035]">
            <Crown className="h-4 w-4" /> View plans
          </Link>
          <button
            onClick={() => void load(vendorId, true)}
            disabled={loading}
            aria-label="Refresh subscription"
            className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-gray-200 bg-white hover:bg-gray-50 disabled:opacity-50 dark:border-[#262626] dark:bg-[#171717] dark:hover:bg-[#262626]"
          >
            <RefreshCw className={`h-4 w-4 text-gray-600 dark:text-[#a1a1aa] ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      <label className="flex max-w-2xl items-center gap-3 rounded-xl border border-gray-200 bg-white p-3 text-sm text-gray-600 shadow-sm dark:border-[#262626] dark:bg-[#171717] dark:text-[#a1a1aa]">
        <Store className="h-4 w-4 shrink-0 text-[#239459]" />
        <span className="shrink-0">Vendor profile</span>
        <select
          value={vendorId}
          onChange={(event) => selectProfile(event.target.value)}
          disabled={loading || profiles.length === 0}
          className="min-w-0 flex-1 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-900 dark:border-[#262626] dark:bg-[#0a0a0a] dark:text-white"
        >
          {profiles.length === 0 && <option value="">No vendor profiles found</option>}
          {profiles.map((profile) => <option key={profile.id} value={profile.id}>{profile.businessName || `Vendor profile #${profile.id}`}</option>)}
        </select>
      </label>

      {actionError && <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-900/10 dark:text-red-300"><ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" /> {actionError}</div>}
      {actionOk && <div className="flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700 dark:border-emerald-800 dark:bg-emerald-900/10 dark:text-emerald-300"><CheckCircle className="mt-0.5 h-4 w-4 shrink-0" /> {actionOk}</div>}

      {error ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-gray-200 bg-white px-6 py-16 text-center shadow-sm dark:border-[#262626] dark:bg-[#171717]">
          <AlertCircle className="mb-4 h-7 w-7 text-red-500" />
          <h2 className="font-semibold text-gray-900 dark:text-white">Failed to load subscription</h2>
          <p className="mb-4 mt-1 text-sm text-gray-500">{error}</p>
          <button onClick={() => void load(vendorId, true)} className="inline-flex items-center rounded-lg bg-[#239459] px-4 py-2 text-sm font-medium text-white"><RefreshCw className="mr-2 h-4 w-4" />Retry</button>
        </div>
      ) : loading && !data && !paywalled ? (
        <div className="space-y-4">
          <div className="h-44 animate-pulse rounded-xl border border-gray-200 bg-gray-100 dark:border-[#262626] dark:bg-[#171717]" />
          <div className="h-32 animate-pulse rounded-xl bg-gray-100 dark:bg-[#171717]" />
        </div>
      ) : profiles.length === 0 ? (
        <div className="rounded-xl border border-gray-200 bg-white px-6 py-16 text-center dark:border-[#262626] dark:bg-[#171717]">
          <Store className="mx-auto mb-3 h-7 w-7 text-[#239459]" />
          <h2 className="font-semibold text-gray-900 dark:text-white">No vendor profiles found</h2>
          <p className="mt-1 text-sm text-gray-500 dark:text-[#a1a1aa]">Create a vendor profile before managing a subscription.</p>
        </div>
      ) : paywalled ? (
        <div className="rounded-xl border border-amber-200 bg-white p-8 text-center shadow-sm dark:border-amber-900/40 dark:bg-[#171717]">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-amber-50 dark:bg-amber-900/20"><ShieldAlert className="h-7 w-7 text-amber-500" /></div>
          <h2 className="text-lg font-bold text-gray-900 dark:text-white">
            {paywalled.subscriptionStatus === 'pending' ? 'Complete your payment' : ['past_due', 'grace'].includes(paywalled.subscriptionStatus) ? 'Payment past due' : ['suspended', 'cancelled', 'expired'].includes(paywalled.subscriptionStatus) ? 'Subscription inactive — resubscribe' : 'No active subscription'}
          </h2>
          <p className="mx-auto mt-1 max-w-md text-sm text-gray-500 dark:text-[#a1a1aa]">
            {paywalled.subscriptionStatus === 'pending' && 'Your subscription is awaiting payment. Complete checkout to activate publishing and coupons.'}
            {['past_due', 'grace'].includes(paywalled.subscriptionStatus) && 'Your payment failed. Pay now to keep your outlets live during the grace window.'}
            {['suspended', 'cancelled', 'expired'].includes(paywalled.subscriptionStatus) && 'Your subscription is no longer active. Pick a plan to restore publishing and coupons.'}
            {paywalled.subscriptionStatus === 'none' && 'Publishing and coupons require an active membership. Choose a plan to get started.'}
            {paywalled.requiredPlan ? ` Required plan: ${paywalled.requiredPlan}.` : ''}
          </p>
          <div className="mt-6 flex flex-col items-center justify-center gap-2 sm:flex-row">
            {paywalled.subscriptionStatus === 'none' || ['suspended', 'cancelled', 'expired'].includes(paywalled.subscriptionStatus)
              ? <Link href="/seller/billing/plans" className="inline-flex items-center gap-2 rounded-lg bg-[#239459] px-5 py-2.5 text-sm font-semibold text-white"><Crown className="h-4 w-4" /> Choose a plan</Link>
              : null}
            {['pending', 'past_due', 'grace'].includes(paywalled.subscriptionStatus) && (
              <button onClick={() => void mutate('Renew', {})} disabled={busy !== null} className="inline-flex items-center gap-2 rounded-lg bg-[#239459] px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50">
                <DollarSign className="h-4 w-4" /> {busy ? 'Processing…' : paywalled.subscriptionStatus === 'pending' ? 'Complete payment' : 'Pay now'}
              </button>
            )}
          </div>
        </div>
      ) : data && sub ? (
        <>
          {scheduledName && <div className="flex items-start gap-2 rounded-xl border border-blue-200 bg-blue-50 p-3 text-sm text-blue-700 dark:border-blue-900/40 dark:bg-blue-900/10 dark:text-blue-300"><Info className="mt-0.5 h-4 w-4 shrink-0" /><span>Scheduled change to <strong>{scheduledName}</strong>{scheduledAt ? <> — effective {formatDate(scheduledAt)}</> : ' — takes effect at period end'}. Downgrades apply at the end of the current billing period.</span></div>}
          {cancelAtPeriodEnd && <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-700 dark:border-amber-900/40 dark:bg-amber-900/10 dark:text-amber-300"><Clock className="mt-0.5 h-4 w-4 shrink-0" /><span>Cancellation scheduled — you keep access until {formatDate(periodEnd)}. Renew to stay subscribed.</span></div>}

          <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-[#262626] dark:bg-[#171717]">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-xs font-medium text-gray-500 dark:text-[#a1a1aa]">Current plan</p>
                <h2 className="mt-0.5 flex items-center gap-2 text-lg font-bold text-gray-900 dark:text-white"><Crown className="h-5 w-5 text-[#239459]" /> {data.plan?.name || snapshot?.name || 'Membership'}</h2>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold capitalize ${subscriptionBadge(status || 'unknown')}`}>{status || 'unknown'}</span>
                  {trialActive && trialEndsAt && <span className="inline-flex items-center gap-1 rounded-full border border-[#239459]/30 bg-[#239459]/10 px-2.5 py-1 text-xs font-semibold text-[#215035] dark:bg-[#239459]/15 dark:text-[#7bd0a3]"><Sparkles className="h-3 w-3" /> Trial ends {formatDate(trialEndsAt)} ({trialDaysLeft}d left)</span>}
                  {graceActive && <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-300"><Clock className="h-3 w-3" /> Grace: {graceDaysLeft}d left</span>}
                </div>
              </div>
              <div className="text-sm text-gray-600 dark:text-[#a1a1aa] sm:text-right">
                <p className="flex items-center gap-1.5 sm:justify-end"><Calendar className="h-4 w-4 text-[#239459]" /> Period ends <strong className="text-gray-900 dark:text-white">{formatDate(periodEnd)}</strong></p>
                {snapshot?.price != null && <p className="mt-1">{formatCurrency(Number(snapshot.price), snapshot.currency || 'PHP')}{snapshot.commission_percent != null ? ` • ${Number(snapshot.commission_percent)}% commission` : snapshot.commissionPercent != null ? ` • ${Number(snapshot.commissionPercent)}% commission` : ''}</p>}
              </div>
            </div>

            <div className="mt-4 grid grid-cols-1 gap-2 text-xs sm:grid-cols-3">
              <div className="flex items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 p-3 dark:border-[#262626] dark:bg-[#0a0a0a]"><Store className="h-4 w-4 shrink-0 text-[#239459]" /><span className="text-gray-600 dark:text-[#a1a1aa]">Publish outlet</span><strong className={`ml-auto ${entitlements?.canPublishOutlet ? 'text-emerald-600 dark:text-emerald-400' : 'text-gray-400'}`}>{entitlements?.canPublishOutlet ? 'Yes' : 'No'}</strong></div>
              <div className="flex items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 p-3 dark:border-[#262626] dark:bg-[#0a0a0a]"><Tag className="h-4 w-4 shrink-0 text-[#239459]" /><span className="text-gray-600 dark:text-[#a1a1aa]">Create coupons</span><strong className={`ml-auto ${entitlements?.canCreateCoupon ? 'text-emerald-600 dark:text-emerald-400' : 'text-gray-400'}`}>{entitlements?.canCreateCoupon ? 'Yes' : 'No'}</strong></div>
              <div className="flex items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 p-3 dark:border-[#262626] dark:bg-[#0a0a0a]"><Store className="h-4 w-4 shrink-0 text-[#239459]" /><span className="text-gray-600 dark:text-[#a1a1aa]">Max outlets</span><strong className="ml-auto text-gray-900 dark:text-white">{numberOr(entitlements?.maxOutlets ?? entitlements?.max_outlets, -1) === -1 ? '∞' : String(entitlements?.maxOutlets ?? entitlements?.max_outlets)}</strong></div>
            </div>

            <div className="mt-4 space-y-3">
              {usageRows.map((row) => {
                const used = row.used ?? 0
                const unlimited = row.limit === -1 || row.limit === undefined
                const percentage = unlimited || !row.limit ? 0 : Math.min(100, Math.round((used / Math.max(1, row.limit)) * 100))
                return <div key={row.label}>
                  <div className="mb-1 flex items-center justify-between text-xs"><span className="font-medium text-gray-600 dark:text-[#a1a1aa]">{row.label}</span><span className="font-semibold text-gray-900 dark:text-white">{used} / {unlimited ? '∞' : row.limit}</span></div>
                  <div className="h-2 overflow-hidden rounded-full bg-gray-100 dark:bg-[#262626]"><div className="h-full rounded-full bg-[#239459] transition-all" style={{ width: `${unlimited ? 8 : percentage}%` }} /></div>
                </div>
              })}
            </div>

            <div className="mt-5 flex flex-col gap-2 border-t border-gray-100 pt-4 dark:border-[#262626] sm:flex-row">
              <button onClick={() => void mutate('Renew', {})} disabled={busy !== null} className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#239459] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#215035] disabled:opacity-50"><RefreshCw className={`h-4 w-4 ${busy === 'Renew' ? 'animate-spin' : ''}`} />{busy === 'Renew' ? 'Processing…' : 'Renew'}</button>
              <button onClick={() => setShowCancel(true)} disabled={busy !== null} className="inline-flex items-center justify-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50 dark:border-[#262626] dark:bg-[#0a0a0a] dark:text-white dark:hover:bg-[#262626]"><X className="h-4 w-4" /> Cancel</button>
              {planTrialDays > 0 && !trialActive && <button onClick={() => void mutate('Trial', { planSlug: data.plan?.slug })} disabled={busy !== null || !data.plan?.slug} className="inline-flex items-center justify-center gap-2 rounded-lg border border-[#239459]/40 px-4 py-2.5 text-sm font-semibold text-[#215035] hover:bg-[#239459]/10 disabled:opacity-50 dark:text-[#7bd0a3]"><Sparkles className="h-4 w-4" />{busy === 'Trial' ? 'Processing…' : `Start ${planTrialDays}-day trial`}</button>}
            </div>

            <div className="mt-3 flex flex-col gap-2 sm:flex-row">
              <div className="relative min-w-0 flex-1">
                <Tag className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <input value={coupon} onChange={(event) => setCoupon(event.target.value)} placeholder="Coupon code" className="w-full rounded-lg border border-gray-200 bg-gray-50 py-2.5 pl-9 pr-3 text-sm text-gray-900 placeholder:text-gray-400 focus:border-[#239459] focus:outline-none focus:ring-2 focus:ring-[#239459]/20 dark:border-[#262626] dark:bg-[#0a0a0a] dark:text-white" />
              </div>
              <button onClick={() => void mutate('Coupon', { code: coupon.trim() })} disabled={busy !== null || !coupon.trim()} className="inline-flex items-center justify-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50 dark:border-[#262626] dark:bg-[#0a0a0a] dark:text-white dark:hover:bg-[#262626]"><Tag className="h-4 w-4 text-[#239459]" />{busy === 'Coupon' ? 'Applying…' : 'Attach coupon'}</button>
            </div>
          </section>

          <section className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm dark:border-[#262626] dark:bg-[#171717]">
            <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3 dark:border-[#262626]">
              <h2 className="flex items-center gap-2 text-sm font-semibold text-gray-900 dark:text-white"><DollarSign className="h-4 w-4 text-[#239459]" /> Recent invoices</h2>
              <Link href={`/seller/billing/invoices?${new URLSearchParams({ vendorId })}`} className="text-xs font-semibold text-[#239459] hover:text-[#215035]">View all</Link>
            </div>
            {invoices.length === 0 ? (
              <p className="px-4 py-6 text-center text-sm text-gray-500 dark:text-[#a1a1aa]">No invoices yet — they appear after checkout.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b border-gray-200 bg-gray-50 text-xs text-gray-500 dark:border-[#262626] dark:bg-[#0a0a0a] dark:text-[#a1a1aa]">
                    <tr><th className="px-4 py-3 text-left font-medium">Invoice</th><th className="px-4 py-3 text-left font-medium">Status</th><th className="px-4 py-3 text-right font-medium">Amount</th><th className="hidden px-4 py-3 text-left font-medium md:table-cell">Date</th></tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-[#262626]">
                    {invoices.map((invoice) => {
                      const invoiceStatus = String(invoice.status || 'unknown').toLowerCase()
                      return <tr key={invoice.id} className="transition hover:bg-gray-50 dark:hover:bg-[#0a0a0a]/50">
                        <td className="px-4 py-3 text-xs font-semibold text-gray-900 dark:text-white"><Link href={`/seller/billing/invoices/${encodeURIComponent(String(invoice.id))}?${new URLSearchParams({ vendorId })}`} className="hover:text-[#239459]">#{String(invoice.id)}</Link></td>
                        <td className="px-4 py-3"><span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold capitalize ${invoiceBadge(invoiceStatus)}`}>{invoiceStatus}</span></td>
                        <td className="px-4 py-3 text-right text-xs font-semibold text-gray-900 dark:text-white">{formatCurrency(Number(invoice.amount ?? invoice.total ?? 0), invoice.currency || 'PHP')}</td>
                        <td className="hidden px-4 py-3 text-xs text-gray-500 dark:text-[#a1a1aa] md:table-cell">{formatDateTime(invoice.createdAt ?? invoice.created_at ?? null)}</td>
                      </tr>
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      ) : null}

      {showCancel && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setShowCancel(false)}>
          <div className="w-full max-w-md rounded-xl border border-gray-200 bg-white p-5 shadow-xl dark:border-[#262626] dark:bg-[#171717]" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-start justify-between gap-3">
              <h2 className="font-bold text-gray-900 dark:text-white">Cancel subscription?</h2>
              <button onClick={() => setShowCancel(false)} aria-label="Close cancellation dialog" className="rounded-lg p-1 hover:bg-gray-100 dark:hover:bg-[#262626]"><X className="h-4 w-4 text-gray-500" /></button>
            </div>
            <label className="mt-4 flex cursor-pointer items-center justify-between gap-3 rounded-lg border border-gray-200 p-3 text-sm dark:border-[#262626]">
              <span className="font-medium text-gray-700 dark:text-white">Cancel at period end<span className="block text-xs font-normal text-gray-500 dark:text-[#a1a1aa]">Keep access until {formatDate(periodEnd)} (recommended)</span></span>
              <button type="button" role="switch" aria-checked={cancelAtEnd} onClick={() => setCancelAtEnd((value) => !value)} className={`relative h-6 w-11 shrink-0 rounded-full transition ${cancelAtEnd ? 'bg-[#239459]' : 'bg-gray-200 dark:bg-[#262626]'}`}><span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${cancelAtEnd ? 'left-[22px]' : 'left-0.5'}`} /></button>
            </label>
            <input value={cancelReason} onChange={(event) => setCancelReason(event.target.value)} placeholder="Reason (optional)" className="mt-3 w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:border-[#239459] focus:outline-none focus:ring-2 focus:ring-[#239459]/20 dark:border-[#262626] dark:bg-[#0a0a0a] dark:text-white" />
            <div className="mt-5 flex gap-2">
              <button onClick={() => setShowCancel(false)} className="flex-1 rounded-lg border border-gray-200 px-4 py-2.5 text-sm font-semibold text-gray-700 dark:border-[#262626] dark:text-white">Keep my plan</button>
              <button
                onClick={() => {
                  setShowCancel(false)
                  void mutate('Cancel', {
                    cancelAtPeriodEnd: cancelAtEnd,
                    ...(cancelReason.trim() ? { reason: cancelReason.trim() } : {}),
                  })
                }}
                disabled={busy !== null}
                className="flex-1 rounded-lg bg-red-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50"
              >
                {busy === 'Cancel' ? 'Processing…' : 'Confirm cancel'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default function SellerSubscriptionPage() {
  return <ClientOnly fallback={<SubscriptionSkeleton />}><SubscriptionContent /></ClientOnly>
}
