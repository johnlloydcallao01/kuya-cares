'use client'

import React, { useEffect, useState } from 'react'
import { Building, Store, Package, DollarSign, AlertCircle, RefreshCw } from '@/components/ui/IconWrapper'

export function MerchantProductForm({ onSuccess, onCancel }: { onSuccess: () => void; onCancel: () => void }) {
  const [vendors, setVendors] = useState<{ id: number; businessName: string }[]>([])
  const [merchants, setMerchants] = useState<{ id: number; outletName: string; vendor: number }[]>([])
  const [products, setProducts] = useState<{ id: number; name: string; sku: string | null }[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState({ vendor: '', merchant: '', product: '', price_override: '', stock_quantity: '' })
  const set = (k: string, v: any) => setForm(p => ({ ...p, [k]: v }))

  useEffect(() => {
    fetch('/api/vendors?limit=100', { cache: 'no-store' }).then(r=>r.json()).then(j=> setVendors((j.docs||[]).map((d:any)=>({id:d.id,businessName:d.businessName})))).catch(()=>{})
    fetch('/api/products?limit=100', { cache: 'no-store' }).then(r=>r.json()).then(j=> setProducts((j.docs||[]).map((d:any)=>({id:d.id,name:d.name,sku:d.sku})))).catch(()=>{})
  }, [])
  useEffect(() => {
    if (!form.vendor) { setMerchants([]); return }
    fetch(`/api/merchants?limit=100&vendor=${form.vendor}`, { cache: 'no-store' }).then(r=>r.json()).then(j=>{
      const docs=j.docs||[]
      setMerchants(docs.map((d:any)=>({id:d.id,outletName:d.outletName, vendor: Number(d.vendor?.id || d.vendor)})))
    }).catch(()=> setMerchants([]))
    set('merchant','')
  }, [form.vendor])

  const submit = async () => {
    setError(null)
    if (!form.vendor) return setError('Vendor is required')
    if (!form.merchant) return setError('Merchant (outlet) is required')
    if (!form.product) return setError('Product is required')
    if (form.price_override && (Number.isNaN(Number(form.price_override)) || Number(form.price_override) < 0)) return setError('Price override must be >=0')
    if (form.stock_quantity && (Number.isNaN(Number(form.stock_quantity)) || Number(form.stock_quantity) < 0)) return setError('Stock must be >=0')
    setSaving(true)
    try {
      const payload: any = {
        merchant_id: Number(form.merchant),
        product_id: Number(form.product),
        price_override: form.price_override ? Number(form.price_override) : null,
        stock_quantity: form.stock_quantity ? Number(form.stock_quantity) : null,
      }
      const res = await fetch('/api/merchant-products', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
      const j = await res.json().catch(()=>({}))
      if (!res.ok) throw new Error(j.error || 'Failed to assign product')
      onSuccess()
    } catch (e:any) { setError(e.message||'Failed') } finally { setSaving(false) }
  }

  const inputCls = 'mt-1 w-full px-3 py-2.5 rounded-lg border border-gray-200 dark:border-[#262626] bg-white dark:bg-[#0a0a0a] text-sm'
  const labelCls = 'text-xs font-medium text-gray-700 dark:text-[#a1a1aa]'

  return (
    <div className="bg-white dark:bg-[#171717] rounded-xl border border-gray-200 dark:border-[#262626] shadow-sm overflow-hidden">
      <div className="p-6 space-y-6">
        {error && <div className="flex items-start gap-2 p-3 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-sm text-red-700 dark:text-red-300"><AlertCircle className="w-4 h-4 mt-0.5 shrink-0" /> {error}</div>}
        <div>
          <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2"><Building className="w-4 h-4 text-[#eba236]" /> Assign Product to Outlet</h4>
          <p className="text-xs text-gray-500 dark:text-[#a1a1aa] mb-3">Select vendor → outlet → product. This creates a <span className="font-mono">merchant_product</span> row (price/stock override per outlet).</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className={labelCls}>Vendor *</label>
              <select value={form.vendor} onChange={e=>set('vendor', e.target.value)} className={inputCls}>
                <option value="">Select vendor</option>
                {vendors.map(v=> <option key={v.id} value={String(v.id)}>{v.businessName} (#{v.id})</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>Outlet (Merchant) *</label>
              <select value={form.merchant} onChange={e=>set('merchant', e.target.value)} className={inputCls} disabled={!form.vendor}>
                <option value="">{form.vendor ? 'Select outlet' : 'Select vendor first'}</option>
                {merchants.map(m=> <option key={m.id} value={String(m.id)}>{m.outletName} (#{m.id})</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>Product *</label>
              <select value={form.product} onChange={e=>set('product', e.target.value)} className={inputCls}>
                <option value="">Select product</option>
                {products.map(p=> <option key={p.id} value={String(p.id)}>{p.name} {p.sku ? `(${p.sku})` : ''}</option>)}
              </select>
            </div>
            <div><label className={labelCls}>Price override</label><input type="number" min={0} step={0.01} value={form.price_override} onChange={e=>set('price_override', e.target.value)} placeholder="Leave blank for default" className={inputCls} /></div>
            <div><label className={labelCls}>Stock quantity</label><input type="number" min={0} value={form.stock_quantity} onChange={e=>set('stock_quantity', e.target.value)} placeholder="e.g. 100" className={inputCls} /></div>
          </div>
        </div>
      </div>
      <div className="flex items-center justify-end gap-2 border-t border-gray-200 dark:border-[#262626] bg-gray-50 dark:bg-[#0a0a0a] px-6 py-4">
        <button type="button" onClick={onCancel} disabled={saving} className="rounded-lg border border-gray-300 dark:border-[#262626] bg-white dark:bg-[#171717] px-4 py-2 text-sm font-medium text-gray-700 dark:text-[#a1a1aa] hover:bg-gray-50 dark:hover:bg-[#262626]">Cancel</button>
        <button type="button" onClick={submit} disabled={saving} className="inline-flex items-center gap-2 rounded-lg bg-[#eba236] hover:bg-[#c88a20] px-6 py-2 text-sm font-semibold text-white disabled:opacity-50">
          {saving && <RefreshCw className="h-4 w-4 animate-spin" />} Assign to outlet
        </button>
      </div>
    </div>
  )
}
