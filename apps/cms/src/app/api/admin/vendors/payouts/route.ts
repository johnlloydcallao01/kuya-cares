/**
 * @file apps/cms/src/app/api/admin/vendors/payouts/route.ts
 * @description BFF aggregation for web-admin /vendors/payouts — enterprise payouts overview.
 * Reuses reports/analytics vendorAgg logic but exposed as dedicated vendors/payouts contract.
 * Backend owns: period filtering, search, verification/businessType filtering, transaction→order→merchant→vendor join, gross/platform/delivery/net calc, sorting.
 * Frontend is thin: calls /api/vendors/payouts?range=30d&search=&verificationStatus=&businessType= and renders.
 * Access: admin-only (authenticateAdmin + overrideAccess:true)
 */

import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import configPromise from '@payload-config'
import { authenticateAdmin } from '@/utils/mediaLibrary'
import { getCached, setCached } from '@encreasl/cache'

function getNum(v: unknown, fb = 0): number {
  if (typeof v === 'number' && Number.isFinite(v)) return v
  if (typeof v === 'string') { const n = parseFloat(v); return Number.isFinite(n) ? n : fb }
  return fb
}
function getStr(v: unknown, fb = ''): string {
  if (typeof v === 'string') return v
  if (typeof v === 'number') return String(v)
  if (v && typeof v === 'object') {
    const o = v as Record<string, unknown>
    if ('businessName' in o) return String(o.businessName ?? fb)
    if ('outletName' in o) return String(o.outletName ?? fb)
  }
  return fb
}
function resolveId(v: unknown): string {
  if (v == null) return ''
  if (typeof v === 'string' || typeof v === 'number') return String(v)
  if (typeof v === 'object' && v !== null && 'id' in (v as any)) return String((v as any).id)
  return ''
}
function parseRange(sp: URLSearchParams): { days: number; label: string } {
  const r = (sp.get('range') || '30d').toLowerCase()
  if (r === '7d') return { days: 7, label: '7d' }
  if (r === '30d') return { days: 30, label: '30d' }
  if (r === '90d') return { days: 90, label: '90d' }
  if (r === '1y' || r === '365d' || r === '12m') return { days: 365, label: '1y' }
  if (r === 'all' || r === '0') return { days: 0, label: 'all' }
  const n = parseInt(r, 10)
  if (!Number.isNaN(n) && n > 0) return { days: n, label: `${n}d` }
  return { days: 30, label: '30d' }
}
function parseCsv(sp: URLSearchParams, key: string): string[] {
  const raw = sp.get(key) || ''
  if (!raw) return []
  return raw.split(',').map(s => s.trim().toLowerCase()).filter(Boolean)
}
function sanitizeMediaRef(value: unknown): { id: number; url: string | null } | null {
  if (!value || typeof value !== 'object') return null
  const media = value as Record<string, unknown>
  const id = Number(media.id)
  if (Number.isNaN(id)) return null
  const url = typeof media.cloudinaryURL === 'string' ? media.cloudinaryURL : typeof media.url === 'string' ? media.url : null
  return { id, url }
}

export async function GET(request: NextRequest) {
  try {
    const payload = await getPayload({ config: configPromise })
    const admin = await authenticateAdmin(payload, request)
    if (!admin) return NextResponse.json({ error: 'Unauthorized: admin authentication required' }, { status: 401 })

    const { searchParams } = new URL(request.url)
    const { days, label } = parseRange(searchParams)
    const search = (searchParams.get('search') || '').trim().toLowerCase()
    const verificationFilter = parseCsv(searchParams, 'verificationStatus')
    const businessTypeFilter = parseCsv(searchParams, 'businessType')
    const isActiveParam = searchParams.get('isActive')
    const isActiveFilter = isActiveParam === 'true' ? true : isActiveParam === 'false' ? false : null

    const cacheQuery = Array.from(searchParams.entries())
      .filter(([key]) => key !== '_t')
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
      .join('&') || 'range=30d'
    const cacheKey = `admin:payouts:${admin.id}:${cacheQuery}`
    const cached = await getCached<Record<string, unknown>>(cacheKey)
    if (cached) return NextResponse.json(cached, { headers: { 'X-Payouts-Cache': 'HIT' } })

    const now = new Date()
    const periodStart = days === 0 ? null : new Date(now.getTime() - days * 24 * 60 * 60 * 1000)

    const [vendorsRes, merchantsRes, ordersRes, transactionsRes, reviewsRes] = await Promise.all([
      payload.find({ collection: 'vendors', limit: 2000, depth: 1, overrideAccess: true, pagination: false } as any),
      payload.find({ collection: 'merchants', limit: 2000, depth: 1, overrideAccess: true, pagination: false } as any),
      payload.find({ collection: 'orders', limit: 5000, sort: '-createdAt', depth: 1, overrideAccess: true, pagination: false } as any),
      payload.find({ collection: 'transactions', limit: 5000, depth: 1, overrideAccess: true, pagination: false } as any),
      payload.find({ collection: 'reviews', limit: 0, depth: 0, overrideAccess: true, pagination: false } as any).catch(() => ({ docs: [] } as any)),
    ])

    const vendorsDocs = (vendorsRes.docs as unknown as Record<string, any>[]) || []
    const merchantsDocs = (merchantsRes.docs as unknown as Record<string, any>[]) || []
    const ordersDocs = (ordersRes.docs as unknown as Record<string, any>[]) || []
    const transactionsDocs = (transactionsRes.docs as unknown as Record<string, any>[]) || []

    const merchantMap = new Map<string, Record<string, any>>()
    merchantsDocs.forEach((m: any) => merchantMap.set(String(m.id), m as Record<string, any>))
    const vendorMap = new Map<string, Record<string, any>>()
    vendorsDocs.forEach((v: any) => vendorMap.set(String(v.id), v as Record<string, any>))
    const orderMap = new Map<string, Record<string, any>>()
    ordersDocs.forEach((o: any) => orderMap.set(String(o.id), o as Record<string, any>))

    function isInPeriod(doc: Record<string, any>, field: string): boolean {
      if (!periodStart) return true
      const raw = String(doc[field] ?? doc.createdAt ?? '')
      if (!raw) return false
      const d = new Date(raw)
      return !Number.isNaN(d.getTime()) && d >= periodStart && d <= now
    }

    // Filter vendors by search/verification/businessType/isActive (for payouts view)
    let filteredVendorIds: Set<string> | null = null
    if (search || verificationFilter.length || businessTypeFilter.length || isActiveFilter !== null) {
      const matched = vendorsDocs.filter((v: any) => {
        if (verificationFilter.length && !verificationFilter.includes(String(v.verificationStatus || '').toLowerCase())) return false
        if (businessTypeFilter.length && !businessTypeFilter.includes(String(v.businessType || '').toLowerCase())) return false
        if (isActiveFilter !== null && !!v.isActive !== isActiveFilter) return false
        if (search) {
          const hay = `${getStr(v.businessName)} ${getStr(v.legalName)} ${getStr(v.businessRegistrationNumber)} ${getStr(v.primaryContactEmail)}`.toLowerCase()
          if (!hay.includes(search)) return false
        }
        return true
      })
      filteredVendorIds = new Set(matched.map((v: any) => String(v.id)))
    }

    // Period-filtered transactions (paid only for payouts) + isInPeriod on paid_at
    const paidTxPeriod = transactionsDocs.filter((t) => String(t.status) === 'paid' && isInPeriod(t as Record<string, any>, 'paid_at'))
    const refundedTxPeriod = transactionsDocs.filter((t) => String(t.status) === 'refunded' && isInPeriod(t as Record<string, any>, 'createdAt'))

    // Build vendor payout aggregation (verified revenue per vendor, like reports)
    const vendorAgg = new Map<string, { businessName: string; legalName: string; businessType: string; verificationStatus: string; isActive: boolean; logo: { id: number; url: string | null } | null; totalMerchants: number; averageRating: number; orders: number; gross: number; platformFees: number; deliveryFees: number; net: number; refunded: number }>()
    // Pre-init with filtered vendors so zero-payout vendors still appear
    const vendorsForAgg = filteredVendorIds ? vendorsDocs.filter((v: any) => filteredVendorIds!.has(String(v.id))) : vendorsDocs
    for (const v of vendorsForAgg as any[]) {
      const id = String(v.id)
      vendorAgg.set(id, {
        businessName: getStr(v.businessName),
        legalName: getStr(v.legalName),
        businessType: getStr(v.businessType, 'other'),
        verificationStatus: getStr(v.verificationStatus, 'pending'),
        isActive: !!v.isActive,
        logo: sanitizeMediaRef(v.logo),
        totalMerchants: getNum(v.totalMerchants),
        averageRating: getNum(v.averageRating),
        orders: 0, gross: 0, platformFees: 0, deliveryFees: 0, net: 0, refunded: 0,
      })
    }

    // Group paid transactions by vendor
    const dailyMap = new Map<string, { date: string; gross: number; net: number; orders: number }>()
    for (const t of paidTxPeriod) {
      const orderId = resolveId(t.order)
      const order = orderId ? orderMap.get(orderId) : null
      if (!order) continue
      const merchantRaw = order.merchant as unknown
      const merchantObj = merchantRaw && typeof merchantRaw === 'object' ? (merchantRaw as Record<string, unknown>) : null
      const merchantId = merchantObj ? String(merchantObj.id ?? '') : String(merchantRaw ?? '')
      const merchant = merchantId ? merchantMap.get(merchantId) : null
      const vendorRaw = merchant ? (merchant as any).vendor : null
      const vendorObj = vendorRaw && typeof vendorRaw === 'object' ? (vendorRaw as Record<string, unknown>) : null
      const vendorId = vendorObj ? String(vendorObj.id ?? '') : String(vendorRaw ?? '')
      if (!vendorId || (filteredVendorIds && !filteredVendorIds.has(vendorId))) continue
      const agg = vendorAgg.get(vendorId)
      if (!agg) continue
      const amt = getNum(t.amount)
      const platformFee = getNum((order as any).platform_fee)
      const deliveryFee = getNum((order as any).delivery_fee)
      agg.orders += 1
      agg.gross += amt
      agg.platformFees += platformFee
      agg.deliveryFees += deliveryFee
      agg.net += Math.max(0, amt - platformFee - deliveryFee)
      // daily
      const d = new Date(String(t.paid_at ?? t.createdAt ?? '')).toISOString().split('T')[0]
      if (d) {
        const e = dailyMap.get(d) || { date: d, gross: 0, net: 0, orders: 0 }
        e.gross += amt
        e.net += Math.max(0, amt - platformFee - deliveryFee)
        e.orders += 1
        dailyMap.set(d, e)
      }
    }
    // Refunded per vendor
    for (const t of refundedTxPeriod) {
      const orderId = resolveId(t.order)
      const order = orderId ? orderMap.get(orderId) : null
      if (!order) continue
      const merchantRaw = order.merchant as unknown
      const merchantObj = merchantRaw && typeof merchantRaw === 'object' ? (merchantRaw as Record<string, unknown>) : null
      const merchantId = merchantObj ? String(merchantObj.id ?? '') : String(merchantRaw ?? '')
      const merchant = merchantId ? merchantMap.get(merchantId) : null
      const vendorRaw = merchant ? (merchant as any).vendor : null
      const vendorObj = vendorRaw && typeof vendorRaw === 'object' ? (vendorRaw as Record<string, unknown>) : null
      const vendorId = vendorObj ? String(vendorObj.id ?? '') : String(vendorRaw ?? '')
      if (!vendorId || (filteredVendorIds && !filteredVendorIds.has(vendorId))) continue
      const agg = vendorAgg.get(vendorId)
      if (!agg) continue
      agg.refunded += getNum(t.amount)
    }

    // Enrich totalMerchants live count
    const merchantCountByVendor = new Map<string, number>()
    merchantsDocs.forEach((m: any) => {
      const raw = (m as any).vendor
      const vid = raw && typeof raw === 'object' ? String(raw.id ?? '') : String(raw ?? '')
      if (!vid) return
      merchantCountByVendor.set(vid, (merchantCountByVendor.get(vid) || 0) + 1)
    })
    for (const [vid, cnt] of merchantCountByVendor.entries()) {
      const agg = vendorAgg.get(vid)
      if (agg) agg.totalMerchants = cnt
    }

    let rows = Array.from(vendorAgg.entries()).map(([vendorId, v]) => ({
      vendorId,
      businessName: v.businessName,
      legalName: v.legalName,
      businessType: v.businessType,
      verificationStatus: v.verificationStatus,
      isActive: v.isActive,
      logo: v.logo,
      totalMerchants: v.totalMerchants,
      averageRating: v.averageRating,
      orders: v.orders,
      gross: v.gross,
      platformFees: v.platformFees,
      deliveryFees: v.deliveryFees,
      net: v.net,
      refunded: v.refunded,
      avgOrder: v.orders ? v.gross / v.orders : 0,
      avgNet: v.orders ? v.net / v.orders : 0,
    }))

    // Search already filtered vendors; for payouts we also allow search on payout rows (businessName) already via vendor filter
    // Sort by net desc, then gross desc
    rows = rows.sort((a, b) => b.net - a.net || b.gross - a.gross)

    const totalGross = rows.reduce((s, r) => s + r.gross, 0)
    const totalNet = rows.reduce((s, r) => s + r.net, 0)
    const totalPlatformFees = rows.reduce((s, r) => s + r.platformFees, 0)
    const totalDeliveryFees = rows.reduce((s, r) => s + r.deliveryFees, 0)
    const totalRefunded = rows.reduce((s, r) => s + r.refunded, 0)
    const totalOrders = rows.reduce((s, r) => s + r.orders, 0)
    const totalVendors = rows.length
    const activeVendors = rows.filter(r => r.isActive).length
    const avgPayout = totalVendors ? totalNet / totalVendors : 0

    // Daily trend sorted
    const daily = Array.from(dailyMap.values()).sort((a, b) => a.date.localeCompare(b.date))

    // Verification breakdown for filter UI (from filtered set or all)
    const verificationBreakdown: Record<string, number> = { pending: 0, verified: 0, rejected: 0, suspended: 0 }
    for (const v of vendorsForAgg as any[]) {
      const s = String(v.verificationStatus || 'pending').toLowerCase()
      verificationBreakdown[s] = (verificationBreakdown[s] || 0) + 1
    }

    const respBody = {
      meta: {
        range: label,
        days,
        generatedAt: now.toISOString(),
        periodStart: periodStart ? periodStart.toISOString() : null,
        periodEnd: now.toISOString(),
      },
      summary: {
        totalGross,
        totalNet,
        totalPlatformFees,
        totalDeliveryFees,
        totalRefunded,
        totalOrders,
        totalVendors,
        activeVendors,
        avgPayout,
        avgOrder: totalOrders ? totalGross / totalOrders : 0,
      },
      vendorPayouts: {
        rows,
        count: rows.length,
      },
      daily,
      verificationBreakdown,
    }

    await setCached(cacheKey, respBody, 30)
    return NextResponse.json(respBody, { headers: { 'X-Payouts-Cache': 'MISS' } })
  } catch (err: any) {
    console.error('[admin/vendors/payouts] error:', err)
    return NextResponse.json({ error: err?.message || 'Failed to load payouts' }, { status: 500 })
  }
}
