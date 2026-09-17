'use client'

import React, { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { ClientOnly } from '@/components/ClientOnly'
import {
  Tag, Search, X, SlidersHorizontal, ChevronDown, RefreshCw, AlertCircle,
  CheckCircle, XCircle, Calendar, Palette, Layers, Hash
} from '@/components/ui/IconWrapper'

type AttributeBrief = { id: number; name: string; slug: string; type: string }

type AttributeTermDoc = {
  id: number
  attribute_id: number | null
  attribute: AttributeBrief | null
  name: string
  slug: string
  value: string | null
  sort_order: number
  is_active: boolean
  createdAt: string
  updatedAt: string
}

type Stats = {
  total: number
  active: number
  inactive: number
  filteredTotal: number
  byAttribute: { attribute_id: number; name: string; type: string; count: number }[]
}

type Pagination = { page: number; totalDocs: number; totalPages: number; hasNextPage: boolean; hasPrevPage: boolean }

const SORTS: { value: string; label: string }[] = [
  { value: '-createdAt', label: 'Newest first' },
  { value: 'createdAt', label: 'Oldest first' },
  { value: 'name', label: 'Name A–Z' },
  { value: '-name', label: 'Name Z–A' },
  { value: 'sort_order', label: 'Sort order' },
]

function typeBadge(type: string) {
  const t = type.toLowerCase()
  if (t === 'color') return 'bg-pink-50 text-pink-700 border-pink-200 dark:bg-pink-900/20 dark:text-pink-300 dark:border-pink-800'
  if (t === 'button') return 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/20 dark:text-blue-300 dark:border-blue-800'
  if (t === 'radio') return 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-900/20 dark:text-purple-300 dark:border-purple-800'
  return 'bg-gray-100 text-gray-700 border-gray-200 dark:bg-zinc-800 dark:text-zinc-300 dark:border-zinc-700'
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

function TermsSkeleton() {
  return (
    <div className="space-y-6 py-5 px-2.5">
      <div className="h-8 w-56 bg-gray-200 dark:bg-[#262626] rounded animate-pulse" />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 animate-pulse">
        {Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-[86px] bg-gray-100 dark:bg-[#171717] rounded-xl border border-gray-200 dark:border-[#262626]" />)}
      </div>
      <div className="h-16 bg-gray-100 dark:bg-[#171717] rounded-xl animate-pulse" />
    </div>
  )
}

function TermsContent() {
  const [q, setQ] = useState('')
  const [debouncedQ, setDebouncedQ] = useState('')
  const [attrFilter, setAttrFilter] = useState<number | null>(null)
  const [activeFilter, setActiveFilter] = useState<string[]>([])
  const [sort, setSort] = useState('-createdAt')
  const [showFilters, setShowFilters] = useState(false)
  const [page, setPage] = useState(1)
  const limit = 10

  const [docs, setDocs] = useState<AttributeTermDoc[]>([])
  const [stats, setStats] = useState<Stats | null>(null)
  const [attributes, setAttributes] = useState<AttributeBrief[]>([])
  const [pagination, setPagination] = useState<Pagination | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const id = setTimeout(() => setDebouncedQ(q.trim()), 400)
    return () => clearTimeout(id)
  }, [q])

  useEffect(() => {
    setPage(1)
  }, [debouncedQ, attrFilter, activeFilter, sort])

  const activeFilterCount = useMemo(() => (attrFilter != null ? 1 : 0) + activeFilter.length + (debouncedQ ? 1 : 0), [attrFilter, activeFilter, debouncedQ])

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
      if (attrFilter != null) qs.set('attribute_id', String(attrFilter))
      if (activeFilter.length === 1) qs.set('is_active', activeFilter[0])
      qs.set('page', String(page))
      qs.set('limit', String(limit))
      qs.set('sort', sort)
      const res = await fetch(`/api/catalog/attribute-terms?${qs.toString()}&_t=${Date.now()}`, { cache: 'no-store' })
      const j = await res.json()
      if (!res.ok) throw new Error(j.error || 'Failed to load attribute terms')
      setDocs(Array.isArray(j.docs) ? j.docs : [])
      setStats(j.stats || null)
      setAttributes(Array.isArray(j.attributes) ? j.attributes : [])
      setPagination(j.pagination || null)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load attribute terms')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [debouncedQ, attrFilter, activeFilter, sort, page])

  const toggleActive = (v: string) => setActiveFilter((prev) => (prev.includes(v) ? prev.filter((x) => x !== v) : [...prev, v]))
  const clearAll = () => {
    setQ('')
    setDebouncedQ('')
    setAttrFilter(null)
    setActiveFilter([])
  }

  const filtered = useMemo(() => {
    let arr = [...docs]
    if (activeFilter.length > 1) arr = arr.filter((t) => activeFilter.includes(String(t.is_active)))
    if (sort === 'name') arr.sort((a, b) => a.name.localeCompare(b.name))
    else if (sort === '-name') arr.sort((a, b) => b.name.localeCompare(a.name))
    else if (sort === 'sort_order') arr.sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0))
    return arr
  }, [docs, activeFilter, sort])

  const totalPages = Math.max(1, pagination?.totalPages ?? Math.ceil(filtered.length / limit))

  return (
    <div className="space-y-6 py-5 px-2.5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white tracking-tight flex items-center gap-2">
            <span className="h-8 w-8 rounded-lg bg-[#239459] text-white flex items-center justify-center"><Layers className="w-4 h-4" /></span>
            Attribute Terms
          </h1>
          <p className="text-sm text-gray-500 dark:text-[#a1a1aa] mt-1">Values under each shared attribute used by your product variations — managed by the platform (read-only).</p>
        </div>
        <button
          onClick={() => void load({ hard: true })}
          disabled={loading}
          aria-label="Refresh attribute terms"
          className="h-9 w-9 inline-flex items-center justify-center bg-white dark:bg-[#171717] border border-gray-200 dark:border-[#262626] rounded-xl hover:bg-gray-50 dark:hover:bg-[#262626] disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 text-gray-600 dark:text-[#a1a1aa] ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {stats ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <KpiCard title="Terms" value={String(stats.total)} sub={`${stats.filteredTotal} matching filters`} icon={<Tag className="w-5 h-5 text-white" />} iconBg="bg-[#239459]" />
          <KpiCard title="Active" value={String(stats.active)} sub="available in variations" icon={<CheckCircle className="w-5 h-5 text-white" />} iconBg="bg-emerald-500" />
          <KpiCard title="Inactive" value={String(stats.inactive)} sub="hidden terms" icon={<XCircle className="w-5 h-5 text-white" />} iconBg="bg-zinc-600" />
          <KpiCard title="Top Attribute" value={stats.byAttribute[0] ? `${stats.byAttribute[0].count} terms` : '—'} sub={stats.byAttribute[0]?.name || stats.byAttribute.map((p) => `${p.name}:${p.count}`).join(' • ') || 'no breakdown'} icon={<Palette className="w-5 h-5 text-white" />} iconBg="bg-blue-600" />
        </div>
      ) : loading ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 animate-pulse">
          {Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-[86px] bg-gray-100 dark:bg-[#171717] rounded-xl border border-gray-200 dark:border-[#262626]" />)}
        </div>
      ) : null}

      <div className="bg-white dark:bg-[#171717] rounded-xl border border-gray-200 dark:border-[#262626] p-3 shadow-sm">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, slug, value…" className="w-full pl-9 pr-9 py-2.5 text-sm bg-gray-50 dark:bg-[#0a0a0a] border border-gray-200 dark:border-[#262626] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#239459]/20 focus:border-[#239459] text-gray-900 dark:text-white placeholder:text-gray-400" />
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
              <p className="text-xs font-semibold text-gray-700 dark:text-[#a1a1aa] mb-2">Attribute</p>
              <select value={attrFilter ?? ''} onChange={(e) => setAttrFilter(e.target.value ? Number(e.target.value) : null)} className="px-3 py-2 rounded-lg border border-gray-200 dark:border-[#262626] bg-white dark:bg-[#0a0a0a] text-sm text-gray-700 dark:text-white">
                <option value="">All attributes</option>
                {attributes.map((a) => <option key={a.id} value={String(a.id)}>{a.name} ({a.slug})</option>)}
              </select>
            </div>
            <div>
              <p className="text-xs font-semibold text-gray-700 dark:text-[#a1a1aa] mb-2">Status</p>
              <div className="flex flex-wrap gap-1.5">
                {[{ value: 'true', label: 'Active' }, { value: 'false', label: 'Inactive' }].map((opt) => {
                  const active = activeFilter.includes(opt.value)
                  return (
                    <button key={opt.value} onClick={() => toggleActive(opt.value)} className={`px-2.5 py-1 rounded-full text-xs font-medium border transition capitalize ${active ? 'bg-[#239459] text-white border-[#239459]' : 'bg-white dark:bg-[#0a0a0a] text-gray-700 dark:text-[#a1a1aa] border-gray-200 dark:border-[#262626]'}`}>{opt.label}</button>
                  )
                })}
              </div>
            </div>
            <div className="flex justify-end"><button onClick={() => setShowFilters(false)} className="text-xs font-semibold text-[#239459]">Done</button></div>
          </div>
        )}

        {activeFilterCount > 0 && !showFilters && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {debouncedQ && <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-[#239459]/10 dark:bg-[#239459]/15 text-[#8a5f17] dark:text-[#239459] rounded-full text-xs font-medium border border-[#239459]/30">Search: “{debouncedQ}” <button onClick={() => setQ('')}><X className="w-3 h-3" /></button></span>}
            {attrFilter != null && <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-gray-100 dark:bg-[#262626] text-gray-700 dark:text-[#a1a1aa] rounded-full text-xs font-medium">{attributes.find((a) => a.id === attrFilter)?.name || `Attribute #${attrFilter}`} <button onClick={() => setAttrFilter(null)}><X className="w-3 h-3" /></button></span>}
            {activeFilter.map((v) => <span key={v} className="inline-flex items-center gap-1 px-2.5 py-1 bg-gray-100 dark:bg-[#262626] text-gray-700 dark:text-[#a1a1aa] rounded-full text-xs font-medium">{v === 'true' ? 'Active only' : 'Inactive only'} <button onClick={() => toggleActive(v)}><X className="w-3 h-3" /></button></span>)}
          </div>
        )}
      </div>

      <div className="bg-white dark:bg-[#171717] rounded-xl border border-gray-200 dark:border-[#262626] shadow-sm overflow-hidden">
        {error ? (
          <div className="flex flex-col items-center justify-center py-16 px-6">
            <div className="h-14 w-14 bg-red-50 dark:bg-red-900/20 rounded-full flex items-center justify-center mb-4"><AlertCircle className="h-7 w-7 text-red-500" /></div>
            <h3 className="font-semibold text-gray-900 dark:text-white">Failed to load attribute terms</h3>
            <p className="text-sm text-gray-500 mt-1 mb-4">{error}</p>
            <button onClick={() => void load({ hard: true })} className="inline-flex items-center px-4 py-2 bg-[#239459] text-white rounded-lg text-sm font-medium"><RefreshCw className="h-4 w-4 mr-2" />Retry</button>
          </div>
        ) : loading && docs.length === 0 ? (
          <div className="p-4 space-y-3 animate-pulse">
            {Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-16 bg-gray-100 dark:bg-[#0a0a0a] rounded-lg" />)}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
            <div className="h-14 w-14 bg-[#239459]/10 dark:bg-[#239459]/15 rounded-full flex items-center justify-center mb-4"><Tag className="w-7 h-7 text-[#239459]" /></div>
            <h3 className="font-semibold text-gray-900 dark:text-white">No terms found</h3>
            <p className="text-sm text-gray-500 dark:text-[#a1a1aa] mt-1 max-w-md">No attribute terms match your filters.</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 dark:bg-[#0a0a0a] text-xs text-gray-500 dark:text-[#a1a1aa] border-b border-gray-200 dark:border-[#262626]">
                  <tr>
                    <th className="text-left px-4 py-3 font-medium">Term</th>
                    <th className="text-left px-4 py-3 font-medium">Attribute</th>
                    <th className="text-left px-4 py-3 font-medium hidden sm:table-cell">Slug</th>
                    <th className="text-left px-4 py-3 font-medium">Value</th>
                    <th className="text-left px-4 py-3 font-medium hidden lg:table-cell">Sort</th>
                    <th className="text-left px-4 py-3 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-[#262626]">
                  {filtered.map((t) => {
                    const isHex = t.value ? /^#[0-9A-Fa-f]{6}$/.test(t.value) : false
                    return (
                      <tr key={t.id} className="hover:bg-gray-50 dark:hover:bg-[#0a0a0a]/50 transition">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3 min-w-[160px]">
                            <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-[#239459] to-[#215035] text-white flex items-center justify-center text-xs font-bold shrink-0"><Tag className="w-4 h-4" /></div>
                            <div className="min-w-0">
                              <div className="font-semibold text-gray-900 dark:text-white truncate max-w-[180px]">{t.name}</div>
                              <div className="text-[11px] text-gray-400 flex items-center gap-1 mt-0.5"><Calendar className="w-3 h-3" /> {fmtDate(t.createdAt)}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          {t.attribute ? (
                            <div className="min-w-[120px]">
                              <div className="text-xs font-medium text-gray-900 dark:text-white truncate max-w-[140px]">{t.attribute.name}</div>
                              <div className="text-[11px] text-gray-500 font-mono">{t.attribute.slug}</div>
                              <span className={`inline-flex mt-1 px-1.5 py-0.5 rounded-full text-[11px] font-medium border capitalize ${typeBadge(t.attribute.type)}`}>{t.attribute.type}</span>
                            </div>
                          ) : (
                            <span className="text-xs text-gray-500 font-mono">#{t.attribute_id ?? '—'}</span>
                          )}
                        </td>
                        <td className="px-4 py-3 hidden sm:table-cell"><span className="font-mono text-xs text-gray-700 dark:text-[#a1a1aa]">{t.slug}</span></td>
                        <td className="px-4 py-3">
                          {t.value ? (
                            isHex ? (
                              <span className="inline-flex items-center gap-2 text-xs text-gray-700 dark:text-[#a1a1aa]">
                                <span className="h-5 w-5 rounded-md border border-gray-200 dark:border-[#333]" style={{ backgroundColor: t.value }} />
                                <span className="font-mono">{t.value}</span>
                              </span>
                            ) : (
                              <span className="font-mono text-xs text-gray-700 dark:text-[#a1a1aa]">{t.value}</span>
                            )
                          ) : (
                            <span className="text-xs text-gray-400">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3 hidden lg:table-cell text-xs text-gray-500 dark:text-[#a1a1aa]">{t.sort_order}</td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold border ${t.is_active ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-300' : 'bg-red-50 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-300'}`}>
                            {t.is_active ? <CheckCircle className="w-3 h-3" /> : <XCircle className="w-3 h-3" />} {t.is_active ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {filtered.length > 0 && (
              <div className="px-4 py-3 border-t border-gray-200 dark:border-[#262626] flex flex-col sm:flex-row items-center justify-between gap-3 text-sm">
                <div className="text-gray-600 dark:text-[#a1a1aa]">Page {page} of {totalPages} • {pagination?.totalDocs ?? filtered.length} terms • 10 per page</div>
                <div className="flex items-center gap-1">
                  <button disabled={loading || page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))} className="px-3 py-1.5 rounded-lg border border-gray-200 dark:border-[#262626] bg-white dark:bg-[#0a0a0a] disabled:opacity-50 text-sm">Prev</button>
                  {Array.from({ length: Math.min(5, totalPages) }).map((_, i) => {
                    const n = Math.max(1, Math.min(totalPages - 4, page - 2)) + i
                    if (n > totalPages) return null
                    return <button key={n} onClick={() => setPage(n)} className={`h-8 w-8 rounded-lg text-sm font-medium border ${n === page ? 'bg-[#239459] text-white border-[#239459]' : 'bg-white dark:bg-[#0a0a0a] border-gray-200 dark:border-[#262626] text-gray-700 dark:text-white'}`}>{n}</button>
                  })}
                  <button disabled={loading || page >= totalPages} onClick={() => setPage((p) => p + 1)} className="px-3 py-1.5 rounded-lg border border-gray-200 dark:border-[#262626] bg-white dark:bg-[#0a0a0a] disabled:opacity-50 text-sm">Next</button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      <div className="rounded-xl border border-gray-200 dark:border-[#262626] bg-white dark:bg-[#171717] p-4 text-xs text-gray-500 dark:text-[#a1a1aa]">
        Terms are grouped under platform-managed <Link href="/catalog/attributes" className="font-semibold text-[#239459] hover:text-[#215035]">Attributes</Link> and appear on your <Link href="/catalog/variations" className="font-semibold text-[#239459] hover:text-[#215035]">Variations</Link>.
      </div>
    </div>
  )
}

export default function CatalogAttributeTermsPage() {
  return (
    <ClientOnly fallback={<TermsSkeleton />}>
      <TermsContent />
    </ClientOnly>
  )
}