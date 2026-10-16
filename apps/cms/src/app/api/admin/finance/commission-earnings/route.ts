/**
 * @file apps/cms/src/app/api/admin/finance/commission-earnings/route.ts
 * @description Platform-side commission earnings (how much WE earn).
 * GET /api/admin/finance/commission-earnings?range=30d&vendor=&source=&rule=&entry_type=
 * Sums the immutable vendor-commission-entries ledger (all entry types net out)
 * grouped by day / rule / source / vendor, plus paid member lifetime fees.
 */

import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import configPromise from '@payload-config'
import { authenticateAdmin } from '@/utils/mediaLibrary'
import { getCached, setCached } from '@encreasl/cache'
import { buildPayoutsCacheQuery, parsePayoutsParams } from '@/utils/payoutsShared'

type Doc = Record<string, any>

const num = (v: unknown): number => {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}
const idOf = (v: unknown): string => {
  if (typeof v === 'string' || typeof v === 'number') return String(v)
  if (v && typeof v === 'object' && 'id' in v) {
    const id = (v as { id?: unknown }).id
    if (typeof id === 'string' || typeof id === 'number') return String(id)
  }
  return ''
}
const dayOf = (iso: unknown): string => {
  const t = new Date(String(iso ?? '')).getTime()
  if (!Number.isFinite(t)) return ''
  return new Date(t).toISOString().slice(0, 10)
}

function dayRange(periodStart: Date | null, now: Date): string[] {
  const days: string[] = []
  if (!periodStart) return days
  const d = new Date(periodStart)
  d.setUTCHours(0, 0, 0, 0)
  const end = new Date(now)
  while (d <= end && days.length < 400) {
    days.push(d.toISOString().slice(0, 10))
    d.setUTCDate(d.getUTCDate() + 1)
  }
  return days
}

export async function GET(request: NextRequest) {
  try {
    const payload = await getPayload({ config: configPromise })
    const admin = await authenticateAdmin(payload, request)
    if (!admin) return NextResponse.json({ error: 'Unauthorized: admin authentication required' }, { status: 401 })

    const { searchParams } = new URL(request.url)
    const cacheKey = `admin:finance:commission-earnings:${admin.id}:${buildPayoutsCacheQuery(searchParams)}`
    const cached = await getCached<Record<string, unknown>>(cacheKey)
    if (cached) return NextResponse.json(cached, { headers: { 'X-Finance-Cache': 'HIT' } })

    const params = parsePayoutsParams(searchParams)
    const { days, label, now, periodStart } = params
    const vendorFilter = (searchParams.get('vendor') || '').trim()
    const sourceFilter = (searchParams.get('source') || '').trim()
    const ruleFilter = (searchParams.get('rule') || '').trim()
    const entryTypeFilter = (searchParams.get('entry_type') || '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)

    const and: Record<string, unknown>[] = []
    if (periodStart) {
      and.push({ effective_at: { greater_than_equal: periodStart.toISOString() } })
      and.push({ effective_at: { less_than_equal: now.toISOString() } })
    }
    if (vendorFilter) and.push({ vendor: { equals: vendorFilter } })
    if (sourceFilter) and.push({ commission_source: { equals: sourceFilter } })
    if (ruleFilter) and.push({ commission_rule: { equals: ruleFilter } })
    if (entryTypeFilter.length) and.push({ entry_type: { in: entryTypeFilter } })

    const [entriesRes, vendorsRes, rulesRes, memberFeesRes] = await Promise.all([
      payload.find({
        collection: 'vendor-commission-entries',
        where: and.length ? { and } : undefined,
        limit: 10000,
        sort: '-effective_at',
        depth: 0,
        overrideAccess: true,
        pagination: false,
      } as any),
      payload.find({ collection: 'vendors', limit: 2000, depth: 0, overrideAccess: true, pagination: false } as any),
      payload.find({
        collection: 'commission-rules',
        limit: 1000,
        depth: 0,
        overrideAccess: true,
        pagination: false,
      } as any),
      payload.find({
        collection: 'member-membership-payments',
        where: {
          and: [
            { status: { equals: 'paid' } },
            ...(periodStart
              ? [
                  { paidAt: { greater_than_equal: periodStart.toISOString() } },
                  { paidAt: { less_than_equal: now.toISOString() } },
                ]
              : []),
          ],
        },
        limit: 5000,
        sort: '-paidAt',
        depth: 0,
        overrideAccess: true,
        pagination: false,
      } as any),
    ])

    const entries = ((entriesRes as any).docs as Doc[]) ?? []
    const vendorNames = new Map<string, string>()
    for (const v of (((vendorsRes as any).docs as Doc[]) ?? [])) {
      vendorNames.set(String(v.id), String(v.businessName ?? v.legalName ?? `Vendor #${v.id}`))
    }
    const ruleNames = new Map<string, string>()
    for (const r of (((rulesRes as any).docs as Doc[]) ?? [])) {
      ruleNames.set(String(r.id), String(r.name ?? `Rule #${r.id}`))
    }

    let totalCommission = 0
    let totalFees = 0
    let totalReversed = 0
    let totalAdjustments = 0
    const orderIds = new Set<string>()
    const vendorIds = new Set<string>()
    const daily = new Map<string, { commission: number; fees: number; net: number; entries: number; orders: Set<string> }>()
    for (const d of dayRange(periodStart, now)) {
      daily.set(d, { commission: 0, fees: 0, net: 0, entries: 0, orders: new Set<string>() })
    }
    const byRule = new Map<string, { ruleId: string; name: string; commission: number; fees: number; net: number; entries: number }>()
    const bySource = new Map<string, { source: string; commission: number; fees: number; net: number; entries: number }>()
    const byVendor = new Map<
      string,
      { vendorId: string; businessName: string; commission: number; fees: number; net: number; entries: number; orders: Set<string> }
    >()

    for (const e of entries) {
      const amt = num(e.commission_amount)
      const fee = num(e.commission_transaction_fee)
      const net = amt + fee
      const day = dayOf(e.effective_at)
      const vid = idOf(e.vendor)
      const rid = idOf(e.commission_rule)
      const src = String(e.commission_source ?? 'global')
      const oid = idOf(e.order)

      totalCommission += amt
      totalFees += fee
      if (e.entry_type === 'reversal') totalReversed += net
      if (e.entry_type === 'adjustment') totalAdjustments += net
      if (oid) orderIds.add(oid)
      if (vid) vendorIds.add(vid)

      if (day && daily.has(day)) {
        const b = daily.get(day)!
        b.commission += amt
        b.fees += fee
        b.net += net
        b.entries += 1
        if (oid) b.orders.add(oid)
      }
      const rk = rid || 'none'
      const rg = byRule.get(rk) ?? { ruleId: rid, name: rid ? (ruleNames.get(rid) ?? `Rule #${rid}`) : 'Manual / none', commission: 0, fees: 0, net: 0, entries: 0 }
      rg.commission += amt
      rg.fees += fee
      rg.net += net
      rg.entries += 1
      byRule.set(rk, rg)

      const sg = bySource.get(src) ?? { source: src, commission: 0, fees: 0, net: 0, entries: 0 }
      sg.commission += amt
      sg.fees += fee
      sg.net += net
      sg.entries += 1
      bySource.set(src, sg)

      if (vid) {
        const vg = byVendor.get(vid) ?? {
          vendorId: vid,
          businessName: vendorNames.get(vid) ?? `Vendor #${vid}`,
          commission: 0,
          fees: 0,
          net: 0,
          entries: 0,
          orders: new Set<string>(),
        }
        vg.commission += amt
        vg.fees += fee
        vg.net += net
        vg.entries += 1
        if (oid) vg.orders.add(oid)
        byVendor.set(vid, vg)
      }
    }

    const round2 = (n: number) => Math.round(n * 100) / 100

    // Member lifetime fees (apps/web registration payments) — isolated line,
    // never mixed into commission breakdowns.
    const memberFees = (((memberFeesRes as any).docs as Doc[]) ?? [])
    const memberFeeIncome = round2(memberFees.reduce((s, d) => s + num(d.amount), 0))
    const memberFeeDaily = new Map<string, { total: number; count: number }>()
    for (const d of dayRange(periodStart, now)) {
      memberFeeDaily.set(d, { total: 0, count: 0 })
    }
    for (const d of memberFees) {
      const day = dayOf(d.paidAt)
      if (day && memberFeeDaily.has(day)) {
        const b = memberFeeDaily.get(day)!
        b.total += num(d.amount)
        b.count += 1
      }
    }

    const response = {
      meta: {
        range: label,
        days,
        generatedAt: now.toISOString(),
        periodStart: periodStart ? periodStart.toISOString() : null,
        periodEnd: now.toISOString(),
        filters: { vendor: vendorFilter || null, source: sourceFilter || null, rule: ruleFilter || null, entry_type: entryTypeFilter },
      },
      summary: {
        totalCommission: round2(totalCommission),
        totalFees: round2(totalFees),
        grossIncome: round2(totalCommission + totalFees),
        totalReversed: round2(totalReversed),
        totalAdjustments: round2(totalAdjustments),
        netIncome: round2(totalCommission + totalFees),
        totalEntries: entries.length,
        totalOrders: orderIds.size,
        totalVendors: vendorIds.size,
        memberFeeIncome,
        paidMemberFees: memberFees.length,
      },
      memberFeeDaily: [...memberFeeDaily.entries()].map(([date, b]) => ({
        date,
        total: round2(b.total),
        count: b.count,
      })),
      daily: [...daily.entries()].map(([date, b]) => ({
        date,
        commission: round2(b.commission),
        fees: round2(b.fees),
        net: round2(b.net),
        entries: b.entries,
        orders: b.orders.size,
      })),
      byRule: [...byRule.values()]
        .map((r) => ({ ...r, commission: round2(r.commission), fees: round2(r.fees), net: round2(r.net) }))
        .sort((a, b) => b.net - a.net),
      bySource: [...bySource.values()]
        .map((s) => ({ ...s, commission: round2(s.commission), fees: round2(s.fees), net: round2(s.net) }))
        .sort((a, b) => b.net - a.net),
      byVendor: [...byVendor.values()]
        .map((v) => ({
          vendorId: v.vendorId,
          businessName: v.businessName,
          commission: round2(v.commission),
          fees: round2(v.fees),
          net: round2(v.net),
          entries: v.entries,
          orders: v.orders.size,
        }))
        .sort((a, b) => b.net - a.net),
    }

    await setCached(cacheKey, response, 30)
    return NextResponse.json(response, { headers: { 'X-Finance-Cache': 'MISS' } })
  } catch (err: unknown) {
    console.error('[admin/finance/commission-earnings] error:', err)
    return NextResponse.json({ error: 'Failed to load commission earnings' }, { status: 500 })
  }
}
