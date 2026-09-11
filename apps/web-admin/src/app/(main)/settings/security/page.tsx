'use client'

import React, { useCallback, useState } from 'react'
import { createPortal } from 'react-dom'
import { useQueryClient } from '@tanstack/react-query'
import { QUERY_KEYS } from '@encreasl/client-services'
import { useSecurityOverview } from '@/hooks/useSecurityOverview'
import { ClientOnly } from '@/components/ClientOnly'
import {
  Shield,
  ShieldCheck,
  ShieldAlert,
  RefreshCw,
  AlertCircle,
  Clock,
  Users,
  KeyRound,
  Lock,
  Fingerprint,
  Activity,
  Settings,
  Globe,
  Smartphone,
  X,
  Eye,
  CheckCircle,
  XCircle,
  Crown,
  Info,
  UserCheck,
  Ban,
} from '@/components/ui/IconWrapper'

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

function Section({ title, icon, children, action }: { title: string; icon?: React.ReactNode; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="bg-white dark:bg-[#171717] rounded-xl border border-gray-200 dark:border-[#262626] shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-100 dark:border-[#262626] flex items-center justify-between gap-3">
        <h3 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2 text-sm">
          {icon}
          {title}
        </h3>
        {action}
      </div>
      <div className="p-5">{children}</div>
    </div>
  )
}

function Row({ label, value, mono, icon }: { label: string; value: React.ReactNode; mono?: boolean; icon?: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2.5 text-sm border-b border-gray-100 dark:border-[#262626] last:border-0">
      <span className="text-gray-500 dark:text-[#a1a1aa] text-xs font-medium shrink-0 flex items-center gap-1.5">{icon}{label}</span>
      <span className={`text-right max-w-[60%] break-words ${mono ? 'font-mono text-xs text-gray-900 dark:text-white' : 'text-sm text-gray-900 dark:text-white'}`}>{value}</span>
    </div>
  )
}

function fmtDateTime(iso: string | null) {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleString('en-PH', { timeZone: 'Asia/Manila', year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
  } catch {
    return String(iso).slice(0, 19).replace('T', ' ')
  }
}

function SecuritySkeleton(){
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

function SecuritySettingsPageContent(){
  const [toast, setToast] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null)
  const [maintenanceSaving, setMaintenanceSaving] = useState(false)
  const [unlockingId, setUnlockingId] = useState<number | null>(null)

  const showToast = useCallback((t: { type: 'success' | 'error' | 'info'; message: string }) => {
    setToast(t)
    setTimeout(() => setToast(null), 4200)
  }, [])

  const queryClient = useQueryClient()
  const [hardRefreshing, setHardRefreshing] = useState(false)
  const { data, isPending, isFetching, isError, error: queryError, refetch } = useSecurityOverview()

  const isInitialLoading = (isPending && !data) || hardRefreshing
  const loading = isFetching || hardRefreshing
  const error = isError && !data && !hardRefreshing ? (queryError instanceof Error ? queryError.message : 'Failed to load security overview') : null

  const handleHardRefresh = () => {
    if (hardRefreshing) return
    setHardRefreshing(true)
    void (async () => {
      try {
        queryClient.removeQueries({ queryKey: QUERY_KEYS.adminSecurity() })
        await refetch({ cancelRefetch: true })
      } finally { setHardRefreshing(false) }
    })()
  }

  const handleMaintenanceToggle = async () => {
    if (!data) return
    const next = !data.systemSettings.maintenanceMode
    setMaintenanceSaving(true)
    try {
      const res = await fetch('/api/security', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ maintenanceMode: next }),
      })
      const j = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(j.error || 'Failed to update maintenance mode')
      showToast({ type: 'success', message: j.message || `Maintenance mode ${next ? 'enabled' : 'disabled'}` })
      await refetch()
    } catch (e: any) {
      showToast({ type: 'error', message: e?.message || 'Failed to update' })
    } finally {
      setMaintenanceSaving(false)
    }
  }

  const handleUnlock = async (userId: number) => {
    setUnlockingId(userId)
    try {
      const res = await fetch('/api/security', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ unlockUserId: userId }),
      })
      const j = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(j.error || 'Failed to unlock')
      showToast({ type: 'success', message: `User #${userId} unlocked` })
      await refetch()
    } catch (e: any) {
      showToast({ type: 'error', message: e?.message || 'Unlock failed' })
    } finally {
      setUnlockingId(null)
    }
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
            Security
          </h1>
          <p className="text-sm text-gray-500 dark:text-[#a1a1aa] mt-1">Security policies, brute-force protection, sessions & kill-switch — JWT 30d, 5 attempts / 10min lock, audit via user-events.</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleHardRefresh}
            disabled={loading}
            aria-label="Refresh security"
            title="Refresh — re-fetch from BFF and show skeleton"
            className="h-9 w-9 inline-flex items-center justify-center bg-white dark:bg-[#171717] border border-gray-200 dark:border-[#262626] rounded-xl hover:bg-gray-50 dark:hover:bg-[#262626] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <RefreshCw className={`w-4 h-4 text-gray-600 dark:text-[#a1a1aa] ${loading ? 'animate-spin' : ''}`} />
          </button>
          <a href="/settings/audit" className="inline-flex items-center gap-2 px-4 py-2.5 bg-[#eba236] hover:bg-[#c88a20] text-white rounded-xl text-sm font-semibold shadow-sm transition">
            <Activity className="w-4 h-4" /> View Audit Logs
          </a>
        </div>
      </div>

      {/* KPI Cards */}
      {data ? (
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
          <KpiCard title="Total Users" value={String(data.stats.totalUsers)} sub={`${data.stats.activeCount} active • ${data.stats.inactiveCount} inactive`} icon={<Users className="w-5 h-5 text-white" />} iconBg="bg-[#eba236]" />
          <KpiCard title="Locked Accounts" value={String(data.stats.lockedCount)} sub={`${data.stats.lockedCount ? 'needs unlock' : 'all clear'}`} icon={<Lock className="w-5 h-5 text-white" />} iconBg="bg-red-500" />
          <KpiCard title="Security Events" value={String(data.auditStats.securityEvents)} sub={`${data.auditStats.loginFailed} failed logins`} icon={<ShieldAlert className="w-5 h-5 text-white" />} iconBg="bg-amber-500" />
          <KpiCard title="Admins" value={String(data.stats.adminCount)} sub={`${data.stats.roleBreakdown.admin || 0} system: ${data.stats.adminLevelBreakdown.system || 0}`} icon={<Crown className="w-5 h-5 text-white" />} iconBg="bg-blue-600" />
          <KpiCard title="API Keys" value={data.authPolicy.useAPIKey ? 'Enabled' : 'Disabled'} sub={`${data.stats.roleBreakdown.service || 0} service accounts`} icon={<KeyRound className="w-5 h-5 text-white" />} iconBg="bg-emerald-500" />
        </div>
      ) : isInitialLoading ? (
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 animate-pulse">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-[86px] bg-gray-100 dark:bg-[#171717] rounded-xl border border-gray-200 dark:border-[#262626]" />
          ))}
        </div>
      ) : null}

      {error && (
        <div className="flex flex-col items-center justify-center py-8 px-6 bg-white dark:bg-[#171717] rounded-xl border border-gray-200 dark:border-[#262626]">
          <div className="h-12 w-12 bg-red-50 dark:bg-red-900/20 rounded-full flex items-center justify-center mb-3">
            <AlertCircle className="h-6 w-6 text-red-500" />
          </div>
          <h3 className="font-semibold text-gray-900 dark:text-white">Failed to load security overview</h3>
          <p className="text-sm text-gray-500 mt-1 mb-4 text-center max-w-md">{error}</p>
          <button onClick={handleHardRefresh} className="inline-flex items-center px-4 py-2 bg-[#eba236] text-white rounded-lg text-sm font-medium">
            <RefreshCw className="h-4 w-4 mr-2" />Retry
          </button>
        </div>
      )}

      {!error && data && (
        <div className="grid grid-cols-12 gap-5">
          {/* Left column - Policies & Controls (7 cols) */}
          <div className="col-span-12 lg:col-span-7 space-y-5">
            {/* Authentication Policy */}
            <Section
              title="Authentication Policy"
              icon={<Fingerprint className="w-4 h-4 text-[#eba236]" />}
              action={<span className="text-xs font-mono text-gray-500 dark:text-[#a1a1aa] border border-gray-200 dark:border-[#262626] rounded-full px-2.5 py-1">JWT • Payload Auth</span>}
            >
              <div className="space-y-1">
                <Row label="Token expiration" value={`${data.authPolicy.tokenExpirationDays} days (${data.authPolicy.tokenExpirationSeconds}s)`} mono icon={<Clock className="w-3.5 h-3.5" />} />
                <Row label="Max login attempts" value={`${data.authPolicy.maxLoginAttempts} attempts`} mono icon={<ShieldAlert className="w-3.5 h-3.5" />} />
                <Row label="Lock duration" value={`${data.authPolicy.lockTimeMinutes} minutes (${data.authPolicy.lockTimeMs}ms)`} mono icon={<Lock className="w-3.5 h-3.5" />} />
                <Row label="API keys" value={data.authPolicy.useAPIKey ? 'Enabled (per-user apiKey/apiKeyIndex)' : 'Disabled'} />
                <Row label="Cookie" value={`${data.authPolicy.cookieSecure ? 'Secure ✓' : 'Secure ✕'} • SameSite Lax ${data.authPolicy.cookieSameSite}`} />
                <div className="pt-3 flex items-center gap-2 text-xs text-gray-500 dark:text-[#a1a1aa] bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800 rounded-lg px-3 py-2.5">
                  <Info className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>Hardcoded in <span className="font-mono font-medium text-amber-800 dark:text-amber-300">Users.ts auth</span> — requires code change until SystemSettings security group is added.</span>
                </div>
              </div>
            </Section>

            {/* Password Policy */}
            <Section title="Password & Reset Policy" icon={<KeyRound className="w-4 h-4 text-indigo-600" />}>
              <div className="space-y-1">
                <Row label="Policy" value={data.passwordPolicy.description} />
                <Row label="Length" value={`${data.passwordPolicy.minLength} – ${data.passwordPolicy.maxLength} chars`} mono />
                <Row label="Requires" value={`${data.passwordPolicy.requireUppercase ? 'Uppercase ✓' : ''} ${data.passwordPolicy.requireNumber ? 'Number ✓' : ''} ${data.passwordPolicy.requireSpecial ? 'Special ✓' : ''}`.trim()} />
                <Row label="Reset TTL" value="20 minutes (RESET_PASSWORD_TTL_MINUTES)" mono />
                <Row label="Rate limits" value={`Forgot IP ${data.rateLimits.forgotPasswordIp} / Email ${data.rateLimits.forgotPasswordEmail} • Reset IP ${data.rateLimits.resetPasswordIp}`} />
                <Row label="Prunes" value="Expired tokens pruned, keep last 5" />
              </div>
            </Section>

            {/* Maintenance Mode */}
            <Section
              title="Kill Switch"
              icon={<Settings className="w-4 h-4 text-zinc-600" />}
              action={
                <label className="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" checked={data.systemSettings.maintenanceMode} onChange={handleMaintenanceToggle} disabled={maintenanceSaving} className="sr-only peer" />
                  <div className={`w-11 h-6 rounded-full peer transition ${data.systemSettings.maintenanceMode ? 'bg-[#eba236]' : 'bg-gray-200 dark:bg-[#333]'} peer-focus:ring-2 peer-focus:ring-[#eba236]/30 peer-disabled:opacity-50`}>
                    <div className={`h-5 w-5 rounded-full bg-white shadow transform transition ${data.systemSettings.maintenanceMode ? 'translate-x-5' : 'translate-x-0.5'} mt-0.5`}></div>
                  </div>
                </label>
              }
            >
              <div className="space-y-1">
                <Row label="Maintenance mode" value={data.systemSettings.maintenanceMode ? 'Enabled — non-admins redirected' : 'Disabled — platform live'} icon={<Shield className="w-3.5 h-3.5" />} />
                <Row label="Delivery provider" value={data.systemSettings.deliveryProvider} />
                <Row label="Source" value="Global system-settings (adminOnly update)" mono />
                <p className="text-xs text-gray-500 dark:text-[#a1a1aa] pt-2">Non-admin users see maintenance screen when enabled. Toggle is immediate and admin-only via <span className="font-mono">payload.updateGlobal</span>.</p>
                {maintenanceSaving && <p className="text-xs text-[#eba236] flex items-center gap-1"><RefreshCw className="w-3 h-3 animate-spin" /> Saving…</p>}
              </div>
            </Section>

            {/* CORS & Hardening */}
            <Section title="CORS & Environment Hardening" icon={<Globe className="w-4 h-4 text-sky-600" />}>
              <div className="space-y-1">
                <Row label="Allowed origins" value="8 env URLs (ADMIN_PROD/LOCAL, WEB_PROD/LOCAL, WEB_DRIVER, MOBILE, CMS_PROD/LOCAL) — checked in proxy.ts" />
                <Row label="Methods" value="GET, POST, PUT, DELETE, PATCH, OPTIONS" mono />
                <Row label="Headers" value="Content-Type, Authorization, X-Requested-With" mono />
                <Row label="Credentials / Max-Age" value="true / 86400s" mono />
                <Row label="Storage" value="Cloudinary main-uploads (cloudStoragePlugin)" />
                <Row label="PAYLOAD_SECRET" value={process.env.NEXT_PUBLIC_PAYLOAD_SECRET ? 'Present ✓' : 'Set via env (masked)'} mono />
              </div>
            </Section>
          </div>

          {/* Right column - Live state (5 cols) */}
          <div className="col-span-12 lg:col-span-5 space-y-5">
            {/* RBAC Matrix */}
            <Section title="RBAC Overview" icon={<Users className="w-4 h-4 text-[#eba236]" />}>
              <div className="space-y-3">
                <div className="grid grid-cols-5 gap-2 text-center">
                  {Object.entries(data.stats.roleBreakdown).map(([role, count]) => (
                    <div key={role} className="rounded-lg border border-gray-200 dark:border-[#262626] bg-gray-50 dark:bg-[#0a0a0a] p-3">
                      <p className="text-xs font-medium text-gray-500 dark:text-[#a1a1aa] capitalize">{role}</p>
                      <p className="text-lg font-bold text-gray-900 dark:text-white mt-1">{count as number}</p>
                    </div>
                  ))}
                </div>
                <div className="rounded-lg border border-dashed border-[#eba236]/30 bg-[#eba236]/10 p-3">
                  <p className="text-xs font-semibold text-gray-900 dark:text-white flex items-center gap-1"><Crown className="w-3 h-3 text-[#eba236]" /> Admin levels</p>
                  <div className="flex gap-2 mt-2">
                    {Object.entries(data.stats.adminLevelBreakdown).map(([lvl, cnt]) => (
                      <span key={lvl} className="inline-flex px-2.5 py-1 rounded-full text-xs font-medium bg-white dark:bg-[#171717] border border-gray-200 dark:border-[#262626] capitalize">{lvl}: {cnt as number}</span>
                    ))}
                    {Object.keys(data.stats.adminLevelBreakdown).length === 0 && <span className="text-xs text-gray-400">No admin profiles yet</span>}
                  </div>
                  <p className="text-xs text-gray-500 dark:text-[#a1a1aa] mt-2">Levels: system / department / content — stored in admins.systemPermissions JSON.</p>
                </div>
                <div className="text-xs text-gray-500 dark:text-[#a1a1aa] bg-gray-50 dark:bg-[#0a0a0a] border border-gray-200 dark:border-[#262626] rounded-lg p-3">
                  <p className="font-semibold text-gray-700 dark:text-white mb-1 flex items-center gap-1"><Fingerprint className="w-3 h-3" /> Access matrix</p>
                  <ul className="list-disc list-inside space-y-1 font-mono text-[11px]">
                    <li>users: read true → adminOnly create → self/admin update → adminOnly delete</li>
                    <li>media: read true, write authenticated, delete adminOnly</li>
                    <li>modifiers: service|admin only</li>
                    <li>apiKey: users API-Key header + 5min LRU cache</li>
                  </ul>
                </div>
              </div>
            </Section>

            {/* Locked Accounts */}
            <Section
              title={`Locked Accounts • ${data.stats.lockedCount}`}
              icon={<Lock className="w-4 h-4 text-red-600" />}
              action={data.stats.lockedCount > 0 ? <span className="text-xs font-medium px-2 py-1 rounded-full bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800">{data.stats.lockedCount} locked</span> : <span className="text-xs px-2 py-1 rounded-full bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">All clear</span>}
            >
              {data.lockedPreview.length === 0 ? (
                <div className="text-center py-8">
                  <div className="h-12 w-12 rounded-full bg-emerald-50 dark:bg-emerald-900/20 flex items-center justify-center mx-auto mb-3"><CheckCircle className="w-6 h-6 text-emerald-600" /></div>
                  <p className="text-sm font-medium text-gray-900 dark:text-white">No locked accounts</p>
                  <p className="text-xs text-gray-500 dark:text-[#a1a1aa] mt-1">Failed attempts under 5 / 10min window.</p>
                </div>
              ) : (
                <div className="divide-y divide-gray-100 dark:divide-[#262626] -m-5">
                  {data.lockedPreview.map((u) => (
                    <div key={u.id} className="flex items-center justify-between gap-3 px-5 py-3 hover:bg-gray-50 dark:hover:bg-[#0a0a0a]/50">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{u.firstName} {u.lastName} <span className="text-xs font-normal text-gray-500">#{u.id}</span></p>
                        <p className="text-xs text-gray-500 dark:text-[#a1a1aa] truncate">{u.email} • <span className="capitalize">{u.role}</span></p>
                        <p className="text-xs font-mono text-gray-400 mt-0.5">{u.loginAttempts} attempts • lock until {fmtDateTime(u.lockUntil)} • {u.isActive ? 'active' : 'inactive'}</p>
                      </div>
                      <button onClick={() => handleUnlock(u.id)} disabled={unlockingId === u.id} className="shrink-0 inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-white dark:bg-[#171717] border border-gray-200 dark:border-[#262626] hover:bg-gray-50 dark:hover:bg-[#262626] text-xs font-medium disabled:opacity-50">
                        {unlockingId === u.id ? <RefreshCw className="w-3 h-3 animate-spin" /> : <ShieldCheck className="w-3 h-3 text-emerald-600" />} Unlock
                      </button>
                    </div>
                  ))}
                  {data.stats.lockedCount > 5 && <p className="text-xs text-center text-gray-500 py-3">…and {data.stats.lockedCount - 5} more. Filter in Users → Locked.</p>}
                </div>
              )}
              <div className="mt-4 rounded-lg bg-sky-50 dark:bg-sky-900/10 border border-sky-200 dark:border-sky-800 p-3 flex gap-2">
                <Info className="w-4 h-4 text-sky-600 shrink-0 mt-0.5" />
                <p className="text-xs text-sky-800 dark:text-sky-300">Payload increments <span className="font-mono">loginAttempts</span> on failure and sets <span className="font-mono">lockUntil</span> after 5. Unlock resets both to <span className="font-mono">0 / null</span>.</p>
              </div>
            </Section>

            {/* Recent security events */}
            <Section
              title="Recent Security Events"
              icon={<Activity className="w-4 h-4 text-amber-600" />}
              action={<a href="/settings/audit" className="text-xs font-semibold text-[#eba236] hover:text-[#c88a20]">View all →</a>}
            >
              {data.recentSecurityEvents.length === 0 ? (
                <div className="text-center py-8">
                  <div className="h-10 w-10 rounded-full bg-gray-100 dark:bg-[#262626] flex items-center justify-center mx-auto mb-3"><Clock className="w-5 h-5 text-gray-400" /></div>
                  <p className="text-sm text-gray-500">No security events in last 2k</p>
                </div>
              ) : (
                <div className="divide-y divide-gray-100 dark:divide-[#262626] -m-5">
                  {data.recentSecurityEvents.map((e: any) => (
                    <div key={e.id} className="px-5 py-3 flex items-start gap-3 hover:bg-gray-50 dark:hover:bg-[#0a0a0a]/50">
                      <div className="h-8 w-8 rounded-full bg-amber-50 dark:bg-amber-900/20 flex items-center justify-center shrink-0 mt-0.5">
                        {e.eventType === 'LOGIN_FAILED' ? <XCircle className="w-4 h-4 text-red-500" /> : e.eventType === 'LOGIN_SUCCESS' ? <CheckCircle className="w-4 h-4 text-emerald-500" /> : <ShieldAlert className="w-4 h-4 text-amber-600" />}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-gray-900 dark:text-white capitalize">{e.eventType.replace(/_/g, ' ').toLowerCase()}</p>
                        <p className="text-xs text-gray-500 dark:text-[#a1a1aa] truncate">{e.user ? `${e.user.firstName} ${e.user.lastName} <${e.user.email}>` : `User #${e.user?.id ?? '—'}`} • {fmtDateTime(e.timestamp)}</p>
                        {e.ipAddress && <p className="text-[11px] text-gray-400">IP {e.ipAddress}</p>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Section>

            {/* Sessions hint */}
            <Section title="Sessions & Cookies" icon={<Smartphone className="w-4 h-4 text-sky-600" />}>
              <div className="space-y-1">
                <Row label="Token lifespan" value="30 days (2,592,000s)" mono icon={<Clock className="w-3.5 h-3.5" />} />
                <Row label="Session table" value="users_sessions (id, createdAt, expiresAt) — cascade on user delete" mono />
                <Row label="Cookie" value="Secure in prod • SameSite Lax • COOKIE_DOMAIN env" />
                <Row label="Revoke" value="Update users.sessions = [] via admin → deactivate or delete" />
                <p className="text-xs text-gray-500 dark:text-[#a1a1aa] pt-2">Admins see <span className="font-medium">lastLogin</span> per user in Users table. Session list per user is available in payload-admin Users detail drawer.</p>
              </div>
            </Section>
          </div>
        </div>
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

export default function SecuritySettingsPage(){
  return (
    <ClientOnly fallback={<SecuritySkeleton />}>
      <SecuritySettingsPageContent />
    </ClientOnly>
  )
}
