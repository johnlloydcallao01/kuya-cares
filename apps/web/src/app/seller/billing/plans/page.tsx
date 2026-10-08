'use client'

import React, { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import {
  AlertCircle,
  Check,
  CheckCircle,
  Clock,
  CreditCard,
  Crown,
  Package,
  Receipt,
  RefreshCw,
  ShoppingCart,
  Sparkles,
  Store,
  Tag,
  X,
} from 'lucide-react'
import { ClientOnly } from '@/app/seller/_components/ClientOnly'

type BillingInterval = 'month' | 'year' | 'one_time'

type Plan = {
  id: number | string
  name: string
  slug: string
  description?: string | null
  price: number
  currency?: string | null
  billing_interval?: BillingInterval | string
  trial_days?: number | null
  commission_percent?: number | null
  limits?: Record<string, number | null | undefined> | null
  capabilities?: Record<string, boolean | string | number | null | undefined> | null
  display_order?: number | null
}

type VendorProfile = { id: string; businessName: string }

type SubscriptionPayload = {
  subscription?: {
    status?: string | null
    plan_id?: number | string | null
    plan_slug?: string | null
    plan_snapshot?: { id?: number | string; slug?: string } | null
  } | null
  plan?: { id?: number | string; slug?: string } | null
}

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

function formatInterval(interval?: string | null) {
  if (interval === 'year') return '/yr'
  if (interval === 'one_time') return ' one-time'
  return '/mo'
}

function formatLimit(value: number | null | undefined) {
  if (value == null) return '—'
  return Number(value) === -1 ? '∞' : String(value)
}

async function parseResponse(response: Response) {
  try {
    return await response.json() as Record<string, unknown>
  } catch {
    return {}
  }
}

function errorMessage(data: Record<string, unknown>, fallback: string) {
  return typeof data.error === 'string' ? data.error
    : typeof data.message === 'string' ? data.message
      : fallback
}

function PlansSkeleton() {
  return (
    <div className="space-y-6 py-5 px-2.5">
      <div className="h-8 w-48 rounded bg-gray-200 animate-pulse dark:bg-[#262626]" />
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 3 }).map((_, index) => (
          <div key={index} className="h-72 animate-pulse rounded-xl border border-gray-200 bg-gray-100 dark:border-[#262626] dark:bg-[#171717]" />
        ))}
      </div>
    </div>
  )
}

function PlansContent() {
  const [profiles, setProfiles] = useState<VendorProfile[]>([])
  const [vendorId, setVendorId] = useState('')
  const [plans, setPlans] = useState<Plan[]>([])
  const [subscription, setSubscription] = useState<SubscriptionPayload | null>(null)
  const [hasActiveSubscription, setHasActiveSubscription] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [intervalFilter, setIntervalFilter] = useState<'all' | 'month' | 'year'>('all')
  const [couponCode, setCouponCode] = useState('')
  const [busySlug, setBusySlug] = useState<string | null>(null)
  const [downgradeTarget, setDowngradeTarget] = useState<Plan | null>(null)

  const currentPlanId = subscription?.plan?.id ?? subscription?.subscription?.plan_id ?? null
  const currentPlanSlug = subscription?.plan?.slug
    ?? subscription?.subscription?.plan_slug
    ?? subscription?.subscription?.plan_snapshot?.slug
    ?? null

  const visiblePlans = useMemo(() => {
    if (intervalFilter === 'all') return plans
    return plans.filter((plan) => {
      const interval = String(plan.billing_interval || 'month').toLowerCase()
      return interval === 'one_time' || interval === intervalFilter
    })
  }, [intervalFilter, plans])

  const load = useCallback(async (preferredVendorId = '', hard = false) => {
    if (hard) setPlans([])
    setLoading(true)
    setError(null)
    setActionError(null)
    try {
      const [profilesResponse, plansResponse] = await Promise.all([
        fetch('/api/seller-membership/profiles', { cache: 'no-store' }),
        fetch(`/api/seller-membership/plans?_t=${Date.now()}`, { cache: 'no-store' }),
      ])
      const [profilesData, plansData] = await Promise.all([
        parseResponse(profilesResponse),
        parseResponse(plansResponse),
      ])
      if (!profilesResponse.ok) throw new Error(errorMessage(profilesData, 'Failed to load vendor profiles'))
      if (!plansResponse.ok) throw new Error(errorMessage(plansData, 'Failed to load plans'))

      const nextProfiles = Array.isArray(profilesData.docs)
        ? profilesData.docs as VendorProfile[]
        : []
      const nextPlans = Array.isArray(plansData.docs) ? plansData.docs as Plan[] : []
      const queryVendorId = typeof window !== 'undefined'
        ? new URLSearchParams(window.location.search).get('vendorId')
        : null
      const selected = nextProfiles.find((profile) => profile.id === preferredVendorId)
        ?? nextProfiles.find((profile) => profile.id === queryVendorId)
        ?? nextProfiles[0]
      setProfiles(nextProfiles)
      setPlans([...nextPlans].sort((a, b) => (a.display_order ?? 999) - (b.display_order ?? 999)))
      setVendorId(selected?.id ?? '')

      if (!selected) {
        setSubscription(null)
        setHasActiveSubscription(false)
        return
      }

      const subResponse = await fetch(
        `/api/seller-membership/subscription?${new URLSearchParams({ vendorId: selected.id })}`,
        { cache: 'no-store' },
      )
      const subData = await parseResponse(subResponse)
      if (subResponse.status === 402) {
        setSubscription(null)
        setHasActiveSubscription(false)
      } else if (!subResponse.ok) {
        throw new Error(errorMessage(subData, 'Failed to load subscription'))
      } else {
        const nextSubscription = subData as SubscriptionPayload
        setSubscription(nextSubscription)
        const status = String(nextSubscription.subscription?.status ?? '').toLowerCase()
        setHasActiveSubscription(
          !!nextSubscription.subscription && !['cancelled', 'expired'].includes(status),
        )
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Failed to load plans')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load('', true)
  }, [load])

  function isCurrent(plan: Plan) {
    if (currentPlanId != null && String(plan.id) === String(currentPlanId)) return true
    return !!currentPlanSlug && plan.slug === currentPlanSlug
  }

  async function runAction(
    plan: Plan,
    action: 'checkout' | 'upgrade' | 'downgrade',
  ) {
    if (busySlug || !vendorId) return
    setBusySlug(plan.slug)
    setActionError(null)
    try {
      const payload: Record<string, unknown> = {
        vendorId,
        idempotencyKey: globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`,
      }
      if (action === 'checkout') {
        payload.planSlug = plan.slug
        payload.billingInterval = plan.billing_interval || 'month'
        if (couponCode.trim()) payload.couponCode = couponCode.trim()
      } else {
        payload.toPlanSlug = plan.slug
      }
      const response = await fetch(`/api/seller-membership/${action}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await parseResponse(response)
      if (!response.ok) {
        const code = String(data.code ?? '').toUpperCase()
        if (response.status === 409 && code === 'ALREADY_SUBSCRIBED') {
          await load(vendorId)
          return
        }
        if (response.status === 422 && code === 'USE_DOWNGRADE') {
          setDowngradeTarget(plan)
          return
        }
        throw new Error(errorMessage(data, `${action[0].toUpperCase()}${action.slice(1)} failed`))
      }
      const checkoutUrl = data.checkoutUrl
      if (typeof checkoutUrl === 'string' && checkoutUrl) {
        window.location.href = checkoutUrl
        return
      }
      setDowngradeTarget(null)
      await load(vendorId)
    } catch (caught) {
      setActionError(caught instanceof Error ? caught.message : 'Billing action failed')
    } finally {
      setBusySlug(null)
    }
  }

  function changeProfile(nextVendorId: string) {
    setVendorId(nextVendorId)
    const url = new URL(window.location.href)
    url.searchParams.set('vendorId', nextVendorId)
    window.history.replaceState({}, '', url)
    void load(nextVendorId)
  }

  return (
    <div className="space-y-6 px-2.5 py-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-bold tracking-tight text-gray-900 dark:text-white sm:text-2xl">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#239459] text-white"><Crown className="h-4 w-4" /></span>
            Membership Plans
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-[#a1a1aa]">Choose the plan that fits your outlets — billed in PHP via PayMongo.</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="inline-flex rounded-lg border border-gray-200 bg-white p-0.5 text-xs font-semibold dark:border-[#262626] dark:bg-[#171717]">
            {(['all', 'month', 'year'] as const).map((interval) => (
              <button
                key={interval}
                onClick={() => setIntervalFilter(interval)}
                className={`rounded-md px-3 py-1.5 capitalize transition ${intervalFilter === interval ? 'bg-[#239459] text-white' : 'text-gray-600 dark:text-[#a1a1aa]'}`}
              >
                {interval === 'all' ? 'All' : interval === 'month' ? 'Monthly' : 'Yearly'}
              </button>
            ))}
          </div>
          <button
            onClick={() => void load(vendorId, true)}
            disabled={loading}
            aria-label="Refresh plans"
            className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-gray-200 bg-white hover:bg-gray-50 disabled:opacity-50 dark:border-[#262626] dark:bg-[#171717] dark:hover:bg-[#262626]"
          >
            <RefreshCw className={`h-4 w-4 text-gray-600 dark:text-[#a1a1aa] ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-3 rounded-xl border border-gray-200 bg-white p-3 shadow-sm dark:border-[#262626] dark:bg-[#171717] sm:flex-row sm:items-center">
        <label className="flex min-w-0 flex-1 items-center gap-2 text-sm text-gray-600 dark:text-[#a1a1aa]">
          <Store className="h-4 w-4 shrink-0 text-[#239459]" />
          <span className="shrink-0">Vendor profile</span>
          <select
            value={vendorId}
            onChange={(event) => changeProfile(event.target.value)}
            disabled={loading || profiles.length === 0}
            className="min-w-0 flex-1 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-900 dark:border-[#262626] dark:bg-[#0a0a0a] dark:text-white"
          >
            {profiles.length === 0 && <option value="">No vendor profiles found</option>}
            {profiles.map((profile) => (
              <option key={profile.id} value={profile.id}>{profile.businessName || `Vendor profile #${profile.id}`}</option>
            ))}
          </select>
        </label>
        <div className="relative min-w-0 flex-1">
          <Tag className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            value={couponCode}
            onChange={(event) => setCouponCode(event.target.value)}
            placeholder="Coupon code (optional)"
            className="w-full rounded-lg border border-gray-200 bg-gray-50 py-2.5 pl-9 pr-3 text-sm text-gray-900 placeholder:text-gray-400 focus:border-[#239459] focus:outline-none focus:ring-2 focus:ring-[#239459]/20 dark:border-[#262626] dark:bg-[#0a0a0a] dark:text-white"
          />
        </div>
        <Link href="/seller/billing/subscription" className="inline-flex items-center justify-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 dark:border-[#262626] dark:bg-[#0a0a0a] dark:text-white dark:hover:bg-[#262626]">
          <Receipt className="h-4 w-4 text-[#239459]" /> My subscription
        </Link>
      </div>

      {actionError && (
        <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-900/10 dark:text-red-300">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /> {actionError}
        </div>
      )}

      {error ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-gray-200 bg-white px-6 py-16 text-center shadow-sm dark:border-[#262626] dark:bg-[#171717]">
          <AlertCircle className="mb-4 h-7 w-7 text-red-500" />
          <h2 className="font-semibold text-gray-900 dark:text-white">Failed to load plans</h2>
          <p className="mb-4 mt-1 text-sm text-gray-500">{error}</p>
          <button onClick={() => void load(vendorId, true)} className="inline-flex items-center rounded-lg bg-[#239459] px-4 py-2 text-sm font-medium text-white">
            <RefreshCw className="mr-2 h-4 w-4" /> Retry
          </button>
        </div>
      ) : loading && plans.length === 0 ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 3 }).map((_, index) => <div key={index} className="h-72 animate-pulse rounded-xl border border-gray-200 bg-gray-100 dark:border-[#262626] dark:bg-[#171717]" />)}
        </div>
      ) : profiles.length === 0 ? (
        <div className="rounded-xl border border-gray-200 bg-white px-6 py-16 text-center dark:border-[#262626] dark:bg-[#171717]">
          <Store className="mx-auto mb-3 h-7 w-7 text-[#239459]" />
          <h2 className="font-semibold text-gray-900 dark:text-white">No vendor profiles found</h2>
          <p className="mt-1 text-sm text-gray-500 dark:text-[#a1a1aa]">Create a vendor profile before managing a membership plan.</p>
        </div>
      ) : visiblePlans.length === 0 ? (
        <div className="rounded-xl border border-gray-200 bg-white px-6 py-16 text-center dark:border-[#262626] dark:bg-[#171717]">
          <Crown className="mx-auto mb-3 h-7 w-7 text-[#239459]" />
          <h2 className="font-semibold text-gray-900 dark:text-white">No plans available</h2>
          <p className="mt-1 text-sm text-gray-500 dark:text-[#a1a1aa]">There are no membership plans published right now. Please check back later or contact support.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {visiblePlans.map((plan) => {
            const current = isCurrent(plan)
            const busy = busySlug === plan.slug
            const price = Number(plan.price || 0)
            const isYearly = plan.billing_interval === 'year'
            const monthlyPrice = isYearly && price > 0 ? price / 12 : null
            const limits = plan.limits || {}
            const capabilities = Object.entries(plan.capabilities || {})
              .filter(([, value]) => value === true || (typeof value === 'string' && value.toLowerCase() === 'true'))
              .slice(0, 6)
            return (
              <article key={plan.slug || plan.id} className={`flex flex-col rounded-xl border bg-white p-5 shadow-sm dark:bg-[#171717] ${current ? 'border-[#239459] ring-1 ring-[#239459]/30' : 'border-gray-200 dark:border-[#262626]'}`}>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h2 className="flex items-center gap-2 font-bold text-gray-900 dark:text-white"><Crown className="h-4 w-4 shrink-0 text-[#239459]" /><span className="truncate">{plan.name}</span></h2>
                    {plan.description && <p className="mt-1 line-clamp-2 text-xs text-gray-500 dark:text-[#a1a1aa]">{plan.description}</p>}
                  </div>
                  {current && <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 dark:border-emerald-800 dark:bg-emerald-900/20 dark:text-emerald-300"><CheckCircle className="h-3 w-3" /> Current</span>}
                </div>

                <div className="mt-4">
                  <span className="text-2xl font-bold text-gray-900 dark:text-white">{formatCurrency(price, plan.currency || 'PHP')}</span>
                  <span className="text-sm text-gray-500 dark:text-[#a1a1aa]">{formatInterval(plan.billing_interval)}</span>
                  {monthlyPrice !== null && <p className="mt-0.5 text-xs text-gray-500 dark:text-[#a1a1aa]">{formatCurrency(monthlyPrice, plan.currency || 'PHP')}/mo billed yearly</p>}
                </div>

                <div className="mt-3 flex flex-wrap gap-1.5 text-xs">
                  {plan.commission_percent != null && <span className="rounded-full bg-gray-100 px-2 py-1 font-medium text-gray-700 dark:bg-[#262626] dark:text-[#a1a1aa]">{Number(plan.commission_percent)}% commission</span>}
                  {(plan.trial_days ?? 0) > 0 && <span className="inline-flex items-center gap-1 rounded-full bg-[#239459]/10 px-2 py-1 font-medium text-[#215035] dark:bg-[#239459]/15 dark:text-[#7bd0a3]"><Sparkles className="h-3 w-3" /> {plan.trial_days}-day trial</span>}
                  <span className="rounded-full bg-gray-100 px-2 py-1 font-medium capitalize text-gray-700 dark:bg-[#262626] dark:text-[#a1a1aa]">{String(plan.billing_interval || 'month').replace('_', ' ')}</span>
                </div>

                <div className="mt-4 space-y-1.5 text-xs text-gray-600 dark:text-[#a1a1aa]">
                  {limits.max_merchants !== undefined && <p className="flex items-center gap-1.5"><Store className="h-3.5 w-3.5 text-[#239459]" /> Outlets: <strong className="text-gray-900 dark:text-white">{formatLimit(limits.max_merchants)}</strong></p>}
                  {limits.max_products !== undefined && <p className="flex items-center gap-1.5"><Package className="h-3.5 w-3.5 text-[#239459]" /> Products: <strong className="text-gray-900 dark:text-white">{formatLimit(limits.max_products)}</strong></p>}
                  {Object.entries(limits).filter(([key]) => !['max_merchants', 'max_products'].includes(key)).slice(0, 3).map(([key, value]) => <p key={key} className="flex items-center gap-1.5"><ShoppingCart className="h-3.5 w-3.5 text-[#239459]" /><span className="capitalize">{key.replace(/_/g, ' ')}:</span><strong className="text-gray-900 dark:text-white">{formatLimit(value)}</strong></p>)}
                  {capabilities.map(([key]) => <p key={key} className="flex items-center gap-1.5"><Check className="h-3.5 w-3.5 text-emerald-600" /><span className="capitalize">{key.replace(/_/g, ' ')}</span></p>)}
                </div>

                <div className="mt-5 flex flex-col gap-2 border-t border-gray-100 pt-4 dark:border-[#262626]">
                  {current ? (
                    <button disabled className="inline-flex w-full cursor-not-allowed items-center justify-center gap-2 rounded-lg bg-gray-100 px-4 py-2.5 text-sm font-semibold text-gray-500 dark:bg-[#262626] dark:text-[#a1a1aa]"><CheckCircle className="h-4 w-4" /> Current plan</button>
                  ) : !hasActiveSubscription ? (
                    <button onClick={() => void runAction(plan, 'checkout')} disabled={busy} className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-[#239459] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#215035] disabled:opacity-50"><CreditCard className="h-4 w-4" />{busy ? 'Processing…' : 'Subscribe'}</button>
                  ) : (
                    <div className="flex gap-2">
                      <button onClick={() => void runAction(plan, 'upgrade')} disabled={busy} className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg bg-[#239459] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#215035] disabled:opacity-50"><CheckCircle className="h-4 w-4" />{busy ? 'Processing…' : 'Upgrade'}</button>
                      <button onClick={() => setDowngradeTarget(plan)} disabled={busy} className="flex-1 rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50 dark:border-[#262626] dark:bg-[#0a0a0a] dark:text-white dark:hover:bg-[#262626]">Downgrade</button>
                    </div>
                  )}
                </div>
              </article>
            )
          })}
        </div>
      )}

      <div className="rounded-xl border border-gray-200 bg-white p-4 text-xs text-gray-500 dark:border-[#262626] dark:bg-[#171717] dark:text-[#a1a1aa]">
        Prices are in <strong className="text-gray-700 dark:text-white">PHP</strong>. Checkout redirects to a secure PayMongo page — your card details never touch our servers. Downgrades take effect at the <strong> end of the current billing period</strong>. See <Link href="/seller/billing/subscription" className="font-semibold text-[#239459] hover:text-[#215035]">My subscription</Link> for status and invoices.
      </div>

      {downgradeTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setDowngradeTarget(null)}>
          <div className="w-full max-w-md rounded-xl border border-gray-200 bg-white p-5 shadow-xl dark:border-[#262626] dark:bg-[#171717]" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-start justify-between gap-3">
              <h2 className="flex items-center gap-2 font-bold text-gray-900 dark:text-white"><Clock className="h-4 w-4 text-amber-500" /> Confirm downgrade</h2>
              <button onClick={() => setDowngradeTarget(null)} aria-label="Close confirmation" className="rounded-lg p-1 hover:bg-gray-100 dark:hover:bg-[#262626]"><X className="h-4 w-4 text-gray-500" /></button>
            </div>
            <p className="mt-2 text-sm text-gray-600 dark:text-[#a1a1aa]">
              Switch to <strong className="text-gray-900 dark:text-white">{downgradeTarget.name}</strong> ({formatCurrency(Number(downgradeTarget.price || 0), downgradeTarget.currency || 'PHP')}{formatInterval(downgradeTarget.billing_interval)})? The change takes effect at the end of your current billing period — you keep current benefits until then.
            </p>
            <div className="mt-5 flex gap-2">
              <button onClick={() => setDowngradeTarget(null)} className="flex-1 rounded-lg border border-gray-200 px-4 py-2.5 text-sm font-semibold text-gray-700 dark:border-[#262626] dark:text-white">Keep my plan</button>
              <button onClick={() => void runAction(downgradeTarget, 'downgrade')} disabled={busySlug === downgradeTarget.slug} className="flex-1 rounded-lg bg-[#239459] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#215035] disabled:opacity-50">{busySlug === downgradeTarget.slug ? 'Processing…' : 'Confirm downgrade'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default function SellerBillingPlansPage() {
  return <ClientOnly fallback={<PlansSkeleton />}><PlansContent /></ClientOnly>
}
