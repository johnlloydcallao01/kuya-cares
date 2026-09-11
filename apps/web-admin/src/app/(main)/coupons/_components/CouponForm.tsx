'use client'

import React, { useState, useEffect } from 'react'
import {
  Ticket, DollarSign, Store, ShieldCheck, Clock, Users, AlertCircle, RefreshCw,
  Tag, Truck, CalendarDays
} from '@/components/ui/IconWrapper'
import type { CouponDoc } from '../page'

const STATUS_OPTS = [
  { value: 'draft', label: 'Draft' },
  { value: 'scheduled', label: 'Scheduled' },
  { value: 'published', label: 'Published' },
  { value: 'paused', label: 'Paused' },
  { value: 'archived', label: 'Archived' },
]
const TYPE_OPTS = [
  { value: 'percent', label: 'Percentage off' },
  { value: 'fixed_cart', label: 'Fixed amount off basket' },
  { value: 'fixed_product', label: 'Fixed amount off each item' },
]
const APPLIES_OPTS = [
  { value: 'food_subtotal', label: 'Food subtotal' },
  { value: 'delivery_fee', label: 'Delivery fee' },
  { value: 'both', label: 'Both' },
]
const SCOPE_OPTS = [
  { value: 'all_vendor_branches', label: 'All vendor branches' },
  { value: 'selected_branches', label: 'Selected branches' },
]
const FUNDED_OPTS = [
  { value: 'platform', label: 'Platform pays' },
  { value: 'vendor', label: 'Vendor pays' },
  { value: 'split', label: 'Split' },
]
const PAYMENT_OPTS = [
  { value: 'card', label: 'Card' },
  { value: 'gcash', label: 'GCash' },
  { value: 'grab_pay', label: 'GrabPay' },
  { value: 'paymaya', label: 'PayMaya' },
  { value: 'billease', label: 'BillEase' },
  { value: 'dob', label: 'Cash on delivery' },
  { value: 'brankas', label: 'Brankas' },
  { value: 'qrph', label: 'QR Ph' },
]
const DAY_OPTS = [
  { value: 'mon', label: 'Mon' },
  { value: 'tue', label: 'Tue' },
  { value: 'wed', label: 'Wed' },
  { value: 'thu', label: 'Thu' },
  { value: 'fri', label: 'Fri' },
  { value: 'sat', label: 'Sat' },
  { value: 'sun', label: 'Sun' },
]

const inputCls = 'mt-1 w-full px-3 py-2.5 rounded-lg border border-gray-200 dark:border-[#262626] bg-white dark:bg-[#0a0a0a] text-sm'
const labelCls = 'text-xs font-medium text-gray-700 dark:text-[#a1a1aa]'

function relId(v: unknown): string {
  if (v == null) return ''
  if (typeof v === 'string' || typeof v === 'number') return String(v)
  if (typeof v === 'object' && v !== null && 'id' in (v as any)) return String((v as any).id)
  return ''
}
function relIds(v: unknown): string[] {
  if (!Array.isArray(v)) {
    const s = relId(v)
    return s ? [s] : []
  }
  return v.map(relId).filter(Boolean)
}
function toDateTimeLocal(iso: unknown): string {
  if (!iso) return ''
  try {
    const d = new Date(String(iso))
    if (Number.isNaN(d.getTime())) return ''
    const pad = (n: number) => String(n).padStart(2, '0')
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
  } catch { return '' }
}

type Option = { id: string; label: string; sub?: string }

function MultiPick({ label, hint, options, value, onChange, placeholder }: {
  label: string; hint?: string; options: Option[]; value: string[]; onChange: (v: string[]) => void; placeholder?: string
}) {
  const [q, setQ] = useState('')
  const filtered = options.filter((o) => !q.trim() || o.label.toLowerCase().includes(q.trim().toLowerCase()))
  const toggle = (id: string) => onChange(value.includes(id) ? value.filter((x) => x !== id) : [...value, id])
  return (
    <div>
      <label className={labelCls}>{label} {value.length > 0 && <span className="text-[#eba236] font-semibold">({value.length} selected)</span>}</label>
      {hint && <p className="text-xs text-gray-400 mt-0.5">{hint}</p>}
      <div className="mt-1 rounded-lg border border-gray-200 dark:border-[#262626] bg-white dark:bg-[#0a0a0a] overflow-hidden">
        <div className="px-3 py-2 border-b border-gray-100 dark:border-[#262626]">
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={placeholder || 'Search…'} className="w-full text-sm bg-transparent focus:outline-none text-gray-900 dark:text-white placeholder:text-gray-400" />
        </div>
        <div className="max-h-44 overflow-y-auto p-2 space-y-1">
          {filtered.length === 0 && <p className="text-xs text-gray-400 px-2 py-3 text-center">No matches — try another search.</p>}
          {filtered.slice(0, 100).map((o) => (
            <label key={o.id} className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-gray-50 dark:hover:bg-[#262626] cursor-pointer">
              <input type="checkbox" checked={value.includes(o.id)} onChange={() => toggle(o.id)} className="h-4 w-4 rounded border-gray-300 text-[#eba236] shrink-0" />
              <span className="min-w-0"><span className="block text-sm text-gray-900 dark:text-white truncate">{o.label}</span>{o.sub && <span className="block text-xs text-gray-400 truncate">{o.sub}</span>}</span>
            </label>
          ))}
          {filtered.length > 100 && <p className="text-xs text-gray-400 px-2 py-1">Showing first 100 of {filtered.length} — refine your search.</p>}
        </div>
      </div>
    </div>
  )
}

export function CouponForm({ initial, onSuccess, onCancel }: { initial?: CouponDoc | null; onSuccess: () => void; onCancel: () => void }) {
  const isEdit = !!initial
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // lookups (existing thin BFF proxies — no raw collection stitching in page)
  const [vendorOpts, setVendorOpts] = useState<Option[]>([])
  const [merchantOpts, setMerchantOpts] = useState<Option[]>([])
  const [productOpts, setProductOpts] = useState<Option[]>([])
  const [categoryOpts, setCategoryOpts] = useState<Option[]>([])

  const [form, setForm] = useState({
    code: initial?.code || '',
    description: initial?.description || '',
    status: initial?.status || 'draft',
    discount_type: initial?.discount_type || 'fixed_cart',
    amount: initial?.amount !== undefined && initial?.amount !== null ? String(initial.amount) : '',
    max_discount_amount: initial?.max_discount_amount !== undefined && initial?.max_discount_amount !== null ? String(initial.max_discount_amount) : '',
    applies_to: initial?.applies_to || 'food_subtotal',
    free_delivery: initial?.free_delivery ?? false,
    delivery_discount_cap: initial?.delivery_discount_cap !== undefined && initial?.delivery_discount_cap !== null ? String(initial.delivery_discount_cap) : '',
    vendor: relId(initial?.vendor),
    merchant_scope: initial?.merchant_scope || 'all_vendor_branches',
    merchants: relIds(initial?.merchants),
    menu_items: relIds(initial?.menu_items),
    excluded_menu_items: relIds(initial?.excluded_menu_items),
    menu_categories: relIds(initial?.menu_categories),
    excluded_menu_categories: relIds(initial?.excluded_menu_categories),
    exclude_promo_items: initial?.exclude_promo_items ?? false,
    minimum_basket: initial?.minimum_basket !== undefined && initial?.minimum_basket !== null ? String(initial.minimum_basket) : '',
    maximum_basket: initial?.maximum_basket !== undefined && initial?.maximum_basket !== null ? String(initial.maximum_basket) : '',
    limit_per_order_items: initial?.limit_per_order_items !== undefined && initial?.limit_per_order_items !== null ? String(initial.limit_per_order_items) : '',
    individual_use: initial?.individual_use ?? true,
    max_coupons_per_order: initial?.max_coupons_per_order !== undefined && initial?.max_coupons_per_order !== null ? String(initial.max_coupons_per_order) : '1',
    starts_at: toDateTimeLocal(initial?.starts_at),
    expires_at: toDateTimeLocal(initial?.expires_at),
    usage_limit: initial?.usage_limit !== undefined && initial?.usage_limit !== null ? String(initial.usage_limit) : '0',
    usage_limit_per_user: initial?.usage_limit_per_user !== undefined && initial?.usage_limit_per_user !== null ? String(initial.usage_limit_per_user) : '0',
    email_restrictions: Array.isArray(initial?.email_restrictions) ? (initial?.email_restrictions as string[]).join(', ') : '',
    phone_restrictions: Array.isArray(initial?.phone_restrictions) ? (initial?.phone_restrictions as string[]).join(', ') : '',
    first_order_only: initial?.first_order_only ?? false,
    allowed_payment_methods: Array.isArray(initial?.allowed_payment_methods) ? [...(initial?.allowed_payment_methods as string[])] : [],
    time_windows: Array.isArray(initial?.time_windows) ? (initial?.time_windows as any[]).map((w) => ({ days: Array.isArray(w?.days) ? [...w.days] : [], start_time: String(w?.start_time || ''), end_time: String(w?.end_time || '') })) : [],
    funded_by: initial?.funded_by || 'platform',
    vendor_share_pct: initial?.vendor_share_pct !== undefined && initial?.vendor_share_pct !== null ? String(initial.vendor_share_pct) : '0',
  })
  const set = (k: string, v: any) => setForm((prev) => ({ ...prev, [k]: v }))

  useEffect(() => {
    let cancelled = false
    const loadOpts = async () => {
      try {
        const [vRes, mRes, pRes, cRes] = await Promise.all([
          fetch('/api/vendors?limit=100&sort=businessName', { cache: 'no-store' }).then((r) => r.json().catch(() => ({}))),
          fetch('/api/merchants?limit=200&sort=outletName', { cache: 'no-store' }).then((r) => r.json().catch(() => ({}))),
          fetch('/api/products?limit=200&sort=name', { cache: 'no-store' }).then((r) => r.json().catch(() => ({}))),
          fetch('/api/product-categories?limit=200', { cache: 'no-store' }).then((r) => r.json().catch(() => ({}))),
        ])
        if (cancelled) return
        const vDocs = Array.isArray(vRes?.docs) ? vRes.docs : []
        setVendorOpts(vDocs.map((v: any) => ({ id: String(v.id), label: String(v.businessName || `Vendor #${v.id}`), sub: v.legalName || undefined })))
        const mDocs = Array.isArray(mRes?.docs) ? mRes.docs : []
        setMerchantOpts(mDocs.map((m: any) => {
          const vendor = m.vendor && typeof m.vendor === 'object' ? String(m.vendor.businessName || '') : ''
          return { id: String(m.id), label: String(m.outletName || `Outlet #${m.id}`), sub: [vendor, m.outletCode].filter(Boolean).join(' • ') || undefined }
        }))
        const pDocs = Array.isArray(pRes?.docs) ? pRes.docs : []
        setProductOpts(pDocs.map((p: any) => ({ id: String(p.id), label: String(p.name || `Product #${p.id}`), sub: p.sku ? `SKU ${p.sku}` : undefined })))
        const cDocs = Array.isArray(cRes?.docs) ? cRes.docs : (Array.isArray(cRes) ? cRes : [])
        setCategoryOpts(cDocs.map((c: any) => ({ id: String(c.id), label: String(c.name || c.title || `Category #${c.id}`) })))
      } catch { /* lookup failure must not block the form */ }
    }
    void loadOpts()
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    if (!initial) return
    setForm({
      code: initial?.code || '',
      description: initial?.description || '',
      status: initial?.status || 'draft',
      discount_type: initial?.discount_type || 'fixed_cart',
      amount: initial?.amount !== undefined && initial?.amount !== null ? String(initial.amount) : '',
      max_discount_amount: initial?.max_discount_amount !== undefined && initial?.max_discount_amount !== null ? String(initial.max_discount_amount) : '',
      applies_to: initial?.applies_to || 'food_subtotal',
      free_delivery: initial?.free_delivery ?? false,
      delivery_discount_cap: initial?.delivery_discount_cap !== undefined && initial?.delivery_discount_cap !== null ? String(initial.delivery_discount_cap) : '',
      vendor: relId(initial?.vendor),
      merchant_scope: initial?.merchant_scope || 'all_vendor_branches',
      merchants: relIds(initial?.merchants),
      menu_items: relIds(initial?.menu_items),
      excluded_menu_items: relIds(initial?.excluded_menu_items),
      menu_categories: relIds(initial?.menu_categories),
      excluded_menu_categories: relIds(initial?.excluded_menu_categories),
      exclude_promo_items: initial?.exclude_promo_items ?? false,
      minimum_basket: initial?.minimum_basket !== undefined && initial?.minimum_basket !== null ? String(initial.minimum_basket) : '',
      maximum_basket: initial?.maximum_basket !== undefined && initial?.maximum_basket !== null ? String(initial.maximum_basket) : '',
      limit_per_order_items: initial?.limit_per_order_items !== undefined && initial?.limit_per_order_items !== null ? String(initial.limit_per_order_items) : '',
      individual_use: initial?.individual_use ?? true,
      max_coupons_per_order: initial?.max_coupons_per_order !== undefined && initial?.max_coupons_per_order !== null ? String(initial.max_coupons_per_order) : '1',
      starts_at: toDateTimeLocal(initial?.starts_at),
      expires_at: toDateTimeLocal(initial?.expires_at),
      usage_limit: initial?.usage_limit !== undefined && initial?.usage_limit !== null ? String(initial.usage_limit) : '0',
      usage_limit_per_user: initial?.usage_limit_per_user !== undefined && initial?.usage_limit_per_user !== null ? String(initial.usage_limit_per_user) : '0',
      email_restrictions: Array.isArray(initial?.email_restrictions) ? (initial?.email_restrictions as string[]).join(', ') : '',
      phone_restrictions: Array.isArray(initial?.phone_restrictions) ? (initial?.phone_restrictions as string[]).join(', ') : '',
      first_order_only: initial?.first_order_only ?? false,
      allowed_payment_methods: Array.isArray(initial?.allowed_payment_methods) ? [...(initial?.allowed_payment_methods as string[])] : [],
      time_windows: Array.isArray(initial?.time_windows) ? (initial?.time_windows as any[]).map((w) => ({ days: Array.isArray(w?.days) ? [...w.days] : [], start_time: String(w?.start_time || ''), end_time: String(w?.end_time || '') })) : [],
      funded_by: initial?.funded_by || 'platform',
      vendor_share_pct: initial?.vendor_share_pct !== undefined && initial?.vendor_share_pct !== null ? String(initial.vendor_share_pct) : '0',
    })
    setError(null)
  }, [initial])

  const numOrNull = (v: string) => (v.trim() === '' ? null : Number(v))
  const submit = async () => {
    setError(null)
    const code = form.code.trim().toUpperCase()
    if (!code || code.length < 3 || code.length > 32) return setError('Coupon code is required (3–32 characters)')
    if (!/^[A-Z0-9][A-Z0-9\-_&$@]*$/.test(code)) return setError('Coupon code may only contain letters, numbers, and - _ & $ @')
    const amount = Number(form.amount)
    if (!Number.isFinite(amount) || amount <= 0) return setError('Discount amount must be greater than 0')
    if (form.discount_type === 'percent' && amount > 100) return setError('Percentage coupons cannot exceed 100')
    if (form.max_discount_amount.trim() !== '' && !(Number(form.max_discount_amount) > 0)) return setError('Max discount cap must be greater than 0')
    if (form.delivery_discount_cap.trim() !== '' && !(Number(form.delivery_discount_cap) > 0)) return setError('Delivery discount cap must be greater than 0')
    if (form.minimum_basket.trim() !== '' && form.maximum_basket.trim() !== '' && Number(form.minimum_basket) > Number(form.maximum_basket)) return setError('Minimum basket cannot be greater than maximum basket')
    if (form.merchant_scope === 'selected_branches' && form.merchants.length === 0) return setError('Select at least one branch for selected-branches scope')
    if (form.limit_per_order_items.trim() !== '') {
      if (!(Number(form.limit_per_order_items) >= 1)) return setError('Per-item limit must be at least 1')
      if (form.menu_items.length === 0 && form.menu_categories.length === 0) return setError('Per-item limit only works when menu items or categories are set')
    }
    if (form.funded_by === 'split' && !(Number(form.vendor_share_pct) > 0 && Number(form.vendor_share_pct) < 100)) return setError('Vendor share must be between 1 and 99 for split funding')
    if (Number(form.usage_limit) < 0 || Number(form.usage_limit_per_user) < 0) return setError('Usage limits cannot be negative')
    if (Number(form.usage_limit) > 0 && Number(form.usage_limit_per_user) > Number(form.usage_limit)) return setError('Per-customer limit cannot exceed the total limit')
    if (form.starts_at && form.expires_at && new Date(form.starts_at).getTime() >= new Date(form.expires_at).getTime()) return setError('Start date must be before expiry date')
    for (const w of form.time_windows) {
      if (w.days.length === 0) return setError('Each promo schedule needs at least one day')
      if (!/^\d{1,2}:\d{2}$/.test(w.start_time) || !/^\d{1,2}:\d{2}$/.test(w.end_time)) return setError('Promo schedule times must look like 11:00')
    }

    setSaving(true)
    try {
      const payload: any = {
        description: form.description.trim() || null,
        status: form.status,
        amount,
        max_discount_amount: numOrNull(form.max_discount_amount),
        applies_to: form.applies_to,
        free_delivery: form.free_delivery,
        delivery_discount_cap: numOrNull(form.delivery_discount_cap),
        vendor: form.vendor ? Number(form.vendor) : null,
        merchant_scope: form.merchant_scope,
        merchants: form.merchants.map(Number),
        menu_items: form.menu_items.map(Number),
        excluded_menu_items: form.excluded_menu_items.map(Number),
        menu_categories: form.menu_categories.map(Number),
        excluded_menu_categories: form.excluded_menu_categories.map(Number),
        exclude_promo_items: form.exclude_promo_items,
        minimum_basket: numOrNull(form.minimum_basket),
        maximum_basket: numOrNull(form.maximum_basket),
        limit_per_order_items: form.limit_per_order_items.trim() === '' ? null : Number(form.limit_per_order_items),
        individual_use: form.individual_use,
        max_coupons_per_order: Number(form.max_coupons_per_order) || 1,
        starts_at: form.starts_at ? new Date(form.starts_at).toISOString() : null,
        expires_at: form.expires_at ? new Date(form.expires_at).toISOString() : null,
        usage_limit: Number(form.usage_limit) || 0,
        usage_limit_per_user: Number(form.usage_limit_per_user) || 0,
        email_restrictions: form.email_restrictions.split(',').map((s) => s.trim().toLowerCase()).filter(Boolean),
        phone_restrictions: form.phone_restrictions.split(',').map((s) => s.trim().toLowerCase()).filter(Boolean),
        first_order_only: form.first_order_only,
        allowed_payment_methods: form.allowed_payment_methods,
        time_windows: form.time_windows.map((w) => ({ days: w.days, start_time: w.start_time, end_time: w.end_time })),
        funded_by: form.funded_by,
        vendor_share_pct: Number(form.vendor_share_pct) || 0,
      }
      if (!isEdit) {
        // identity is set once — code, vendor, and type lock after creation
        payload.code = code
        payload.discount_type = form.discount_type
      }
      const url = isEdit ? `/api/coupons/${(initial as any).id}` : '/api/coupons'
      const method = isEdit ? 'PATCH' : 'POST'
      const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
      const j = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(j.error || j.details || 'Request failed')
      onSuccess()
    } catch (e: any) { setError(e?.message || 'Save failed') }
    finally { setSaving(false) }
  }

  const scopedMerchants = merchantOpts
  const toggleMethod = (v: string) => set('allowed_payment_methods', form.allowed_payment_methods.includes(v) ? form.allowed_payment_methods.filter((x) => x !== v) : [...form.allowed_payment_methods, v])
  const addWindow = () => set('time_windows', [...form.time_windows, { days: [], start_time: '11:00', end_time: '14:00' }])
  const setWindow = (i: number, patch: Partial<{ days: string[]; start_time: string; end_time: string }>) =>
    set('time_windows', form.time_windows.map((w, idx) => (idx === i ? { ...w, ...patch } : w)))
  const removeWindow = (i: number) => set('time_windows', form.time_windows.filter((_, idx) => idx !== i))
  const toggleDay = (i: number, d: string) => {
    const cur = form.time_windows[i]?.days || []
    setWindow(i, { days: cur.includes(d) ? cur.filter((x) => x !== d) : [...cur, d] })
  }

  return (
    <div className="bg-white dark:bg-[#171717] rounded-xl border border-gray-200 dark:border-[#262626] shadow-sm overflow-hidden">
      <div className="p-6 space-y-6">
        {error && <div className="flex items-start gap-2 p-3 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-sm text-red-700 dark:text-red-300"><AlertCircle className="w-4 h-4 mt-0.5 shrink-0" /> {error}</div>}
        {isEdit && <p className="text-xs text-gray-500 dark:text-[#a1a1aa]">Code, vendor, and discount type are locked after creation — archive this coupon and create a new one to change them. Used {initial?.usage_count ?? 0} time(s).</p>}

        {/* 1. Coupon Basics */}
        <div>
          <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2"><Ticket className="w-4 h-4 text-[#eba236]" /> Coupon Basics</h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div><label className={labelCls}>Coupon code * <span className="text-gray-400 font-normal">(uppercase, 3–32 chars)</span></label><input value={form.code} onChange={(e) => set('code', e.target.value.toUpperCase())} placeholder="JOLLIBEE10" disabled={isEdit} className={`${inputCls} font-mono ${isEdit ? 'opacity-50 cursor-not-allowed' : ''}`} /></div>
            <div><label className={labelCls}>Status *</label><select value={form.status} onChange={(e) => set('status', e.target.value)} className={inputCls}>{STATUS_OPTS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</select></div>
            <div className="sm:col-span-2"><label className={labelCls}>Internal description</label><textarea value={form.description} onChange={(e) => set('description', e.target.value)} rows={2} placeholder="Campaign notes for the team — never shown to customers…" className={inputCls} /></div>
          </div>
        </div>

        {/* 2. Discount */}
        <div>
          <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2"><DollarSign className="w-4 h-4 text-emerald-600" /> Discount</h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div><label className={labelCls}>Discount type *</label><select value={form.discount_type} onChange={(e) => set('discount_type', e.target.value)} disabled={isEdit} className={`${inputCls} ${isEdit ? 'opacity-50 cursor-not-allowed' : ''}`}>{TYPE_OPTS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</select></div>
            <div><label className={labelCls}>Amount * <span className="text-gray-400 font-normal">({form.discount_type === 'percent' ? '0–100%' : 'pesos'})</span></label><input type="number" min={0} value={form.amount} onChange={(e) => set('amount', e.target.value)} placeholder={form.discount_type === 'percent' ? '10' : '50'} className={inputCls} /></div>
            {form.discount_type === 'percent' && <div><label className={labelCls}>Max discount cap <span className="text-gray-400 font-normal">(pesos, e.g. 20% up to ₱100)</span></label><input type="number" min={0} value={form.max_discount_amount} onChange={(e) => set('max_discount_amount', e.target.value)} placeholder="100" className={inputCls} /></div>}
            <div><label className={labelCls}>Applies to *</label><select value={form.applies_to} onChange={(e) => set('applies_to', e.target.value)} className={inputCls}>{APPLIES_OPTS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</select></div>
            <div className="flex items-center gap-3 pt-6"><label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={form.free_delivery} onChange={(e) => set('free_delivery', e.target.checked)} className="h-4 w-4 rounded border-gray-300 text-[#eba236]" /> <span className="text-sm font-medium text-gray-700 dark:text-white">Free delivery</span></label></div>
            {form.free_delivery && <div><label className={labelCls}>Delivery discount cap <span className="text-gray-400 font-normal">(pesos, empty = full fee)</span></label><input type="number" min={0} value={form.delivery_discount_cap} onChange={(e) => set('delivery_discount_cap', e.target.value)} placeholder="80" className={inputCls} /></div>}
          </div>
        </div>

        {/* 3. Scope */}
        <div>
          <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2"><Store className="w-4 h-4 text-emerald-600" /> Brand & Branch Scope</h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div><label className={labelCls}>Vendor (brand)</label><select value={form.vendor} onChange={(e) => set('vendor', e.target.value)} disabled={isEdit} className={`${inputCls} ${isEdit ? 'opacity-50 cursor-not-allowed' : ''}`}><option value="">Platform-wide (all brands)</option>{vendorOpts.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}</select></div>
            <div><label className={labelCls}>Branch scope *</label><select value={form.merchant_scope} onChange={(e) => set('merchant_scope', e.target.value)} className={inputCls}>{SCOPE_OPTS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</select></div>
            {form.merchant_scope === 'selected_branches' && (
              <div className="sm:col-span-2"><MultiPick label="Branches" hint="Only these outlets accept the coupon. Empty means all branches." options={scopedMerchants} value={form.merchants} onChange={(v) => set('merchants', v)} placeholder="Search outlets…" /></div>
            )}
          </div>
        </div>

        {/* 4. Menu scoping */}
        <div>
          <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2"><Tag className="w-4 h-4 text-blue-600" /> Menu Scoping <span className="text-xs font-normal text-gray-400">(empty = whole menu)</span></h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <MultiPick label="Only these items" options={productOpts} value={form.menu_items} onChange={(v) => set('menu_items', v)} placeholder="Search menu items…" />
            <MultiPick label="Exclude these items" options={productOpts} value={form.excluded_menu_items} onChange={(v) => set('excluded_menu_items', v)} placeholder="Search menu items…" />
            <MultiPick label="Only these categories" options={categoryOpts} value={form.menu_categories} onChange={(v) => set('menu_categories', v)} placeholder="Search categories…" />
            <MultiPick label="Exclude these categories" options={categoryOpts} value={form.excluded_menu_categories} onChange={(v) => set('excluded_menu_categories', v)} placeholder="Search categories…" />
          </div>
          <label className="flex items-center gap-2 cursor-pointer mt-3"><input type="checkbox" checked={form.exclude_promo_items} onChange={(e) => set('exclude_promo_items', e.target.checked)} className="h-4 w-4 rounded border-gray-300 text-[#eba236]" /> <span className="text-sm font-medium text-gray-700 dark:text-white">Skip items already on promo</span></label>
        </div>

        {/* 5. Basket rules */}
        <div>
          <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2"><ShieldCheck className="w-4 h-4 text-amber-600" /> Basket Rules</h4>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div><label className={labelCls}>Minimum basket (₱)</label><input type="number" min={0} value={form.minimum_basket} onChange={(e) => set('minimum_basket', e.target.value)} placeholder="299" className={inputCls} /></div>
            <div><label className={labelCls}>Maximum basket (₱)</label><input type="number" min={0} value={form.maximum_basket} onChange={(e) => set('maximum_basket', e.target.value)} placeholder="No max" className={inputCls} /></div>
            <div><label className={labelCls}>Per-item unit limit</label><input type="number" min={1} value={form.limit_per_order_items} onChange={(e) => set('limit_per_order_items', e.target.value)} placeholder="Needs menu scope" className={inputCls} /></div>
            <div className="flex items-center gap-3 pt-6"><label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={form.individual_use} onChange={(e) => set('individual_use', e.target.checked)} className="h-4 w-4 rounded border-gray-300 text-[#eba236]" /> <span className="text-sm font-medium text-gray-700 dark:text-white">One coupon per order</span></label></div>
            <div><label className={labelCls}>Max coupons per order</label><input type="number" min={1} value={form.max_coupons_per_order} onChange={(e) => set('max_coupons_per_order', e.target.value)} className={inputCls} /></div>
            <div className="flex items-center gap-3 pt-6"><label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={form.first_order_only} onChange={(e) => set('first_order_only', e.target.checked)} className="h-4 w-4 rounded border-gray-300 text-[#eba236]" /> <span className="text-sm font-medium text-gray-700 dark:text-white">First orders only</span></label></div>
          </div>
        </div>

        {/* 6. Schedule */}
        <div>
          <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2"><Clock className="w-4 h-4 text-[#eba236]" /> Schedule</h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div><label className={labelCls}>Starts at</label><input type="datetime-local" value={form.starts_at} onChange={(e) => set('starts_at', e.target.value)} className={inputCls} /></div>
            <div><label className={labelCls}>Expires at</label><input type="datetime-local" value={form.expires_at} onChange={(e) => set('expires_at', e.target.value)} className={inputCls} /></div>
          </div>
          <div className="mt-3">
            <label className={labelCls}>Promo hours <span className="text-gray-400 font-normal">(optional dayparts, e.g. lunch rush)</span></label>
            <div className="mt-1 rounded-xl border border-gray-200 dark:border-[#262626] divide-y divide-gray-100 dark:divide-[#262626] overflow-hidden">
              {form.time_windows.length === 0 && <p className="px-4 py-3 text-xs text-gray-400">Always active within the dates above. Add a schedule to limit promo hours.</p>}
              {form.time_windows.map((w, i) => (
                <div key={i} className="px-4 py-2.5 flex flex-col gap-2">
                  <div className="flex flex-wrap gap-1.5">
                    {DAY_OPTS.map((d) => (
                      <button key={d.value} type="button" onClick={() => toggleDay(i, d.value)} className={`px-2.5 py-1 rounded-full text-xs font-medium border ${w.days.includes(d.value) ? 'bg-[#eba236] text-white border-[#eba236]' : 'bg-white dark:bg-[#0a0a0a] text-gray-700 dark:text-[#a1a1aa] border-gray-200 dark:border-[#262626]'}`}>{d.label}</button>
                    ))}
                  </div>
                  <div className="flex items-center gap-2">
                    <input type="time" value={w.start_time} onChange={(e) => setWindow(i, { start_time: e.target.value })} className="px-2.5 py-1.5 rounded-lg border border-gray-200 dark:border-[#262626] bg-white dark:bg-[#0a0a0a] text-sm" />
                    <span className="text-gray-400">to</span>
                    <input type="time" value={w.end_time} onChange={(e) => setWindow(i, { end_time: e.target.value })} className="px-2.5 py-1.5 rounded-lg border border-gray-200 dark:border-[#262626] bg-white dark:bg-[#0a0a0a] text-sm" />
                    <button type="button" onClick={() => removeWindow(i)} className="text-xs text-red-600 hover:underline ml-auto">Remove</button>
                  </div>
                </div>
              ))}
            </div>
            <button type="button" onClick={addWindow} className="mt-2 text-xs font-medium text-[#b97810] hover:underline">Add promo hours</button>
          </div>
        </div>

        {/* 7. Usage limits */}
        <div>
          <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2"><Users className="w-4 h-4 text-blue-500" /> Usage Limits</h4>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div><label className={labelCls}>Total redemptions <span className="text-gray-400 font-normal">(0 = unlimited)</span></label><input type="number" min={0} value={form.usage_limit} onChange={(e) => set('usage_limit', e.target.value)} className={inputCls} /></div>
            <div><label className={labelCls}>Per customer <span className="text-gray-400 font-normal">(0 = unlimited)</span></label><input type="number" min={0} value={form.usage_limit_per_user} onChange={(e) => set('usage_limit_per_user', e.target.value)} className={inputCls} /></div>
            {isEdit && <div><label className={labelCls}>Used so far</label><input value={String(initial?.usage_count ?? 0)} disabled className={`${inputCls} opacity-50 cursor-not-allowed font-mono`} /></div>}
            <div className="sm:col-span-2"><label className={labelCls}>Allowed emails <span className="text-gray-400 font-normal">(comma separated, * wildcard)</span></label><input value={form.email_restrictions} onChange={(e) => set('email_restrictions', e.target.value)} placeholder="*@company.com, vip@example.com" className={inputCls} /></div>
            <div><label className={labelCls}>Allowed phones <span className="text-gray-400 font-normal">(comma separated)</span></label><input value={form.phone_restrictions} onChange={(e) => set('phone_restrictions', e.target.value)} placeholder="+63917*" className={inputCls} /></div>
          </div>
          <div className="mt-3">
            <label className={labelCls}>Payment methods <span className="text-gray-400 font-normal">(empty = all)</span></label>
            <div className="flex flex-wrap gap-1.5 mt-1">
              {PAYMENT_OPTS.map((o) => (
                <button key={o.value} type="button" onClick={() => toggleMethod(o.value)} className={`px-2.5 py-1 rounded-full text-xs font-medium border capitalize ${form.allowed_payment_methods.includes(o.value) ? 'bg-[#eba236] text-white border-[#eba236]' : 'bg-white dark:bg-[#0a0a0a] text-gray-700 dark:text-[#a1a1aa] border-gray-200 dark:border-[#262626]'}`}>{o.label}</button>
              ))}
            </div>
          </div>
        </div>

        {/* 8. Funding */}
        <div>
          <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2"><Truck className="w-4 h-4 text-[#eba236]" /> Who Pays <span className="text-xs font-normal text-gray-400">(settlement)</span></h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div><label className={labelCls}>Funded by *</label><select value={form.funded_by} onChange={(e) => set('funded_by', e.target.value)} className={inputCls}>{FUNDED_OPTS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</select></div>
            {form.funded_by === 'split' && <div><label className={labelCls}>Vendor share % (1–99)</label><input type="number" min={1} max={99} value={form.vendor_share_pct} onChange={(e) => set('vendor_share_pct', e.target.value)} className={inputCls} /></div>}
          </div>
          <p className="text-xs text-gray-400 mt-1.5 flex items-center gap-1"><CalendarDays className="w-3 h-3" /> Platform-funded discounts never reduce vendor payouts — only the vendor share is deducted at settlement.</p>
        </div>
      </div>
      <div className="flex items-center justify-end gap-2 border-t border-gray-200 dark:border-[#262626] bg-gray-50 dark:bg-[#0a0a0a] px-6 py-4 rounded-b-xl">
        <button type="button" onClick={onCancel} disabled={saving} className="rounded-lg border border-gray-300 dark:border-[#262626] bg-white dark:bg-[#171717] px-4 py-2 text-sm font-medium text-gray-700 dark:text-[#a1a1aa] hover:bg-gray-50 dark:hover:bg-[#262626] disabled:opacity-50">Cancel</button>
        <button type="button" onClick={submit} disabled={saving} className="inline-flex items-center gap-2 rounded-lg bg-[#eba236] hover:bg-[#c88a20] px-6 py-2 text-sm font-semibold text-white disabled:opacity-50">
          {saving && <RefreshCw className="h-4 w-4 animate-spin" />} {isEdit ? 'Save changes' : 'Create coupon'}
        </button>
      </div>
    </div>
  )
}
