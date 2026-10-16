'use client'

import React, { Suspense, useEffect, useMemo, useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useQueryClient } from '@tanstack/react-query'
import { QUERY_KEYS } from '@encreasl/client-services'
import { ClientOnly } from '@/components/ClientOnly'
import { fetchInstitutions, postCreateLink, postPaymentRefund, postPaymentSync, postSendFunds, useGatewayAccount, useGatewayPayments, type GatewayPayment, type ReceivingInstitution } from '@/hooks/useGatewayPayments'
import {
  CreditCard, RefreshCw, Search, X, FileText, AlertCircle, Banknote, Coins, CalendarDays, Receipt,
} from '@/components/ui/IconWrapper'

const STATUS_OPTS = ['paid', 'failed', 'refunded']
const REFUND_REASONS = ['others', 'duplicate', 'fraudulent']

function fmtPHP(n: number) {
  return `₱${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}
function fmtDateTime(iso: string | null) {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleString('en-PH', { timeZone: 'Asia/Manila', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
  } catch {
    return iso.slice(0, 16)
  }
}

function statusBadge(s: string) {
  const v = (s || '').toLowerCase()
  if (v === 'paid' || v === 'succeeded') return 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-300'
  if (v === 'failed') return 'bg-red-50 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-300'
  if (v === 'refunded' || v === 'partially_refunded') return 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-300'
  return 'bg-gray-100 text-gray-700 border-gray-200 dark:bg-[#262626] dark:text-[#a1a1aa] dark:border-[#333]'
}

function KpiCard({ title, value, sub, icon, iconBg }: { title: string; value: string; sub?: string; icon: React.ReactNode; iconBg: string }) {
  return (
    <div className="bg-white dark:bg-[#171717] rounded-xl border border-gray-200 dark:border-[#262626] p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium text-gray-500 dark:text-[#a1a1aa] truncate">{title}</p>
          <p className="text-lg font-bold text-gray-900 dark:text-white mt-1 truncate">{value}</p>
          {sub && <p className="text-xs text-gray-500 dark:text-[#a1a1aa] mt-1 truncate">{sub}</p>}
        </div>
        <div className={`h-9 w-9 rounded-xl flex items-center justify-center shrink-0 ${iconBg}`}>{icon}</div>
      </div>
    </div>
  )
}

function PaymentsSkeleton() {
  return (
    <div className="space-y-6 py-5 px-2.5">
      <div className="h-8 w-48 bg-gray-200 dark:bg-[#262626] rounded animate-pulse" />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 animate-pulse">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-[86px] bg-gray-100 dark:bg-[#171717] rounded-xl border border-gray-200 dark:border-[#262626]" />
        ))}
      </div>
    </div>
  )
}

function PaymentsPageContent() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const [status, setStatus] = useState(() => {
    const s = searchParams.get('status') ?? ''
    return STATUS_OPTS.includes(s) ? s : ''
  })
  const [q, setQ] = useState(() => searchParams.get('q') ?? '')
  const [debouncedQ, setDebouncedQ] = useState(() => searchParams.get('q') ?? '')
  const [cursor, setCursor] = useState<{ after?: string; before?: string }>({})
  const [refundTarget, setRefundTarget] = useState<GatewayPayment | null>(null)
  const [refundAmount, setRefundAmount] = useState('')
  const [refundReason, setRefundReason] = useState('others')
  const [refundNotes, setRefundNotes] = useState('')
  const [refundBusy, setRefundBusy] = useState(false)
  const [refundMsg, setRefundMsg] = useState<string | null>(null)
  const [syncResult, setSyncResult] = useState<Record<string, any> | null>(null)
  const [syncBusyId, setSyncBusyId] = useState<string | null>(null)
  const [sendOpen, setSendOpen] = useState(false)
  const [sendProvider, setSendProvider] = useState('instapay')
  const [institutions, setInstitutions] = useState<ReceivingInstitution[]>([])
  const [institutionsLoading, setInstitutionsLoading] = useState(false)
  const [sendBankName, setSendBankName] = useState('')
  const [sendBic, setSendBic] = useState('')
  const [sendNumber, setSendNumber] = useState('')
  const [sendName, setSendName] = useState('')
  const [sendAmount, setSendAmount] = useState('')
  const [sendDesc, setSendDesc] = useState('')
  const [sendBusy, setSendBusy] = useState(false)
  const [sendMsg, setSendMsg] = useState<string | null>(null)
  const [linkOpen, setLinkOpen] = useState(false)
  const [linkAmount, setLinkAmount] = useState('')
  const [linkDesc, setLinkDesc] = useState('')
  const [linkBusy, setLinkBusy] = useState(false)
  const [linkMsg, setLinkMsg] = useState<string | null>(null)
  const [linkUrl, setLinkUrl] = useState<string | null>(null)
  const [topupOpen, setTopupOpen] = useState(false)

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(q.trim()), 400)
    return () => clearTimeout(t)
  }, [q])

  // Shareable URL: range-free cursor pagination is session-only; status+q are shared.
  useEffect(() => {
    const p = new URLSearchParams()
    if (status) p.set('status', status)
    if (debouncedQ) p.set('q', debouncedQ)
    const next = p.toString()
    if (next !== searchParams.toString()) router.replace(`${pathname}${next ? `?${next}` : ''}`, { scroll: false })
  }, [status, debouncedQ, pathname, router, searchParams])

  const qs = useMemo(() => {
    const p = new URLSearchParams()
    p.set('limit', '10')
    if (status) p.set('status', status)
    if (debouncedQ) p.set('search', debouncedQ)
    if (cursor.after) p.set('after', cursor.after)
    if (cursor.before) p.set('before', cursor.before)
    return p.toString()
  }, [status, debouncedQ, cursor])

  const queryClient = useQueryClient()
  const [hardRefreshing, setHardRefreshing] = useState(false)
  const { data, isPending, isFetching, isError, error: queryError, refetch } = useGatewayPayments(qs)
  const { data: account } = useGatewayAccount()
  const isInitialLoading = isPending || hardRefreshing
  const loading = isFetching || hardRefreshing

  const handleHardRefresh = () => {
    if (hardRefreshing) return
    setHardRefreshing(true)
    void (async () => {
      try {
        queryClient.removeQueries({ queryKey: QUERY_KEYS.adminGatewayPayments(qs) })
        await refetch({ cancelRefetch: true })
      } finally {
        setHardRefreshing(false)
      }
    })()
  }

  const resetCursor = () => setCursor({})
  const rows = data?.payments ?? []
  const gross = rows.reduce((s, r) => s + r.amount, 0)
  const net = rows.reduce((s, r) => s + r.net_amount, 0)
  const matched = data?.meta.matched ?? 0
  const ReconBadge = ({ row }: { row: GatewayPayment }) =>
    row.reconciled ? (
      <span className="inline-flex px-2 py-0.5 rounded-full text-[11px] font-semibold border bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-300">Matched</span>
    ) : (
      <span className="inline-flex px-2 py-0.5 rounded-full text-[11px] font-semibold border bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-300" title={row.mismatches.join(', ')}>
        {row.mismatches.join(', ') || 'Check'}
      </span>
    )

  const handleExport = () => {
    if (!rows.length) return
    const headers = ['Payment ID', 'Intent ID', 'Status', 'Method', 'Amount', 'Fee', 'Net', 'Payer', 'Order', 'Local Status', 'Reconciled', 'Paid At']
    const csvRows = rows.map((r) => [
      r.id, r.payment_intent_id, r.status, r.payment_method, r.amount.toFixed(2), r.fee.toFixed(2), r.net_amount.toFixed(2),
      `"${(r.billing_name || r.billing_email || '').replace(/"/g, '""')}"`,
      r.local ? String(r.local.orderId) : '', r.local?.status ?? '', r.reconciled ? 'yes' : 'no', r.paid_at ?? '',
    ])
    const csv = [headers.join(','), ...csvRows.map((r) => r.join(','))].join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `gateway-payments-${new Date().toISOString().slice(0, 10)}.csv`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const openRefund = (row: GatewayPayment) => {
    setRefundTarget(row)
    setRefundMsg(null)
    setRefundNotes('')
    setRefundReason('others')
    const remaining = row.local ? Math.max(0, row.local.amount - row.local.refunded_amount) : row.amount
    setRefundAmount(remaining > 0 ? remaining.toFixed(2) : '')
  }

  const submitRefund = async () => {
    if (!refundTarget || refundBusy) return
    setRefundBusy(true)
    setRefundMsg(null)
    try {
      const body: Record<string, unknown> = { reason: refundReason }
      if (refundTarget.local) body.transaction_id = refundTarget.local.transactionId
      else body.payment_id = refundTarget.id
      const amt = Number(refundAmount)
      if (Number.isFinite(amt) && amt > 0) body.amount = amt
      if (refundNotes.trim()) body.notes = refundNotes.trim()
      const j = await postPaymentRefund(body as { transaction_id?: number; payment_id?: string; amount?: number; reason: string; notes?: string })
      setRefundMsg(`Refund ${j?.refund?.id ?? ''} issued. Local status finalizes on webhook.`)
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.adminGatewayPayments() })
    } catch (e) {
      setRefundMsg(e instanceof Error ? e.message : 'Refund failed')
    } finally {
      setRefundBusy(false)
    }
  }

  const runSync = async (row: GatewayPayment) => {
    if (!row.local || syncBusyId) return
    setSyncBusyId(row.id)
    setSyncResult(null)
    try {
      const j = await postPaymentSync(row.local.transactionId)
      setSyncResult(j)
    } catch (e) {
      setSyncResult({ error: e instanceof Error ? e.message : 'Sync failed' })
    } finally {
      setSyncBusyId(null)
    }
  }

  const loadInstitutions = async (provider: string) => {
    setInstitutionsLoading(true)
    try {
      setInstitutions(await fetchInstitutions(provider))
    } catch {
      setInstitutions([])
    } finally {
      setInstitutionsLoading(false)
    }
  }

  const openSend = () => {
    setSendMsg(null)
    setSendOpen(true)
    void loadInstitutions(sendProvider)
  }

  const submitSend = async () => {
    if (sendBusy) return
    setSendBusy(true)
    setSendMsg(null)
    try {
      const amt = Number(sendAmount)
      if (!Number.isFinite(amt) || amt <= 0) throw new Error('Enter a positive amount in PHP')
      const bic = sendBic.trim() || (institutions.find((i) => i.name.toLowerCase() === sendBankName.trim().toLowerCase())?.bic ?? '')
      if (!bic) throw new Error('Pick the recipient bank/e-wallet so its code (BIC) is filled in')
      const j = await postSendFunds({
        destination_number: sendNumber.trim(),
        destination_name: sendName.trim(),
        destination_bic: bic,
        amount: amt,
        provider: sendProvider,
        description: sendDesc.trim() || 'Disbursement',
      })
      setSendMsg(`Submitted (transfer ${j?.transfer?.id ?? j?.batch_id ?? 'pending'}). Real money moves on ${data?.meta.mode === 'live' ? 'LIVE' : 'sandbox'} PayMongo.`)
    } catch (e) {
      setSendMsg(e instanceof Error ? e.message : 'Send failed')
    } finally {
      setSendBusy(false)
    }
  }

  const submitLink = async () => {
    if (linkBusy) return
    setLinkBusy(true)
    setLinkMsg(null)
    setLinkUrl(null)
    try {
      const amt = Number(linkAmount)
      if (!Number.isFinite(amt) || amt < 1) throw new Error('Amount must be at least ₱1')
      if (!linkDesc.trim()) throw new Error('Add a short description for the payer')
      const link = await postCreateLink({ amount: amt, description: linkDesc.trim() })
      setLinkUrl(link.checkout_url)
      setLinkMsg(`Link ${link.reference_number} ready — single use, share the URL below.`)
    } catch (e) {
      setLinkMsg(e instanceof Error ? e.message : 'Link creation failed')
    } finally {
      setLinkBusy(false)
    }
  }

  return (
    <div className="space-y-6 py-5 px-2.5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-lg bg-[#239459] text-white flex items-center justify-center shrink-0">
            <CreditCard className="w-4 h-4" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white tracking-tight flex items-center gap-2">
              Payments
              {data && (
                <span className={`inline-flex px-2 py-0.5 rounded-full text-[11px] font-semibold border uppercase ${data.meta.mode === 'live' ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-300' : 'bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-900/20 dark:text-sky-300'}`}>
                  {data.meta.mode}
                </span>
              )}
            </h1>
            <p className="text-sm text-gray-500 dark:text-[#a1a1aa]">PayMongo gateway payments reconciled with local orders</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={handleHardRefresh} disabled={loading} className="h-9 w-9 inline-flex items-center justify-center bg-white dark:bg-[#171717] border border-gray-200 dark:border-[#262626] rounded-xl">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button onClick={handleExport} disabled={!rows.length} className="inline-flex items-center gap-2 px-4 py-2.5 bg-white dark:bg-[#171717] border border-gray-200 dark:border-[#262626] rounded-xl text-sm font-medium text-gray-700 dark:text-[#a1a1aa] hover:bg-gray-50 dark:hover:bg-[#262626] disabled:opacity-50">
            <FileText className="w-4 h-4" /> Export CSV
          </button>
          <button onClick={openSend} className="inline-flex items-center gap-2 px-4 py-2.5 bg-[#239459] text-white rounded-xl text-sm font-semibold hover:bg-[#215035] dark:hover:bg-[#1a7a45]">
            <Banknote className="w-4 h-4" /> Send
          </button>
          <button onClick={() => { setLinkOpen(true); setLinkMsg(null); setLinkUrl(null) }} className="inline-flex items-center gap-2 px-4 py-2.5 bg-white dark:bg-[#171717] border border-gray-200 dark:border-[#262626] rounded-xl text-sm font-medium text-gray-700 dark:text-[#a1a1aa] hover:bg-gray-50 dark:hover:bg-[#262626]">
            <Receipt className="w-4 h-4" /> Create Link
          </button>
          <button onClick={() => setTopupOpen(true)} className="inline-flex items-center gap-2 px-4 py-2.5 bg-white dark:bg-[#171717] border border-gray-200 dark:border-[#262626] rounded-xl text-sm font-medium text-gray-700 dark:text-[#a1a1aa] hover:bg-gray-50 dark:hover:bg-[#262626]">
            <Coins className="w-4 h-4" /> Top Up
          </button>
        </div>
      </div>

      {isError && (
        <div className="flex flex-col items-center justify-center py-10 bg-white dark:bg-[#171717] rounded-xl border border-gray-200 dark:border-[#262626]">
          <div className="h-12 w-12 bg-red-50 dark:bg-red-900/20 rounded-full flex items-center justify-center mb-3">
            <AlertCircle className="h-6 w-6 text-red-500" />
          </div>
          <p className="text-sm text-gray-500 px-4 text-center">{queryError instanceof Error ? queryError.message : 'Failed to load'}</p>
          <button onClick={() => refetch()} className="mt-3 px-4 py-2 bg-[#239459] text-white rounded-lg text-sm font-medium">Retry</button>
        </div>
      )}

      {isInitialLoading || !data ? (
        <PaymentsSkeleton />
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <KpiCard
              title="PayMongo balance"
              value={account ? fmtPHP(account.totals.available) : '—'}
              sub={account ? `Pending ${fmtPHP(account.totals.pending)}${account.totals.wallets > 1 ? ` • ${account.totals.wallets} wallets` : ''}` : 'Live gateway balance'}
              icon={<Banknote className="w-5 h-5 text-white" />}
              iconBg="bg-[#239459]"
            />
            <KpiCard
              title="Next payout"
              value={account?.schedule?.next ? fmtPHP(account.schedule.next.amount) : '—'}
              sub={
                account?.schedule?.next
                  ? `Arrives ${fmtDateTime(account.schedule.next.receive_at)}${account.schedule.type ? ` • ${account.schedule.type}` : ''}`
                  : 'No upcoming payout'
              }
              icon={<CalendarDays className="w-5 h-5 text-white" />}
              iconBg="bg-sky-600"
            />
            <KpiCard title="Gateway gross (page)" value={fmtPHP(gross)} sub={`${rows.length} payments`} icon={<Coins className="w-5 h-5 text-white" />} iconBg="bg-teal-600" />
            <KpiCard title="Gateway net (page)" value={fmtPHP(net)} sub="After PayMongo fees" icon={<Banknote className="w-5 h-5 text-white" />} iconBg="bg-emerald-600" />
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <KpiCard title="Matched" value={`${matched}/${rows.length}`} sub="Linked to local orders" icon={<CreditCard className="w-5 h-5 text-white" />} iconBg="bg-emerald-600" />
            <KpiCard title="Unmatched" value={String(rows.length - matched)} sub="No local transaction" icon={<AlertCircle className="w-5 h-5 text-white" />} iconBg="bg-amber-600" />
          </div>

          <div className="bg-white dark:bg-[#171717] rounded-xl border border-gray-200 dark:border-[#262626] shadow-sm overflow-hidden">
            <div className="p-4 border-b border-gray-200 dark:border-[#262626] space-y-3">
              <div className="relative flex-1">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  value={q}
                  onChange={(e) => { setQ(e.target.value); }}
                  placeholder="Search payment ID, intent, payer, order…"
                  className="w-full pl-9 pr-9 py-2.5 text-sm bg-gray-50 dark:bg-[#0a0a0a] border border-gray-200 dark:border-[#262626] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#239459]/20 focus:border-[#239459] text-gray-900 dark:text-white placeholder:text-gray-400"
                />
                {q && (
                  <button onClick={() => setQ('')} className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-full hover:bg-gray-100 dark:hover:bg-[#262626]">
                    <X className="w-4 h-4 text-gray-400" />
                  </button>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                {STATUS_OPTS.map((s) => {
                  const active = status === s
                  return (
                    <button
                      key={s}
                      onClick={() => { setStatus(active ? '' : s); resetCursor() }}
                      className={`px-2.5 py-1 rounded-full text-xs font-medium border capitalize ${active ? 'bg-[#239459] text-white border-[#239459]' : 'bg-white dark:bg-[#0a0a0a] text-gray-700 dark:text-[#a1a1aa] border-gray-200 dark:border-[#262626]'}`}
                    >
                      {s}
                    </button>
                  )
                })}
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 dark:bg-[#0a0a0a] text-xs text-gray-500 dark:text-[#a1a1aa] border-b border-gray-200 dark:border-[#262626]">
                  <tr>
                    <th className="text-left px-4 py-3 font-medium">Payment</th>
                    <th className="text-left px-4 py-3 font-medium hidden lg:table-cell">Payer / Order</th>
                    <th className="text-left px-4 py-3 font-medium">Method</th>
                    <th className="text-left px-4 py-3 font-medium">Status</th>
                    <th className="text-right px-4 py-3 font-medium">Amount</th>
                    <th className="text-left px-4 py-3 font-medium hidden md:table-cell">Recon</th>
                    <th className="text-right px-4 py-3 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-[#262626]">
                  {rows.map((r) => (
                    <tr key={r.id} className="hover:bg-gray-50 dark:hover:bg-[#0a0a0a]/50">
                      <td className="px-4 py-2.5">
                        <div className="font-mono text-xs text-gray-900 dark:text-white">{r.id}</div>
                        <div className="font-mono text-[11px] text-gray-500 truncate max-w-[220px]">{r.payment_intent_id}</div>
                        <div className="text-[11px] text-gray-500">{fmtDateTime(r.paid_at)}</div>
                      </td>
                      <td className="px-4 py-2.5 hidden lg:table-cell">
                        <div className="text-gray-900 dark:text-white">{r.billing_name || r.billing_email || '—'}</div>
                        {r.local ? (
                          <a href={`/orders/${r.local.orderId}`} className="text-xs text-[#239459] hover:underline">Order #{r.local.orderId}{r.local.vendor ? ` • ${r.local.vendor}` : ''}</a>
                        ) : (
                          <span className="text-xs text-gray-500">No local order</span>
                        )}
                      </td>
                      <td className="px-4 py-2.5">
                        <span className="inline-flex px-2 py-0.5 rounded-full text-[11px] font-medium bg-gray-100 dark:bg-[#262626] text-gray-700 dark:text-[#a1a1aa] border border-gray-200 dark:border-[#333]">{r.payment_method || '—'}</span>
                        {r.method_detail && <div className="text-[11px] text-gray-500 mt-0.5">{r.method_detail}</div>}
                      </td>
                      <td className="px-4 py-2.5">
                        <div className="flex flex-col gap-1 items-start">
                          <span className={`inline-flex px-2 py-0.5 rounded-full text-[11px] font-semibold border capitalize ${statusBadge(r.status)}`}>{r.status}</span>
                          {r.local && r.local.status !== r.status && (
                            <span className="text-[11px] text-gray-500">local: {r.local.status}</span>
                          )}
                          {r.disputed && (
                            <span className="inline-flex px-2 py-0.5 rounded-full text-[11px] font-semibold border bg-red-50 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-300">disputed</span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        <div className="font-semibold text-gray-900 dark:text-white">{fmtPHP(r.amount)}</div>
                        <div className="text-[11px] text-gray-500">net {fmtPHP(r.net_amount)}</div>
                      </td>
                      <td className="px-4 py-2.5 hidden md:table-cell"><ReconBadge row={r} /></td>
                      <td className="px-4 py-2.5">
                        <div className="flex items-center justify-end gap-1.5">
                          {r.local && (
                            <button onClick={() => runSync(r)} disabled={syncBusyId === r.id} title="Compare with gateway now" className="px-2.5 py-1.5 rounded-lg border border-gray-200 dark:border-[#262626] text-xs font-medium text-gray-700 dark:text-[#a1a1aa] hover:bg-gray-50 dark:hover:bg-[#262626] disabled:opacity-50">
                              {syncBusyId === r.id ? '…' : 'Sync'}
                            </button>
                          )}
                          {(r.status === 'paid' || (r.local && ['paid', 'partially_refunded'].includes(r.local.status))) && (
                            <button onClick={() => openRefund(r)} title="Issue PayMongo refund" className="px-2.5 py-1.5 rounded-lg bg-[#239459] text-white text-xs font-semibold hover:bg-[#215035]">
                              Refund
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                  {!rows.length && (
                    <tr><td colSpan={7} className="px-4 py-10 text-center text-sm text-gray-500">No gateway payments found.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
            <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200 dark:border-[#262626] text-xs text-gray-500">
              <span>{rows.length} payments • cursor pages (gateway order)</span>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => rows.length && setCursor({ before: rows[0].id })}
                  disabled={!rows.length || !!cursor.before}
                  className="px-2.5 py-1 rounded-lg border border-gray-200 dark:border-[#262626] disabled:opacity-40"
                >
                  Prev
                </button>
                <button
                  onClick={() => rows.length && setCursor({ after: rows[rows.length - 1].id })}
                  disabled={!rows.length || !data?.meta.has_more}
                  className="px-2.5 py-1 rounded-lg border border-gray-200 dark:border-[#262626] disabled:opacity-40"
                >
                  Next
                </button>
              </div>
            </div>
          </div>

          {syncResult && (
            <div className="bg-white dark:bg-[#171717] rounded-xl border border-gray-200 dark:border-[#262626] p-4">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Gateway sync result</h3>
                <button onClick={() => setSyncResult(null)} className="p-1 rounded-full hover:bg-gray-100 dark:hover:bg-[#262626]"><X className="w-4 h-4 text-gray-400" /></button>
              </div>
              <pre className="text-xs font-mono bg-gray-50 dark:bg-[#0a0a0a] border border-gray-200 dark:border-[#262626] rounded-lg p-3 overflow-x-auto text-gray-800 dark:text-gray-200">{JSON.stringify(syncResult, null, 2)}</pre>
            </div>
          )}
        </>
      )}

      {refundTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => !refundBusy && setRefundTarget(null)}>
          <div className="w-full max-w-md bg-white dark:bg-[#171717] rounded-xl border border-gray-200 dark:border-[#262626] p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-base font-semibold text-gray-900 dark:text-white">Issue PayMongo refund</h3>
            <p className="text-xs text-gray-500 mt-1 font-mono break-all">{refundTarget.id}{refundTarget.local ? ` • txn #${refundTarget.local.transactionId}` : ''}</p>
            <div className="mt-4 space-y-3">
              <label className="block text-xs font-medium text-gray-600 dark:text-[#a1a1aa]">
                Amount (PHP, empty = full remaining)
                <input value={refundAmount} onChange={(e) => setRefundAmount(e.target.value)} type="number" min="0" step="0.01" className="mt-1 w-full px-3 py-2.5 text-sm bg-gray-50 dark:bg-[#0a0a0a] border border-gray-200 dark:border-[#262626] rounded-lg text-gray-900 dark:text-white" />
              </label>
              <label className="block text-xs font-medium text-gray-600 dark:text-[#a1a1aa]">
                Reason (PayMongo required)
                <select value={refundReason} onChange={(e) => setRefundReason(e.target.value)} className="mt-1 w-full px-3 py-2.5 text-sm bg-gray-50 dark:bg-[#0a0a0a] border border-gray-200 dark:border-[#262626] rounded-lg text-gray-900 dark:text-white">
                  {REFUND_REASONS.map((r) => <option key={r} value={r}>{r}</option>)}
                </select>
              </label>
              <label className="block text-xs font-medium text-gray-600 dark:text-[#a1a1aa]">
                Notes (optional)
                <input value={refundNotes} onChange={(e) => setRefundNotes(e.target.value)} maxLength={500} placeholder="Reason for records" className="mt-1 w-full px-3 py-2.5 text-sm bg-gray-50 dark:bg-[#0a0a0a] border border-gray-200 dark:border-[#262626] rounded-lg text-gray-900 dark:text-white" />
              </label>
              {refundMsg && <p className="text-xs text-gray-600 dark:text-[#a1a1aa] bg-gray-50 dark:bg-[#0a0a0a] border border-gray-200 dark:border-[#262626] rounded-lg p-2.5">{refundMsg}</p>}
              <p className="text-[11px] text-gray-500">Charged at PayMongo now. Local status + commission reversal finalize when the refund webhook arrives.</p>
              <div className="flex items-center justify-end gap-2 pt-1">
                <button onClick={() => !refundBusy && setRefundTarget(null)} disabled={refundBusy} className="px-4 py-2 rounded-lg border border-gray-200 dark:border-[#262626] text-sm font-medium text-gray-700 dark:text-[#a1a1aa] disabled:opacity-50">Cancel</button>
                <button onClick={submitRefund} disabled={refundBusy} className="px-4 py-2 rounded-lg bg-[#239459] text-white text-sm font-semibold hover:bg-[#215035] disabled:opacity-50">{refundBusy ? 'Issuing…' : 'Issue refund'}</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {sendOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => !sendBusy && setSendOpen(false)}>
          <div className="w-full max-w-md bg-white dark:bg-[#171717] rounded-xl border border-gray-200 dark:border-[#262626] p-5 shadow-xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-base font-semibold text-gray-900 dark:text-white">Send funds (PayMongo)</h3>
            <p className="text-[11px] text-red-600 dark:text-red-400 mt-1 font-medium">Real money moves on {data?.meta.mode === 'live' ? 'LIVE' : 'sandbox'} PayMongo. ~₱10 fee per transfer.</p>
            <div className="mt-4 space-y-3">
              <label className="block text-xs font-medium text-gray-600 dark:text-[#a1a1aa]">
                Rail
                <select
                  value={sendProvider}
                  onChange={(e) => { setSendProvider(e.target.value); setSendBankName(''); setSendBic(''); void loadInstitutions(e.target.value) }}
                  className="mt-1 w-full px-3 py-2.5 text-sm bg-gray-50 dark:bg-[#0a0a0a] border border-gray-200 dark:border-[#262626] rounded-lg text-gray-900 dark:text-white"
                >
                  <option value="instapay">InstaPay — real-time, ≤ ₱50,000</option>
                  <option value="pesonet">PESONet — same/next banking day, larger</option>
                </select>
              </label>
              <label className="block text-xs font-medium text-gray-600 dark:text-[#a1a1aa]">
                Recipient bank / e-wallet {institutionsLoading ? '(loading…)' : ''}
                <input
                  value={sendBankName}
                  onChange={(e) => {
                    setSendBankName(e.target.value)
                    const hit = institutions.find((i) => i.name.toLowerCase() === e.target.value.toLowerCase())
                    if (hit) setSendBic(hit.bic)
                  }}
                  list="send-institutions"
                  placeholder="Type to search banks…"
                  className="mt-1 w-full px-3 py-2.5 text-sm bg-gray-50 dark:bg-[#0a0a0a] border border-gray-200 dark:border-[#262626] rounded-lg text-gray-900 dark:text-white"
                />
                <datalist id="send-institutions">
                  {institutions.map((i) => <option key={i.bic + i.name} value={i.name}>{i.bic}</option>)}
                </datalist>
              </label>
              <label className="block text-xs font-medium text-gray-600 dark:text-[#a1a1aa]">
                Bank code (BIC)
                <input value={sendBic} onChange={(e) => setSendBic(e.target.value)} placeholder="Auto-filled from bank" className="mt-1 w-full px-3 py-2.5 text-sm font-mono bg-gray-50 dark:bg-[#0a0a0a] border border-gray-200 dark:border-[#262626] rounded-lg text-gray-900 dark:text-white" />
              </label>
              <label className="block text-xs font-medium text-gray-600 dark:text-[#a1a1aa]">
                Account number
                <input value={sendNumber} onChange={(e) => setSendNumber(e.target.value)} inputMode="numeric" className="mt-1 w-full px-3 py-2.5 text-sm font-mono bg-gray-50 dark:bg-[#0a0a0a] border border-gray-200 dark:border-[#262626] rounded-lg text-gray-900 dark:text-white" />
              </label>
              <label className="block text-xs font-medium text-gray-600 dark:text-[#a1a1aa]">
                Account name (must match bank records)
                <input value={sendName} onChange={(e) => setSendName(e.target.value)} className="mt-1 w-full px-3 py-2.5 text-sm bg-gray-50 dark:bg-[#0a0a0a] border border-gray-200 dark:border-[#262626] rounded-lg text-gray-900 dark:text-white" />
              </label>
              <label className="block text-xs font-medium text-gray-600 dark:text-[#a1a1aa]">
                Amount (PHP)
                <input value={sendAmount} onChange={(e) => setSendAmount(e.target.value)} type="number" min="0" step="0.01" className="mt-1 w-full px-3 py-2.5 text-sm bg-gray-50 dark:bg-[#0a0a0a] border border-gray-200 dark:border-[#262626] rounded-lg text-gray-900 dark:text-white" />
              </label>
              <label className="block text-xs font-medium text-gray-600 dark:text-[#a1a1aa]">
                Description
                <input value={sendDesc} onChange={(e) => setSendDesc(e.target.value)} maxLength={500} placeholder="Vendor payout, payroll…" className="mt-1 w-full px-3 py-2.5 text-sm bg-gray-50 dark:bg-[#0a0a0a] border border-gray-200 dark:border-[#262626] rounded-lg text-gray-900 dark:text-white" />
              </label>
              {sendMsg && <p className="text-xs text-gray-600 dark:text-[#a1a1aa] bg-gray-50 dark:bg-[#0a0a0a] border border-gray-200 dark:border-[#262626] rounded-lg p-2.5 break-all">{sendMsg}</p>}
              <div className="flex items-center justify-end gap-2 pt-1">
                <button onClick={() => !sendBusy && setSendOpen(false)} disabled={sendBusy} className="px-4 py-2 rounded-lg border border-gray-200 dark:border-[#262626] text-sm font-medium text-gray-700 dark:text-[#a1a1aa] disabled:opacity-50">Cancel</button>
                <button onClick={submitSend} disabled={sendBusy} className="px-4 py-2 rounded-lg bg-[#239459] text-white text-sm font-semibold hover:bg-[#215035] disabled:opacity-50">{sendBusy ? 'Sending…' : 'Send now'}</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {linkOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => !linkBusy && setLinkOpen(false)}>
          <div className="w-full max-w-md bg-white dark:bg-[#171717] rounded-xl border border-gray-200 dark:border-[#262626] p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-base font-semibold text-gray-900 dark:text-white">Create payment link</h3>
            <p className="text-[11px] text-gray-500 mt-1">Single-use hosted checkout page. Share the URL to collect a payment.</p>
            <div className="mt-4 space-y-3">
              <label className="block text-xs font-medium text-gray-600 dark:text-[#a1a1aa]">
                Amount (PHP, min ₱1)
                <input value={linkAmount} onChange={(e) => setLinkAmount(e.target.value)} type="number" min="1" step="0.01" className="mt-1 w-full px-3 py-2.5 text-sm bg-gray-50 dark:bg-[#0a0a0a] border border-gray-200 dark:border-[#262626] rounded-lg text-gray-900 dark:text-white" />
              </label>
              <label className="block text-xs font-medium text-gray-600 dark:text-[#a1a1aa]">
                Description (shown to payer)
                <input value={linkDesc} onChange={(e) => setLinkDesc(e.target.value)} maxLength={1000} placeholder="What is this payment for?" className="mt-1 w-full px-3 py-2.5 text-sm bg-gray-50 dark:bg-[#0a0a0a] border border-gray-200 dark:border-[#262626] rounded-lg text-gray-900 dark:text-white" />
              </label>
              {linkMsg && <p className="text-xs text-gray-600 dark:text-[#a1a1aa] bg-gray-50 dark:bg-[#0a0a0a] border border-gray-200 dark:border-[#262626] rounded-lg p-2.5 break-all">{linkMsg}</p>}
              {linkUrl && (
                <div className="flex items-center gap-2">
                  <input readOnly value={linkUrl} className="flex-1 min-w-0 px-3 py-2.5 text-xs font-mono bg-gray-50 dark:bg-[#0a0a0a] border border-gray-200 dark:border-[#262626] rounded-lg text-gray-900 dark:text-white truncate" />
                  <button onClick={() => { void navigator.clipboard?.writeText(linkUrl) }} className="px-3 py-2.5 rounded-lg bg-[#239459] text-white text-xs font-semibold shrink-0">Copy</button>
                </div>
              )}
              <div className="flex items-center justify-end gap-2 pt-1">
                <button onClick={() => !linkBusy && setLinkOpen(false)} disabled={linkBusy} className="px-4 py-2 rounded-lg border border-gray-200 dark:border-[#262626] text-sm font-medium text-gray-700 dark:text-[#a1a1aa] disabled:opacity-50">Close</button>
                <button onClick={submitLink} disabled={linkBusy} className="px-4 py-2 rounded-lg bg-[#239459] text-white text-sm font-semibold hover:bg-[#215035] disabled:opacity-50">{linkBusy ? 'Creating…' : 'Create link'}</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {topupOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setTopupOpen(false)}>
          <div className="w-full max-w-md bg-white dark:bg-[#171717] rounded-xl border border-gray-200 dark:border-[#262626] p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-base font-semibold text-gray-900 dark:text-white">Top up wallet</h3>
            <p className="text-[11px] text-gray-500 mt-1">PayMongo has no top-up API — fund the wallet manually from your bank or e-wallet app. No money moves when you close this panel.</p>
            <div className="mt-4 space-y-3">
              {(account?.wallets ?? []).map((w) => (
                <div key={w.id} className="rounded-lg border border-gray-200 dark:border-[#262626] bg-gray-50 dark:bg-[#0a0a0a] p-3">
                  <div className="text-xs font-semibold text-gray-900 dark:text-white flex items-center justify-between">
                    <span>{w.account_name || 'PayMongo wallet'}</span>
                    {w.is_default && <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#239459] text-white">DEFAULT</span>}
                  </div>
                  <div className="mt-1.5 text-xs font-mono text-gray-700 dark:text-gray-200">Acct: {w.account_number || '—'}</div>
                  <div className="text-[11px] text-gray-500">Balance {fmtPHP(w.available)} • {w.currency}</div>
                </div>
              ))}
              {!(account?.wallets ?? []).length && <p className="text-xs text-gray-500">Wallet details unavailable right now.</p>}
              <ol className="text-xs text-gray-600 dark:text-[#a1a1aa] space-y-1.5 list-decimal list-inside">
                <li>Open your bank or e-wallet app.</li>
                <li>Send via <span className="font-semibold">InstaPay or PESONet</span> to the wallet account number above.</li>
                <li>Complete your bank&apos;s confirmation (OTP). Funds appear under Pending, then Available.</li>
              </ol>
              <div className="flex items-center justify-end pt-1">
                <button onClick={() => setTopupOpen(false)} className="px-4 py-2 rounded-lg bg-[#239459] text-white text-sm font-semibold">Got it</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default function PaymentsPage() {
  return (
    <ClientOnly fallback={<PaymentsSkeleton />}>
      <Suspense fallback={<PaymentsSkeleton />}>
        <PaymentsPageContent />
      </Suspense>
    </ClientOnly>
  )
}
