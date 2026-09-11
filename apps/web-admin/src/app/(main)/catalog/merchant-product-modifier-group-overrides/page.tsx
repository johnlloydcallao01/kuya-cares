'use client'

import React, { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import Link from 'next/link'
import { useQueryClient } from '@tanstack/react-query'
import { QUERY_KEYS } from '@encreasl/client-services'
import { ClientOnly } from '@/components/ClientOnly'
import { useMerchantProductModifierGroupOverrides, type OverrideDoc, type MerchantProductModifierGroupOverridesResponse } from '@/hooks/useMerchantProductModifierGroupOverrides'
import {
  Building, Search, X, SlidersHorizontal, ChevronDown, Plus, RefreshCw, AlertCircle,
  Package, CheckCircle, Eye, Pencil, Trash2, Layers, ToggleLeft, Tag
} from '@/components/ui/IconWrapper'

const MODE_OPTS: { value: string; label: string }[] = [
  { value: 'inherit', label: 'Inherit' },
  { value: 'hide', label: 'Hide' },
  { value: 'override', label: 'Override' },
]
const REQUIRED_OPTS: { value: string; label: string }[] = [
  { value: 'inherit', label: 'Inherit' },
  { value: 'required', label: 'Required' },
  { value: 'optional', label: 'Optional' },
]

function modeBadge(m: string) {
  const v = m.toLowerCase()
  if (v === 'inherit') return 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/20 dark:text-blue-300 dark:border-blue-800'
  if (v === 'hide') return 'bg-zinc-100 text-zinc-700 border-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:border-zinc-700'
  return 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-300 dark:border-amber-800'
}
function requiredBadge(v: string) {
  const t = v.toLowerCase()
  if (t === 'required') return 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-300'
  if (t === 'optional') return 'bg-zinc-100 text-zinc-600 border-zinc-200 dark:bg-zinc-800 dark:text-zinc-400'
  return 'bg-gray-100 text-gray-700 border-gray-200 dark:bg-zinc-800 dark:text-zinc-400'
}
function merchantProductLabel(v: OverrideDoc['merchant_product_id']) {
  if (!v) return '—'
  if (typeof v === 'number') return `#${v}`
  return (v as any).display_title ? `${(v as any).display_title} (#${(v as any).id})` : `#${(v as any).id}`
}
function groupLabel(g: OverrideDoc['base_modifier_group_id']) {
  if (!g) return '—'
  if (typeof g === 'number') return `#${g}`
  return (g as any).name || `#${(g as any).id}`
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

function MerchantProductModifierGroupOverridesSkeleton(){
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

function MerchantProductModifierGroupOverridesPageContent(){
  const [q, setQ] = useState('')
  const [debouncedQ, setDebouncedQ] = useState('')
  const [merchantProductFilter, setMerchantProductFilter] = useState('')
  const [merchantProductChoices, setMerchantProductChoices] = useState<{ id: number; display_title: string; productId: number | null }[]>([])
  const [baseGroupFilter, setBaseGroupFilter] = useState('')
  const [baseGroupChoices, setBaseGroupChoices] = useState<{ id: number; name: string }[]>([])
  const [modeFilter, setModeFilter] = useState<string[]>([])
  const [requiredFilter, setRequiredFilter] = useState<string[]>([])
  const [isActiveFilter, setIsActiveFilter] = useState<boolean | null>(null)
  const [sort, setSort] = useState<string>('-createdAt')
  const [page, setPage] = useState(1)
  const limit = 10
  const [showFilters, setShowFilters] = useState(false)

  const [deleting, setDeleting] = useState<OverrideDoc | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  useEffect(() => { const id = setTimeout(() => setDebouncedQ(q.trim()), 400); return () => clearTimeout(id) }, [q])

  useEffect(() => {
    fetch('/api/merchant-products?limit=100', { cache: 'no-store' })
      .then((r) => r.json())
      .then((j) => {
        const docsArr: any[] = j.docs || j.data?.docs || []
        setMerchantProductChoices(docsArr.map((d: any) => ({ id: d.id, display_title: d.display_title || d.displayTitle || `#${d.id}`, productId: d.product_id != null ? (typeof d.product_id === 'number' ? d.product_id : Number(d.product_id?.id ?? null)) : (d.product != null ? (typeof d.product === 'number' ? d.product : Number(d.product?.id ?? null)) : null) })))
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    const mpId = merchantProductFilter.trim()
    if (!mpId) {
      fetch('/api/catalog/modifier-groups?limit=50', { cache: 'no-store' })
        .then((r) => r.json())
        .then((j) => {
          const arr: any[] = j.docs || []
          setBaseGroupChoices(arr.map((d: any) => ({ id: d.id, name: d.name || `#${d.id}` })))
        })
        .catch(() => {})
      return
    }
    const chosen = merchantProductChoices.find((v) => String(v.id) === mpId)
    let pid = chosen?.productId ?? null
    const doFetch = async (productId: number) => {
      try {
        const res = await fetch(`/api/catalog/modifier-groups?productId=${productId}&limit=100`, { cache: 'no-store' })
        const j = await res.json()
        const arr: any[] = j.docs || []
        setBaseGroupChoices(arr.map((d: any) => ({ id: d.id, name: d.name || `#${d.id}` })))
      } catch { setBaseGroupChoices([]) }
    }
    if (pid != null && Number.isFinite(pid)) {
      void doFetch(pid)
    } else {
      fetch(`/api/merchant-products/${mpId}`, { cache: 'no-store' })
        .then((r) => r.json())
        .then((j) => {
          const doc = j.doc || j.data || j
          const prod = doc?.product_id ?? doc?.product
          const npid = prod != null ? (typeof prod === 'number' ? prod : Number(prod?.id ?? null)) : null
          if (npid != null && Number.isFinite(npid)) void doFetch(npid)
          else setBaseGroupChoices([])
        })
        .catch(() => setBaseGroupChoices([]))
    }
  }, [merchantProductFilter, merchantProductChoices])

  const activeFilterCount = useMemo(() => {
    return modeFilter.length + requiredFilter.length + (isActiveFilter !== null ? 1 : 0) + (merchantProductFilter.trim() ? 1 : 0) + (baseGroupFilter.trim() ? 1 : 0) + (debouncedQ ? 1 : 0)
  }, [modeFilter, requiredFilter, isActiveFilter, merchantProductFilter, baseGroupFilter, debouncedQ])

  const qs = useMemo(() => {
    const p = new URLSearchParams()
    p.set('page', String(page))
    p.set('limit', String(limit))
    p.set('sort', sort)
    if (debouncedQ) p.set('search', debouncedQ)
    if (modeFilter.length) p.set('mode', modeFilter.join(','))
    if (requiredFilter.length) p.set('required_behavior', requiredFilter.join(','))
    if (isActiveFilter !== null) p.set('is_active', String(isActiveFilter))
    if (merchantProductFilter.trim()) p.set('merchant_product_id', merchantProductFilter.trim())
    if (baseGroupFilter.trim()) p.set('base_modifier_group_id', baseGroupFilter.trim())
    return p.toString()
  }, [page, limit, sort, debouncedQ, modeFilter, requiredFilter, isActiveFilter, merchantProductFilter, baseGroupFilter])

  const queryClient = useQueryClient()
  const [hardRefreshing, setHardRefreshing] = useState(false)
  const { data, isPending, isFetching, isError, error: queryError, refetch } = useMerchantProductModifierGroupOverrides(qs)

  const docs = data?.docs || []
  const pagination = data?.pagination || null
  const stats = data?.stats || null

  const isInitialLoading = (isPending && !data) || hardRefreshing
  const loading = isFetching || hardRefreshing
  const error = isError && !data && !hardRefreshing ? (queryError instanceof Error ? queryError.message : 'Failed to load overrides') : null

  const handleHardRefresh = () => {
    if (hardRefreshing) return
    setHardRefreshing(true)
    void (async () => {
      try {
        queryClient.removeQueries({ queryKey: QUERY_KEYS.adminCatalogMerchantProductModifierGroupOverrides(qs) })
        await refetch({ cancelRefetch: true })
      } finally { setHardRefreshing(false) }
    })()
  }

  useEffect(() => { setPage(1) }, [debouncedQ, modeFilter, requiredFilter, isActiveFilter, merchantProductFilter, baseGroupFilter, sort])

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

  const toggleMode = (v: string) => setModeFilter((prev) => prev.includes(v) ? prev.filter((x) => x !== v) : [...prev, v])
  const toggleRequired = (v: string) => setRequiredFilter((prev) => prev.includes(v) ? prev.filter((x) => x !== v) : [...prev, v])
  const clearAll = () => { setQ(''); setDebouncedQ(''); setModeFilter([]); setRequiredFilter([]); setIsActiveFilter(null); setMerchantProductFilter(''); setBaseGroupFilter('') }

  const handleDelete = async () => {
    if (!deleting || isDeleting) return
    setIsDeleting(true)
    try {
      const res = await fetch(`/api/catalog/merchant-product-modifier-group-overrides/${deleting.id}`, { method: 'DELETE' })
      const j = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(j.error || 'Failed to delete')
      const deletedId = deleting.id
      // Optimistic removal across every cached overrides list (all pages/filters).
      // Segment-guard keeps sibling catalog queries untouched.
      // The row vanishes instantly even while the CMS Redis list cache
      // is still converging; invalidate+refetch below reconciles with the server.
      queryClient.setQueriesData<MerchantProductModifierGroupOverridesResponse>(
        {
          queryKey: ['admin', 'catalog', 'merchant-product-modifier-group-overrides'],
          predicate: (q) => q.queryKey.length === 4 && q.queryKey[2] === 'merchant-product-modifier-group-overrides' && typeof q.queryKey[3] === 'string',
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
      // Bust every cached overrides list (all pages/filters) so the removal
      // reconciles with the server instead of waiting out the 3-min staleTime.
      await queryClient.invalidateQueries({ queryKey: ['admin', 'catalog', 'merchant-product-modifier-group-overrides'] })
      await refetch()
    } catch (e: any) { alert(e?.message || 'Delete failed') }
    finally { setIsDeleting(false) }
  }

  return (
    <div className="space-y-6 py-5 px-2.5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white tracking-tight flex items-center gap-2">
            <span className="h-10 w-10 rounded-xl bg-[#eba236] text-white flex items-center justify-center"><Layers className="w-5 h-5" /></span>
            Merchant Product Modifier Group Overrides
          </h1>
          <p className="text-sm text-gray-500 dark:text-[#a1a1aa] mt-1">Merchant-level overrides for inherited product modifier groups — inherit, hide or override per merchant product.</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleHardRefresh}
            disabled={loading}
            aria-label="Refresh overrides"
            title="Refresh — re-fetch from BFF and show skeleton"
            className="h-9 w-9 inline-flex items-center justify-center bg-white dark:bg-[#171717] border border-gray-200 dark:border-[#262626] rounded-xl hover:bg-gray-50 dark:hover:bg-[#262626] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <RefreshCw className={`w-4 h-4 text-gray-600 dark:text-[#a1a1aa] ${loading ? 'animate-spin' : ''}`} />
          </button>
          <Link href="/catalog/merchant-product-modifier-group-overrides/new" className="inline-flex items-center gap-2 px-4 py-2.5 bg-[#eba236] hover:bg-[#c88a20] text-white rounded-xl text-sm font-semibold shadow-sm transition">
            <Plus className="w-4 h-4" /> New Override
          </Link>
        </div>
      </div>

      {stats ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <KpiCard title="Total Overrides" value={String(stats.filteredTotal)} sub={`${stats.totalAll} overall`} icon={<Layers className="w-5 h-5 text-white" />} iconBg="bg-[#eba236]" />
          <KpiCard title="Inherit" value={String(stats.modeBreakdown.inherit || 0)} sub={`${stats.modeBreakdown.hide || 0} hide`} icon={<ToggleLeft className="w-5 h-5 text-white" />} iconBg="bg-blue-600" />
          <KpiCard title="Override" value={String(stats.modeBreakdown.override || 0)} sub={`${Math.round(((stats.modeBreakdown.override||0)/Math.max(1,stats.totalAll))*100)}%`} icon={<Tag className="w-5 h-5 text-white" />} iconBg="bg-amber-500" />
          <KpiCard title="Active" value={String(stats.activeCount)} sub={`${stats.inactiveCount} inactive`} icon={<CheckCircle className="w-5 h-5 text-white" />} iconBg="bg-emerald-500" />
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
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name override…" className="w-full pl-9 pr-9 py-2.5 text-sm bg-gray-50 dark:bg-[#0a0a0a] border border-gray-200 dark:border-[#262626] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#eba236]/20 focus:border-[#eba236] text-gray-900 dark:text-white placeholder:text-gray-400" />
            {q && <button onClick={() => setQ('')} className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-full hover:bg-gray-100 dark:hover:bg-[#262626]"><X className="w-4 h-4 text-gray-400" /></button>}
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-1 p-1 bg-gray-100 dark:bg-[#0a0a0a] rounded-full border border-gray-200 dark:border-[#262626]">
              <select value={sort} onChange={(e) => setSort(e.target.value)} className="px-3 py-1.5 rounded-full text-xs font-semibold bg-white dark:bg-[#171717] border border-gray-200 dark:border-[#333] text-gray-700 dark:text-white">
                <option value="-createdAt">Newest first</option>
                <option value="createdAt">Oldest first</option>
                <option value="name_override">Name A–Z</option>
                <option value="sort_order_override">Sort order</option>
                <option value="merchant_product_id">Merchant Product</option>
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
            <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
              <div>
                <p className="text-xs font-semibold text-gray-700 dark:text-[#a1a1aa] mb-2">Merchant Product</p>
                <select value={merchantProductFilter} onChange={(e) => { setMerchantProductFilter(e.target.value); setBaseGroupFilter('') }} className="w-full px-3 py-2.5 rounded-lg border border-gray-200 dark:border-[#262626] bg-white dark:bg-[#0a0a0a] text-sm text-gray-700 dark:text-white">
                  <option value="">All merchant products</option>
                  {merchantProductChoices.map((v) => (
                    <option key={v.id} value={String(v.id)}>{v.display_title} (#{v.id})</option>
                  ))}
                </select>
              </div>
              <div>
                <p className="text-xs font-semibold text-gray-700 dark:text-[#a1a1aa] mb-2">Base Group</p>
                <select value={baseGroupFilter} onChange={(e) => setBaseGroupFilter(e.target.value)} className="w-full px-3 py-2.5 rounded-lg border border-gray-200 dark:border-[#262626] bg-white dark:bg-[#0a0a0a] text-sm text-gray-700 dark:text-white">
                  <option value="">All groups</option>
                  {baseGroupChoices.map((g) => (
                    <option key={g.id} value={String(g.id)}>{g.name} (#{g.id})</option>
                  ))}
                </select>
              </div>
              <FilterPills label="Mode" options={MODE_OPTS} value={modeFilter} onToggle={toggleMode} />
              <FilterPills label="Required Behavior" options={REQUIRED_OPTS} value={requiredFilter} onToggle={toggleRequired} />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div>
                <p className="text-xs font-semibold text-gray-700 dark:text-[#a1a1aa] mb-2">Active</p>
                <div className="flex flex-wrap gap-1.5">
                  {[['all','All'],['true','Active only'],['false','Inactive only']].map(([v,l]) => {
                    const active = (isActiveFilter===null && v==='all') || String(isActiveFilter)===v
                    return <button key={v} onClick={() => setIsActiveFilter(v==='all'?null: v==='true')} className={`px-2.5 py-1 rounded-full text-xs font-medium border ${active ? 'bg-[#eba236] text-white border-[#eba236]' : 'bg-white dark:bg-[#0a0a0a] text-gray-700 dark:text-[#a1a1aa] border-gray-200 dark:border-[#262626]'}`}>{l}</button>
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
            {merchantProductFilter.trim() && <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-gray-100 dark:bg-[#262626] text-gray-700 dark:text-[#a1a1aa] rounded-full text-xs font-medium">merchant product:{merchantProductFilter} <button onClick={() => setMerchantProductFilter('')}><X className="w-3 h-3" /></button></span>}
            {baseGroupFilter.trim() && <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-gray-100 dark:bg-[#262626] text-gray-700 dark:text-[#a1a1aa] rounded-full text-xs font-medium">group:{baseGroupFilter} <button onClick={() => setBaseGroupFilter('')}><X className="w-3 h-3" /></button></span>}
            {modeFilter.map((v) => <span key={v} className="inline-flex items-center gap-1 px-2.5 py-1 bg-gray-100 dark:bg-[#262626] text-gray-700 dark:text-[#a1a1aa] rounded-full text-xs font-medium">mode:{v} <button onClick={() => toggleMode(v)}><X className="w-3 h-3" /></button></span>)}
            {requiredFilter.map((v) => <span key={v} className="inline-flex items-center gap-1 px-2.5 py-1 bg-gray-100 dark:bg-[#262626] text-gray-700 dark:text-[#a1a1aa] rounded-full text-xs font-medium">required:{v} <button onClick={() => toggleRequired(v)}><X className="w-3 h-3" /></button></span>)}
            {isActiveFilter !== null && <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-gray-100 dark:bg-[#262626] rounded-full text-xs">{isActiveFilter ? 'Active only' : 'Inactive only'} <button onClick={() => setIsActiveFilter(null)}><X className="w-3 h-3" /></button></span>}
          </div>
        )}
      </div>

      <div className="bg-white dark:bg-[#171717] rounded-xl border border-gray-200 dark:border-[#262626] shadow-sm overflow-hidden">
        {error && (
          <div className="flex flex-col items-center justify-center py-16 px-6">
            <div className="h-14 w-14 bg-red-50 dark:bg-red-900/20 rounded-full flex items-center justify-center mb-4"><AlertCircle className="h-7 w-7 text-red-500" /></div>
            <h3 className="font-semibold text-gray-900 dark:text-white">Failed to load overrides</h3>
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
            <h3 className="font-semibold text-gray-900 dark:text-white">No overrides found</h3>
            <p className="text-sm text-gray-500 dark:text-[#a1a1aa] mt-1 max-w-md">Try adjusting search or filters, or create your first merchant product modifier group override.</p>
            <Link href="/catalog/merchant-product-modifier-group-overrides/new" className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-[#eba236] text-white rounded-lg text-sm font-semibold"><Plus className="w-4 h-4" /> Create override</Link>
          </div>
        ) : !error && (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 dark:bg-[#0a0a0a] text-xs text-gray-500 dark:text-[#a1a1aa] border-b border-gray-200 dark:border-[#262626]">
                  <tr>
                    <th className="text-left px-4 py-3 font-medium">Merchant Product</th>
                    <th className="text-left px-4 py-3 font-medium">Base Group</th>
                    <th className="text-left px-4 py-3 font-medium">Mode</th>
                    <th className="text-left px-4 py-3 font-medium">Override Name</th>
                    <th className="text-left px-4 py-3 font-medium">Required</th>
                    <th className="text-left px-4 py-3 font-medium">Active</th>
                    <th className="text-right px-4 py-3 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-[#262626]">
                  {docs.map((d) => (
                    <tr key={d.id} className="hover:bg-gray-50 dark:hover:bg-[#0a0a0a]/50 transition">
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center gap-1 px-2 py-1 bg-white dark:bg-[#0a0a0a] border border-gray-200 dark:border-[#262626] rounded-full text-xs font-medium text-gray-700 dark:text-white"><Package className="w-3 h-3 text-[#eba236]" /> {merchantProductLabel(d.merchant_product_id)}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center gap-1 px-2 py-1 bg-white dark:bg-[#0a0a0a] border border-gray-200 dark:border-[#262626] rounded-full text-xs font-medium text-gray-700 dark:text-white"><Layers className="w-3 h-3 text-[#eba236]" /> {groupLabel(d.base_modifier_group_id)}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex px-2 py-1 rounded-full text-xs font-medium border capitalize ${modeBadge(d.mode)}`}>{d.mode}</span>
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-900 dark:text-white max-w-[180px] truncate">{d.name_override || '—'}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex px-2 py-1 rounded-full text-xs font-medium border capitalize ${requiredBadge(d.required_behavior)}`}>{d.required_behavior}</span>
                      </td>
                      <td className="px-4 py-3">
                        <button onClick={async () => {
                          const next = !d.is_active
                          const res = await fetch(`/api/catalog/merchant-product-modifier-group-overrides/${d.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ is_active: next }) })
                          if (!res.ok) { const j = await res.json().catch(()=>({})); alert(j.error || 'Failed to toggle') }
                          void refetch()
                        }} className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold border transition ${d.is_active ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-300' : 'bg-zinc-100 text-zinc-600 border-zinc-200 dark:bg-zinc-800 dark:text-zinc-400'}`}>
                          <span className={`h-2 w-2 rounded-full ${d.is_active ? 'bg-emerald-500' : 'bg-zinc-400'}`} /> {d.is_active ? 'Active' : 'Inactive'}
                        </button>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="inline-flex items-center gap-1">
                          <Link href={`/catalog/merchant-product-modifier-group-overrides/${d.id}`} className="h-7 w-7 inline-flex items-center justify-center rounded-lg hover:bg-gray-100 dark:hover:bg-[#262626] text-gray-500 dark:text-[#a1a1aa] hover:text-gray-900 dark:hover:text-white" title="View"><Eye className="w-4 h-4" /></Link>
                          <Link href={`/catalog/merchant-product-modifier-group-overrides/${d.id}/edit`} className="h-7 w-7 inline-flex items-center justify-center rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/20 text-gray-500 dark:text-[#a1a1aa] hover:text-blue-600 dark:hover:text-blue-400" title="Edit"><Pencil className="w-4 h-4" /></Link>
                          <button onClick={() => setDeleting(d)} className="h-7 w-7 inline-flex items-center justify-center rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-gray-500 dark:text-[#a1a1aa] hover:text-red-600 dark:hover:text-red-400" title="Delete"><Trash2 className="w-4 h-4" /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {pagination && pagination.totalDocs > 0 && !loading && (
              <div className="px-4 py-3 border-t border-gray-200 dark:border-[#262626] flex flex-col sm:flex-row items-center justify-between gap-3 text-sm">
                <div className="text-gray-600 dark:text-[#a1a1aa]">Page {pagination.page} of {pagination.totalPages} • {pagination.totalDocs} overrides • 10 per page</div>
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
            <div
              className="relative bg-white dark:bg-[#171717] rounded-2xl shadow-2xl border border-gray-200 dark:border-[#262626] w-full max-w-md p-6 animate-in fade-in zoom-in-95"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="h-12 w-12 rounded-full bg-red-50 dark:bg-red-900/20 flex items-center justify-center mb-4"><Trash2 className="w-6 h-6 text-red-600" /></div>
              <h3 className="font-bold text-gray-900 dark:text-white">Delete override?</h3>
              <p className="text-sm text-gray-600 dark:text-[#a1a1aa] mt-1">This will permanently delete override <span className="font-semibold text-gray-900 dark:text-white">#{deleting.id}</span> for merchant product <span className="font-semibold">{merchantProductLabel(deleting.merchant_product_id)}</span> → {groupLabel(deleting.base_modifier_group_id)}. This action cannot be undone.</p>
              <div className="flex gap-2 mt-6">
                <button onClick={() => setDeleting(null)} disabled={isDeleting} className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 dark:border-[#262626] text-sm font-medium bg-white dark:bg-[#171717] hover:bg-gray-50 dark:hover:bg-[#262626] disabled:opacity-50 disabled:cursor-not-allowed">Cancel</button>
                <button onClick={handleDelete} disabled={isDeleting} className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed">
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

export default function MerchantProductModifierGroupOverridesPage(){
  return (
    <ClientOnly fallback={<MerchantProductModifierGroupOverridesSkeleton />}>
      <MerchantProductModifierGroupOverridesPageContent />
    </ClientOnly>
  )
}
