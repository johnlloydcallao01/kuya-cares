'use client'

import React, { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import Link from 'next/link'
import { useQueryClient } from '@tanstack/react-query'
import { QUERY_KEYS } from '@encreasl/client-services'
import { useUsers, useUserDependencies, type UserDoc } from '@/hooks/useUsers'
import { ClientOnly } from '@/components/ClientOnly'
import {
  Users, Search, X, SlidersHorizontal, ChevronDown, Plus, RefreshCw, AlertCircle,
  ShieldCheck, ShieldAlert, Clock, CheckCircle, XCircle, Eye, Pencil, Trash2,
  Mail, Phone, CalendarDays, Loader2, Layers, Building, Store, ShoppingBag, ShoppingCart, Package, FileText, MapPin, Bell, History, Heart, AlertTriangle, Link as LinkIcon, Info, Truck,
} from '@/components/ui/IconWrapper'

const ROLE_OPTS: { value: string; label: string }[] = [
  { value: 'admin', label: 'Admin' },
  { value: 'customer', label: 'Customer' },
  { value: 'vendor', label: 'Vendor' },
  { value: 'driver', label: 'Driver' },
  { value: 'service', label: 'Service' },
]
const GENDER_OPTS: { value: string; label: string }[] = [
  { value: 'male', label: 'Male' },
  { value: 'female', label: 'Female' },
  { value: 'other', label: 'Other' },
  { value: 'prefer_not_to_say', label: 'Prefer not to say' },
]
const CIVIL_OPTS: { value: string; label: string }[] = [
  { value: 'single', label: 'Single' },
  { value: 'married', label: 'Married' },
  { value: 'divorced', label: 'Divorced' },
  { value: 'widowed', label: 'Widowed' },
  { value: 'separated', label: 'Separated' },
]

function roleBadge(role: string) {
  const r = role.toLowerCase()
  if (r === 'admin') return 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-300 dark:border-emerald-800'
  if (r === 'vendor') return 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-300 dark:border-amber-800'
  if (r === 'driver') return 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/20 dark:text-blue-300 dark:border-blue-800'
  if (r === 'customer') return 'bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-900/20 dark:text-violet-300 dark:border-violet-800'
  if (r === 'service') return 'bg-zinc-100 text-zinc-700 border-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:border-zinc-700'
  return 'bg-gray-100 text-gray-700 border-gray-200 dark:bg-zinc-800 dark:text-zinc-300'
}
function fmtDate(iso: string | null) {
  if (!iso) return '—'
  try { return new Date(iso).toLocaleDateString('en-PH', { timeZone: 'Asia/Manila', year: 'numeric', month: 'short', day: 'numeric' }) } catch { return String(iso).slice(0, 10) }
}
function initials(first: string, last: string) {
  const a = (first?.[0] || '').toUpperCase()
  const b = (last?.[0] || '').toUpperCase()
  const s = `${a}${b}`.trim()
  return s || 'U'
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

function UsersSkeleton(){
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

function UsersPageContent(){
  // query state
  const [q, setQ] = useState('')
  const [debouncedQ, setDebouncedQ] = useState('')
  const [roleFilter, setRoleFilter] = useState<string[]>([])
  const [genderFilter, setGenderFilter] = useState<string[]>([])
  const [civilFilter, setCivilFilter] = useState<string[]>([])
  const [isActiveFilter, setIsActiveFilter] = useState<boolean | null>(null)
  const [sort, setSort] = useState<string>('-createdAt')
  const [page, setPage] = useState(1)
  const limit = 10 // fixed 10 per page as required — pagination must display 10
  const [showFilters, setShowFilters] = useState(false)

  // delete confirm — WordPress-style: offer Delete all content vs Attribute to another user
  const [deleting, setDeleting] = useState<UserDoc | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [reassignMode, setReassignMode] = useState<'delete' | 'reassign'>('reassign')
  const [reassignTo, setReassignTo] = useState<string>('')

  // view dependencies — enterprise inspection before delete (read-only)
  const [viewingDeps, setViewingDeps] = useState<UserDoc | null>(null)

  useEffect(() => { const id = setTimeout(() => setDebouncedQ(q.trim()), 400); return () => clearTimeout(id) }, [q])

  const activeFilterCount = useMemo(() => {
    return roleFilter.length + genderFilter.length + civilFilter.length + (isActiveFilter !== null ? 1 : 0) + (debouncedQ ? 1 : 0)
  }, [roleFilter, genderFilter, civilFilter, isActiveFilter, debouncedQ])

  const qs = useMemo(() => {
    const p = new URLSearchParams()
    p.set('page', String(page))
    p.set('limit', String(limit))
    p.set('sort', sort)
    if (debouncedQ) p.set('search', debouncedQ)
    if (roleFilter.length) p.set('role', roleFilter.join(','))
    if (genderFilter.length) p.set('gender', genderFilter.join(','))
    if (civilFilter.length) p.set('civilStatus', civilFilter.join(','))
    if (isActiveFilter !== null) p.set('isActive', String(isActiveFilter))
    return p.toString()
  }, [page, limit, sort, debouncedQ, roleFilter, genderFilter, civilFilter, isActiveFilter])

  const queryClient = useQueryClient()
  const [hardRefreshing, setHardRefreshing] = useState(false)
  const { data, isPending, isFetching, isError, error: queryError, refetch } = useUsers(qs)
  const candidatesQuery = useUsers('limit=100&isActive=true')
  const depsQuery = useUserDependencies(viewingDeps?.id ?? null)

  const docs = data?.docs || []
  const pagination = data?.pagination || null
  const stats = data?.stats || null

  const isInitialLoading = (isPending && !data) || hardRefreshing
  const loading = isFetching || hardRefreshing
  const error = isError && !data && !hardRefreshing ? (queryError instanceof Error ? queryError.message : 'Failed to load users') : null

  const handleHardRefresh = () => {
    if (hardRefreshing) return
    setHardRefreshing(true)
    void (async () => {
      try {
        queryClient.removeQueries({ queryKey: QUERY_KEYS.adminUsers(qs) })
        await refetch({ cancelRefetch: true })
      } finally { setHardRefreshing(false) }
    })()
  }

  useEffect(() => { setPage(1) }, [debouncedQ, roleFilter, genderFilter, civilFilter, isActiveFilter, sort])

  // Prevent page scroll when delete confirm is open
  useEffect(() => {
    const isOpen = !!deleting || !!deleteError || !!viewingDeps
    if (isOpen) {
      const prev = document.body.style.overflow
      document.body.style.overflow = 'hidden'
      return () => { document.body.style.overflow = prev }
    }
    document.body.style.overflow = ''
    return () => { document.body.style.overflow = '' }
  }, [deleting, deleteError, viewingDeps])

  // WordPress: reassignment candidates (active users excluding target) — cached via shared hook
  const reassignCandidates = useMemo(() => {
    const all = candidatesQuery.data?.docs || []
    if (!deleting) return []
    return all.filter((u) => String(u.id) !== String(deleting.id))
  }, [candidatesQuery.data, deleting])
  const loadingCandidates = candidatesQuery.isFetching

  useEffect(() => {
    if (!deleting) {
      setReassignMode('reassign')
      setReassignTo('')
      return
    }
    // default to reassign to encourage safe choice (WordPress safe default is Attribute)
    setReassignMode('reassign')
    setReassignTo((prev) => {
      if (prev) return prev
      return reassignCandidates.length > 0 ? String(reassignCandidates[0].id) : ''
    })
  }, [deleting, reassignCandidates])

  // View dependencies — cached query, runs only while the modal is open
  const depsData = depsQuery.data || null
  const depsLoading = depsQuery.isFetching
  const depsError = depsQuery.isError && !depsQuery.data
    ? (depsQuery.error instanceof Error ? depsQuery.error.message : 'Failed to load dependencies')
    : null

  // Auto-dismiss action error toast (professional, non-blocking)
  useEffect(() => {
    if (!actionError) return
    const t = setTimeout(() => setActionError(null), 4200)
    return () => clearTimeout(t)
  }, [actionError])

  const toggleRole = (v: string) => setRoleFilter((prev) => prev.includes(v) ? prev.filter((x) => x !== v) : [...prev, v])
  const toggleGender = (v: string) => setGenderFilter((prev) => prev.includes(v) ? prev.filter((x) => x !== v) : [...prev, v])
  const toggleCivil = (v: string) => setCivilFilter((prev) => prev.includes(v) ? prev.filter((x) => x !== v) : [...prev, v])
  const clearAll = () => { setQ(''); setDebouncedQ(''); setRoleFilter([]); setGenderFilter([]); setCivilFilter([]); setIsActiveFilter(null) }

  const toFriendlyDeleteError = (raw: string) => {
    const lower = raw.toLowerCase()
    if (lower.includes('failed query') || lower.includes('params:') || lower.includes('delete from "users"') || lower.includes('delete from')) {
      return 'Cannot delete this user — the account is still linked to other records (such as a vendor profile, orders, addresses, or activity history). Please remove or reassign those records first, or deactivate the user instead.'
    }
    if (lower.includes('foreign key') || lower.includes('violates') || lower.includes('constraint') || lower.includes('still referenced')) {
      return 'Cannot delete this user — the account is still linked to other records. Please remove or reassign those linked records first, or deactivate the user instead.'
    }
    return raw
  }

  const handleDelete = async () => {
    if (!deleting || isDeleting) return
    // WordPress parity: validate choice
    if (reassignMode === 'reassign' && !reassignTo) {
      setDeleteError('Please select a user to attribute the content to.')
      return
    }
    setIsDeleting(true)
    setDeleteError(null)
    try {
      const qs = reassignMode === 'reassign' && reassignTo ? `?reassignTo=${encodeURIComponent(reassignTo)}` : reassignMode === 'delete' ? '?force=true' : ''
      const res = await fetch(`/api/users/${deleting.id}${qs}`, { method: 'DELETE' })
      const j = await res.json().catch(() => ({}))
      if (!res.ok) {
        // If backend says REASSIGN_REQUIRED, keep modal open and surface friendly message (don't close)
        const code = (j as any)?.code
        const errMsg = toFriendlyDeleteError(j.error || j.details || 'Failed to delete')
        if (code === 'REASSIGN_REQUIRED' || j.counts) {
          // Switch to reassign mode and show counts hint in error toast area inside modal
          setReassignMode('reassign')
          throw new Error(errMsg + ' Please choose “Attribute all content to” and select a user, or choose “Delete all content”.')
        }
        throw new Error(errMsg)
      }
      setDeleting(null)
      queryClient.removeQueries({ queryKey: QUERY_KEYS.adminUserDependencies(deleting.id) })
      await queryClient.invalidateQueries({ queryKey: QUERY_KEYS.adminUsers('limit=100&isActive=true') })
      await refetch()
    } catch (e: any) { setDeleteError(toFriendlyDeleteError(e?.message || 'Delete failed')) }
    finally { setIsDeleting(false) }
  }

  return (
    <div className="space-y-6 py-5 px-2.5">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white tracking-tight flex items-center gap-2">
            <span className="h-8 w-8 rounded-lg bg-[#eba236] text-white flex items-center justify-center"><Users className="w-4 h-4" /></span>
            Users
          </h1>
          <p className="text-sm text-gray-500 dark:text-[#a1a1aa] mt-1">Manage platform users — search by name, email or phone, filter by role and status, and review account details.</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleHardRefresh}
            disabled={loading}
            aria-label="Refresh users"
            title="Refresh — re-fetch from BFF and show skeleton"
            className="h-9 w-9 inline-flex items-center justify-center bg-white dark:bg-[#171717] border border-gray-200 dark:border-[#262626] rounded-xl hover:bg-gray-50 dark:hover:bg-[#262626] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <RefreshCw className={`w-4 h-4 text-gray-600 dark:text-[#a1a1aa] ${loading ? 'animate-spin' : ''}`} />
          </button>
          <Link href="/users/new" className="inline-flex items-center gap-2 px-4 py-2.5 bg-[#eba236] hover:bg-[#c88a20] text-white rounded-xl text-sm font-semibold shadow-sm transition">
            <Plus className="w-4 h-4" /> New User
          </Link>
        </div>
      </div>

      {/* KPIs */}
      {stats ? (
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
          <KpiCard title="Total Users" value={String(stats.filteredTotal)} sub={`${stats.totalAll} overall`} icon={<Users className="w-5 h-5 text-white" />} iconBg="bg-[#eba236]" />
          <KpiCard title="Active" value={String(stats.activeCount)} sub={`${stats.inactiveCount} inactive`} icon={<CheckCircle className="w-5 h-5 text-white" />} iconBg="bg-emerald-500" />
          <KpiCard title="Inactive" value={String(stats.inactiveCount)} sub={`${Math.round(((stats.inactiveCount)/Math.max(1,stats.totalAll))*100)}% of users`} icon={<XCircle className="w-5 h-5 text-white" />} iconBg="bg-zinc-600" />
          <KpiCard title="Admins" value={String(stats.roleBreakdown.admin || 0)} sub={`${stats.roleBreakdown.customer || 0} customers`} icon={<ShieldCheck className="w-5 h-5 text-white" />} iconBg="bg-blue-600" />
          <KpiCard title="Vendors / Drivers" value={String((stats.roleBreakdown.vendor || 0) + (stats.roleBreakdown.driver || 0))} sub={`${stats.roleBreakdown.vendor || 0} vendors • ${stats.roleBreakdown.driver || 0} drivers`} icon={<ShieldAlert className="w-5 h-5 text-white" />} iconBg="bg-amber-500" />
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
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, email, username, phone…" className="w-full pl-9 pr-9 py-2.5 text-sm bg-gray-50 dark:bg-[#0a0a0a] border border-gray-200 dark:border-[#262626] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#eba236]/20 focus:border-[#eba236] text-gray-900 dark:text-white placeholder:text-gray-400" />
            {q && <button onClick={() => setQ('')} className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-full hover:bg-gray-100 dark:hover:bg-[#262626]"><X className="w-4 h-4 text-gray-400" /></button>}
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-1 p-1 bg-gray-100 dark:bg-[#0a0a0a] rounded-full border border-gray-200 dark:border-[#262626]">
              <select value={sort} onChange={(e) => setSort(e.target.value)} className="px-3 py-1.5 rounded-full text-xs font-semibold bg-white dark:bg-[#171717] border border-gray-200 dark:border-[#333] text-gray-700 dark:text-white">
                <option value="-createdAt">Newest first</option>
                <option value="createdAt">Oldest first</option>
                <option value="firstName">First name A–Z</option>
                <option value="lastName">Last name A–Z</option>
                <option value="email">Email A–Z</option>
                <option value="-lastLogin">Recent login</option>
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
              <FilterPills label="Role" options={ROLE_OPTS} value={roleFilter} onToggle={toggleRole} />
              <FilterPills label="Gender" options={GENDER_OPTS} value={genderFilter} onToggle={toggleGender} />
              <div>
                <p className="text-xs font-semibold text-gray-700 dark:text-[#a1a1aa] mb-2">Account Status</p>
                <div className="flex flex-wrap gap-1.5">
                  {[['all','All'],['true','Active only'],['false','Inactive only']].map(([v,l]) => {
                    const active = (isActiveFilter===null && v==='all') || String(isActiveFilter)===v
                    return <button key={v} onClick={() => setIsActiveFilter(v==='all'?null: v==='true')} className={`px-2.5 py-1 rounded-full text-xs font-medium border ${active ? 'bg-[#eba236] text-white border-[#eba236]' : 'bg-white dark:bg-[#0a0a0a] text-gray-700 dark:text-[#a1a1aa] border-gray-200 dark:border-[#262626]'}`}>{l}</button>
                  })}
                </div>
                <div className="mt-4">
                  <FilterPills label="Civil Status" options={CIVIL_OPTS} value={civilFilter} onToggle={toggleCivil} />
                </div>
              </div>
            </div>
            <div className="flex justify-end"><button onClick={() => setShowFilters(false)} className="text-xs font-semibold text-[#eba236]">Done</button></div>
          </div>
        )}

        {activeFilterCount > 0 && !showFilters && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {debouncedQ && <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-[#eba236]/10 dark:bg-[#eba236]/15 text-[#8a5f17] dark:text-[#eba236] rounded-full text-xs font-medium border border-[#eba236]/30 dark:border-[#eba236]/30">Search: “{debouncedQ}” <button onClick={() => setQ('')}><X className="w-3 h-3" /></button></span>}
            {roleFilter.map((v) => <span key={v} className="inline-flex items-center gap-1 px-2.5 py-1 bg-gray-100 dark:bg-[#262626] text-gray-700 dark:text-[#a1a1aa] rounded-full text-xs font-medium">role:{v} <button onClick={() => toggleRole(v)}><X className="w-3 h-3" /></button></span>)}
            {genderFilter.map((v) => <span key={v} className="inline-flex items-center gap-1 px-2.5 py-1 bg-gray-100 dark:bg-[#262626] text-gray-700 dark:text-[#a1a1aa] rounded-full text-xs font-medium">gender:{v} <button onClick={() => toggleGender(v)}><X className="w-3 h-3" /></button></span>)}
            {civilFilter.map((v) => <span key={v} className="inline-flex items-center gap-1 px-2.5 py-1 bg-gray-100 dark:bg-[#262626] text-gray-700 dark:text-[#a1a1aa] rounded-full text-xs font-medium">{v} <button onClick={() => toggleCivil(v)}><X className="w-3 h-3" /></button></span>)}
            {isActiveFilter !== null && <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-gray-100 dark:bg-[#262626] rounded-full text-xs">{isActiveFilter ? 'Active only' : 'Inactive only'} <button onClick={() => setIsActiveFilter(null)}><X className="w-3 h-3" /></button></span>}
          </div>
        )}
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-[#171717] rounded-xl border border-gray-200 dark:border-[#262626] shadow-sm overflow-hidden">
        {error && (
          <div className="flex flex-col items-center justify-center py-16 px-6">
            <div className="h-14 w-14 bg-red-50 dark:bg-red-900/20 rounded-full flex items-center justify-center mb-4"><AlertCircle className="h-7 w-7 text-red-500" /></div>
            <h3 className="font-semibold text-gray-900 dark:text-white">Failed to load users</h3>
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
            <div className="h-16 w-16 bg-[#eba236]/10 dark:bg-[#eba236]/15 rounded-2xl flex items-center justify-center mb-4"><Users className="w-8 h-8 text-[#eba236]" /></div>
            <h3 className="font-semibold text-gray-900 dark:text-white">No users found</h3>
            <p className="text-sm text-gray-500 dark:text-[#a1a1aa] mt-1 max-w-md">Try adjusting search or filters, or create your first platform user.</p>
            <Link href="/users/new" className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-[#eba236] text-white rounded-lg text-sm font-semibold"><Plus className="w-4 h-4" /> Create user</Link>
          </div>
        ) : !error && (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 dark:bg-[#0a0a0a] text-xs text-gray-500 dark:text-[#a1a1aa] border-b border-gray-200 dark:border-[#262626]">
                  <tr>
                    <th className="text-left px-4 py-3 font-medium">User</th>
                    <th className="text-left px-4 py-3 font-medium">Role</th>
                    <th className="text-left px-4 py-3 font-medium hidden lg:table-cell">Contact</th>
                    <th className="text-left px-4 py-3 font-medium hidden xl:table-cell">Gender</th>
                    <th className="text-left px-4 py-3 font-medium">Status</th>
                    <th className="text-left px-4 py-3 font-medium hidden md:table-cell">Created</th>
                    <th className="text-right px-4 py-3 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-[#262626]">
                  {docs.map((u) => (
                    <tr key={u.id} className="hover:bg-gray-50 dark:hover:bg-[#0a0a0a]/50 transition">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3 min-w-[240px]">
                          <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-[#eba236] to-[#c88a20] text-white flex items-center justify-center text-xs font-bold shrink-0 overflow-hidden">
                            {u.profilePicture?.url ? <img src={u.profilePicture.url} alt={`${u.firstName} ${u.lastName}`} className="h-9 w-9 rounded-xl object-cover" /> : initials(u.firstName, u.lastName)}
                          </div>
                          <div className="min-w-0">
                            <div className="font-semibold text-gray-900 dark:text-white truncate max-w-[180px]">{u.firstName} {u.lastName}{u.middleName ? ` ${u.middleName}` : ''}</div>
                            <div className="text-xs text-gray-500 dark:text-[#a1a1aa] truncate max-w-[180px] flex items-center gap-1"><Mail className="w-3 h-3 text-gray-400 shrink-0" />{u.email}</div>
                            <div className="text-[11px] text-gray-400 flex items-center gap-1 mt-0.5">{u.username ? `@${u.username}` : `ID #${u.id}`}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold border capitalize ${roleBadge(u.role)}`}>
                          {u.role === 'admin' ? <ShieldCheck className="w-3 h-3" /> : u.role === 'vendor' ? <Clock className="w-3 h-3" /> : <Users className="w-3 h-3" />}
                          {u.role}
                        </span>
                      </td>
                      <td className="px-4 py-3 hidden lg:table-cell">
                        <div className="text-xs text-gray-900 dark:text-white flex items-center gap-1 truncate max-w-[160px]"><Phone className="w-3 h-3 text-gray-400" /> {u.phone || '—'}</div>
                        <div className="text-xs text-gray-500 truncate max-w-[160px]">{u.completeAddress ? u.completeAddress.slice(0, 40) : '—'}</div>
                      </td>
                      <td className="px-4 py-3 hidden xl:table-cell">
                        <span className="inline-flex px-2 py-1 rounded-full text-xs font-medium bg-gray-100 dark:bg-[#262626] text-gray-700 dark:text-[#a1a1aa] border border-gray-200 dark:border-[#333] capitalize">{u.gender ? u.gender.replace(/_/g, ' ') : '—'}</span>
                      </td>
                      <td className="px-4 py-3">
                        <button onClick={async () => {
                          const next = !u.isActive
                          const res = await fetch(`/api/users/${u.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ isActive: next }) })
                          if (!res.ok) { const j = await res.json().catch(()=>({})); setActionError(j.error || j.details || 'Failed to toggle status') }
                          void refetch()
                        }} className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold border transition ${u.isActive ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-300' : 'bg-zinc-100 text-zinc-600 border-zinc-200 dark:bg-zinc-800 dark:text-zinc-400'}`}>
                          <span className={`h-2 w-2 rounded-full ${u.isActive ? 'bg-emerald-500' : 'bg-zinc-400'}`} /> {u.isActive ? 'Active' : 'Inactive'}
                        </button>
                      </td>
                      <td className="px-4 py-3 hidden md:table-cell">
                        <div className="text-xs text-gray-900 dark:text-white flex items-center gap-1"><CalendarDays className="w-3 h-3 text-gray-400" />{fmtDate(u.createdAt)}</div>
                        {u.lastLogin && <div className="text-[11px] text-gray-400">last: {fmtDate(u.lastLogin)}</div>}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="inline-flex items-center gap-1">
                          <Link href={`/users/${u.id}`} className="h-7 w-7 inline-flex items-center justify-center rounded-lg hover:bg-gray-100 dark:hover:bg-[#262626] text-gray-500 dark:text-[#a1a1aa] hover:text-gray-900 dark:hover:text-white" title="View"><Eye className="w-4 h-4" /></Link>
                          <Link href={`/users/${u.id}/edit`} className="h-7 w-7 inline-flex items-center justify-center rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/20 text-gray-500 dark:text-[#a1a1aa] hover:text-blue-600 dark:hover:text-blue-400" title="Edit"><Pencil className="w-4 h-4" /></Link>
                          <button onClick={() => setViewingDeps(u)} className="h-7 w-7 inline-flex items-center justify-center rounded-lg hover:bg-amber-50 dark:hover:bg-amber-900/20 text-gray-500 dark:text-[#a1a1aa] hover:text-amber-600 dark:hover:text-amber-400" title="View dependencies"><Layers className="w-4 h-4" /></button>
                          <button onClick={() => setDeleting(u)} className="h-7 w-7 inline-flex items-center justify-center rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-gray-500 dark:text-[#a1a1aa] hover:text-red-600 dark:hover:text-red-400" title="Delete"><Trash2 className="w-4 h-4" /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination — fixed 10 per page, always visible when data exists */}
            {pagination && pagination.totalDocs > 0 && !loading && (
              <div className="px-4 py-3 border-t border-gray-200 dark:border-[#262626] flex flex-col sm:flex-row items-center justify-between gap-3 text-sm">
                <div className="text-gray-600 dark:text-[#a1a1aa]">Page {pagination.page} of {pagination.totalPages} • {pagination.totalDocs} users • 10 per page</div>
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

      {/* Delete confirm — WordPress-style: choose Delete all content vs Attribute to another user */}
      {deleting && typeof document !== 'undefined' &&
        createPortal(
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={() => { if (!isDeleting) setDeleting(null) }}>
            <div
              className="relative bg-white dark:bg-[#171717] rounded-2xl shadow-2xl border border-gray-200 dark:border-[#262626] w-full max-w-lg p-6 animate-in fade-in zoom-in-95"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="h-12 w-12 rounded-full bg-red-50 dark:bg-red-900/20 flex items-center justify-center mb-4"><Trash2 className="w-6 h-6 text-red-600" /></div>
              <h3 className="font-bold text-gray-900 dark:text-white">Delete user “{deleting.firstName} {deleting.lastName}”?</h3>
              <p className="text-sm text-gray-600 dark:text-[#a1a1aa] mt-1">You are about to delete <span className="font-semibold text-gray-900 dark:text-white">{deleting.email}</span> (ID #{deleting.id} • {deleting.role}). This action cannot be undone.</p>
              {deleting.role === 'admin' && <p className="text-xs text-amber-600 dark:text-amber-400 mt-2 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg px-3 py-2">Warning: Deleting an admin account may affect platform access. Ensure another admin exists.</p>}
              <button onClick={() => setViewingDeps(deleting)} className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900/30 text-xs font-semibold transition" title="Inspect what will be deleted or reassigned"><Layers className="w-3.5 h-3.5" /> View dependencies</button>

              <div className="mt-5 rounded-xl border border-gray-200 dark:border-[#262626] bg-gray-50 dark:bg-[#0a0a0a] p-4 space-y-4">
                <p className="text-sm font-semibold text-gray-900 dark:text-white">What should be done with content owned by this user?</p>
                <p className="text-xs text-gray-500 dark:text-[#a1a1aa]">This is the same choice WordPress offers when deleting a user: either delete all content or attribute it to another user.</p>

                <label className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition ${reassignMode === 'delete' ? 'bg-white dark:bg-[#171717] border-[#eba236] ring-1 ring-[#eba236]/30' : 'bg-white dark:bg-[#171717] border-gray-200 dark:border-[#262626] hover:border-gray-300 dark:hover:border-[#333]'}`}>
                  <input type="radio" name="reassignMode" value="delete" checked={reassignMode === 'delete'} onChange={() => setReassignMode('delete')} disabled={isDeleting} className="mt-1 h-4 w-4 text-[#eba236] border-gray-300 focus:ring-[#eba236]" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-gray-900 dark:text-white">Delete all content</p>
                    <p className="text-xs text-gray-500 dark:text-[#a1a1aa] mt-1">Permanently delete all content created by this user (vendor profiles, addresses, wishlists, posts, and other linked records). <span className="text-red-600 dark:text-red-400 font-medium">Use with caution.</span></p>
                  </div>
                </label>

                <label className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition ${reassignMode === 'reassign' ? 'bg-white dark:bg-[#171717] border-[#eba236] ring-1 ring-[#eba236]/30' : 'bg-white dark:bg-[#171717] border-gray-200 dark:border-[#262626] hover:border-gray-300 dark:hover:border-[#333]'}`}>
                  <input type="radio" name="reassignMode" value="reassign" checked={reassignMode === 'reassign'} onChange={() => setReassignMode('reassign')} disabled={isDeleting} className="mt-1 h-4 w-4 text-[#eba236] border-gray-300 focus:ring-[#eba236]" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-gray-900 dark:text-white">Attribute all content to</p>
                    <p className="text-xs text-gray-500 dark:text-[#a1a1aa] mt-1">Transfer all content to another user of your choosing.</p>
                    <div className="mt-3">
                      <select
                        value={reassignTo}
                        onChange={(e) => setReassignTo(e.target.value)}
                        disabled={isDeleting || reassignMode !== 'reassign' || loadingCandidates}
                        className="w-full px-3 py-2.5 rounded-lg border border-gray-200 dark:border-[#262626] bg-white dark:bg-[#0a0a0a] text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#eba236]/20 focus:border-[#eba236] disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {loadingCandidates ? <option>Loading users…</option> : reassignCandidates.length === 0 ? <option value="">No other users available</option> : reassignCandidates.map((u) => <option key={u.id} value={String(u.id)}>{u.firstName} {u.lastName} — {u.email} (#{u.id} • {u.role})</option>)}
                      </select>
                      {reassignMode === 'reassign' && !loadingCandidates && reassignCandidates.length === 0 && <p className="text-xs text-red-600 mt-2">No active users available to reassign to. Please create another user first, or choose “Delete all content”.</p>}
                    </div>
                  </div>
                </label>
              </div>

              <div className="flex gap-2 mt-6">
                <button onClick={() => setDeleting(null)} disabled={isDeleting} className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 dark:border-[#262626] text-sm font-medium bg-white dark:bg-[#171717] hover:bg-gray-50 dark:hover:bg-[#262626] disabled:opacity-50 disabled:cursor-not-allowed transition">Cancel</button>
                <button onClick={handleDelete} disabled={isDeleting || (reassignMode === 'reassign' && !reassignTo)} className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed transition">
                  {isDeleting ? <><Loader2 className="w-4 h-4 animate-spin" /> Deleting…</> : 'Confirm deletion'}
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}

      {/* View Dependencies — read-only inspection of all linked records (enterprise) */}
      {viewingDeps && typeof document !== 'undefined' &&
        createPortal(
          <div className="fixed inset-0 z-[105] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={() => setViewingDeps(null)}>
            <div
              className="relative bg-white dark:bg-[#171717] rounded-2xl shadow-2xl border border-gray-200 dark:border-[#262626] w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95"
              onClick={(e) => e.stopPropagation()}
            >
              {/* header */}
              <div className="px-6 pt-6 pb-4 border-b border-gray-100 dark:border-[#262626] shrink-0">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex gap-3 min-w-0">
                    <div className="h-10 w-10 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 flex items-center justify-center shrink-0"><Layers className="w-5 h-5 text-amber-600 dark:text-amber-400" /></div>
                    <div className="min-w-0">
                      <h3 className="font-bold text-gray-900 dark:text-white leading-tight">Dependencies for “{viewingDeps.firstName} {viewingDeps.lastName}”</h3>
                      <p className="text-xs text-gray-500 dark:text-[#a1a1aa] mt-1 truncate">{viewingDeps.email} • ID #{viewingDeps.id} • {viewingDeps.role} • {viewingDeps.isActive ? 'Active' : 'Inactive'}</p>
                    </div>
                  </div>
                  <button onClick={() => setViewingDeps(null)} className="h-8 w-8 inline-flex items-center justify-center rounded-lg hover:bg-gray-100 dark:hover:bg-[#262626] text-gray-500 dark:text-[#a1a1aa] shrink-0"><X className="w-4 h-4" /></button>
                </div>
                {depsData && !depsLoading && (
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${depsData.totalLinked > 0 ? 'bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800' : 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'}`}>
                      <Layers className="w-3 h-3" /> {depsData.totalLinked} linked record{depsData.totalLinked === 1 ? '' : 's'} {depsData.totalLinked > 0 ? '— requires choice' : '— safe to delete'}
                    </span>
                    {depsData.totalLinked > 0 && <span className="text-xs text-gray-500 dark:text-[#a1a1aa]">Choose “Delete all content” or “Attribute to another user” in the delete dialog.</span>}
                  </div>
                )}
              </div>

              {/* body */}
              <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4 min-h-0">
                {depsLoading && (
                  <div className="flex flex-col items-center justify-center py-16 gap-3">
                    <Loader2 className="w-7 h-7 animate-spin text-[#eba236]" />
                    <p className="text-sm text-gray-500 dark:text-[#a1a1aa]">Analyzing linked records…</p>
                    <p className="text-xs text-gray-400">Checking vendors, addresses, orders, posts and activity history</p>
                  </div>
                )}
                {depsError && !depsLoading && (
                  <div className="rounded-xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 p-4 flex gap-3">
                    <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-red-800 dark:text-red-200">Failed to load dependencies</p>
                      <p className="text-xs text-red-600 dark:text-red-300 mt-1 break-words">{depsError}</p>
                      <button onClick={() => setViewingDeps((prev) => (prev ? { ...prev } : null))} className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white dark:bg-[#171717] border border-red-200 dark:border-red-800 text-xs font-semibold text-red-700 dark:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/20">Retry</button>
                    </div>
                  </div>
                )}
                {!depsLoading && !depsError && depsData && (
                  <>
                    {depsData.totalLinked === 0 ? (
                      <div className="rounded-xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-900/15 p-6 text-center">
                        <div className="h-12 w-12 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center mx-auto mb-3"><CheckCircle className="w-6 h-6 text-emerald-600 dark:text-emerald-400" /></div>
                        <h4 className="font-semibold text-emerald-800 dark:text-emerald-200">No dependencies found</h4>
                        <p className="text-sm text-emerald-700 dark:text-emerald-300/80 mt-1">This user owns no linked records. Deletion will not affect other data — or you can safely deactivate instead.</p>
                      </div>
                    ) : (
                      <div className="space-y-5">
                        {/* Warning */}
                        <div className="rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/15 px-4 py-3 flex gap-3">
                          <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                          <p className="text-xs leading-relaxed text-amber-800 dark:text-amber-200">This user is tied to <span className="font-semibold">{depsData.totalLinked} record{depsData.totalLinked === 1 ? '' : 's'}</span> across {Object.values(depsData.counts || {}).filter((c: number) => c > 0).length} collections. If you delete, you must either <span className="font-semibold">delete all content</span> (permanent) or <span className="font-semibold">attribute it to another user</span>.</p>
                        </div>

                        {/* Groups — Profiles & Business */}
                        <div>
                          <h4 className="text-xs font-semibold tracking-wider uppercase text-gray-500 dark:text-[#a1a1aa] flex items-center gap-1.5"><Building className="w-3.5 h-3.5" /> Profiles & Business</h4>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2">
                            {[
                              { key: 'vendors', label: 'Vendor profiles', icon: Building, desc: 'Business entities' },
                              { key: 'merchants', label: 'Merchant outlets', icon: Store, desc: 'Via vendors' },
                              { key: 'customers', label: 'Customer profiles', icon: Users, desc: 'Customer extension' },
                              { key: 'admins', label: 'Admin profiles', icon: ShieldCheck, desc: 'Admin extension' },
                              { key: 'drivers', label: 'Driver profiles', icon: Truck, desc: 'Driver extension', fallbackIcon: Package },
                              { key: 'emergencyContacts', label: 'Emergency contacts', icon: Phone, desc: 'Safety contacts' },
                            ].map(({ key, label, icon: Icon, desc, fallbackIcon }) => {
                              const count = depsData.counts?.[key] ?? 0
                              const ActiveIcon = Icon || fallbackIcon || Layers
                              return (
                                <div key={key} className={`rounded-xl border p-3 flex items-start gap-3 ${count > 0 ? 'bg-white dark:bg-[#0a0a0a] border-amber-200 dark:border-amber-800/50' : 'bg-gray-50 dark:bg-[#0a0a0a] border-gray-200 dark:border-[#262626] opacity-75'}`}>
                                  <div className={`h-8 w-8 rounded-lg flex items-center justify-center shrink-0 ${count > 0 ? 'bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800' : 'bg-white dark:bg-[#171717] border border-gray-200 dark:border-[#262626]'}`}><ActiveIcon className={`w-4 h-4 ${count > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-gray-400'}`} /></div>
                                  <div className="min-w-0 flex-1">
                                    <p className="text-xs font-semibold text-gray-900 dark:text-white leading-none">{label}</p>
                                    <p className="text-[11px] text-gray-500 dark:text-[#a1a1aa] mt-1 leading-none">{desc}</p>
                                    <p className={`mt-2 inline-flex px-2 py-0.5 rounded-full text-xs font-bold border ${count > 0 ? 'bg-amber-500 text-white border-amber-600' : 'bg-white dark:bg-[#171717] text-gray-500 border-gray-200 dark:border-[#262626]'}`}>{count} {count === 1 ? 'record' : 'records'}</p>
                                  </div>
                                </div>
                              )
                            })}
                          </div>
                          {/* vendor / merchant previews */}
                          {(depsData.previews?.vendors?.length > 0 || depsData.previews?.merchants?.length > 0) && (
                            <div className="mt-2 rounded-lg border border-gray-200 dark:border-[#262626] bg-gray-50 dark:bg-[#0a0a0a] p-3 space-y-2">
                              {depsData.previews?.vendors?.length > 0 && <div><p className="text-[11px] font-semibold text-gray-600 dark:text-[#a1a1aa] uppercase tracking-wide">Vendor preview (up to 5)</p><ul className="mt-1 space-y-1">{depsData.previews.vendors.map((v: any) => <li key={v.id} className="text-xs text-gray-700 dark:text-[#a1a1aa] flex items-center gap-1.5"><Building className="w-3 h-3 text-gray-400 shrink-0" /> <span className="font-medium">{v.businessName || 'Unnamed vendor'}</span> <span className="text-gray-400">#{v.id} • {v.verificationStatus || '—'} {v.businessType ? `• ${v.businessType}` : ''}</span></li>)}</ul></div>}
                              {depsData.previews?.merchants?.length > 0 && <div><p className="text-[11px] font-semibold text-gray-600 dark:text-[#a1a1aa] uppercase tracking-wide">Merchant outlets preview</p><ul className="mt-1 space-y-1">{depsData.previews.merchants.map((m: any) => <li key={m.id} className="text-xs text-gray-700 dark:text-[#a1a1aa] flex items-center gap-1.5"><Store className="w-3 h-3 text-gray-400 shrink-0" /> {m.outletName || 'Unnamed'} <span className="text-gray-400">#{m.id} {m.outletCode ? `• ${m.outletCode}` : ''}</span></li>)}</ul></div>}
                            </div>
                          )}
                        </div>

                        {/* Locations & Commerce */}
                        <div>
                          <h4 className="text-xs font-semibold tracking-wider uppercase text-gray-500 dark:text-[#a1a1aa] flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5" /> Locations & Commerce</h4>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2">
                            {[
                              { key: 'addresses', label: 'Addresses', icon: MapPin, desc: 'Saved locations' },
                              { key: 'orders', label: 'Orders', icon: ShoppingBag, desc: 'Via customer profile' },
                              { key: 'wishlists', label: 'Wishlists', icon: Heart, desc: 'Saved items' },
                            ].map(({ key, label, icon: Icon, desc }) => {
                              const count = depsData.counts?.[key] ?? 0
                              return (
                                <div key={key} className={`rounded-xl border p-3 flex items-start gap-3 ${count > 0 ? 'bg-white dark:bg-[#0a0a0a] border-amber-200 dark:border-amber-800/50' : 'bg-gray-50 dark:bg-[#0a0a0a] border-gray-200 dark:border-[#262626] opacity-75'}`}>
                                  <div className={`h-8 w-8 rounded-lg flex items-center justify-center shrink-0 ${count > 0 ? 'bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800' : 'bg-white dark:bg-[#171717] border border-gray-200 dark:border-[#262626]'}`}><Icon className={`w-4 h-4 ${count > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-gray-400'}`} /></div>
                                  <div className="min-w-0 flex-1">
                                    <p className="text-xs font-semibold text-gray-900 dark:text-white leading-none">{label}</p>
                                    <p className="text-[11px] text-gray-500 dark:text-[#a1a1aa] mt-1 leading-none">{desc}</p>
                                    <p className={`mt-2 inline-flex px-2 py-0.5 rounded-full text-xs font-bold border ${count > 0 ? 'bg-amber-500 text-white border-amber-600' : 'bg-white dark:bg-[#171717] text-gray-500 border-gray-200 dark:border-[#262626]'}`}>{count} {count === 1 ? 'record' : 'records'}</p>
                                  </div>
                                </div>
                              )
                            })}
                          </div>
                          {(depsData.previews?.addresses?.length > 0 || depsData.previews?.orders?.length > 0) && (
                            <div className="mt-2 rounded-lg border border-gray-200 dark:border-[#262626] bg-gray-50 dark:bg-[#0a0a0a] p-3 space-y-2">
                              {depsData.previews?.addresses?.length > 0 && <div><p className="text-[11px] font-semibold text-gray-600 dark:text-[#a1a1aa] uppercase tracking-wide">Addresses preview</p><ul className="mt-1 space-y-1">{depsData.previews.addresses.map((a: any) => <li key={a.id} className="text-xs text-gray-700 dark:text-[#a1a1aa] truncate"><span className="font-medium">#{a.id}</span> {a.label ? `• ${a.label}` : ''} {a.locality ? `• ${a.locality}` : ''} — {a.formatted_address}</li>)}</ul></div>}
                              {depsData.previews?.orders?.length > 0 && <div><p className="text-[11px] font-semibold text-gray-600 dark:text-[#a1a1aa] uppercase tracking-wide">Orders preview (via customer)</p><ul className="mt-1 space-y-1">{depsData.previews.orders.map((o: any) => <li key={o.id} className="text-xs text-gray-700 dark:text-[#a1a1aa]">#{o.id} • {o.status || '—'} {o.total != null ? `• ₱${o.total}` : ''}</li>)}</ul></div>}
                            </div>
                          )}
                        </div>

                        {/* Content */}
                        <div>
                          <h4 className="text-xs font-semibold tracking-wider uppercase text-gray-500 dark:text-[#a1a1aa] flex items-center gap-1.5"><FileText className="w-3.5 h-3.5" /> Content</h4>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2">
                            {[
                              { key: 'posts', label: 'Posts / Articles', icon: FileText, desc: 'Authored content' },
                              { key: 'wishlists', label: 'Wishlists (dup)', icon: Heart, desc: 'Also in commerce', hide: true },
                            ].filter((i) => !(i as any).hide).map(({ key, label, icon: Icon, desc }) => {
                              const count = depsData.counts?.[key] ?? 0
                              return (
                                <div key={key} className={`rounded-xl border p-3 flex items-start gap-3 ${count > 0 ? 'bg-white dark:bg-[#0a0a0a] border-amber-200 dark:border-amber-800/50' : 'bg-gray-50 dark:bg-[#0a0a0a] border-gray-200 dark:border-[#262626] opacity-75'}`}>
                                  <div className={`h-8 w-8 rounded-lg flex items-center justify-center shrink-0 ${count > 0 ? 'bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800' : 'bg-white dark:bg-[#171717] border border-gray-200 dark:border-[#262626]'}`}><Icon className={`w-4 h-4 ${count > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-gray-400'}`} /></div>
                                  <div className="min-w-0 flex-1">
                                    <p className="text-xs font-semibold text-gray-900 dark:text-white leading-none">{label}</p>
                                    <p className="text-[11px] text-gray-500 dark:text-[#a1a1aa] mt-1 leading-none">{desc}</p>
                                    <p className={`mt-2 inline-flex px-2 py-0.5 rounded-full text-xs font-bold border ${count > 0 ? 'bg-amber-500 text-white border-amber-600' : 'bg-white dark:bg-[#171717] text-gray-500 border-gray-200 dark:border-[#262626]'}`}>{count} {count === 1 ? 'record' : 'records'}</p>
                                  </div>
                                </div>
                              )
                            })}
                          </div>
                          {depsData.previews?.posts?.length > 0 && (
                            <div className="mt-2 rounded-lg border border-gray-200 dark:border-[#262626] bg-gray-50 dark:bg-[#0a0a0a] p-3"><p className="text-[11px] font-semibold text-gray-600 dark:text-[#a1a1aa] uppercase tracking-wide">Posts preview</p><ul className="mt-1 space-y-1">{depsData.previews.posts.map((p: any) => <li key={p.id} className="text-xs text-gray-700 dark:text-[#a1a1aa]">#{p.id} • {p.title || 'Untitled'}</li>)}</ul></div>
                          )}
                        </div>

                        {/* Activity & System */}
                        <div>
                          <h4 className="text-xs font-semibold tracking-wider uppercase text-gray-500 dark:text-[#a1a1aa] flex items-center gap-1.5"><History className="w-3.5 h-3.5" /> Activity & System</h4>
                          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-2">
                            {[
                              { key: 'userEvents', label: 'User events', desc: 'Timeline' },
                              { key: 'userEventsTriggered', label: 'Triggered events', desc: 'As actor' },
                              { key: 'userNotifications', label: 'Notifications', desc: 'Inbox' },
                              { key: 'recentSearches', label: 'Recent searches', desc: 'Search history' },
                              { key: 'recentViews', label: 'Recent views', desc: 'View history' },
                              { key: 'notificationEventsTriggered', label: 'Notif. events', desc: 'Triggered' },
                              { key: 'notificationTemplatesCreated', label: 'Templates (created)', desc: 'Authored' },
                              { key: 'notificationTemplatesUpdated', label: 'Templates (updated)', desc: 'Edited' },
                              { key: 'orderTrackingActor', label: 'Order tracking', desc: 'As actor' },
                            ].map(({ key, label, desc }) => {
                              const count = depsData.counts?.[key] ?? 0
                              return (
                                <div key={key} className={`rounded-xl border px-3 py-2.5 ${count > 0 ? 'bg-white dark:bg-[#0a0a0a] border-gray-200 dark:border-[#262626]' : 'bg-gray-50 dark:bg-[#0a0a0a] border-gray-200 dark:border-[#262626] opacity-60'}`}>
                                  <p className="text-xs font-semibold text-gray-900 dark:text-white leading-none truncate">{label}</p>
                                  <p className="text-[11px] text-gray-500 dark:text-[#a1a1aa] mt-1 leading-none">{desc}</p>
                                  <p className={`mt-1.5 inline-flex px-2 py-0.5 rounded-full text-xs font-bold border ${count > 0 ? 'bg-zinc-800 dark:bg-zinc-700 text-white border-zinc-700' : 'bg-white dark:bg-[#171717] text-gray-500 border-gray-200 dark:border-[#262626]'}`}>{count}</p>
                                </div>
                              )
                            })}
                          </div>
                          {(depsData.previews?.userEvents?.length > 0 || depsData.previews?.recentSearches?.length > 0) && (
                            <div className="mt-2 rounded-lg border border-gray-200 dark:border-[#262626] bg-gray-50 dark:bg-[#0a0a0a] p-3 space-y-2">
                              {depsData.previews?.userEvents?.length > 0 && <div><p className="text-[11px] font-semibold text-gray-600 dark:text-[#a1a1aa] uppercase tracking-wide">Recent user events</p><ul className="mt-1 space-y-1">{depsData.previews.userEvents.map((e: any) => <li key={e.id} className="text-xs text-gray-700 dark:text-[#a1a1aa]">#{e.id} • {e.eventType} • {e.timestamp ? new Date(e.timestamp).toLocaleDateString('en-PH', { timeZone: 'Asia/Manila', year: 'numeric', month: 'short', day: 'numeric' }) : '—'}</li>)}</ul></div>}
                              {depsData.previews?.recentSearches?.length > 0 && <div><p className="text-[11px] font-semibold text-gray-600 dark:text-[#a1a1aa] uppercase tracking-wide">Recent searches</p><ul className="mt-1 space-y-1">{depsData.previews.recentSearches.map((s: any) => <li key={s.id} className="text-xs text-gray-700 dark:text-[#a1a1aa]">#{s.id} • “{s.query}”</li>)}</ul></div>}
                            </div>
                          )}
                        </div>

                        <p className="text-[11px] text-gray-400 dark:text-[#6b7280] leading-relaxed border-t border-gray-100 dark:border-[#262626] pt-3">WordPress parity: deleting will either <span className="font-medium text-gray-600 dark:text-[#a1a1aa]">delete all content</span> (permanent, including merchants/orders cascaded from vendors/customers) or <span className="font-medium text-gray-600 dark:text-[#a1a1aa]">attribute all content</span> to another user you choose. Use this preview to decide.</p>
                      </div>
                    )}
                  </>
                )}
              </div>

              {/* footer */}
              <div className="px-6 py-4 border-t border-gray-100 dark:border-[#262626] bg-gray-50 dark:bg-[#0a0a0a] flex gap-2 shrink-0">
                <button onClick={() => setViewingDeps(null)} className="flex-1 px-4 py-2.5 rounded-xl bg-white dark:bg-[#171717] border border-gray-200 dark:border-[#262626] text-sm font-medium text-gray-700 dark:text-white hover:bg-gray-50 dark:hover:bg-[#262626] transition">Close</button>
                {(depsData?.totalLinked ?? 0) > 0 && deleting && (
                  <button onClick={() => setViewingDeps(null)} className="flex-1 px-4 py-2.5 rounded-xl bg-[#eba236] hover:bg-[#c88a20] text-white text-sm font-semibold shadow-sm transition">Back to delete options</button>
                )}
                {(depsData?.totalLinked ?? 0) > 0 && !deleting && (
                  <button onClick={() => { const u = viewingDeps; setViewingDeps(null); if (u) setDeleting(u) }} className="flex-1 inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-sm font-semibold transition"><Trash2 className="w-4 h-4" /> Delete user</button>
                )}
              </div>
            </div>
          </div>,
          document.body
        )}

      {/* Delete error — professional modal (replaces alert) */}
      {deleteError && typeof document !== 'undefined' &&
        createPortal(
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={() => setDeleteError(null)}>
            <div
              className="relative bg-white dark:bg-[#171717] rounded-2xl shadow-2xl border border-gray-200 dark:border-[#262626] w-full max-w-md p-6 animate-in fade-in zoom-in-95"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="h-12 w-12 rounded-full bg-red-50 dark:bg-red-900/20 flex items-center justify-center mb-4"><AlertCircle className="w-6 h-6 text-red-600" /></div>
              <h3 className="font-bold text-gray-900 dark:text-white">Delete failed</h3>
              <p className="text-sm text-gray-600 dark:text-[#a1a1aa] mt-2 leading-relaxed">{deleteError}</p>
              <p className="text-xs text-gray-500 dark:text-[#a1a1aa] mt-2">If this is a permission or self-delete restriction, contact a system admin.</p>
              <div className="flex gap-2 mt-6">
                <button onClick={() => setDeleteError(null)} className="flex-1 px-4 py-2.5 rounded-xl bg-[#eba236] hover:bg-[#c88a20] text-white text-sm font-semibold shadow-sm transition">Dismiss</button>
              </div>
            </div>
          </div>,
          document.body
        )}

      {/* Action error — toast (replaces alert for toggle/status) */}
      {actionError && typeof document !== 'undefined' &&
        createPortal(
          <div className="fixed top-4 right-4 z-[110] max-w-sm animate-in slide-in-from-top-2 fade-in">
            <div className="flex items-start gap-3 px-4 py-3 rounded-xl shadow-lg border backdrop-blur bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800 text-red-800 dark:text-red-200 text-sm font-medium">
              <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
              <span className="flex-1 leading-snug">{actionError}</span>
              <button onClick={() => setActionError(null)} className="opacity-60 hover:opacity-100 transition ml-1"><X className="w-4 h-4" /></button>
            </div>
          </div>,
          document.body
        )}
    </div>
  )
}

export default function UsersPage(){
  return (
    <ClientOnly fallback={<UsersSkeleton />}>
      <UsersPageContent />
    </ClientOnly>
  )
}
