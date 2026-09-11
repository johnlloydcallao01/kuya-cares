'use client'

import React, { useEffect, useMemo, useState } from 'react'

const STATUS_OPTS = [
  'pending', 'accepted', 'preparing', 'ready_for_pickup', 'on_delivery', 'delivered', 'cancelled',
]
const DELIVERY_STATUS_OPTS = [
  'none', 'pending', 'assigning_driver', 'driver_assigned', 'picked_up', 'completed', 'canceled', 'expired',
]

function toLocalInput(iso: string): string {
  try {
    const d = new Date(iso)
    const pad = (n: number) => String(n).padStart(2, '0')
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
  } catch { return '' }
}

export function OrderForm({ onSuccess, onCancel }: { onSuccess: () => void; onCancel: () => void }) {
  const [customers, setCustomers] = useState<{ id: number; label: string }[]>([])
  const [merchants, setMerchants] = useState<{ id: number; label: string }[]>([])
  const [customerId, setCustomerId] = useState('')
  const [merchantId, setMerchantId] = useState('')
  const [status, setStatus] = useState('pending')
  const [fulfillment, setFulfillment] = useState('delivery')
  const [subtotal, setSubtotal] = useState('0')
  const [deliveryFee, setDeliveryFee] = useState('0')
  const [platformFee, setPlatformFee] = useState('0')
  const [priorityFee, setPriorityFee] = useState('0')
  const [discountTotal, setDiscountTotal] = useState('0')
  const [couponCode, setCouponCode] = useState('')
  const [freeDelivery, setFreeDelivery] = useState(false)
  const [notes, setNotes] = useState('')
  const [placedAt, setPlacedAt] = useState(() => toLocalInput(new Date().toISOString()))
  const [serviceType, setServiceType] = useState('MOTORCYCLE')
  const [deliveryStatus, setDeliveryStatus] = useState('none')
  const [lalamoveOrderId, setLalamoveOrderId] = useState('')
  const [trackingLink, setTrackingLink] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/customers?limit=100', { cache: 'no-store' }).then((r) => r.json()).then((j) => {
      const docs = j.docs || j.data || []
      setCustomers(docs.map((d: any) => {
        const u = d.user && typeof d.user === 'object' ? d.user : null
        const name = u ? `${u.firstName || ''} ${u.lastName || ''}`.trim() : ''
        return { id: d.id, label: `${name || d.email || `Customer #${d.id}`} • ${d.email || ''}` }
      }))
    }).catch(() => {})
    fetch('/api/merchants?limit=100', { cache: 'no-store' }).then((r) => r.json()).then((j) => {
      const docs = j.docs || j.data || []
      setMerchants(docs.map((d: any) => ({ id: d.id, label: `${d.outletName || `Outlet #${d.id}`}${d.outletCode ? ` (${d.outletCode})` : ''}` })))
    }).catch(() => {})
  }, [])

  const numOf = (v: string) => { const n = Number(v); return Number.isFinite(n) && n >= 0 ? n : 0 }
  const total = useMemo(() => {
    const t = numOf(subtotal) + numOf(deliveryFee) + numOf(platformFee) + numOf(priorityFee) - numOf(discountTotal)
    return Math.round(t * 100) / 100
  }, [subtotal, deliveryFee, platformFee, priorityFee, discountTotal])

  const submit = async () => {
    setError(null)
    if (!customerId) return setError('Customer is required')
    if (!merchantId) return setError('Outlet (merchant) is required')
    if (!fulfillment) return setError('Fulfillment type is required')
    setSaving(true)
    try {
      const payload = {
        customer: Number(customerId),
        merchant: Number(merchantId),
        status,
        fulfillment_type: fulfillment,
        subtotal: numOf(subtotal),
        delivery_fee: numOf(deliveryFee),
        platform_fee: numOf(platformFee),
        priority_fee: numOf(priorityFee),
        discount_total: numOf(discountTotal),
        total,
        coupon_code: couponCode.trim() || null,
        free_delivery_applied: freeDelivery,
        notes: notes.trim() || null,
        placed_at: placedAt ? new Date(placedAt).toISOString() : new Date().toISOString(),
        delivery_service_type: serviceType.trim() || 'MOTORCYCLE',
        delivery_status: deliveryStatus,
        lalamove_order_id: lalamoveOrderId.trim() || null,
        delivery_tracking_link: trackingLink.trim() || null,
      }
      const res = await fetch('/api/orders', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
      const j = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(j.error || 'Failed to create order')
      onSuccess()
    } catch (e: any) { setError(e.message || 'Save failed') } finally { setSaving(false) }
  }

  const inputCls = 'mt-1 w-full px-3 py-2.5 rounded-lg border border-gray-200 dark:border-[#262626] bg-white dark:bg-[#0a0a0a] text-sm text-gray-900 dark:text-white'
  const labelCls = 'text-xs font-medium text-gray-700 dark:text-[#a1a1aa]'
  const numCls = `${inputCls} font-mono`

  return (
    <div className="bg-white dark:bg-[#171717] rounded-xl border border-gray-200 dark:border-[#262626] shadow-sm overflow-hidden">
      <div className="p-6 space-y-6">
        {error && <div className="p-3 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-sm text-red-700 dark:text-red-300">{error}</div>}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>Customer *</label>
            <select value={customerId} onChange={(e) => setCustomerId(e.target.value)} className={inputCls}>
              <option value="">Select customer…</option>
              {customers.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
            </select>
          </div>
          <div>
            <label className={labelCls}>Outlet (merchant) *</label>
            <select value={merchantId} onChange={(e) => setMerchantId(e.target.value)} className={inputCls}>
              <option value="">Select outlet…</option>
              {merchants.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
            </select>
          </div>
          <div>
            <label className={labelCls}>Status</label>
            <select value={status} onChange={(e) => setStatus(e.target.value)} className={inputCls}>
              {STATUS_OPTS.map((s) => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
            </select>
          </div>
          <div>
            <label className={labelCls}>Fulfillment *</label>
            <select value={fulfillment} onChange={(e) => setFulfillment(e.target.value)} className={inputCls}>
              <option value="delivery">Delivery</option>
              <option value="pickup">Pickup</option>
            </select>
          </div>
        </div>

        <div>
          <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">Amounts (PHP)</h4>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            <div><label className={labelCls}>Subtotal *</label><input type="number" min="0" step="0.01" value={subtotal} onChange={(e) => setSubtotal(e.target.value)} className={numCls} /></div>
            <div><label className={labelCls}>Delivery fee</label><input type="number" min="0" step="0.01" value={deliveryFee} onChange={(e) => setDeliveryFee(e.target.value)} className={numCls} /></div>
            <div><label className={labelCls}>Platform fee</label><input type="number" min="0" step="0.01" value={platformFee} onChange={(e) => setPlatformFee(e.target.value)} className={numCls} /></div>
            <div><label className={labelCls}>Priority fee</label><input type="number" min="0" step="0.01" value={priorityFee} onChange={(e) => setPriorityFee(e.target.value)} className={numCls} /></div>
            <div><label className={labelCls}>Discount total</label><input type="number" min="0" step="0.01" value={discountTotal} onChange={(e) => setDiscountTotal(e.target.value)} className={numCls} /></div>
            <div><label className={labelCls}>Total (auto)</label><input value={total.toFixed(2)} readOnly className={`${numCls} bg-gray-50 dark:bg-[#171717] font-bold`} /></div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div><label className={labelCls}>Coupon code</label><input value={couponCode} onChange={(e) => setCouponCode(e.target.value)} placeholder="Optional" className={`${inputCls} font-mono`} /></div>
          <div><label className={labelCls}>Placed at</label><input type="datetime-local" value={placedAt} onChange={(e) => setPlacedAt(e.target.value)} className={`${inputCls} font-mono`} /></div>
          <div className="sm:col-span-2"><label className={labelCls}>Notes</label><textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="Merchant instructions…" className={inputCls} /></div>
          <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-[#a1a1aa]"><input type="checkbox" checked={freeDelivery} onChange={(e) => setFreeDelivery(e.target.checked)} className="h-4 w-4 rounded border-gray-300 text-[#eba236] focus:ring-[#eba236]" /> Free delivery applied</label>
        </div>

        <div>
          <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">Delivery</h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div><label className={labelCls}>Service type</label><input value={serviceType} onChange={(e) => setServiceType(e.target.value)} placeholder="MOTORCYCLE" className={`${inputCls} font-mono`} /></div>
            <div>
              <label className={labelCls}>Delivery status</label>
              <select value={deliveryStatus} onChange={(e) => setDeliveryStatus(e.target.value)} className={inputCls}>
                {DELIVERY_STATUS_OPTS.map((s) => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
              </select>
            </div>
            <div><label className={labelCls}>Lalamove order ID</label><input value={lalamoveOrderId} onChange={(e) => setLalamoveOrderId(e.target.value)} className={`${inputCls} font-mono`} /></div>
            <div><label className={labelCls}>Tracking link</label><input value={trackingLink} onChange={(e) => setTrackingLink(e.target.value)} className={`${inputCls} font-mono`} /></div>
          </div>
        </div>

        <div className="flex gap-2">
          <button onClick={onCancel} disabled={saving} className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 dark:border-[#262626] text-sm font-medium bg-white dark:bg-[#171717] hover:bg-gray-50 dark:hover:bg-[#262626] disabled:opacity-50">Cancel</button>
          <button onClick={submit} disabled={saving} className="flex-1 px-4 py-2.5 rounded-xl bg-[#eba236] hover:bg-[#c88a20] text-white text-sm font-semibold disabled:opacity-50">{saving ? 'Creating…' : `Create order • ₱${total.toFixed(2)}`}</button>
        </div>
      </div>
    </div>
  )
}
