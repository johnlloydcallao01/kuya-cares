'use client'

import { useCallback, useEffect, useState } from 'react'
import { AlertCircle, Check, RefreshCw, X } from 'lucide-react'

type Status = 'pending' | 'approved' | 'paid' | 'rejected' | 'cancelled'
type WithdrawalRequest = {
  id: number
  vendorId: number
  vendorName: string | null
  amount: number
  status: Status
  payoutDestination: string
  paymentReference: string | null
  reason: string | null
  requestedBy: number
  requestedAt: string
  decidedBy: number | null
  decidedAt: string | null
  paidBy: number | null
  paidAt: string | null
  cancelledBy: number | null
  cancelledAt: string | null
}
type ResponseData = { error?: string; requests?: WithdrawalRequest[]; request?: WithdrawalRequest }

const filters: Array<'all' | Status> = ['pending', 'approved', 'paid', 'rejected', 'cancelled', 'all']

function money(amount: number) {
  return new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(amount)
}

function dateLabel(value: string | null) {
  if (!value) return '—'
  const date = new Date(value)
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleString('en-PH', { timeZone: 'Asia/Manila', dateStyle: 'medium', timeStyle: 'short' })
}

function statusClass(status: Status) {
  if (status === 'paid') return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300'
  if (status === 'approved') return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300'
  if (status === 'rejected' || status === 'cancelled') return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300'
  return 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300'
}

export default function VendorWithdrawalRequestsPage() {
  const [filter, setFilter] = useState<'all' | Status>('pending')
  const [requests, setRequests] = useState<WithdrawalRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState<number | null>(null)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [refreshKey, setRefreshKey] = useState(0)
  const [action, setAction] = useState<{ request: WithdrawalRequest; status: 'approved' | 'rejected' | 'paid' } | null>(null)
  const [reason, setReason] = useState('')
  const [paymentReference, setPaymentReference] = useState('')

  const load = useCallback(async (signal?: AbortSignal) => {
    setLoading(true)
    setError('')
    try {
      const query = new URLSearchParams({ limit: '100', offset: '0' })
      if (filter !== 'all') query.set('status', filter)
      const response = await fetch(`/api/vendors/withdrawal-requests?${query}`, { cache: 'no-store', signal })
      const data = await response.json() as ResponseData
      if (!response.ok) throw new Error(data.error || 'Unable to load withdrawal requests')
      setRequests(data.requests ?? [])
    } catch (cause) {
      if (cause instanceof Error && cause.name === 'AbortError') return
      setError(cause instanceof Error ? cause.message : 'Unable to load withdrawal requests')
    } finally {
      if (!signal?.aborted) setLoading(false)
    }
  }, [filter])

  useEffect(() => {
    const controller = new AbortController()
    void load(controller.signal)
    return () => controller.abort()
  }, [load, refreshKey])

  function openAction(request: WithdrawalRequest, status: 'approved' | 'rejected' | 'paid') {
    setReason('')
    setPaymentReference('')
    setAction({ request, status })
  }

  async function submitAction(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!action) return
    if (action.status === 'rejected' && !reason.trim()) {
      setError('A reason is required when rejecting a request.')
      return
    }
    if (action.status === 'paid' && !paymentReference.trim()) {
      setError('Enter the manual payment reference before marking a request paid.')
      return
    }
    setBusyId(action.request.id)
    setError('')
    setNotice('')
    try {
      const response = await fetch(`/api/vendors/withdrawal-requests/${action.request.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: action.status,
          ...(reason.trim() ? { reason: reason.trim() } : {}),
          ...(paymentReference.trim() ? { paymentReference: paymentReference.trim() } : {}),
        }),
      })
      const data = await response.json() as ResponseData
      if (!response.ok) throw new Error(data.error || 'Unable to update withdrawal request')
      setAction(null)
      setNotice(`Request #${action.request.id} marked ${action.status}.`)
      setRefreshKey((value) => value + 1)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to update withdrawal request')
    } finally {
      setBusyId(null)
    }
  }

  return (
    <main className="mx-auto max-w-7xl space-y-5 px-3 py-6 sm:px-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Vendor withdrawal requests</h1>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">Review requests and manually record completed payments. No automatic transfer is initiated.</p>
        </div>
        <button
          type="button"
          onClick={() => setRefreshKey((value) => value + 1)}
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
        </button>
      </header>

      {error && <div role="alert" className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />{error}</div>}
      {notice && <p role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200">{notice}</p>}

      <nav aria-label="Request status filter" className="flex flex-wrap gap-2">
        {filters.map((value) => (
          <button
            type="button"
            key={value}
            onClick={() => setFilter(value)}
            aria-pressed={filter === value}
            className={`rounded-full border px-3 py-1.5 text-sm font-medium capitalize ${filter === value ? 'border-emerald-700 bg-emerald-700 text-white' : 'border-gray-300 bg-white text-gray-700 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200'}`}
          >
            {value === 'all' ? 'All requests' : value}
          </button>
        ))}
      </nav>

      {loading && requests.length === 0 ? (
        <p className="rounded-xl border border-gray-200 bg-white p-6 text-sm text-gray-500 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-400">Loading requests…</p>
      ) : requests.length === 0 ? (
        <p className="rounded-xl border border-gray-200 bg-white p-6 text-sm text-gray-500 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-400">No {filter === 'all' ? '' : `${filter} `}requests found.</p>
      ) : (
        <section aria-label="Withdrawal request queue" className="space-y-3">
          {requests.map((request) => (
            <article key={request.id} className="rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-lg font-bold text-gray-900 dark:text-white">{money(request.amount)}</h2>
                    <span className={`rounded-full px-2.5 py-1 text-xs font-semibold capitalize ${statusClass(request.status)}`}>{request.status}</span>
                    <span className="text-sm text-gray-500 dark:text-gray-400">Request #{request.id} · {request.vendorName || `Vendor #${request.vendorId}`}</span>
                  </div>
                  <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Submitted {dateLabel(request.requestedAt)} by user #{request.requestedBy}</p>
                </div>
                {request.status === 'pending' && (
                  <div className="flex gap-2">
                    <button type="button" disabled={busyId === request.id} onClick={() => openAction(request, 'approved')} className="inline-flex items-center gap-1 rounded-lg bg-emerald-700 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-800 disabled:opacity-50">
                      <Check className="h-4 w-4" /> Approve
                    </button>
                    <button type="button" disabled={busyId === request.id} onClick={() => openAction(request, 'rejected')} className="inline-flex items-center gap-1 rounded-lg border border-red-300 px-3 py-2 text-sm font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50 dark:border-red-900 dark:text-red-300 dark:hover:bg-red-950/40">
                      <X className="h-4 w-4" /> Reject
                    </button>
                  </div>
                )}
                {request.status === 'approved' && (
                  <button type="button" disabled={busyId === request.id} onClick={() => openAction(request, 'paid')} className="inline-flex items-center gap-1 rounded-lg bg-blue-700 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-800 disabled:opacity-50">
                    <Check className="h-4 w-4" /> Mark paid
                  </button>
                )}
              </div>
              <dl className="mt-4 grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
                <div><dt className="font-semibold text-gray-700 dark:text-gray-200">Payout destination</dt><dd className="mt-1 whitespace-pre-wrap break-words text-gray-600 dark:text-gray-300">{request.payoutDestination}</dd></div>
                <div><dt className="font-semibold text-gray-700 dark:text-gray-200">Request / review notes</dt><dd className="mt-1 whitespace-pre-wrap text-gray-600 dark:text-gray-300">{request.reason || '—'}</dd></div>
                <div><dt className="font-semibold text-gray-700 dark:text-gray-200">Decision audit</dt><dd className="mt-1 text-gray-600 dark:text-gray-300">{request.decidedAt ? `${dateLabel(request.decidedAt)} · user #${request.decidedBy}` : 'Not decided'}</dd></div>
                <div><dt className="font-semibold text-gray-700 dark:text-gray-200">Payment audit</dt><dd className="mt-1 text-gray-600 dark:text-gray-300">{request.paidAt ? `${dateLabel(request.paidAt)} · user #${request.paidBy}` : 'Not paid'}</dd></div>
                {request.paymentReference && <div className="sm:col-span-2"><dt className="font-semibold text-gray-700 dark:text-gray-200">Payment reference</dt><dd className="mt-1 break-all font-mono text-gray-600 dark:text-gray-300">{request.paymentReference}</dd></div>}
              </dl>
            </article>
          ))}
        </section>
      )}

      {action && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !busyId) setAction(null) }}>
          <form onSubmit={submitAction} role="dialog" aria-modal="true" aria-labelledby="withdrawal-action-title" className="w-full max-w-lg space-y-4 rounded-xl bg-white p-5 shadow-xl dark:bg-gray-900">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 id="withdrawal-action-title" className="text-lg font-bold text-gray-900 dark:text-white">
                  {action.status === 'approved' ? 'Approve request' : action.status === 'rejected' ? 'Reject request' : 'Record manual payment'}
                </h2>
                <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">Request #{action.request.id} · {money(action.request.amount)}</p>
              </div>
              <button type="button" aria-label="Close" disabled={!!busyId} onClick={() => setAction(null)} className="rounded p-1 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800"><X className="h-5 w-5" /></button>
            </div>
            {action.status === 'paid' ? (
              <>
                <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-950/40 dark:text-amber-200">Confirm that the vendor has already been paid outside this system. This records the payment; it does not initiate a transfer.</p>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-200">Manual payment reference (required)<input autoFocus maxLength={200} required value={paymentReference} onChange={(event) => setPaymentReference(event.target.value)} className="mt-1 block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 dark:border-gray-700 dark:bg-gray-950 dark:text-white" /></label>
              </>
            ) : (
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-200">{action.status === 'rejected' ? 'Reason for rejection (required)' : 'Approval note (optional)'}
                <textarea autoFocus maxLength={500} required={action.status === 'rejected'} rows={4} value={reason} onChange={(event) => setReason(event.target.value)} className="mt-1 block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 dark:border-gray-700 dark:bg-gray-950 dark:text-white" />
              </label>
            )}
            {error && <p role="alert" className="text-sm text-red-700 dark:text-red-300">{error}</p>}
            <div className="flex justify-end gap-2">
              <button type="button" disabled={!!busyId} onClick={() => setAction(null)} className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 dark:border-gray-700 dark:text-gray-200">Cancel</button>
              <button type="submit" disabled={busyId === action.request.id} className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-800 disabled:opacity-50">{busyId === action.request.id ? 'Saving…' : 'Confirm'}</button>
            </div>
          </form>
        </div>
      )}
    </main>
  )
}