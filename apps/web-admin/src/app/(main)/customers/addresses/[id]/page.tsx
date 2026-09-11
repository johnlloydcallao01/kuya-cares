'use client'

import React, { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { createPortal } from 'react-dom'
import { ClientOnly } from '@/components/ClientOnly'
import {
  MapPin, ArrowLeft, Plus, Pencil, Trash2, Eye, RefreshCw, AlertCircle, X,
  Mail, Phone, CalendarDays, CheckCircle, ShieldCheck, LocateFixed, Users, ShoppingBag,
} from '@/components/ui/IconWrapper'

// ─── Dedicated view: /customers/addresses/[customerId] ───
// Vendors-detail pattern: Back → header → KPIs → 2-col sections → timeline.
// BFF only: GET /api/customers/[id], GET /api/customers/addresses?customerId=, PATCH /api/customers/[id].

type ActiveBrief = {
  id: number
  formatted_address: string
  locality: string | null
  administrative_area_level_1: string | null
  postal_code: string | null
  address_type: string | null
  is_default: boolean
  is_verified: boolean
  latitude: number | null
  longitude: number | null
} | null

type CustomerDoc = {
  id: number
  email: string
  srn: string | null
  couponCode: string | null
  enrollmentDate: string | null
  currentLevel: string
  activeAddress: any
  user: any
  isActive: boolean
  orderCount: number
  addressCount: number
  recentOrders?: any[]
  createdAt: string
  updatedAt: string
}

type AddressDoc = {
  id: number
  formatted_address: string
  shortAddress: string
  barangay: string | null
  locality: string | null
  administrative_area_level_1: string | null
  postal_code: string | null
  latitude: number | null
  longitude: number | null
  geocoding_accuracy: string | null
  verification_method: string | null
  address_type: string
  label: string | null
  is_default: boolean
  is_verified: boolean
  customer: { id: number; srn: string | null; email: string | null; activeAddressId: number | null } | null
  customerActiveAddressId: number | null
  customerActiveAddress: ActiveBrief
  isActiveAddress: boolean
  createdAt: string
  updatedAt: string
}

function fmtDate(iso: string | null) { if (!iso) return '—'; try { return new Date(iso).toLocaleDateString('en-PH', { timeZone: 'Asia/Manila', year: 'numeric', month: 'short', day: 'numeric' }) } catch { return String(iso).slice(0, 10) } }
function initials(first: string, last: string) { const a = (first?.[0] || '').toUpperCase(); const b = (last?.[0] || '').toUpperCase(); return `${a}${b}`.trim() || 'C' }
function addressTypeBadge(t: string) {
  const s = (t || 'home').toLowerCase()
  if (s === 'home') return 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-300 dark:border-emerald-800'
  if (s === 'work') return 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/20 dark:text-blue-300 dark:border-blue-800'
  return 'bg-gray-100 text-gray-700 border-gray-200 dark:bg-zinc-800 dark:text-zinc-300 dark:border-zinc-700'
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return <div><h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">{title}</h4><div className="rounded-xl border border-gray-200 dark:border-[#262626] divide-y divide-gray-100 dark:divide-[#262626] overflow-hidden bg-white dark:bg-[#171717]">{children}</div></div>
}
function Row({ label, value, mono, icon }: { label: string; value: React.ReactNode; mono?: boolean; icon?: React.ReactNode }) {
  return <div className="flex items-start justify-between gap-4 px-4 py-2.5 text-sm"><span className="text-gray-500 dark:text-[#a1a1aa] text-xs font-medium shrink-0 flex items-center gap-1">{icon}{label}</span><span className={`text-gray-900 dark:text-white text-right max-w-[60%] break-words ${mono ? 'font-mono text-xs' : 'text-sm'}`}>{value as any}</span></div>
}

function AddressBookSkeleton() {
  return <div className="space-y-6 py-5 px-2.5"><div className="h-8 w-32 bg-gray-200 dark:bg-[#262626] rounded animate-pulse" /><div className="h-64 bg-gray-100 dark:bg-[#171717] rounded-xl animate-pulse" /></div>
}

function AddressFormModal({
  open, initial, presetUserId, presetUserLabel, onClose, onSuccess,
}: { open: boolean; initial: AddressDoc | null; presetUserId?: number | null; presetUserLabel?: string | null; onClose: () => void; onSuccess: () => void }) {
  const isEdit = !!initial
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState({ formatted_address: '', address_type: 'home', locality: '', postal_code: '', barangay: '', label: '', latitude: '', longitude: '' })

  useEffect(() => {
    if (!open) return
    setForm({
      formatted_address: initial?.formatted_address || '',
      address_type: initial?.address_type || 'home',
      locality: (initial as any)?.locality || '',
      postal_code: (initial as any)?.postal_code || '',
      barangay: (initial as any)?.barangay || '',
      label: (initial as any)?.label || '',
      latitude: (initial as any)?.latitude != null ? String((initial as any).latitude) : '',
      longitude: (initial as any)?.longitude != null ? String((initial as any).longitude) : '',
    })
    setError(null)
  }, [initial, open])

  if (!open || typeof document === 'undefined') return null
  const set = (k: string, v: any) => setForm((p) => ({ ...p, [k]: v }))
  const inputCls = 'mt-1 w-full px-3 py-2.5 rounded-lg border border-gray-200 dark:border-[#262626] bg-white dark:bg-[#0a0a0a] text-sm text-gray-900 dark:text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#eba236]/20 focus:border-[#eba236]'
  const labelCls = 'text-xs font-medium text-gray-700 dark:text-[#a1a1aa]'

  const submit = async () => {
    setError(null)
    if (!form.formatted_address.trim() || form.formatted_address.trim().length < 5) return setError('Formatted address is required (min 5 chars)')
    if (!isEdit && (presetUserId == null)) return setError('Owner customer is required')
    setSaving(true)
    try {
      const payload: any = {
        formatted_address: form.formatted_address.trim(),
        address_type: form.address_type,
        locality: form.locality.trim() || null,
        postal_code: form.postal_code.trim() || null,
        barangay: form.barangay.trim() || null,
        label: form.label.trim() || null,
        latitude: form.latitude.trim() ? Number(form.latitude.trim()) : null,
        longitude: form.longitude.trim() ? Number(form.longitude.trim()) : null,
      }
      if (!isEdit) payload.user = presetUserId
      const url = isEdit ? `/api/customers/addresses/${(initial as AddressDoc).id}` : '/api/customers/addresses'
      const res = await fetch(url, { method: isEdit ? 'PATCH' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
      const j = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(j.error || 'Request failed')
      onSuccess()
      onClose()
    } catch (e: any) { setError(e?.message || 'Save failed') }
    finally { setSaving(false) }
  }

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div className="relative bg-white dark:bg-[#171717] rounded-2xl shadow-2xl border border-gray-200 dark:border-[#262626] w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95" onClick={(e) => e.stopPropagation()}>
        <div className="px-6 pt-6 pb-4 border-b border-gray-100 dark:border-[#262626] shrink-0">
          <div className="flex items-start justify-between gap-4">
            <div className="flex gap-3 min-w-0">
              <div className="h-10 w-10 rounded-xl bg-[#eba236] text-white flex items-center justify-center shrink-0"><MapPin className="w-5 h-5" /></div>
              <div className="min-w-0">
                <h3 className="font-bold text-gray-900 dark:text-white leading-tight">{isEdit ? `Edit Address #${initial?.id}` : 'New Saved Address'}</h3>
                <p className="text-xs text-gray-500 dark:text-[#a1a1aa] mt-1">{isEdit ? 'Update saved address.' : `Save a new address${presetUserLabel ? ` for ${presetUserLabel}` : ''}.`}</p>
              </div>
            </div>
            <button onClick={onClose} className="h-8 w-8 inline-flex items-center justify-center rounded-lg hover:bg-gray-100 dark:hover:bg-[#262626] text-gray-500 dark:text-[#a1a1aa] shrink-0"><X className="w-4 h-4" /></button>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4 min-h-0">
          {error && <div className="flex items-start gap-2 p-3 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-sm text-red-700 dark:text-red-300"><AlertCircle className="w-4 h-4 mt-0.5 shrink-0" /> {error}</div>}
          <div><label className={labelCls}>Formatted address *</label><textarea value={form.formatted_address} onChange={(e) => set('formatted_address', e.target.value)} rows={3} placeholder="Complete Google-formatted address" className={inputCls} /></div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div><label className={labelCls}>Type</label><select value={form.address_type} onChange={(e) => set('address_type', e.target.value)} className={inputCls}><option value="home">Home</option><option value="work">Work</option><option value="partner">Partner</option><option value="billing">Billing</option><option value="shipping">Shipping</option><option value="pickup">Pickup</option><option value="delivery">Delivery</option></select></div>
            <div><label className={labelCls}>Locality</label><input value={form.locality} onChange={(e) => set('locality', e.target.value)} placeholder="City / municipality" className={inputCls} /></div>
            <div><label className={labelCls}>Postal</label><input value={form.postal_code} onChange={(e) => set('postal_code', e.target.value)} placeholder="e.g. 1000" className={inputCls} /></div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div><label className={labelCls}>Barangay</label><input value={form.barangay} onChange={(e) => set('barangay', e.target.value)} className={inputCls} /></div>
            <div><label className={labelCls}>Label</label><input value={form.label} onChange={(e) => set('label', e.target.value)} placeholder="Home / Work" className={inputCls} /></div>
            <div className="grid grid-cols-2 gap-2">
              <div><label className={labelCls}>Lat</label><input value={form.latitude} onChange={(e) => set('latitude', e.target.value)} placeholder="14.59" className={inputCls} /></div>
              <div><label className={labelCls}>Lng</label><input value={form.longitude} onChange={(e) => set('longitude', e.target.value)} placeholder="120.98" className={inputCls} /></div>
            </div>
          </div>
        </div>
        <div className="flex items-center justify-end gap-2 border-t border-gray-200 dark:border-[#262626] bg-gray-50 dark:bg-[#0a0a0a] px-6 py-4 rounded-b-2xl shrink-0">
          <button type="button" onClick={onClose} disabled={saving} className="rounded-lg border border-gray-300 dark:border-[#262626] bg-white dark:bg-[#171717] px-4 py-2 text-sm font-medium text-gray-700 dark:text-[#a1a1aa] hover:bg-gray-50 dark:hover:bg-[#262626] disabled:opacity-50">Cancel</button>
          <button type="button" onClick={submit} disabled={saving} className="inline-flex items-center gap-2 rounded-lg bg-[#eba236] hover:bg-[#c88a20] px-6 py-2 text-sm font-semibold text-white disabled:opacity-50">
            {saving && <RefreshCw className="h-4 w-4 animate-spin" />} {isEdit ? 'Save changes' : 'Create address'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}

function AddressBookViewContent() {
  const params = useParams()
  const router = useRouter()
  const id = params.id as string

  const [doc, setDoc] = useState<CustomerDoc | null>(null)
  const [addresses, setAddresses] = useState<AddressDoc[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<AddressDoc | null>(null)
  const [deleting, setDeleting] = useState<AddressDoc | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [settingActiveId, setSettingActiveId] = useState<number | null>(null)
  const [viewing, setViewing] = useState<AddressDoc | null>(null)

  const load = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const [cRes, aRes] = await Promise.all([
        fetch(`/api/customers/${id}`, { cache: 'no-store' }),
        fetch(`/api/customers/addresses?customerId=${encodeURIComponent(id)}&limit=100&sort=-createdAt&_t=${Date.now()}`, { cache: 'no-store' }),
      ])
      const cj = await cRes.json().catch(() => ({}))
      if (!cRes.ok) throw new Error((cj as any)?.error || 'Failed to load customer')
      const aj = await aRes.json().catch(() => ({}))
      if (!aRes.ok) throw new Error((aj as any)?.error || 'Failed to load addresses')
      setDoc((cj as any).doc)
      setAddresses((aj as any).docs || [])
    } catch (e: any) { setError(e?.message || 'Failed to load') }
    finally { setLoading(false) }
  }, [id])

  useEffect(() => { void load() }, [load])
  useEffect(() => {
    const open = !!deleting || !!viewing || showForm
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [deleting, viewing, showForm])
  useEffect(() => {
    if (!actionError) return
    const t = setTimeout(() => setActionError(null), 5000)
    return () => clearTimeout(t)
  }, [actionError])

  const activeAddr = useMemo(() => addresses.find((a) => a.isActiveAddress) ?? null, [addresses])
  const savedAddrs = useMemo(() => addresses.filter((a) => !a.isActiveAddress), [addresses])
  const ownerUserId = (doc?.user as any)?.id ?? null
  const ownerLabel = doc?.user ? `${doc.user.firstName} ${doc.user.lastName} (${doc.email})` : doc?.email || null

  const handleSetActive = async (addr: AddressDoc) => {
    if (addr.isActiveAddress) return
    setSettingActiveId(addr.id); setActionError(null)
    try {
      const res = await fetch(`/api/customers/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ activeAddress: addr.id }) })
      const j = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error((j as any)?.error || 'Failed to set active')
      await load()
    } catch (e: any) { setActionError(e?.message || 'Failed to set active') }
    finally { setSettingActiveId(null) }
  }

  const handleDelete = async () => {
    if (!deleting || isDeleting) return
    setIsDeleting(true)
    try {
      const res = await fetch(`/api/customers/addresses/${deleting.id}`, { method: 'DELETE' })
      const j = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error((j as any)?.error || 'Failed to delete')
      setDeleting(null)
      await load()
    } catch (e: any) { setActionError(e?.message || 'Delete failed') }
    finally { setIsDeleting(false) }
  }

  if (loading) {
    return (
      <div className="space-y-6 py-5 px-2.5">
        <div className="h-8 w-32 bg-gray-200 dark:bg-[#262626] rounded animate-pulse" />
        <div className="h-64 bg-gray-100 dark:bg-[#171717] rounded-xl animate-pulse" />
      </div>
    )
  }
  if (error || !doc) {
    return (
      <div className="space-y-6 py-5 px-2.5">
        <button onClick={() => (typeof window !== 'undefined' && window.history.length > 1 ? router.back() : router.push('/customers/addresses'))} className="inline-flex items-center gap-2 text-sm font-medium text-gray-600 dark:text-[#a1a1aa] hover:text-gray-900 dark:hover:text-white">
          <ArrowLeft className="w-4 h-4" /> Back
        </button>
        <div className="flex flex-col items-center justify-center py-16 bg-white dark:bg-[#171717] rounded-xl border border-gray-200 dark:border-[#262626]">
          <div className="h-14 w-14 bg-red-50 dark:bg-red-900/20 rounded-full flex items-center justify-center mb-4"><AlertCircle className="h-7 w-7 text-red-500" /></div>
          <h3 className="font-semibold text-gray-900 dark:text-white">Failed to load address book</h3>
          <p className="text-sm text-gray-500 mt-1">{error}</p>
          <Link href="/customers/addresses" className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-[#eba236] text-white rounded-lg text-sm font-medium"><ArrowLeft className="w-4 h-4" /> Back to list</Link>
        </div>
      </div>
    )
  }

  const user = doc.user

  return (
    <div className="space-y-6 py-5 px-2.5">
      <button onClick={() => (typeof window !== 'undefined' && window.history.length > 1 ? router.back() : router.push('/customers/addresses'))} className="inline-flex items-center gap-2 text-sm font-medium text-gray-600 dark:text-[#a1a1aa] hover:text-gray-900 dark:hover:text-white">
        <ArrowLeft className="w-4 h-4" /> Back
      </button>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-[#eba236] to-[#c88a20] text-white flex items-center justify-center font-bold text-lg shrink-0 overflow-hidden">
            {user ? initials(user.firstName, user.lastName) : 'C'}
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white tracking-tight">{user ? `${user.firstName} ${user.lastName}` : `Customer #${doc.id}`}</h1>
            <p className="text-sm text-gray-500 dark:text-[#a1a1aa]">{doc.email} • Cust #{doc.id} • {doc.addressCount} saved</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => { setEditing(null); setShowForm(true) }} className="inline-flex items-center gap-2 px-4 py-2.5 bg-[#eba236] hover:bg-[#c88a20] text-white rounded-xl text-sm font-semibold shadow-sm transition"><Plus className="w-4 h-4" /> New Address</button>
          <Link href="/customers/addresses" className="inline-flex items-center gap-2 px-4 py-2.5 bg-white dark:bg-[#171717] border border-gray-200 dark:border-[#262626] rounded-xl text-sm font-medium text-gray-700 dark:text-[#a1a1aa] hover:bg-gray-50 dark:hover:bg-[#262626]">Close</Link>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="rounded-xl border border-gray-200 dark:border-[#262626] bg-white dark:bg-[#171717] p-4"><p className="text-xs text-gray-500 dark:text-[#a1a1aa]">Active Current</p><p className={`mt-2 font-semibold text-sm ${activeAddr ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'}`}>{activeAddr ? `#${activeAddr.id} set` : 'Not set'}</p><p className="text-xs text-gray-500 dark:text-[#a1a1aa] mt-1">{activeAddr ? activeAddr.address_type : 'pick a saved address'}</p></div>
        <div className="rounded-xl border border-gray-200 dark:border-[#262626] bg-white dark:bg-[#171717] p-4"><p className="text-xs text-gray-500 dark:text-[#a1a1aa]">Saved Addresses</p><p className="mt-2 font-bold flex items-center gap-1 text-lg text-gray-900 dark:text-white"><MapPin className="w-5 h-5 text-[#eba236]" /> {savedAddrs.length}</p><p className="text-xs text-gray-500 dark:text-[#a1a1aa]">{addresses.length} total rows</p></div>
        <div className="rounded-xl border border-gray-200 dark:border-[#262626] bg-white dark:bg-[#171717] p-4"><p className="text-xs text-gray-500 dark:text-[#a1a1aa]">Orders</p><p className="mt-2 font-bold flex items-center gap-1 text-lg text-gray-900 dark:text-white"><ShoppingBag className="w-5 h-5 text-[#eba236]" /> {doc.orderCount}</p><p className="text-xs text-gray-500 dark:text-[#a1a1aa]">customer orders</p></div>
        <div className="rounded-xl border border-gray-200 dark:border-[#262626] bg-white dark:bg-[#171717] p-4"><p className="text-xs text-gray-500 dark:text-[#a1a1aa]">Customer</p><p className="mt-2 font-semibold text-sm text-gray-900 dark:text-white flex items-center gap-1"><Users className="w-4 h-4 text-[#eba236]" /> {doc.srn || 'no SRN'}</p><p className="text-xs text-gray-500 dark:text-[#a1a1aa] mt-1">{doc.currentLevel}</p></div>
      </div>

      {actionError && <div className="p-3 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-sm text-red-700 dark:text-red-300 flex items-start gap-2"><AlertCircle className="w-4 h-4 mt-0.5 shrink-0" /> <span>{actionError}</span></div>}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="space-y-5">
          <Section title="Customer Information">
            <Row label="Name" value={user ? `${user.firstName} ${user.lastName}` : '—'} />
            <Row label="Email" value={user?.email || doc.email || '—'} icon={<Mail className="w-3 h-3" />} />
            <Row label="Phone" value={user?.phone || '—'} icon={<Phone className="w-3 h-3" />} />
            <Row label="Customer ID" value={`#${doc.id}`} mono />
          </Section>
          <Section title="Active Current Address">
            {activeAddr ? (
              <div className="p-4">
                <div className="rounded-xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-900/10 p-4">
                  <p className="text-sm font-medium text-gray-900 dark:text-white">{activeAddr.formatted_address}</p>
                  <p className="text-xs text-gray-500 dark:text-[#a1a1aa] mt-1">{[activeAddr.barangay, activeAddr.locality, activeAddr.postal_code].filter(Boolean).join(' • ')} • {activeAddr.address_type} {activeAddr.is_verified ? '• verified' : ''}</p>
                  <p className="text-xs font-mono text-gray-400 mt-1">Address ID #{activeAddr.id} • {activeAddr.latitude ?? '—'}, {activeAddr.longitude ?? '—'}</p>
                </div>
                <div className="flex gap-1 mt-3">
                  <button onClick={() => setViewing(activeAddr)} className="h-8 px-3 inline-flex items-center gap-1 rounded-lg hover:bg-gray-100 dark:hover:bg-[#262626] text-gray-500 dark:text-[#a1a1aa] text-xs font-medium" title="View"><Eye className="w-4 h-4" /> View</button>
                  <button onClick={() => { setEditing(activeAddr); setShowForm(true) }} className="h-8 px-3 inline-flex items-center gap-1 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/20 text-gray-500 dark:text-[#a1a1aa] text-xs font-medium" title="Edit"><Pencil className="w-4 h-4" /> Edit</button>
                </div>
              </div>
            ) : (
              <div className="p-6 text-sm text-amber-700 dark:text-amber-300 text-center">No active address — set one from the saved list.</div>
            )}
          </Section>
        </div>
        <div className="space-y-5">
          <Section title={`Saved Addresses (${savedAddrs.length})`}>
            {savedAddrs.length ? (
              <div className="divide-y divide-gray-100 dark:divide-[#262626]">
                {savedAddrs.map((a) => (
                  <div key={a.id} className="p-4 flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="font-medium text-sm text-gray-900 dark:text-white truncate" title={a.formatted_address}>#{a.id} {a.formatted_address}</div>
                      <div className="text-xs text-gray-500 dark:text-[#a1a1aa]">{[a.barangay, a.locality, a.postal_code].filter(Boolean).join(' • ') || '—'}</div>
                      <div className="mt-1 flex items-center gap-1.5">
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-[11px] font-medium border capitalize ${addressTypeBadge(a.address_type)}`}>{a.address_type}</span>
                        <span className="text-[11px] text-gray-400">{a.is_verified ? 'verified' : 'unverified'}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button onClick={() => void handleSetActive(a)} disabled={settingActiveId === a.id} title="Set as active current" className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-semibold text-[#eba236] hover:text-[#c88a20] disabled:opacity-50">
                        {settingActiveId === a.id ? <RefreshCw className="w-3 h-3 animate-spin" /> : <CheckCircle className="w-3 h-3" />} Set Active
                      </button>
                      <button onClick={() => setViewing(a)} className="h-7 w-7 inline-flex items-center justify-center rounded-lg hover:bg-gray-100 dark:hover:bg-[#262626] text-gray-500 dark:text-[#a1a1aa] hover:text-gray-900 dark:hover:text-white" title="View"><Eye className="w-4 h-4" /></button>
                      <button onClick={() => { setEditing(a); setShowForm(true) }} className="h-7 w-7 inline-flex items-center justify-center rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/20 text-gray-500 dark:text-[#a1a1aa] hover:text-blue-600 dark:hover:text-blue-400" title="Edit"><Pencil className="w-4 h-4" /></button>
                      <button onClick={() => setDeleting(a)} className="h-7 w-7 inline-flex items-center justify-center rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-gray-500 dark:text-[#a1a1aa] hover:text-red-600 dark:hover:text-red-400" title="Delete"><Trash2 className="w-4 h-4" /></button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-6 text-sm text-gray-500 dark:text-[#a1a1aa] text-center">No extra saved addresses{activeAddr ? ' — the active address above is the only one.' : '.'}</div>
            )}
          </Section>
          <div className="rounded-xl border border-gray-200 dark:border-[#262626] bg-white dark:bg-[#171717] p-4">
            <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-2 flex items-center gap-2"><CalendarDays className="w-4 h-4 text-[#eba236]" /> Timeline</h4>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-gray-500 dark:text-[#a1a1aa]">Created</span><span className="font-mono text-xs text-gray-900 dark:text-white">{fmtDate(doc.createdAt)}</span></div>
              <div className="flex justify-between"><span className="text-gray-500 dark:text-[#a1a1aa]">Updated</span><span className="font-mono text-xs text-gray-900 dark:text-white">{fmtDate(doc.updatedAt)}</span></div>
              <div className="flex justify-between"><span className="text-gray-500 dark:text-[#a1a1aa]">Active</span><span className="font-mono text-xs text-gray-900 dark:text-white">{activeAddr ? `#${activeAddr.id}` : '—'}</span></div>
            </div>
          </div>
        </div>
      </div>

      {showForm && (
        <AddressFormModal
          open={showForm}
          initial={editing}
          presetUserId={ownerUserId}
          presetUserLabel={ownerLabel}
          onClose={() => { setShowForm(false); setEditing(null) }}
          onSuccess={() => void load()}
        />
      )}

      {viewing && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={() => setViewing(null)}>
          <div className="relative bg-white dark:bg-[#171717] rounded-2xl shadow-2xl border border-gray-200 dark:border-[#262626] w-full max-w-lg p-6 animate-in fade-in zoom-in-95" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between gap-4">
              <h3 className="font-bold text-gray-900 dark:text-white">Address #{viewing.id} {viewing.isActiveAddress ? '• Active' : '• Saved'}</h3>
              <button onClick={() => setViewing(null)} className="h-8 w-8 inline-flex items-center justify-center rounded-lg hover:bg-gray-100 dark:hover:bg-[#262626] text-gray-500 dark:text-[#a1a1aa]"><X className="w-4 h-4" /></button>
            </div>
            <p className="text-sm text-gray-900 dark:text-white mt-2">{viewing.formatted_address}</p>
            <p className="text-xs text-gray-500 dark:text-[#a1a1aa] mt-2 flex items-center gap-1"><ShieldCheck className="w-3 h-3" /> {viewing.address_type} • {viewing.is_verified ? 'verified' : 'unverified'} • {viewing.verification_method || 'UNVERIFIED'}</p>
            <div className="flex justify-end mt-6"><button onClick={() => setViewing(null)} className="px-4 py-2.5 rounded-xl border border-gray-200 dark:border-[#262626] text-sm font-medium bg-white dark:bg-[#171717] text-gray-700 dark:text-[#a1a1aa] hover:bg-gray-50 dark:hover:bg-[#262626]">Close</button></div>
          </div>
        </div>,
        document.body
      )}

      {deleting && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={() => !isDeleting && setDeleting(null)}>
          <div
            className="relative bg-white dark:bg-[#171717] rounded-2xl shadow-2xl border border-gray-200 dark:border-[#262626] w-full max-w-md p-6 animate-in fade-in zoom-in-95"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="h-12 w-12 rounded-full bg-red-50 dark:bg-red-900/20 flex items-center justify-center mb-4"><Trash2 className="w-6 h-6 text-red-600" /></div>
            <h3 className="font-bold text-gray-900 dark:text-white">Delete address #{deleting.id}?</h3>
            <p className="text-sm text-gray-600 dark:text-[#a1a1aa] mt-1">{deleting.formatted_address.slice(0, 100)}{deleting.isActiveAddress ? ' — this is the ACTIVE address. The CMS BFF will reject with 409 unless you set another active first.' : ' This action cannot be undone.'}</p>
            <div className="flex gap-2 mt-6">
              <button onClick={() => setDeleting(null)} disabled={isDeleting} className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 dark:border-[#262626] text-sm font-medium bg-white dark:bg-[#171717] text-gray-700 dark:text-[#a1a1aa] hover:bg-gray-50 dark:hover:bg-[#262626] disabled:opacity-50">Cancel</button>
              <button onClick={handleDelete} disabled={isDeleting} className="flex-1 px-4 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center justify-center gap-2">{isDeleting ? <RefreshCw className="w-4 h-4 animate-spin" /> : null} Confirm delete</button>
            </div>
            {deleting.isActiveAddress && <p className="text-xs text-amber-600 mt-3">Blocked when active: set another saved address as Active first, or the CMS BFF returns 409 HAS_DEPENDENCIES.</p>}
          </div>
        </div>,
        document.body
      )}
    </div>
  )
}

export default function CustomerAddressBookPage() {
  return (
    <ClientOnly fallback={<AddressBookSkeleton />}>
      <AddressBookViewContent />
    </ClientOnly>
  )
}
