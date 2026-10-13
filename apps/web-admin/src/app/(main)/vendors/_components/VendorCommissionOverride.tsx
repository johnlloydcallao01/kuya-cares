'use client'

import React, { useEffect, useState } from 'react'
import { AlertCircle, Check, RefreshCw, Save, Trash2 } from '@/components/ui/IconWrapper'

type Override = { commission_percent?: number; transaction_fee?: number } | null

export function VendorCommissionOverride({ vendorId }: { vendorId: string | number }) {
  const [override, setOverride] = useState<Override>(null)
  const [percent, setPercent] = useState('')
  const [fee, setFee] = useState('0')
  const [reason, setReason] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  const load = async () => {
    setLoading(true)
    setError('')
    try {
      const response = await fetch(`/api/vendors/${vendorId}/commission-override`, { cache: 'no-store' })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Failed to load vendor commission override')
      const doc = data.doc ?? data
      const saved = (doc.commissionOverride ?? doc.commission_override ?? null) as Override
      setOverride(saved)
      setPercent(saved?.commission_percent == null ? '' : String(saved.commission_percent))
      setFee(String(saved?.transaction_fee ?? 0))
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Failed to load vendor commission override')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void load() }, [vendorId])

  const save = async (event: React.FormEvent) => {
    event.preventDefault()
    const pct = Number(percent)
    const transactionFee = Number(fee)
    if (!Number.isFinite(pct) || pct < 0 || pct > 100 || !Number.isFinite(transactionFee) || transactionFee < 0) {
      setError('Enter a commission rate from 0–100% and a non-negative fixed fee.')
      return
    }
    if (!reason.trim()) {
      setError('A reason is required for the audit log.')
      return
    }
    setSaving(true)
    setError('')
    setMessage('')
    try {
      const response = await fetch(`/api/vendors/${vendorId}/commission-override`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pct, transaction_fee: transactionFee, reason: reason.trim() }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Failed to save vendor override')
      setMessage('Vendor commission override saved and audited.')
      setReason('')
      await load()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Failed to save vendor override')
    } finally {
      setSaving(false)
    }
  }

  const clear = async () => {
    if (!window.confirm('Clear this vendor-specific override and inherit the matching commission rule?')) return
    setSaving(true)
    setError('')
    setMessage('')
    try {
      const response = await fetch(`/api/vendors/${vendorId}/commission-override`, { method: 'DELETE' })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Failed to clear vendor override')
      setMessage('Vendor override cleared. This vendor will use the applicable commission rules.')
      await load()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Failed to clear vendor override')
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="rounded-xl border border-gray-200 bg-white p-4 dark:border-[#262626] dark:bg-[#171717]">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div><h3 className="font-semibold text-gray-900 dark:text-white">Vendor commission override</h3><p className="text-xs text-gray-500">Overrides applicable category, plan, and global rules for new paid orders. Existing snapshots stay unchanged.</p></div>
        <button onClick={() => void load()} disabled={loading || saving} aria-label="Refresh commission override" className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 disabled:opacity-50 dark:hover:bg-[#262626]"><RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /></button>
      </div>
      {error && <div role="alert" className="mb-3 flex gap-2 rounded-lg bg-red-50 p-2 text-sm text-red-700 dark:bg-red-950/30 dark:text-red-300"><AlertCircle className="h-4 w-4 shrink-0" />{error}</div>}
      {message && <div role="status" className="mb-3 flex gap-2 rounded-lg bg-emerald-50 p-2 text-sm text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300"><Check className="h-4 w-4 shrink-0" />{message}</div>}
      {loading ? <p className="text-sm text-gray-500">Loading vendor override…</p> : (
        <>
          <p className="mb-3 text-sm text-gray-600 dark:text-[#a1a1aa]">{override ? `Current override: ${Number(override.commission_percent ?? 0).toFixed(2)}% + ₱${Number(override.transaction_fee ?? 0).toFixed(2)} per order` : 'No explicit vendor override. The best matching commission rule is used.'}</p>
          <form onSubmit={save} className="grid grid-cols-1 gap-3 md:grid-cols-4">
            <label className="text-xs font-medium text-gray-600 dark:text-[#a1a1aa]">Commission (%)<input required type="number" min="0" max="100" step="0.01" value={percent} onChange={(event) => setPercent(event.target.value)} className={inputClass} /></label>
            <label className="text-xs font-medium text-gray-600 dark:text-[#a1a1aa]">Fixed transaction fee (PHP)<input required type="number" min="0" step="0.01" value={fee} onChange={(event) => setFee(event.target.value)} className={inputClass} /></label>
            <label className="text-xs font-medium text-gray-600 dark:text-[#a1a1aa] md:col-span-2">Reason for audit log<input required maxLength={300} value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Required to change the override" className={inputClass} /></label>
            <div className="flex flex-wrap gap-2 md:col-span-4">
              <button disabled={saving} className="inline-flex items-center gap-2 rounded-lg bg-[#239459] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"><Save className="h-4 w-4" />{saving ? 'Saving…' : 'Save override'}</button>
              {override && <button type="button" disabled={saving} onClick={() => void clear()} className="inline-flex items-center gap-2 rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 disabled:opacity-60 dark:border-[#262626] dark:text-[#a1a1aa]"><Trash2 className="h-4 w-4" />Clear override</button>}
            </div>
          </form>
        </>
      )}
    </section>
  )
}

const inputClass = 'mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 dark:border-[#262626] dark:bg-[#0a0a0a] dark:text-white'
