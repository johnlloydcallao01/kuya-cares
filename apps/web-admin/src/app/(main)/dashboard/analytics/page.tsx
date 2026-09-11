'use client'

import React, { useState, useEffect, useMemo } from 'react'
import dynamic from 'next/dynamic'
import { useQueryClient } from '@tanstack/react-query'
import { QUERY_KEYS } from '@encreasl/client-services'
import { useAnalytics } from '@/hooks/useAnalytics'
import {
  DollarSign, ShoppingCart, Store, TrendingUp, TrendingDown, BarChart3, Package,
  Users, Star, Clock, RefreshCw, AlertCircle, ShoppingBag, CreditCard, Truck, Award, Heart, Activity, Layers,
  Search, Filter, X, SlidersHorizontal, ChevronDown
} from '@/components/ui/IconWrapper'

const ReactECharts = dynamic(() => import('echarts-for-react'), { ssr: false })

type Range = '7d' | '30d' | '90d' | '1y' | 'all'
const RANGE_OPTIONS: { value: Range; label: string }[] = [
  { value: '7d', label: 'Last 7 days' },
  { value: '30d', label: 'Last 30 days' },
  { value: '90d', label: 'Last 90 days' },
  { value: '1y', label: 'Last 12 months' },
  { value: 'all', label: 'All time' },
]

type Filters = {
  status: string[]
  fulfillment: string[]
  businessType: string[]
  paymentMethod: string[]
  vendorStatus: string[]
  deliveryStatus: string[]
}

const STATUS_OPTS = ['pending','accepted','preparing','ready_for_pickup','on_delivery','delivered','cancelled'] as const
const FULFILLMENT_OPTS = ['delivery','pickup'] as const
const BUSINESS_OPTS = ['restaurant','fast_food','grocery','pharmacy','convenience','bakery','coffee_shop','other'] as const
const PAYMENT_OPTS = ['card','gcash','grab_pay','paymaya','billease','dob','qrph'] as const
const VENDOR_STATUS_OPTS = ['pending','verified','rejected','suspended'] as const
const DELIVERY_STATUS_OPTS = ['none','pending','assigning_driver','driver_assigned','picked_up','completed','canceled','expired'] as const

function fmtCurrency(n: number) { return `₱${n.toLocaleString(undefined, { maximumFractionDigits: 0 })}` }
function fmtPct(n: number) { const s = n > 0 ? '+' : ''; return `${s}${n.toFixed(1)}%` }
function fmtNum(n: number) { return n.toLocaleString() }

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
            <button
              key={opt}
              onClick={() => onToggle(opt)}
              className={`px-2.5 py-1 rounded-full text-xs font-medium border transition capitalize ${active ? 'bg-blue-600 text-white border-blue-600 dark:bg-blue-500 dark:border-blue-500' : 'bg-white dark:bg-[#0a0a0a] text-gray-700 dark:text-[#a1a1aa] border-gray-200 dark:border-[#262626] hover:border-gray-300'}`}
            >
              {opt.replace(/_/g, ' ')}
            </button>
          )
        })}
      </div>
    </div>
  )
}

function Skeleton() {
  return (
    <div className="space-y-6 py-5 px-2.5 animate-pulse">
      <div className="h-7 bg-gray-100 dark:bg-gray-800 rounded w-48" />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {Array.from({ length: 8 }).map((_, i) => <div key={i} className="h-28 bg-gray-100 dark:bg-[#171717] rounded-xl border border-gray-200 dark:border-[#262626]" />)}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="h-80 bg-gray-100 dark:bg-[#171717] rounded-xl" />
        <div className="h-80 bg-gray-100 dark:bg-[#171717] rounded-xl" />
      </div>
    </div>
  )
}

export default function AnalyticsPage() {
  const [range, setRange] = useState<Range>('30d')
  const [q, setQ] = useState('')
  const [debouncedQ, setDebouncedQ] = useState('')
  const [filters, setFilters] = useState<Filters>({ status: [], fulfillment: [], businessType: [], paymentMethod: [], vendorStatus: [], deliveryStatus: [] })
  const [showFilters, setShowFilters] = useState(false)

  useEffect(() => {
    const id = setTimeout(() => setDebouncedQ(q.trim()), 400)
    return () => clearTimeout(id)
  }, [q])

  const activeFilterCount = useMemo(() => {
    return filters.status.length + filters.fulfillment.length + filters.businessType.length + filters.paymentMethod.length + filters.vendorStatus.length + filters.deliveryStatus.length + (debouncedQ ? 1 : 0)
  }, [filters, debouncedQ])

  const hasActiveFilters = activeFilterCount > 0

  const qs = useMemo(() => {
    const p = new URLSearchParams()
    p.set('range', range)
    if (debouncedQ) p.set('q', debouncedQ)
    if (filters.status.length) p.set('status', filters.status.join(','))
    if (filters.fulfillment.length) p.set('fulfillment', filters.fulfillment.join(','))
    if (filters.businessType.length) p.set('businessType', filters.businessType.join(','))
    if (filters.paymentMethod.length) p.set('paymentMethod', filters.paymentMethod.join(','))
    if (filters.vendorStatus.length) p.set('vendorStatus', filters.vendorStatus.join(','))
    if (filters.deliveryStatus.length) p.set('deliveryStatus', filters.deliveryStatus.join(','))
    return p.toString()
  }, [range, debouncedQ, filters])

  // TanStack cache: back-nav within 3min renders instantly, no skeleton.
  // Filter/range changes keep previous slice via placeholderData while refetching.
  const queryClient = useQueryClient()
  const [hardRefreshing, setHardRefreshing] = useState(false)
  const { data, isPending, isFetching, isError, error: queryError, refetch } = useAnalytics(qs)
  const loading = isFetching || hardRefreshing
  const error = isError && !data && !hardRefreshing ? (queryError instanceof Error ? queryError.message : 'Failed to load analytics') : null

  // Hard refresh: force skeleton like first visit, then fetch truly fresh
  // data from CMS (bypasses 3-min staleTime). NOTE: placeholderData:
  // keepPreviousData would otherwise keep old data visible and only show
  // the "Updating results" banner, so an explicit flag is required.
  const handleHardRefresh = () => {
    if (hardRefreshing) return
    setHardRefreshing(true)
    void (async () => {
      try {
        queryClient.removeQueries({ queryKey: QUERY_KEYS.adminAnalytics(qs) })
        await refetch({ cancelRefetch: true })
      } finally {
        setHardRefreshing(false)
      }
    })()
  }

  const toggle = (key: keyof Filters, val: string) => {
    setFilters((prev) => {
      const cur = prev[key]
      const next = cur.includes(val) ? cur.filter((x) => x !== val) : [...cur, val]
      return { ...prev, [key]: next }
    })
  }
  const clearAll = () => {
    setQ('')
    setDebouncedQ('')
    setFilters({ status: [], fulfillment: [], businessType: [], paymentMethod: [], vendorStatus: [], deliveryStatus: [] })
  }

  // Chart options
  const revenueTrendOption = useMemo(() => {
    if (!data) return {}
    const d = data.revenueTrend
    return {
      tooltip: { trigger: 'axis' as const, backgroundColor: '#171717', borderColor: '#262626', textStyle: { color: '#ededed', fontSize: 12 } },
      legend: { data: ['Revenue', 'Orders', 'AOV'], textStyle: { color: '#a1a1aa' }, top: 0 },
      grid: { top: 40, right: 20, bottom: 30, left: 55 },
      xAxis: { type: 'category' as const, data: d.map(x => x.date), axisLine: { lineStyle: { color: '#262626' } }, axisLabel: { color: '#a1a1aa', fontSize: 11 }, axisTick: { show: false } },
      yAxis: [
        { type: 'value' as const, name: 'Revenue', axisLabel: { color: '#a1a1aa', formatter: (v: number) => v >= 1000 ? `${(v/1000).toFixed(0)}k` : String(v) }, splitLine: { lineStyle: { color: '#262626' } } },
        { type: 'value' as const, name: 'Orders', axisLabel: { color: '#a1a1aa' }, splitLine: { show: false } },
      ],
      series: [
        { name: 'Revenue', type: 'line' as const, data: d.map(x => x.revenue), smooth: true, yAxisIndex: 0, lineStyle: { color: '#2563eb', width: 2.5 }, itemStyle: { color: '#2563eb' }, areaStyle: { color: { type: 'linear' as const, x:0,y:0,x2:0,y2:1, colorStops: [{offset:0,color:'rgba(37,99,235,0.18)'},{offset:1,color:'rgba(37,99,235,0.02)'}] } } },
        { name: 'Orders', type: 'bar' as const, data: d.map(x => x.orders), yAxisIndex: 1, itemStyle: { color: '#10b981', borderRadius: [4,4,0,0] }, barWidth: '40%' },
        { name: 'AOV', type: 'line' as const, data: d.map(x => Number(x.aov.toFixed(0))), yAxisIndex: 0, smooth: true, lineStyle: { color: '#f59e0b', type: 'dashed' as const, width: 1.5 }, symbol: 'none' as const },
      ]
    }
  }, [data])

  const orderStatusOption = useMemo(() => {
    if (!data) return {}
    const total = data.orderStatusBreakdown.reduce((s, x) => s + x.count, 0)
    const colors: Record<string,string> = { pending:'#f59e0b', accepted:'#3b82f6', preparing:'#8b5cf6', ready_for_pickup:'#06b6d4', on_delivery:'#10b981', delivered:'#22c55e', cancelled:'#ef4444' }
    const fallback = ['#2563eb','#10b981','#f59e0b','#ef4444','#8b5cf6','#06b6d4']
    return {
      tooltip: { trigger: 'item' as const, backgroundColor:'#171717', borderColor:'#262626', textStyle:{color:'#ededed'} },
      legend: { orient:'vertical' as const, right:10, top:'center', textStyle:{color:'#a1a1aa', fontSize:12}, itemWidth:10, itemHeight:10 },
      series: [{ type:'pie' as const, radius:['50%','75%'], center:['35%','50%'], label:{show:true, position:'center' as const, formatter:()=>`{t|${total}}\n{l|Orders}`, rich:{t:{fontSize:22,fontWeight:'bold' as const,color:'#ededed'}, l:{fontSize:11,color:'#a1a1aa'}}}, data: data.orderStatusBreakdown.map((d,i)=>({name:d.status.replace(/_/g,' '), value:d.count, itemStyle:{color:colors[d.status]||fallback[i%fallback.length]}})) }]
    }
  }, [data])

  const fulfillmentOption = useMemo(() => {
    if (!data || !data.fulfillmentMix.length) return {}
    const colors: Record<string,string> = { delivery:'#2563eb', pickup:'#10b981', unknown:'#6b7280' }
    return {
      tooltip:{trigger:'item' as const, backgroundColor:'#171717', borderColor:'#262626', textStyle:{color:'#ededed'}},
      legend:{bottom:0, textStyle:{color:'#a1a1aa'}},
      series:[{ type:'pie' as const, radius:['45%','70%'], data: data.fulfillmentMix.map(f=>({name:f.type, value:f.count, itemStyle:{color:colors[f.type]||'#8b5cf6'}})), label:{color:'#a1a1aa'} }]
    }
  }, [data])

  const paymentMethodOption = useMemo(() => {
    if (!data) return {}
    const d = [...data.paymentMethodBreakdown].sort((a,b)=>b.count-a.count)
    return {
      tooltip:{trigger:'axis' as const, backgroundColor:'#171717', borderColor:'#262626', textStyle:{color:'#ededed'}},
      grid:{top:10, right:20, bottom:20, left:90},
      xAxis:{type:'value' as const, axisLabel:{color:'#a1a1aa'}, splitLine:{lineStyle:{color:'#262626'}}},
      yAxis:{type:'category' as const, data:d.map(x=>x.method), axisLabel:{color:'#a1a1aa'}, axisTick:{show:false}},
      series:[{type:'bar' as const, data:d.map(x=>x.count), itemStyle:{color:'#6366f1', borderRadius:[0,6,6,0]}, barWidth:18 }]
    }
  }, [data])

  const businessTypeOption = useMemo(() => {
    if (!data) return {}
    const d = [...data.revenueByBusinessType].sort((a,b)=>b.revenue-a.revenue)
    return {
      tooltip:{trigger:'axis' as const, backgroundColor:'#171717', borderColor:'#262626', textStyle:{color:'#ededed'}},
      grid:{top:10, right:20, bottom:30, left:60},
      xAxis:{type:'category' as const, data:d.map(x=>x.businessType), axisLabel:{color:'#a1a1aa', rotate:12, fontSize:11}, axisTick:{show:false}},
      yAxis:{type:'value' as const, axisLabel:{color:'#a1a1aa', formatter:(v:number)=>v>=1000?`${(v/1000).toFixed(0)}k`:String(v)}, splitLine:{lineStyle:{color:'#262626'}}},
      series:[
        {name:'Revenue', type:'bar' as const, data:d.map(x=>x.revenue), itemStyle:{color:'#2563eb', borderRadius:[6,6,0,0]}, barWidth:'45%'},
        {name:'Orders', type:'bar' as const, data:d.map(x=>x.orders), itemStyle:{color:'#10b981', borderRadius:[6,6,0,0]}, barWidth:'45%'},
      ]
    }
  }, [data])

  const categoryOption = useMemo(() => {
    if (!data) return {}
    const d = [...data.revenueByCategory].slice(0,8)
    return {
      tooltip:{trigger:'axis' as const, backgroundColor:'#171717', borderColor:'#262626', textStyle:{color:'#ededed'}},
      grid:{top:10, right:20, bottom:10, left:120},
      xAxis:{type:'value' as const, axisLabel:{color:'#a1a1aa'}, splitLine:{lineStyle:{color:'#262626'}}},
      yAxis:{type:'category' as const, data:d.map(x=>x.category), axisLabel:{color:'#a1a1aa', fontSize:11}, axisTick:{show:false}},
      series:[{type:'bar' as const, data:d.map(x=>x.revenue), itemStyle:{color:'#8b5cf6', borderRadius:[0,6,6,0]}, barWidth:16 }]
    }
  }, [data])

  const hourlyOption = useMemo(() => {
    if (!data) return {}
    return {
      tooltip:{trigger:'axis' as const, backgroundColor:'#171717', borderColor:'#262626', textStyle:{color:'#ededed'}},
      grid:{top:10, right:15, bottom:30, left:45},
      xAxis:{type:'category' as const, data:data.hourlyDistribution.map(x=>`${String(x.hour).padStart(2,'0')}:00`), axisLabel:{color:'#a1a1aa', fontSize:10, interval:1}, axisTick:{show:false}},
      yAxis:{type:'value' as const, axisLabel:{color:'#a1a1aa'}, splitLine:{lineStyle:{color:'#262626'}}},
      series:[
        {name:'Orders', type:'bar' as const, data:data.hourlyDistribution.map(x=>x.orders), itemStyle:{color:'#f59e0b', borderRadius:[4,4,0,0]}, barWidth:'60%'},
        {name:'Revenue', type:'line' as const, data:data.hourlyDistribution.map(x=>x.revenue), smooth:true, lineStyle:{color:'#2563eb', width:2}, symbol:'none' as const}
      ]
    }
  }, [data])

  const weekdayOption = useMemo(() => {
    if (!data) return {}
    return {
      tooltip:{trigger:'axis' as const, backgroundColor:'#171717', borderColor:'#262626', textStyle:{color:'#ededed'}},
      grid:{top:10, right:15, bottom:20, left:45},
      xAxis:{type:'category' as const, data:data.weekdayDistribution.map(x=>x.day), axisLabel:{color:'#a1a1aa'}, axisTick:{show:false}},
      yAxis:{type:'value' as const, axisLabel:{color:'#a1a1aa'}, splitLine:{lineStyle:{color:'#262626'}}},
      series:[{type:'bar' as const, data:data.weekdayDistribution.map(x=>x.orders), itemStyle:{color:'#06b6d4', borderRadius:[6,6,0,0]}, barWidth:28 }]
    }
  }, [data])

  const ratingOption = useMemo(() => {
    if (!data) return {}
    return {
      tooltip:{trigger:'axis' as const, backgroundColor:'#171717', borderColor:'#262626', textStyle:{color:'#ededed'}},
      grid:{top:10, right:20, bottom:20, left:40},
      xAxis:{type:'category' as const, data:data.ratingDistribution.map(x=>`${x.rating}★`), axisLabel:{color:'#a1a1aa'}, axisTick:{show:false}},
      yAxis:{type:'value' as const, axisLabel:{color:'#a1a1aa'}, splitLine:{lineStyle:{color:'#262626'}}},
      series:[{type:'bar' as const, data:data.ratingDistribution.map(x=>x.count), itemStyle:{color:'#f59e0b', borderRadius:[6,6,0,0]}, barWidth:32 }]
    }
  }, [data])

  const topProductsOption = useMemo(() => {
    if (!data) return {}
    const d = [...data.topProducts].slice(0,7)
    return {
      tooltip:{trigger:'axis' as const, backgroundColor:'#171717', borderColor:'#262626', textStyle:{color:'#ededed'}},
      grid:{top:10, right:15, bottom:10, left:140},
      xAxis:{type:'value' as const, axisLabel:{color:'#a1a1aa'}, splitLine:{lineStyle:{color:'#262626'}}},
      yAxis:{type:'category' as const, data:d.map(x=>x.name.length>22?x.name.slice(0,22)+'…':x.name), axisLabel:{color:'#a1a1aa', fontSize:11}, axisTick:{show:false}},
      series:[{type:'bar' as const, data:d.map(x=>x.revenue), itemStyle:{color:'#10b981', borderRadius:[0,6,6,0]}, barWidth:14}]
    }
  }, [data])

  const isInitialLoading = (isPending && !data) || hardRefreshing
  const isRefreshing = isFetching && !!data && !isPending && !hardRefreshing

  return (
    <div className="space-y-[10px] py-5 px-2.5">
      {/* Header — ALWAYS mounted so typing never loses focus or remounts */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white tracking-tight flex items-center gap-2"><BarChart3 className="w-6 h-6 text-blue-600" />Analytics</h1>
          <p className="text-sm text-gray-500 dark:text-[#a1a1aa] mt-1">Premium business intelligence — real-time aggregated from CMS {data && <span className="hidden sm:inline">• {data.kpis.totalOrdersAllTime.toLocaleString()} orders all time • {fmtCurrency(data.kpis.totalRevenueAllTime)} lifetime</span>}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 p-1 bg-gray-100 dark:bg-[#171717] rounded-full border border-gray-200 dark:border-[#262626]">
            {RANGE_OPTIONS.map(o => (
              <button key={o.value} onClick={() => setRange(o.value)} className={`px-3 py-1.5 rounded-full text-xs font-semibold transition ${range===o.value ? 'bg-white dark:bg-[#262626] text-gray-900 dark:text-white shadow-sm border border-gray-200 dark:border-[#333]' : 'text-gray-600 dark:text-[#a1a1aa] hover:text-gray-900'}`}>{o.label}</button>
            ))}
          </div>
          <button onClick={handleHardRefresh} disabled={loading} title="Refresh fresh data" className="h-9 w-9 inline-flex items-center justify-center bg-white dark:bg-[#171717] border border-gray-200 dark:border-[#262626] rounded-full hover:bg-gray-50 dark:hover:bg-[#262626] disabled:opacity-50"><RefreshCw className={`w-4 h-4 text-gray-600 dark:text-[#a1a1aa] ${loading ? 'animate-spin' : ''}`} /></button>
        </div>
      </div>

      {/* Search + Advanced Filters */}
      <div className="bg-white dark:bg-[#171717] rounded-xl border border-gray-200 dark:border-[#262626] p-3 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search merchants, vendors, products, order ID…"
              className="w-full pl-9 pr-9 py-2.5 text-sm bg-gray-50 dark:bg-[#0a0a0a] border border-gray-200 dark:border-[#262626] rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-gray-900 dark:text-white placeholder:text-gray-400"
            />
            {q && (
              <button onClick={() => setQ('')} className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-full hover:bg-gray-100 dark:hover:bg-[#262626]">
                <X className="w-4 h-4 text-gray-400" />
              </button>
            )}
          </div>
          <button
            onClick={() => setShowFilters((v) => !v)}
            className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold border transition shrink-0 ${hasActiveFilters || showFilters ? 'bg-blue-600 text-white border-blue-600 dark:bg-blue-500 dark:border-blue-500' : 'bg-white dark:bg-[#0a0a0a] text-gray-700 dark:text-white border-gray-200 dark:border-[#262626] hover:bg-gray-50 dark:hover:bg-[#171717] hover:text-gray-900 dark:hover:text-white'}`}
          >
            <SlidersHorizontal className="w-4 h-4" />
            Advanced filters
            {activeFilterCount > 0 && <span className={`px-1.5 py-0.5 rounded-full text-xs font-bold ${hasActiveFilters && showFilters ? 'bg-white text-blue-600' : hasActiveFilters ? 'bg-blue-600 text-white border border-white' : 'bg-gray-900 text-white'}`}>{activeFilterCount}</span>}
            <ChevronDown className={`w-4 h-4 transition ${showFilters ? 'rotate-180' : ''}`} />
          </button>
          {hasActiveFilters && (
            <button onClick={clearAll} className="text-sm font-medium text-gray-500 dark:text-[#a1a1aa] hover:text-gray-900 dark:hover:text-white whitespace-nowrap">Clear all</button>
          )}
        </div>

        {showFilters && (
          <div className="mt-4 pt-4 border-t border-gray-100 dark:border-[#262626] space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              <FilterPills label="Order status" options={STATUS_OPTS} value={filters.status} onToggle={(v) => toggle('status', v)} />
              <FilterPills label="Fulfillment" options={FULFILLMENT_OPTS} value={filters.fulfillment} onToggle={(v) => toggle('fulfillment', v)} />
              <FilterPills label="Delivery status" options={DELIVERY_STATUS_OPTS} value={filters.deliveryStatus} onToggle={(v) => toggle('deliveryStatus', v)} />
              <FilterPills label="Business type" options={BUSINESS_OPTS} value={filters.businessType} onToggle={(v) => toggle('businessType', v)} />
              <FilterPills label="Payment method" options={PAYMENT_OPTS} value={filters.paymentMethod} onToggle={(v) => toggle('paymentMethod', v)} />
              <FilterPills label="Vendor verification" options={VENDOR_STATUS_OPTS} value={filters.vendorStatus} onToggle={(v) => toggle('vendorStatus', v)} />
            </div>
            <div className="flex items-center justify-between pt-2">
              <p className="text-xs text-gray-500 dark:text-[#a1a1aa]">{hasActiveFilters ? `Active: ${activeFilterCount} filter${activeFilterCount>1?'s':''} • Results are live filtered via BFF` : 'No advanced filters — showing all data in range'}</p>
              <button onClick={() => setShowFilters(false)} className="text-xs font-semibold text-blue-600 hover:text-blue-700">Done</button>
            </div>
          </div>
        )}

        {hasActiveFilters && !showFilters && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {debouncedQ && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 rounded-full text-xs font-medium border border-blue-200 dark:border-blue-800">
                Search: “{debouncedQ}” <button onClick={() => setQ('')} className="ml-1 p-0.5 rounded-full hover:bg-blue-100"><X className="w-3 h-3" /></button>
              </span>
            )}
            {filters.status.map((v) => <span key={`s-${v}`} className="inline-flex items-center gap-1 px-2.5 py-1 bg-gray-100 dark:bg-[#262626] text-gray-700 dark:text-[#a1a1aa] rounded-full text-xs font-medium">status:{v} <button onClick={() => toggle('status', v)}><X className="w-3 h-3" /></button></span>)}
            {filters.fulfillment.map((v) => <span key={`f-${v}`} className="inline-flex items-center gap-1 px-2.5 py-1 bg-gray-100 dark:bg-[#262626] text-gray-700 dark:text-[#a1a1aa] rounded-full text-xs font-medium">fulfill:{v} <button onClick={() => toggle('fulfillment', v)}><X className="w-3 h-3" /></button></span>)}
            {filters.deliveryStatus.map((v) => <span key={`d-${v}`} className="inline-flex items-center gap-1 px-2.5 py-1 bg-gray-100 dark:bg-[#262626] text-gray-700 dark:text-[#a1a1aa] rounded-full text-xs font-medium">delivery:{v} <button onClick={() => toggle('deliveryStatus', v)}><X className="w-3 h-3" /></button></span>)}
            {filters.businessType.map((v) => <span key={`b-${v}`} className="inline-flex items-center gap-1 px-2.5 py-1 bg-gray-100 dark:bg-[#262626] text-gray-700 dark:text-[#a1a1aa] rounded-full text-xs font-medium">{v} <button onClick={() => toggle('businessType', v)}><X className="w-3 h-3" /></button></span>)}
            {filters.paymentMethod.map((v) => <span key={`p-${v}`} className="inline-flex items-center gap-1 px-2.5 py-1 bg-gray-100 dark:bg-[#262626] text-gray-700 dark:text-[#a1a1aa] rounded-full text-xs font-medium">{v} <button onClick={() => toggle('paymentMethod', v)}><X className="w-3 h-3" /></button></span>)}
            {filters.vendorStatus.map((v) => <span key={`v-${v}`} className="inline-flex items-center gap-1 px-2.5 py-1 bg-gray-100 dark:bg-[#262626] text-gray-700 dark:text-[#a1a1aa] rounded-full text-xs font-medium">vendor:{v} <button onClick={() => toggle('vendorStatus', v)}><X className="w-3 h-3" /></button></span>)}
          </div>
        )}
      </div>

      {/* Data layer: error / initial skeleton / filtered content — search bar above never remounts */}
      {error && !data ? (
        <div className="flex flex-col items-center justify-center py-16 bg-white dark:bg-[#171717] rounded-xl border border-gray-200 dark:border-[#262626]">
          <div className="h-14 w-14 bg-red-50 dark:bg-red-900/20 rounded-full flex items-center justify-center mb-4"><AlertCircle className="h-7 w-7 text-red-500" /></div>
          <h2 className="font-semibold text-gray-900 dark:text-white mb-2">Failed to load analytics</h2>
          <p className="text-sm text-gray-500 mb-6">{error}</p>
          <button onClick={() => void refetch()} className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium"><RefreshCw className="h-4 w-4 mr-2" />Retry</button>
        </div>
      ) : isInitialLoading ? (
        <div className="space-y-[10px] animate-pulse">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-[10px]">{Array.from({ length: 8 }).map((_, i) => <div key={i} className="h-28 bg-gray-100 dark:bg-[#171717] rounded-xl" />)}</div>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-[10px]"><div className="lg:col-span-2 h-80 bg-gray-100 dark:bg-[#171717] rounded-xl" /><div className="h-80 bg-gray-100 dark:bg-[#171717] rounded-xl" /></div>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-[10px]">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-60 bg-gray-100 dark:bg-[#171717] rounded-xl" />)}</div>
        </div>
      ) : !data ? null : (
        <>
          {/* live refreshing banner */}
          {isRefreshing && (
            <div className="flex items-center gap-2 text-xs font-medium text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg px-3 py-2">
              <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Updating results…
            </div>
          )}
          <div className={`space-y-[10px] ${isRefreshing ? 'opacity-60 pointer-events-none' : ''} transition-opacity`}>
            {hasActiveFilters && (
              <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-[#a1a1aa] mb-4">
                <Filter className="w-3.5 h-3.5" />
                Filtered view — {fmtNum(data.kpis.totalOrders)} order{data.kpis.totalOrders!==1?'s':''} • {fmtCurrency(data.kpis.totalRevenue)} verified revenue • {data.topMerchants.length} merchants • {data.topVendors.length} vendors in slice
                {debouncedQ && <span>• search “{debouncedQ}”</span>}
              </div>
            )}
            {/* KPIs — dimmed while refreshing, search input stays mounted */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-[10px]">
              <KpiCard title="Revenue" value={fmtCurrency(data.kpis.totalRevenue)} sub={`AOV ${fmtCurrency(data.kpis.aov)}`} change={data.kpis.revenueChange} icon={<DollarSign className="w-5 h-5 text-white" />} iconBg="bg-emerald-500" />
              <KpiCard title="Orders" value={fmtNum(data.kpis.totalOrders)} sub={`${data.kpis.paidTransactions} paid • ${data.kpis.refundedTransactions} refunded`} change={data.kpis.ordersChange} icon={<ShoppingCart className="w-5 h-5 text-white" />} iconBg="bg-blue-500" />
              <KpiCard title="AOV" value={fmtCurrency(data.kpis.aov)} change={data.kpis.aovChange} icon={<Award className="w-5 h-5 text-white" />} iconBg="bg-amber-500" />
              <KpiCard title="New Customers" value={fmtNum(data.kpis.newCustomers)} sub={`${fmtNum(data.kpis.totalCustomers)} total`} change={data.kpis.customersChange} icon={<Users className="w-5 h-5 text-white" />} iconBg="bg-violet-500" />
              <KpiCard title="Active Merchants" value={fmtNum(data.kpis.activeMerchants)} sub={`${fmtNum(data.kpis.totalVendors)} vendors`} icon={<Store className="w-5 h-5 text-white" />} iconBg="bg-cyan-500" />
              <KpiCard title="Avg Rating" value={`${data.kpis.avgRating.toFixed(2)} / 5`} sub={`${fmtNum(data.kpis.wishlistCount)} wishlists`} icon={<Star className="w-5 h-5 text-white" />} iconBg="bg-orange-500" />
              <KpiCard title="Failed Tx" value={fmtNum(data.kpis.failedTransactions)} sub={`${fmtNum(data.kpis.refundedTransactions)} refunded`} icon={<CreditCard className="w-5 h-5 text-white" />} iconBg="bg-red-500" />
              <KpiCard title="Abandonment" value={`${data.kpis.totalOrders ? ((data.funnel.totalCarts - data.kpis.totalOrders)/Math.max(1,data.funnel.totalCarts)*100).toFixed(1) : '0'}%`} sub={`${fmtNum(data.funnel.totalCarts)} carts`} icon={<ShoppingBag className="w-5 h-5 text-white" />} iconBg="bg-zinc-500" />
      </div>

      {/* Trend + Status */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 bg-white dark:bg-[#171717] rounded-xl border border-gray-200 dark:border-[#262626] p-5 shadow-sm">
          <div className="flex items-center justify-between mb-2"><h3 className="text-sm font-semibold text-gray-900 dark:text-white">Revenue & Orders Trend</h3><span className="text-xs text-gray-500 dark:text-[#a1a1aa]">{data.meta.range}{hasActiveFilters ? ' • filtered' : ''}</span></div>
          <ReactECharts option={revenueTrendOption} style={{ height: 300 }} />
        </div>
        <div className="bg-white dark:bg-[#171717] rounded-xl border border-gray-200 dark:border-[#262626] p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">Order Status</h3>
          <ReactECharts option={orderStatusOption} style={{ height: 300 }} />
        </div>
      </div>

      {/* Fulfillment / Delivery / Payment */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-[#171717] rounded-xl border border-gray-200 dark:border-[#262626] p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2"><Truck className="w-4 h-4" />Fulfillment Mix</h3>
          {data.fulfillmentMix.length ? <ReactECharts option={fulfillmentOption} style={{ height: 240 }} /> : <p className="text-sm text-gray-500 py-10 text-center">No data in slice</p>}
        </div>
        <div className="bg-white dark:bg-[#171717] rounded-xl border border-gray-200 dark:border-[#262626] p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2"><Activity className="w-4 h-4" />Delivery Status</h3>
          {data.deliveryStatusBreakdown.length ? (
            <div className="space-y-2 max-h-[240px] overflow-auto pr-1">
              {data.deliveryStatusBreakdown.sort((a,b)=>b.count-a.count).map(s => {
                const max = Math.max(...data.deliveryStatusBreakdown.map(x=>x.count))
                return (<div key={s.status} className="flex items-center gap-3"><span className="text-xs font-medium text-gray-700 dark:text-[#a1a1aa] w-28 truncate capitalize">{s.status.replace(/_/g,' ')}</span><div className="flex-1 h-2 bg-gray-100 dark:bg-[#262626] rounded-full overflow-hidden"><div className="h-full bg-blue-600 rounded-full" style={{width:`${(s.count/max)*100}%`}} /></div><span className="text-xs font-semibold text-gray-900 dark:text-white w-10 text-right">{s.count}</span></div>)
              })}
            </div>
          ) : <p className="text-sm text-gray-500 py-10 text-center">No delivery data</p>}
        </div>
        <div className="bg-white dark:bg-[#171717] rounded-xl border border-gray-200 dark:border-[#262626] p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2"><CreditCard className="w-4 h-4" />Payment Methods</h3>
          {data.paymentMethodBreakdown.length ? <ReactECharts option={paymentMethodOption} style={{ height: 240 }} /> : <p className="text-sm text-gray-500 py-10 text-center">No payments in slice</p>}
        </div>
      </div>

      {/* Business Type + Category */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white dark:bg-[#171717] rounded-xl border border-gray-200 dark:border-[#262626] p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-2 flex items-center gap-2"><Layers className="w-4 h-4" />Revenue by Business Type</h3>
          <ReactECharts option={businessTypeOption} style={{ height: 280 }} />
        </div>
        <div className="bg-white dark:bg-[#171717] rounded-xl border border-gray-200 dark:border-[#262626] p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-2 flex items-center gap-2"><Package className="w-4 h-4" />Revenue by Category</h3>
          <ReactECharts option={categoryOption} style={{ height: 280 }} />
        </div>
      </div>

      {/* Hourly + Weekday */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white dark:bg-[#171717] rounded-xl border border-gray-200 dark:border-[#262626] p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-2 flex items-center gap-2"><Clock className="w-4 h-4" />Orders by Hour (peak demand)</h3>
          <ReactECharts option={hourlyOption} style={{ height: 280 }} />
        </div>
        <div className="bg-white dark:bg-[#171717] rounded-xl border border-gray-200 dark:border-[#262626] p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">Orders by Weekday</h3>
          <ReactECharts option={weekdayOption} style={{ height: 280 }} />
        </div>
      </div>

      {/* Top Products + Rating */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 bg-white dark:bg-[#171717] rounded-xl border border-gray-200 dark:border-[#262626] p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">Top Products by Revenue</h3>
          {data.topProducts.length ? <ReactECharts option={topProductsOption} style={{ height: 300 }} /> : <p className="text-sm text-gray-500 py-10 text-center">No products in slice</p>}
        </div>
        <div className="bg-white dark:bg-[#171717] rounded-xl border border-gray-200 dark:border-[#262626] p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-2 flex items-center gap-2"><Star className="w-4 h-4 text-amber-500" />Rating Distribution</h3>
          <ReactECharts option={ratingOption} style={{ height: 300 }} />
        </div>
      </div>

      {/* Tables: merchants / vendors / funnel */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white dark:bg-[#171717] rounded-xl border border-gray-200 dark:border-[#262626] shadow-sm overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-100 dark:border-[#262626] flex items-center justify-between"><h3 className="text-sm font-semibold text-gray-900 dark:text-white">Top Merchants</h3><span className="text-xs text-gray-500">{data.topMerchants.length} in slice</span></div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-[#0a0a0a] text-xs text-gray-500 dark:text-[#a1a1aa]"><tr><th className="text-left px-4 py-2 font-medium">#</th><th className="text-left px-4 py-2 font-medium">Merchant</th><th className="text-right px-4 py-2 font-medium">Orders</th><th className="text-right px-4 py-2 font-medium">Revenue</th><th className="text-right px-4 py-2 font-medium">Rating</th></tr></thead>
              <tbody className="divide-y divide-gray-100 dark:divide-[#262626]">
                {data.topMerchants.map((m,i)=>(<tr key={m.id} className="hover:bg-gray-50 dark:hover:bg-[#262626]/50"><td className="px-4 py-2 text-gray-500">{i+1}</td><td className="px-4 py-2 font-medium text-gray-900 dark:text-white truncate max-w-[160px]">{m.name}</td><td className="px-4 py-2 text-right">{fmtNum(m.orders)}</td><td className="px-4 py-2 text-right font-semibold">{fmtCurrency(m.revenue)}</td><td className="px-4 py-2 text-right">{m.rating ? m.rating.toFixed(1) : '—'}</td></tr>))}
                {!data.topMerchants.length && <tr><td colSpan={5} className="text-center py-8 text-gray-500">No merchants in slice — adjust search/filters</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
        <div className="bg-white dark:bg-[#171717] rounded-xl border border-gray-200 dark:border-[#262626] shadow-sm overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-100 dark:border-[#262626] flex items-center justify-between"><h3 className="text-sm font-semibold text-gray-900 dark:text-white">Top Vendors</h3><span className="text-xs text-gray-500">{data.topVendors.length} in slice</span></div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-[#0a0a0a] text-xs text-gray-500 dark:text-[#a1a1aa]"><tr><th className="text-left px-4 py-2 font-medium">Vendor</th><th className="text-right px-4 py-2 font-medium">Orders</th><th className="text-right px-4 py-2 font-medium">Revenue</th><th className="text-center px-4 py-2 font-medium">Stores</th></tr></thead>
              <tbody className="divide-y divide-gray-100 dark:divide-[#262626]">
                {data.topVendors.map(v=>(<tr key={v.id} className="hover:bg-gray-50 dark:hover:bg-[#262626]/50"><td className="px-4 py-2 font-medium text-gray-900 dark:text-white truncate max-w-[160px]">{v.businessName || '—'}</td><td className="px-4 py-2 text-right">{fmtNum(v.orders)}</td><td className="px-4 py-2 text-right font-semibold">{fmtCurrency(v.revenue)}</td><td className="px-4 py-2 text-center">{v.totalMerchants}</td></tr>))}
                {!data.topVendors.length && <tr><td colSpan={4} className="text-center py-8 text-gray-500">No vendors in slice</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-[#171717] rounded-xl border border-gray-200 dark:border-[#262626] p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2"><Heart className="w-4 h-4 text-pink-500" />Cart Funnel</h3>
          <div className="space-y-2">
            {data.funnel.cartByStatus.map(s=>{const total=data.funnel.totalCarts||1; return (<div key={s.status} className="flex items-center gap-3"><span className="text-xs font-medium w-24 capitalize text-gray-700 dark:text-[#a1a1aa]">{s.status.replace(/_/g,' ')}</span><div className="flex-1 h-2 bg-gray-100 dark:bg-[#262626] rounded-full overflow-hidden"><div className={`h-full rounded-full ${s.status==='active'?'bg-blue-600':s.status==='ordered'?'bg-emerald-600':s.status==='abandoned'?'bg-amber-500':'bg-gray-400'}`} style={{width:`${(s.count/total)*100}%`}} /></div><span className="text-xs font-semibold w-10 text-right">{s.count}</span></div>)})}
          </div>
          <p className="text-xs text-gray-500 dark:text-[#a1a1aa] mt-3">In-range carts: {fmtNum(data.funnel.totalCartsCurrent)} • Abandoned {data.funnel.abandonmentRate.toFixed(1)}%</p>
        </div>
        <div className="bg-white dark:bg-[#171717] rounded-xl border border-gray-200 dark:border-[#262626] p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">Vendor Verification</h3>
          <div className="space-y-2">
            {data.vendorVerificationBreakdown.map(s=>{const max=Math.max(...data.vendorVerificationBreakdown.map(x=>x.count)); return (<div key={s.status} className="flex items-center gap-3"><span className="text-xs font-medium w-24 capitalize text-gray-700 dark:text-[#a1a1aa]">{s.status}</span><div className="flex-1 h-2 bg-gray-100 dark:bg-[#262626] rounded-full overflow-hidden"><div className="h-full bg-violet-600 rounded-full" style={{width:`${(s.count/max)*100}%`}}/></div><span className="text-xs font-semibold w-8 text-right">{s.count}</span></div>)})}
          </div>
        </div>
        <div className="bg-white dark:bg-[#171717] rounded-xl border border-gray-200 dark:border-[#262626] p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">Driver Fleet</h3>
          <div className="space-y-2">
            {data.driverStatusBreakdown.map(s=>{const max=Math.max(...data.driverStatusBreakdown.map(x=>x.count),1); return (<div key={s.status} className="flex items-center gap-3"><span className="text-xs font-medium w-24 capitalize text-gray-700 dark:text-[#a1a1aa]">{s.status.replace(/_/g,' ')}</span><div className="flex-1 h-2 bg-gray-100 dark:bg-[#262626] rounded-full overflow-hidden"><div className="h-full bg-teal-600 rounded-full" style={{width:`${(s.count/max)*100}%`}}/></div><span className="text-xs font-semibold w-8 text-right">{s.count}</span></div>)})}
            {!data.driverStatusBreakdown.length && <p className="text-sm text-gray-500">No drivers</p>}
          </div>
        </div>
      </div>

        </div>
        <p className="text-[11px] text-gray-400 dark:text-[#52525b] text-center">Range: {data.meta.range} • Generated {new Date(data.meta.generatedAt).toLocaleString()} • BFF aggregation via <span className="font-mono">/api/admin/analytics</span>{hasActiveFilters ? ' • filtered' : ''}</p>
      </>
      )}
    </div>
  )
}
