/**
 * @file apps/cms/src/app/api/admin/business-zones/overview/route.ts
 * @description BFF aggregation for centralized Business Zones + Merchant Zones overview.
 * Returns platform zones with merchant assignment + merchant zones (service_area) in one payload.
 * GET /api/admin/business-zones/overview?zoneId= optional filter
 */

import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import configPromise from '@payload-config'
import { authenticateAdmin } from '@/utils/mediaLibrary'
import { getCached, setCached } from '@encreasl/cache'

function str(v: unknown, fb = ''): string { return typeof v === 'string' ? v : fb }

function sanitizeMediaRef(v: unknown): { id: number; url: string | null } | null {
  if (!v || typeof v !== 'object') return null
  const s = v as Record<string, unknown>
  const id = Number(s.id)
  if (Number.isNaN(id)) return null
  const url = typeof s.cloudinaryURL === 'string' ? s.cloudinaryURL : typeof s.url === 'string' ? s.url : null
  return { id, url }
}

export async function GET(request: NextRequest) {
  try {
    const payload = await getPayload({ config: configPromise })
    const admin = await authenticateAdmin(payload, request)
    if (!admin) return NextResponse.json({ error: 'Unauthorized: admin authentication required' }, { status: 401 })

    const { searchParams } = new URL(request.url)
    const cacheQuery = Array.from(searchParams.entries())
      .filter(([key]) => key !== '_t')
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
      .join('&') || 'default'
    const cacheKey = `admin:business-zones-overview:${admin.id}:${cacheQuery}`
    const cached = await getCached<Record<string, unknown>>(cacheKey)
    if (cached) return NextResponse.json(cached, { headers: { 'X-BusinessZonesOverview-Cache': 'HIT' } })

    const zoneIdParam = searchParams.get('zoneId') || searchParams.get('businessZoneId')
    const zoneId = zoneIdParam ? Number(zoneIdParam) : null
    const includeMerchants = searchParams.get('includeMerchants') !== 'false'

    // Fetch all zones
    const zonesRes = await payload.find({ collection: 'business-zones', limit: 1000, depth: 0, overrideAccess: true, pagination: false } as any)
    const zones = ((zonesRes as any).docs || []) as any[]

    // Fetch merchants with zone + geospatial fields
    let merchants: any[] = []
    if (includeMerchants) {
      const where = zoneId && !Number.isNaN(zoneId) ? { businessZone: { equals: zoneId } } : undefined
      const mRes = await payload.find({ collection: 'merchants', where, limit: 1000, depth: 2, overrideAccess: true, pagination: false } as any)
      merchants = ((mRes as any).docs || []) as any[]
    } else {
      // still need counts
      const mRes = await payload.find({ collection: 'merchants', limit: 5000, depth: 0, overrideAccess: true, pagination: false } as any)
      merchants = ((mRes as any).docs || []) as any[]
    }

    // Build merchant count per zone + unassigned
    const merchantCountByZone = new Map<string, number>()
    let unassigned = 0
    for (const m of merchants) {
      const bz = (m as any).businessZone ?? (m as any).business_zone ?? null
      const bzId = bz != null ? String(typeof bz === 'object' ? (bz as any).id ?? bz : bz) : null
      if (!bzId || bzId === 'null') unassigned++
      else merchantCountByZone.set(bzId, (merchantCountByZone.get(bzId) || 0) + 1)
    }

    // Sanitize zones with counts
    const zonesWithCounts = zones.map((z: any) => ({
      id: z.id,
      name: str(z.name),
      slug: str(z.slug),
      description: z.description ?? null,
      boundary: z.boundary ?? null,
      isActive: typeof z.isActive === 'boolean' ? z.isActive : true,
      disabledReason: z.disabledReason ?? null,
      displayOrder: z.displayOrder ?? 0,
      timezone: str(z.timezone, 'Asia/Manila'),
      createdAt: String(z.createdAt ?? ''),
      updatedAt: String(z.updatedAt ?? ''),
      merchantCount: merchantCountByZone.get(String(z.id)) || 0,
    }))

    // Sanitize Merchant Zones (service_area view)
    const merchantZones = merchants.slice(0, 1000).map((m: any) => {
      const vendor = m.vendor && typeof m.vendor === 'object' ? m.vendor as any : null
      const zoneVal = m.businessZone ?? m.business_zone ?? null
      const zoneObj = zoneVal && typeof zoneVal === 'object' ? zoneVal as any : null
      return {
        id: m.id,
        outletName: str(m.outletName),
        outletCode: str(m.outletCode),
        vendor: vendor ? { id: vendor.id, businessName: str(vendor.businessName), logo: sanitizeMediaRef(vendor.logo) } : null,
        vendorId: vendor ? vendor.id : (typeof m.vendor === 'number' ? m.vendor : null),
        media: {
          thumbnail: sanitizeMediaRef((m.media as any)?.thumbnail),
          storeFrontImage: sanitizeMediaRef((m.media as any)?.storeFrontImage),
        },
        businessZone: zoneObj ? { id: zoneObj.id, name: str(zoneObj.name), isActive: !!zoneObj.isActive } : (zoneVal ? { id: Number(zoneVal), name: String(zoneVal) } : null),
        businessZoneId: zoneObj ? zoneObj.id : (zoneVal ? Number(zoneVal) : null),
        isActive: !!m.isActive,
        isAcceptingOrders: !!m.isAcceptingOrders,
        operationalStatus: str(m.operationalStatus, 'open'),
        merchant_latitude: m.merchant_latitude ?? null,
        merchant_longitude: m.merchant_longitude ?? null,
        merchant_coordinates: m.merchant_coordinates ?? null,
        service_area: m.service_area ?? null,
        priority_zones: m.priority_zones ?? null,
        restricted_areas: m.restricted_areas ?? null,
        delivery_radius_meters: m.delivery_radius_meters ?? null,
        timezone: str(m.timezone, 'Asia/Manila'),
      }
    })

    const totalZones = zones.length
    const activeZones = zones.filter((z: any) => z.isActive !== false).length

    const responseBody = {
      zones: zonesWithCounts,
      merchantZones,
      stats: {
        totalZones,
        activeZones,
        inactiveZones: totalZones - activeZones,
        totalMerchants: merchants.length,
        assignedMerchants: merchants.length - unassigned,
        unassignedMerchants: unassigned,
        merchantCountByZone: Object.fromEntries(merchantCountByZone),
      },
      meta: { generatedAt: new Date().toISOString(), zoneId: zoneId ?? null },
    }

    await setCached(cacheKey, responseBody, 20)
    return NextResponse.json(responseBody, { headers: { 'X-BusinessZonesOverview-Cache': 'MISS' } })
  } catch (err: any) {
    console.error('[admin/business-zones/overview] GET error:', err)
    return NextResponse.json({ error: err?.message || 'Failed to load overview' }, { status: 500 })
  }
}
