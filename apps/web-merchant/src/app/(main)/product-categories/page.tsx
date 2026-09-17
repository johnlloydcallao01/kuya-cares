'use client'

import React, { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { ClientOnly } from '@/components/ClientOnly'
import {
  Tag, Hash, Sparkles, Search, X, SlidersHorizontal, ChevronDown, RefreshCw, AlertCircle, Package, CheckCircle, Folder, Store
} from '@/components/ui/IconWrapper'

type CategoryDoc = {
  id: number
  name: string
  slug: string
  description: string | null
  parentCategory: { id: number; name: string; slug: string; categoryPath: string | null } | null
  categoryLevel: number | null
  categoryPath: string | null
  displayOrder: number
  isActive: boolean
  isFeatured: boolean
  media: { icon: { id: number; url: string | null } | null; bannerImage: { id: number; url: string | null } | null; thumbnailImage: { id: number; url: string | null } | null }
  attributes: { categoryType: string | null; dietaryTags: string[] | null; ageRestriction: string | null; requiresPrescription: boolean }
  seo: { metaTitle: string | null; metaDescription: string | null; keywords: string[] | null; canonicalUrl: string | null }
  productCount: number
  createdAt: string
  updatedAt: string
}

type Pagination = { page: number; totalDocs: number; totalPages: number; hasNextPage: boolean; hasPrevPage: boolean }

type Stats = {
  total: number
  activeCount: number
  featuredCount: number
  inactiveCount: number
  topLevelCount: number
  filteredCount: number
  levelBreakdown: Record<string, number>
  categoryTypeBreakdown: Record<string, number>
  totalProducts: number
}

const CATEGORY_TYPE_OPTS: { value: string; label: string }[] = [
  { value: '', label: 'All types' },
  { value: 'food', label: 'Food' },
  { value: 'beverages', label: 'Beverages' },
  { value: 'desserts', label: 'Desserts' },
  { value: 'snacks', label: 'Snacks' },
  { value: 'groceries', label: 'Groceries' },
  { value: 'pharmacy', label: 'Pharmacy' },
  { value: 'personal_care', label: 'Personal Care' },
  { value: 'household', label: 'Household' },
  { value: 'other', label: 'Other' },
]
const LEVEL_OPTS = ['', '1', '2', '3', '4', '5'].map((l) => ({ value: l, label: l ? `Level ${l}` : 'All levels' }))

const SORTS: { value: string; label: string }[] = [
  { value: 'name', label: 'Name A–Z' },
  { value: '-name', label: 'Name Z–A' },
  { value: 'categoryLevel', label: 'Level low→high' },
  { value: '-categoryLevel', label: 'Level high→low' },
  { value: '-createdAt', label: 'Newest first' },
  { value: 'createdAt', label: 'Oldest first' },
]

function fmtDate(iso: string | null) {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleDateString('en-PH', { timeZone: 'Asia/Manila', year: 'numeric', month: 'short', day: 'numeric' })
  } catch {
    return String(iso).slice(0, 10)
  }
}
function typeBadge(pt: string | null) {
  const t = (pt || 'other').toLowerCase()
  if (t === 'food') return 'bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-900/20 dark:text-orange-300'
  if (t === 'beverages') return 'bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-900/20 dark:text-sky-300'
  if (t === 'desserts') return 'bg-pink-50 text-pink-700 border-pink-200 dark:bg-pink-900/20 dark:text-pink-300'
  if (t === 'snacks') return 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-300'
  if (t === 'groceries') return 'bg-lime-50 text-lime-700 border-lime-200 dark:bg-lime-900/20 dark:text-lime-300'
  if (t === 'pharmacy') return 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-300'
  if (t === 'personal_care') return 'bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-900/20 dark:text-violet-300'
  if (t === 'household') return 'bg-teal-50 text-teal-700 border-teal-200 dark:bg-teal-900/20 dark:text-teal-300'
  return 'bg-gray-100 text-gray-600 border-gray-200 dark:bg-zinc-800 dark:text-zinc-400'
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

function CategoriesSkeleton() {
  return (
    <div className="space-y-6 py-5 px-2.5">
      <div className="h-8 w-48 bg-gray-200 dark:bg-[#262626] rounded animate-pulse" />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 animate-pulse">
        {Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-[86px] bg-gray-100 dark:bg-[#171717] rounded-xl border border-gray-200 dark:border-[#262626]" />)}
      </div>
      <div className="h-16 bg-gray-100 dark:bg-[#171717] rounded-xl animate-pulse" />
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
              className={`px-2.5 py-1 rounded-full text-xs font-medium border transition capitalize ${active ? 'bg-[#eba236] text-white border-[#eba236]' : 'bg-white dark:bg-[#0a0a0a] text-gray-700 dark:text-[#a1a1aa] border-gray-200 dark:border-[#262626]'}`}
            >
              {opt.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}

function CategoriesContent() {
  const [q, setQ] = useState('')
  const [debouncedQ, setDebouncedQ] = useState('')
  const [activeFilter, setActiveFilter] = useState<string[]>([])
  const [featuredFilter, setFeaturedFilter] = useState<string[]>([])
  const [typeFilter, setTypeFilter] = useState('')
  const [levelFilter, setLevelFilter] = useState('')
  const [sort, setSort] = useState('name')
  const [showFilters, setShowFilters] = useState(false)
  const [page, setPage] = useState(1)
  const limit = 10

  const [docs, setDocs] = useState<CategoryDoc[]>([])
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
  }, [debouncedQ, activeFilter, featuredFilter, typeFilter, levelFilter, sort])

  const activeFilterCount = useMemo(
    () => activeFilter.length + featuredFilter.length + (typeFilter ? 1 : 0) + (levelFilter ? 1 : 0) + (debouncedQ ? 1 : 0),
    [activeFilter, featuredFilter, typeFilter, levelFilter, debouncedQ],
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
      if (activeFilter.length === 1) qs.set('isActive', activeFilter[0])
      if (featuredFilter.length === 1) qs.set('isFeatured', featuredFilter[0])
      if (typeFilter) qs.set('categoryType', typeFilter)
      if (levelFilter) qs.set('categoryLevel', levelFilter)
      qs.set('page', String(page))
      qs.set('limit', String(limit))
      qs.set('sort', sort)
      const res = await fetch(`/api/product-categories?${qs.toString()}&_t=${Date.now()}`, { cache: 'no-store' })
      const j = await res.json()
      if (!res.ok) throw new Error(j.error || 'Failed to load product categories')
      setDocs(Array.isArray(j.docs) ? j.docs : [])
      setStats(j.stats || null)
      setPagination(j.pagination || null)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load product categories')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [debouncedQ, activeFilter, featuredFilter, typeFilter, levelFilter, sort, page])

  const toggleFilter = (setter: React.Dispatch<React.SetStateAction<string[]>>) => (v: string) =>
    setter((prev) => (prev.includes(v) ? prev.filter((x) => x !== v) : [...prev, v]))

  const toggleActive = toggleFilter(setActiveFilter)
  const toggleFeatured = toggleFilter(setFeaturedFilter)

  const clearAll = () => {
    setQ('')
    setDebouncedQ('')
    setActiveFilter([])
    setFeaturedFilter([])
    setTypeFilter('')
    setLevelFilter('')
  }

  const filtered = useMemo(() => {
    let arr = [...docs]
    if (activeFilter.length > 1) arr = arr.filter((c) => activeFilter.includes(String(c.isActive)))
    if (featuredFilter.length > 1) arr = arr.filter((c) => featuredFilter.includes(String(c.isFeatured)))
    return arr
  }, [docs, activeFilter, featuredFilter])

  const totalPages = Math.max(1, pagination?.totalPages ?? Math.ceil(filtered.length / limit))

  return (
    <div className="space-y-6 py-5 px-2.5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white tracking-tight flex items-center gap-2">
            <span className="h-8 w-8 rounded-lg bg-[#eba236] text-white flex items-center justify-center"><Tag className="w-4 h-4" /></span>
            Product Categories
          </h1>
          <p className="text-sm text-gray-500 dark:text-[#a1a1aa] mt-1">The global food-delivery taxonomy that organizes products for browsing. Counts below are scoped to your products (read-only).</p>
        </div>
        <button
          onClick={() => void load({ hard: true })}
          disabled={loading}
          aria-label="Refresh categories"
          className="h-9 w-9 inline-flex items-center justify-center bg-white dark:bg-[#171717] border border-gray-200 dark:border-[#262626] rounded-xl hover:bg-gray-50 dark:hover:bg-[#262626] disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 text-gray-600 dark:text-[#a1a1aa] ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {stats ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <KpiCard title="Total Categories" value={String(stats.filteredCount)} sub={`${stats.topLevelCount} top-level`} icon={<Tag className="w-5 h-5 text-white" />} iconBg="bg-[#eba236]" />
          <KpiCard title="Active" value={String(stats.activeCount)} sub={`${stats.inactiveCount} inactive`} icon={<CheckCircle className="w-5 h-5 text-white" />} iconBg="bg-emerald-500" />
          <KpiCard title="Featured" value={String(stats.featuredCount)} sub="on home page" icon={<Sparkles className="w-5 h-5 text-white" />} iconBg="bg-amber-500" />
          <KpiCard title="Your Products" value={String(stats.totalProducts)} sub="across your catalogs" icon={<Store className="w-5 h-5 text-white" />} iconBg="bg-sky-600" />
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
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search categories…" className="w-full pl-9 pr-9 py-2.5 text-sm bg-gray-50 dark:bg-[#0a0a0a] border border-gray-200 dark:border-[#262626] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#eba236]/20 focus:border-[#eba236] text-gray-900 dark:text-white placeholder:text-gray-400" />
            {q && <button onClick={() => setQ('')} className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-full hover:bg-gray-100 dark:hover:bg-[#262626]"><X className="w-4 h-4 text-gray-400" /></button>}
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <select value={sort} onChange={(e) => setSort(e.target.value)} className="px-3 py-2.5 rounded-lg border border-gray-200 dark:border-[#262626] bg-white dark:bg-[#0a0a0a] text-sm text-gray-700 dark:text-white">
              {SORTS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
            <button onClick={() => setShowFilters((v) => !v)} className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold border transition shrink-0 ${activeFilterCount ? 'bg-[#eba236] hover:bg-[#c88a20] text-white border-[#eba236]' : 'bg-white dark:bg-[#171717] text-gray-700 dark:text-[#a1a1aa] border-gray-200 dark:border-[#262626]'}`}>
              <SlidersHorizontal className="w-4 h-4" /> Filters {activeFilterCount > 0 && <span className="px-1.5 py-0.5 rounded-full text-xs font-bold bg-white text-[#eba236]">{activeFilterCount}</span>} <ChevronDown className={`w-4 h-4 transition ${showFilters ? 'rotate-180' : ''}`} />
            </button>
            {activeFilterCount > 0 && <button onClick={clearAll} className="text-sm font-medium text-gray-500 dark:text-[#a1a1aa] hover:text-gray-900">Clear all</button>}
          </div>
        </div>

        {showFilters && (
          <div className="mt-4 pt-4 border-t border-gray-100 dark:border-[#262626] space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div>
                <p className="text-xs font-semibold text-gray-700 dark:text-[#a1a1aa] mb-2">Category Type</p>
                <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} className="w-full px-3 py-2.5 rounded-lg border border-gray-200 dark:border-[#262626] bg-white dark:bg-[#0a0a0a] text-sm text-gray-700 dark:text-white">
                  {CATEGORY_TYPE_OPTS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
              <div>
                <p className="text-xs font-semibold text-gray-700 dark:text-[#a1a1aa] mb-2">Level</p>
                <select value={levelFilter} onChange={(e) => setLevelFilter(e.target.value)} className="w-full px-3 py-2.5 rounded-lg border border-gray-200 dark:border-[#262626] bg-white dark:bg-[#0a0a0a] text-sm text-gray-700 dark:text-white">
                  {LEVEL_OPTS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <FilterPills label="Status" options={[{ value: 'true', label: 'Active' }, { value: 'false', label: 'Inactive' }]} value={activeFilter} onToggle={toggleActive} />
              <FilterPills label="Featured" options={[{ value: 'true', label: 'Featured' }, { value: 'false', label: 'Not featured' }]} value={featuredFilter} onToggle={toggleFeatured} />
            </div>
            <div className="flex justify-end"><button onClick={() => setShowFilters(false)} className="text-xs font-semibold text-[#eba236]">Done</button></div>
          </div>
        )}

        {activeFilterCount > 0 && !showFilters && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {debouncedQ && <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-[#eba236]/10 dark:bg-[#eba236]/15 text-[#8a5f17] dark:text-[#eba236] rounded-full text-xs font-medium border border-[#eba236]/30">Search: “{debouncedQ}” <button onClick={() => setQ('')}><X className="w-3 h-3" /></button></span>}
            {typeFilter && <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-gray-100 dark:bg-[#262626] text-gray-700 dark:text-[#a1a1aa] rounded-full text-xs font-medium capitalize">type: {typeFilter.replace('_', ' ')} <button onClick={() => setTypeFilter('')}><X className="w-3 h-3" /></button></span>}
            {levelFilter && <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-gray-100 dark:bg-[#262626] text-gray-700 dark:text-[#a1a1aa] rounded-full text-xs font-medium">level {levelFilter} <button onClick={() => setLevelFilter('')}><X className="w-3 h-3" /></button></span>}
            {activeFilter.map((v) => <span key={v} className="inline-flex items-center gap-1 px-2.5 py-1 bg-gray-100 dark:bg-[#262626] text-gray-700 dark:text-[#a1a1aa] rounded-full text-xs font-medium">{v === 'true' ? 'Active only' : 'Inactive only'} <button onClick={() => toggleActive(v)}><X className="w-3 h-3" /></button></span>)}
            {featuredFilter.map((v) => <span key={v} className="inline-flex items-center gap-1 px-2.5 py-1 bg-gray-100 dark:bg-[#262626] text-gray-700 dark:text-[#a1a1aa] rounded-full text-xs font-medium">{v === 'true' ? 'Featured only' : 'Not featured'} <button onClick={() => toggleFeatured(v)}><X className="w-3 h-3" /></button></span>)}
          </div>
        )}
      </div>

      <div className="bg-white dark:bg-[#171717] rounded-xl border border-gray-200 dark:border-[#262626] shadow-sm overflow-hidden">
        {error ? (
          <div className="flex flex-col items-center justify-center py-16 px-6">
            <div className="h-14 w-14 bg-red-50 dark:bg-red-900/20 rounded-full flex items-center justify-center mb-4"><AlertCircle className="h-7 w-7 text-red-500" /></div>
            <h3 className="font-semibold text-gray-900 dark:text-white">Failed to load categories</h3>
            <p className="text-sm text-gray-500 mt-1 mb-4">{error}</p>
            <button onClick={() => void load({ hard: true })} className="inline-flex items-center px-4 py-2 bg-[#eba236] text-white rounded-lg text-sm font-medium"><RefreshCw className="h-4 w-4 mr-2" />Retry</button>
          </div>
        ) : loading && docs.length === 0 ? (
          <div className="p-4 space-y-3 animate-pulse">
            {Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-16 bg-gray-100 dark:bg-[#0a0a0a] rounded-lg" />)}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
            <div className="h-14 w-14 bg-[#eba236]/10 dark:bg-[#eba236]/15 rounded-full flex items-center justify-center mb-4"><Tag className="w-7 h-7 text-[#eba236]" /></div>
            <h3 className="font-semibold text-gray-900 dark:text-white">No categories found</h3>
            <p className="text-sm text-gray-500 dark:text-[#a1a1aa] mt-1 max-w-md">The taxonomy is managed by the platform. Categories appear here automatically.</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 dark:bg-[#0a0a0a] text-xs text-gray-500 dark:text-[#a1a1aa] border-b border-gray-200 dark:border-[#262626]">
                  <tr>
                    <th className="text-left px-4 py-3 font-medium">Category</th>
                    <th className="text-left px-4 py-3 font-medium hidden lg:table-cell">Slug</th>
                    <th className="text-left px-4 py-3 font-medium">Path / Level</th>
                    <th className="text-left px-4 py-3 font-medium hidden xl:table-cell">Type</th>
                    <th className="text-left px-4 py-3 font-medium">Status</th>
                    <th className="text-left px-4 py-3 font-medium">Your Products</th>
                    <th className="text-left px-4 py-3 font-medium hidden md:table-cell">Created</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-[#262626]">
                  {filtered.map((c) => (
                    <tr key={c.id} className="hover:bg-gray-50 dark:hover:bg-[#0a0a0a]/50 transition">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3 min-w-[200px]">
                          <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-[#eba236] to-[#c88a20] text-white flex items-center justify-center text-xs font-bold shrink-0"><Tag className="w-4 h-4" /></div>
                          <div className="min-w-0">
                            <div className="font-semibold text-gray-900 dark:text-white truncate max-w-[160px] flex items-center gap-1.5">
                              {c.name}
                              {c.isFeatured && <Sparkles className="w-3.5 h-3.5 text-amber-500 shrink-0" />}
                            </div>
                            {c.description && <div className="text-xs text-gray-500 dark:text-[#a1a1aa] truncate max-w-[200px]">{c.description}</div>}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 hidden lg:table-cell">
                        <span className="inline-flex px-2 py-1 rounded-full text-xs font-mono font-medium bg-gray-100 dark:bg-[#262626] text-gray-700 dark:text-[#a1a1aa] border border-gray-200 dark:border-[#333]">{c.slug}</span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-xs text-gray-900 dark:text-white flex items-center gap-1"><Hash className="w-3 h-3 text-gray-400" /> L{c.categoryLevel ?? 1} <span className="text-gray-400">·</span> <span className="font-mono truncate max-w-[140px]">{c.categoryPath || c.slug}</span></div>
                        {c.parentCategory && <div className="text-[11px] text-gray-400 mt-0.5 flex items-center gap-1"><Folder className="w-3 h-3" /> under {c.parentCategory.name}</div>}
                      </td>
                      <td className="px-4 py-3 hidden xl:table-cell">
                        <span className={`inline-flex px-2 py-1 rounded-full text-xs font-medium border capitalize ${typeBadge(c.attributes?.categoryType || null)}`}>{c.attributes?.categoryType || 'other'}</span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-col gap-1">
                          <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold border w-fit ${c.isActive ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-300' : 'bg-zinc-100 text-zinc-600 border-zinc-200 dark:bg-zinc-800 dark:text-zinc-400'}`}>
                            <span className={`h-2 w-2 rounded-full ${c.isActive ? 'bg-emerald-500' : 'bg-zinc-400'}`} /> {c.isActive ? 'Active' : 'Inactive'}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {c.productCount > 0 ? (
                          <span className="inline-flex items-center gap-1 px-2 py-1 bg-white dark:bg-[#0a0a0a] border border-gray-200 dark:border-[#262626] rounded-full text-xs font-semibold text-gray-700 dark:text-white">
                            <Package className="w-3 h-3 text-[#eba236]" /> {c.productCount}
                          </span>
                        ) : (
                          <span className="text-xs text-gray-400">0</span>
                        )}
                      </td>
                      <td className="px-4 py-3 hidden md:table-cell text-xs text-gray-500 dark:text-[#a1a1aa]">{fmtDate(c.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {filtered.length > 0 && (
              <div className="px-4 py-3 border-t border-gray-200 dark:border-[#262626] flex flex-col sm:flex-row items-center justify-between gap-3 text-sm">
                <div className="text-gray-600 dark:text-[#a1a1aa]">Page {page} of {totalPages} • {pagination?.totalDocs ?? filtered.length} categories • 10 per page</div>
                <div className="flex items-center gap-1">
                  <button disabled={loading || page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))} className="px-3 py-1.5 rounded-lg border border-gray-200 dark:border-[#262626] bg-white dark:bg-[#0a0a0a] disabled:opacity-50 text-sm">Prev</button>
                  {Array.from({ length: Math.min(5, totalPages) }).map((_, i) => {
                    const n = Math.max(1, Math.min(totalPages - 4, page - 2)) + i
                    if (n > totalPages) return null
                    return <button key={n} onClick={() => setPage(n)} className={`h-8 w-8 rounded-lg text-sm font-medium border ${n === page ? 'bg-[#eba236] text-white border-[#eba236]' : 'bg-white dark:bg-[#0a0a0a] border-gray-200 dark:border-[#262626] text-gray-700 dark:text-white'}`}>{n}</button>
                  })}
                  <button disabled={loading || page >= totalPages} onClick={() => setPage((p) => p + 1)} className="px-3 py-1.5 rounded-lg border border-gray-200 dark:border-[#262626] bg-white dark:bg-[#0a0a0a] disabled:opacity-50 text-sm">Next</button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      <div className="rounded-xl border border-gray-200 dark:border-[#262626] bg-white dark:bg-[#171717] p-4 text-xs text-gray-500 dark:text-[#a1a1aa]">
        Categories are the platform-wide taxonomy powers browsing in the storefront apps. Tag your products under <Link href="/products" className="font-semibold text-[#eba236] hover:text-[#c88a20]">Products</Link> and see them grouped here. The <span className="font-semibold text-gray-700 dark:text-white">Your Products</span> count reflects how many of your active catalog items are tagged to each category.
      </div>
    </div>
  )
}

export default function ProductCategoriesPage() {
  return (
    <ClientOnly fallback={<CategoriesSkeleton />}>
      <CategoriesContent />
    </ClientOnly>
  )
}
