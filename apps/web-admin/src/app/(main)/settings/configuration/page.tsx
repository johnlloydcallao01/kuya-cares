'use client'

import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { useSearchParams, useRouter } from 'next/navigation'
import { useQueryClient } from '@tanstack/react-query'
import { QUERY_KEYS } from '@encreasl/client-services'
import { useConfiguration } from '@/hooks/useConfiguration'
import { ClientOnly } from '@/components/ClientOnly'
import {
  Settings,
  Shield,
  Truck,
  CreditCard,
  Globe,
  Smartphone,
  KeyRound,
  RefreshCw,
  AlertCircle,
  Clock,
  CheckCircle,
  X,
  Info,
  Save,
  Eye,
  EyeOff,
  ExternalLink,
  Activity,
} from '@/components/ui/IconWrapper'

type Tab = 'general' | 'delivery' | 'payments'

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
        <h3 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2 text-sm">{icon}{title}</h3>
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

const inputCls = 'mt-1 w-full px-3 py-2.5 rounded-lg border border-gray-200 dark:border-[#262626] bg-white dark:bg-[#0a0a0a] text-sm text-gray-900 dark:text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#eba236]/20 focus:border-[#eba236]'
const labelCls = 'text-xs font-medium text-gray-700 dark:text-[#a1a1aa]'

function ConfigurationSkeleton(){
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

function ConfigurationPageContent(){
  const searchParams = useSearchParams()
  const router = useRouter()
  const initialTab = (searchParams.get('tab') as Tab) || 'general'
  const [activeTab, setActiveTab] = useState<Tab>(['general', 'delivery', 'payments'].includes(initialTab) ? initialTab : 'general')

  const [toast, setToast] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null)

  // form states
  const [maintenanceSaving, setMaintenanceSaving] = useState(false)
  const [deliverySaving, setDeliverySaving] = useState(false)

  const [deliveryProvider, setDeliveryProvider] = useState<'lalamove' | 'native'>('lalamove')
  const [lalamoveApiKey, setLalamoveApiKey] = useState('')
  const [lalamoveApiSecret, setLalamoveApiSecret] = useState('')
  const [lalamoveMarket, setLalamoveMarket] = useState('PH')
  const [lalamoveSandbox, setLalamoveSandbox] = useState(true)
  const [nativeRiderAppUrl, setNativeRiderAppUrl] = useState('')
  const [showLalaKey, setShowLalaKey] = useState(false)
  const [showLalaSecret, setShowLalaSecret] = useState(false)

  const showToast = useCallback((t: { type: 'success' | 'error' | 'info'; message: string }) => {
    setToast(t)
    setTimeout(() => setToast(null), 4200)
  }, [])

  const queryClient = useQueryClient()
  const [hardRefreshing, setHardRefreshing] = useState(false)
  const { data, isPending, isFetching, isError, error: queryError, refetch } = useConfiguration()

  const isInitialLoading = (isPending && !data) || hardRefreshing
  const loading = isFetching || hardRefreshing
  const error = isError && !data && !hardRefreshing ? (queryError instanceof Error ? queryError.message : 'Failed to load configuration') : null

  const handleHardRefresh = () => {
    if (hardRefreshing) return
    setHardRefreshing(true)
    void (async () => {
      try {
        queryClient.removeQueries({ queryKey: QUERY_KEYS.adminConfiguration() })
        await refetch({ cancelRefetch: true })
      } finally { setHardRefreshing(false) }
    })()
  }

  // sync form states from fresh data (runs on initial fetch + post-mutation refetch)
  useEffect(() => {
    if (!data) return
    setDeliveryProvider(data.systemSettings.deliveryProvider)
    setLalamoveMarket(data.systemSettings.lalamove.market || 'PH')
    setLalamoveSandbox(data.systemSettings.lalamove.sandbox)
    setNativeRiderAppUrl(data.systemSettings.native.riderAppUrl || '')
    // keep apiKey/secret inputs empty (masked) unless user wants to overwrite
    setLalamoveApiKey('')
    setLalamoveApiSecret('')
  }, [data])

  useEffect(() => {
    const tab = searchParams.get('tab') as Tab | null
    if (tab && ['general', 'delivery', 'payments'].includes(tab) && tab !== activeTab) setActiveTab(tab)
  }, [searchParams])

  const handleTab = (tab: Tab) => {
    setActiveTab(tab)
    const params = new URLSearchParams(searchParams.toString())
    params.set('tab', tab)
    router.replace(`?${params.toString()}` as any, { scroll: false })
  }

  const handleMaintenanceToggle = async () => {
    if (!data) return
    const next = !data.systemSettings.maintenanceMode
    setMaintenanceSaving(true)
    try {
      const res = await fetch('/api/configuration', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ maintenanceMode: next }) })
      const j = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(j.error || 'Failed to update')
      showToast({ type: 'success', message: j.message || `Maintenance ${next ? 'enabled' : 'disabled'}` })
      await refetch()
    } catch (e: any) {
      showToast({ type: 'error', message: e?.message || 'Update failed' })
    } finally {
      setMaintenanceSaving(false)
    }
  }

  const handleDeliverySave = async () => {
    setDeliverySaving(true)
    try {
      const body: any = { deliveryProvider }
      if (deliveryProvider === 'lalamove') {
        body.lalamove = {
          market: lalamoveMarket.trim() || 'PH',
          sandbox: lalamoveSandbox,
          ...(lalamoveApiKey.trim() ? { apiKey: lalamoveApiKey.trim() } : {}),
          ...(lalamoveApiSecret.trim() ? { apiSecret: lalamoveApiSecret.trim() } : {}),
        }
        // allow clearing: if input is explicitly empty and we want to clear, send null? For now omit means keep.
      } else {
        body.native = { riderAppUrl: nativeRiderAppUrl.trim() || null }
      }
      const res = await fetch('/api/configuration', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      const j = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(j.error || 'Failed to save delivery config')
      showToast({ type: 'success', message: 'Delivery provider updated' })
      setLalamoveApiKey('')
      setLalamoveApiSecret('')
      await refetch()
    } catch (e: any) {
      showToast({ type: 'error', message: e?.message || 'Save failed' })
    } finally {
      setDeliverySaving(false)
    }
  }

  const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: 'general', label: 'General & Maintenance', icon: <Settings className="w-4 h-4" /> },
    { id: 'delivery', label: 'Delivery Provider', icon: <Truck className="w-4 h-4" /> },
    { id: 'payments', label: 'Payment Gateway', icon: <CreditCard className="w-4 h-4" /> },
  ]

  return (
    <div className="space-y-6 py-5 px-2.5">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white tracking-tight flex items-center gap-2">
            <span className="h-8 w-8 rounded-lg bg-[#eba236] text-white flex items-center justify-center">
              <Settings className="w-4 h-4" />
            </span>
            Configurations
          </h1>
          <p className="text-sm text-gray-500 dark:text-[#a1a1aa] mt-1">Platform Configuration — maintenance, delivery provider, and payment gateway. Single unified page.</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={handleHardRefresh} disabled={loading} aria-label="Refresh configuration" className="h-9 w-9 inline-flex items-center justify-center bg-white dark:bg-[#171717] border border-gray-200 dark:border-[#262626] rounded-xl hover:bg-gray-50 dark:hover:bg-[#262626] disabled:opacity-50">
            <RefreshCw className={`w-4 h-4 text-gray-600 dark:text-[#a1a1aa] ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      {data ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <KpiCard title="Maintenance" value={data.systemSettings.maintenanceMode ? 'Enabled' : 'Disabled'} sub={data.systemSettings.maintenanceMode ? 'Redirect for non-admin' : 'Platform live'} icon={<Shield className="w-5 h-5 text-white" />} iconBg={data.systemSettings.maintenanceMode ? 'bg-amber-500' : 'bg-emerald-500'} />
          <KpiCard title="Delivery Provider" value={data.systemSettings.deliveryProvider === 'lalamove' ? 'Lalamove' : 'Native'} sub={`Market ${data.systemSettings.lalamove.market} • ${data.runtimeEnv.lalamove.baseUrl.includes('sandbox') ? 'Sandbox' : 'Live'}`} icon={<Truck className="w-5 h-5 text-white" />} iconBg="bg-sky-600" />
          <KpiCard title="Payment Gateway" value={data.runtimeEnv.paymongo.sandbox ? 'PayMongo Sandbox' : 'PayMongo Live'} sub={`${data.runtimeEnv.paymongo.hasSecretKey ? 'Secrets set ✓' : 'Secrets missing'} • ${data.runtimeEnv.paymongo.hasWebhookSecret ? 'Webhook ✓' : 'Webhook ✕'}`} icon={<CreditCard className="w-5 h-5 text-white" />} iconBg={data.runtimeEnv.paymongo.hasSecretKey ? 'bg-emerald-500' : 'bg-red-500'} />
          <KpiCard title="System Settings" value={data.systemSettings.hasSystemSettings ? 'Persisted' : 'Defaults'} sub={data.systemSettings.updatedAt ? `Updated ${fmtDate(data.systemSettings.updatedAt)}` : 'No row yet'} icon={<Activity className="w-5 h-5 text-white" />} iconBg="bg-[#eba236]" />
        </div>
      ) : isInitialLoading ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 animate-pulse">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-[86px] bg-gray-100 dark:bg-[#171717] rounded-xl border border-gray-200 dark:border-[#262626]" />
          ))}
        </div>
      ) : null}

      {/* Tabs bar */}
      <div className="bg-white dark:bg-[#171717] rounded-xl border border-gray-200 dark:border-[#262626] p-1.5 flex gap-1 shadow-sm">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => handleTab(t.id)}
            className={`flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold transition ${activeTab === t.id ? 'bg-[#eba236] text-white shadow-sm' : 'text-gray-600 dark:text-[#a1a1aa] hover:bg-gray-50 dark:hover:bg-[#262626] hover:text-gray-900 dark:hover:text-white'}`}
          >
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {/* Skeleton screen — mirrors /vendors: full page skeleton while loading, like vendors table skeleton */}
      {loading && !data && (
        <div className="grid grid-cols-12 gap-5">
          <div className="col-span-12 lg:col-span-7 space-y-5">
            <div className="bg-white dark:bg-[#171717] rounded-xl border border-gray-200 dark:border-[#262626] shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100 dark:border-[#262626]">
                <div className="h-5 w-48 bg-gray-100 dark:bg-[#0a0a0a] rounded animate-pulse" />
              </div>
              <div className="p-5 space-y-4">
                <div className="h-4 w-full bg-gray-100 dark:bg-[#0a0a0a] rounded animate-pulse" />
                <div className="h-10 w-full bg-gray-100 dark:bg-[#0a0a0a] rounded-lg animate-pulse" />
                <div className="h-10 w-full bg-gray-100 dark:bg-[#0a0a0a] rounded-lg animate-pulse" />
                <div className="h-20 w-full bg-gray-100 dark:bg-[#0a0a0a] rounded-lg animate-pulse" />
              </div>
            </div>
            <div className="bg-white dark:bg-[#171717] rounded-xl border border-gray-200 dark:border-[#262626] shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100 dark:border-[#262626]">
                <div className="h-5 w-40 bg-gray-100 dark:bg-[#0a0a0a] rounded animate-pulse" />
              </div>
              <div className="p-5 space-y-3">
                <div className="h-12 w-full bg-gray-100 dark:bg-[#0a0a0a] rounded-lg animate-pulse" />
                <div className="h-12 w-full bg-gray-100 dark:bg-[#0a0a0a] rounded-lg animate-pulse" />
                <div className="h-16 w-full bg-gray-100 dark:bg-[#0a0a0a] rounded-lg animate-pulse" />
              </div>
            </div>
          </div>
          <div className="col-span-12 lg:col-span-5 space-y-5">
            <div className="bg-white dark:bg-[#171717] rounded-xl border border-gray-200 dark:border-[#262626] p-5 shadow-sm">
              <div className="h-5 w-32 bg-gray-100 dark:bg-[#0a0a0a] rounded animate-pulse mb-4" />
              <div className="space-y-3">
                <div className="h-8 w-full bg-gray-100 dark:bg-[#0a0a0a] rounded animate-pulse" />
                <div className="h-8 w-full bg-gray-100 dark:bg-[#0a0a0a] rounded animate-pulse" />
                <div className="h-8 w-full bg-gray-100 dark:bg-[#0a0a0a] rounded animate-pulse" />
              </div>
            </div>
            <div className="bg-white dark:bg-[#171717] rounded-xl border border-gray-200 dark:border-[#262626] p-5 shadow-sm">
              <div className="h-5 w-36 bg-gray-100 dark:bg-[#0a0a0a] rounded animate-pulse mb-4" />
              <div className="h-24 w-full bg-gray-100 dark:bg-[#0a0a0a] rounded-lg animate-pulse" />
            </div>
          </div>
        </div>
      )}

      {error && (
        <div className="flex flex-col items-center justify-center py-8 px-6 bg-white dark:bg-[#171717] rounded-xl border border-gray-200 dark:border-[#262626]">
          <div className="h-12 w-12 bg-red-50 dark:bg-red-900/20 rounded-full flex items-center justify-center mb-3">
            <AlertCircle className="h-6 w-6 text-red-500" />
          </div>
          <h3 className="font-semibold text-gray-900 dark:text-white">Failed to load configuration</h3>
          <p className="text-sm text-gray-500 mt-1 mb-4 text-center max-w-md">{error}</p>
          <button onClick={handleHardRefresh} className="inline-flex items-center px-4 py-2 bg-[#eba236] text-white rounded-lg text-sm font-medium">
            <RefreshCw className="h-4 w-4 mr-2" />Retry
          </button>
        </div>
      )}

      {!error && data && (
        <>
          {activeTab === 'general' && (
            <div className="grid grid-cols-12 gap-5">
              <div className="col-span-12 lg:col-span-7 space-y-5">
                <Section
                  title="General & Maintenance Mode"
                  icon={<Shield className="w-4 h-4 text-[#eba236]" />}
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
                    <Row label="Maintenance mode" value={data.systemSettings.maintenanceMode ? 'Enabled — non-admins redirected to maintenance page' : 'Disabled — platform live'} icon={<Shield className="w-3.5 h-3.5" />} />
                    <Row label="Source" value="system-settings.maintenanceMode (global, adminOnly update)" mono />
                    <Row label="Created" value={data.systemSettings.createdAt ? fmtDate(data.systemSettings.createdAt) : '—'} icon={<Clock className="w-3.5 h-3.5" />} />
                    <Row label="Updated" value={data.systemSettings.updatedAt ? fmtDate(data.systemSettings.updatedAt) : '—'} icon={<Clock className="w-3.5 h-3.5" />} />
                    <p className="text-xs text-gray-500 dark:text-[#a1a1aa] pt-3 bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800 rounded-lg px-3 py-2.5 flex gap-2">
                      <Info className="w-4 h-4 text-amber-600 shrink-0" />
                      <span>Toggle is immediate and admin-only via <span className="font-mono font-medium">payload.updateGlobal system-settings</span>. When enabled, all non-admin users are redirected.</span>
                    </p>
                    {maintenanceSaving && <p className="text-xs text-[#eba236] flex items-center gap-1"><RefreshCw className="w-3 h-3 animate-spin" /> Saving…</p>}
                  </div>
                </Section>

                <Section title="Authentication Policy (read-only)" icon={<KeyRound className="w-4 h-4 text-indigo-600" />}>
                  <div className="space-y-1">
                    <Row label="Token expiration" value={`${data.authPolicy.tokenExpirationDays} days (${(data.authPolicy.tokenExpirationSeconds ?? data.authPolicy.tokenExpirationDays * 86400).toString()}s)`} mono icon={<Clock className="w-3.5 h-3.5" />} />
                    <Row label="Max login attempts" value={`${data.authPolicy.maxLoginAttempts} attempts → lock`} />
                    <Row label="Lock duration" value={`${data.authPolicy.lockTimeMinutes} minutes`} />
                    <Row label="Source" value="Users.ts auth (code) — requires deploy to change. See /settings/security for lock overview." mono />
                  </div>
                </Section>
              </div>

              <div className="col-span-12 lg:col-span-5 space-y-5">
                <Section title="Platform Health" icon={<Activity className="w-4 h-4 text-emerald-600" />}>
                  <div className="space-y-1">
                    <Row label="Has system row" value={data.systemSettings.hasSystemSettings ? 'Yes' : 'No (defaults: lalamove/maintenance off)'} />
                    <Row label="Generated at" value={fmtDate(data.meta.generatedAt)} mono />
                    <Row label="PAYLOAD_SECRET" value={data.runtimeEnv.cors.hasSecret ? `Present (${data.runtimeEnv.cors.secretLength} chars) ✓` : 'Missing ✕'} />
                  </div>
                </Section>

                <Section title="Quick Actions" icon={<Settings className="w-4 h-4 text-zinc-600" />}>
                  <div className="grid grid-cols-1 gap-2">
                    <a href="/settings/security" className="flex items-center gap-3 p-3 rounded-xl border border-gray-200 dark:border-[#262626] hover:bg-gray-50 dark:hover:bg-[#0a0a0a] transition">
                      <span className="h-9 w-9 rounded-lg bg-[#eba236] text-white flex items-center justify-center">
                        <Shield className="w-4 h-4" />
                      </span>
                      <div>
                        <p className="text-sm font-medium text-gray-900 dark:text-white">Security overview</p>
                        <p className="text-xs text-gray-500 dark:text-[#a1a1aa]">Locks, RBAC, audit</p>
                      </div>
                    </a>
                    <a href="/settings/audit" className="flex items-center gap-3 p-3 rounded-xl border border-gray-200 dark:border-[#262626] hover:bg-gray-50 dark:hover:bg-[#0a0a0a] transition">
                      <span className="h-9 w-9 rounded-lg bg-sky-600 text-white flex items-center justify-center">
                        <Activity className="w-4 h-4" />
                      </span>
                      <div>
                        <p className="text-sm font-medium text-gray-900 dark:text-white">Audit logs</p>
                        <p className="text-xs text-gray-500 dark:text-[#a1a1aa]">8 event types, user-events</p>
                      </div>
                    </a>
                  </div>
                </Section>
              </div>
            </div>
          )}

          {activeTab === 'delivery' && (
            <div className="grid grid-cols-12 gap-5">
              <div className="col-span-12 lg:col-span-7 space-y-5">
                <Section
                  title="Delivery Provider"
                  icon={<Truck className="w-4 h-4 text-sky-600" />}
                  action={<span className={`text-xs font-medium px-2.5 py-1 rounded-full border ${data.systemSettings.deliveryProvider === 'lalamove' ? 'bg-sky-50 dark:bg-sky-900/20 text-sky-700 dark:text-sky-300 border-sky-200 dark:border-sky-800' : 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'}`}>{data.systemSettings.deliveryProvider}</span>}
                >
                  <div className="space-y-4">
                    <div>
                      <label className={labelCls}>Active provider *</label>
                      <select value={deliveryProvider} onChange={(e) => setDeliveryProvider(e.target.value as any)} className={inputCls}>
                        <option value="lalamove">Lalamove</option>
                        <option value="native">Native</option>
                      </select>
                      <p className="text-xs text-gray-400 mt-1">Controls <span className="font-mono">getDeliveryProvider(payload.findGlobal system-settings)</span> in deliveryProviders/index.ts.</p>
                    </div>

                    {deliveryProvider === 'lalamove' ? (
                      <div className="space-y-3 p-4 rounded-xl border border-gray-200 dark:border-[#262626] bg-gray-50 dark:bg-[#0a0a0a]">
                        <h4 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2"><Globe className="w-4 h-4 text-sky-600" /> Lalamove Configuration</h4>
                        <div>
                          <label className={labelCls}>API Key <span className="text-gray-400 font-normal">(pk_test_xxx or pk_prod_xxx) — masked: {data.systemSettings.lalamove.apiKeyMasked || '—'}</span></label>
                          <div className="relative mt-1">
                            <input type={showLalaKey ? 'text' : 'password'} value={lalamoveApiKey} onChange={(e) => setLalamoveApiKey(e.target.value)} placeholder={data.systemSettings.lalamove.hasApiKey ? '•••••••• (leave blank to keep)' : 'pk_test_xxx'} className={`${inputCls} pr-10`} />
                            <button type="button" onClick={() => setShowLalaKey((v) => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                              {showLalaKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                            </button>
                          </div>
                        </div>
                        <div>
                          <label className={labelCls}>API Secret <span className="text-gray-400 font-normal">(masked: {data.systemSettings.lalamove.apiSecretMasked || '—'})</span></label>
                          <div className="relative mt-1">
                            <input type={showLalaSecret ? 'text' : 'password'} value={lalamoveApiSecret} onChange={(e) => setLalamoveApiSecret(e.target.value)} placeholder={data.systemSettings.lalamove.hasApiSecret ? '•••••••• (leave blank to keep)' : 'sk_test_xxx'} className={`${inputCls} pr-10`} />
                            <button type="button" onClick={() => setShowLalaSecret((v) => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                              {showLalaSecret ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                            </button>
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className={labelCls}>Market</label>
                            <input value={lalamoveMarket} onChange={(e) => setLalamoveMarket(e.target.value)} placeholder="PH" className={`${inputCls} font-mono`} />
                          </div>
                          <div className="flex items-center gap-2 pt-6">
                            <label className="flex items-center gap-2 cursor-pointer">
                              <input type="checkbox" checked={lalamoveSandbox} onChange={(e) => setLalamoveSandbox(e.target.checked)} className="h-4 w-4 rounded border-gray-300 text-[#eba236]" />
                              <span className="text-sm font-medium text-gray-700 dark:text-white">Sandbox</span>
                            </label>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-3 p-4 rounded-xl border border-gray-200 dark:border-[#262626] bg-gray-50 dark:bg-[#0a0a0a]">
                        <h4 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2"><Smartphone className="w-4 h-4 text-emerald-600" /> Native Delivery</h4>
                        <div>
                          <label className={labelCls}>Rider App URL</label>
                          <input value={nativeRiderAppUrl} onChange={(e) => setNativeRiderAppUrl(e.target.value)} placeholder="https://rider.tap2go.com" className={inputCls} />
                          <p className="text-xs text-gray-400 mt-1">Base URL for native rider application.</p>
                        </div>
                      </div>
                    )}

                    <button onClick={handleDeliverySave} disabled={deliverySaving} className="w-full inline-flex items-center justify-center gap-2 py-3 bg-[#eba236] hover:bg-[#c88a20] disabled:opacity-50 text-white rounded-xl font-semibold shadow-sm transition">
                      {deliverySaving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Save delivery config
                    </button>
                  </div>
                </Section>

                {(data.divergence.lalamoveApiKeyMismatch || data.divergence.marketMismatch || data.divergence.sandboxMismatch) && (
                  <div className="rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/10 p-4 flex gap-3">
                    <AlertCircle className="w-5 h-5 text-amber-600 shrink-0" />
                    <div className="text-sm">
                      <p className="font-semibold text-amber-800 dark:text-amber-300">Divergence: DB vs ENV</p>
                      <ul className="text-xs text-amber-700 dark:text-amber-400 mt-1 list-disc list-inside">
                        {data.divergence.lalamoveApiKeyMismatch && <li>{data.divergence.lalamoveApiKeyMismatch}</li>}
                        {data.divergence.marketMismatch && <li>{data.divergence.marketMismatch}</li>}
                        {data.divergence.sandboxMismatch && <li>{data.divergence.sandboxMismatch}</li>}
                      </ul>
                      <p className="text-xs text-gray-600 dark:text-[#a1a1aa] mt-2">Runtime currently reads <span className="font-mono">process.env.LALAMOVE_*</span> (requires restart). DB values are persisted but not yet wired to runtime.</p>
                    </div>
                  </div>
                )}
              </div>

              <div className="col-span-12 lg:col-span-5 space-y-5">
                <Section title="Runtime Env (read-only)" icon={<Globe className="w-4 h-4 text-sky-600" />}>
                  <div className="space-y-1">
                    <Row label="Base URL" value={data.runtimeEnv.lalamove.baseUrl} mono icon={<Globe className="w-3.5 h-3.5" />} />
                    <Row label="Has API key (ENV)" value={data.runtimeEnv.lalamove.hasApiKey ? 'Yes ✓' : 'No ✕'} />
                    <Row label="Has API secret (ENV)" value={data.runtimeEnv.lalamove.hasApiSecret ? 'Yes ✓' : 'No ✕'} />
                    <Row label="Market (ENV)" value={data.runtimeEnv.lalamove.market} mono />
                    <Row label="Priority fee" value={data.runtimeEnv.lalamove.priorityFee} mono />
                    <Row label="Sandbox (ENV)" value={data.runtimeEnv.lalamove.sandbox ? 'true (sandbox)' : 'false (live)'} mono />
                  </div>
                </Section>

                <Section title="Next Steps" icon={<Info className="w-4 h-4 text-sky-600" />}>
                  <p className="text-sm text-gray-600 dark:text-[#a1a1aa]">DB selection controls <span className="font-medium text-gray-900 dark:text-white">which provider</span> to use, but credentials are still ENV-only. To fully migrate to DB, refactor <span className="font-mono">lalamoveClient.ts</span> to accept params from <span className="font-mono">system-settings</span>.</p>
                  <a href="https://developers.lalamove.com" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs font-semibold text-[#eba236] hover:text-[#c88a20] mt-3">
                    Lalamove Docs <ExternalLink className="w-3 h-3" />
                  </a>
                </Section>
              </div>
            </div>
          )}

          {activeTab === 'payments' && (
            <div className="grid grid-cols-12 gap-5">
              <div className="col-span-12 lg:col-span-8 space-y-5">
                <Section
                  title="Payment Gateway — PayMongo"
                  icon={<CreditCard className="w-4 h-4 text-emerald-600" />}
                  action={<span className={`text-xs font-medium px-2.5 py-1 rounded-full border ${data.runtimeEnv.paymongo.sandbox ? 'bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800' : 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'}`}>{data.runtimeEnv.paymongo.sandbox ? 'Sandbox' : 'Live'}</span>}
                >
                  <div className="space-y-1">
                    <Row label="Provider" value="PayMongo (env-only)" />
                    <Row label="Public key" value={data.runtimeEnv.paymongo.publicKeyMasked ? `${data.runtimeEnv.paymongo.publicKeyMasked} ${data.runtimeEnv.paymongo.hasPublicKey ? '✓' : ''}` : 'Not set ✕'} mono />
                    <Row label="Secret key" value={data.runtimeEnv.paymongo.secretKeyMasked ? `${data.runtimeEnv.paymongo.secretKeyMasked} ${data.runtimeEnv.paymongo.hasSecretKey ? '✓' : ''}` : 'Not set ✕'} mono />
                    <Row label="Webhook secret" value={data.runtimeEnv.paymongo.webhookSecretMasked ? `${data.runtimeEnv.paymongo.webhookSecretMasked} ✓` : 'Not set ✕'} mono />
                    <Row label="Webhook URL" value={data.runtimeEnv.paymongo.webhookUrl} mono icon={<Globe className="w-3.5 h-3.5" />} />
                    <div className="pt-3 rounded-lg bg-sky-50 dark:bg-sky-900/10 border border-sky-200 dark:border-sky-800 p-3 flex gap-2">
                      <Info className="w-4 h-4 text-sky-600 shrink-0" />
                      <p className="text-xs text-sky-800 dark:text-sky-300">PayMongo keys are <span className="font-semibold">env-only</span> — no DB field exists. Set <span className="font-mono">PAYMONGO_SECRET_KEY_LIVE / PAYMONGO_PUBLIC_KEY_LIVE / PAYMONGO_WEBHOOK_SECRET</span> (or <span className="font-mono">_SANDBOX</span> variants when <span className="font-mono">PAYMONGO_SANDBOX=true</span>) in <span className="font-mono">apps/cms/.env</span> and redeploy. See <span className="font-mono">apps/cms/.env.example:48-51</span> and <span className="font-mono">render.yaml:41</span>.</p>
                    </div>
                    <Row label="Docs" value={<a href="https://developers.paymongo.com" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-[#eba236] hover:text-[#c88a20]">developers.paymongo.com <ExternalLink className="w-3 h-3" /></a>} />
                  </div>
                </Section>

                <Section title="How it’s wired (for devs)" icon={<Activity className="w-4 h-4 text-zinc-600" />}>
                  <div className="space-y-1 font-mono text-xs">
                    <Row label="Create intent" value="POST /api/create-payment-intent → api.paymongo.com/v1/payment_intents" mono />
                    <Row label="Webhook" value="POST /api/paymongo/webhook → PAYMONGO_WEBHOOK_SECRET HMAC" mono />
                    <Row label="Transactions" value="transactions.payment_intent_id / status pending→paid|failed" mono />
                    <Row label="Orders" value="orders.status → accepted on paid" mono />
                  </div>
                </Section>
              </div>

              <div className="col-span-12 lg:col-span-4 space-y-5">
                <Section title="Status" icon={<CheckCircle className="w-4 h-4 text-emerald-600" />}>
                  <div className="text-center py-6">
                    <div className={`h-14 w-14 rounded-full flex items-center justify-center mx-auto mb-3 ${data.runtimeEnv.paymongo.hasSecretKey && data.runtimeEnv.paymongo.hasWebhookSecret ? 'bg-emerald-50 dark:bg-emerald-900/20' : 'bg-red-50 dark:bg-red-900/20'}`}>
                      <CreditCard className={`w-7 h-7 ${data.runtimeEnv.paymongo.hasSecretKey && data.runtimeEnv.paymongo.hasWebhookSecret ? 'text-emerald-600' : 'text-red-600'}`} />
                    </div>
                    <p className="text-sm font-semibold text-gray-900 dark:text-white">{data.runtimeEnv.paymongo.hasSecretKey && data.runtimeEnv.paymongo.hasWebhookSecret ? 'Ready for payments' : 'Action required'}</p>
                    <p className="text-xs text-gray-500 dark:text-[#a1a1aa] mt-1">{data.runtimeEnv.paymongo.sandbox ? 'Sandbox mode — test keys active' : 'Live mode'}</p>
                    {!data.runtimeEnv.paymongo.hasSecretKey && <p className="text-xs text-red-600 dark:text-red-400 mt-2">Secret key missing — payments will fail.</p>}
                    {!data.runtimeEnv.paymongo.hasWebhookSecret && <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">Webhook secret missing — post-payment will not confirm.</p>}
                  </div>
                </Section>

                <Section title="Related collections" icon={<Settings className="w-4 h-4 text-zinc-600" />}>
                  <div className="space-y-1 text-sm">
                    <Row label="Transactions" value="payment_intent_id, amount, status, paid_at" mono />
                    <Row label="Orders" value="lalamove_order_id, delivery_status" mono />
                    <p className="text-xs text-gray-500 dark:text-[#a1a1aa] pt-2">No PayMongo config collection — gateway is env + webhook code.</p>
                  </div>
                </Section>
              </div>
            </div>
          )}
        </>
      )}

      {/* Toast */}
      {toast && typeof document !== 'undefined' &&
        createPortal(
          <div className="fixed top-4 right-4 z-[110] max-w-sm animate-in slide-in-from-top-2 fade-in">
            <div className={`flex items-start gap-3 px-4 py-3 rounded-xl shadow-lg border backdrop-blur text-sm font-medium ${toast.type === 'success' ? 'bg-emerald-50 dark:bg-emerald-900/30 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200' : toast.type === 'error' ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800 text-red-800 dark:text-red-200' : 'bg-sky-50 dark:bg-sky-900/30 border-sky-200 text-sky-800'}`}>
              <span className="flex-1 leading-snug">{toast.message}</span>
              <button onClick={() => setToast(null)} className="opacity-60 hover:opacity-100 transition ml-1">
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>,
          document.body
        )}
    </div>
  )
}

export default function ConfigurationPage(){
  // Pure CSR: ?tab= seeds useState on first render (server null vs client real)
  // + TZ-sensitive dates → identical skeleton until mounted.
  return (
    <ClientOnly fallback={<ConfigurationSkeleton />}>
      <ConfigurationPageContent />
    </ClientOnly>
  )
}

function fmtDate(iso: string | null) {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleDateString('en-PH', { timeZone: 'Asia/Manila', year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
  } catch {
    return String(iso).slice(0, 19).replace('T', ' ')
  }
}
