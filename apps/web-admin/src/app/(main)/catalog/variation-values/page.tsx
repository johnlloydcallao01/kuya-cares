'use client'

import React, { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import Link from 'next/link'
import { useQueryClient } from '@tanstack/react-query'
import { QUERY_KEYS } from '@encreasl/client-services'
import { useVariationValues, type VariationValueDoc, type VariationValuesResponse } from '@/hooks/useVariationValues'
import { useCatalogAttributes } from '@/hooks/useCatalogAttributes'
import { useVariations } from '@/hooks/useVariations'
import { ClientOnly } from '@/components/ClientOnly'
import {
  Building, Search, X, SlidersHorizontal, ChevronDown, Plus, RefreshCw, AlertCircle,
  Eye, Pencil, Trash2, CalendarDays, Palette, Tag, Layers, Hash
} from '@/components/ui/IconWrapper'

function typeBadge(type: string) {
  const t = (type || '').toLowerCase()
  if (t === 'color') return 'bg-pink-50 text-pink-700 border-pink-200 dark:bg-pink-900/20 dark:text-pink-300 dark:border-pink-800'
  if (t === 'button') return 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/20 dark:text-blue-300 dark:border-blue-800'
  if (t === 'radio') return 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-900/20 dark:text-purple-300 dark:border-purple-800'
  return 'bg-gray-100 text-gray-700 border-gray-200 dark:bg-zinc-800 dark:text-zinc-300 dark:border-zinc-700'
}
function fmtDate(iso: string | null) {
  if (!iso) return '—'
  try { return new Date(iso).toLocaleDateString('en-PH', { timeZone: 'Asia/Manila', year: 'numeric', month: 'short', day: 'numeric' }) } catch { return String(iso).slice(0, 10) }
}
function productLabel(product: any): string {
  if (!product) return '—'
  if (typeof product === 'number') return `#${product}`
  return product.name || product.slug || `#${product.id}`
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

function VariationValuesSkeleton(){
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

function VariationValuesPageContent(){
  const [q, setQ] = useState('')
  const [debouncedQ, setDebouncedQ] = useState('')
  const [variationFilter, setVariationFilter] = useState<string>('')
  const [attributeFilter, setAttributeFilter] = useState<string>('')
  const [sort, setSort] = useState<string>('-createdAt')
  const [page, setPage] = useState(1)
  const limit = 10
  const [showFilters, setShowFilters] = useState(false)

  const [deleting, setDeleting] = useState<VariationValueDoc | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  useEffect(() => { const id = setTimeout(() => setDebouncedQ(q.trim()), 400); return () => clearTimeout(id) }, [q])

  // dropdown data — reused cached hooks
  const { data: variationsData } = useVariations('limit=100')
  const { data: attributesData } = useCatalogAttributes('limit=100')
  const variations = (variationsData?.docs || []).map((d) => ({ id: d.id, sku: d.sku || '', name: d.name ?? null, product: d.product_id || d.product }))
  const attributes = attributesData?.docs || []

  const activeFilterCount = useMemo(() => {
    return (variationFilter ? 1 : 0) + (attributeFilter ? 1 : 0) + (debouncedQ ? 1 : 0)
  }, [variationFilter, attributeFilter, debouncedQ])

  const qs = useMemo(() => {
    const p = new URLSearchParams()
    p.set('page', String(page))
    p.set('limit', String(limit))
    p.set('sort', sort)
    if (debouncedQ) p.set('search', debouncedQ)
    if (variationFilter) p.set('variationId', variationFilter)
    if (attributeFilter) p.set('attributeId', attributeFilter)
    return p.toString()
  }, [page, limit, sort, debouncedQ, variationFilter, attributeFilter])

  const queryClient = useQueryClient()
  const [hardRefreshing, setHardRefreshing] = useState(false)
  const { data, isPending, isFetching, isError, error: queryError, refetch } = useVariationValues(qs)

  const docs = data?.docs || []
  const pagination = data?.pagination || null
  const stats = data?.stats || null

  const isInitialLoading = (isPending && !data) || hardRefreshing
  const loading = isFetching || hardRefreshing
  const error = isError && !data && !hardRefreshing ? (queryError instanceof Error ? queryError.message : 'Failed to load variation values') : null

  const handleHardRefresh = () => {
    if (hardRefreshing) return
    setHardRefreshing(true)
    void (async () => {
      try {
        queryClient.removeQueries({ queryKey: QUERY_KEYS.adminCatalogVariationValues(qs) })
        await refetch({ cancelRefetch: true })
      } finally { setHardRefreshing(false) }
    })()
  }

  useEffect(() => { setPage(1) }, [debouncedQ, variationFilter, attributeFilter, sort])

  useEffect(() => {
    const isOpen = !!deleting
    if (isOpen) {
      const prev = document.body.style.overflow
      document.body.style.overflow = 'hidden'
      return () => { document.body.style.overflow = prev }
    }
    document.body.style.overflow = ''
    return () => { document.body.style.overflow = '' }
  }, [deleting])

  const clearAll = () => { setQ(''); setDebouncedQ(''); setVariationFilter(''); setAttributeFilter('') }

  const handleDelete = async () => {
    if (!deleting || isDeleting) return
    setIsDeleting(true)
    setDeleteError(null)
    try {
      const res = await fetch(`/api/catalog/variation-values/${deleting.id}`, { method: 'DELETE' })
      const j = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(j.error || 'Failed to delete')
      const deletedId = deleting.id
      // Optimistic removal across every cached values list (all pages/filters).
      // Segment-guard keeps sibling catalog queries untouched.
      // The row vanishes instantly even while the CMS Redis list cache
      // is still converging; invalidate+refetch below reconciles with the server.
      queryClient.setQueriesData<VariationValuesResponse>(
        {
          queryKey: ['admin', 'catalog', 'variation-values'],
          predicate: (q) => q.queryKey.length === 4 && q.queryKey[2] === 'variation-values' && typeof q.queryKey[3] === 'string',
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
            ? { ...old.stats, total: Math.max(0, old.stats.total - removed), totalAll: Math.max(0, old.stats.totalAll - removed), filteredTotal: Math.max(0, old.stats.filteredTotal - removed) }
            : old.stats
          return { ...old, docs, pagination, stats }
        }
      )
      setDeleting(null)
      setDeleteError(null)
      // Bust every cached values list (all pages/filters) so the removal
      // reconciles with the server instead of waiting out the 3-min staleTime.
      await queryClient.invalidateQueries({ queryKey: ['admin', 'catalog', 'variation-values'] })
      await refetch()
    } catch (e: any) {
      setDeleteError(e?.message || 'Delete failed')
    } finally { setIsDeleting(false) }
  }

  const perAttrTop = useMemo(() => {
    if (!stats?.perAttribute) return []
    const entries = Object.entries(stats.perAttribute).map(([k, v]) => {
      const attr = attributes.find((a) => String(a.id) === k)
      return { id: k, label: attr ? `${attr.name} (${attr.slug})` : `#${k}`, count: v as number }
    })
    entries.sort((a, b) => b.count - a.count)
    return entries.slice(0, 3)
  }, [stats, attributes])

  const perVariationTop = useMemo(() => {
    if (!stats?.perVariation) return []
    const entries = Object.entries(stats.perVariation).map(([k, v]) => {
      const vari = variations.find((x) => String(x.id) === k)
      return { id: k, label: vari ? `${vari.sku || `#${vari.id}`} ${vari.name || ''}`.trim() : `#${k}`, count: v as number }
    })
    entries.sort((a, b) => b.count - a.count)
    return entries.slice(0, 2)
  }, [stats, variations])

  return (
    <div className="space-y-6 py-5 px-2.5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white tracking-tight flex items-center gap-2">
            <span className="h-10 w-10 rounded-xl bg-[#eba236] text-white flex items-center justify-center"><Layers className="w-5 h-5" /></span>
            Variation Values
          </h1>
          <p className="text-sm text-gray-500 dark:text-[#a1a1aa] mt-1">Join table mapping variations to attribute terms — one value per attribute per variation.</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleHardRefresh}
            disabled={loading}
            aria-label="Refresh variation values"
            title="Refresh — re-fetch from BFF and show skeleton"
            className="h-9 w-9 inline-flex items-center justify-center bg-white dark:bg-[#171717] border border-gray-200 dark:border-[#262626] rounded-xl hover:bg-gray-50 dark:hover:bg-[#262626] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <RefreshCw className={`w-4 h-4 text-gray-600 dark:text-[#a1a1aa] ${loading ? 'animate-spin' : ''}`} />
          </button>
          <Link href="/catalog/variation-values/new" className="inline-flex items-center gap-2 px-4 py-2.5 bg-[#eba236] hover:bg-[#c88a20] text-white rounded-xl text-sm font-semibold shadow-sm transition">
            <Plus className="w-4 h-4" /> New Value
          </Link>
        </div>
      </div>

      {stats ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <KpiCard title="Total Values" value={String(stats.filteredTotal)} sub={`${stats.totalAll} overall`} icon={<Hash className="w-5 h-5 text-white" />} iconBg="bg-[#eba236]" />
          <KpiCard title="Per Attribute" value={perAttrTop[0] ? `${perAttrTop[0].count} values` : '—'} sub={perAttrTop[0]?.label || perAttrTop.map((p) => `${p.label}:${p.count}`).join(' • ') || 'no breakdown'} icon={<Tag className="w-5 h-5 text-white" />} iconBg="bg-blue-600" />
          <KpiCard title="Per Variation" value={perVariationTop[0] ? `${perVariationTop[0].count} vals` : '—'} sub={perVariationTop[0]?.label || perVariationTop.map((p) => `${p.label}:${p.count}`).join(' • ') || 'no breakdown'} icon={<Building className="w-5 h-5 text-white" />} iconBg="bg-emerald-500" />
          <KpiCard title="Per Term" value={String(Object.keys(stats.perTerm || {}).length)} sub={`${Object.values(stats.perTerm || {}).reduce((a,b)=>a+(b as number),0)} links`} icon={<Palette className="w-5 h-5 text-white" />} iconBg="bg-zinc-500" />
        </div>
      ) : isInitialLoading ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 animate-pulse">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-[86px] bg-gray-100 dark:bg-[#171717] rounded-xl border border-gray-200 dark:border-[#262626]" />
          ))}
        </div>
      ) : null}

      <div className="bg-white dark:bg-[#171717] rounded-xl border border-gray-200 dark:border-[#262626] p-3 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search term name, slug, value…" className="w-full pl-9 pr-9 py-2.5 text-sm bg-gray-50 dark:bg-[#0a0a0a] border border-gray-200 dark:border-[#262626] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#eba236]/20 focus:border-[#eba236] text-gray-900 dark:text-white placeholder:text-gray-400" />
            {q && <button onClick={() => setQ('')} className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-full hover:bg-gray-100 dark:hover:bg-[#262626]"><X className="w-4 h-4 text-gray-400" /></button>}
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-1 p-1 bg-gray-100 dark:bg-[#0a0a0a] rounded-full border border-gray-200 dark:border-[#262626]">
              <select value={sort} onChange={(e) => setSort(e.target.value)} className="px-3 py-1.5 rounded-full text-xs font-semibold bg-white dark:bg-[#171717] border border-gray-200 dark:border-[#333] text-gray-700 dark:text-white">
                <option value="-createdAt">Newest first</option>
                <option value="createdAt">Oldest first</option>
                <option value="variation_id">Variation</option>
                <option value="attribute_id">Attribute</option>
                <option value="term_id">Term</option>
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
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div>
                <p className="text-xs font-semibold text-gray-700 dark:text-[#a1a1aa] mb-2">Variation</p>
                <select value={variationFilter} onChange={(e) => setVariationFilter(e.target.value)} className="w-full px-3 py-2.5 rounded-lg border border-gray-200 dark:border-[#262626] bg-white dark:bg-[#0a0a0a] text-sm text-gray-900 dark:text-white">
                  <option value="">All variations</option>
                  {variations.map((v) => (
                    <option key={v.id} value={String(v.id)}>{v.sku || `#${v.id}`} {v.name ? `— ${v.name}` : ''}</option>
                  ))}
                </select>
                {variations.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {variations.slice(0, 6).map((v) => {
                      const active = String(v.id) === variationFilter
                      return (
                        <button key={v.id} onClick={() => setVariationFilter(active ? '' : String(v.id))} className={`px-2.5 py-1 rounded-full text-xs font-medium border transition ${active ? 'bg-[#eba236] text-white border-[#eba236]' : 'bg-white dark:bg-[#0a0a0a] text-gray-700 dark:text-[#a1a1aa] border-gray-200 dark:border-[#262626] hover:border-gray-300'}`}>
                          {v.sku || `#${v.id}`}
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>
              <div>
                <p className="text-xs font-semibold text-gray-700 dark:text-[#a1a1aa] mb-2">Attribute</p>
                <select value={attributeFilter} onChange={(e) => setAttributeFilter(e.target.value)} className="w-full px-3 py-2.5 rounded-lg border border-gray-200 dark:border-[#262626] bg-white dark:bg-[#0a0a0a] text-sm text-gray-900 dark:text-white">
                  <option value="">All attributes</option>
                  {attributes.map((a) => (
                    <option key={a.id} value={String(a.id)}>{a.name} — {a.slug} ({a.type})</option>
                  ))}
                </select>
                {attributes.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {attributes.slice(0, 6).map((a) => {
                      const active = String(a.id) === attributeFilter
                      return (
                        <button key={a.id} onClick={() => setAttributeFilter(active ? '' : String(a.id))} className={`px-2.5 py-1 rounded-full text-xs font-medium border transition capitalize ${active ? 'bg-[#eba236] text-white border-[#eba236]' : 'bg-white dark:bg-[#0a0a0a] text-gray-700 dark:text-[#a1a1aa] border-gray-200 dark:border-[#262626] hover:border-gray-300'}`}>
                          {a.name}
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>
            <div className="flex justify-end"><button onClick={() => setShowFilters(false)} className="text-xs font-semibold text-[#eba236]">Done</button></div>
          </div>
        )}

        {activeFilterCount > 0 && !showFilters && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {debouncedQ && <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-[#eba236]/10 dark:bg-[#eba236]/15 text-[#8a5f17] dark:text-[#eba236] rounded-full text-xs font-medium border border-[#eba236]/30 dark:border-[#eba236]/30">Search: “{debouncedQ}” <button onClick={() => setQ('')}><X className="w-3 h-3" /></button></span>}
            {variationFilter && (() => { const v = variations.find((x) => String(x.id) === variationFilter); return <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-gray-100 dark:bg-[#262626] text-gray-700 dark:text-[#a1a1aa] rounded-full text-xs font-medium">variation:{v ? v.sku : variationFilter} <button onClick={() => setVariationFilter('')}><X className="w-3 h-3" /></button></span> })()}
            {attributeFilter && (() => { const a = attributes.find((x) => String(x.id) === attributeFilter); return <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-gray-100 dark:bg-[#262626] text-gray-700 dark:text-[#a1a1aa] rounded-full text-xs font-medium">attr:{a ? a.name : attributeFilter} <button onClick={() => setAttributeFilter('')}><X className="w-3 h-3" /></button></span> })()}
          </div>
        )}
      </div>

      <div className="bg-white dark:bg-[#171717] rounded-xl border border-gray-200 dark:border-[#262626] shadow-sm overflow-hidden">
        {error && (
          <div className="flex flex-col items-center justify-center py-16 px-6">
            <div className="h-14 w-14 bg-red-50 dark:bg-red-900/20 rounded-full flex items-center justify-center mb-4"><AlertCircle className="h-7 w-7 text-red-500" /></div>
            <h3 className="font-semibold text-gray-900 dark:text-white">Failed to load variation values</h3>
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
            <div className="h-16 w-16 bg-[#eba236]/10 dark:bg-[#eba236]/15 rounded-2xl flex items-center justify-center mb-4"><Layers className="w-8 h-8 text-[#eba236]" /></div>
            <h3 className="font-semibold text-gray-900 dark:text-white">No variation values found</h3>
            <p className="text-sm text-gray-500 dark:text-[#a1a1aa] mt-1 max-w-md">Try adjusting search or filters, or create your first variation value.</p>
            <Link href="/catalog/variation-values/new" className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-[#eba236] text-white rounded-lg text-sm font-semibold"><Plus className="w-4 h-4" /> Create value</Link>
          </div>
        ) : !error && (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 dark:bg-[#0a0a0a] text-xs text-gray-500 dark:text-[#a1a1aa] border-b border-gray-200 dark:border-[#262626]">
                  <tr>
                    <th className="text-left px-4 py-3 font-medium">Value ID</th>
                    <th className="text-left px-4 py-3 font-medium">Variation</th>
                    <th className="text-left px-4 py-3 font-medium">Attribute</th>
                    <th className="text-left px-4 py-3 font-medium">Term</th>
                    <th className="text-left px-4 py-3 font-medium">Value Swatch</th>
                    <th className="text-left px-4 py-3 font-medium hidden md:table-cell">Created</th>
                    <th className="text-right px-4 py-3 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-[#262626]">
                  {docs.map((v) => {
                    const variation = v.variation || (v as any).variationBrief
                    const sku = variation?.sku || (typeof v.variation_id === 'number' ? `#${v.variation_id}` : '—')
                    const prod = variation?.product
                    const prodName = typeof prod === 'object' && prod ? prod.name || prod.slug : ''
                    const termVal = v.term?.value || ''
                    const isHex = termVal ? /^#[0-9A-Fa-f]{6}$/.test(termVal) : false
                    return (
                      <tr key={v.id} className="hover:bg-gray-50 dark:hover:bg-[#0a0a0a]/50 transition">
                        <td className="px-4 py-3">
                          <span className="font-mono text-xs font-semibold text-gray-900 dark:text-white">#{v.id}</span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="min-w-[160px]">
                            <div className="font-mono text-xs font-semibold text-gray-900 dark:text-white">{sku}</div>
                            {variation?.name && <div className="text-xs text-gray-600 dark:text-[#a1a1aa] truncate max-w-[180px]">{variation.name}</div>}
                            {prodName && <div className="text-[11px] text-gray-500 truncate max-w-[160px]">{prodName}</div>}
                            {!variation && v.variation_id && <div className="text-xs text-gray-500">#{v.variation_id}</div>}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          {v.attribute ? (
                            <div className="min-w-[120px]">
                              <div className="text-xs font-medium text-gray-900 dark:text-white truncate max-w-[140px]">{v.attribute.name}</div>
                              <div className="text-[11px] text-gray-500 font-mono">{v.attribute.slug}</div>
                              <span className={`inline-flex mt-1 px-1.5 py-0.5 rounded-full text-[11px] font-medium border capitalize ${typeBadge(v.attribute.type)}`}>{v.attribute.type}</span>
                            </div>
                          ) : (
                            <span className="text-xs text-gray-500 font-mono">#{v.attribute_id ?? '—'}</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {v.term ? (
                            <div className="min-w-[120px]">
                              <div className="text-xs font-medium text-gray-900 dark:text-white truncate max-w-[140px]">{v.term.name}</div>
                              <div className="text-[11px] text-gray-500 font-mono">{v.term.slug}</div>
                            </div>
                          ) : (
                            <span className="text-xs text-gray-500 font-mono">#{v.term_id ?? '—'}</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {termVal ? (
                            <span className="inline-flex items-center gap-2">
                              {isHex && <span className="h-5 w-5 rounded-full border border-gray-200 dark:border-[#333] shrink-0" style={{ backgroundColor: termVal }} />}
                              <span className={`text-xs ${isHex ? 'font-mono font-medium text-gray-900 dark:text-white' : 'text-gray-700 dark:text-[#a1a1aa]'}`}>{termVal}</span>
                            </span>
                          ) : (
                            <span className="text-xs text-gray-400">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3 hidden md:table-cell">
                          <span className="text-xs text-gray-500 flex items-center gap-1"><CalendarDays className="w-3 h-3" /> {fmtDate(v.createdAt)}</span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="inline-flex items-center gap-1">
                            <Link href={`/catalog/variation-values/${v.id}`} className="h-7 w-7 inline-flex items-center justify-center rounded-lg hover:bg-gray-100 dark:hover:bg-[#262626] text-gray-500 dark:text-[#a1a1aa] hover:text-gray-900 dark:hover:text-white" title="View"><Eye className="w-4 h-4" /></Link>
                            <Link href={`/catalog/variation-values/${v.id}/edit`} className="h-7 w-7 inline-flex items-center justify-center rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/20 text-gray-500 dark:text-[#a1a1aa] hover:text-blue-600 dark:hover:text-blue-400" title="Edit"><Pencil className="w-4 h-4" /></Link>
                            <button onClick={() => { setDeleting(v); setDeleteError(null) }} className="h-7 w-7 inline-flex items-center justify-center rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-gray-500 dark:text-[#a1a1aa] hover:text-red-600 dark:hover:text-red-400" title="Delete"><Trash2 className="w-4 h-4" /></button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {pagination && pagination.totalDocs > 0 && !loading && (
              <div className="px-4 py-3 border-t border-gray-200 dark:border-[#262626] flex flex-col sm:flex-row items-center justify-between gap-3 text-sm">
                <div className="text-gray-600 dark:text-[#a1a1aa]">Page {pagination.page} of {pagination.totalPages} • {pagination.totalDocs} values • 10 per page</div>
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
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={() => { if (!isDeleting) { setDeleting(null); setDeleteError(null) } }}>
            <div
              className="relative bg-white dark:bg-[#171717] rounded-2xl shadow-2xl border border-gray-200 dark:border-[#262626] w-full max-w-md p-6 animate-in fade-in zoom-in-95"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="h-12 w-12 rounded-full bg-red-50 dark:bg-red-900/20 flex items-center justify-center mb-4"><Trash2 className="w-6 h-6 text-red-600" /></div>
              <h3 className="font-bold text-gray-900 dark:text-white">Delete variation value?</h3>
              <p className="text-sm text-gray-600 dark:text-[#a1a1aa] mt-1">This will permanently delete value <span className="font-semibold text-gray-900 dark:text-white">#{deleting.id}</span> (variation <span className="font-mono">{(deleting.variation as any)?.sku || `#${deleting.variation_id}`}</span> → attribute <span className="font-mono">{deleting.attribute?.name || `#${deleting.attribute_id}`}</span> → <span className="font-mono">{deleting.term?.name || `#${deleting.term_id}`}</span>). This action cannot be undone.</p>
              {deleteError && <div className="mt-3 p-2.5 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-xs text-red-700 dark:text-red-300">{deleteError}</div>}
              <div className="flex gap-2 mt-6">
                <button onClick={() => { setDeleting(null); setDeleteError(null) }} disabled={isDeleting} className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 dark:border-[#262626] text-sm font-medium bg-white dark:bg-[#171717] hover:bg-gray-50 dark:hover:bg-[#262626] disabled:opacity-50 disabled:cursor-not-allowed">Cancel</button>
                <button onClick={() => handleDelete()} disabled={isDeleting} className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed">
                  {isDeleting && <RefreshCw className="w-4 h-4 animate-spin" />}
                  {isDeleting ? 'Deleting…' : 'Confirm delete'}
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
    </div>
  )
}

export default function VariationValuesPage(){
  return (
    <ClientOnly fallback={<VariationValuesSkeleton />}>
      <VariationValuesPageContent />
    </ClientOnly>
  )
}
