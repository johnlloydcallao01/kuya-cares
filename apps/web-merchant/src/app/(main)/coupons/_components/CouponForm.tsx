'use client'

import React, { useEffect, useMemo, useState } from 'react'
import { Ticket, DollarSign, Store, Tag, ShieldCheck, Clock, Users, Info } from '@/components/ui/IconWrapper'

export type CouponDoc = {
  id: number
  code: string
  description: string | null
  status: string
  discount_type: string
  amount: number
  max_discount_amount: number | null
  applies_to: string
  free_delivery: boolean
  delivery_discount_cap: number | null
  merchant_scope: string
  merchants: { id: number; outletName: string; outletCode: string }[] | number[]
  menu_items: unknown[]
  excluded_menu_items: unknown[]
  menu_categories: unknown[]
  excluded_menu_categories: unknown[]
  exclude_promo_items: boolean
  minimum_basket: number | null
  maximum_basket: number | null
  limit_per_order_items: number | null
  individual_use: boolean
  max_coupons_per_order: number
  starts_at: string | null
  expires_at: string | null
  usage_limit: number
  usage_limit_per_user: number
  usage_count: number
  email_restrictions: string[]
  phone_restrictions: string[]
  first_order_only: boolean
  allowed_payment_methods: string[]
  time_windows: { days: string[]; start_time: string; end_time: string }[]
  createdAt?: string
  updatedAt?: string
}

type Option = { id: number; label: string; sub?: string }

const inputCls = 'mt-1 w-full px-3 py-2.5 rounded-lg border border-gray-200 dark:border-[#262626] bg-white dark:bg-[#0a0a0a] text-sm text-gray-900 dark:text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#239459]/20 focus:border-[#239459]'
const labelCls = 'text-xs font-medium text-gray-700 dark:text-[#a1a1aa]'

const PAYMENT_OPTS = ['card', 'gcash', 'grab_pay', 'paymaya', 'billease', 'dob', 'brankas', 'qrph']
const DAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']

function toLocalInput(iso: string | null): string {
  if (!iso) return ''
  try {
    const d = new Date(iso)
    const pad = (n: number) => String(n).padStart(2, '0')
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
  } catch {
    return ''
  }
}
function relIds(v: unknown): number[] {
  if (!Array.isArray(v)) return []
  return v.map((x) => (typeof x === 'object' && x !== null ? Number((x as any).id) : Number(x))).filter((n) => Number.isFinite(n))
}

function MultiPick({ label, hint, options, value, onChange, loading }: { label: string; hint?: string; options: Option[]; value: number[]; onChange: (v: number[]) => void; loading?: boolean }) {
  const [q, setQ] = useState('')
  const shown = useMemo(() => {
    const s = q.trim().toLowerCase()
    if (!s) return options
    return options.filter((o) => `${o.label} ${o.sub || ''}`.toLowerCase().includes(s))
  }, [options, q])
  return (
    <div>
      <p className={labelCls}>{label} <span className="text-[#239459] font-semibold">({value.length} selected)</span></p>
      {hint && <p className="text-xs text-gray-400 mt-0.5">{hint}</p>}
      <div className="mt-1 rounded-lg border border-gray-200 dark:border-[#262626] bg-white dark:bg-[#0a0a0a] overflow-hidden">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search…" className="w-full px-3 py-2 text-sm bg-transparent border-b border-gray-100 dark:border-[#262626] focus:outline-none text-gray-900 dark:text-white placeholder:text-gray-400" />
        <div className="max-h-44 overflow-y-auto p-2 space-y-1">
          {loading && <p className="text-xs text-gray-400 px-2 py-1">Loading…</p>}
          {!loading && shown.length === 0 && <p className="text-xs text-gray-400 px-2 py-1">No matches.</p>}
          {shown.map((o) => {
            const checked = value.includes(o.id)
            return (
              <label key={o.id} className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-gray-50 dark:hover:bg-[#262626] cursor-pointer">
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => onChange(checked ? value.filter((v) => v !== o.id) : [...value, o.id])}
                  className="h-4 w-4 rounded border-gray-300 text-[#239459]"
                />
                <span className="text-sm text-gray-700 dark:text-white truncate">{o.label}</span>
                {o.sub && <span className="text-[11px] text-gray-400 truncate ml-auto">{o.sub}</span>}
              </label>
            )
          })}
        </div>
      </div>
    </div>
  )
}

export function CouponForm({ initial, onSuccess, onCancel }: { initial?: CouponDoc | null; onSuccess: () => void; onCancel: () => void }) {
  const isEdit = !!initial
  const [brandName, setBrandName] = useState('')
  const [branches, setBranches] = useState<Option[]>([])
  const [branchesLoading, setBranchesLoading] = useState(true)
  const [products, setProducts] = useState<Option[]>([])
  const [productsLoading, setProductsLoading] = useState(true)
  const [categories, setCategories] = useState<Option[]>([])
  const [categoriesLoading, setCategoriesLoading] = useState(true)

  const [form, setForm] = useState({
    code: initial?.code || '',
    status: initial?.status || 'draft',
    description: initial?.description || '',
    discount_type: initial?.discount_type || 'fixed_cart',
    amount: initial != null ? String(initial.amount) : '',
    max_discount_amount: initial?.max_discount_amount != null ? String(initial.max_discount_amount) : '',
    applies_to: initial?.applies_to || 'food_subtotal',
    free_delivery: !!initial?.free_delivery,
    delivery_discount_cap: initial?.delivery_discount_cap != null ? String(initial.delivery_discount_cap) : '',
    merchant_scope: initial?.merchant_scope || 'all_vendor_branches',
    merchants: relIds(initial?.merchants),
    menu_items: relIds(initial?.menu_items),
    excluded_menu_items: relIds(initial?.excluded_menu_items),
    menu_categories: relIds(initial?.menu_categories),
    excluded_menu_categories: relIds(initial?.excluded_menu_categories),
    exclude_promo_items: !!initial?.exclude_promo_items,
    minimum_basket: initial?.minimum_basket != null ? String(initial.minimum_basket) : '',
    maximum_basket: initial?.maximum_basket != null ? String(initial.maximum_basket) : '',
    limit_per_order_items: initial?.limit_per_order_items != null ? String(initial.limit_per_order_items) : '',
    individual_use: initial ? !!initial.individual_use : true,
    max_coupons_per_order: initial != null ? String(initial.max_coupons_per_order ?? 1) : '1',
    starts_at: toLocalInput(initial?.starts_at ?? null),
    expires_at: toLocalInput(initial?.expires_at ?? null),
    usage_limit: initial != null ? String(initial.usage_limit ?? 0) : '0',
    usage_limit_per_user: initial != null ? String(initial.usage_limit_per_user ?? 0) : '0',
    email_restrictions: (initial?.email_restrictions || []).join(', '),
    phone_restrictions: (initial?.phone_restrictions || []).join(', '),
    first_order_only: !!initial?.first_order_only,
    allowed_payment_methods: initial?.allowed_payment_methods || [],
  })
  const [windows, setWindows] = useState<{ days: string[]; start_time: string; end_time: string }[]>(
    Array.isArray(initial?.time_windows) && initial.time_windows.length ? (initial.time_windows as any) : [],
  )
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  // Branch + menu lookups (vendor-scoped proxies).
  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch('/api/outlets', { cache: 'no-store' })
        const j = await res.json()
        const arr = Array.isArray(j.outlets) ? j.outlets : []
        setBranches(arr.map((o: any) => ({ id: Number(o.id), label: o.outletName || `Outlet #${o.id}`, sub: o.outletCode || '' })).filter((o: Option) => Number.isFinite(o.id)))
      } catch { /* keep empty */ } finally { setBranchesLoading(false) }
    })()
    void (async () => {
      try {
        const res = await fetch('/api/products?limit=200', { cache: 'no-store' })
        const j = await res.json()
        const rows = Array.isArray(j.products) ? j.products : []
        const seen = new Map<number, Option>()
        for (const r of rows) {
          const p = r.product || r
          const id = Number(p?.id)
          if (!Number.isFinite(id) || seen.has(id)) continue
          seen.set(id, { id, label: p?.name || `Product #${id}`, sub: p?.sku || p?.slug || '' })
        }
        setProducts(Array.from(seen.values()))
      } catch { /* keep empty */ } finally { setProductsLoading(false) }
    })()
    void (async () => {
      try {
        const res = await fetch('/api/product-categories?limit=200', { cache: 'no-store' })
        const j = await res.json()
        const arr = Array.isArray(j.docs) ? j.docs : []
        setCategories(arr.map((c: any) => ({ id: Number(c.id), label: c.name || `Category #${c.id}`, sub: c.slug || '' })).filter((o: Option) => Number.isFinite(o.id)))
        if (Array.isArray(j.docs) && j.docs.length === 0 && j.brandName) setBrandName(String(j.brandName))
      } catch { /* keep empty */ } finally { setCategoriesLoading(false) }
    })()
  }, [])

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch('/api/coupons?limit=1', { cache: 'no-store' })
        const j = await res.json()
        if (j?.vendor?.businessName) setBrandName(String(j.vendor.businessName))
      } catch { /* ignore */ }
    })()
  }, [])

  const set = (k: string, v: any) => setForm((prev) => ({ ...prev, [k]: v }))
  const togglePayment = (v: string) =>
    setForm((prev) => ({ ...prev, allowed_payment_methods: prev.allowed_payment_methods.includes(v) ? prev.allowed_payment_methods.filter((x) => x !== v) : [...prev.allowed_payment_methods, v] }))

  const submit = async () => {
    setError(null)
    const code = form.code.trim().toUpperCase()
    if (!/^[A-Z0-9][A-Z0-9\-_&$@]*$/.test(code) || code.length < 3 || code.length > 32) {
      return setError('Code must be 3–32 chars: letters, numbers, and - _ & $ @')
    }
    const amount = Number(form.amount)
    if (!Number.isFinite(amount) || amount <= 0) return setError('Amount must be greater than 0')
    if (form.discount_type === 'percent' && amount > 100) return setError('Percentage coupons cannot exceed 100')
    if (form.merchant_scope === 'selected_branches' && form.merchants.length === 0) {
      return setError('Select at least one branch')
    }
    if (form.starts_at && form.expires_at && new Date(form.starts_at).getTime() >= new Date(form.expires_at).getTime()) {
      return setError('Starts_at must be before expires_at')
    }
    const numOrNull = (v: string) => (v.trim() === '' ? null : Number(v))
    const payload: Record<string, any> = {
      code,
      description: form.description.trim() || null,
      status: form.status,
      amount,
      max_discount_amount: numOrNull(form.max_discount_amount),
      applies_to: form.applies_to,
      free_delivery: form.free_delivery,
      delivery_discount_cap: numOrNull(form.delivery_discount_cap),
      merchant_scope: form.merchant_scope,
      merchants: form.merchant_scope === 'selected_branches' ? form.merchants : [],
      menu_items: form.menu_items,
      excluded_menu_items: form.excluded_menu_items,
      menu_categories: form.menu_categories,
      excluded_menu_categories: form.excluded_menu_categories,
      exclude_promo_items: form.exclude_promo_items,
      minimum_basket: numOrNull(form.minimum_basket),
      maximum_basket: numOrNull(form.maximum_basket),
      limit_per_order_items: numOrNull(form.limit_per_order_items),
      individual_use: form.individual_use,
      max_coupons_per_order: Math.max(1, Number(form.max_coupons_per_order) || 1),
      starts_at: form.starts_at ? new Date(form.starts_at).toISOString() : null,
      expires_at: form.expires_at ? new Date(form.expires_at).toISOString() : null,
      usage_limit: Math.max(0, Number(form.usage_limit) || 0),
      usage_limit_per_user: Math.max(0, Number(form.usage_limit_per_user) || 0),
      email_restrictions: form.email_restrictions.split(',').map((s) => s.trim().toLowerCase()).filter(Boolean),
      phone_restrictions: form.phone_restrictions.split(',').map((s) => s.trim().toLowerCase()).filter(Boolean),
      first_order_only: form.first_order_only,
      allowed_payment_methods: form.allowed_payment_methods,
      time_windows: windows.filter((w) => w.days.length > 0 && w.start_time && w.end_time),
    }
    if (!isEdit) payload.discount_type = form.discount_type

    setSaving(true)
    try {
      const url = isEdit && initial ? `/api/coupons/${initial.id}` : '/api/coupons'
      const res = await fetch(url, {
        method: isEdit ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const j = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(j.error || 'Failed to save coupon')
      onSuccess()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to save coupon')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="bg-white dark:bg-[#171717] rounded-xl border border-gray-200 dark:border-[#262626] shadow-sm overflow-hidden">
      <div className="p-6 space-y-6">
        {error && <p className="text-sm text-red-600 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg px-3 py-2">{error}</p>}

        <div>
          <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2"><Ticket className="w-4 h-4 text-[#239459]" /> Basics {brandName && <span className="text-xs font-normal text-gray-400">· {brandName}</span>}</h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Code</label>
              <input value={form.code} onChange={(e) => set('code', e.target.value.toUpperCase())} placeholder="SAVE10" disabled={isEdit} className={`${inputCls} font-mono ${isEdit ? 'opacity-50 cursor-not-allowed' : ''}`} maxLength={32} />
            </div>
            <div>
              <label className={labelCls}>Status</label>
              <select value={form.status} onChange={(e) => set('status', e.target.value)} className={inputCls}>
                <option value="draft">Draft</option>
                <option value="scheduled">Scheduled</option>
                <option value="published">Published</option>
                <option value="paused">Paused</option>
                <option value="archived">Archived</option>
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className={labelCls}>Internal notes (never shown to customers)</label>
              <textarea value={form.description} onChange={(e) => set('description', e.target.value)} rows={2} className={inputCls} placeholder="Why does this promo exist?" />
            </div>
          </div>
          {isEdit && <p className="text-xs text-gray-400 mt-2">Code and discount type are locked after creation — archive and create a new coupon to change them.</p>}
        </div>

        <div>
          <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2"><DollarSign className="w-4 h-4 text-emerald-600" /> Discount</h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Discount type</label>
              <select value={form.discount_type} onChange={(e) => set('discount_type', e.target.value)} disabled={isEdit} className={`${inputCls} ${isEdit ? 'opacity-50 cursor-not-allowed' : ''}`}>
                <option value="percent">Percentage off</option>
                <option value="fixed_cart">Fixed amount off basket</option>
                <option value="fixed_product">Fixed amount off each item</option>
              </select>
            </div>
            <div>
              <label className={labelCls}>Amount {form.discount_type === 'percent' ? '(0–100)' : '(₱)'}</label>
              <input type="number" min={0} step="any" value={form.amount} onChange={(e) => set('amount', e.target.value)} className={inputCls} placeholder={form.discount_type === 'percent' ? '10' : '50'} />
            </div>
            <div>
              <label className={labelCls}>Max discount cap (₱, percent only)</label>
              <input type="number" min={0} step="any" value={form.max_discount_amount} onChange={(e) => set('max_discount_amount', e.target.value)} className={inputCls} placeholder="100" />
            </div>
            <div>
              <label className={labelCls}>Applies to</label>
              <select value={form.applies_to} onChange={(e) => set('applies_to', e.target.value)} className={inputCls}>
                <option value="food_subtotal">Food subtotal</option>
                <option value="delivery_fee">Delivery fee</option>
                <option value="both">Both</option>
              </select>
            </div>
            <label className="flex items-center gap-2 cursor-pointer sm:col-span-2">
              <input type="checkbox" checked={form.free_delivery} onChange={(e) => set('free_delivery', e.target.checked)} className="h-4 w-4 rounded border-gray-300 text-[#239459]" />
              <span className="text-sm font-medium text-gray-700 dark:text-white">Free delivery</span>
            </label>
            {form.free_delivery && (
              <div className="sm:col-span-2">
                <label className={labelCls}>Delivery discount cap (₱)</label>
                <input type="number" min={0} step="any" value={form.delivery_discount_cap} onChange={(e) => set('delivery_discount_cap', e.target.value)} className={inputCls} placeholder="80" />
              </div>
            )}
          </div>
        </div>

        <div>
          <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2"><Store className="w-4 h-4 text-[#239459]" /> Branches</h4>
          <div className="flex gap-2 mb-3">
            {[{ v: 'all_vendor_branches', l: 'All my branches' }, { v: 'selected_branches', l: 'Selected branches' }].map((o) => (
              <button
                key={o.v}
                type="button"
                onClick={() => set('merchant_scope', o.v)}
                className={`px-3 py-2 rounded-lg border text-sm font-medium transition ${form.merchant_scope === o.v ? 'border-[#239459] bg-[#239459]/10 text-[#239459]' : 'border-gray-200 dark:border-[#262626] bg-white dark:bg-[#0a0a0a] text-gray-700 dark:text-[#a1a1aa]'}`}
              >
                {o.l}
              </button>
            ))}
          </div>
          {form.merchant_scope === 'selected_branches' && (
            <MultiPick
              label="Branches"
              hint="Coupon only works at checked outlets."
              options={branches}
              value={form.merchants}
              onChange={(v) => set('merchants', v)}
              loading={branchesLoading}
            />
          )}
        </div>

        <div>
          <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2"><Tag className="w-4 h-4 text-blue-600" /> Menu scoping <span className="text-xs font-normal text-gray-400">(optional — empty means whole menu)</span></h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <MultiPick label="Only these items" options={products} value={form.menu_items} onChange={(v) => set('menu_items', v)} loading={productsLoading} />
            <MultiPick label="Exclude these items" options={products} value={form.excluded_menu_items} onChange={(v) => set('excluded_menu_items', v)} loading={productsLoading} />
            <MultiPick label="Only these categories" options={categories} value={form.menu_categories} onChange={(v) => set('menu_categories', v)} loading={categoriesLoading} />
            <MultiPick label="Exclude these categories" options={categories} value={form.excluded_menu_categories} onChange={(v) => set('excluded_menu_categories', v)} loading={categoriesLoading} />
          </div>
          <label className="flex items-center gap-2 cursor-pointer mt-3">
            <input type="checkbox" checked={form.exclude_promo_items} onChange={(e) => set('exclude_promo_items', e.target.checked)} className="h-4 w-4 rounded border-gray-300 text-[#239459]" />
            <span className="text-sm font-medium text-gray-700 dark:text-white">Skip items already on promo</span>
          </label>
        </div>

        <div>
          <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2"><ShieldCheck className="w-4 h-4 text-amber-600" /> Basket rules</h4>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className={labelCls}>Min basket (₱)</label>
              <input type="number" min={0} step="any" value={form.minimum_basket} onChange={(e) => set('minimum_basket', e.target.value)} className={inputCls} placeholder="0" />
            </div>
            <div>
              <label className={labelCls}>Max basket (₱)</label>
              <input type="number" min={0} step="any" value={form.maximum_basket} onChange={(e) => set('maximum_basket', e.target.value)} className={inputCls} placeholder="No cap" />
            </div>
            <div>
              <label className={labelCls}>Max coupons / order</label>
              <input type="number" min={1} value={form.max_coupons_per_order} onChange={(e) => set('max_coupons_per_order', e.target.value)} className={inputCls} />
            </div>
          </div>
          <div className="flex flex-wrap gap-4 mt-3">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={form.individual_use} onChange={(e) => set('individual_use', e.target.checked)} className="h-4 w-4 rounded border-gray-300 text-[#239459]" />
              <span className="text-sm font-medium text-gray-700 dark:text-white">One coupon per order</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={form.first_order_only} onChange={(e) => set('first_order_only', e.target.checked)} className="h-4 w-4 rounded border-gray-300 text-[#239459]" />
              <span className="text-sm font-medium text-gray-700 dark:text-white">First orders only</span>
            </label>
          </div>
        </div>

        <div>
          <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2"><Clock className="w-4 h-4 text-[#239459]" /> Schedule & limits</h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Starts at</label>
              <input type="datetime-local" value={form.starts_at} onChange={(e) => set('starts_at', e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Expires at</label>
              <input type="datetime-local" value={form.expires_at} onChange={(e) => set('expires_at', e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Total usage cap (0 = unlimited)</label>
              <input type="number" min={0} value={form.usage_limit} onChange={(e) => set('usage_limit', e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Per-customer cap (0 = unlimited)</label>
              <input type="number" min={0} value={form.usage_limit_per_user} onChange={(e) => set('usage_limit_per_user', e.target.value)} className={inputCls} />
            </div>
          </div>
          <div className="mt-3">
            <div className="flex items-center justify-between mb-2">
              <p className={labelCls}>Promo hours (optional)</p>
              <button type="button" onClick={() => setWindows((w) => [...w, { days: [], start_time: '11:00', end_time: '14:00' }])} className="text-xs font-semibold text-[#239459]">+ Add window</button>
            </div>
            {windows.map((w, i) => (
              <div key={i} className="flex flex-wrap items-center gap-2 mb-2 rounded-lg border border-gray-200 dark:border-[#262626] p-2">
                <div className="flex flex-wrap gap-1">
                  {DAYS.map((d) => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => setWindows((prev) => prev.map((x, xi) => (xi === i ? { ...x, days: x.days.includes(d) ? x.days.filter((y) => y !== d) : [...x.days, d] } : x)))}
                      className={`px-2 py-1 rounded-full text-[11px] font-semibold border capitalize ${w.days.includes(d) ? 'bg-[#239459] text-white border-[#239459]' : 'bg-white dark:bg-[#0a0a0a] text-gray-500 dark:text-[#a1a1aa] border-gray-200 dark:border-[#262626]'}`}
                    >
                      {d.slice(0, 3)}
                    </button>
                  ))}
                </div>
                <input type="time" value={w.start_time} onChange={(e) => setWindows((prev) => prev.map((x, xi) => (xi === i ? { ...x, start_time: e.target.value } : x)))} className="px-2 py-1 rounded-lg border border-gray-200 dark:border-[#262626] bg-white dark:bg-[#0a0a0a] text-xs text-gray-900 dark:text-white" />
                <span className="text-xs text-gray-400">–</span>
                <input type="time" value={w.end_time} onChange={(e) => setWindows((prev) => prev.map((x, xi) => (xi === i ? { ...x, end_time: e.target.value } : x)))} className="px-2 py-1 rounded-lg border border-gray-200 dark:border-[#262626] bg-white dark:bg-[#0a0a0a] text-xs text-gray-900 dark:text-white" />
                <button type="button" onClick={() => setWindows((prev) => prev.filter((_, xi) => xi !== i))} className="text-xs font-semibold text-red-500 ml-auto">Remove</button>
              </div>
            ))}
          </div>
        </div>

        <div>
          <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2"><Users className="w-4 h-4 text-blue-500" /> Restrictions</h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Allowed emails (comma separated, * wildcards)</label>
              <input value={form.email_restrictions} onChange={(e) => set('email_restrictions', e.target.value)} className={inputCls} placeholder="*@gmail.com" />
            </div>
            <div>
              <label className={labelCls}>Allowed phones (comma separated)</label>
              <input value={form.phone_restrictions} onChange={(e) => set('phone_restrictions', e.target.value)} className={inputCls} placeholder="+639…" />
            </div>
          </div>
          <p className={`${labelCls} mt-3 mb-2`}>Allowed payment methods (empty = all)</p>
          <div className="flex flex-wrap gap-1.5">
            {PAYMENT_OPTS.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => togglePayment(p)}
                className={`px-2.5 py-1 rounded-full text-xs font-medium border capitalize ${form.allowed_payment_methods.includes(p) ? 'bg-[#239459] text-white border-[#239459]' : 'bg-white dark:bg-[#0a0a0a] text-gray-700 dark:text-[#a1a1aa] border-gray-200 dark:border-[#262626]'}`}
              >
                {p.replace('_', ' ')}
              </button>
            ))}
          </div>
        </div>

        <div className="rounded-lg border border-gray-200 dark:border-[#262626] bg-gray-50 dark:bg-[#0a0a0a] p-3 flex items-start gap-2">
          <Info className="w-4 h-4 text-[#239459] shrink-0 mt-0.5" />
          <p className="text-xs text-gray-500 dark:text-[#a1a1aa]">Merchant coupons are always platform-funded — discounts never reduce your payouts. Settlement splits are managed by the platform.</p>
        </div>
      </div>

      <div className="flex justify-end gap-2 border-t border-gray-200 dark:border-[#262626] bg-gray-50 dark:bg-[#0a0a0a] px-6 py-4 rounded-b-xl">
        <button onClick={onCancel} disabled={saving} className="px-4 py-2.5 rounded-xl border border-gray-200 dark:border-[#262626] text-sm font-medium bg-white dark:bg-[#171717] hover:bg-gray-50 dark:hover:bg-[#262626] disabled:opacity-50">Cancel</button>
        <button onClick={() => void submit()} disabled={saving} className="px-6 py-2.5 rounded-xl bg-[#239459] hover:bg-[#215035] text-white text-sm font-semibold disabled:opacity-50">
          {saving ? 'Saving…' : isEdit ? 'Save changes' : 'Create coupon'}
        </button>
      </div>
    </div>
  )
}
