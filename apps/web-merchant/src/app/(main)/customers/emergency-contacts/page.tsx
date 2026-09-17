'use client'

import React, { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { ClientOnly } from '@/components/ClientOnly'
import {
  Heart, Search, X, SlidersHorizontal, ChevronDown, RefreshCw, AlertCircle,
  Users, Phone, CheckCircle, ShieldCheck,
} from '@/components/ui/IconWrapper'

type ContactDoc = {
  id: number
  firstName: string
  lastName: string
  relationship: string
  contactNumber: string
  isPrimary: boolean
  customer: { id: number; email: string; firstName: string; lastName: string } | null
  ordersCount: number
  createdAt: string
  updatedAt: string
}

type OutletOption = { id: number; outletName: string }

type Pagination = { page: number; limit: number; totalDocs: number; totalPages: number; hasNextPage: boolean; hasPrevPage: boolean }
type Stats = {
  totalContacts: number
  filteredTotal: number
  primaryCount: number
  relationshipBreakdown: Record<string, number>
  customersCovered: number
}

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

const SORTS: { value: string; label: string }[] = [
  { value: '-createdAt', label: 'Newest first' },
  { value: 'createdAt', label: 'Oldest first' },
  { value: 'firstName', label: 'First name A–Z' },
  { value: 'lastName', label: 'Last name A–Z' },
  { value: 'relationship', label: 'Relationship A–Z' },
]

function fullName(c: ContactDoc): string {
  return `${c.firstName || ''} ${c.lastName || ''}`.replace(/\s+/g, ' ').trim() || `Contact #${c.id}`
}
function initials(first: string, last: string) {
  const a = (first?.[0] || '').toUpperCase()
  const b = (last?.[0] || '').toUpperCase()
  return `${a}${b}`.trim() || 'EC'
}
function customerLabel(c: ContactDoc['customer']): string {
  if (!c) return '—'
  const name = `${c.firstName || ''} ${c.lastName || ''}`.trim()
  return name || c.email || `Customer #${c.id}`
}
function relationshipBadge(r: string) {
  const v = (r || '').toLowerCase()
  if (v === 'parent') return 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-300 dark:border-amber-800'
  if (v === 'spouse') return 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-900/20 dark:text-rose-300 dark:border-rose-800'
  if (v === 'sibling') return 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/20 dark:text-blue-300 dark:border-blue-800'
  if (v === 'child') return 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-300 dark:border-emerald-800'
  if (v === 'guardian') return 'bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-900/20 dark:text-violet-300 dark:border-violet-800'
  if (v === 'friend') return 'bg-cyan-50 text-cyan-700 border-cyan-200 dark:bg-cyan-900/20 dark:text-cyan-300 dark:border-cyan-800'
  if (v === 'relative') return 'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-900/20 dark:text-indigo-300 dark:border-indigo-800'
  return 'bg-zinc-100 text-zinc-700 border-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:border-zinc-700'
}
function fmtDate(iso: string | null) {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleDateString('en-PH', { timeZone: 'Asia/Manila', year: 'numeric', month: 'short', day: 'numeric' })
  } catch {
    return String(iso).slice(0, 10)
  }
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

function ContactsSkeleton() {
  return (
    <div className="space-y-6 py-5 px-2.5">
      <div className="h-8 w-48 bg-gray-200 dark:bg-[#262626] rounded animate-pulse" />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 animate-pulse">
        {Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-[86px] bg-gray-100 dark:bg-[#171717] rounded-xl border border-gray-200 dark:border-[#262626]" />)}
      </div>
      <div className="p-4 space-y-3 animate-pulse">
        {Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-16 bg-gray-100 dark:bg-[#0a0a0a] rounded-lg" />)}
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
            <button
              key={opt.value}
              onClick={() => onToggle(opt.value)}
              className={`px-2.5 py-1 rounded-full text-xs font-medium border transition capitalize ${active ? 'bg-[#239459] text-white border-[#239459]' : 'bg-white dark:bg-[#0a0a0a] text-gray-700 dark:text-[#a1a1aa] border-gray-200 dark:border-[#262626]'}`}
            >
              {opt.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}

function ContactsContent() {
  const [q, setQ] = useState('')
  const [debouncedQ, setDebouncedQ] = useState('')
  const [outletFilter, setOutletFilter] = useState('')
  const [relationshipFilter, setRelationshipFilter] = useState<string[]>([])
  const [primaryFilter, setPrimaryFilter] = useState<string[]>([])
  const [sort, setSort] = useState('-createdAt')
  const [showFilters, setShowFilters] = useState(false)
  const [page, setPage] = useState(1)
  const limit = 10

  const [docs, setDocs] = useState<ContactDoc[]>([])
  const [merchants, setMerchants] = useState<OutletOption[]>([])
  const [stats, setStats] = useState<Stats | null>(null)
  const [pagination, setPagination] = useState<Pagination | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const id = setTimeout(() => setDebouncedQ(q.trim()), 400)
    return () => clearTimeout(id)
  }, [q])

  useEffect(() => {
    setPage(1)
  }, [debouncedQ, outletFilter, relationshipFilter, primaryFilter, sort])

  const activeFilterCount = useMemo(
    () => (outletFilter ? 1 : 0) + relationshipFilter.length + primaryFilter.length + (debouncedQ ? 1 : 0),
    [outletFilter, relationshipFilter, primaryFilter, debouncedQ],
  )

  const load = async (opts?: { hard?: boolean }) => {
    if (opts?.hard) {
      setDocs([])
      setStats(null)
    }
    setLoading(true)
    setError(null)
    try {
      const qs = new URLSearchParams()
      if (debouncedQ) qs.set('search', debouncedQ)
      if (outletFilter) qs.set('outletId', outletFilter)
      if (relationshipFilter.length === 1) qs.set('relationship', relationshipFilter[0])
      if (primaryFilter.length === 1) qs.set('isPrimary', primaryFilter[0])
      qs.set('page', String(page))
      qs.set('limit', String(limit))
      qs.set('sort', sort)
      const res = await fetch(`/api/customers/emergency-contacts?${qs.toString()}&_t=${Date.now()}`, { cache: 'no-store' })
      const j = await res.json()
      if (!res.ok) throw new Error(j.error || 'Failed to load emergency contacts')
      setDocs(Array.isArray(j.docs) ? j.docs : [])
      setMerchants(Array.isArray(j.merchants) ? j.merchants : [])
      setStats(j.stats || null)
      setPagination(j.pagination || null)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load emergency contacts')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [debouncedQ, outletFilter, relationshipFilter, primaryFilter, sort, page])

  const toggleRelationship = (v: string) => setRelationshipFilter((prev) => (prev.includes(v) ? prev.filter((x) => x !== v) : [...prev, v]))
  const togglePrimary = (v: string) => setPrimaryFilter((prev) => (prev.includes(v) ? prev.filter((x) => x !== v) : [...prev, v]))

  const clearAll = () => {
    setQ('')
    setDebouncedQ('')
    setOutletFilter('')
    setRelationshipFilter([])
    setPrimaryFilter([])
  }

  const filtered = useMemo(() => {
    let arr = [...docs]
    if (relationshipFilter.length > 1) arr = arr.filter((c) => relationshipFilter.includes(c.relationship.toLowerCase()))
    if (primaryFilter.length > 1) arr = arr.filter((c) => primaryFilter.includes(String(c.isPrimary)))
    return arr
  }, [docs, relationshipFilter, primaryFilter])

  const totalPages = Math.max(1, pagination?.totalPages ?? Math.ceil(filtered.length / limit))
  const familyCount = useMemo(() => {
    if (!stats) return 0
    const rb = stats.relationshipBreakdown || {}
    return ['parent', 'spouse', 'sibling', 'child', 'guardian', 'relative'].reduce((s, k) => s + (Number(rb[k]) || 0), 0)
  }, [stats])

  return (
    <div className="space-y-6 py-5 px-2.5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-sm mb-2">
            <Link href="/customers" className="inline-flex items-center gap-2 font-medium text-gray-600 dark:text-[#a1a1aa] hover:text-gray-900 dark:hover:text-white">
              <Users className="w-4 h-4" /> Customers
            </Link>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white tracking-tight flex items-center gap-2">
            <span className="h-8 w-8 rounded-lg bg-[#239459] text-white flex items-center justify-center"><Heart className="w-4 h-4" /></span>
            Emergency Contacts
          </h1>
          <p className="text-sm text-gray-500 dark:text-[#a1a1aa] mt-1">Safety contacts of customers who ordered from your outlets — for delivery emergencies (read-only).</p>
        </div>
        <button
          onClick={() => void load({ hard: true })}
          disabled={loading}
          aria-label="Refresh emergency contacts"
          className="h-9 w-9 inline-flex items-center justify-center bg-white dark:bg-[#171717] border border-gray-200 dark:border-[#262626] rounded-xl hover:bg-gray-50 dark:hover:bg-[#262626] disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 text-gray-600 dark:text-[#a1a1aa] ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {stats ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <KpiCard title="Total Contacts" value={String(stats.filteredTotal)} sub={`${stats.totalContacts} overall`} icon={<Heart className="w-5 h-5 text-white" />} iconBg="bg-[#239459]" />
          <KpiCard title="Primary" value={String(stats.primaryCount)} sub="first to call" icon={<ShieldCheck className="w-5 h-5 text-white" />} iconBg="bg-rose-500" />
          <KpiCard title="Family Ties" value={String(familyCount)} sub="kin relationships" icon={<Users className="w-5 h-5 text-white" />} iconBg="bg-blue-600" />
          <KpiCard title="Customers Covered" value={String(stats.customersCovered)} sub="with contacts" icon={<CheckCircle className="w-5 h-5 text-white" />} iconBg="bg-emerald-500" />
        </div>
      ) : loading ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 animate-pulse">
          {Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-[86px] bg-gray-100 dark:bg-[#171717] rounded-xl border border-gray-200 dark:border-[#262626]" />)}
        </div>
      ) : null}

      <div className="bg-white dark:bg-[#171717] rounded-xl border border-gray-200 dark:border-[#262626] p-3 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, phone, relationship…" className="w-full pl-9 pr-9 py-2.5 text-sm bg-gray-50 dark:bg-[#0a0a0a] border border-gray-200 dark:border-[#262626] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#239459]/20 focus:border-[#239459] text-gray-900 dark:text-white placeholder:text-gray-400" />
            {q && <button onClick={() => setQ('')} className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-full hover:bg-gray-100 dark:hover:bg-[#262626]"><X className="w-4 h-4 text-gray-400" /></button>}
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <select value={sort} onChange={(e) => setSort(e.target.value)} className="px-3 py-2.5 rounded-lg border border-gray-200 dark:border-[#262626] bg-white dark:bg-[#0a0a0a] text-sm text-gray-700 dark:text-white">
              {SORTS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
            <button onClick={() => setShowFilters((v) => !v)} className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold border transition shrink-0 ${activeFilterCount ? 'bg-[#239459] hover:bg-[#215035] text-white border-[#239459]' : 'bg-white dark:bg-[#171717] text-gray-700 dark:text-[#a1a1aa] border-gray-200 dark:border-[#262626]'}`}>
              <SlidersHorizontal className="w-4 h-4" /> Filters {activeFilterCount > 0 && <span className="px-1.5 py-0.5 rounded-full text-xs font-bold bg-white text-[#239459]">{activeFilterCount}</span>} <ChevronDown className={`w-4 h-4 transition ${showFilters ? 'rotate-180' : ''}`} />
            </button>
            {activeFilterCount > 0 && <button onClick={clearAll} className="text-sm font-medium text-gray-500 dark:text-[#a1a1aa] hover:text-gray-900">Clear all</button>}
          </div>
        </div>

        {showFilters && (
          <div className="mt-4 pt-4 border-t border-gray-100 dark:border-[#262626] space-y-4">
            <div>
              <p className="text-xs font-semibold text-gray-700 dark:text-[#a1a1aa] mb-2">Outlet</p>
              <select value={outletFilter} onChange={(e) => setOutletFilter(e.target.value)} className="w-full sm:max-w-xs px-3 py-2.5 rounded-lg border border-gray-200 dark:border-[#262626] bg-white dark:bg-[#0a0a0a] text-sm text-gray-700 dark:text-white">
                <option value="">All your outlets</option>
                {merchants.map((m) => <option key={m.id} value={String(m.id)}>{m.outletName} (#{m.id})</option>)}
              </select>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <FilterPills label="Relationship" options={RELATIONSHIP_OPTS} value={relationshipFilter} onToggle={toggleRelationship} />
              <FilterPills label="Primary" options={[{ value: 'true', label: 'Primary only' }, { value: 'false', label: 'Standard only' }]} value={primaryFilter} onToggle={togglePrimary} />
            </div>
            <div className="flex justify-end"><button onClick={() => setShowFilters(false)} className="text-xs font-semibold text-[#239459]">Done</button></div>
          </div>
        )}

        {activeFilterCount > 0 && !showFilters && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {debouncedQ && <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-[#239459]/10 dark:bg-[#239459]/15 text-[#8a5f17] dark:text-[#239459] rounded-full text-xs font-medium border border-[#239459]/30">Search: “{debouncedQ}” <button onClick={() => setQ('')}><X className="w-3 h-3" /></button></span>}
            {outletFilter && <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-gray-100 dark:bg-[#262626] text-gray-700 dark:text-[#a1a1aa] rounded-full text-xs font-medium">{merchants.find((m) => String(m.id) === outletFilter)?.outletName || `Outlet #${outletFilter}`} <button onClick={() => setOutletFilter('')}><X className="w-3 h-3" /></button></span>}
            {relationshipFilter.map((v) => <span key={v} className="inline-flex items-center gap-1 px-2.5 py-1 bg-gray-100 dark:bg-[#262626] text-gray-700 dark:text-[#a1a1aa] rounded-full text-xs font-medium capitalize">{v} <button onClick={() => toggleRelationship(v)}><X className="w-3 h-3" /></button></span>)}
            {primaryFilter.map((v) => <span key={v} className="inline-flex items-center gap-1 px-2.5 py-1 bg-gray-100 dark:bg-[#262626] text-gray-700 dark:text-[#a1a1aa] rounded-full text-xs font-medium">{v === 'true' ? 'Primary only' : 'Standard only'} <button onClick={() => togglePrimary(v)}><X className="w-3 h-3" /></button></span>)}
          </div>
        )}
      </div>

      <div className="bg-white dark:bg-[#171717] rounded-xl border border-gray-200 dark:border-[#262626] shadow-sm overflow-hidden">
        {error ? (
          <div className="flex flex-col items-center justify-center py-16 px-6">
            <div className="h-14 w-14 bg-red-50 dark:bg-red-900/20 rounded-full flex items-center justify-center mb-4"><AlertCircle className="h-7 w-7 text-red-500" /></div>
            <h3 className="font-semibold text-gray-900 dark:text-white">Failed to load emergency contacts</h3>
            <p className="text-sm text-gray-500 mt-1 mb-4">{error}</p>
            <button onClick={() => void load({ hard: true })} className="inline-flex items-center px-4 py-2 bg-[#239459] text-white rounded-lg text-sm font-medium"><RefreshCw className="h-4 w-4 mr-2" />Retry</button>
          </div>
        ) : loading && docs.length === 0 ? (
          <div className="p-4 space-y-3 animate-pulse">
            {Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-16 bg-gray-100 dark:bg-[#0a0a0a] rounded-lg" />)}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
            <div className="h-16 w-16 bg-[#239459]/10 dark:bg-[#239459]/15 rounded-2xl flex items-center justify-center mb-4"><Heart className="w-8 h-8 text-[#239459]" /></div>
            <h3 className="font-semibold text-gray-900 dark:text-white">No emergency contacts found</h3>
            <p className="text-sm text-gray-500 dark:text-[#a1a1aa] mt-1 max-w-md">Contacts appear here once your customers save them in the storefront app. Try adjusting search or filters.</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 dark:bg-[#0a0a0a] text-xs text-gray-500 dark:text-[#a1a1aa] border-b border-gray-200 dark:border-[#262626]">
                  <tr>
                    <th className="text-left px-4 py-3 font-medium">Contact</th>
                    <th className="text-left px-4 py-3 font-medium hidden lg:table-cell">Customer</th>
                    <th className="text-left px-4 py-3 font-medium">Relationship</th>
                    <th className="text-left px-4 py-3 font-medium">Phone</th>
                    <th className="text-left px-4 py-3 font-medium">Primary</th>
                    <th className="text-left px-4 py-3 font-medium hidden md:table-cell">Added</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-[#262626]">
                  {filtered.map((c) => (
                    <tr key={c.id} className="hover:bg-gray-50 dark:hover:bg-[#0a0a0a]/50 transition">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3 min-w-[180px]">
                          <div className={`h-9 w-9 rounded-xl flex items-center justify-center text-xs font-bold shrink-0 ${c.isPrimary ? 'bg-gradient-to-br from-rose-500 to-pink-600 text-white' : 'bg-gradient-to-br from-[#239459] to-[#215035] text-white'}`}>
                            {initials(c.firstName, c.lastName)}
                          </div>
                          <div className="min-w-0">
                            <div className="font-semibold text-gray-900 dark:text-white truncate max-w-[180px] flex items-center gap-1">
                              {fullName(c)}
                              {c.isPrimary && <Heart className="w-3 h-3 text-rose-500 shrink-0" />}
                            </div>
                            <div className="text-[11px] text-gray-400">#{c.id} • {c.ordersCount} order{c.ordersCount === 1 ? '' : 's'}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 hidden lg:table-cell">
                        <div className="font-medium text-sm text-gray-900 dark:text-white truncate max-w-[160px]">{customerLabel(c.customer)}</div>
                        <div className="text-xs text-gray-500 dark:text-[#a1a1aa] truncate max-w-[160px]">{c.customer?.email || '—'}</div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex px-2 py-1 rounded-full text-xs font-medium border capitalize ${relationshipBadge(c.relationship)}`}>{c.relationship}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center gap-1 font-mono text-xs text-gray-900 dark:text-white"><Phone className="w-3 h-3 text-gray-400 shrink-0" />{c.contactNumber || '—'}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold border ${c.isPrimary ? 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-900/20 dark:text-rose-300 dark:border-rose-800' : 'bg-zinc-100 text-zinc-600 border-zinc-200 dark:bg-zinc-800 dark:text-zinc-400'}`}>
                          <span className={`h-2 w-2 rounded-full ${c.isPrimary ? 'bg-rose-500' : 'bg-zinc-400'}`} /> {c.isPrimary ? 'Primary' : 'Standard'}
                        </span>
                      </td>
                      <td className="px-4 py-3 hidden md:table-cell text-xs text-gray-500 dark:text-[#a1a1aa]">{fmtDate(c.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {pagination && pagination.totalDocs > 0 && !loading && (
              <div className="px-4 py-3 border-t border-gray-200 dark:border-[#262626] flex flex-col sm:flex-row items-center justify-between gap-3 text-sm">
                <div className="text-gray-600 dark:text-[#a1a1aa]">Page {pagination.page} of {pagination.totalPages} • {pagination.totalDocs} contacts • 10 per page</div>
                <div className="flex items-center gap-1">
                  <button disabled={loading || !pagination.hasPrevPage} onClick={() => setPage((p) => Math.max(1, p - 1))} className="px-3 py-1.5 rounded-lg border border-gray-200 dark:border-[#262626] bg-white dark:bg-[#0a0a0a] disabled:opacity-50 text-sm">Prev</button>
                  {Array.from({ length: Math.min(5, pagination.totalPages) }).map((_, i) => {
                    const n = Math.max(1, Math.min(pagination.totalPages - 4, pagination.page - 2)) + i
                    if (n > pagination.totalPages) return null
                    return <button key={n} onClick={() => setPage(n)} className={`h-8 w-8 rounded-lg text-sm font-medium border ${n === pagination.page ? 'bg-[#239459] text-white border-[#239459]' : 'bg-white dark:bg-[#0a0a0a] border-gray-200 dark:border-[#262626] text-gray-700 dark:text-white'}`}>{n}</button>
                  })}
                  <button disabled={loading || !pagination.hasNextPage} onClick={() => setPage((p) => p + 1)} className="px-3 py-1.5 rounded-lg border border-gray-200 dark:border-[#262626] bg-white dark:bg-[#0a0a0a] disabled:opacity-50 text-sm">Next</button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      <div className="rounded-xl border border-gray-200 dark:border-[#262626] bg-white dark:bg-[#171717] p-4 text-xs text-gray-500 dark:text-[#a1a1aa]">
        Only safety contacts of customers who ordered from your outlets are listed — for delivery emergencies only (e.g. unreachable customer, failed drop-off). This page is read-only and never shows contact home addresses. Please handle these numbers responsibly.
      </div>
    </div>
  )
}

export default function EmergencyContactsPage() {
  return (
    <ClientOnly fallback={<ContactsSkeleton />}>
      <ContactsContent />
    </ClientOnly>
  )
}
