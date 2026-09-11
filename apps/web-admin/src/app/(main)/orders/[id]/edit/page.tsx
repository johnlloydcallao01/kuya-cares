'use client'

import React, { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter, notFound } from 'next/navigation'
import { useQueryClient } from '@tanstack/react-query'
import { ClientOnly } from '@/components/ClientOnly'
import { Receipt, ArrowLeft, AlertCircle, CheckCircle } from '@/components/ui/IconWrapper'

const STATUS_OPTS = [
  'pending', 'accepted', 'preparing', 'ready_for_pickup', 'on_delivery', 'delivered', 'cancelled',
]
const DELIVERY_STATUS_OPTS = [
  'none', 'pending', 'assigning_driver', 'driver_assigned', 'picked_up', 'completed', 'canceled', 'expired',
]

function toLocalInput(iso: string | null | undefined): string {
  if (!iso) return ''
  try {
    const d = new Date(iso)
    const pad = (n: number) => String(n).padStart(2, '0')
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
  } catch { return '' }
}

function EditOrderSkeleton(){
  return <div className="space-y-6 py-5 px-2.5"><div className="h-8 w-32 bg-gray-200 dark:bg-[#262626] rounded animate-pulse" /><div className="h-96 bg-gray-100 dark:bg-[#171717] rounded-xl animate-pulse" /></div>
}

function EditOrderContent(){
  const params = useParams()
  const id = params.id as string
  const router = useRouter()
  const queryClient = useQueryClient()
  if (!/^\d+$/.test(id)) {
    notFound()
  }
  const [doc, setDoc] = useState<any | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [saveSuccess, setSaveSuccess] = useState(false)

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
  const [placedAt, setPlacedAt] = useState('')
  const [serviceType, setServiceType] = useState('MOTORCYCLE')
  const [deliveryStatus, setDeliveryStatus] = useState('none')
  const [lalamoveOrderId, setLalamoveOrderId] = useState('')
  const [trackingLink, setTrackingLink] = useState('')
  const [description, setDescription] = useState('')
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

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

  useEffect(() => {
    let cancelled = false
    async function load(){
      setLoading(true); setError(null)
      try{
        const res = await fetch(`/api/orders/${id}`, { cache: 'no-store' })
        const j = await res.json()
        if (!res.ok) throw new Error(j.error || 'Failed to load order')
        const d = j.doc || j
        if (!cancelled) {
          setDoc(d)
          setCustomerId(d.customer?.id != null ? String(d.customer.id) : '')
          setMerchantId(d.merchant?.id != null ? String(d.merchant.id) : '')
          setStatus(d.status || 'pending')
          setFulfillment(d.fulfillment_type || 'delivery')
          setSubtotal(String(d.subtotal ?? 0))
          setDeliveryFee(String(d.delivery_fee ?? 0))
          setPlatformFee(String(d.platform_fee ?? 0))
          setPriorityFee(String(d.priority_fee ?? 0))
          setDiscountTotal(String(d.discount_total ?? 0))
          setCouponCode(d.coupon_code || '')
          setFreeDelivery(!!d.free_delivery_applied)
          setNotes(d.notes || '')
          setPlacedAt(toLocalInput(d.placed_at))
          setServiceType(d.booking?.service_type || d.lalamove?.serviceType || 'MOTORCYCLE')
          setDeliveryStatus(d.delivery_status || d.lalamove?.status || 'none')
          setLalamoveOrderId(d.booking?.lalamove_order_id || d.lalamove?.orderId || '')
          setTrackingLink(d.booking?.share_link || d.lalamove?.trackingLink || '')
        }
      }catch(e:any){ if (!cancelled) setError(e.message || 'Failed') } finally{ if (!cancelled) setLoading(false) }
    }
    void load()
    return () => { cancelled = true }
  }, [id])

  const handleBack = () => {
    if (typeof window !== 'undefined' && window.history.length > 1) router.back()
    else router.push(`/orders/${id}`)
  }

  const numOf = (v: string) => { const n = Number(v); return Number.isFinite(n) && n >= 0 ? n : 0 }
  const total = useMemo(() => {
    const t = numOf(subtotal) + numOf(deliveryFee) + numOf(platformFee) + numOf(priorityFee) - numOf(discountTotal)
    return Math.round(t * 100) / 100
  }, [subtotal, deliveryFee, platformFee, priorityFee, discountTotal])

  const handleSave = async () => {
    setSaveError(null)
    if (!customerId) return setSaveError('Customer is required')
    if (!merchantId) return setSaveError('Outlet (merchant) is required')
    setSaving(true)
    try{
      const res = await fetch(`/api/orders/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
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
          placed_at: placedAt ? new Date(placedAt).toISOString() : undefined,
          delivery_service_type: serviceType.trim() || 'MOTORCYCLE',
          delivery_status: deliveryStatus,
          lalamove_order_id: lalamoveOrderId.trim() || null,
          delivery_tracking_link: trackingLink.trim() || null,
          description: description.trim() || undefined,
        }),
      })
      const j = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(j.error || 'Failed to update order')
      setSaveSuccess(true)
      // Keep the list fresh for when the user navigates back to /orders.
      await queryClient.invalidateQueries({ queryKey: ['admin', 'orders'] })
      setTimeout(() => router.push(`/orders/${id}`), 900)
    }catch(e:any){ setSaveError(e.message || 'Save failed') } finally{ setSaving(false) }
  }

  if (loading) {
    return <EditOrderSkeleton />
  }
  if (error || !doc) {
    return (
      <div className="space-y-6 py-5 px-2.5">
        <button onClick={handleBack} className="inline-flex items-center gap-2 text-sm text-gray-600 dark:text-[#a1a1aa] hover:text-gray-900"><ArrowLeft className="w-4 h-4" /> Back</button>
        <div className="flex flex-col items-center justify-center py-16 bg-white dark:bg-[#171717] rounded-xl border border-gray-200 dark:border-[#262626]">
          <div className="h-14 w-14 bg-red-50 dark:bg-red-900/20 rounded-full flex items-center justify-center mb-4"><AlertCircle className="h-7 w-7 text-red-500" /></div>
          <h3 className="font-semibold text-gray-900 dark:text-white">Failed to load order</h3><p className="text-sm text-gray-500 mt-1">{error}</p>
          <Link href="/orders" className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-[#eba236] text-white rounded-lg text-sm font-medium">Back</Link>
        </div>
      </div>
    )
  }

  const inputCls = 'mt-1 w-full px-3 py-2.5 rounded-lg border border-gray-200 dark:border-[#262626] bg-white dark:bg-[#0a0a0a] text-sm text-gray-900 dark:text-white'
  const labelCls = 'text-xs font-medium text-gray-700 dark:text-[#a1a1aa]'
  const numCls = `${inputCls} font-mono`

  return (
    <div className="space-y-6 py-5 px-2.5">
      <button onClick={handleBack} className="inline-flex items-center gap-2 text-sm font-medium text-gray-600 dark:text-[#a1a1aa] hover:text-gray-900 dark:hover:text-white">
        <ArrowLeft className="w-4 h-4" /> Back
      </button>

      {saveSuccess && (
        <div className="flex items-center gap-2 p-4 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 text-sm font-medium text-emerald-700 dark:text-emerald-300">
          <CheckCircle className="w-5 h-5 shrink-0 text-emerald-600 dark:text-emerald-400" />
          Order updated successfully.
        </div>
      )}

      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-xl bg-[#eba236] text-white flex items-center justify-center"><Receipt className="w-5 h-5" /></div>
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">Edit order</h1>
          <p className="text-sm text-gray-500 dark:text-[#a1a1aa]">{doc.orderNumber || `#${doc.id}`} • all collection fields editable</p>
        </div>
      </div>

      <div className="bg-white dark:bg-[#171717] rounded-xl border border-gray-200 dark:border-[#262626] shadow-sm overflow-hidden">
        <div className="p-6 space-y-6">
          {saveError && <div className="p-3 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-sm text-red-700 dark:text-red-300">{saveError}</div>}

          <div>
            <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">Relations</h4>
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
                <label className={labelCls}>Order status *</label>
                <select value={status} onChange={(e) => setStatus(e.target.value)} className={`${inputCls} capitalize`}>
                  {STATUS_OPTS.map((s) => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
                </select>
                <p className="text-[11px] text-gray-400 mt-1">Changing status writes an order-tracking audit entry.</p>
              </div>
              <div>
                <label className={labelCls}>Fulfillment *</label>
                <select value={fulfillment} onChange={(e) => setFulfillment(e.target.value)} className={inputCls}>
                  <option value="delivery">Delivery</option>
                  <option value="pickup">Pickup</option>
                </select>
              </div>
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

          <div>
            <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">Promo & meta</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div><label className={labelCls}>Coupon code</label><input value={couponCode} onChange={(e) => setCouponCode(e.target.value)} className={`${inputCls} font-mono`} /></div>
              <div><label className={labelCls}>Placed at</label><input type="datetime-local" value={placedAt} onChange={(e) => setPlacedAt(e.target.value)} className={`${inputCls} font-mono`} /></div>
              <div className="sm:col-span-2"><label className={labelCls}>Notes</label><textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className={inputCls} /></div>
              <div className="sm:col-span-2"><label className={labelCls}>Audit note (optional)</label><input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Reason for change — stored in tracking history…" className={inputCls} /></div>
              <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-[#a1a1aa]"><input type="checkbox" checked={freeDelivery} onChange={(e) => setFreeDelivery(e.target.checked)} className="h-4 w-4 rounded border-gray-300 text-[#eba236] focus:ring-[#eba236]" /> Free delivery applied</label>
            </div>
          </div>

          <div>
            <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">Delivery</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div><label className={labelCls}>Service type</label><input value={serviceType} onChange={(e) => setServiceType(e.target.value)} className={`${inputCls} font-mono`} /></div>
              <div>
                <label className={labelCls}>Delivery status</label>
                <select value={deliveryStatus} onChange={(e) => setDeliveryStatus(e.target.value)} className={`${inputCls} capitalize`}>
                  {DELIVERY_STATUS_OPTS.map((s) => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
                </select>
              </div>
              <div><label className={labelCls}>Lalamove order ID</label><input value={lalamoveOrderId} onChange={(e) => setLalamoveOrderId(e.target.value)} className={`${inputCls} font-mono`} /></div>
              <div><label className={labelCls}>Tracking link</label><input value={trackingLink} onChange={(e) => setTrackingLink(e.target.value)} className={`${inputCls} font-mono`} /></div>
            </div>
          </div>

          <div className="flex gap-2">
            <button onClick={handleBack} disabled={saving} className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 dark:border-[#262626] text-sm font-medium bg-white dark:bg-[#171717] hover:bg-gray-50 dark:hover:bg-[#262626] disabled:opacity-50">Cancel</button>
            <button onClick={handleSave} disabled={saving} className="flex-1 px-4 py-2.5 rounded-xl bg-[#eba236] hover:bg-[#c88a20] text-white text-sm font-semibold disabled:opacity-50">{saving ? 'Saving…' : 'Save changes'}</button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function EditOrderPage(){
  return (
    <ClientOnly fallback={<EditOrderSkeleton />}>
      <EditOrderContent />
    </ClientOnly>
  )
}
