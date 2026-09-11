'use client'

import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { useQueryClient } from '@tanstack/react-query'
import { QUERY_KEYS } from '@encreasl/client-services'
import { useAuditLogs, type AuditDoc } from '@/hooks/useAuditLogs'
import { ClientOnly } from '@/components/ClientOnly'
import {
  Shield,
  Search,
  X,
  SlidersHorizontal,
  ChevronDown,
  RefreshCw,
  AlertCircle,
  Clock,
  LogIn,
  LogOut,
  KeyRound,
  Users,
  Plus,
  XCircle,
  Eye,
  CalendarDays,
  MapPin,
  Monitor,
  Download,
  Activity,
} from '@/components/ui/IconWrapper'

const EVENT_OPTS: { value: string; label: string }[] = [
  { value: 'USER_CREATED', label: 'User Created' },
  { value: 'ROLE_CHANGED', label: 'Role Changed' },
  { value: 'PROFILE_UPDATED', label: 'Profile Updated' },
  { value: 'USER_DEACTIVATED', label: 'Deactivated' },
  { value: 'USER_REACTIVATED', label: 'Reactivated' },
  { value: 'LOGIN_SUCCESS', label: 'Login Success' },
  { value: 'LOGIN_FAILED', label: 'Login Failed' },
  { value: 'PASSWORD_CHANGED', label: 'Password Changed' },
]

function eventBadge(type: string) {
  const t = type.toUpperCase()
  if (t === 'LOGIN_SUCCESS') return 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-300 dark:border-emerald-800'
  if (t === 'LOGIN_FAILED') return 'bg-red-50 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-300 dark:border-red-800'
  if (t === 'PASSWORD_CHANGED' || t === 'ROLE_CHANGED') return 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-300 dark:border-amber-800'
  if (t === 'USER_DEACTIVATED') return 'bg-zinc-100 text-zinc-700 border-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:border-zinc-700'
  if (t === 'USER_REACTIVATED') return 'bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-900/20 dark:text-sky-300 dark:border-sky-800'
  if (t === 'USER_CREATED') return 'bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-900/20 dark:text-violet-300 dark:border-violet-800'
  return 'bg-gray-100 text-gray-700 border-gray-200 dark:bg-[#262626] dark:text-[#a1a1aa] dark:border-[#333]'
}

function eventIcon(type: string) {
  const t = type.toUpperCase()
  if (t === 'LOGIN_SUCCESS') return <LogIn className="w-4 h-4" />
  if (t === 'LOGIN_FAILED') return <LogOut className="w-4 h-4" />
  if (t === 'PASSWORD_CHANGED') return <KeyRound className="w-4 h-4" />
  if (t === 'ROLE_CHANGED') return <Users className="w-4 h-4" />
  if (t === 'USER_CREATED') return <Plus className="w-4 h-4" />
  if (t === 'USER_DEACTIVATED' || t === 'USER_REACTIVATED') return <XCircle className="w-4 h-4" />
  return <Activity className="w-4 h-4" />
}

function fmtDateTime(iso: string | null) {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleString('en-PH', { timeZone: 'Asia/Manila', year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
  } catch {
    return String(iso).slice(0, 19).replace('T', ' ')
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
              className={`px-2.5 py-1 rounded-full text-xs font-medium border transition capitalize ${active ? 'bg-[#eba236] text-white border-[#eba236]' : 'bg-white dark:bg-[#0a0a0a] text-gray-700 dark:text-[#a1a1aa] border-gray-200 dark:border-[#262626] hover:border-gray-300'}`}
            >
              {opt.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}

function AuditSkeleton(){
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

function AuditPageContent(){
  const [q, setQ] = useState('')
  const [debouncedQ, setDebouncedQ] = useState('')
  const [eventFilter, setEventFilter] = useState<string[]>([])
  const [userIdFilter, setUserIdFilter] = useState('')
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const [sort, setSort] = useState<string>('-timestamp')
  const [page, setPage] = useState(1)
  const limit = 10
  const [showFilters, setShowFilters] = useState(false)

  const [selected, setSelected] = useState<AuditDoc | null>(null)
  const [toast, setToast] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null)

  useEffect(() => {
    const id = setTimeout(() => setDebouncedQ(q.trim()), 400)
    return () => clearTimeout(id)
  }, [q])

  const activeFilterCount = useMemo(() => {
    return eventFilter.length + (userIdFilter ? 1 : 0) + (fromDate ? 1 : 0) + (toDate ? 1 : 0) + (debouncedQ ? 1 : 0)
  }, [eventFilter, userIdFilter, fromDate, toDate, debouncedQ])

  const qs = useMemo(() => {
    const p = new URLSearchParams()
    p.set('page', String(page))
    p.set('limit', String(limit))
    p.set('sort', sort)
    if (debouncedQ) p.set('search', debouncedQ)
    if (eventFilter.length) p.set('eventType', eventFilter.join(','))
    if (userIdFilter.trim()) p.set('userId', userIdFilter.trim())
    if (fromDate) p.set('from', fromDate)
    if (toDate) p.set('to', toDate)
    return p.toString()
  }, [page, limit, sort, debouncedQ, eventFilter, userIdFilter, fromDate, toDate])

  const showToast = useCallback((t: { type: 'success' | 'error' | 'info'; message: string }) => {
    setToast(t)
    setTimeout(() => setToast(null), 4200)
  }, [])

  const queryClient = useQueryClient()
  const [hardRefreshing, setHardRefreshing] = useState(false)
  const { data, isPending, isFetching, isError, error: queryError, refetch } = useAuditLogs(qs)

  const docs = data?.docs || []
  const pagination = data?.pagination || null
  const stats = data?.stats || null

  const isInitialLoading = (isPending && !data) || hardRefreshing
  const loading = isFetching || hardRefreshing
  const error = isError && !data && !hardRefreshing ? (queryError instanceof Error ? queryError.message : 'Failed to load audit logs') : null

  const handleHardRefresh = () => {
    if (hardRefreshing) return
    setHardRefreshing(true)
    void (async () => {
      try {
        queryClient.removeQueries({ queryKey: QUERY_KEYS.adminAudit(qs) })
        await refetch({ cancelRefetch: true })
      } finally { setHardRefreshing(false) }
    })()
  }

  useEffect(() => {
    setPage(1)
  }, [debouncedQ, eventFilter, userIdFilter, fromDate, toDate, sort])

  // lock scroll when detail open
  useEffect(() => {
    const isOpen = !!selected
    if (isOpen) {
      const prev = document.body.style.overflow
      document.body.style.overflow = 'hidden'
      return () => {
        document.body.style.overflow = prev
      }
    }
    document.body.style.overflow = ''
    return () => {
      document.body.style.overflow = ''
    }
  }, [selected])

  const toggleEvent = (v: string) => setEventFilter((prev) => (prev.includes(v) ? prev.filter((x) => x !== v) : [...prev, v]))
  const clearAll = () => {
    setQ('')
    setDebouncedQ('')
    setEventFilter([])
    setUserIdFilter('')
    setFromDate('')
    setToDate('')
  }

  const handleExport = () => {
    if (!docs.length) {
      showToast({ type: 'info', message: 'No audit logs to export for current filters.' })
      return
    }
    const headers = ['id', 'timestamp', 'eventType', 'user', 'triggeredBy', 'ipAddress', 'userAgent']
    const rows = docs.map((d) => [
      String(d.id),
      d.timestamp || d.createdAt,
      d.eventType,
      d.user ? `${d.user.firstName} ${d.user.lastName} <${d.user.email}>` : `#${d.userId ?? ''}`,
      d.triggeredBy ? `${d.triggeredBy.firstName} ${d.triggeredBy.lastName} <${d.triggeredBy.email}>` : d.triggeredById ? `#${d.triggeredById}` : '',
      d.ipAddress || '',
      (d.userAgent || '').replace(/"/g, '""'),
    ])
    const csv = [headers.join(','), ...rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(','))].join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `audit-logs-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
    showToast({ type: 'success', message: `Exported ${docs.length} audit logs to CSV.` })
  }

  return (
    <div className="space-y-6 py-5 px-2.5">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white tracking-tight flex items-center gap-2">
            <span className="h-8 w-8 rounded-lg bg-[#eba236] text-white flex items-center justify-center">
              <Shield className="w-4 h-4" />
            </span>
            Audit Logs
          </h1>
          <p className="text-sm text-gray-500 dark:text-[#a1a1aa] mt-1">User Events / Audit Logs — every sign-in, role change, and profile update. Read-only, admin-only.</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleHardRefresh}
            disabled={loading}
            aria-label="Refresh audit logs"
            title="Refresh — re-fetch from BFF and show skeleton"
            className="h-9 w-9 inline-flex items-center justify-center bg-white dark:bg-[#171717] border border-gray-200 dark:border-[#262626] rounded-xl hover:bg-gray-50 dark:hover:bg-[#262626] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <RefreshCw className={`w-4 h-4 text-gray-600 dark:text-[#a1a1aa] ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={handleExport}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-[#eba236] hover:bg-[#c88a20] text-white rounded-xl text-sm font-semibold shadow-sm transition"
          >
            <Download className="w-4 h-4" /> Export CSV
          </button>
        </div>
      </div>

      {/* KPIs */}
      {stats ? (
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
          <KpiCard title="Total Events" value={String(stats.filteredTotal)} sub={`${stats.totalAll} overall`} icon={<Activity className="w-5 h-5 text-white" />} iconBg="bg-[#eba236]" />
          <KpiCard title="Login Success" value={String(stats.loginSuccessCount)} sub={`${stats.eventTypeBreakdown.LOGIN_FAILED || 0} failed`} icon={<LogIn className="w-5 h-5 text-white" />} iconBg="bg-emerald-500" />
          <KpiCard title="Login Failed" value={String(stats.loginFailedCount)} sub={`${Math.round(((stats.loginFailedCount) / Math.max(1, stats.totalAll)) * 100)}% of all`} icon={<LogOut className="w-5 h-5 text-white" />} iconBg="bg-red-500" />
          <KpiCard title="Security" value={String(stats.securityCount)} sub={`${stats.eventTypeBreakdown.PASSWORD_CHANGED || 0} pwd changes`} icon={<KeyRound className="w-5 h-5 text-white" />} iconBg="bg-amber-500" />
          <KpiCard title="Unique Users" value={String(stats.uniqueUsers)} sub={`${stats.eventTypeBreakdown.USER_CREATED || 0} created`} icon={<Users className="w-5 h-5 text-white" />} iconBg="bg-blue-600" />
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
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search event type, IP, user agent…"
              className="w-full pl-9 pr-9 py-2.5 text-sm bg-gray-50 dark:bg-[#0a0a0a] border border-gray-200 dark:border-[#262626] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#eba236]/20 focus:border-[#eba236] text-gray-900 dark:text-white placeholder:text-gray-400"
            />
            {q && (
              <button onClick={() => setQ('')} className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-full hover:bg-gray-100 dark:hover:bg-[#262626]">
                <X className="w-4 h-4 text-gray-400" />
              </button>
            )}
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-1 p-1 bg-gray-100 dark:bg-[#0a0a0a] rounded-full border border-gray-200 dark:border-[#262626]">
              <select value={sort} onChange={(e) => setSort(e.target.value)} className="px-3 py-1.5 rounded-full text-xs font-semibold bg-white dark:bg-[#171717] border border-gray-200 dark:border-[#333] text-gray-700 dark:text-white">
                <option value="-timestamp">Newest first</option>
                <option value="timestamp">Oldest first</option>
                <option value="-createdAt">Created newest</option>
                <option value="createdAt">Created oldest</option>
                <option value="eventType">Event A–Z</option>
                <option value="-eventType">Event Z–A</option>
              </select>
            </div>
            <span className="px-3 py-2 rounded-lg text-xs font-medium bg-gray-100 dark:bg-[#0a0a0a] border border-gray-200 dark:border-[#262626] text-gray-600 dark:text-[#a1a1aa]">10 / page</span>
            <button
              onClick={() => setShowFilters((v) => !v)}
              className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold border transition shrink-0 ${activeFilterCount ? 'bg-[#eba236] hover:bg-[#c88a20] text-white border-[#eba236] hover:border-[#c88a20]' : 'bg-white dark:bg-[#171717] text-gray-700 dark:text-[#a1a1aa] border-gray-200 dark:border-[#262626] hover:bg-gray-50 dark:hover:bg-[#262626] hover:text-gray-900 dark:hover:text-white'}`}
            >
              <SlidersHorizontal className="w-4 h-4" /> Filters {activeFilterCount > 0 && <span className="px-1.5 py-0.5 rounded-full text-xs font-bold bg-white text-[#eba236]">{activeFilterCount}</span>} <ChevronDown className={`w-4 h-4 transition ${showFilters ? 'rotate-180' : ''}`} />
            </button>
            {activeFilterCount > 0 && (
              <button onClick={clearAll} className="text-sm font-medium text-gray-500 dark:text-[#a1a1aa] hover:text-gray-900">
                Clear all
              </button>
            )}
          </div>
        </div>

        {showFilters && (
          <div className="mt-4 pt-4 border-t border-gray-100 dark:border-[#262626] space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              <FilterPills label="Event type" options={EVENT_OPTS} value={eventFilter} onToggle={toggleEvent} />
              <div>
                <p className="text-xs font-semibold text-gray-700 dark:text-[#a1a1aa] mb-2">User</p>
                <input value={userIdFilter} onChange={(e) => setUserIdFilter(e.target.value)} placeholder="User ID (e.g. 12)" className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-[#262626] bg-white dark:bg-[#0a0a0a] text-sm text-gray-900 dark:text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#eba236]/20 focus:border-[#eba236]" />
                <p className="text-xs text-gray-400 mt-1">Filter by user ID. Combine with event type.</p>
              </div>
              <div>
                <p className="text-xs font-semibold text-gray-700 dark:text-[#a1a1aa] mb-2">Date range</p>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-xs text-gray-500 dark:text-[#a1a1aa]">From</label>
                    <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className="w-full mt-1 px-3 py-2 rounded-lg border border-gray-200 dark:border-[#262626] bg-white dark:bg-[#0a0a0a] text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#eba236]/20 focus:border-[#eba236]" />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 dark:text-[#a1a1aa]">To</label>
                    <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className="w-full mt-1 px-3 py-2 rounded-lg border border-gray-200 dark:border-[#262626] bg-white dark:bg-[#0a0a0a] text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#eba236]/20 focus:border-[#eba236]" />
                  </div>
                </div>
                <p className="text-xs text-gray-400 mt-1">Filters by timestamp (inclusive).</p>
              </div>
            </div>
            <div className="flex justify-end">
              <button onClick={() => setShowFilters(false)} className="text-xs font-semibold text-[#eba236]">
                Done
              </button>
            </div>
          </div>
        )}

        {activeFilterCount > 0 && !showFilters && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {debouncedQ && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-[#eba236]/10 dark:bg-[#eba236]/15 text-[#8a5f17] dark:text-[#eba236] rounded-full text-xs font-medium border border-[#eba236]/30 dark:border-[#eba236]/30">
                Search: “{debouncedQ}” <button onClick={() => setQ('')}><X className="w-3 h-3" /></button>
              </span>
            )}
            {eventFilter.map((v) => (
              <span key={v} className="inline-flex items-center gap-1 px-2.5 py-1 bg-gray-100 dark:bg-[#262626] text-gray-700 dark:text-[#a1a1aa] rounded-full text-xs font-medium">
                type:{v.toLowerCase()} <button onClick={() => toggleEvent(v)}><X className="w-3 h-3" /></button>
              </span>
            ))}
            {userIdFilter && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-gray-100 dark:bg-[#262626] text-gray-700 dark:text-[#a1a1aa] rounded-full text-xs font-medium">user:{userIdFilter} <button onClick={() => setUserIdFilter('')}><X className="w-3 h-3" /></button></span>
            )}
            {(fromDate || toDate) && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-gray-100 dark:bg-[#262626] rounded-full text-xs">
                {fromDate || '…'} → {toDate || '…'} <button onClick={() => { setFromDate(''); setToDate('') }}><X className="w-3 h-3" /></button>
              </span>
            )}
          </div>
        )}
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-[#171717] rounded-xl border border-gray-200 dark:border-[#262626] shadow-sm overflow-hidden">
        {error && (
          <div className="flex flex-col items-center justify-center py-16 px-6">
            <div className="h-14 w-14 bg-red-50 dark:bg-red-900/20 rounded-full flex items-center justify-center mb-4">
              <AlertCircle className="h-7 w-7 text-red-500" />
            </div>
            <h3 className="font-semibold text-gray-900 dark:text-white">Failed to load audit logs</h3>
            <p className="text-sm text-gray-500 mt-1 mb-4 text-center max-w-md">{error}</p>
            <button onClick={handleHardRefresh} className="inline-flex items-center px-4 py-2 bg-[#eba236] text-white rounded-lg text-sm font-medium">
              <RefreshCw className="h-4 w-4 mr-2" />Retry
            </button>
          </div>
        )}
        {isInitialLoading ? (
          <div className="p-4 space-y-3 animate-pulse">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-16 bg-gray-100 dark:bg-[#0a0a0a] rounded-lg" />
            ))}
          </div>
        ) : !error && docs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
            <div className="h-16 w-16 bg-[#eba236]/10 dark:bg-[#eba236]/15 rounded-2xl flex items-center justify-center mb-4">
              <Shield className="w-8 h-8 text-[#eba236]" />
            </div>
            <h3 className="font-semibold text-gray-900 dark:text-white">No audit logs found</h3>
            <p className="text-sm text-gray-500 dark:text-[#a1a1aa] mt-1 max-w-md">No user events match your filters. Try adjusting search, event type, user ID, or date range. Logs appear after sign-ins, role changes, or profile updates.</p>
            <p className="text-xs text-gray-400 mt-2">Powered by <span className="font-mono">user-events</span> collection — read-only, admin-only.</p>
          </div>
        ) : !error && (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 dark:bg-[#0a0a0a] text-xs text-gray-500 dark:text-[#a1a1aa] border-b border-gray-200 dark:border-[#262626]">
                  <tr>
                    <th className="text-left px-4 py-3 font-medium">Timestamp</th>
                    <th className="text-left px-4 py-3 font-medium">Event</th>
                    <th className="text-left px-4 py-3 font-medium">User</th>
                    <th className="text-left px-4 py-3 font-medium hidden lg:table-cell">Triggered by</th>
                    <th className="text-left px-4 py-3 font-medium hidden xl:table-cell">IP</th>
                    <th className="text-right px-4 py-3 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-[#262626]">
                  {docs.map((d) => (
                    <tr key={d.id} className="hover:bg-gray-50 dark:hover:bg-[#0a0a0a]/50 transition">
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="flex items-center gap-1.5 text-xs text-gray-900 dark:text-white">
                          <CalendarDays className="w-3 h-3 text-gray-400" />
                          {fmtDateTime(d.timestamp)}
                        </div>
                        <div className="text-[11px] text-gray-400 mt-0.5">#{d.id}</div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${eventBadge(d.eventType)}`}>
                          {eventIcon(d.eventType)}
                          {d.eventType.replace(/_/g, ' ').toLowerCase()}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {d.user ? (
                          <div className="min-w-[160px]">
                            <div className="font-medium text-gray-900 dark:text-white truncate max-w-[160px]">{d.user.firstName} {d.user.lastName}</div>
                            <div className="text-xs text-gray-500 dark:text-[#a1a1aa] truncate max-w-[160px]">{d.user.email} • <span className="capitalize">{d.user.role}</span></div>
                            <div className="text-[11px] text-gray-400">ID #{d.user.id}</div>
                          </div>
                        ) : (
                          <span className="text-xs text-gray-400">#{d.userId ?? '—'}</span>
                        )}
                      </td>
                      <td className="px-4 py-3 hidden lg:table-cell">
                        {d.triggeredBy ? (
                          <div>
                            <div className="text-xs font-medium text-gray-900 dark:text-white truncate max-w-[140px]">{d.triggeredBy.firstName} {d.triggeredBy.lastName}</div>
                            <div className="text-xs text-gray-500 truncate max-w-[140px]">{d.triggeredBy.email}</div>
                          </div>
                        ) : d.triggeredById ? (
                          <span className="text-xs text-gray-400">#{d.triggeredById}</span>
                        ) : (
                          <span className="text-xs text-gray-400">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 hidden xl:table-cell">
                        <div className="flex items-center gap-1 text-xs text-gray-600 dark:text-[#a1a1aa]">
                          <MapPin className="w-3 h-3 text-gray-400" />
                          {d.ipAddress || '—'}
                        </div>
                        {d.userAgent && <div className="text-[11px] text-gray-400 truncate max-w-[160px] flex items-center gap-1"><Monitor className="w-3 h-3 text-gray-400" />{d.userAgent.slice(0, 44)}</div>}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => setSelected(d)}
                          className="h-7 w-7 inline-flex items-center justify-center rounded-lg hover:bg-gray-100 dark:hover:bg-[#262626] text-gray-500 dark:text-[#a1a1aa] hover:text-gray-900 dark:hover:text-white"
                          title="View details"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {pagination && pagination.totalDocs > 0 && !loading && (
              <div className="px-4 py-3 border-t border-gray-200 dark:border-[#262626] flex flex-col sm:flex-row items-center justify-between gap-3 text-sm">
                <div className="text-gray-600 dark:text-[#a1a1aa]">Page {pagination.page} of {pagination.totalPages} • {pagination.totalDocs} events • 10 per page</div>
                <div className="flex items-center gap-1">
                  <button disabled={loading || !pagination.hasPrevPage} onClick={() => setPage((p) => Math.max(1, p - 1))} className="px-3 py-1.5 rounded-lg border border-gray-200 dark:border-[#262626] bg-white dark:bg-[#0a0a0a] disabled:opacity-50 text-sm">
                    Prev
                  </button>
                  {Array.from({ length: Math.min(5, pagination.totalPages) }).map((_, i) => {
                    const n = Math.max(1, Math.min(pagination.totalPages - 4, pagination.page - 2)) + i
                    if (n > pagination.totalPages) return null
                    return (
                      <button
                        key={n}
                        onClick={() => setPage(n)}
                        className={`h-8 w-8 rounded-lg text-sm font-medium border ${n === pagination.page ? 'bg-[#eba236] text-white border-[#eba236]' : 'bg-white dark:bg-[#0a0a0a] border-gray-200 dark:border-[#262626] text-gray-700 dark:text-white'}`}
                      >
                        {n}
                      </button>
                    )
                  })}
                  <button disabled={loading || !pagination.hasNextPage} onClick={() => setPage((p) => p + 1)} className="px-3 py-1.5 rounded-lg border border-gray-200 dark:border-[#262626] bg-white dark:bg-[#0a0a0a] disabled:opacity-50 text-sm">
                    Next
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Detail drawer */}
      {selected && typeof document !== 'undefined' &&
        createPortal(
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={() => setSelected(null)}>
            <div className="relative bg-white dark:bg-[#171717] rounded-2xl shadow-2xl border border-gray-200 dark:border-[#262626] w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95" onClick={(e) => e.stopPropagation()}>
              <div className="px-6 py-4 border-b border-gray-200 dark:border-[#262626] flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${eventBadge(selected.eventType)}`}>
                      {eventIcon(selected.eventType)}
                      {selected.eventType}
                    </span>
                    <span className="text-xs text-gray-500 dark:text-[#a1a1aa]">#{selected.id}</span>
                  </div>
                  <p className="text-sm text-gray-900 dark:text-white font-medium mt-2 truncate">{fmtDateTime(selected.timestamp)}</p>
                  <p className="text-xs text-gray-500 dark:text-[#a1a1aa]">created {fmtDateTime(selected.createdAt)}</p>
                </div>
                <button onClick={() => setSelected(null)} className="h-8 w-8 inline-flex items-center justify-center rounded-full hover:bg-gray-100 dark:hover:bg-[#262626] text-gray-500">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="overflow-y-auto p-6 space-y-5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="rounded-xl border border-gray-200 dark:border-[#262626] bg-gray-50 dark:bg-[#0a0a0a] p-4">
                    <p className="text-xs font-semibold text-gray-500 dark:text-[#a1a1aa] mb-2 flex items-center gap-1"><Clock className="w-3 h-3" /> Subject user</p>
                    {selected.user ? (
                      <div>
                        <p className="text-sm font-semibold text-gray-900 dark:text-white">{selected.user.firstName} {selected.user.lastName}</p>
                        <p className="text-xs text-gray-600 dark:text-[#a1a1aa]">{selected.user.email} • {selected.user.role}</p>
                        <p className="text-xs font-mono text-gray-500">ID #{selected.user.id}</p>
                      </div>
                    ) : (
                      <p className="text-sm text-gray-400">User #{selected.userId ?? '—'} (deleted or not populated)</p>
                    )}
                  </div>
                  <div className="rounded-xl border border-gray-200 dark:border-[#262626] bg-gray-50 dark:bg-[#0a0a0a] p-4">
                    <p className="text-xs font-semibold text-gray-500 dark:text-[#a1a1aa] mb-2 flex items-center gap-1"><Users className="w-3 h-3" /> Triggered by</p>
                    {selected.triggeredBy ? (
                      <div>
                        <p className="text-sm font-semibold text-gray-900 dark:text-white">{selected.triggeredBy.firstName} {selected.triggeredBy.lastName}</p>
                        <p className="text-xs text-gray-600 dark:text-[#a1a1aa]">{selected.triggeredBy.email} • {selected.triggeredBy.role}</p>
                        <p className="text-xs font-mono text-gray-500">ID #{selected.triggeredBy.id}</p>
                      </div>
                    ) : selected.triggeredById ? (
                      <p className="text-sm text-gray-400">User #{selected.triggeredById}</p>
                    ) : (
                      <p className="text-sm text-gray-400">System / —</p>
                    )}
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="flex items-center gap-2 text-sm">
                    <MapPin className="w-4 h-4 text-gray-400" />
                    <span className="text-gray-500 dark:text-[#a1a1aa]">IP</span>
                    <span className="font-mono text-gray-900 dark:text-white">{selected.ipAddress || '—'}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm min-w-0">
                    <Monitor className="w-4 h-4 text-gray-400 shrink-0" />
                    <span className="text-gray-500 dark:text-[#a1a1aa]">UA</span>
                    <span className="font-mono text-xs text-gray-900 dark:text-white truncate">{selected.userAgent || '—'}</span>
                  </div>
                </div>
                <div>
                  <p className="text-xs font-semibold text-gray-700 dark:text-[#a1a1aa] mb-2 flex items-center gap-1"><Activity className="w-3 h-3" /> Event data</p>
                  <pre className="text-xs font-mono bg-gray-50 dark:bg-[#0a0a0a] border border-gray-200 dark:border-[#262626] rounded-lg p-3 overflow-auto max-h-64 whitespace-pre-wrap break-words text-gray-800 dark:text-[#ededed]">
                    {selected.eventData != null ? JSON.stringify(selected.eventData, null, 2) : '—'}
                  </pre>
                </div>
                <div className="rounded-lg bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800 p-3">
                  <p className="text-xs text-amber-800 dark:text-amber-300">Read-only audit trail from <span className="font-mono">user-events</span>. No delete/edit — use CSV export for compliance. Powered by `user-events` collection.</p>
                </div>
              </div>
              <div className="px-6 py-4 border-t border-gray-200 dark:border-[#262626] bg-gray-50 dark:bg-[#0a0a0a] flex justify-end">
                <button onClick={() => setSelected(null)} className="px-4 py-2 rounded-lg bg-[#eba236] hover:bg-[#c88a20] text-white text-sm font-semibold">Close</button>
              </div>
            </div>
          </div>,
          document.body
        )}

      {/* Toast */}
      {toast && typeof document !== 'undefined' &&
        createPortal(
          <div className="fixed top-4 right-4 z-[110] max-w-sm animate-in slide-in-from-top-2 fade-in">
            <div className={`flex items-start gap-3 px-4 py-3 rounded-xl shadow-lg border backdrop-blur text-sm font-medium ${toast.type === 'success' ? 'bg-emerald-50 dark:bg-emerald-900/30 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200' : toast.type === 'error' ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800 text-red-800 dark:text-red-200' : 'bg-sky-50 dark:bg-sky-900/30 border-sky-200 text-sky-800'}`}>
              <span className="flex-1 leading-snug">{toast.message}</span>
              <button onClick={() => setToast(null)} className="opacity-60 hover:opacity-100 transition ml-1"><X className="w-4 h-4" /></button>
            </div>
          </div>,
          document.body
        )}
    </div>
  )
}

export default function AuditPage(){
  return (
    <ClientOnly fallback={<AuditSkeleton />}>
      <AuditPageContent />
    </ClientOnly>
  )
}
