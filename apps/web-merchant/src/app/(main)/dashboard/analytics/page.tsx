'use client'

import React, { useState, useEffect, useMemo } from 'react'
import dynamic from 'next/dynamic'
import { useQueryClient } from '@tanstack/react-query'
import { QUERY_KEYS } from '@encreasl/client-services'
import { useMerchantAnalytics } from '@/hooks/useMerchantAnalytics'
import { ClientOnly } from '@/components/ClientOnly'
import {
  DollarSign, ShoppingCart, Store, TrendingUp, TrendingDown, BarChart3, Package,
  Users, Star, Clock, RefreshCw, AlertCircle, ShoppingBag, CreditCard, Truck, Award, Heart, Activity, Layers,
  Search, X, SlidersHorizontal, ChevronDown, Filter
} from '@/components/ui/IconWrapper'

const ReactECharts = dynamic(() => import('echarts-for-react'), { ssr: false })

type Range = '7d' | '30d' | '90d' | '1y' | 'all'
const RANGE_OPTS: { value: Range; label: string }[] = [
  { value: '7d', label: 'Last 7 days' },
  { value: '30d', label: 'Last 30 days' },
  { value: '90d', label: 'Last 90 days' },
  { value: '1y', label: 'Last 12 months' },
  { value: 'all', label: 'All time' },
]
type Filters = { status: string[]; fulfillment: string[]; deliveryStatus: string[]; paymentMethod: string[]; outlet: string[] }
const STATUS_OPTS = ['pending','accepted','preparing','ready_for_pickup','on_delivery','delivered','cancelled'] as const
const FULFILLMENT_OPTS = ['delivery','pickup'] as const
const DELIVERY_OPTS = ['none','pending','assigning_driver','driver_assigned','picked_up','completed','canceled','expired'] as const
const PAYMENT_OPTS = ['card','gcash','grab_pay','paymaya','billease','dob','qrph'] as const

function fmtCurrency(n: number) { return `₱${Number(n).toLocaleString('en-PH', { maximumFractionDigits: 0 })}` }
function fmtPct(n: number) { const s = n > 0 ? '+' : ''; return `${s}${n.toFixed(1)}%` }
function fmtNum(n: number) { return n.toLocaleString('en-PH') }
function fmtDateTime(iso: string) { try { return new Date(iso).toLocaleString('en-PH', { timeZone: 'Asia/Manila', year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) } catch { return iso } }

function AnalyticsSkeleton() {
  return <div className="space-y-[10px] py-5 px-2.5 animate-pulse"><div className="grid grid-cols-2 lg:grid-cols-4 gap-[10px]">{Array.from({length:8}).map((_,i)=><div key={i} className="h-28 bg-gray-100 dark:bg-[#171717] rounded-xl" />)}</div><div className="grid grid-cols-1 lg:grid-cols-2 gap-[10px]"><div className="h-80 bg-gray-100 dark:bg-[#171717] rounded-xl" /><div className="h-80 bg-gray-100 dark:bg-[#171717] rounded-xl" /></div></div>;
}

function KpiCard({ title, value, sub, change, icon, iconBg }: { title: string; value: string; sub?: string; change?: number; icon: React.ReactNode; iconBg: string }) {
  const isUp = (change ?? 0) >= 0
  return (
    <div className="bg-white dark:bg-[#171717] rounded-xl border border-gray-200 dark:border-[#262626] p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium text-gray-500 dark:text-[#a1a1aa] truncate">{title}</p>
          <p className="text-xl font-bold text-gray-900 dark:text-white mt-1 truncate">{value}</p>
          {sub && <p className="text-xs text-gray-500 dark:text-[#a1a1aa] mt-1 truncate">{sub}</p>}
          {typeof change === 'number' && (
            <div className={`inline-flex items-center gap-1 mt-2 text-xs font-semibold px-2 py-0.5 rounded-full ${isUp ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400' : 'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400'}`}>
              {isUp ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
              {fmtPct(change)} vs prev
            </div>
          )}
        </div>
        <div className={`h-9 w-9 rounded-lg flex items-center justify-center shrink-0 ${iconBg}`}>{icon}</div>
      </div>
    </div>
  )
}
function FilterPills({ label, options, value, onToggle }: { label: string; options: readonly string[]; value: string[]; onToggle: (v: string) => void }) {
  return (
    <div>
      <p className="text-xs font-semibold text-gray-700 dark:text-[#a1a1aa] mb-2">{label}</p>
      <div className="flex flex-wrap gap-1.5">
        {options.map((opt) => {
          const active = value.includes(opt)
          return (
            <button key={opt} onClick={() => onToggle(opt)} className={`px-2.5 py-1 rounded-full text-xs font-medium border transition capitalize ${active ? 'bg-blue-600 text-white border-blue-600' : 'bg-white dark:bg-[#0a0a0a] text-gray-700 dark:text-[#a1a1aa] border-gray-200 dark:border-[#262626]'}`}>{opt.replace(/_/g,' ')}</button>
          )
        })}
      </div>
    </div>
  )
}

function AnalyticsPageContent() {
  const [range, setRange] = useState<Range>('30d')
  const [q, setQ] = useState('')
  const [debouncedQ, setDebouncedQ] = useState('')
  const [filters, setFilters] = useState<Filters>({ status: [], fulfillment: [], deliveryStatus: [], paymentMethod: [], outlet: [] })
  const [showFilters, setShowFilters] = useState(false)

  useEffect(() => { const id = setTimeout(() => setDebouncedQ(q.trim().toLowerCase()), 400); return () => clearTimeout(id) }, [q])
  const activeCount = useMemo(() => filters.status.length + filters.fulfillment.length + filters.deliveryStatus.length + filters.paymentMethod.length + filters.outlet.length + (debouncedQ ? 1 : 0), [filters, debouncedQ])
  const hasActive = activeCount > 0
  const qs = useMemo(() => {
    const p = new URLSearchParams(); p.set('range', range)
    if (debouncedQ) p.set('q', debouncedQ)
    if (filters.status.length) p.set('status', filters.status.join(','))
    if (filters.fulfillment.length) p.set('fulfillment', filters.fulfillment.join(','))
    if (filters.deliveryStatus.length) p.set('deliveryStatus', filters.deliveryStatus.join(','))
    if (filters.paymentMethod.length) p.set('paymentMethod', filters.paymentMethod.join(','))
    if (filters.outlet.length) p.set('outlet', filters.outlet.join(','))
    return p.toString()
  }, [range, debouncedQ, filters])

  const queryClient = useQueryClient()
  const [hardRefreshing, setHardRefreshing] = useState(false)
  const { data, isPending, isFetching, isError, error: queryError, refetch } = useMerchantAnalytics(qs)

  const isInitialLoading = (isPending && !data) || hardRefreshing
  const loading = isFetching || hardRefreshing
  const error = isError && !data && !hardRefreshing ? (queryError instanceof Error ? queryError.message : 'Failed to load analytics') : null

  const handleHardRefresh = () => {
    if (hardRefreshing) return
    setHardRefreshing(true)
    void (async () => {
      try {
        queryClient.removeQueries({ queryKey: QUERY_KEYS.merchantAnalytics(qs) })
        await refetch({ cancelRefetch: true })
      } finally { setHardRefreshing(false) }
    })()
  }
  const toggle = (k: keyof Filters, v: string) => setFilters((p) => ({ ...p, [k]: p[k].includes(v) ? p[k].filter((x) => x !== v) : [...p[k], v] }))
  const clearAll = () => { setQ(''); setDebouncedQ(''); setFilters({ status: [], fulfillment: [], deliveryStatus: [], paymentMethod: [], outlet: [] }) }

  const revenueTrendOption = useMemo(() => {
    if (!data) return {}
    const d = data.revenueTrend
    return {
      tooltip: { trigger: 'axis' as const, backgroundColor: '#171717', borderColor: '#262626', textStyle: { color: '#ededed' } },
      legend: { data: ['Revenue','Orders'], textStyle: { color: '#a1a1aa' }, top: 0 },
      grid: { top: 40, right: 20, bottom: 30, left: 55 },
      xAxis: { type: 'category' as const, data: d.map((x) => x.date), axisLabel: { color: '#a1a1aa', fontSize: 11 } },
      yAxis: [
        { type: 'value' as const, name: 'Revenue', axisLabel: { color: '#a1a1aa', formatter: (v:number)=> v>=1000?`${(v/1000).toFixed(0)}k`:String(v) }, splitLine: { lineStyle: { color: '#262626' } } },
        { type: 'value' as const, name: 'Orders', axisLabel: { color: '#a1a1aa' }, splitLine: { show: false } },
      ],
      series: [
        { name: 'Revenue', type: 'line' as const, data: d.map((x) => x.revenue), smooth: true, yAxisIndex: 0, lineStyle: { color: '#2563eb', width: 2.5 }, areaStyle: { color: { type: 'linear' as const, x:0,y:0,x2:0,y2:1, colorStops: [{offset:0,color:'rgba(37,99,235,0.18)'},{offset:1,color:'rgba(37,99,235,0.02)'}] } } },
        { name: 'Orders', type: 'bar' as const, data: d.map((x) => x.orders), yAxisIndex: 1, itemStyle: { color: '#10b981', borderRadius: [4,4,0,0] }, barWidth: '40%' },
      ],
    }
  }, [data])
  const orderStatusOption = useMemo(() => {
    if (!data) return {}
    const total = data.orderStatusBreakdown.reduce((s,x)=>s+x.count,0)
    const colors: Record<string,string> = { pending:'#f59e0b', accepted:'#3b82f6', preparing:'#8b5cf6', ready_for_pickup:'#06b6d4', on_delivery:'#10b981', delivered:'#22c55e', cancelled:'#ef4444' }
    return { tooltip: { trigger: 'item' as const, backgroundColor:'#171717', borderColor:'#262626', textStyle:{color:'#ededed'} }, legend: { orient:'vertical' as const, right:10, top:'center', textStyle:{color:'#a1a1aa'} }, series: [{ type:'pie' as const, radius:['50%','75%'], center:['35%','50%'], label:{show:true, position:'center' as const, formatter:()=>`{t|${total}}\n{l|Orders}`, rich:{t:{fontSize:22,fontWeight:'bold' as const,color:'#ededed'},l:{fontSize:11,color:'#a1a1aa'}}}, data: data.orderStatusBreakdown.map((d)=>({name:d.status.replace(/_/g,' '), value:d.count, itemStyle:{color:colors[d.status]||'#6b7280'}})) }] }
  }, [data])
  const outletRevenueOption = useMemo(() => {
    if (!data) return {}
    const d = [...data.revenueByOutlet].slice(0,8)
    return { tooltip:{trigger:'axis' as const, backgroundColor:'#171717', borderColor:'#262626', textStyle:{color:'#ededed'}}, grid:{top:10,right:20,bottom:30,left:60}, xAxis:{type:'category' as const, data:d.map(x=>x.outletName.length>14?x.outletName.slice(0,14)+'…':x.outletName), axisLabel:{color:'#a1a1aa', rotate:12}}, yAxis:{type:'value' as const, axisLabel:{color:'#a1a1aa'}}, series:[{type:'bar' as const, data:d.map(x=>x.revenue), itemStyle:{color:'#2563eb', borderRadius:[6,6,0,0]}}] }
  }, [data])
  const hourlyOption = useMemo(() => {
    if (!data) return {}
    return { tooltip:{trigger:'axis' as const, backgroundColor:'#171717', borderColor:'#262626', textStyle:{color:'#ededed'}}, grid:{top:10,right:15,bottom:30,left:45}, xAxis:{type:'category' as const, data:data.hourlyDistribution.map(x=>`${String(x.hour).padStart(2,'0')}:00`), axisLabel:{color:'#a1a1aa', fontSize:10}}, yAxis:{type:'value' as const, axisLabel:{color:'#a1a1aa'}}, series:[{name:'Orders',type:'bar' as const, data:data.hourlyDistribution.map(x=>x.orders), itemStyle:{color:'#f59e0b', borderRadius:[4,4,0,0]}}] }
  }, [data])

  const isInitial = isInitialLoading
  const isRefreshing = loading && !!data && !hardRefreshing

  return (
    <div className="space-y-[10px] py-5 px-2.5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white tracking-tight flex items-center gap-2"><BarChart3 className="w-6 h-6 text-blue-600" />Analytics</h1>
          <p className="text-sm text-gray-500 dark:text-[#a1a1aa] mt-1">{data ? <><span className="font-medium text-gray-700 dark:text-white">{data.meta.vendorName}</span> • {data.kpis.totalOutlets} outlets • {data.meta.totalOrdersAllTime} orders all time</> : 'Your business performance — verified paid transactions only'}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 p-1 bg-gray-100 dark:bg-[#171717] rounded-full border border-gray-200 dark:border-[#262626]">
            {RANGE_OPTS.map((o) => <button key={o.value} onClick={() => setRange(o.value)} className={`px-3 py-1.5 rounded-full text-xs font-semibold transition ${range===o.value ? 'bg-white dark:bg-[#262626] text-gray-900 dark:text-white shadow-sm border border-gray-200' : 'text-gray-600 dark:text-[#a1a1aa]'}`}>{o.label}</button>)}
          </div>
          <button onClick={handleHardRefresh} disabled={loading} className="h-9 w-9 inline-flex items-center justify-center bg-white dark:bg-[#171717] border border-gray-200 dark:border-[#262626] rounded-full disabled:opacity-50"><RefreshCw className={`w-4 h-4 ${loading?'animate-spin':''}`} /></button>
        </div>
      </div>

      <div className="bg-white dark:bg-[#171717] rounded-xl border border-gray-200 dark:border-[#262626] p-3 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input value={q} onChange={(e)=>setQ(e.target.value)} placeholder="Search outlets, products, order ID…" className="w-full pl-9 pr-9 py-2.5 text-sm bg-gray-50 dark:bg-[#0a0a0a] border border-gray-200 dark:border-[#262626] rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 text-gray-900 dark:text-white placeholder:text-gray-400" />
            {q && <button onClick={()=>setQ('')} className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-full hover:bg-gray-100 dark:hover:bg-[#262626]"><X className="w-4 h-4 text-gray-400" /></button>}
          </div>
          <button onClick={()=>setShowFilters(v=>!v)} className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold border transition shrink-0 ${hasActive || showFilters ? 'bg-blue-600 text-white border-blue-600' : 'bg-white dark:bg-[#0a0a0a] text-gray-700 dark:text-white border-gray-200 dark:border-[#262626] hover:bg-gray-50 dark:hover:bg-[#171717]'}`}>
            <SlidersHorizontal className="w-4 h-4" /> Filters {activeCount>0 && <span className="px-1.5 py-0.5 rounded-full text-xs font-bold bg-white text-blue-600">{activeCount}</span>} <ChevronDown className={`w-4 h-4 transition ${showFilters?'rotate-180':''}`} />
          </button>
          {hasActive && <button onClick={clearAll} className="text-sm font-medium text-gray-500 hover:text-gray-900 dark:text-[#a1a1aa]">Clear all</button>}
        </div>
        {showFilters && (
          <div className="mt-4 pt-4 border-t border-gray-100 dark:border-[#262626] space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              <FilterPills label="Order status" options={STATUS_OPTS} value={filters.status} onToggle={(v)=>toggle('status',v)} />
              <FilterPills label="Fulfillment" options={FULFILLMENT_OPTS} value={filters.fulfillment} onToggle={(v)=>toggle('fulfillment',v)} />
              <FilterPills label="Delivery status" options={DELIVERY_OPTS} value={filters.deliveryStatus} onToggle={(v)=>toggle('deliveryStatus',v)} />
              <FilterPills label="Payment method" options={PAYMENT_OPTS} value={filters.paymentMethod} onToggle={(v)=>toggle('paymentMethod',v)} />
              <div>
                <p className="text-xs font-semibold text-gray-700 dark:text-[#a1a1aa] mb-2">Outlet</p>
                {data ? (
                  <div className="flex flex-wrap gap-1.5">
                    {data.outlets.map((o)=> {
                      const active = filters.outlet.includes(String(o.id).toLowerCase()) || filters.outlet.includes(o.name.toLowerCase())
                      return <button key={o.id} onClick={()=>toggle('outlet', String(o.id).toLowerCase())} className={`px-2.5 py-1 rounded-full text-xs font-medium border capitalize ${active ? 'bg-blue-600 text-white border-blue-600' : 'bg-white dark:bg-[#0a0a0a] border-gray-200 dark:border-[#262626]'}`}>{o.name}</button>
                    })}
                  </div>
                ) : <p className="text-xs text-gray-400">Outlets load with data…</p>}
              </div>
            </div>
            <div className="flex items-center justify-between pt-2"><p className="text-xs text-gray-500">{hasActive ? `Active ${activeCount} filters • vendor-scoped BFF` : 'No filters — all your outlets'}</p><button onClick={()=>setShowFilters(false)} className="text-xs font-semibold text-blue-600">Done</button></div>
          </div>
        )}
      </div>

      {error && !data ? (
        <div className="flex flex-col items-center justify-center py-16 bg-white dark:bg-[#171717] rounded-xl border border-gray-200 dark:border-[#262626]"><AlertCircle className="h-7 w-7 text-red-500 mb-2" /><p className="text-sm text-gray-500 mb-4">{error}</p><button onClick={handleHardRefresh} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm">Retry</button></div>
      ) : isInitial ? (
        <div className="space-y-[10px] animate-pulse"><div className="grid grid-cols-2 lg:grid-cols-4 gap-[10px]">{Array.from({length:8}).map((_,i)=><div key={i} className="h-28 bg-gray-100 dark:bg-[#171717] rounded-xl" />)}</div><div className="grid grid-cols-1 lg:grid-cols-2 gap-[10px]"><div className="h-80 bg-gray-100 dark:bg-[#171717] rounded-xl" /><div className="h-80 bg-gray-100 dark:bg-[#171717] rounded-xl" /></div></div>
      ) : !data ? null : (
        <>
          {isRefreshing && <div className="flex items-center gap-2 text-xs font-medium text-blue-600 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 rounded-lg px-3 py-2"><RefreshCw className="w-3.5 h-3.5 animate-spin" /> Updating…</div>}
          <div className={`space-y-[10px] ${isRefreshing?'opacity-60 pointer-events-none':''} transition-opacity`}>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-[10px]">
              <KpiCard title="Revenue (paid)" value={fmtCurrency(data.kpis.totalRevenue)} sub={`AOV ${fmtCurrency(data.kpis.aov)}`} change={data.kpis.revenueChange} icon={<DollarSign className="w-5 h-5 text-white" />} iconBg="bg-emerald-500" />
              <KpiCard title="Today" value={fmtCurrency(data.kpis.todayRevenue)} icon={<Clock className="w-5 h-5 text-white" />} iconBg="bg-amber-500" />
              <KpiCard title="Orders" value={fmtNum(data.kpis.totalOrders)} sub={`${data.kpis.pendingOrders} pending • ${data.kpis.activeOrders} active`} change={data.kpis.ordersChange} icon={<ShoppingCart className="w-5 h-5 text-white" />} iconBg="bg-blue-500" />
              <KpiCard title="Outlets" value={`${data.kpis.openOutlets}/${data.kpis.totalOutlets}`} sub={`${data.kpis.acceptingOrders} accepting`} icon={<Store className="w-5 h-5 text-white" />} iconBg="bg-violet-500" />
              <KpiCard title="Avg Rating" value={`${data.kpis.averageRating.toFixed(1)} / 5`} sub={`${data.kpis.totalReviews} reviews`} icon={<Star className="w-5 h-5 text-white" />} iconBg="bg-orange-500" />
              <KpiCard title="Revenue / Outlet" value={fmtCurrency(data.kpis.totalOutlets ? data.kpis.totalRevenue / data.kpis.totalOutlets : 0)} sub={`${data.kpis.totalOrders} total orders`} icon={<Award className="w-5 h-5 text-white" />} iconBg="bg-cyan-500" />
              <KpiCard title="Paid Tx" value={fmtNum(data.kpis.paidCount)} sub={`${fmtNum(data.kpis.refundedCount)} refunded`} icon={<CreditCard className="w-5 h-5 text-white" />} iconBg="bg-green-600" />
              <KpiCard title="Failed" value={fmtNum(data.kpis.failedCount)} icon={<AlertCircle className="w-5 h-5 text-white" />} iconBg="bg-red-500" />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-[10px]">
              <div className="lg:col-span-2 bg-white dark:bg-[#171717] rounded-xl border border-gray-200 dark:border-[#262626] p-5 shadow-sm">
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">Revenue & Orders Trend</h3>
                <ReactECharts option={revenueTrendOption} style={{ height: 300 }} />
              </div>
              <div className="bg-white dark:bg-[#171717] rounded-xl border border-gray-200 dark:border-[#262626] p-5 shadow-sm">
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">Order Status</h3>
                <ReactECharts option={orderStatusOption} style={{ height: 300 }} />
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-[10px]">
              <div className="bg-white dark:bg-[#171717] rounded-xl border border-gray-200 dark:border-[#262626] p-5 shadow-sm">
                <h3 className="text-sm font-semibold mb-3 flex items-center gap-2"><Truck className="w-4 h-4" />Fulfillment</h3>
                <ReactECharts option={{ tooltip:{trigger:'item' as const, backgroundColor:'#171717', borderColor:'#262626', textStyle:{color:'#ededed'}}, series:[{type:'pie' as const, radius:['45%','70%'], data: data.fulfillmentMix.map(f=>({name:f.type, value:f.count}))}] }} style={{ height: 240 }} />
              </div>
              <div className="bg-white dark:bg-[#171717] rounded-xl border border-gray-200 dark:border-[#262626] p-5 shadow-sm">
                <h3 className="text-sm font-semibold mb-3">Delivery Status</h3>
                <div className="space-y-2 max-h-[240px] overflow-auto">
                  {data.deliveryStatusBreakdown.map(s=> <div key={s.status} className="flex items-center gap-3"><span className="text-xs w-28 truncate capitalize">{s.status.replace(/_/g,' ')}</span><div className="flex-1 h-2 bg-gray-100 dark:bg-[#262626] rounded-full"><div className="h-full bg-blue-600 rounded-full" style={{width:`${(s.count/Math.max(...data.deliveryStatusBreakdown.map(x=>x.count)))*100}%`}} /></div><span className="text-xs w-8 text-right">{s.count}</span></div>)}
                </div>
              </div>
              <div className="bg-white dark:bg-[#171717] rounded-xl border border-gray-200 dark:border-[#262626] p-5 shadow-sm">
                <h3 className="text-sm font-semibold mb-3">Payment Methods</h3>
                <ReactECharts option={{ grid:{top:10,right:20,bottom:20,left:90}, xAxis:{type:'value' as const}, yAxis:{type:'category' as const, data:data.paymentMethodBreakdown.map(x=>x.method)}, series:[{type:'bar' as const, data:data.paymentMethodBreakdown.map(x=>x.count), itemStyle:{color:'#6366f1'}}] }} style={{ height: 240 }} />
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-[10px]">
              <div className="bg-white dark:bg-[#171717] rounded-xl border border-gray-200 dark:border-[#262626] p-5 shadow-sm">
                <h3 className="text-sm font-semibold mb-2 flex items-center gap-2"><Store className="w-4 h-4" />Revenue by Outlet</h3>
                <ReactECharts option={outletRevenueOption} style={{ height: 280 }} />
              </div>
              <div className="bg-white dark:bg-[#171717] rounded-xl border border-gray-200 dark:border-[#262626] p-5 shadow-sm">
                <h3 className="text-sm font-semibold mb-2 flex items-center gap-2"><Package className="w-4 h-4" />Top Products</h3>
                <ReactECharts option={{ grid:{top:10,right:15,bottom:10,left:140}, xAxis:{type:'value' as const}, yAxis:{type:'category' as const, data:data.topProducts.slice(0,6).map(x=>x.name.slice(0,18))}, series:[{type:'bar' as const, data:data.topProducts.slice(0,6).map(x=>x.revenue), itemStyle:{color:'#10b981'}}] }} style={{ height: 280 }} />
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-[10px]">
              <div className="bg-white dark:bg-[#171717] rounded-xl border border-gray-200 dark:border-[#262626] p-5 shadow-sm">
                <h3 className="text-sm font-semibold mb-2 flex items-center gap-2"><Clock className="w-4 h-4" />Orders by Hour</h3>
                <ReactECharts option={hourlyOption} style={{ height: 280 }} />
              </div>
              <div className="bg-white dark:bg-[#171717] rounded-xl border border-gray-200 dark:border-[#262626] overflow-hidden shadow-sm">
                <div className="px-5 py-3 border-b border-gray-100 dark:border-[#262626]"><h3 className="text-sm font-semibold">My Outlets</h3></div>
                <div className="divide-y divide-gray-100 dark:divide-[#262626]">
                  {data.outlets.map(o=> <div key={o.id} className="flex items-center justify-between px-4 py-3"><div><p className="text-sm font-medium">{o.name}</p><p className="text-xs text-gray-500">{o.operationalStatus} • {o.isAcceptingOrders?'accepting':'paused'}</p></div><div className="text-right"><p className="text-sm font-semibold">{fmtCurrency(o.todayRevenue)}</p><p className="text-xs text-gray-500">{o.todayOrders} today</p></div></div>)}
                </div>
              </div>
            </div>
          </div>
          <p className="text-[11px] text-gray-400 text-center">Vendor {data.meta.vendorName} • {data.meta.range} • {fmtDateTime(data.meta.generatedAt)} • BFF /vendor/analytics</p>
        </>
      )}
    </div>
  )
}

export default function AnalyticsPage(){
  // Pure CSR: locale-sensitive currency/numbers + generated-at timestamp only
  // render post-mount → identical skeleton on server + hydration → no #441.
  // (Charts are already dynamic ssr:false.)
  return (
    <ClientOnly fallback={<AnalyticsSkeleton />}>
      <AnalyticsPageContent />
    </ClientOnly>
  );
}
