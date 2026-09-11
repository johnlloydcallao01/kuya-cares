'use client'

import React, { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import Link from 'next/link'
import { useQueryClient } from '@tanstack/react-query'
import { QUERY_KEYS } from '@encreasl/client-services'
import { useEmergencyContacts, type EmergencyContactDoc } from '@/hooks/useEmergencyContacts'
import { ClientOnly } from '@/components/ClientOnly'
import {
  Users, Search, X, SlidersHorizontal, ChevronDown, Plus, RefreshCw, AlertCircle,
  Heart, ShieldCheck, ShieldAlert, Clock, CheckCircle, XCircle, Eye, Pencil, Trash2,
  Mail, Phone, CalendarDays, MapPin, AlertTriangle, Layers,
} from '@/components/ui/IconWrapper'

const RELATIONSHIP_OPTS: { value: string; label: string }[] = [
  { value: 'parent', label: 'Parent' },
  { value: 'spouse', label: 'Spouse' },
  { value: 'sibling', label: 'Sibling' },
  { value: 'child', label: 'Child' },
  { value: 'guardian', label: 'Guardian' },
  { value: 'friend', label: 'Friend' },
  { value: 'relative', label: 'Relative' },
  { value: 'other', label: 'Other' },
]

function relationshipBadge(rel: string) {
  const r = rel.toLowerCase()
  if (r === 'parent') return 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-300 dark:border-amber-800'
  if (r === 'spouse') return 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-900/20 dark:text-rose-300 dark:border-rose-800'
  if (r === 'sibling') return 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/20 dark:text-blue-300 dark:border-blue-800'
  if (r === 'child') return 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-300 dark:border-emerald-800'
  if (r === 'guardian') return 'bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-900/20 dark:text-violet-300 dark:border-violet-800'
  if (r === 'friend') return 'bg-cyan-50 text-cyan-700 border-cyan-200 dark:bg-cyan-900/20 dark:text-cyan-300 dark:border-cyan-800'
  if (r === 'relative') return 'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-900/20 dark:text-indigo-300 dark:border-indigo-800'
  return 'bg-zinc-100 text-zinc-700 border-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:border-zinc-700'
}

function fmtDate(iso: string | null) {
  if (!iso) return '—'
  try { return new Date(iso).toLocaleDateString('en-PH', { timeZone: 'Asia/Manila', year: 'numeric', month: 'short', day: 'numeric' }) } catch { return String(iso).slice(0, 10) }
}
function initials(first: string, last: string, profilePicture?: NonNullable<EmergencyContactDoc['user']>['profilePicture']) {
  if (profilePicture?.url) return <img src={profilePicture.url} alt={`${first} ${last}`} className="h-9 w-9 rounded-xl object-cover" />
  const a = (first?.[0] || '').toUpperCase()
  const b = (last?.[0] || '').toUpperCase()
  return `${a}${b}`.trim() || 'EC'
}
function fullName(d: EmergencyContactDoc) {
  return `${d.firstName}${d.middleName ? ` ${d.middleName}` : ''} ${d.lastName}`.replace(/\s+/g, ' ').trim()
}

function KpiCard({ title, value, sub, icon, iconBg }: { title: string; value: string; sub?: string; icon: React.ReactNode; iconBg: string }) {
  return (
    <div className="bg-white dark:bg-[#171717] rounded-xl border border-gray-200 dark:border-[#262626] p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium text-gray-500 dark:text-[#a1a1aa] truncate">{title}</p>
          <p className="text-xl font-bold text-gray-900 dark:text-white mt-1 truncate">{value}</p>
          {sub && <p className="text-xs text-gray-500 dark:text-[#a1a1aa] mt-1 truncate">{sub}</p>}
        </div>
        <div className={`h-9 w-9 rounded-xl flex items-center justify-center shrink-0 ${iconBg}`}>{icon}</div>
      </div>
    </div>
  )
}
function FilterPills({ label, options, value, onToggle }: { label: string; options: { value: string; label: string }[]; value: string[]; onToggle: (v: string) => void }) {
  return (
    <div>
      <p className="text-xs font-semibold text-gray-700 dark:text-[#a1a1aa] mb-2">{label}</p>
      <div className="flex flex-wrap gap-1.5">
        {options.map((opt) => {
          const active = value.includes(opt.value)
          return (
            <button key={opt.value} onClick={() => onToggle(opt.value)} className={`px-2.5 py-1 rounded-full text-xs font-medium border transition capitalize ${active ? 'bg-[#eba236] text-white border-[#eba236]' : 'bg-white dark:bg-[#0a0a0a] text-gray-700 dark:text-[#a1a1aa] border-gray-200 dark:border-[#262626] hover:border-gray-300'}`}>{opt.label}</button>
          )
        })}
      </div>
    </div>
  )
}

// Inline Form Modal Component
function EmergencyContactFormModal({
  open,
  initial,
  onClose,
  onSuccess,
}: {
  open: boolean
  initial: EmergencyContactDoc | null
  onClose: () => void
  onSuccess: () => void
}) {
  const isEdit = !!initial
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [form, setForm] = useState({
    userId: initial ? String(initial.userId ?? initial.user?.id ?? '') : '',
    firstName: initial?.firstName || '',
    middleName: initial?.middleName || '',
    lastName: initial?.lastName || '',
    contactNumber: initial?.contactNumber || '',
    relationship: initial?.relationship || 'parent',
    completeAddress: initial?.completeAddress || '',
    isPrimary: initial?.isPrimary ?? false,
  })

  // user search state
  const [userQuery, setUserQuery] = useState('')
  const [debouncedUserQuery, setDebouncedUserQuery] = useState('')
  const [userOptions, setUserOptions] = useState<{ id: number; label: string; email: string; firstName: string; lastName: string; role: string }[]>([])
  const [loadingUsers, setLoadingUsers] = useState(false)
  const [selectedUserPreview, setSelectedUserPreview] = useState<{ id: number; label: string; email: string } | null>(null)

  useEffect(() => { const id = setTimeout(() => setDebouncedUserQuery(userQuery.trim()), 350); return () => clearTimeout(id) }, [userQuery])

  useEffect(() => {
    if (!initial) {
      setForm({ userId: '', firstName: '', middleName: '', lastName: '', contactNumber: '', relationship: 'parent', completeAddress: '', isPrimary: false })
      setError(null)
      setSelectedUserPreview(null)
      setUserQuery('')
      return
    }
    setForm({
      userId: String(initial.userId ?? initial.user?.id ?? ''),
      firstName: initial.firstName || '',
      middleName: initial.middleName || '',
      lastName: initial.lastName || '',
      contactNumber: initial.contactNumber || '',
      relationship: initial.relationship || 'parent',
      completeAddress: initial.completeAddress || '',
      isPrimary: !!initial.isPrimary,
    })
    if (initial.user) {
      setSelectedUserPreview({ id: initial.user.id, label: `${initial.user.firstName} ${initial.user.lastName}`, email: initial.user.email })
      setUserQuery(`${initial.user.firstName} ${initial.user.lastName} (${initial.user.email})`)
    }
    setError(null)
  }, [initial, open])

  // fetch user options
  useEffect(() => {
    if (!open) return
    if (!debouncedUserQuery && form.userId) return // don't fetch if closed or no query and already have id
    if (!debouncedUserQuery) { setUserOptions([]); return }
    let cancelled = false
    const fetchUsers = async () => {
      setLoadingUsers(true)
      try {
        const res = await fetch(`/api/users?search=${encodeURIComponent(debouncedUserQuery)}&limit=8&_t=${Date.now()}`, { cache: 'no-store' })
        const j = await res.json().catch(() => ({}))
        if (!cancelled) {
          const docs = (j.docs || []) as any[]
          setUserOptions(docs.map((u) => ({ id: Number(u.id), label: `${u.firstName} ${u.lastName}`, email: String(u.email), firstName: String(u.firstName), lastName: String(u.lastName), role: String(u.role) })))
        }
      } catch { if (!cancelled) setUserOptions([]) }
      finally { if (!cancelled) setLoadingUsers(false) }
    }
    void fetchUsers()
    return () => { cancelled = true }
  }, [debouncedUserQuery, open, form.userId])

  const pickUser = (u: { id: number; label: string; email: string }) => {
    setForm((prev) => ({ ...prev, userId: String(u.id) }))
    setSelectedUserPreview(u)
    setUserQuery(`${u.label} (${u.email})`)
    setUserOptions([])
  }

  const set = (k: string, v: any) => setForm((prev) => ({ ...prev, [k]: v }))

  const submit = async () => {
    setError(null)
    if (!form.firstName.trim() || form.firstName.trim().length < 2) return setError('First name is required (min 2 chars)')
    if (!form.lastName.trim() || form.lastName.trim().length < 2) return setError('Last name is required (min 2 chars)')
    if (!form.contactNumber.trim()) return setError('Contact number is required')
    if (!form.relationship || !RELATIONSHIP_OPTS.some((o) => o.value === form.relationship)) return setError('Valid relationship is required')
    if (!form.completeAddress.trim()) return setError('Complete address is required')
    if (!isEdit && !form.userId.trim()) return setError('Owner user is required — search and select a user')
    if (isEdit && form.userId.trim() && Number.isNaN(Number(form.userId.trim()))) return setError('User ID must be numeric')

    setSaving(true)
    try {
      const payload: any = {
        firstName: form.firstName.trim(),
        middleName: form.middleName.trim() || null,
        lastName: form.lastName.trim(),
        contactNumber: form.contactNumber.trim(),
        relationship: form.relationship,
        completeAddress: form.completeAddress.trim(),
        isPrimary: !!form.isPrimary,
      }
      if (form.userId.trim()) payload.user = Number(form.userId.trim())
      // also send userId alias for BFF flexibility
      if (form.userId.trim()) payload.userId = Number(form.userId.trim())

      const url = isEdit ? `/api/emergency-contacts/${(initial as any).id}` : '/api/emergency-contacts'
      const method = isEdit ? 'PATCH' : 'POST'
      const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
      const j = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(j.error || j.details || 'Request failed')
      onSuccess()
      onClose()
    } catch (e: any) { setError(e?.message || 'Save failed') }
    finally { setSaving(false) }
  }

  if (!open) return null

  const inputCls = 'mt-1 w-full px-3 py-2.5 rounded-lg border border-gray-200 dark:border-[#262626] bg-white dark:bg-[#0a0a0a] text-sm text-gray-900 dark:text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#eba236]/20 focus:border-[#eba236]'
  const labelCls = 'text-xs font-medium text-gray-700 dark:text-[#a1a1aa]'

  if (typeof document === 'undefined') return null
  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div
        className="relative bg-white dark:bg-[#171717] rounded-2xl shadow-2xl border border-gray-200 dark:border-[#262626] w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-6 pt-6 pb-4 border-b border-gray-100 dark:border-[#262626] shrink-0">
          <div className="flex items-start justify-between gap-4">
            <div className="flex gap-3 min-w-0">
              <div className="h-10 w-10 rounded-xl bg-[#eba236] text-white flex items-center justify-center shrink-0"><Heart className="w-5 h-5" /></div>
              <div className="min-w-0">
                <h3 className="font-bold text-gray-900 dark:text-white leading-tight">{isEdit ? `Edit Emergency Contact #${initial?.id}` : 'New Emergency Contact'}</h3>
                <p className="text-xs text-gray-500 dark:text-[#a1a1aa] mt-1">{isEdit ? 'Update safety contact details — changes sync via BFF with overrideAccess.' : 'Create a safety contact linked to a platform user. Primary contacts are limited to one per user.'}</p>
              </div>
            </div>
            <button onClick={onClose} className="h-8 w-8 inline-flex items-center justify-center rounded-lg hover:bg-gray-100 dark:hover:bg-[#262626] text-gray-500 dark:text-[#a1a1aa] shrink-0"><X className="w-4 h-4" /></button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6 min-h-0">
          {error && <div className="flex items-start gap-2 p-3 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-sm text-red-700 dark:text-red-300"><AlertCircle className="w-4 h-4 mt-0.5 shrink-0" /> {error}</div>}

          {/* Owner user selector */}
          <div>
            <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2"><Users className="w-4 h-4 text-[#eba236]" /> Owner User <span className="text-xs font-normal text-gray-400">{isEdit ? '(reassign allowed)' : '* required'}</span></h4>
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                value={userQuery}
                onChange={(e) => { setUserQuery(e.target.value); if (!e.target.value.trim()) { setSelectedUserPreview(null); setForm((p) => ({ ...p, userId: '' })) } }}
                placeholder="Search users by name, email, phone, username…"
                className={`${inputCls} pl-9 pr-9`}
              />
              {userQuery && <button onClick={() => { setUserQuery(''); setUserOptions([]); setSelectedUserPreview(null); setForm((p) => ({ ...p, userId: '' })) }} className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-full hover:bg-gray-100 dark:hover:bg-[#262626]"><X className="w-4 h-4 text-gray-400" /></button>}
            </div>
            {/* dropdown */}
            {userOptions.length > 0 && (
              <div className="mt-2 rounded-xl border border-gray-200 dark:border-[#262626] bg-white dark:bg-[#0a0a0a] shadow-lg overflow-hidden divide-y divide-gray-100 dark:divide-[#262626] max-h-48 overflow-y-auto">
                {userOptions.map((u) => (
                  <button key={u.id} onClick={() => pickUser(u)} className="w-full text-left px-3 py-2.5 hover:bg-gray-50 dark:hover:bg-[#171717] flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{u.label} <span className="text-xs text-gray-500">#{u.id} • {u.role}</span></p>
                      <p className="text-xs text-gray-500 truncate">{u.email}</p>
                    </div>
                    <span className="text-xs font-mono text-gray-400">#{u.id}</span>
                  </button>
                ))}
              </div>
            )}
            {loadingUsers && <p className="text-xs text-gray-400 mt-2">Searching users…</p>}
            {/* selected preview */}
            <div className="mt-3 flex items-center gap-2 flex-wrap">
              <div className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-gray-50 dark:bg-[#0a0a0a] border border-gray-200 dark:border-[#262626]">
                <span className="text-xs text-gray-500">Selected user ID:</span>
                <input value={form.userId} onChange={(e) => set('userId', e.target.value)} placeholder="e.g. 12" className="w-20 px-2 py-1 rounded-lg border border-gray-200 dark:border-[#262626] bg-white dark:bg-[#171717] text-sm font-mono" />
                {selectedUserPreview && <span className="text-xs text-gray-700 dark:text-white">{selectedUserPreview.label} • {selectedUserPreview.email}</span>}
              </div>
            </div>
            {!isEdit && !form.userId && <p className="text-xs text-amber-600 dark:text-amber-400 mt-2">Tip: type at least 2 characters to search users. You can also paste a numeric user ID directly.</p>}
          </div>

          {/* Contact identity */}
          <div>
            <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2"><Heart className="w-4 h-4 text-rose-500" /> Contact Identity</h4>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div><label className={labelCls}>First name *</label><input value={form.firstName} onChange={(e) => set('firstName', e.target.value)} placeholder="Maria" className={inputCls} /></div>
              <div><label className={labelCls}>Middle name</label><input value={form.middleName} onChange={(e) => set('middleName', e.target.value)} placeholder="Santos (optional)" className={inputCls} /></div>
              <div><label className={labelCls}>Last name *</label><input value={form.lastName} onChange={(e) => set('lastName', e.target.value)} placeholder="Dela Cruz" className={inputCls} /></div>
            </div>
          </div>

          {/* Contact details */}
          <div>
            <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2"><Phone className="w-4 h-4 text-blue-600" /> Contact Details</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div><label className={labelCls}>Contact number *</label><input value={form.contactNumber} onChange={(e) => set('contactNumber', e.target.value)} placeholder="+63 912 345 6789" className={inputCls} /></div>
              <div>
                <label className={labelCls}>Relationship *</label>
                <select value={form.relationship} onChange={(e) => set('relationship', e.target.value)} className={inputCls}>
                  {RELATIONSHIP_OPTS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
              <div className="sm:col-span-2"><label className={labelCls}>Complete address *</label><textarea value={form.completeAddress} onChange={(e) => set('completeAddress', e.target.value)} rows={3} placeholder="House no., street, barangay, city, province, postal — free-form as stored in emergency_contacts.complete_address" className={inputCls} /></div>
            </div>
          </div>

          {/* Primary flag */}
          <div className="rounded-xl border border-dashed border-[#eba236]/30 dark:border-[#eba236]/30 bg-[#eba236]/10 dark:bg-[#eba236]/10 p-4">
            <label className="flex items-start gap-3 cursor-pointer">
              <input type="checkbox" checked={form.isPrimary} onChange={(e) => set('isPrimary', e.target.checked)} className="mt-1 h-4 w-4 rounded border-gray-300 text-[#eba236] focus:ring-[#eba236]" />
              <div className="min-w-0">
                <p className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-1"><Heart className="w-4 h-4 text-[#eba236]" /> Mark as primary emergency contact</p>
                <p className="text-xs text-gray-600 dark:text-[#a1a1aa] mt-1">When saved as primary, any existing primary contact for the same user will be automatically demoted to non-primary via the BFF (overrideAccess). Only one primary per user.</p>
              </div>
            </label>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-gray-200 dark:border-[#262626] bg-gray-50 dark:bg-[#0a0a0a] px-6 py-4 rounded-b-2xl shrink-0">
          <button type="button" onClick={onClose} disabled={saving} className="rounded-lg border border-gray-300 dark:border-[#262626] bg-white dark:bg-[#171717] px-4 py-2 text-sm font-medium text-gray-700 dark:text-[#a1a1aa] hover:bg-gray-50 dark:hover:bg-[#262626] disabled:opacity-50">Cancel</button>
          <button type="button" onClick={submit} disabled={saving} className="inline-flex items-center gap-2 rounded-lg bg-[#eba236] hover:bg-[#c88a20] px-6 py-2 text-sm font-semibold text-white disabled:opacity-50">
            {saving && <RefreshCw className="h-4 w-4 animate-spin" />} {isEdit ? 'Save changes' : 'Create contact'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}

function EmergencyContactsSkeleton(){
  return (
    <div className="space-y-6 py-5 px-2.5">
      <div className="h-8 w-48 bg-gray-200 dark:bg-[#262626] rounded animate-pulse" />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 animate-pulse">
        {Array.from({length:4}).map((_,i)=><div key={i} className="h-[86px] bg-gray-100 dark:bg-[#171717] rounded-xl border border-gray-200 dark:border-[#262626]" />)}
      </div>
      <div className="p-4 space-y-3 animate-pulse">{Array.from({length:6}).map((_,i)=><div key={i} className="h-16 bg-gray-100 dark:bg-[#0a0a0a] rounded-lg" />)}</div>
    </div>
  )
}

function EmergencyContactsPageContent() {
  // query state
  const [q, setQ] = useState('')
  const [debouncedQ, setDebouncedQ] = useState('')
  const [relationshipFilter, setRelationshipFilter] = useState<string[]>([])
  const [isPrimaryFilter, setIsPrimaryFilter] = useState<boolean | null>(null)
  const [sort, setSort] = useState<string>('-createdAt')
  const [page, setPage] = useState(1)
  const limit = 10
  const [showFilters, setShowFilters] = useState(false)

  // modals
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<EmergencyContactDoc | null>(null)
  const [deleting, setDeleting] = useState<EmergencyContactDoc | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)

  useEffect(() => { const id = setTimeout(() => setDebouncedQ(q.trim()), 400); return () => clearTimeout(id) }, [q])

  const activeFilterCount = useMemo(() => {
    return relationshipFilter.length + (isPrimaryFilter !== null ? 1 : 0) + (debouncedQ ? 1 : 0)
  }, [relationshipFilter, isPrimaryFilter, debouncedQ])

  const qs = useMemo(() => {
    const p = new URLSearchParams()
    p.set('page', String(page))
    p.set('limit', String(limit))
    p.set('sort', sort)
    if (debouncedQ) p.set('search', debouncedQ)
    if (relationshipFilter.length) p.set('relationship', relationshipFilter.join(','))
    if (isPrimaryFilter !== null) p.set('isPrimary', String(isPrimaryFilter))
    return p.toString()
  }, [page, limit, sort, debouncedQ, relationshipFilter, isPrimaryFilter])

  const queryClient = useQueryClient()
  const [hardRefreshing, setHardRefreshing] = useState(false)
  const { data, isPending, isFetching, isError, error: queryError, refetch } = useEmergencyContacts(qs)

  const docs = data?.docs || []
  const pagination = data?.pagination || null
  const stats = data?.stats || null

  const isInitialLoading = (isPending && !data) || hardRefreshing
  const loading = isFetching || hardRefreshing
  const error = isError && !data && !hardRefreshing ? (queryError instanceof Error ? queryError.message : 'Failed to load emergency contacts') : null

  const handleHardRefresh = () => {
    if (hardRefreshing) return
    setHardRefreshing(true)
    void (async () => {
      try {
        queryClient.removeQueries({ queryKey: QUERY_KEYS.adminEmergencyContacts(qs) })
        await refetch({ cancelRefetch: true })
      } finally { setHardRefreshing(false) }
    })()
  }

  useEffect(() => { setPage(1) }, [debouncedQ, relationshipFilter, isPrimaryFilter, sort])

  useEffect(() => {
    const isOpen = !!deleting || showForm
    if (isOpen) {
      const prev = document.body.style.overflow
      document.body.style.overflow = 'hidden'
      return () => { document.body.style.overflow = prev }
    }
    document.body.style.overflow = ''
    return () => { document.body.style.overflow = '' }
  }, [deleting, showForm])

  // auto-dismiss action error
  useEffect(() => {
    if (!actionError) return
    const t = setTimeout(() => setActionError(null), 4200)
    return () => clearTimeout(t)
  }, [actionError])

  const toggleRelationship = (v: string) => setRelationshipFilter((prev) => prev.includes(v) ? prev.filter((x) => x !== v) : [...prev, v])
  const clearAll = () => { setQ(''); setDebouncedQ(''); setRelationshipFilter([]); setIsPrimaryFilter(null) }

  const openCreate = () => { setEditing(null); setShowForm(true) }
  const openEdit = (doc: EmergencyContactDoc) => { setEditing(doc); setShowForm(true) }

  const handleDelete = async () => {
    if (!deleting || isDeleting) return
    setIsDeleting(true)
    try {
      const res = await fetch(`/api/emergency-contacts/${deleting.id}`, { method: 'DELETE' })
      const j = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(j.error || 'Failed to delete')
      setDeleting(null)
      await refetch()
    } catch (e: any) { setActionError(e?.message || 'Delete failed') }
    finally { setIsDeleting(false) }
  }

  const handleTogglePrimary = async (doc: EmergencyContactDoc) => {
    const next = !doc.isPrimary
    try {
      const res = await fetch(`/api/emergency-contacts/${doc.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isPrimary: next }),
      })
      const j = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(j.error || 'Failed to toggle primary')
      void refetch()
    } catch (e: any) {
      setActionError(e?.message || 'Failed to toggle primary')
    }
  }

  // derived KPI sub-stats
  const topRelationship = useMemo(() => {
    if (!stats) return '—'
    let best: [string, number] | null = null
    for (const [k, v] of Object.entries(stats.relationshipBreakdown)) {
      if (!best || v > best[1]) best = [k, v]
    }
    return best ? `${best[0]} (${best[1]})` : '—'
  }, [stats])
  const familyCount = useMemo(() => {
    if (!stats) return 0
    const fam = ['parent', 'spouse', 'sibling', 'child', 'guardian', 'relative']
    return fam.reduce((sum, k) => sum + (stats.relationshipBreakdown[k] || 0), 0)
  }, [stats])

  return (
    <div className="space-y-6 py-5 px-2.5">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white tracking-tight flex items-center gap-2">
            <span className="h-8 w-8 rounded-lg bg-[#eba236] text-white flex items-center justify-center"><Heart className="w-4 h-4" /></span>
            Emergency Contacts
          </h1>
          <p className="text-sm text-gray-500 dark:text-[#a1a1aa] mt-1">Manage safety contacts linked to platform users — search by name, relationship or address, filter by primary status, and control single-primary enforcement.</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleHardRefresh}
            disabled={loading}
            aria-label="Refresh emergency contacts"
            title="Refresh — re-fetch from BFF and show skeleton"
            className="h-9 w-9 inline-flex items-center justify-center bg-white dark:bg-[#171717] border border-gray-200 dark:border-[#262626] rounded-xl hover:bg-gray-50 dark:hover:bg-[#262626] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <RefreshCw className={`w-4 h-4 text-gray-600 dark:text-[#a1a1aa] ${loading ? 'animate-spin' : ''}`} />
          </button>
          <Link href="/customers" className="hidden sm:inline-flex items-center gap-2 px-3 py-2.5 bg-white dark:bg-[#171717] border border-gray-200 dark:border-[#262626] hover:bg-gray-50 dark:hover:bg-[#262626] text-gray-700 dark:text-[#a1a1aa] rounded-xl text-sm font-medium transition">
            <Users className="w-4 h-4" /> Customers
          </Link>
          <button onClick={openCreate} className="inline-flex items-center gap-2 px-4 py-2.5 bg-[#eba236] hover:bg-[#c88a20] text-white rounded-xl text-sm font-semibold shadow-sm transition">
            <Plus className="w-4 h-4" /> New Contact
          </button>
        </div>
      </div>

      {/* KPIs */}
      {stats ? (
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
          <KpiCard title="Total Contacts" value={String(stats.filteredTotal)} sub={`${stats.totalAll} overall`} icon={<Layers className="w-5 h-5 text-white" />} iconBg="bg-[#eba236]" />
          <KpiCard title="Primary" value={String(stats.primaryCount)} sub={`${Math.round(((stats.primaryCount)/Math.max(1,stats.totalAll))*100)}% are primary`} icon={<Heart className="w-5 h-5 text-white" />} iconBg="bg-rose-500" />
          <KpiCard title="Standard" value={String(stats.nonPrimaryCount)} sub={`${stats.primaryCount} primary — uniqueness enforced`} icon={<ShieldCheck className="w-5 h-5 text-white" />} iconBg="bg-emerald-500" />
          <KpiCard title="Family Ties" value={String(familyCount)} sub={`top: ${topRelationship}`} icon={<Users className="w-5 h-5 text-white" />} iconBg="bg-blue-600" />
          <KpiCard title="Non-Family" value={String((stats.relationshipBreakdown.friend||0)+(stats.relationshipBreakdown.other||0))} sub={`${stats.relationshipBreakdown.friend||0} friend • ${stats.relationshipBreakdown.other||0} other`} icon={<ShieldAlert className="w-5 h-5 text-white" />} iconBg="bg-amber-500" />
        </div>
      ) : isInitialLoading ? (
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 animate-pulse">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-[86px] bg-gray-100 dark:bg-[#171717] rounded-xl border border-gray-200 dark:border-[#262626]" />
          ))}
        </div>
      ) : null}

      {/* Search + Filters bar */}
      <div className="bg-white dark:bg-[#171717] rounded-xl border border-gray-200 dark:border-[#262626] p-3 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search contact name, phone, address, relationship, or owner email…" className="w-full pl-9 pr-9 py-2.5 text-sm bg-gray-50 dark:bg-[#0a0a0a] border border-gray-200 dark:border-[#262626] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#eba236]/20 focus:border-[#eba236] text-gray-900 dark:text-white placeholder:text-gray-400" />
            {q && <button onClick={() => setQ('')} className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-full hover:bg-gray-100 dark:hover:bg-[#262626]"><X className="w-4 h-4 text-gray-400" /></button>}
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-1 p-1 bg-gray-100 dark:bg-[#0a0a0a] rounded-full border border-gray-200 dark:border-[#262626]">
              <select value={sort} onChange={(e) => setSort(e.target.value)} className="px-3 py-1.5 rounded-full text-xs font-semibold bg-white dark:bg-[#171717] border border-gray-200 dark:border-[#333] text-gray-700 dark:text-white">
                <option value="-createdAt">Newest first</option>
                <option value="createdAt">Oldest first</option>
                <option value="firstName">First name A–Z</option>
                <option value="lastName">Last name A–Z</option>
                <option value="relationship">Relationship A–Z</option>
                <option value="-updatedAt">Recently updated</option>
              </select>
            </div>
            <span className="px-3 py-2 rounded-lg text-xs font-medium bg-gray-100 dark:bg-[#0a0a0a] border border-gray-200 dark:border-[#262626] text-gray-600 dark:text-[#a1a1aa]">10 / page</span>
            <button onClick={() => setShowFilters((v) => !v)} className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold border transition shrink-0 ${activeFilterCount ? 'bg-[#eba236] hover:bg-[#c88a20] text-white border-[#eba236] hover:border-[#c88a20]' : 'bg-white dark:bg-[#171717] text-gray-700 dark:text-[#a1a1aa] border-gray-200 dark:border-[#262626] hover:bg-gray-50 dark:hover:bg-[#262626] hover:text-gray-900 dark:hover:text-white'}`}>
              <SlidersHorizontal className="w-4 h-4" /> Filters {activeFilterCount > 0 && <span className="px-1.5 py-0.5 rounded-full text-xs font-bold bg-white text-[#eba236]">{activeFilterCount}</span>} <ChevronDown className={`w-4 h-4 transition ${showFilters ? 'rotate-180' : ''}`} />
            </button>
            {activeFilterCount > 0 && <button onClick={clearAll} className="text-sm font-medium text-gray-500 dark:text-[#a1a1aa] hover:text-gray-900">Clear all</button>}
          </div>
        </div>

        {showFilters && (
          <div className="mt-4 pt-4 border-t border-gray-100 dark:border-[#262626] space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              <FilterPills label="Relationship" options={RELATIONSHIP_OPTS} value={relationshipFilter} onToggle={toggleRelationship} />
              <div>
                <p className="text-xs font-semibold text-gray-700 dark:text-[#a1a1aa] mb-2">Primary Status</p>
                <div className="flex flex-wrap gap-1.5">
                  {([['all', 'All'], ['true', 'Primary only'], ['false', 'Standard only']] as const).map(([v, l]) => {
                    const active = (isPrimaryFilter === null && v === 'all') || String(isPrimaryFilter) === v
                    return <button key={v} onClick={() => setIsPrimaryFilter(v === 'all' ? null : v === 'true')} className={`px-2.5 py-1 rounded-full text-xs font-medium border ${active ? 'bg-[#eba236] text-white border-[#eba236]' : 'bg-white dark:bg-[#0a0a0a] text-gray-700 dark:text-[#a1a1aa] border-gray-200 dark:border-[#262626]'}`}>{l}</button>
                  })}
                </div>
              </div>
              <div className="rounded-xl bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800 p-3">
                <p className="text-xs font-semibold text-amber-800 dark:text-amber-200 flex items-center gap-1"><AlertTriangle className="w-3 h-3" /> BFF tip</p>
                <p className="text-xs text-amber-700 dark:text-amber-300/80 mt-1">Filters are applied server-side via the <span className="font-mono">/api/admin/emergency-contacts</span> aggregation endpoint — combining search + relationship + primary uses a single backend join (docs/BFF-pattern.md).</p>
              </div>
            </div>
            <div className="flex justify-end"><button onClick={() => setShowFilters(false)} className="text-xs font-semibold text-[#eba236]">Done</button></div>
          </div>
        )}

        {activeFilterCount > 0 && !showFilters && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {debouncedQ && <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-[#eba236]/10 dark:bg-[#eba236]/15 text-[#8a5f17] dark:text-[#eba236] rounded-full text-xs font-medium border border-[#eba236]/30 dark:border-[#eba236]/30">Search: “{debouncedQ}” <button onClick={() => setQ('')}><X className="w-3 h-3" /></button></span>}
            {relationshipFilter.map((v) => <span key={v} className="inline-flex items-center gap-1 px-2.5 py-1 bg-gray-100 dark:bg-[#262626] text-gray-700 dark:text-[#a1a1aa] rounded-full text-xs font-medium capitalize">{v} <button onClick={() => toggleRelationship(v)}><X className="w-3 h-3" /></button></span>)}
            {isPrimaryFilter !== null && <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-gray-100 dark:bg-[#262626] rounded-full text-xs">{isPrimaryFilter ? 'Primary only' : 'Standard only'} <button onClick={() => setIsPrimaryFilter(null)}><X className="w-3 h-3" /></button></span>}
          </div>
        )}
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-[#171717] rounded-xl border border-gray-200 dark:border-[#262626] shadow-sm overflow-hidden">
        {error && (
          <div className="flex flex-col items-center justify-center py-16 px-6">
            <div className="h-14 w-14 bg-red-50 dark:bg-red-900/20 rounded-full flex items-center justify-center mb-4"><AlertCircle className="h-7 w-7 text-red-500" /></div>
            <h3 className="font-semibold text-gray-900 dark:text-white">Failed to load emergency contacts</h3>
            <p className="text-sm text-gray-500 mt-1 mb-4">{error}</p>
            <button onClick={handleHardRefresh} className="inline-flex items-center px-4 py-2 bg-[#eba236] text-white rounded-lg text-sm font-medium"><RefreshCw className="h-4 w-4 mr-2" />Retry</button>
          </div>
        )}
        {isInitialLoading ? (
          <div className="p-4 space-y-3 animate-pulse">
            {Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-16 bg-gray-100 dark:bg-[#0a0a0a] rounded-lg" />)}
          </div>
        ) : !error && docs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
            <div className="h-16 w-16 bg-[#eba236]/10 dark:bg-[#eba236]/15 rounded-2xl flex items-center justify-center mb-4"><Heart className="w-8 h-8 text-[#eba236]" /></div>
            <h3 className="font-semibold text-gray-900 dark:text-white">No emergency contacts found</h3>
            <p className="text-sm text-gray-500 dark:text-[#a1a1aa] mt-1 max-w-md">Try adjusting search or filters, or add your first safety contact. Each contact links to a platform user and can be designated as primary.</p>
            <button onClick={openCreate} className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-[#eba236] text-white rounded-lg text-sm font-semibold"><Plus className="w-4 h-4" /> Add contact</button>
          </div>
        ) : !error && (
          <>
            {actionError && (
              <div className="mx-4 mt-4 p-3 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-sm text-red-700 dark:text-red-300 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" /> <span>{actionError}</span>
              </div>
            )}
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 dark:bg-[#0a0a0a] text-xs text-gray-500 dark:text-[#a1a1aa] border-b border-gray-200 dark:border-[#262626]">
                  <tr>
                    <th className="text-left px-4 py-3 font-medium">Contact</th>
                    <th className="text-left px-4 py-3 font-medium hidden lg:table-cell">Owner User</th>
                    <th className="text-left px-4 py-3 font-medium">Relationship</th>
                    <th className="text-left px-4 py-3 font-medium hidden xl:table-cell">Contact Number</th>
                    <th className="text-left px-4 py-3 font-medium hidden xl:table-cell">Address</th>
                    <th className="text-left px-4 py-3 font-medium">Primary</th>
                    <th className="text-left px-4 py-3 font-medium hidden md:table-cell">Created</th>
                    <th className="text-right px-4 py-3 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-[#262626]">
                  {docs.map((c) => (
                    <tr key={c.id} className="hover:bg-gray-50 dark:hover:bg-[#0a0a0a]/50 transition">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3 min-w-[220px]">
                          <div className={`h-9 w-9 rounded-xl flex items-center justify-center text-xs font-bold shrink-0 ${c.isPrimary ? 'bg-gradient-to-br from-rose-500 to-pink-600 text-white' : 'bg-gradient-to-br from-[#eba236] to-[#c88a20] text-white'}`}>
                            {initials(c.firstName, c.lastName, c.user?.profilePicture)}
                          </div>
                          <div className="min-w-0">
                            <div className="font-semibold text-gray-900 dark:text-white truncate max-w-[180px] flex items-center gap-1">
                              {fullName(c)}
                              {c.isPrimary && <Heart className="w-3 h-3 text-rose-500 shrink-0" />}
                            </div>
                            <div className="text-xs text-gray-500 dark:text-[#a1a1aa] truncate max-w-[180px] flex items-center gap-1"><Phone className="w-3 h-3 text-gray-400 shrink-0" />{c.contactNumber}</div>
                            <div className="text-[11px] text-gray-400 truncate max-w-[180px] flex items-center gap-1"><MapPin className="w-3 h-3" />{c.completeAddress.slice(0, 40)}{c.completeAddress.length > 40 ? '…' : ''}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 hidden lg:table-cell">
                        {c.user ? (
                          <div className="min-w-[180px]">
                            <div className="font-medium text-gray-900 dark:text-white truncate max-w-[160px] flex items-center gap-1"><Users className="w-3 h-3 text-gray-400 shrink-0" />{c.user.firstName} {c.user.lastName}</div>
                            <div className="text-xs text-gray-500 truncate max-w-[160px] flex items-center gap-1"><Mail className="w-3 h-3 text-gray-400 shrink-0" />{c.user.email}</div>
                            <div className="text-[11px] text-gray-400">{c.user.role} • ID #{c.user.id}</div>
                          </div>
                        ) : (
                          <span className="text-xs text-gray-400">User #{c.userId ?? '—'}</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold border capitalize ${relationshipBadge(c.relationship)}`}>
                          {c.relationship}
                        </span>
                      </td>
                      <td className="px-4 py-3 hidden xl:table-cell">
                        <span className="font-mono text-xs text-gray-900 dark:text-white">{c.contactNumber}</span>
                      </td>
                      <td className="px-4 py-3 hidden xl:table-cell">
                        <span className="text-xs text-gray-600 dark:text-[#a1a1aa] truncate max-w-[200px] inline-block" title={c.completeAddress}>{c.completeAddress.slice(0, 56)}{c.completeAddress.length > 56 ? '…' : ''}</span>
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => void handleTogglePrimary(c)}
                          title={c.isPrimary ? 'Primary — click to demote' : 'Click to promote to primary'}
                          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold border transition ${c.isPrimary ? 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-900/20 dark:text-rose-300 dark:border-rose-800' : 'bg-zinc-100 text-zinc-600 border-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:border-zinc-700 hover:bg-gray-50 dark:hover:bg-zinc-700'}`}
                        >
                          <span className={`h-2 w-2 rounded-full ${c.isPrimary ? 'bg-rose-500' : 'bg-zinc-400'}`} /> {c.isPrimary ? 'Primary' : 'Standard'}
                        </button>
                      </td>
                      <td className="px-4 py-3 hidden md:table-cell">
                        <div className="text-xs text-gray-900 dark:text-white flex items-center gap-1"><CalendarDays className="w-3 h-3 text-gray-400" />{fmtDate(c.createdAt)}</div>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="inline-flex items-center gap-1">
                          <button onClick={() => openEdit(c)} className="h-7 w-7 inline-flex items-center justify-center rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/20 text-gray-500 dark:text-[#a1a1aa] hover:text-blue-600 dark:hover:text-blue-400" title="Edit"><Pencil className="w-4 h-4" /></button>
                          <button onClick={() => setDeleting(c)} className="h-7 w-7 inline-flex items-center justify-center rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-gray-500 dark:text-[#a1a1aa] hover:text-red-600 dark:hover:text-red-400" title="Delete"><Trash2 className="w-4 h-4" /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination — fixed 10 per page */}
            {pagination && pagination.totalDocs > 0 && !loading && (
              <div className="px-4 py-3 border-t border-gray-200 dark:border-[#262626] flex flex-col sm:flex-row items-center justify-between gap-3 text-sm">
                <div className="text-gray-600 dark:text-[#a1a1aa]">Page {pagination.page} of {pagination.totalPages} • {pagination.totalDocs} contacts • 10 per page</div>
                <div className="flex items-center gap-1">
                  <button disabled={loading || !pagination.hasPrevPage} onClick={() => setPage((p) => Math.max(1, p - 1))} className="px-3 py-1.5 rounded-lg border border-gray-200 dark:border-[#262626] bg-white dark:bg-[#0a0a0a] disabled:opacity-50 text-sm">Prev</button>
                  {Array.from({ length: Math.min(5, pagination.totalPages) }).map((_, i) => {
                    const n = Math.max(1, Math.min(pagination.totalPages - 4, pagination.page - 2)) + i
                    if (n > pagination.totalPages) return null
                    return <button key={n} onClick={() => setPage(n)} className={`h-8 w-8 rounded-lg text-sm font-medium border ${n === pagination.page ? 'bg-[#eba236] text-white border-[#eba236]' : 'bg-white dark:bg-[#0a0a0a] border-gray-200 dark:border-[#262626] text-gray-700 dark:text-white'}`}>{n}</button>
                  })}
                  <button disabled={loading || !pagination.hasNextPage} onClick={() => setPage((p) => p + 1)} className="px-3 py-1.5 rounded-lg border border-gray-200 dark:border-[#262626] bg-white dark:bg-[#0a0a0a] disabled:opacity-50 text-sm">Next</button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Create/Edit Modal */}
      <EmergencyContactFormModal
        open={showForm}
        initial={editing}
        onClose={() => { setShowForm(false); setEditing(null) }}
        onSuccess={() => void refetch()}
      />

      {/* Delete confirm */}
      {deleting && typeof document !== 'undefined' &&
        createPortal(
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={() => !isDeleting && setDeleting(null)}>
            <div
              className="relative bg-white dark:bg-[#171717] rounded-2xl shadow-2xl border border-gray-200 dark:border-[#262626] w-full max-w-md p-6 animate-in fade-in zoom-in-95"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="h-12 w-12 rounded-full bg-red-50 dark:bg-red-900/20 flex items-center justify-center mb-4"><Trash2 className="w-6 h-6 text-red-600" /></div>
              <h3 className="font-bold text-gray-900 dark:text-white">Delete emergency contact?</h3>
              <p className="text-sm text-gray-600 dark:text-[#a1a1aa] mt-1">This will permanently delete <span className="font-semibold text-gray-900 dark:text-white">{fullName(deleting)}</span> ({deleting.relationship}, {deleting.contactNumber}) linked to {deleting.user ? `${deleting.user.firstName} ${deleting.user.lastName} (#${deleting.user.id})` : `user #${deleting.userId}`}. {deleting.isPrimary ? 'This is a primary contact — ensure another contact is promoted if needed.' : 'This action cannot be undone.'}</p>
              <div className="flex gap-2 mt-6">
                <button onClick={() => setDeleting(null)} disabled={isDeleting} className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 dark:border-[#262626] text-sm font-medium bg-white dark:bg-[#171717] hover:bg-gray-50 dark:hover:bg-[#262626] disabled:opacity-50">Cancel</button>
                <button onClick={handleDelete} disabled={isDeleting} className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed">
                  {isDeleting ? <RefreshCw className="w-4 h-4 animate-spin" /> : null} Confirm delete
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
    </div>
  )
}

export default function EmergencyContactsPage(){
  return (
    <ClientOnly fallback={<EmergencyContactsSkeleton />}>
      <EmergencyContactsPageContent />
    </ClientOnly>
  )
}
