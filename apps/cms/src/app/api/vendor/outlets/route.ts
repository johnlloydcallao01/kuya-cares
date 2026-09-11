/**
 * @file apps/cms/src/app/api/vendor/outlets/route.ts
 * @description BFF aggregation endpoint for web-merchant outlets management.
 * GET  /api/vendor/outlets?userId=123 -> aggregated outlets list & metrics for the vendor
 * POST /api/vendor/outlets            -> create a new outlet (merchant location) under the vendor
 */

import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import configPromise from '@payload-config'
import { authenticateVendor } from '@/utils/mediaLibrary'
import { getStoreHoursStatus } from '@/utils/storeHours'

export const dynamic = 'force-dynamic'

function getStr(val: unknown, fallback = ''): string {
  if (typeof val === 'string') return val
  if (typeof val === 'number') return String(val)
  if (val && typeof val === 'object') {
    const obj = val as Record<string, unknown>
    if ('formatted_address' in obj) return String(obj.formatted_address ?? fallback)
    if ('outletName' in obj) return String(obj.outletName ?? fallback)
    if ('name' in obj) return String(obj.name ?? fallback)
    if ('id' in obj) return String(obj.id ?? fallback)
  }
  return fallback
}

function getNum(val: unknown, fallback = 0): number {
  if (typeof val === 'number') return val
  if (typeof val === 'string') return parseFloat(val) || fallback
  return fallback
}

function badRequest(message: string, details?: unknown) {
  return NextResponse.json({ error: message, details }, { status: 400 })
}

function sanitizeAddress(addr: unknown): Record<string, any> | null {
  if (!addr || typeof addr !== 'object') return null
  const obj = addr as Record<string, any>
  return {
    id: obj.id,
    formattedAddress: getStr(obj.formatted_address || obj.formattedAddress),
    street: getStr(obj.street || obj.street_address),
    locality: getStr(obj.locality || obj.city),
    province: getStr(obj.administrative_area_level_1 || obj.province || obj.state),
    postalCode: getStr(obj.postal_code || obj.postalCode),
    country: getStr(obj.country, 'PH'),
    latitude: getNum(obj.latitude),
    longitude: getNum(obj.longitude),
    barangay: getStr(obj.barangay),
    floor_unit_room: getStr(obj.floor_unit_room),
    floorUnitRoom: getStr(obj.floor_unit_room),
    delivery_instructions: getStr(obj.delivery_instructions),
    deliveryInstructions: getStr(obj.delivery_instructions),
    landmark_description: getStr(obj.landmark_description),
    landmarkDescription: getStr(obj.landmark_description),
  }
}

function sanitizeMedia(mediaObj: unknown): Record<string, any> | null {
  if (!mediaObj || typeof mediaObj !== 'object') return null
  const obj = mediaObj as Record<string, any>
  const url = getStr(obj.cloudinaryURL || obj.url)
  if (!url) return null
  return {
    id: obj.id,
    url,
    alt: getStr(obj.alt),
    filename: getStr(obj.filename),
  }
}

function sanitizeMerchant(m: Record<string, any>): Record<string, any> {
  const contactInfo = m.contactInfo && typeof m.contactInfo === 'object' ? m.contactInfo : {}
  const delSettings = m.deliverySettings && typeof m.deliverySettings === 'object' ? m.deliverySettings : {}
  const media = m.media && typeof m.media === 'object' ? m.media : {}
  // Expose the CMS `merchants.activeAddress` relationship id explicitly so
  // web-merchant can render the same "Active Address" field as Payload admin.
  const activeAddressId =
    m.activeAddress != null && typeof m.activeAddress === 'object' && 'id' in (m.activeAddress as Record<string, unknown>)
      ? Number((m.activeAddress as Record<string, unknown>).id)
      : m.activeAddress != null && (typeof m.activeAddress === 'number' || typeof m.activeAddress === 'string')
        ? Number(m.activeAddress)
        : null

  return {
    id: String(m.id),
    outletName: getStr(m.outletName, `Outlet #${m.id}`),
    outletCode: getStr(m.outletCode, `OUT-${m.id}`),
    description: getStr(m.description),
    specialInstructions: getStr(m.specialInstructions),
    tags: Array.isArray(m.tags) ? m.tags : [],
    isActive: m.isActive !== false,
    isAcceptingOrders: m.isAcceptingOrders !== false,
    operationalStatus: getStr(m.operationalStatus, 'open'),
    isOpenNow: getStoreHoursStatus(m as Record<string, unknown>).isOpen,
    nextOpeningAt: getStoreHoursStatus(m as Record<string, unknown>).nextOpeningAt ?? null,
    operatingHours: m.operatingHours ?? null,
    specialHours: m.specialHours ?? null,
    contactInfo: {
      phone: getStr(contactInfo.phone),
      email: getStr(contactInfo.email),
      managerName: getStr(contactInfo.managerName),
      managerPhone: getStr(contactInfo.managerPhone),
    },
    deliverySettings: {
      minimumOrderAmount: getNum(delSettings.minimumOrderAmount ?? m.min_order_amount, 0),
      deliveryFee: getNum(delSettings.deliveryFee ?? m.delivery_fee_base, 0),
      freeDeliveryThreshold: getNum(delSettings.freeDeliveryThreshold ?? m.free_delivery_threshold, 0),
      estimatedDeliveryTimeMinutes: getNum(delSettings.estimatedDeliveryTimeMinutes ?? m.avg_delivery_time_minutes, 30),
      maxDeliveryTimeMinutes: getNum(delSettings.maxDeliveryTimeMinutes, 60),
      deliveryRadiusMeters: getNum(m.delivery_radius_meters, 5000),
      maxDeliveryRadiusMeters: getNum(m.max_delivery_radius_meters, 10000),
      deliveryFeePerKm: getNum(m.delivery_fee_per_km, 0),
    },
    address: sanitizeAddress(m.activeAddress),
    activeAddress: sanitizeAddress(m.activeAddress),
    activeAddressId: Number.isFinite(activeAddressId) ? activeAddressId : null,
    coordinates: {
      latitude: getNum(m.merchant_latitude || (m.activeAddress as any)?.latitude, 0),
      longitude: getNum(m.merchant_longitude || (m.activeAddress as any)?.longitude, 0),
    },
    media: {
      thumbnail: sanitizeMedia(media.thumbnail),
      storeFrontImage: sanitizeMedia(media.storeFrontImage),
    },
    averageRating: getNum(m.averageRating, 0),
    totalReviews: getNum(m.totalReviews, 0),
    createdAt: getStr(m.createdAt),
    updatedAt: getStr(m.updatedAt),
  }
}

export async function GET(request: NextRequest) {
  try {
    const payload = await getPayload({ config: configPromise })
    const authUser = await authenticateVendor(payload, request)
    if (!authUser) {
      return NextResponse.json({ error: 'Unauthorized: vendor authentication required' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId') || String(authUser.id)

    // 1. Resolve vendor for user
    const vendorRes = await payload.find({
      collection: 'vendors',
      where: { user: { equals: userId } },
      limit: 1,
      depth: 0,
      overrideAccess: true,
    })
    const vendor = vendorRes.docs[0] as Record<string, any> | undefined
    if (!vendor) {
      return NextResponse.json({ error: 'Vendor profile not found' }, { status: 404 })
    }

    // 2. Query merchants (outlets) for vendor
    const merchantsRes = await payload.find({
      collection: 'merchants',
      where: { vendor: { equals: vendor.id } },
      limit: 500,
      depth: 2,
      sort: '-createdAt',
      overrideAccess: true,
    })
    const merchantDocs = merchantsRes.docs as Record<string, any>[]
    const outlets = merchantDocs.map(sanitizeMerchant)

    // 3. Compute KPI metrics
    const metrics = {
      totalOutlets: outlets.length,
      activeOutlets: outlets.filter((o) => o.isActive).length,
      openOutlets: outlets.filter((o) => o.isActive && o.operationalStatus === 'open').length,
      busyOutlets: outlets.filter((o) => o.isActive && o.operationalStatus === 'busy').length,
      closedOutlets: outlets.filter((o) => !o.isActive || o.operationalStatus === 'closed' || o.operationalStatus === 'temp_closed').length,
      acceptingOrdersCount: outlets.filter((o) => o.isActive && o.isAcceptingOrders).length,
    }

    return NextResponse.json({
      vendor: {
        id: String(vendor.id),
        businessName: getStr(vendor.businessName),
      },
      metrics,
      outlets,
    })
  } catch (err: any) {
    console.error('[vendor/outlets] GET error:', err)
    return NextResponse.json({ error: err?.message || 'Failed to fetch outlets' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const payload = await getPayload({ config: configPromise })
    const authUser = await authenticateVendor(payload, request)
    if (!authUser) {
      return NextResponse.json({ error: 'Unauthorized: vendor authentication required' }, { status: 401 })
    }

    let body: Record<string, any>
    try {
      body = await request.json()
    } catch {
      return badRequest('Invalid JSON body')
    }

    const userId = body.userId ? String(body.userId) : String(authUser.id)
    const vendorRes = await payload.find({
      collection: 'vendors',
      where: { user: { equals: userId } },
      limit: 1,
      depth: 0,
      overrideAccess: true,
    })
    const vendor = vendorRes.docs[0] as Record<string, any> | undefined
    if (!vendor) {
      return NextResponse.json({ error: 'Vendor profile not found' }, { status: 404 })
    }

    const outletName = typeof body.outletName === 'string' ? body.outletName.trim() : ''
    if (!outletName || outletName.length < 2) {
      return badRequest('outletName is required and must be at least 2 characters')
    }

    const outletCode = typeof body.outletCode === 'string' && body.outletCode.trim()
      ? body.outletCode.trim().toUpperCase()
      : `OUT-${Date.now().toString(36).toUpperCase()}`

    // Active Address linking — EXACT mirror of Merchants.activeAddress.filterOptions
    // (collections/Merchants.ts): allowed ids are addresses where
    // { user equals vendorUserId }, where vendorUserId = vendors.user for this outlet's vendor.
    // When provided, we link it directly instead of creating a new addresses doc.
    let addressId: number | null = null
    const activeLinkRaw = (body as Record<string, any>).activeAddress ?? (body as Record<string, any>).activeAddressId
    // vendor.user is the owner id the collection filters by (vendors.user required, role=vendor).
    const vendorOwnerId =
      (vendor as Record<string, any>).user != null
        ? typeof (vendor as Record<string, any>).user === 'object'
          ? Number(((vendor as Record<string, any>).user as Record<string, unknown>).id)
          : Number((vendor as Record<string, any>).user)
        : Number(authUser.id)
    if (activeLinkRaw !== undefined && activeLinkRaw !== null && String(activeLinkRaw).trim() !== '') {
      const n = Number(activeLinkRaw)
      if (!Number.isFinite(n) || n <= 0) return badRequest('activeAddress must be a numeric address id')
      let addrDoc: Record<string, any> | null = null
      try {
        addrDoc = (await payload.findByID({ collection: 'addresses', id: n, depth: 0, overrideAccess: true })) as unknown as Record<string, any>
      } catch {
        return badRequest('activeAddress not found')
      }
      if (!addrDoc) return badRequest('activeAddress not found')
      const owner = typeof addrDoc.user === 'object' && addrDoc.user !== null ? (addrDoc.user as Record<string, unknown>).id : addrDoc.user
      if (String(owner) !== String(vendorOwnerId)) {
        return NextResponse.json({ error: `Forbidden: activeAddress must be owned by the vendor user (#${vendorOwnerId})` }, { status: 403 })
      }
      addressId = n
    } else if (body.address && typeof body.address === 'object') {
      try {
        const addrData = body.address as Record<string, any>
        const formattedAddress = addrData.formattedAddress || `${addrData.street || ''}, ${addrData.locality || ''}, ${addrData.province || ''}`.trim() || outletName
        const newAddr = await payload.create({
          collection: 'addresses',
          data: {
            // New outlet addresses are owned by the vendor user (same owner the picker filters by).
            user: vendorOwnerId,
            formatted_address: formattedAddress,
            street: addrData.street || null,
            locality: addrData.locality || null,
            administrative_area_level_1: addrData.province || null,
            postal_code: addrData.postalCode || null,
            country: addrData.country || 'Philippines',
            latitude: getNum(addrData.latitude, 14.5995),
            longitude: getNum(addrData.longitude, 120.9842),
            address_type: 'partner',
          } as any,
          overrideAccess: true,
        })
        addressId = (newAddr as unknown as Record<string, unknown>).id as number
      } catch (e: unknown) {
        console.warn('Could not create address doc for outlet:', e instanceof Error ? e.message : String(e))
      }
    }

    const merchantPayload: Record<string, any> = {
      vendor: vendor.id,
      outletName,
      outletCode,
      description: body.description || null,
      specialInstructions: body.specialInstructions || null,
      tags: Array.isArray(body.tags) ? body.tags : [],
      isActive: body.isActive ?? true,
      isAcceptingOrders: body.isAcceptingOrders ?? true,
      operationalStatus: body.operationalStatus || 'open',
      contactInfo: {
        phone: body.contactInfo?.phone || null,
        email: body.contactInfo?.email || null,
        managerName: body.contactInfo?.managerName || null,
        managerPhone: body.contactInfo?.managerPhone || null,
      },
      deliverySettings: {
        minimumOrderAmount: getNum(body.deliverySettings?.minimumOrderAmount, 0),
        deliveryFee: getNum(body.deliverySettings?.deliveryFee, 0),
        freeDeliveryThreshold: getNum(body.deliverySettings?.freeDeliveryThreshold, 0),
        estimatedDeliveryTimeMinutes: getNum(body.deliverySettings?.estimatedDeliveryTimeMinutes, 30),
        maxDeliveryTimeMinutes: getNum(body.deliverySettings?.maxDeliveryTimeMinutes, 60),
      },
      delivery_radius_meters: getNum(body.deliverySettings?.deliveryRadiusMeters, 5000),
      max_delivery_radius_meters: getNum(body.deliverySettings?.maxDeliveryRadiusMeters, 10000),
      min_order_amount: getNum(body.deliverySettings?.minimumOrderAmount, 0),
      delivery_fee_base: getNum(body.deliverySettings?.deliveryFee, 0),
      delivery_fee_per_km: getNum(body.deliverySettings?.deliveryFeePerKm, 0),
      operatingHours: body.operatingHours || null,
      specialHours: body.specialHours || null,
      merchant_latitude: getNum(body.address?.latitude, 0),
      merchant_longitude: getNum(body.address?.longitude, 0),
    }

    if (addressId) {
      merchantPayload.activeAddress = addressId
    }

    const created = await payload.create({
      collection: 'merchants',
      data: merchantPayload as any,
      overrideAccess: true,
    })

    // Fetch depth: 2 to populate address & media
    const populated = await payload.findByID({
      collection: 'merchants',
      id: created.id,
      depth: 2,
      overrideAccess: true,
    })

    return NextResponse.json({
      success: true,
      message: 'Outlet created successfully',
      outlet: sanitizeMerchant(populated as Record<string, any>),
    }, { status: 201 })
  } catch (err: any) {
    console.error('[vendor/outlets] POST error:', err)
    return NextResponse.json({ error: err?.message || 'Failed to create outlet', details: err?.data || err?.errors }, { status: 500 })
  }
}
