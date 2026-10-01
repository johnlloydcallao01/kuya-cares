'use client'

import React, { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { ClientOnly } from '@/components/ClientOnly'
import {
  CreditCard, CheckCircle, Clock, RefreshCw, AlertCircle, Crown,
  X, Tag, Sparkles, Store, ShieldAlert, Receipt, Calendar, DollarSign, Info,
} from '@/components/ui/IconWrapper'

type SubStatus = 'active' | 'trialing' | 'pending' | 'past_due' | 'grace' | 'suspended' | 'cancelled' | 'expired' | 'none'

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
    effectiveAt?: string | null
    plan_snapshot?: { name?: string; price?: number; currency?: string; commission_percent?: number; commissionPercent?: number } | null
    [k: string]: unknown
  } | null
  plan?: { id?: number | string; slug?: string; name?: string; trial_days?: number; trialDays?: number } | null
  trial?: { active?: boolean; endsAt?: string | null; ends_at?: string | null } | null
  grace?: { active?: boolean; daysLeft?: number | null; days_left?: number | null } | null
  entitlements?: { canPublishOutlet?: boolean; canCreateCoupon?: boolean; maxOutlets?: number; max_outlets?: number } | null
  usage?: Record<string, number | null | undefined> | null
  invoices?: Array<{ id: number | string; amount?: number; total?: number; currency?: string; status?: string; createdAt?: string; created_at?: string; paid_at?: string | null }> | null
  [k: string]: unknown
}

type PaywalledInfo = { code: string; subscriptionStatus: SubStatus; requiredPlan?: string | null }

function fmtCurrency(amount: number, currency = 'PHP') {
  try {
    return new Intl.NumberFormat('en-PH', { style: 'currency', currency, minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount)
  } catch { return `₱${Number(amount || 0).toFixed(2)}` }
}

function fmtDate(iso: string | null | undefined) {
  if (!iso) return '—'
  try { return new Date(iso).toLocaleDateString('en-PH', { timeZone: 'Asia/Manila', year: 'numeric', month: 'short', day: 'numeric' }) } catch { return String(iso).slice(0, 10) }
}

function fmtDateTime(iso: string | null | undefined) {
  if (!iso) return '—'
  try { return new Date(iso).toLocaleString('en-PH', { timeZone: 'Asia/Manila', year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) } catch { return String(iso).slice(0, 16) }
}

function subBadge(status: string) {
  const s = status.toLowerCase()
  if (s === 'active' || s === 'trialing') return 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-300 dark:border-emerald-800'
  if (s === 'past_due' || s === 'grace' || s === 'pending') return 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-300 dark:border-amber-800'
  if (s === 'suspended') return 'bg-red-50 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-300 dark:border-red-800'
  if (s === 'cancelled' || s === 'expired') return 'bg-zinc-100 text-zinc-700 border-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:border-zinc-700'
  return 'bg-gray-100 text-gray-700 border-gray-200 dark:bg-[#262626] dark:text-[#a1a1aa] dark:border-[#333]'
}

function invBadge(status: string) {
  const s = (status || '').toLowerCase()
  if (s === 'paid' || s === 'succeeded') return 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-300 dark:border-emerald-800'
  if (s === 'pending' || s === 'open') return 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-300 dark:border-amber-800'
  if (s === 'failed' || s === 'void') return 'bg-red-50 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-300 dark:border-red-800'
  return 'bg-gray-100 text-gray-700 border-gray-200 dark:bg-[#262626] dark:text-[#a1a1aa] dark:border-[#333]'
}

function num(v: number | null | undefined, fallback = 0) {
  return typeof v === 'number' && Number.isFinite(v) ? v : fallback
}

function errMsg(e: unknown, fallback: string) {
  return e instanceof Error ? e.message : fallback
}

async function parseJsonSafe(res: Response) {
  try { return await res.json() } catch { return {} as Record<string, unknown> }
}

function getUsage(usage: Record<string, number | null | undefined> | null | undefined, ...keys: string[]) {
  if (!usage) return undefined
  for (const k of keys) {
    const v = usage[k]
    if (typeof v === 'number') return v
  }
  return undefined
}

function SubscriptionSkeleton() {
  return (
    <div className="space-y-6 py-5 px-2.5">
      <div className="h-8 w-48 bg-gray-200 dark:bg-[#262626] rounded animate-pulse" />
      <div className="h-44 bg-gray-100 dark:bg-[#171717] rounded-xl border border-gray-200 dark:border-[#262626] animate-pulse" />
      <div className="h-32 bg-gray-100 dark:bg-[#171717] rounded-xl animate-pulse" />
    </div>
  )
}

function SubscriptionContent() {
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

  const load = useCallback(async (opts?: { hard?: boolean }) => {
    if (opts?.hard) {
      setData(null)
      setPaywalled(null)
    }
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/membership/subscription?_t=${Date.now()}`, { cache: 'no-store' })
      const j = await parseJsonSafe(res) as SubscriptionPayload & { code?: string; subscriptionStatus?: string; requiredPlan?: string }
      if (res.status === 402) {
        setData(null)
        setPaywalled({
          code: String(j.code || 'SUBSCRIPTION_REQUIRED'),
          subscriptionStatus: (String(j.subscriptionStatus || 'none').toLowerCase() || 'none') as SubStatus,
          requiredPlan: (j.requiredPlan as string | undefined) ?? null,
        })
        return
      }
      if (!res.ok) throw new Error((j as { error?: string })?.error || 'Failed to load subscription')
      setData(j)
      setPaywalled(null)
    } catch (e: unknown) {
      setError(errMsg(e, 'Failed to load subscription'))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void load() }, [load])

  async function mutate(kind: string, url: string, body: Record<string, unknown>) {
    if (busy) return
    setBusy(kind)
    setActionError(null)
    setActionOk(null)
    try {
      const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      const j = await parseJsonSafe(res) as { error?: string; message?: string; code?: string; checkoutUrl?: string; effectiveAt?: string; deduplicated?: boolean }
      if (!res.ok) throw new Error(j.error || j.message || `${kind} failed`)
      if (j.checkoutUrl) {
        window.location.href = j.checkoutUrl
        return
      }
      setActionOk(j.effectiveAt ? `${kind} confirmed — effective ${fmtDate(j.effectiveAt)}.` : `${kind} confirmed.`)
      await load()
    } catch (e: unknown) {
      setActionError(errMsg(e, `${kind} failed`))
    } finally {
      setBusy(null)
    }
  }

  const sub = data?.subscription
  const status = String(sub?.status || '').toLowerCase()
  const trialEndsAt = data?.trial?.endsAt ?? data?.trial?.ends_at ?? sub?.trial_ends_at ?? sub?.trialEndsAt ?? null
  const trialActive = Boolean(data?.trial?.active) || status === 'trialing'
  const trialDaysLeft = trialEndsAt ? Math.max(0, Math.ceil((new Date(trialEndsAt).getTime() - Date.now()) / 86400000)) : 0
  const graceDaysLeft = num(data?.grace?.daysLeft ?? data?.grace?.days_left ?? null, 0)
  const graceActive = Boolean(data?.grace?.active) || status === 'grace'
  const periodEnd = sub?.current_period_end ?? sub?.currentPeriodEnd ?? null
  const cancelAtPeriodEnd = Boolean(sub?.cancelAtPeriodEnd ?? sub?.cancel_at_period_end ?? false)
  const schedRaw = sub?.scheduledPlan ?? sub?.scheduled_plan ?? null
  const schedName = typeof schedRaw === 'string' ? schedRaw : (schedRaw as { name?: string; slug?: string } | null)?.name || (schedRaw as { slug?: string } | null)?.slug || null
  const schedAt = sub?.scheduledEffectiveAt ?? sub?.scheduled_effective_at ?? null
  const snap = sub?.plan_snapshot
  const ent = data?.entitlements
  const usage = data?.usage
  const invoices = Array.isArray(data?.invoices) ? data!.invoices!.slice(0, 5) : []
  const planTrialDays = num(data?.plan?.trial_days ?? data?.plan?.trialDays ?? null, 0)

  const usageRows: Array<{ label: string; used?: number; limit?: number }> = [
    { label: 'Outlets', used: getUsage(usage, 'outlets', 'outlets_used', 'merchants_used', 'merchants'), limit: num(ent?.maxOutlets ?? ent?.max_outlets ?? undefined, undefined as unknown as number) },
    { label: 'Products', used: getUsage(usage, 'products', 'products_used'), limit: getUsage(usage, 'products_limit', 'max_products') },
    { label: 'Orders this cycle', used: getUsage(usage, 'ordersThisCycle', 'orders_current_period', 'orders'), limit: getUsage(usage, 'orders_limit', 'max_orders') },
  ]

  return (
    <div className="space-y-6 py-5 px-2.5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white tracking-tight flex items-center gap-2">
            <span className="h-8 w-8 rounded-lg bg-[#239459] text-white flex items-center justify-center"><Receipt className="w-4 h-4" /></span>
            My Subscription
          </h1>
          <p className="text-sm text-gray-500 dark:text-[#a1a1aa] mt-1">Status, trial and grace periods, entitlements, usage, and recent invoices.</p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/billing/plans" className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold bg-[#239459] hover:bg-[#215035] text-white transition">
            <Crown className="w-4 h-4" /> View plans
          </Link>
          <button
            onClick={() => void load({ hard: true })}
            disabled={loading}
            aria-label="Refresh subscription"
            className="h-9 w-9 inline-flex items-center justify-center bg-white dark:bg-[#171717] border border-gray-200 dark:border-[#262626] rounded-xl hover:bg-gray-50 dark:hover:bg-[#262626] disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 text-gray-600 dark:text-[#a1a1aa] ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {actionError && (
        <div className="flex items-start gap-2 rounded-xl border border-red-200 dark:border-red-900/40 bg-red-50 dark:bg-red-900/10 p-3 text-sm text-red-700 dark:text-red-300">
          <ShieldAlert className="w-4 h-4 mt-0.5 shrink-0" /> {actionError}
        </div>
      )}
      {actionOk && (
        <div className="flex items-start gap-2 rounded-xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-900/10 p-3 text-sm text-emerald-700 dark:text-emerald-300">
          <CheckCircle className="w-4 h-4 mt-0.5 shrink-0" /> {actionOk}
        </div>
      )}

      {error ? (
        <div className="bg-white dark:bg-[#171717] rounded-xl border border-gray-200 dark:border-[#262626] shadow-sm flex flex-col items-center justify-center py-16 px-6">
          <div className="h-14 w-14 bg-red-50 dark:bg-red-900/20 rounded-full flex items-center justify-center mb-4"><AlertCircle className="h-7 w-7 text-red-500" /></div>
          <h3 className="font-semibold text-gray-900 dark:text-white">Failed to load subscription</h3>
          <p className="text-sm text-gray-500 mt-1 mb-4">{error}</p>
          <button onClick={() => void load({ hard: true })} className="inline-flex items-center px-4 py-2 bg-[#239459] text-white rounded-lg text-sm font-medium"><RefreshCw className="h-4 w-4 mr-2" />Retry</button>
        </div>
      ) : loading && !data && !paywalled ? (
        <div className="space-y-4 animate-pulse">
          <div className="h-44 bg-gray-100 dark:bg-[#171717] rounded-xl border border-gray-200 dark:border-[#262626]" />
          <div className="h-32 bg-gray-100 dark:bg-[#171717] rounded-xl" />
        </div>
      ) : paywalled ? (
        <div className="bg-white dark:bg-[#171717] rounded-xl border border-amber-200 dark:border-amber-900/40 shadow-sm p-8 text-center">
          <div className="h-14 w-14 bg-amber-50 dark:bg-amber-900/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <ShieldAlert className="h-7 w-7 text-amber-500" />
          </div>
          <h2 className="text-lg font-bold text-gray-900 dark:text-white">
            {paywalled.subscriptionStatus === 'pending' ? 'Complete your payment' : paywalled.subscriptionStatus === 'past_due' || paywalled.subscriptionStatus === 'grace' ? 'Payment past due' : paywalled.subscriptionStatus === 'suspended' || paywalled.subscriptionStatus === 'cancelled' || paywalled.subscriptionStatus === 'expired' ? 'Subscription inactive — resubscribe' : 'No active subscription'}
          </h2>
          <p className="text-sm text-gray-500 dark:text-[#a1a1aa] mt-1 max-w-md mx-auto">
            {paywalled.subscriptionStatus === 'pending' && 'Your subscription is awaiting payment. Complete checkout to activate publishing and coupons.'}
            {(paywalled.subscriptionStatus === 'past_due' || paywalled.subscriptionStatus === 'grace') && 'Your payment failed. Pay now to keep your outlets live during the grace window.'}
            {(paywalled.subscriptionStatus === 'suspended' || paywalled.subscriptionStatus === 'cancelled' || paywalled.subscriptionStatus === 'expired') && 'Your subscription is no longer active. Pick a plan to restore publishing and coupons.'}
            {paywalled.subscriptionStatus === 'none' && 'Publishing and coupons require an active membership. Choose a plan to get started.'}
            {paywalled.requiredPlan ? ` Required plan: ${paywalled.requiredPlan}.` : ''}
          </p>
          <div className="mt-6 flex flex-col sm:flex-row items-center justify-center gap-2">
            {paywalled.subscriptionStatus === 'none' && (
              <Link href="/billing/plans" className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold bg-[#239459] hover:bg-[#215035] text-white"><Crown className="w-4 h-4" /> Choose a plan</Link>
            )}
            {paywalled.subscriptionStatus === 'pending' && (
              <button onClick={() => void mutate('Renew', '/api/membership/renew', {})} disabled={busy !== null} className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold bg-[#239459] hover:bg-[#215035] text-white disabled:opacity-50"><CreditCard className="w-4 h-4" /> {busy ? 'Processing…' : 'Complete payment'}</button>
            )}
            {(paywalled.subscriptionStatus === 'past_due' || paywalled.subscriptionStatus === 'grace') && (
              <button onClick={() => void mutate('Renew', '/api/membership/renew', {})} disabled={busy !== null} className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold bg-[#239459] hover:bg-[#215035] text-white disabled:opacity-50"><DollarSign className="w-4 h-4" /> {busy ? 'Processing…' : 'Pay now'}</button>
            )}
            {(paywalled.subscriptionStatus === 'suspended' || paywalled.subscriptionStatus === 'cancelled' || paywalled.subscriptionStatus === 'expired') && (
              <Link href="/billing/plans" className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold bg-[#239459] hover:bg-[#215035] text-white"><RefreshCw className="w-4 h-4" /> Resubscribe</Link>
            )}
          </div>
        </div>
      ) : data && sub ? (
        <>
          {schedName && (
            <div className="flex items-start gap-2 rounded-xl border border-blue-200 dark:border-blue-900/40 bg-blue-50 dark:bg-blue-900/10 p-3 text-sm text-blue-700 dark:text-blue-300">
              <Info className="w-4 h-4 mt-0.5 shrink-0" />
              <span>Scheduled change to <span className="font-semibold">{schedName}</span>{schedAt ? <> — effective {fmtDate(schedAt)}</> : ' — takes effect at period end'}. Downgrades apply at the end of the current billing period.</span>
            </div>
          )}
          {cancelAtPeriodEnd && (
            <div className="flex items-start gap-2 rounded-xl border border-amber-200 dark:border-amber-900/40 bg-amber-50 dark:bg-amber-900/10 p-3 text-sm text-amber-700 dark:text-amber-300">
              <Clock className="w-4 h-4 mt-0.5 shrink-0" />
              <span>Cancellation scheduled — you keep access until {fmtDate(periodEnd)}. Renew to stay subscribed.</span>
            </div>
          )}

          <div className="bg-white dark:bg-[#171717] rounded-xl border border-gray-200 dark:border-[#262626] shadow-sm p-5">
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
              <div>
                <p className="text-xs font-medium text-gray-500 dark:text-[#a1a1aa]">Current plan</p>
                <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2 mt-0.5">
                  <Crown className="w-5 h-5 text-[#239459]" /> {data?.plan?.name || snap?.name || 'Membership'}
                </h2>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold border capitalize ${subBadge(status || 'unknown')}`}>{status || 'unknown'}</span>
                  {trialActive && trialEndsAt && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold border bg-[#239459]/10 dark:bg-[#239459]/15 text-[#215035] dark:text-[#7bd0a3] border-[#239459]/30">
                      <Sparkles className="w-3 h-3" /> Trial ends {fmtDate(trialEndsAt)} ({trialDaysLeft}d left)
                    </span>
                  )}
                  {graceActive && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold border bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-300 dark:border-amber-800">
                      <Clock className="w-3 h-3" /> Grace: {graceDaysLeft}d left
                    </span>
                  )}
                </div>
              </div>
              <div className="text-sm text-gray-600 dark:text-[#a1a1aa] sm:text-right">
                <p className="flex items-center gap-1.5 sm:justify-end"><Calendar className="w-4 h-4 text-[#239459]" /> Period ends <span className="font-semibold text-gray-900 dark:text-white">{fmtDate(periodEnd)}</span></p>
                {(snap?.price !== undefined && snap?.price !== null) && (
                  <p className="mt-1">{fmtCurrency(Number(snap.price), snap.currency || 'PHP')}{snap.commission_percent !== undefined && snap.commission_percent !== null ? ` • ${Number(snap.commission_percent)}% commission` : ''}</p>
                )}
              </div>
            </div>

            <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
              <div className="rounded-lg border border-gray-200 dark:border-[#262626] bg-gray-50 dark:bg-[#0a0a0a] p-3 flex items-center gap-2">
                <Store className="w-4 h-4 text-[#239459] shrink-0" />
                <span className="text-gray-600 dark:text-[#a1a1aa]">Publish outlet</span>
                <span className={`ml-auto font-bold ${ent?.canPublishOutlet ? 'text-emerald-600 dark:text-emerald-400' : 'text-gray-400'}`}>{ent?.canPublishOutlet ? 'Yes' : 'No'}</span>
              </div>
              <div className="rounded-lg border border-gray-200 dark:border-[#262626] bg-gray-50 dark:bg-[#0a0a0a] p-3 flex items-center gap-2">
                <Tag className="w-4 h-4 text-[#239459] shrink-0" />
                <span className="text-gray-600 dark:text-[#a1a1aa]">Create coupons</span>
                <span className={`ml-auto font-bold ${ent?.canCreateCoupon ? 'text-emerald-600 dark:text-emerald-400' : 'text-gray-400'}`}>{ent?.canCreateCoupon ? 'Yes' : 'No'}</span>
              </div>
              <div className="rounded-lg border border-gray-200 dark:border-[#262626] bg-gray-50 dark:bg-[#0a0a0a] p-3 flex items-center gap-2">
                <Store className="w-4 h-4 text-[#239459] shrink-0" />
                <span className="text-gray-600 dark:text-[#a1a1aa]">Max outlets</span>
                <span className="ml-auto font-bold text-gray-900 dark:text-white">{num(ent?.maxOutlets ?? ent?.max_outlets ?? undefined, -1) === -1 ? '∞' : String(ent?.maxOutlets ?? ent?.max_outlets)}</span>
              </div>
            </div>

            <div className="mt-4 space-y-3">
              {usageRows.map((r) => {
                const used = r.used ?? 0
                const limit = r.limit
                const unlimited = limit === -1 || limit === undefined
                const pct = unlimited || !limit ? 0 : Math.min(100, Math.round((used / Math.max(1, limit)) * 100))
                return (
                  <div key={r.label}>
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="font-medium text-gray-600 dark:text-[#a1a1aa]">{r.label}</span>
                      <span className="font-semibold text-gray-900 dark:text-white">{used} / {unlimited ? '∞' : (limit ?? '—')}</span>
                    </div>
                    <div className="h-2 rounded-full bg-gray-100 dark:bg-[#262626] overflow-hidden">
                      <div className="h-full rounded-full bg-[#239459] transition-all" style={{ width: `${unlimited ? 8 : pct}%` }} />
                    </div>
                  </div>
                )
              })}
            </div>

            <div className="mt-5 pt-4 border-t border-gray-100 dark:border-[#262626] flex flex-col sm:flex-row gap-2">
              <button onClick={() => void mutate('Renew', '/api/membership/renew', {})} disabled={busy !== null} className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold bg-[#239459] hover:bg-[#215035] text-white disabled:opacity-50">
                <RefreshCw className={`w-4 h-4 ${busy === 'Renew' ? 'animate-spin' : ''}`} /> {busy === 'Renew' ? 'Processing…' : 'Renew'}
              </button>
              <button onClick={() => setShowCancel(true)} disabled={busy !== null} className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold border border-gray-200 dark:border-[#262626] bg-white dark:bg-[#0a0a0a] text-gray-700 dark:text-white hover:bg-gray-50 dark:hover:bg-[#262626] disabled:opacity-50">
                <X className="w-4 h-4" /> Cancel
              </button>
              {planTrialDays > 0 && !trialActive && (
                <button onClick={() => void mutate('Trial', '/api/membership/trial', { planSlug: data?.plan?.slug })} disabled={busy !== null || !data?.plan?.slug} className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold border border-[#239459]/40 text-[#215035] dark:text-[#7bd0a3] hover:bg-[#239459]/10 disabled:opacity-50">
                  <Sparkles className="w-4 h-4" /> {busy === 'Trial' ? 'Processing…' : `Start ${planTrialDays}-day trial`}
                </button>
              )}
            </div>

            <div className="mt-3 flex flex-col sm:flex-row gap-2">
              <div className="relative flex-1">
                <Tag className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input value={coupon} onChange={(e) => setCoupon(e.target.value)} placeholder="Coupon code" className="w-full pl-9 pr-3 py-2.5 text-sm bg-gray-50 dark:bg-[#0a0a0a] border border-gray-200 dark:border-[#262626] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#239459]/20 focus:border-[#239459] text-gray-900 dark:text-white placeholder:text-gray-400" />
              </div>
              <button onClick={() => void mutate('Coupon', '/api/membership/coupon', { code: coupon.trim() })} disabled={busy !== null || !coupon.trim()} className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold border border-gray-200 dark:border-[#262626] bg-white dark:bg-[#0a0a0a] text-gray-700 dark:text-white hover:bg-gray-50 dark:hover:bg-[#262626] disabled:opacity-50">
                <Tag className="w-4 h-4 text-[#239459]" /> {busy === 'Coupon' ? 'Applying…' : 'Attach coupon'}
              </button>
            </div>
          </div>

          <div className="bg-white dark:bg-[#171717] rounded-xl border border-gray-200 dark:border-[#262626] shadow-sm overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100 dark:border-[#262626] flex items-center justify-between">
              <h3 className="font-semibold text-gray-900 dark:text-white text-sm flex items-center gap-2"><DollarSign className="w-4 h-4 text-[#239459]" /> Recent invoices</h3>
              <Link href="/billing/invoices" className="text-xs font-semibold text-[#239459] hover:text-[#215035]">View all</Link>
            </div>
            {invoices.length === 0 ? (
              <p className="px-4 py-6 text-sm text-gray-500 dark:text-[#a1a1aa] text-center">No invoices yet — they appear after checkout.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 dark:bg-[#0a0a0a] text-xs text-gray-500 dark:text-[#a1a1aa] border-b border-gray-200 dark:border-[#262626]">
                    <tr>
                      <th className="text-left px-4 py-3 font-medium">Invoice</th>
                      <th className="text-left px-4 py-3 font-medium">Status</th>
                      <th className="text-right px-4 py-3 font-medium">Amount</th>
                      <th className="text-left px-4 py-3 font-medium hidden md:table-cell">Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-[#262626]">
                    {invoices.map((inv) => (
                      <tr key={inv.id} className="hover:bg-gray-50 dark:hover:bg-[#0a0a0a]/50 transition">
                        <td className="px-4 py-3 font-semibold text-gray-900 dark:text-white text-xs">#{String(inv.id)}</td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold border capitalize ${invBadge(String(inv.status || 'unknown'))}`}>{String(inv.status || 'unknown')}</span>
                        </td>
                        <td className="px-4 py-3 text-right font-semibold text-gray-900 dark:text-white text-xs">{fmtCurrency(Number(inv.amount ?? inv.total ?? 0), inv.currency || 'PHP')}</td>
                        <td className="px-4 py-3 hidden md:table-cell text-xs text-gray-500 dark:text-[#a1a1aa]">{fmtDateTime(inv.createdAt ?? inv.created_at ?? null)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      ) : null}

      {showCancel && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={() => setShowCancel(false)}>
          <div className="bg-white dark:bg-[#171717] rounded-xl border border-gray-200 dark:border-[#262626] shadow-xl max-w-md w-full p-5" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between gap-3">
              <h3 className="font-bold text-gray-900 dark:text-white">Cancel subscription?</h3>
              <button onClick={() => setShowCancel(false)} className="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-[#262626]"><X className="w-4 h-4 text-gray-500" /></button>
            </div>
            <label className="mt-4 flex items-center justify-between gap-3 rounded-lg border border-gray-200 dark:border-[#262626] p-3 text-sm cursor-pointer">
              <span className="text-gray-700 dark:text-white font-medium">Cancel at period end <span className="block text-xs font-normal text-gray-500 dark:text-[#a1a1aa]">Keep access until {fmtDate(periodEnd)} (recommended)</span></span>
              <button
                role="switch"
                aria-checked={cancelAtEnd}
                onClick={() => setCancelAtEnd((v) => !v)}
                className={`relative h-6 w-11 rounded-full transition shrink-0 ${cancelAtEnd ? 'bg-[#239459]' : 'bg-gray-200 dark:bg-[#262626]'}`}
              >
                <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${cancelAtEnd ? 'left-[22px]' : 'left-0.5'}`} />
              </button>
            </label>
            <input value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} placeholder="Reason (optional)" className="mt-3 w-full px-3 py-2.5 text-sm bg-gray-50 dark:bg-[#0a0a0a] border border-gray-200 dark:border-[#262626] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#239459]/20 focus:border-[#239459] text-gray-900 dark:text-white placeholder:text-gray-400" />
            <div className="mt-5 flex gap-2">
              <button onClick={() => setShowCancel(false)} className="flex-1 px-4 py-2.5 rounded-lg text-sm font-semibold border border-gray-200 dark:border-[#262626] text-gray-700 dark:text-white">Keep my plan</button>
              <button
                onClick={async () => {
                  setShowCancel(false)
                  await mutate('Cancel', '/api/membership/cancel', { cancelAtPeriodEnd: cancelAtEnd, ...(cancelReason.trim() ? { reason: cancelReason.trim() } : {}) })
                }}
                disabled={busy !== null}
                className="flex-1 px-4 py-2.5 rounded-lg text-sm font-semibold bg-red-600 hover:bg-red-700 text-white disabled:opacity-50"
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

export default function SubscriptionPage() {
  return (
    <ClientOnly fallback={<SubscriptionSkeleton />}>
      <SubscriptionContent />
    </ClientOnly>
  )
}
