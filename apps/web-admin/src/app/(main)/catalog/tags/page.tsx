'use client'

import React, { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import Link from 'next/link'
import { useQueryClient } from '@tanstack/react-query'
import { QUERY_KEYS } from '@encreasl/client-services'
import { useTags, type TagDoc, type TagsResponse } from '@/hooks/useTags'
import { ClientOnly } from '@/components/ClientOnly'
import {
  Tag, Layers, Sparkles, Star, Search, X, SlidersHorizontal, ChevronDown, Plus, RefreshCw, AlertCircle,
  Store, Eye, Pencil, Trash2, CalendarDays, Hash, Palette, ToggleLeft,
} from '@/components/ui/IconWrapper'

const TAG_TYPE_OPTS: { value: string; label: string }[] = [
  { value: 'general', label: 'General' },
  { value: 'dietary', label: 'Dietary' },
  { value: 'cuisine', label: 'Cuisine' },
  { value: 'promotion', label: 'Promotion' },
  { value: 'feature', label: 'Feature' },
  { value: 'allergen', label: 'Allergen' },
  { value: 'spice_level', label: 'Spice Level' },
  { value: 'temperature', label: 'Temperature' },
  { value: 'size_category', label: 'Size Category' },
]

function fmtDate(iso: string | null) {
  if (!iso) return '—'
  try { return new Date(iso).toLocaleDateString('en-PH', { timeZone: 'Asia/Manila', year: 'numeric', month: 'short', day: 'numeric' }) } catch { return String(iso).slice(0, 10) }
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
          return <button key={opt.value} onClick={() => onToggle(opt.value)} className={`px-2.5 py-1 rounded-full text-xs font-medium border transition capitalize ${active ? 'bg-[#eba236] text-white border-[#eba236]' : 'bg-white dark:bg-[#0a0a0a] text-gray-700 dark:text-[#a1a1aa] border-gray-200 dark:border-[#262626] hover:border-gray-300'}`}>{opt.label}</button>
        })}
      </div>
    </div>
  )
}

function TagsSkeleton(){
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

function TagsPageContent(){
  const [q, setQ] = useState('')
  const [debouncedQ, setDebouncedQ] = useState('')
  const [tagTypeFilter, setTagTypeFilter] = useState<string[]>([])
  const [isActiveFilter, setIsActiveFilter] = useState<boolean | null>(null)
  const [isFeaturedFilter, setIsFeaturedFilter] = useState<boolean | null>(null)
  const [hierarchyFilter, setHierarchyFilter] = useState<string | null>(null) // null | 'top' | 'child'
  const [sort, setSort] = useState<string>('-createdAt')
  const [page, setPage] = useState(1)
  const limit = 10
  const [showFilters, setShowFilters] = useState(false)

  const [deleting, setDeleting] = useState<TagDoc | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  useEffect(() => { const id = setTimeout(() => setDebouncedQ(q.trim()), 400); return () => clearTimeout(id) }, [q])

  const activeFilterCount = useMemo(() => {
    return tagTypeFilter.length + (isActiveFilter !== null ? 1 : 0) + (isFeaturedFilter !== null ? 1 : 0) + (hierarchyFilter ? 1 : 0) + (debouncedQ ? 1 : 0)
  }, [tagTypeFilter, isActiveFilter, isFeaturedFilter, hierarchyFilter, debouncedQ])

  const qs = useMemo(() => {
    const p = new URLSearchParams()
    p.set('page', String(page))
    p.set('limit', String(limit))
    p.set('sort', sort)
    if (debouncedQ) p.set('search', debouncedQ)
    if (tagTypeFilter.length) p.set('tag_type', tagTypeFilter.join(','))
    if (isActiveFilter !== null) p.set('is_active', String(isActiveFilter))
    if (isFeaturedFilter !== null) p.set('is_featured', String(isFeaturedFilter))
    if (hierarchyFilter) p.set('parent_tag_id', hierarchyFilter === 'top' ? 'null' : hierarchyFilter)
    return p.toString()
  }, [page, limit, sort, debouncedQ, tagTypeFilter, isActiveFilter, isFeaturedFilter, hierarchyFilter])

  const queryClient = useQueryClient()
  const [hardRefreshing, setHardRefreshing] = useState(false)
  const { data, isPending, isFetching, isError, error: queryError, refetch } = useTags(qs)

  const docs = data?.docs || []
  const pagination = data?.pagination || null
  const stats = data?.stats || null

  const isInitialLoading = (isPending && !data) || hardRefreshing
  const loading = isFetching || hardRefreshing
  const error = isError && !data && !hardRefreshing ? (queryError instanceof Error ? queryError.message : 'Failed to load tags') : null

  const handleHardRefresh = () => {
    if (hardRefreshing) return
    setHardRefreshing(true)
    void (async () => {
      try {
        queryClient.removeQueries({ queryKey: QUERY_KEYS.adminCatalogTags(qs) })
        await refetch({ cancelRefetch: true })
      } finally { setHardRefreshing(false) }
    })()
  }

  useEffect(() => { setPage(1) }, [debouncedQ, tagTypeFilter, isActiveFilter, isFeaturedFilter, hierarchyFilter, sort])

  useEffect(() => {
    const isOpen = !!deleting
    if (isOpen) { const prev = document.body.style.overflow; document.body.style.overflow = 'hidden'; return () => { document.body.style.overflow = prev } }
    document.body.style.overflow = ''; return () => { document.body.style.overflow = '' }
  }, [deleting])

  const toggleTagType = (v: string) => setTagTypeFilter((prev) => prev.includes(v) ? prev.filter((x) => x !== v) : [...prev, v])
  const clearAll = () => { setQ(''); setDebouncedQ(''); setTagTypeFilter([]); setIsActiveFilter(null); setIsFeaturedFilter(null); setHierarchyFilter(null) }

  const handleDelete = async () => {
    if (!deleting || isDeleting) return
    setIsDeleting(true)
    setDeleteError(null)
    try {
      const res = await fetch(`/api/catalog/tags/${deleting.id}`, { method: 'DELETE' })
      const j = await res.json().catch(() => ({}))
      if (!res.ok) {
        if (j.code === 'IN_USE') { setDeleteError(j.error || 'Tag is in use'); return }
        if (j.code === 'HAS_CHILDREN') { setDeleteError(j.error || 'Tag has child tags'); return }
        throw new Error(j.error || 'Failed to delete')
      }
      const deletedId = deleting.id
      // Optimistic removal across every cached tags list (all pages/filters).
      // Segment-guard keeps sibling catalog queries untouched.
      // The row vanishes instantly even while the CMS Redis list cache
      // is still converging; invalidate+refetch below reconciles with the server.
      queryClient.setQueriesData<TagsResponse>(
        {
          queryKey: ['admin', 'catalog', 'tags'],
          predicate: (q) => q.queryKey.length === 4 && q.queryKey[2] === 'tags' && typeof q.queryKey[3] === 'string',
        },
        (old) => {
          if (!old || !Array.isArray(old.docs)) return old
          const docs = old.docs.filter((d) => d.id !== deletedId)
          const removed = old.docs.length - docs.length
          if (!removed) return old
          const limit = Math.max(1, old.pagination?.limit ?? 10)
          const totalDocs = Math.max(0, (old.pagination?.totalDocs ?? old.docs.length) - removed)
          const pagination = old.pagination
            ? { ...old.pagination, totalDocs, totalPages: Math.max(1, Math.ceil(totalDocs / limit)) }
            : old.pagination
          const stats = old.stats
            ? { ...old.stats, total: Math.max(0, old.stats.total - removed), filteredCount: Math.max(0, old.stats.filteredCount - removed) }
            : old.stats
          return { ...old, docs, pagination, stats }
        }
      )
      setDeleting(null)
      // Bust every cached tags list (all pages/filters) so the removal
      // reconciles with the server instead of waiting out the 3-min staleTime.
      await queryClient.invalidateQueries({ queryKey: ['admin', 'catalog', 'tags'] })
      await refetch()
    } catch (e: any) { setDeleteError(e?.message || 'Delete failed') }
    finally { setIsDeleting(false) }
  }

  return (
    <div className="space-y-6 py-5 px-2.5">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white tracking-tight flex items-center gap-2">
            <span className="h-8 w-8 rounded-lg bg-[#eba236] text-white flex items-center justify-center"><Tag className="w-4 h-4" /></span>
            Tags
          </h1>
          <p className="text-sm text-gray-500 dark:text-[#a1a1aa] mt-1">Manage product tags — color, hierarchy, and usage across catalog.</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={handleHardRefresh} disabled={loading} aria-label="Refresh tags" title="Refresh — re-fetch from BFF and show skeleton" className="h-9 w-9 inline-flex items-center justify-center bg-white dark:bg-[#171717] border border-gray-200 dark:border-[#262626] rounded-xl hover:bg-gray-50 dark:hover:bg-[#262626] disabled:opacity-50 disabled:cursor-not-allowed">
            <RefreshCw className={`w-4 h-4 text-gray-600 dark:text-[#a1a1aa] ${loading ? 'animate-spin' : ''}`} />
          </button>
          <Link href="/catalog/tags/new" className="inline-flex items-center gap-2 px-4 py-2.5 bg-[#eba236] hover:bg-[#c88a20] text-white rounded-xl text-sm font-semibold shadow-sm transition">
            <Plus className="w-4 h-4" /> New Tag
          </Link>
        </div>
      </div>

      {/* KPIs */}
      {stats ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <KpiCard title="Total Tags" value={String(stats.total)} sub={`${stats.filteredCount} filtered`} icon={<Tag className="w-5 h-5 text-white" />} iconBg="bg-[#eba236]" />
          <KpiCard title="Active" value={String(stats.activeCount)} sub={`${stats.inactiveCount} inactive`} icon={<ToggleLeft className="w-5 h-5 text-white" />} iconBg="bg-emerald-500" />
          <KpiCard title="Featured" value={String(stats.featuredCount)} sub={`${stats.topLevelCount} top-level`} icon={<Star className="w-5 h-5 text-white" />} iconBg="bg-amber-500" />
          <KpiCard title="By Type" value={String(Object.keys(stats.tagTypeBreakdown || {}).length + ' types')} sub={Object.entries(stats.tagTypeBreakdown || {}).slice(0, 2).map(([k, v]) => `${k}:${v}`).join(' • ') || '—'} icon={<Layers className="w-5 h-5 text-white" />} iconBg="bg-sky-600" />
        </div>
      ) : isInitialLoading ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 animate-pulse">
          {Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-[86px] bg-gray-100 dark:bg-[#171717] rounded-xl border border-gray-200 dark:border-[#262626]" />)}
        </div>
      ) : null}

      {/* Search + Filters bar */}
      <div className="bg-white dark:bg-[#171717] rounded-xl border border-gray-200 dark:border-[#262626] p-3 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, slug, description…" className="w-full pl-9 pr-9 py-2.5 text-sm bg-gray-50 dark:bg-[#0a0a0a] border border-gray-200 dark:border-[#262626] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#eba236]/20 focus:border-[#eba236] text-gray-900 dark:text-white placeholder:text-gray-400" />
            {q && <button onClick={() => setQ('')} className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-full hover:bg-gray-100 dark:hover:bg-[#262626]"><X className="w-4 h-4 text-gray-400" /></button>}
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-1 p-1 bg-gray-100 dark:bg-[#0a0a0a] rounded-full border border-gray-200 dark:border-[#262626]">
              <select value={sort} onChange={(e) => setSort(e.target.value)} className="px-3 py-1.5 rounded-full text-xs font-semibold bg-white dark:bg-[#171717] border border-gray-200 dark:border-[#333] text-gray-700 dark:text-white">
                <option value="-createdAt">Newest first</option>
                <option value="createdAt">Oldest first</option>
                <option value="name">Name A–Z</option>
                <option value="-name">Name Z–A</option>
                <option value="slug">Slug A–Z</option>
                <option value="tag_type">Tag type</option>
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
              <FilterPills label="Tag type" options={TAG_TYPE_OPTS} value={tagTypeFilter} onToggle={toggleTagType} />
              <div>
                <p className="text-xs font-semibold text-gray-700 dark:text-[#a1a1aa] mb-2">Status</p>
                <div className="flex flex-wrap gap-1.5">
                  {[['all', 'All'], ['true', 'Active only'], ['false', 'Inactive only']].map(([v, l]) => {
                    const active = (isActiveFilter === null && v === 'all') || String(isActiveFilter) === v
                    return <button key={v} onClick={() => setIsActiveFilter(v === 'all' ? null : v === 'true')} className={`px-2.5 py-1 rounded-full text-xs font-medium border ${active ? 'bg-[#eba236] text-white border-[#eba236]' : 'bg-white dark:bg-[#0a0a0a] text-gray-700 dark:text-[#a1a1aa] border-gray-200 dark:border-[#262626]'}`}>{l}</button>
                  })}
                </div>
                <div className="mt-3">
                  <p className="text-xs font-semibold text-gray-700 dark:text-[#a1a1aa] mb-2">Featured</p>
                  <div className="flex flex-wrap gap-1.5">
                    {[['all', 'All'], ['true', 'Featured'], ['false', 'Standard']].map(([v, l]) => {
                      const active = (isFeaturedFilter === null && v === 'all') || String(isFeaturedFilter) === v
                      return <button key={v} onClick={() => setIsFeaturedFilter(v === 'all' ? null : v === 'true')} className={`px-2.5 py-1 rounded-full text-xs font-medium border ${active ? 'bg-[#eba236] text-white border-[#eba236]' : 'bg-white dark:bg-[#0a0a0a] text-gray-700 dark:text-[#a1a1aa] border-gray-200 dark:border-[#262626]'}`}>{l}</button>
                    })}
                  </div>
                </div>
              </div>
              <div>
                <p className="text-xs font-semibold text-gray-700 dark:text-[#a1a1aa] mb-2">Hierarchy</p>
                <div className="flex flex-wrap gap-1.5">
                  {[['all', 'All'], ['top', 'Top-level'], ['child', 'Child']].map(([v, l]) => {
                    const active = (hierarchyFilter === null && v === 'all') || hierarchyFilter === v || (v === 'child' && hierarchyFilter !== null && hierarchyFilter !== 'top')
                    // child active when hierarchyFilter is truthy and not top
                    const isActive = v === 'all' ? hierarchyFilter === null : v === 'top' ? hierarchyFilter === 'top' : hierarchyFilter !== null && hierarchyFilter !== 'top'
                    return <button key={v} onClick={() => {
                      if (v === 'all') setHierarchyFilter(null)
                      else if (v === 'top') setHierarchyFilter('top')
                      else setHierarchyFilter('child')
                    }} className={`px-2.5 py-1 rounded-full text-xs font-medium border ${isActive ? 'bg-[#eba236] text-white border-[#eba236]' : 'bg-white dark:bg-[#0a0a0a] text-gray-700 dark:text-[#a1a1aa] border-gray-200 dark:border-[#262626]'}`}>{l}</button>
                  })}
                </div>
              </div>
            </div>
            <div className="flex justify-end"><button onClick={() => setShowFilters(false)} className="text-xs font-semibold text-[#eba236]">Done</button></div>
          </div>
        )}

        {activeFilterCount > 0 && !showFilters && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {debouncedQ && <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-[#eba236]/10 dark:bg-[#eba236]/15 text-[#8a5f17] dark:text-[#eba236] rounded-full text-xs font-medium border border-[#eba236]/30 dark:border-[#eba236]/30">Search: “{debouncedQ}” <button onClick={() => setQ('')}><X className="w-3 h-3" /></button></span>}
            {tagTypeFilter.map((v) => <span key={v} className="inline-flex items-center gap-1 px-2.5 py-1 bg-gray-100 dark:bg-[#262626] text-gray-700 dark:text-[#a1a1aa] rounded-full text-xs font-medium capitalize">type:{v} <button onClick={() => toggleTagType(v)}><X className="w-3 h-3" /></button></span>)}
            {isActiveFilter !== null && <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-gray-100 dark:bg-[#262626] rounded-full text-xs">{isActiveFilter ? 'Active only' : 'Inactive only'} <button onClick={() => setIsActiveFilter(null)}><X className="w-3 h-3" /></button></span>}
            {isFeaturedFilter !== null && <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-gray-100 dark:bg-[#262626] rounded-full text-xs">{isFeaturedFilter ? 'Featured' : 'Standard'} <button onClick={() => setIsFeaturedFilter(null)}><X className="w-3 h-3" /></button></span>}
            {hierarchyFilter && <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-gray-100 dark:bg-[#262626] rounded-full text-xs capitalize">{hierarchyFilter === 'top' ? 'Top-level' : 'Child'} <button onClick={() => setHierarchyFilter(null)}><X className="w-3 h-3" /></button></span>}
          </div>
        )}
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-[#171717] rounded-xl border border-gray-200 dark:border-[#262626] shadow-sm overflow-hidden">
        {error && (
          <div className="flex flex-col items-center justify-center py-16 px-6">
            <div className="h-14 w-14 bg-red-50 dark:bg-red-900/20 rounded-full flex items-center justify-center mb-4"><AlertCircle className="h-7 w-7 text-red-500" /></div>
            <h3 className="font-semibold text-gray-900 dark:text-white">Failed to load tags</h3>
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
            <div className="h-16 w-16 bg-[#eba236]/10 dark:bg-[#eba236]/15 rounded-2xl flex items-center justify-center mb-4"><Tag className="w-8 h-8 text-[#eba236]" /></div>
            <h3 className="font-semibold text-gray-900 dark:text-white">No tags found</h3>
            <p className="text-sm text-gray-500 dark:text-[#a1a1aa] mt-1 max-w-md">Try adjusting search or filters, or create your first product tag.</p>
            <Link href="/catalog/tags/new" className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-[#eba236] text-white rounded-lg text-sm font-semibold"><Plus className="w-4 h-4" /> Create tag</Link>
          </div>
        ) : !error && (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 dark:bg-[#0a0a0a] text-xs text-gray-500 dark:text-[#a1a1aa] border-b border-gray-200 dark:border-[#262626]">
                  <tr>
                    <th className="text-left px-4 py-3 font-medium">Tag</th>
                    <th className="text-left px-4 py-3 font-medium hidden lg:table-cell">Slug</th>
                    <th className="text-left px-4 py-3 font-medium">Tag Type</th>
                    <th className="text-left px-4 py-3 font-medium hidden xl:table-cell">Parent</th>
                    <th className="text-right px-4 py-3 font-medium">Usage</th>
                    <th className="text-left px-4 py-3 font-medium">Status</th>
                    <th className="text-right px-4 py-3 font-medium">Products</th>
                    <th className="text-right px-4 py-3 font-medium hidden md:table-cell">Created</th>
                    <th className="text-right px-4 py-3 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-[#262626]">
                  {docs.map((t) => (
                    <tr key={t.id} className="hover:bg-gray-50 dark:hover:bg-[#0a0a0a]/50 transition">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3 min-w-[200px]">
                          <span className="h-3 w-3 rounded-full shrink-0 border border-gray-200 dark:border-[#262626]" style={{ backgroundColor: t.color || '#eba236' }} />
                          <div className="min-w-0">
                            <div className="font-semibold text-gray-900 dark:text-white truncate max-w-[180px] flex items-center gap-1">{t.name} {t.is_featured && <Star className="w-3 h-3 text-amber-500 fill-amber-500" />}</div>
                            <div className="text-xs text-gray-500 dark:text-[#a1a1aa] truncate max-w-[180px]">{t.description ? t.description.slice(0, 40) : '—'}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 hidden lg:table-cell">
                        <span className="inline-flex px-2 py-1 rounded-full text-xs font-mono font-medium bg-gray-100 dark:bg-[#262626] text-gray-700 dark:text-[#a1a1aa] border border-gray-200 dark:border-[#333]">{t.slug}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex px-2 py-1 rounded-full text-xs font-medium bg-gray-100 dark:bg-[#262626] text-gray-700 dark:text-[#a1a1aa] border border-gray-200 dark:border-[#333] capitalize">{t.tag_type.replace('_', ' ')}</span>
                      </td>
                      <td className="px-4 py-3 hidden xl:table-cell">
                        <span className="text-xs text-gray-700 dark:text-[#a1a1aa]">{t.parent_tag_id ? t.parent_tag_id.name : <span className="text-gray-400">Top-level</span>}</span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className="text-xs font-mono text-gray-900 dark:text-white">{t.usage_count}</span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-col gap-1">
                          <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold border w-fit ${t.is_active ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-300' : 'bg-zinc-100 text-zinc-600 border-zinc-200 dark:bg-zinc-800 dark:text-zinc-400'}`}><span className={`h-2 w-2 rounded-full ${t.is_active ? 'bg-emerald-500' : 'bg-zinc-400'}`} /> {t.is_active ? 'Active' : 'Inactive'}</span>
                          {t.is_featured && <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-900/20 dark:text-amber-300 w-fit">Featured</span>}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className="inline-flex items-center gap-1 px-2 py-1 bg-white dark:bg-[#0a0a0a] border border-gray-200 dark:border-[#262626] rounded-full text-xs font-semibold text-gray-700 dark:text-white">
                          <Store className="w-3 h-3 text-[#eba236]" /> {t.productCount}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right hidden md:table-cell">
                        <span className="text-xs text-gray-500 dark:text-[#a1a1aa]">{fmtDate(t.createdAt)}</span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="inline-flex items-center gap-1">
                          <Link href={`/catalog/tags/${t.id}`} className="h-7 w-7 inline-flex items-center justify-center rounded-lg hover:bg-gray-100 dark:hover:bg-[#262626] text-gray-500 dark:text-[#a1a1aa] hover:text-gray-900 dark:hover:text-white" title="View"><Eye className="w-4 h-4" /></Link>
                          <Link href={`/catalog/tags/${t.id}/edit`} className="h-7 w-7 inline-flex items-center justify-center rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/20 text-gray-500 dark:text-[#a1a1aa] hover:text-blue-600 dark:hover:text-blue-400" title="Edit"><Pencil className="w-4 h-4" /></Link>
                          <button onClick={() => { setDeleteError(null); setDeleting(t) }} className="h-7 w-7 inline-flex items-center justify-center rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-gray-500 dark:text-[#a1a1aa] hover:text-red-600 dark:hover:text-red-400" title="Delete"><Trash2 className="w-4 h-4" /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {pagination && pagination.totalDocs > 0 && !loading && (
              <div className="px-4 py-3 border-t border-gray-200 dark:border-[#262626] flex flex-col sm:flex-row items-center justify-between gap-3 text-sm">
                <div className="text-gray-600 dark:text-[#a1a1aa]">Page {pagination.page} of {pagination.totalPages} • {pagination.totalDocs} tags • 10 per page</div>
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

      {deleting && typeof document !== 'undefined' &&
        createPortal(
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={() => { if (!isDeleting) setDeleting(null) }}>
            <div className="relative bg-white dark:bg-[#171717] rounded-2xl shadow-2xl border border-gray-200 dark:border-[#262626] w-full max-w-md p-6 animate-in fade-in zoom-in-95" onClick={(e) => e.stopPropagation()}>
              <div className="h-12 w-12 rounded-full bg-red-50 dark:bg-red-900/20 flex items-center justify-center mb-4"><Trash2 className="w-6 h-6 text-red-600" /></div>
              <h3 className="font-bold text-gray-900 dark:text-white">Delete tag?</h3>
              <p className="text-sm text-gray-600 dark:text-[#a1a1aa] mt-1">This will permanently delete <span className="font-semibold text-gray-900 dark:text-white">{deleting.name}</span> ({deleting.slug}). {(deleting.productCount > 0 || deleting.groupCount > 0) ? `It is in use — ${deleting.productCount} product(s), ${deleting.groupCount} group(s) — you must reassign first.` : 'This action cannot be undone.'}</p>
              {deleteError && <p className="text-sm text-red-600 mt-3">{deleteError}</p>}
              <div className="flex gap-2 mt-6">
                <button onClick={() => setDeleting(null)} disabled={isDeleting} className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 dark:border-[#262626] text-sm font-medium bg-white dark:bg-[#171717] hover:bg-gray-50 dark:hover:bg-[#262626] disabled:opacity-50 disabled:cursor-not-allowed">Cancel</button>
                <button onClick={handleDelete} disabled={isDeleting} className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed">
                  {isDeleting && <RefreshCw className="w-4 h-4 animate-spin" />}
                  {isDeleting ? 'Deleting…' : 'Confirm delete'}
                </button>
              </div>
              {(deleting.productCount > 0 || deleting.groupCount > 0) && <p className="text-xs text-amber-600 mt-3">Blocked: tag is in use. BFF will reject with 409 IN_USE. Child tags also block with 409 HAS_CHILDREN.</p>}
            </div>
          </div>,
          document.body
        )}
    </div>
  )
}

export default function TagsPage(){
  return (
    <ClientOnly fallback={<TagsSkeleton />}>
      <TagsPageContent />
    </ClientOnly>
  )
}
