'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { AlertCircle, ArrowDownToLine, RefreshCw } from 'lucide-react'

type Balance = {
  lifetimePayable: number
  reserved: number
  paid: number
  available: number
  currency: 'PHP'
}
type WithdrawalRequest = {
  id: number
  vendorId: number
  vendorName: string | null
  amount: number
  status: 'pending' | 'approved' | 'paid' | 'rejected' | 'cancelled'
  payoutDestination: string
  paymentReference: string | null
  reason: string | null
  requestedAt: string
  decidedAt: string | null
  paidAt: string | null
}
type ResponseData = {
  error?: string
  balance?: Balance
  vendorBalances?: Array<Balance & { vendorId: number; vendorName: string | null }>
  requests?: WithdrawalRequest[]
}

function money(value: number) {
  return new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(value)
}

function dateLabel(value: string | null) {
  if (!value) return '—'
  const date = new Date(value)
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleString('en-PH', { timeZone: 'Asia/Manila', dateStyle: 'medium', timeStyle: 'short' })
}

function statusClass(status: WithdrawalRequest['status']) {
  if (status === 'paid') return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300'
  if (status === 'approved') return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300'
  if (status === 'rejected' || status === 'cancelled') return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300'
  return 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300'
}

export default function VendorWithdrawalsPage() {
  const [balance, setBalance] = useState<Balance | null>(null)
  const [vendorBalances, setVendorBalances] = useState<NonNullable<ResponseData['vendorBalances']>>([])
  const [selectedVendorId, setSelectedVendorId] = useState('')
  const [requests, setRequests] = useState<WithdrawalRequest[]>([])
  const [amount, setAmount] = useState('')
  const [destination, setDestination] = useState('')
  const [reason, setReason] = useState('')
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [refreshing, setRefreshing] = useState(0)
  const idempotencyKey = useRef<string | null>(null)

  const load = useCallback(async (signal?: AbortSignal) => {
    setLoading(true)
    setError('')
    try {
      const response = await fetch('/api/vendor/withdrawal-requests?limit=100&offset=0', {
        cache: 'no-store',
        signal,
      })
      const data = await response.json() as ResponseData
      if (!response.ok) throw new Error(data.error || 'Unable to load withdrawal details')
      setBalance(data.balance ?? null)
      const nextVendorBalances = data.vendorBalances ?? []
      setVendorBalances(nextVendorBalances)
      setSelectedVendorId((current) =>
        nextVendorBalances.some((vendor) => String(vendor.vendorId) === current)
          ? current
          : nextVendorBalances.length === 1 ? String(nextVendorBalances[0].vendorId) : '',
      )
      setRequests(data.requests ?? [])
    } catch (cause) {
      if (cause instanceof Error && cause.name === 'AbortError') return
      setError(cause instanceof Error ? cause.message : 'Unable to load withdrawal details')
    } finally {
      if (!signal?.aborted) setLoading(false)
    }
  }, [])

  const selectedBalance = vendorBalances.length > 1
    ? vendorBalances.find((vendor) => String(vendor.vendorId) === selectedVendorId) ?? null
    : balance

  useEffect(() => {
    const controller = new AbortController()
    void load(controller.signal)
    return () => controller.abort()
  }, [load, refreshing])

  const clearKey = () => {
    idempotencyKey.current = null
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setSuccess('')
    const requestedAmount = Number(amount)
    if (!Number.isFinite(requestedAmount) || requestedAmount < 1 || Math.round(requestedAmount * 100) !== requestedAmount * 100) {
      setError('Enter an amount of at least ₱1.00 with no more than two decimal places.')
      return
    }
    if (!selectedBalance || requestedAmount > selectedBalance.available) {
      setError('The amount requested exceeds your current available balance.')
      return
    }
    if (!destination.trim()) {
      setError('Enter the bank or e-wallet destination where you would like to receive payment.')
      return
    }
    if (destination.trim().length > 1000 || reason.trim().length > 500) {
      setError('Please shorten the payout destination or reason to the permitted length.')
      return
    }

    idempotencyKey.current ??= globalThis.crypto?.randomUUID?.() || `withdrawal-${Date.now()}-${Math.random().toString(36).slice(2)}`
    setSubmitting(true)
    try {
      const response = await fetch('/api/vendor/withdrawal-requests', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': idempotencyKey.current,
        },
        body: JSON.stringify({
          amount: requestedAmount,
          ...(selectedVendorId ? { vendorId: Number(selectedVendorId) } : {}),
          payoutDestination: destination.trim(),
          ...(reason.trim() ? { reason: reason.trim() } : {}),
        }),
      })
      const data = await response.json() as ResponseData
      if (!response.ok) throw new Error(data.error || 'Unable to submit withdrawal request')
      idempotencyKey.current = null
      setAmount('')
      setDestination('')
      setReason('')
      setSuccess('Your withdrawal request was submitted for manual review.')
      setRefreshing((value) => value + 1)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to submit withdrawal request')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main className="mx-auto max-w-6xl space-y-6 px-3 py-6 sm:px-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Withdrawals</h1>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">Request a manual payout from your available vendor balance.</p>
        </div>
        <button
          type="button"
          onClick={() => setRefreshing((value) => value + 1)}
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
        </button>
      </header>

      {error && (
        <div role="alert" className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /> {error}
        </div>
      )}
      {success && <p role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200">{success}</p>}

      <section aria-label="Withdrawal balance" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          ['Lifetime payable', selectedBalance ? money(selectedBalance.lifetimePayable) : '—'],
          ['Reserved in requests', selectedBalance ? money(selectedBalance.reserved) : '—'],
          ['Already paid', selectedBalance ? money(selectedBalance.paid) : '—'],
          ['Available to request', selectedBalance ? money(selectedBalance.available) : '—'],
        ].map(([label, value]) => (
          <div key={label} className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
            <p className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">{label}</p>
            <p className="mt-2 text-xl font-bold text-gray-900 dark:text-white">{loading && !balance ? 'Loading…' : value}</p>
          </div>
        ))}
      </section>

      <section className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.25fr)]">
        <form onSubmit={submit} className="space-y-4 rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">New withdrawal request</h2>
            <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">Requests reserve balance while pending or approved. Payment is handled manually after review.</p>
          </div>
          {vendorBalances.length > 1 && (
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-200">
              Vendor account
              <select
                required
                value={selectedVendorId}
                onChange={(event) => { setSelectedVendorId(event.target.value); clearKey() }}
                className="mt-1 block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/20 dark:border-gray-700 dark:bg-gray-950 dark:text-white"
              >
                <option value="">Select a vendor</option>
                {vendorBalances.map((vendor) => <option key={vendor.vendorId} value={vendor.vendorId}>{vendor.vendorName || `Vendor #${vendor.vendorId}`}</option>)}
              </select>
            </label>
          )}
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-200">
            Amount (PHP)
            <input
              type="number"
              min="1"
              max={selectedBalance?.available ?? undefined}
              step="0.01"
              required
              value={amount}
              onChange={(event) => { setAmount(event.target.value); clearKey() }}
              className="mt-1 block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/20 dark:border-gray-700 dark:bg-gray-950 dark:text-white"
            />
            <span className="mt-1 block text-xs font-normal text-gray-500 dark:text-gray-400">Maximum available: {selectedBalance ? money(selectedBalance.available) : '—'}</span>
          </label>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-200">
            Payout destination
            <textarea
              required
              maxLength={1000}
              rows={3}
              value={destination}
              onChange={(event) => { setDestination(event.target.value); clearKey() }}
              placeholder="Bank name, account name, and account number or e-wallet details"
              className="mt-1 block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/20 dark:border-gray-700 dark:bg-gray-950 dark:text-white"
            />
          </label>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-200">
            Note (optional)
            <textarea
              maxLength={500}
              rows={2}
              value={reason}
              onChange={(event) => { setReason(event.target.value); clearKey() }}
              placeholder="Add any context for the reviewer"
              className="mt-1 block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/20 dark:border-gray-700 dark:bg-gray-950 dark:text-white"
            />
          </label>
          <button
            type="submit"
            disabled={submitting || loading || !selectedBalance || selectedBalance.available < 1 || (vendorBalances.length > 1 && !selectedVendorId)}
            className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-700 px-4 py-2.5 font-semibold text-white hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <ArrowDownToLine className="h-4 w-4" /> {submitting ? 'Submitting…' : 'Submit request'}
          </button>
        </form>

        <section className="overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
          <div className="border-b border-gray-200 px-5 py-4 dark:border-gray-800">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Request history</h2>
            <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">Status and payment reference updates appear here.</p>
          </div>
          {loading && requests.length === 0 ? (
            <p className="p-5 text-sm text-gray-500 dark:text-gray-400">Loading requests…</p>
          ) : requests.length === 0 ? (
            <p className="p-5 text-sm text-gray-500 dark:text-gray-400">No withdrawal requests yet.</p>
          ) : (
            <ul className="divide-y divide-gray-200 dark:divide-gray-800">
              {requests.map((item) => (
                <li key={item.id} className="space-y-2 p-5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-semibold text-gray-900 dark:text-white">{money(item.amount)}</span>
                    <span className={`rounded-full px-2.5 py-1 text-xs font-semibold capitalize ${statusClass(item.status)}`}>{item.status}</span>
                  </div>
                  {item.vendorName && <p className="text-xs font-medium text-gray-500 dark:text-gray-400">{item.vendorName}</p>}
                  <p className="break-words text-sm text-gray-600 dark:text-gray-300">{item.payoutDestination}</p>
                  <div className="grid gap-1 text-xs text-gray-500 sm:grid-cols-2 dark:text-gray-400">
                    <span>Requested {dateLabel(item.requestedAt)}</span>
                    {item.paidAt && <span>Paid {dateLabel(item.paidAt)}</span>}
                  </div>
                  {item.paymentReference && <p className="text-sm text-gray-700 dark:text-gray-300">Payment reference: <span className="font-mono">{item.paymentReference}</span></p>}
                  {item.reason && <p className="whitespace-pre-wrap rounded-md bg-gray-50 p-2 text-sm text-gray-600 dark:bg-gray-800 dark:text-gray-300">{item.reason}</p>}
                </li>
              ))}
            </ul>
          )}
        </section>
      </section>
    </main>
  )
}