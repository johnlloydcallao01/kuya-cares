'use client'

import React, { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { ClientOnly } from '@/components/ClientOnly'
import {
  CreditCard, CheckCircle, Clock, RefreshCw, AlertCircle, Crown,
  Check, X, Tag, Sparkles, Store, Package, ShoppingCart, ShieldAlert, Receipt,
} from '@/components/ui/IconWrapper'

type BillingInterval = 'month' | 'year' | 'one_time'

type Plan = {
  id: number | string
  name: string
  slug: string
  description?: string | null
  price: number
  currency?: string
  billing_interval?: BillingInterval | string
  trial_days?: number | null
  commission_percent?: number | null
  transaction_fee?: number | null
  limits?: Record<string, number | null | undefined> | null
  capabilities?: Record<string, boolean | string | number | null | undefined> | null
  status?: string | null
  display_order?: number | null
}

type SubscriptionPayload = {
  subscription?: {
    status?: string | null
    current_period_end?: string | null
    trial_ends_at?: string | null
    grace_ends_at?: string | null
    cancelAtPeriodEnd?: boolean | null
    cancel_at_period_end?: boolean | null
    scheduledPlan?: string | { slug?: string; name?: string } | null
    scheduledEffectiveAt?: string | null
    plan_snapshot?: { id?: number | string; slug?: string; name?: string } | null
    plan_id?: number | string | null
    plan_slug?: string | null
    [k: string]: unknown
  } | null
  plan?: { id?: number | string; slug?: string; name?: string } | null
  [k: string]: unknown
}

function fmtCurrency(amount: number, currency = 'PHP') {
  try {
    return new Intl.NumberFormat('en-PH', { style: 'currency', currency, minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount)
  } catch { return `₱${Number(amount || 0).toFixed(2)}` }
}

function fmtIntervalLabel(interval?: string | null) {
  const v = (interval || '').toLowerCase()
  if (v === 'year') return '/yr'
  if (v === 'one_time') return ' one-time'
  return '/mo'
}

function fmtLimit(v: number | null | undefined) {
  if (v === null || v === undefined) return '—'
  if (Number(v) === -1) return '∞'
  return String(v)
}

function errMsg(e: unknown, fallback: string) {
  return e instanceof Error ? e.message : fallback
}

async function parseJsonSafe(res: Response) {
  try { return await res.json() } catch { return {} }
}

function newIdempotencyKey() {
  try {
    const c = globalThis.crypto as Crypto | undefined
    if (c && typeof c.randomUUID === 'function') return c.randomUUID()
  } catch { /* fall through */ }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`
}

function PlansSkeleton() {
  return (
    <div className="space-y-6 py-5 px-2.5">
      <div className="h-8 w-48 bg-gray-200 dark:bg-[#262626] rounded animate-pulse" />
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 animate-pulse">
        {Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-72 bg-gray-100 dark:bg-[#171717] rounded-xl border border-gray-200 dark:border-[#262626]" />)}
      </div>
    </div>
  )
}

function PlansContent() {
  const [plans, setPlans] = useState<Plan[]>([])
  const [subPayload, setSubPayload] = useState<SubscriptionPayload | null>(null)
  const [hasActiveSub, setHasActiveSub] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [intervalFilter, setIntervalFilter] = useState<'all' | 'month' | 'year'>('all')
  const [couponCode, setCouponCode] = useState('')
  const [busySlug, setBusySlug] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [downgradeTarget, setDowngradeTarget] = useState<Plan | null>(null)

  const currentPlanId = subPayload?.plan?.id ?? subPayload?.subscription?.plan_id ?? null
  const currentPlanSlug =
    subPayload?.plan?.slug ??
    subPayload?.subscription?.plan_slug ??
    (typeof subPayload?.subscription?.plan_snapshot?.slug === 'string' ? subPayload?.subscription?.plan_snapshot?.slug : null) ??
    null

  const isCurrent = useCallback((p: Plan) => {
    if (currentPlanId !== null && currentPlanId !== undefined && String(p.id) === String(currentPlanId)) return true
    const snapId = subPayload?.subscription?.plan_snapshot?.id
    if (snapId !== null && snapId !== undefined && String(p.id) === String(snapId)) return true
    if (currentPlanSlug && p.slug === currentPlanSlug) return true
    return false
  }, [currentPlanId, currentPlanSlug, subPayload])

  const load = useCallback(async (opts?: { hard?: boolean }) => {
    if (opts?.hard) setPlans([])
    setLoading(true)
    setError(null)
    try {
      const [plansRes, subRes] = await Promise.all([
        fetch(`/api/membership/plans?_t=${Date.now()}`, { cache: 'no-store' }),
        fetch(`/api/membership/subscription?_t=${Date.now()}`, { cache: 'no-store' }),
      ])
      const plansJson = await parseJsonSafe(plansRes)
      if (!plansRes.ok) throw new Error((plansJson as { error?: string })?.error || 'Failed to load plans')
      const docs = Array.isArray((plansJson as { docs?: unknown })?.docs)
        ? (plansJson as { docs: Plan[] }).docs
        : Array.isArray((plansJson as { plans?: unknown })?.plans)
          ? (plansJson as unknown as { plans: Plan[] }).plans
          : Array.isArray(plansJson) ? (plansJson as Plan[]) : []
      const sorted = [...docs].sort((a, b) => (a.display_order ?? 999) - (b.display_order ?? 999))
      setPlans(sorted)

      if (subRes.status === 402) {
        setSubPayload(null)
        setHasActiveSub(false)
      } else {
        const subJson = await parseJsonSafe(subRes)
        if (subRes.ok) {
          setSubPayload(subJson as SubscriptionPayload)
          const st = String((subJson as SubscriptionPayload)?.subscription?.status || '').toLowerCase()
          setHasActiveSub(!!(subJson as SubscriptionPayload)?.subscription && !['cancelled', 'expired'].includes(st))
        } else {
          setSubPayload(null)
          setHasActiveSub(false)
        }
      }
    } catch (e: unknown) {
      setError(errMsg(e, 'Failed to load plans'))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void load() }, [load])

  const visiblePlans = intervalFilter === 'all'
    ? plans
    : plans.filter((p) => {
        const v = String(p.billing_interval || 'month').toLowerCase()
        if (v === 'one_time') return true
        return v === intervalFilter
      })

  async function doCheckout(plan: Plan) {
    if (busySlug) return
    setBusySlug(plan.slug)
    setActionError(null)
    try {
      const body: Record<string, unknown> = {
        planSlug: plan.slug,
        billingInterval: plan.billing_interval || 'month',
        idempotencyKey: newIdempotencyKey(),
      }
      const code = couponCode.trim()
      if (code) body.couponCode = code
      const res = await fetch('/api/membership/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const j = await parseJsonSafe(res)
      if (res.status === 409 && String((j as { code?: string })?.code || '').toUpperCase() === 'ALREADY_SUBSCRIBED') {
        await load()
        return
      }
      if (res.status === 422 && String((j as { code?: string })?.code || '').toUpperCase() === 'USE_DOWNGRADE') {
        await doDowngrade(plan)
        return
      }
      if (!res.ok) throw new Error((j as { error?: string; message?: string })?.error || (j as { message?: string })?.message || 'Checkout failed')
      const checkoutUrl = (j as { checkoutUrl?: string })?.checkoutUrl
      if (checkoutUrl) {
        window.location.href = checkoutUrl
        return
      }
      await load()
    } catch (e: unknown) {
      setActionError(errMsg(e, 'Checkout failed'))
    } finally {
      setBusySlug(null)
    }
  }

  async function doUpgrade(plan: Plan) {
    if (busySlug) return
    setBusySlug(plan.slug)
    setActionError(null)
    try {
      const res = await fetch('/api/membership/upgrade', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ toPlanSlug: plan.slug, idempotencyKey: newIdempotencyKey() }),
      })
      const j = await parseJsonSafe(res)
      if (res.status === 409 && String((j as { code?: string })?.code || '').toUpperCase() === 'ALREADY_SUBSCRIBED') {
        await load()
        return
      }
      if (res.status === 422 && String((j as { code?: string })?.code || '').toUpperCase() === 'USE_DOWNGRADE') {
        setDowngradeTarget(plan)
        return
      }
      if (!res.ok) throw new Error((j as { error?: string; message?: string })?.error || (j as { message?: string })?.message || 'Upgrade failed')
      const checkoutUrl = (j as { checkoutUrl?: string })?.checkoutUrl
      if (checkoutUrl) {
        window.location.href = checkoutUrl
        return
      }
      await load()
    } catch (e: unknown) {
      setActionError(errMsg(e, 'Upgrade failed'))
    } finally {
      setBusySlug(null)
    }
  }

  async function doDowngrade(plan: Plan) {
    if (busySlug) return
    setBusySlug(plan.slug)
    setActionError(null)
    try {
      const res = await fetch('/api/membership/downgrade', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ toPlanSlug: plan.slug, idempotencyKey: newIdempotencyKey() }),
      })
      const j = await parseJsonSafe(res)
      if (!res.ok) throw new Error((j as { error?: string; message?: string })?.error || (j as { message?: string })?.message || 'Downgrade failed')
      const checkoutUrl = (j as { checkoutUrl?: string })?.checkoutUrl
      if (checkoutUrl) {
        window.location.href = checkoutUrl
        return
      }
      setDowngradeTarget(null)
      await load()
    } catch (e: unknown) {
      setActionError(errMsg(e, 'Downgrade failed'))
    } finally {
      setBusySlug(null)
    }
  }

  return (
    <div className="space-y-6 py-5 px-2.5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white tracking-tight flex items-center gap-2">
            <span className="h-8 w-8 rounded-lg bg-[#239459] text-white flex items-center justify-center"><Crown className="w-4 h-4" /></span>
            Membership Plans
          </h1>
          <p className="text-sm text-gray-500 dark:text-[#a1a1aa] mt-1">Choose the plan that fits your outlets — billed in PHP via PayMongo.</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="inline-flex rounded-lg border border-gray-200 dark:border-[#262626] bg-white dark:bg-[#171717] p-0.5 text-xs font-semibold">
            {(['all', 'month', 'year'] as const).map((v) => (
              <button
                key={v}
                onClick={() => setIntervalFilter(v)}
                className={`px-3 py-1.5 rounded-md capitalize transition ${intervalFilter === v ? 'bg-[#239459] text-white' : 'text-gray-600 dark:text-[#a1a1aa]'}`}
              >
                {v === 'all' ? 'All' : v === 'month' ? 'Monthly' : 'Yearly'}
              </button>
            ))}
          </div>
          <button
            onClick={() => void load({ hard: true })}
            disabled={loading}
            aria-label="Refresh plans"
            className="h-9 w-9 inline-flex items-center justify-center bg-white dark:bg-[#171717] border border-gray-200 dark:border-[#262626] rounded-xl hover:bg-gray-50 dark:hover:bg-[#262626] disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 text-gray-600 dark:text-[#a1a1aa] ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      <div className="bg-white dark:bg-[#171717] rounded-xl border border-gray-200 dark:border-[#262626] p-3 shadow-sm flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="relative flex-1">
          <Tag className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={couponCode}
            onChange={(e) => setCouponCode(e.target.value)}
            placeholder="Coupon code (optional — applied at checkout)"
            className="w-full pl-9 pr-3 py-2.5 text-sm bg-gray-50 dark:bg-[#0a0a0a] border border-gray-200 dark:border-[#262626] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#239459]/20 focus:border-[#239459] text-gray-900 dark:text-white placeholder:text-gray-400"
          />
        </div>
        <Link href="/billing/subscription" className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold border border-gray-200 dark:border-[#262626] bg-white dark:bg-[#0a0a0a] text-gray-700 dark:text-white hover:bg-gray-50 dark:hover:bg-[#262626]">
          <Receipt className="w-4 h-4 text-[#239459]" /> My subscription
        </Link>
      </div>

      {actionError && (
        <div className="flex items-start gap-2 rounded-xl border border-red-200 dark:border-red-900/40 bg-red-50 dark:bg-red-900/10 p-3 text-sm text-red-700 dark:text-red-300">
          <ShieldAlert className="w-4 h-4 mt-0.5 shrink-0" /> {actionError}
        </div>
      )}

      {error ? (
        <div className="bg-white dark:bg-[#171717] rounded-xl border border-gray-200 dark:border-[#262626] shadow-sm flex flex-col items-center justify-center py-16 px-6">
          <div className="h-14 w-14 bg-red-50 dark:bg-red-900/20 rounded-full flex items-center justify-center mb-4"><AlertCircle className="h-7 w-7 text-red-500" /></div>
          <h3 className="font-semibold text-gray-900 dark:text-white">Failed to load plans</h3>
          <p className="text-sm text-gray-500 mt-1 mb-4">{error}</p>
          <button onClick={() => void load({ hard: true })} className="inline-flex items-center px-4 py-2 bg-[#239459] text-white rounded-lg text-sm font-medium"><RefreshCw className="h-4 w-4 mr-2" />Retry</button>
        </div>
      ) : loading && plans.length === 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 animate-pulse">
          {Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-72 bg-gray-100 dark:bg-[#171717] rounded-xl border border-gray-200 dark:border-[#262626]" />)}
        </div>
      ) : visiblePlans.length === 0 ? (
        <div className="bg-white dark:bg-[#171717] rounded-xl border border-gray-200 dark:border-[#262626] shadow-sm flex flex-col items-center justify-center py-16 px-6 text-center">
          <div className="h-14 w-14 bg-[#239459]/10 dark:bg-[#239459]/15 rounded-full flex items-center justify-center mb-4"><Crown className="w-7 h-7 text-[#239459]" /></div>
          <h3 className="font-semibold text-gray-900 dark:text-white">No plans available</h3>
          <p className="text-sm text-gray-500 dark:text-[#a1a1aa] mt-1 max-w-md">There are no membership plans published right now. Please check back later or contact support.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {visiblePlans.map((p) => {
            const current = isCurrent(p)
            const busy = busySlug === p.slug
            const price = Number(p.price || 0)
            const yearly = String(p.billing_interval || '').toLowerCase() === 'year'
            const monthlyEquiv = yearly && price > 0 ? price / 12 : null
            const caps = Object.entries(p.capabilities || {}).filter(([, v]) => v === true || (typeof v === 'string' && v.toLowerCase() === 'true')).slice(0, 6)
            const limits = p.limits || {}
            return (
              <div key={p.slug || p.id} className={`bg-white dark:bg-[#171717] rounded-xl border shadow-sm p-5 flex flex-col ${current ? 'border-[#239459] ring-1 ring-[#239459]/30' : 'border-gray-200 dark:border-[#262626]'}`}>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h3 className="font-bold text-gray-900 dark:text-white flex items-center gap-2">
                      <Crown className="w-4 h-4 text-[#239459] shrink-0" /> <span className="truncate">{p.name}</span>
                    </h3>
                    {p.description && <p className="text-xs text-gray-500 dark:text-[#a1a1aa] mt-1 line-clamp-2">{p.description}</p>}
                  </div>
                  {current && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold border bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-300 dark:border-emerald-800 shrink-0">
                      <CheckCircle className="w-3 h-3" /> Current
                    </span>
                  )}
                </div>

                <div className="mt-4">
                  <span className="text-2xl font-bold text-gray-900 dark:text-white">{fmtCurrency(price, p.currency || 'PHP')}</span>
                  <span className="text-sm text-gray-500 dark:text-[#a1a1aa]">{fmtIntervalLabel(p.billing_interval)}</span>
                  {monthlyEquiv !== null && (
                    <p className="text-xs text-gray-500 dark:text-[#a1a1aa] mt-0.5">{fmtCurrency(monthlyEquiv, p.currency || 'PHP')}/mo billed yearly</p>
                  )}
                </div>

                <div className="mt-3 flex flex-wrap gap-1.5 text-xs">
                  {p.commission_percent !== null && p.commission_percent !== undefined && (
                    <span className="px-2 py-1 rounded-full bg-gray-100 dark:bg-[#262626] text-gray-700 dark:text-[#a1a1aa] font-medium">{Number(p.commission_percent)}% commission</span>
                  )}
                  {(p.trial_days ?? 0) > 0 && (
                    <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-[#239459]/10 dark:bg-[#239459]/15 text-[#215035] dark:text-[#7bd0a3] font-medium"><Sparkles className="w-3 h-3" /> {p.trial_days}-day trial</span>
                  )}
                  <span className="px-2 py-1 rounded-full bg-gray-100 dark:bg-[#262626] text-gray-700 dark:text-[#a1a1aa] font-medium capitalize">{String(p.billing_interval || 'month').replace('_', ' ')}</span>
                </div>

                <div className="mt-4 space-y-1.5 text-xs text-gray-600 dark:text-[#a1a1aa]">
                  {limits.max_merchants !== undefined && (
                    <p className="flex items-center gap-1.5"><Store className="w-3.5 h-3.5 text-[#239459]" /> Outlets: <span className="font-semibold text-gray-900 dark:text-white">{fmtLimit(limits.max_merchants as number)}</span></p>
                  )}
                  {limits.max_products !== undefined && (
                    <p className="flex items-center gap-1.5"><Package className="w-3.5 h-3.5 text-[#239459]" /> Products: <span className="font-semibold text-gray-900 dark:text-white">{fmtLimit(limits.max_products as number)}</span></p>
                  )}
                  {Object.entries(limits).filter(([k]) => k !== 'max_merchants' && k !== 'max_products').slice(0, 3).map(([k, v]) => (
                    <p key={k} className="flex items-center gap-1.5"><ShoppingCart className="w-3.5 h-3.5 text-[#239459]" /> <span className="capitalize">{k.replace(/_/g, ' ')}:</span> <span className="font-semibold text-gray-900 dark:text-white">{fmtLimit(v as number)}</span></p>
                  ))}
                  {caps.map(([k]) => (
                    <p key={k} className="flex items-center gap-1.5"><Check className="w-3.5 h-3.5 text-emerald-600" /> <span className="capitalize">{k.replace(/_/g, ' ')}</span></p>
                  ))}
                </div>

                <div className="mt-5 pt-4 border-t border-gray-100 dark:border-[#262626] flex flex-col gap-2">
                  {current ? (
                    <button disabled className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold bg-gray-100 dark:bg-[#262626] text-gray-500 dark:text-[#a1a1aa] cursor-not-allowed">
                      <CheckCircle className="w-4 h-4" /> Current plan
                    </button>
                  ) : !hasActiveSub ? (
                    <button
                      onClick={() => void doCheckout(p)}
                      disabled={busy}
                      className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold bg-[#239459] hover:bg-[#215035] text-white disabled:opacity-50 transition"
                    >
                      <CreditCard className="w-4 h-4" /> {busy ? 'Processing…' : 'Subscribe'}
                    </button>
                  ) : (
                    <div className="flex gap-2">
                      <button
                        onClick={() => void doUpgrade(p)}
                        disabled={busy}
                        className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold bg-[#239459] hover:bg-[#215035] text-white disabled:opacity-50 transition"
                      >
                        <CheckCircle className="w-4 h-4" /> {busy ? 'Processing…' : 'Upgrade'}
                      </button>
                      <button
                        onClick={() => setDowngradeTarget(p)}
                        disabled={busy}
                        className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold border border-gray-200 dark:border-[#262626] bg-white dark:bg-[#0a0a0a] text-gray-700 dark:text-white hover:bg-gray-50 dark:hover:bg-[#262626] disabled:opacity-50"
                      >
                        Downgrade
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      <div className="rounded-xl border border-gray-200 dark:border-[#262626] bg-white dark:bg-[#171717] p-4 text-xs text-gray-500 dark:text-[#a1a1aa]">
        Prices are in <span className="font-semibold text-gray-700 dark:text-white">PHP</span>. Checkout redirects to a secure PayMongo page — your card details never touch our servers.
        Downgrades take effect at the <span className="font-semibold">end of the current billing period</span>. See <Link href="/billing/subscription" className="font-semibold text-[#239459] hover:text-[#215035]">My subscription</Link> for status and invoices.
      </div>

      {downgradeTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={() => setDowngradeTarget(null)}>
          <div className="bg-white dark:bg-[#171717] rounded-xl border border-gray-200 dark:border-[#262626] shadow-xl max-w-md w-full p-5" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between gap-3">
              <h3 className="font-bold text-gray-900 dark:text-white flex items-center gap-2"><Clock className="w-4 h-4 text-amber-500" /> Confirm downgrade</h3>
              <button onClick={() => setDowngradeTarget(null)} className="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-[#262626]"><X className="w-4 h-4 text-gray-500" /></button>
            </div>
            <p className="text-sm text-gray-600 dark:text-[#a1a1aa] mt-2">
              Switch to <span className="font-semibold text-gray-900 dark:text-white">{downgradeTarget.name}</span> ({fmtCurrency(Number(downgradeTarget.price || 0), downgradeTarget.currency || 'PHP')}
              {fmtIntervalLabel(downgradeTarget.billing_interval)})? The change takes effect at the <span className="font-semibold">end of your current billing period</span> — you keep current benefits until then.
            </p>
            <div className="mt-5 flex gap-2">
              <button onClick={() => setDowngradeTarget(null)} className="flex-1 px-4 py-2.5 rounded-lg text-sm font-semibold border border-gray-200 dark:border-[#262626] text-gray-700 dark:text-white">Keep my plan</button>
              <button
                onClick={() => void doDowngrade(downgradeTarget)}
                disabled={busySlug === downgradeTarget.slug}
                className="flex-1 px-4 py-2.5 rounded-lg text-sm font-semibold bg-[#239459] hover:bg-[#215035] text-white disabled:opacity-50"
              >
                {busySlug === downgradeTarget.slug ? 'Processing…' : 'Confirm downgrade'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default function PlansPage() {
  return (
    <ClientOnly fallback={<PlansSkeleton />}>
      <PlansContent />
    </ClientOnly>
  )
}
