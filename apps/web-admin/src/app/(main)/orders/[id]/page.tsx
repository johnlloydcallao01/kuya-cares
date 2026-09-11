'use client'

import React, { useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter, notFound } from 'next/navigation'
import { ClientOnly } from '@/components/ClientOnly'
import {
  Receipt, ArrowLeft, Building, Store, MapPin, Phone, Mail, Clock, Tag, CalendarDays,
  AlertCircle, CheckCircle, Truck, Package, CreditCard, History, Ticket, Star, Pencil,
} from '@/components/ui/IconWrapper'

type OrderDoc = {
  id: number
  orderNumber: string
  status: string
  fulfillment_type: string
  total: number
  subtotal: number
  delivery_fee: number
  platform_fee: number
  priority_fee: number
  discount_total: number
  coupon_code: string | null
  free_delivery_applied: boolean
  notes: string | null
  placed_at: string | null
  lalamove: { orderId: string | null; serviceType: string; status: string; trackingLink: string | null }
  merchant: {
    id: number; outletName: string; outletCode: string; isActive: boolean
    vendor: { id: number; businessName: string; logo: { id: number; url: string | null; filename: string | null } | null } | null
  } | null
  customer: {
    id: number; email: string
    user: { id: number; email: string; firstName: string; lastName: string; phone: string | null } | null
  } | null
  items: Array<{
    id: number; product_name_snapshot: string | null; price_at_purchase: number | null
    quantity: number; total_price: number | null; options_snapshot: unknown
    merchant_product: unknown; product: unknown; createdAt: string; updatedAt: string
  }>
  booking: {
    lalamove_order_id: string | null; share_link: string | null; service_type: string
    status: string; delivery_fee: number | null; currency: string
    driver_name: string | null; driver_phone: string | null
    pickup_address: string | null; dropoff_address: string | null; distance_meters: number | null
  } | null
  location: {
    formatted_address: string | null; street: string | null; floor_unit_room: string | null
    delivery_instructions: string | null; contact_name: string | null; contact_phone: string | null
    label: string | null
  } | null
  payment: {
    isPaid: boolean
    transactions: Array<{
      id: number; payment_intent_id: string | null; payment_method: string | null
      amount: number; currency: string; status: string; paid_at: string | null; createdAt: string
    }>
  }
  trackingHistory: Array<{ id: number; status: string; timestamp: string; actor: unknown; description: string | null; createdAt: string }>
  discounts: Array<{
    id: number; code: string | null; amount_off: number | null; type: string | null
    food_discount: number | null; delivery_discount: number | null; funded_by: string | null
  }>
  review: { id: number; merchant_rating: number | null; driver_rating: number | null; comment: string | null; is_public: boolean | null; createdAt: string } | null
  createdAt: string
  updatedAt: string
}

function orderStatusBadge(s: string){
  const v = (s || '').toLowerCase()
  if (v === 'delivered') return 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-300'
  if (v === 'cancelled') return 'bg-red-50 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-300'
  if (v === 'pending') return 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-300'
  if (v === 'accepted' || v === 'preparing') return 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/20 dark:text-blue-300'
  if (v === 'ready_for_pickup' || v === 'on_delivery') return 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-900/20 dark:text-purple-300'
  return 'bg-gray-100 text-gray-700 border-gray-200'
}
function fmtDate(iso: string | null){ if(!iso) return '—'; try{return new Date(iso).toLocaleDateString('en-PH',{timeZone:'Asia/Manila',year:'numeric',month:'short',day:'numeric'})}catch{return String(iso).slice(0,10)} }
function fmtDateTime(iso: string | null){ if(!iso) return '—'; try{return new Date(iso).toLocaleString('en-PH',{timeZone:'Asia/Manila',year:'numeric',month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'})}catch{return String(iso).slice(0,16)} }
function fmtCurrency(n: number | null | undefined){ if(n==null) return '—'; try{return new Intl.NumberFormat('en-PH',{style:'currency',currency:'PHP',maximumFractionDigits:2}).format(n)}catch{return `₱${Number(n).toFixed(2)}`} }

function Section({ title, children }: { title: string; children: React.ReactNode }){
  return <div><h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">{title}</h4><div className="rounded-xl border border-gray-200 dark:border-[#262626] divide-y divide-gray-100 dark:divide-[#262626] overflow-hidden bg-white dark:bg-[#171717]">{children}</div></div>
}
function Row({ label, value, mono, icon }: { label: string; value: React.ReactNode; mono?: boolean; icon?: React.ReactNode }){
  return <div className="flex items-start justify-between gap-4 px-4 py-2.5 text-sm"><span className="text-gray-500 dark:text-[#a1a1aa] text-xs font-medium shrink-0 flex items-center gap-1">{icon}{label}</span><span className={`text-gray-900 dark:text-white text-right max-w-[60%] break-words ${mono?'font-mono text-xs':'text-sm'}`}>{value as any}</span></div>
}

function OrderViewSkeleton(){
  return <div className="space-y-6 py-5 px-2.5"><div className="h-8 w-32 bg-gray-200 dark:bg-[#262626] rounded animate-pulse" /><div className="h-64 bg-gray-100 dark:bg-[#171717] rounded-xl animate-pulse" /></div>
}

function OrderViewContent(){
  const params = useParams()
  const router = useRouter()
  const id = params.id as string
  if (!/^\d+$/.test(id)) {
    notFound()
  }
  const [doc, setDoc] = useState<OrderDoc | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    async function load(){
      setLoading(true); setError(null)
      try{
        const res = await fetch(`/api/orders/${id}`, { cache: 'no-store' })
        const j = await res.json()
        if (!res.ok) throw new Error(j.error || 'Failed to load order')
        if (!cancelled) setDoc(j.doc || j)
      }catch(e:any){ if (!cancelled) setError(e.message || 'Failed') } finally{ if (!cancelled) setLoading(false) }
    }
    void load()
    return () => { cancelled = true }
  }, [id])

  if (loading) {
    return <OrderViewSkeleton />
  }
  if (error || !doc) {
    return (
      <div className="space-y-6 py-5 px-2.5">
        <button onClick={() => (typeof window !== 'undefined' && window.history.length > 1 ? router.back() : router.push('/orders'))} className="inline-flex items-center gap-2 text-sm text-gray-600 dark:text-[#a1a1aa] hover:text-gray-900"><ArrowLeft className="w-4 h-4" /> Back</button>
        <div className="flex flex-col items-center justify-center py-16 bg-white dark:bg-[#171717] rounded-xl border border-gray-200 dark:border-[#262626]">
          <div className="h-14 w-14 bg-red-50 dark:bg-red-900/20 rounded-full flex items-center justify-center mb-4"><AlertCircle className="h-7 w-7 text-red-500" /></div>
          <h3 className="font-semibold text-gray-900 dark:text-white">Failed to load order</h3><p className="text-sm text-gray-500 mt-1">{error}</p>
          <Link href="/orders" className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-[#eba236] text-white rounded-lg text-sm font-medium">Back</Link>
        </div>
      </div>
    )
  }

  const customerName = doc.customer?.user ? `${doc.customer.user.firstName} ${doc.customer.user.lastName}`.trim() || doc.customer.email : doc.customer?.email || '—'

  return (
    <div className="space-y-6 py-5 px-2.5">
      <button onClick={() => (typeof window !== 'undefined' && window.history.length > 1 ? router.back() : router.push('/orders'))} className="inline-flex items-center gap-2 text-sm font-medium text-gray-600 dark:text-[#a1a1aa] hover:text-gray-900 dark:hover:text-white">
        <ArrowLeft className="w-4 h-4" /> Back
      </button>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-[#eba236] to-[#c88a20] text-white flex items-center justify-center shrink-0">
            <Receipt className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white tracking-tight flex items-center gap-2">
              {doc.orderNumber || `#${doc.id}`}
              <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-semibold border capitalize ${orderStatusBadge(doc.status)}`}>{doc.status.replace(/_/g, ' ')}</span>
            </h1>
            <p className="text-sm text-gray-500 dark:text-[#a1a1aa]">{doc.merchant?.outletName || '—'} • {doc.fulfillment_type} • {fmtDateTime(doc.placed_at)}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link href={`/orders/${doc.id}/edit`} className="inline-flex items-center gap-2 px-4 py-2.5 bg-[#eba236] hover:bg-[#c88a20] text-white rounded-xl text-sm font-semibold shadow-sm transition"><Pencil className="w-4 h-4" /> Edit</Link>
          <Link href="/orders" className="inline-flex items-center gap-2 px-4 py-2.5 bg-white dark:bg-[#171717] border border-gray-200 dark:border-[#262626] rounded-xl text-sm font-medium text-gray-700 dark:text-[#a1a1aa] hover:bg-gray-50">Close</Link>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="rounded-xl border border-gray-200 dark:border-[#262626] bg-white dark:bg-[#171717] p-4"><p className="text-xs text-gray-500">Total</p><p className="mt-2 font-bold text-lg text-gray-900 dark:text-white">{fmtCurrency(doc.total)}</p><p className="text-xs text-gray-500 mt-1">sub {fmtCurrency(doc.subtotal)}</p></div>
        <div className="rounded-xl border border-gray-200 dark:border-[#262626] bg-white dark:bg-[#171717] p-4"><p className="text-xs text-gray-500">Fulfillment</p><p className="mt-2 font-semibold text-sm capitalize text-gray-900 dark:text-white">{doc.fulfillment_type}</p><p className="text-xs text-gray-500 mt-1">{doc.delivery_fee ? `fee ${fmtCurrency(doc.delivery_fee)}` : 'no delivery fee'}</p></div>
        <div className="rounded-xl border border-gray-200 dark:border-[#262626] bg-white dark:bg-[#171717] p-4"><p className="text-xs text-gray-500">Payment</p><p className={`mt-2 font-semibold text-sm ${doc.payment?.isPaid ? 'text-emerald-600' : 'text-amber-600'}`}>{doc.payment?.isPaid ? 'Paid' : 'Unpaid'}</p><p className="text-xs text-gray-500 mt-1">{doc.payment?.transactions?.length || 0} transaction(s)</p></div>
        <div className="rounded-xl border border-gray-200 dark:border-[#262626] bg-white dark:bg-[#171717] p-4"><p className="text-xs text-gray-500">Items</p><p className="mt-2 font-bold text-lg text-gray-900 dark:text-white">{doc.items?.length || 0}</p><p className="text-xs text-gray-500 mt-1">{doc.discounts?.length || 0} discount(s)</p></div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="space-y-5">
          <Section title="Order">
            <Row label="Order number" value={doc.orderNumber || `#${doc.id}`} mono />
            <Row label="Status" value={doc.status.replace(/_/g, ' ')} />
            <Row label="Fulfillment" value={doc.fulfillment_type} />
            <Row label="Coupon" value={doc.coupon_code || '—'} mono />
            <Row label="Free delivery" value={doc.free_delivery_applied ? 'Yes' : 'No'} />
            <Row label="Notes" value={doc.notes || '—'} />
            <Row label="Placed" value={fmtDateTime(doc.placed_at)} mono icon={<Clock className="w-3 h-3" />} />
          </Section>
          <Section title="Amounts (PHP)">
            <Row label="Subtotal" value={fmtCurrency(doc.subtotal)} mono />
            <Row label="Delivery fee" value={fmtCurrency(doc.delivery_fee)} mono />
            <Row label="Platform fee" value={fmtCurrency(doc.platform_fee)} mono />
            <Row label="Priority fee" value={fmtCurrency(doc.priority_fee)} mono />
            <Row label="Discount" value={doc.discount_total ? `−${fmtCurrency(doc.discount_total)}` : '—'} mono />
            <Row label="Total" value={fmtCurrency(doc.total)} mono />
          </Section>
          <Section title="Customer">
            <Row label="Name" value={customerName} icon={<Mail className="w-3 h-3" />} />
            <Row label="Email" value={doc.customer?.email || doc.customer?.user?.email || '—'} />
            <Row label="Phone" value={doc.customer?.user?.phone || '—'} icon={<Phone className="w-3 h-3" />} />
          </Section>
          <Section title="Outlet">
            <Row label="Outlet" value={doc.merchant ? `${doc.merchant.outletName} (${doc.merchant.outletCode})` : '—'} icon={<Store className="w-3 h-3" />} />
            <Row label="Vendor" value={doc.merchant?.vendor?.businessName || '—'} icon={<Building className="w-3 h-3" />} />
          </Section>
        </div>
        <div className="space-y-5">
          <Section title="Delivery">
            <Row label="Service" value={doc.booking?.service_type || doc.lalamove?.serviceType || '—'} mono />
            <Row label="Lalamove status" value={(doc.booking?.status || doc.lalamove?.status || '—').replace(/_/g, ' ')} />
            <Row label="Lalamove order" value={doc.booking?.lalamove_order_id || doc.lalamove?.orderId || '—'} mono />
            <Row label="Tracking" value={doc.booking?.share_link || doc.lalamove?.trackingLink ? 'Has link' : '—'} />
            <Row label="Driver" value={doc.booking?.driver_name ? `${doc.booking.driver_name}${doc.booking.driver_phone ? ` • ${doc.booking.driver_phone}` : ''}` : '—'} />
            <Row label="Dropoff" value={doc.booking?.dropoff_address || doc.location?.formatted_address || '—'} icon={<MapPin className="w-3 h-3" />} />
            <Row label="Instructions" value={doc.location?.delivery_instructions || '—'} />
          </Section>
          {doc.items && doc.items.length > 0 && (
            <Section title={`Items (${doc.items.length})`}>
              <div className="divide-y divide-gray-100 dark:divide-[#262626]">
                {doc.items.map((it: any) => (
                  <div key={it.id} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm">
                    <div className="min-w-0">
                      <div className="font-medium text-gray-900 dark:text-white truncate">{it.product_name_snapshot || 'Item'} × {it.quantity}</div>
                      <div className="text-xs text-gray-500 font-mono">#{it.id} • {fmtCurrency(it.price_at_purchase)} each</div>
                    </div>
                    <span className="font-semibold text-gray-900 dark:text-white shrink-0">{fmtCurrency(it.total_price)}</span>
                  </div>
                ))}
              </div>
            </Section>
          )}
          {doc.payment?.transactions && doc.payment.transactions.length > 0 && (
            <Section title={`Payments (${doc.payment.transactions.length})`}>
              <div className="divide-y divide-gray-100 dark:divide-[#262626]">
                {doc.payment.transactions.map((t: any) => (
                  <div key={t.id} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm">
                    <div className="min-w-0">
                      <div className="font-medium text-gray-900 dark:text-white flex items-center gap-1.5"><CreditCard className="w-3 h-3 text-gray-400" />{t.payment_method || '—'} • {t.status}</div>
                      <div className="text-xs text-gray-500 font-mono truncate">{t.payment_intent_id || `#${t.id}`} • {fmtDateTime(t.paid_at || t.createdAt)}</div>
                    </div>
                    <span className="font-semibold text-gray-900 dark:text-white shrink-0">{fmtCurrency(t.amount)}</span>
                  </div>
                ))}
              </div>
            </Section>
          )}
          {doc.discounts && doc.discounts.length > 0 && (
            <Section title={`Discounts (${doc.discounts.length})`}>
              <div className="divide-y divide-gray-100 dark:divide-[#262626]">
                {doc.discounts.map((d: any) => (
                  <div key={d.id} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm">
                    <div className="min-w-0">
                      <div className="font-medium text-gray-900 dark:text-white flex items-center gap-1.5"><Ticket className="w-3 h-3 text-gray-400" />{d.code || d.type || 'Discount'}</div>
                      <div className="text-xs text-gray-500">{d.funded_by ? `${d.funded_by} funded` : ''}</div>
                    </div>
                    <span className="font-semibold text-emerald-600 shrink-0">−{fmtCurrency(d.amount_off)}</span>
                  </div>
                ))}
              </div>
            </Section>
          )}
          {doc.trackingHistory && doc.trackingHistory.length > 0 && (
            <Section title="Status history">
              <div className="divide-y divide-gray-100 dark:divide-[#262626]">
                {doc.trackingHistory.map((h: any) => (
                  <div key={h.id} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm">
                    <div className="min-w-0">
                      <div className="font-medium text-gray-900 dark:text-white capitalize">{String(h.status).replace(/_/g, ' ')}</div>
                      {h.description && <div className="text-xs text-gray-500 truncate">{h.description}</div>}
                    </div>
                    <span className="font-mono text-xs text-gray-500 shrink-0">{fmtDateTime(h.timestamp)}</span>
                  </div>
                ))}
              </div>
            </Section>
          )}
          {doc.review && (
            <Section title="Review">
              <Row label="Merchant rating" value={doc.review.merchant_rating != null ? `${doc.review.merchant_rating} / 5` : '—'} icon={<Star className="w-3 h-3" />} />
              <Row label="Driver rating" value={doc.review.driver_rating != null ? `${doc.review.driver_rating} / 5` : '—'} />
              <Row label="Comment" value={doc.review.comment || '—'} />
            </Section>
          )}
          <div className="rounded-xl border border-gray-200 dark:border-[#262626] bg-white dark:bg-[#171717] p-4">
            <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-2 flex items-center gap-2"><CalendarDays className="w-4 h-4 text-[#eba236]" /> Timeline</h4>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-gray-500">Placed</span><span className="font-mono text-xs text-gray-900 dark:text-white">{fmtDateTime(doc.placed_at)}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Created</span><span className="font-mono text-xs text-gray-900 dark:text-white">{fmtDate(doc.createdAt)}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Updated</span><span className="font-mono text-xs text-gray-900 dark:text-white">{fmtDate(doc.updatedAt)}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">ID</span><span className="font-mono text-xs text-gray-900 dark:text-white">#{doc.id}</span></div>
            </div>
          </div>
          <Section title="Tags">
            <div className="p-4">
              <div className="flex flex-wrap gap-2">
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-gray-100 dark:bg-[#262626] text-gray-700 dark:text-[#a1a1aa] border border-gray-200 dark:border-[#333]"><Tag className="w-3 h-3" />{doc.status}</span>
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-gray-100 dark:bg-[#262626] text-gray-700 dark:text-[#a1a1aa] border border-gray-200 dark:border-[#333]"><History className="w-3 h-3" />{doc.trackingHistory?.length || 0} events</span>
              </div>
            </div>
          </Section>
        </div>
      </div>
    </div>
  )
}

export default function OrderViewPage(){
  // Pure CSR mirroring vendors/[id]: server + hydration emit identical
  // skeleton; aggregated doc (items, payments, tracking) loads post-mount.
  return (
    <ClientOnly fallback={<OrderViewSkeleton />}>
      <OrderViewContent />
    </ClientOnly>
  )
}
