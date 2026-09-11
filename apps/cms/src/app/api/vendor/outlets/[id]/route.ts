/**
 * @file apps/cms/src/app/api/vendor/outlets/[id]/route.ts
 * @description BFF CRUD endpoint for a specific outlet owned by a vendor.
 * GET    /api/vendor/outlets/[id] -> get single outlet details
 * PATCH  /api/vendor/outlets/[id] -> update outlet details / quick status toggle
 * DELETE /api/vendor/outlets/[id] -> delete outlet
 */

import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import configPromise from '@payload-config'
import { authenticateVendor } from '@/utils/mediaLibrary'
import { getStoreHoursStatus, validateStoreHoursFields } from '@/utils/storeHours'

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

  // merchant_categories may be populated relationships or ids
  const catsRaw = m.merchant_categories
  const merchant_categories = Array.isArray(catsRaw)
    ? catsRaw.map((c: any) => {
        if (c && typeof c === 'object' && 'id' in c) return { id: Number(c.id), name: getStr((c as any).name, `Category #${c.id}`) }
        return { id: Number(c), name: String(c) }
      })
    : []

  const interiorRaw = (media as any).interiorImages ?? (m as any).interiorImages ?? null
  const menuRaw = (media as any).menuImages ?? (m as any).menuImages ?? null
  const normMediaIds = (raw: unknown) => {
    if (raw == null) return null
    if (Array.isArray(raw)) return raw.map((x: any) => (x && typeof x === 'object' && 'id' in x ? x.id : x)).filter((v) => v != null)
    if (typeof raw === 'object' && raw !== null && 'id' in (raw as any)) return [(raw as any).id]
    return [raw]
  }
  const storeHoursStatus = getStoreHoursStatus(m as Record<string, unknown>)

  return {
    id: String(m.id),
    outletName: getStr(m.outletName, `Outlet #${m.id}`),
    outletCode: getStr(m.outletCode, `OUT-${m.id}`),
    description: getStr(m.description),
    specialInstructions: getStr(m.specialInstructions),
    tags: Array.isArray(m.tags) ? m.tags : [],
    isActive: m.isActive !== false,
    isAcceptingOrders: m.isAcceptingOrders !== false,
    is_currently_delivering: m.is_currently_delivering !== false,
    isCurrentlyDelivering: m.is_currently_delivering !== false,
    operationalStatus: getStr(m.operationalStatus, 'open'),
    isOpenNow: storeHoursStatus.isOpen,
    storeHoursStatus,
    nextOpeningAt: storeHoursStatus.nextOpeningAt ?? null,
    timezone: getStr(m.timezone, 'Asia/Manila'),
    operatingHours: m.operatingHours ?? null,
    specialHours: m.specialHours ?? null,
    delivery_hours: m.delivery_hours ?? null,
    deliveryHours: m.delivery_hours ?? null,
    next_available_slot: m.next_available_slot ?? null,
    nextAvailableSlot: m.next_available_slot ?? null,
    service_area: m.service_area ?? null,
    serviceArea: m.service_area ?? null,
    priority_zones: m.priority_zones ?? null,
    restricted_areas: m.restricted_areas ?? null,
    delivery_zones: m.delivery_zones ?? null,
    location_accuracy_radius: m.location_accuracy_radius ?? null,
    peak_hours_multiplier: m.peak_hours_multiplier ?? null,
    avg_delivery_time_minutes: m.avg_delivery_time_minutes ?? null,
    merchant_categories,
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
      interiorImages: normMediaIds(interiorRaw),
      menuImages: normMediaIds(menuRaw),
    },
    averageRating: getNum(m.averageRating, 0),
    totalReviews: getNum(m.totalReviews, 0),
    createdAt: getStr(m.createdAt),
    updatedAt: getStr(m.updatedAt),
  }
}

async function verifyVendorOutletOwnership(payload: any, userId: number | string, merchantId: string | number) {
  const vendorRes = await payload.find({
    collection: 'vendors',
    where: { user: { equals: userId } },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })
  const vendor = vendorRes.docs[0]
  if (!vendor) return { vendor: null, merchant: null, error: 'Vendor profile not found', status: 404 }

  const merchant = await payload.findByID({
    collection: 'merchants',
    id: merchantId,
    depth: 2,
    overrideAccess: true,
  })
  if (!merchant) return { vendor, merchant: null, error: 'Outlet not found', status: 404 }

  const merchantVendorId = typeof merchant.vendor === 'object' ? merchant.vendor.id : merchant.vendor
  if (String(merchantVendorId) !== String(vendor.id)) {
    return { vendor, merchant: null, error: 'Forbidden: outlet does not belong to vendor', status: 403 }
  }

  return { vendor, merchant, error: null, status: 200 }
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const payload = await getPayload({ config: configPromise })
    const authUser = await authenticateVendor(payload, request)
    if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { merchant, error, status } = await verifyVendorOutletOwnership(payload, authUser.id, id)
    if (error || !merchant) return NextResponse.json({ error }, { status })

    const sanitized = sanitizeMerchant(merchant as Record<string, any>)
    return NextResponse.json({ outlet: sanitized, doc: sanitized })
  } catch (err: any) {
    console.error('[vendor/outlets/[id]] GET error:', err)
    return NextResponse.json({ error: err?.message || 'Failed to fetch outlet' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const requestId = Math.random().toString(36).slice(2, 7)
  console.log(`[vendor/outlets/[id]] PATCH:${requestId} start`)
  try {
    const { id } = await params
    const payload = await getPayload({ config: configPromise })
    const authUser = await authenticateVendor(payload, request)
    if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    // normalize id to number when possible (merchants uses numeric ids)
    const numericId = Number(id)
    const merchantIdForLookup: string | number = Number.isFinite(numericId) ? numericId : id

    const { merchant, error, status } = await verifyVendorOutletOwnership(payload, authUser.id, merchantIdForLookup)
    if (error || !merchant) {
      console.warn(`[vendor/outlets/[id]] PATCH:${requestId} ownership fail`, error)
      return NextResponse.json({ error }, { status })
    }

    let body: Record<string, any>
    try {
      body = await request.json()
    } catch {
      return badRequest('Invalid JSON body')
    }
    try { Object.assign(body, validateStoreHoursFields(body)) } catch (error) { return badRequest(error instanceof Error ? error.message : 'Invalid store hours') }

    console.log(`[vendor/outlets/[id]] PATCH:${requestId} body`, JSON.stringify(body).slice(0, 2000))

    const patch: Record<string, any> = {}

    // --- strict whitelist & validation (enterprise) ---
    if (typeof body.outletName === 'string') {
      const v = body.outletName.trim()
      if (!v || v.length < 2) return NextResponse.json({ error: 'outletName must be at least 2 characters' }, { status: 400 })
      if (v.length > 120) return NextResponse.json({ error: 'outletName too long (max 120)' }, { status: 400 })
      patch.outletName = v
    }
    if (typeof body.outletCode === 'string' && body.outletCode.trim()) {
      const v = body.outletCode.trim().toUpperCase()
      if (v.length < 2 || v.length > 30) return NextResponse.json({ error: 'outletCode must be 2-30 chars' }, { status: 400 })
      patch.outletCode = v
    }
    if (body.description !== undefined) patch.description = typeof body.description === 'string' ? (body.description.trim() || null) : null
    if (body.specialInstructions !== undefined) patch.specialInstructions = typeof body.specialInstructions === 'string' ? (body.specialInstructions.trim() || null) : null
    if (Array.isArray(body.tags)) patch.tags = body.tags.map((t: unknown) => String(t).trim()).filter(Boolean)

    const VALID_STATUSES = new Set(['open', 'closed', 'busy', 'temp_closed', 'maintenance'])
    if (typeof body.isActive === 'boolean') patch.isActive = body.isActive
    if (typeof body.isAcceptingOrders === 'boolean') patch.isAcceptingOrders = body.isAcceptingOrders
    if (typeof body.operationalStatus === 'string') {
      const s = body.operationalStatus.trim().toLowerCase()
      if (!VALID_STATUSES.has(s)) return NextResponse.json({ error: `operationalStatus must be one of ${Array.from(VALID_STATUSES).join(', ')}` }, { status: 400 })
      patch.operationalStatus = s
    }

    // Contact Info — always patch group if provided to avoid partial stale
    if (body.contactInfo && typeof body.contactInfo === 'object') {
      const c = body.contactInfo as Record<string, unknown>
      const cur = (merchant.contactInfo && typeof merchant.contactInfo === 'object' ? merchant.contactInfo : {}) as Record<string, unknown>
      const phone = c.phone !== undefined ? (c.phone ? String(c.phone).trim() : null) : (cur.phone as string | null) || null
      const email = c.email !== undefined ? (c.email ? String(c.email).trim().toLowerCase() : null) : (cur.email as string | null) || null
      if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return NextResponse.json({ error: 'contactInfo.email is invalid' }, { status: 400 })
      patch.contactInfo = {
        phone,
        email,
        managerName: c.managerName !== undefined ? (c.managerName ? String(c.managerName).trim() : null) : (cur.managerName as string | null) || null,
        managerPhone: c.managerPhone !== undefined ? (c.managerPhone ? String(c.managerPhone).trim() : null) : (cur.managerPhone as string | null) || null,
      }
    }

    // Delivery settings — map both group and denormalized top-level
    if (body.deliverySettings && typeof body.deliverySettings === 'object') {
      const d = body.deliverySettings as Record<string, unknown>
      const curGroup = (merchant.deliverySettings && typeof merchant.deliverySettings === 'object' ? merchant.deliverySettings : {}) as Record<string, unknown>
      const toNum = (v: unknown, fb: number) => {
        if (typeof v === 'number' && Number.isFinite(v)) return v
        if (typeof v === 'string' && v.trim() !== '') { const n = Number(v); return Number.isFinite(n) ? n : fb }
        if (v === null || v === undefined) return fb
        return fb
      }
      patch.deliverySettings = {
        minimumOrderAmount: d.minimumOrderAmount !== undefined ? toNum(d.minimumOrderAmount, 0) : toNum(curGroup.minimumOrderAmount, 0),
        deliveryFee: d.deliveryFee !== undefined ? toNum(d.deliveryFee, 0) : toNum(curGroup.deliveryFee, 0),
        freeDeliveryThreshold: d.freeDeliveryThreshold !== undefined ? toNum(d.freeDeliveryThreshold, 0) : toNum(curGroup.freeDeliveryThreshold, 0),
        estimatedDeliveryTimeMinutes: d.estimatedDeliveryTimeMinutes !== undefined ? Math.max(5, Math.min(120, toNum(d.estimatedDeliveryTimeMinutes, 30))) : Math.max(5, Math.min(120, toNum(curGroup.estimatedDeliveryTimeMinutes, 30))),
        maxDeliveryTimeMinutes: d.maxDeliveryTimeMinutes !== undefined ? Math.max(10, Math.min(180, toNum(d.maxDeliveryTimeMinutes, 60))) : Math.max(10, Math.min(180, toNum(curGroup.maxDeliveryTimeMinutes, 60))),
      }
      if (d.deliveryRadiusMeters !== undefined) patch.delivery_radius_meters = Math.max(0, toNum(d.deliveryRadiusMeters, 5000))
      if (d.maxDeliveryRadiusMeters !== undefined) patch.max_delivery_radius_meters = Math.max(0, toNum(d.maxDeliveryRadiusMeters, 10000))
      if (d.minimumOrderAmount !== undefined) patch.min_order_amount = toNum(d.minimumOrderAmount, 0)
      if (d.deliveryFee !== undefined) patch.delivery_fee_base = toNum(d.deliveryFee, 0)
      if (d.deliveryFeePerKm !== undefined) patch.delivery_fee_per_km = toNum(d.deliveryFeePerKm, 0)
      if (d.freeDeliveryThreshold !== undefined) patch.free_delivery_threshold = toNum(d.freeDeliveryThreshold, 0)
    }

    if (body.operatingHours !== undefined) {
      if (body.operatingHours === null) patch.operatingHours = null
      else if (typeof body.operatingHours === 'object' && !Array.isArray(body.operatingHours)) patch.operatingHours = body.operatingHours
      else return NextResponse.json({ error: 'operatingHours must be an object or null' }, { status: 400 })
    }
    if (body.specialHours !== undefined) patch.specialHours = body.specialHours ?? null

    // Timezone — IANA validation via Intl.DateTimeFormat
    if (body.timezone !== undefined) {
      if (body.timezone === null || String(body.timezone).trim() === '') {
        // explicit clear not allowed — keep default
        patch.timezone = 'Asia/Manila'
      } else {
        const tz = String(body.timezone).trim()
        try {
          Intl.DateTimeFormat(undefined, { timeZone: tz })
        } catch {
          return NextResponse.json({ error: 'timezone must be a valid IANA identifier (e.g. Asia/Manila)' }, { status: 400 })
        }
        if (tz.length > 80) return NextResponse.json({ error: 'timezone too long (max 80)' }, { status: 400 })
        patch.timezone = tz
      }
    }

    // is_currently_delivering quick pause toggle — support both snake and camel aliases
    const deliveringRaw = body.is_currently_delivering ?? body.isCurrentlyDelivering
    if (deliveringRaw !== undefined) {
      if (typeof deliveringRaw !== 'boolean') return NextResponse.json({ error: 'is_currently_delivering must be boolean' }, { status: 400 })
      patch.is_currently_delivering = deliveringRaw
    }

    // next_available_slot — ISO datetime or null
    const slotRaw = body.next_available_slot ?? body.nextAvailableSlot ?? body.next_availableSlot
    if (slotRaw !== undefined) {
      if (slotRaw === null || slotRaw === '') patch.next_available_slot = null
      else {
        const d = new Date(String(slotRaw))
        if (Number.isNaN(d.getTime())) return NextResponse.json({ error: 'next_available_slot must be a valid ISO datetime' }, { status: 400 })
        patch.next_available_slot = d.toISOString()
      }
    }

    // delivery_hours alias — separate from operatingHours
    const deliveryHoursRaw = body.delivery_hours ?? body.deliveryHours
    if (deliveryHoursRaw !== undefined) {
      if (deliveryHoursRaw === null || deliveryHoursRaw === '') patch.delivery_hours = null
      else if (typeof deliveryHoursRaw === 'object' && !Array.isArray(deliveryHoursRaw)) patch.delivery_hours = deliveryHoursRaw
      else if (Array.isArray(deliveryHoursRaw)) patch.delivery_hours = deliveryHoursRaw
      else return NextResponse.json({ error: 'delivery_hours must be an object, array, or null' }, { status: 400 })
    }

    // Service area & zones — GeoJSON (vendor editable polygon)
    if (body.service_area !== undefined || body.serviceArea !== undefined) {
      const v = body.service_area ?? body.serviceArea
      if (v === null || v === '' || (typeof v === 'string' && v.trim() === '')) patch.service_area = null
      else if (typeof v === 'object') patch.service_area = v
      else return NextResponse.json({ error: 'service_area must be valid GeoJSON object or null' }, { status: 400 })
    }
    if (body.priority_zones !== undefined) {
      const v = body.priority_zones
      if (v === null || v === '') patch.priority_zones = null
      else if (typeof v === 'object') patch.priority_zones = v
      else return NextResponse.json({ error: 'priority_zones must be valid GeoJSON object or null' }, { status: 400 })
    }
    if (body.restricted_areas !== undefined) {
      const v = body.restricted_areas
      if (v === null || v === '') patch.restricted_areas = null
      else if (typeof v === 'object') patch.restricted_areas = v
      else return NextResponse.json({ error: 'restricted_areas must be valid GeoJSON object or null' }, { status: 400 })
    }
    if (body.delivery_zones !== undefined || body.deliveryZones !== undefined) {
      const v = body.delivery_zones ?? body.deliveryZones
      if (v === null || v === '') patch.delivery_zones = null
      else if (typeof v === 'object') patch.delivery_zones = v
      else return NextResponse.json({ error: 'delivery_zones must be valid JSON object/array or null' }, { status: 400 })
    }

    // Vendor-editable numeric ops fields
    if (body.location_accuracy_radius !== undefined || body.locationAccuracyRadius !== undefined) {
      const raw = body.location_accuracy_radius ?? body.locationAccuracyRadius
      if (raw === null || raw === '') patch.location_accuracy_radius = null
      else {
        const n = Number(raw)
        if (!Number.isFinite(n) || n < 0) return NextResponse.json({ error: 'location_accuracy_radius must be >= 0' }, { status: 400 })
        patch.location_accuracy_radius = n
      }
    }
    if (body.peak_hours_multiplier !== undefined || body.peakHoursMultiplier !== undefined) {
      const raw = body.peak_hours_multiplier ?? body.peakHoursMultiplier
      if (raw === null || raw === '') patch.peak_hours_multiplier = null
      else {
        const n = Number(raw)
        if (!Number.isFinite(n) || n < 1) return NextResponse.json({ error: 'peak_hours_multiplier must be >= 1' }, { status: 400 })
        patch.peak_hours_multiplier = n
      }
    }
    if (body.avg_delivery_time_minutes !== undefined || body.avgDeliveryTimeMinutes !== undefined) {
      const raw = body.avg_delivery_time_minutes ?? body.avgDeliveryTimeMinutes
      if (raw === null || raw === '') patch.avg_delivery_time_minutes = null
      else {
        const n = Number(raw)
        if (!Number.isFinite(n) || n < 0 || n > 240) return NextResponse.json({ error: 'avg_delivery_time_minutes must be 0-240' }, { status: 400 })
        patch.avg_delivery_time_minutes = Math.round(n)
      }
    }

    // Media (thumbnail / storeFrontImage / interiorImages / menuImages) — only patch when explicitly sent (prevents clearing on name-only edits)
    // Enterprise pattern (web-admin vendors): media ids are only sent when dirty. `undefined` => not touched,
    // `null` => explicit clear, `Number` => set. Never auto-preserve stale curMedia when body.media is absent.
    if (body.media && typeof body.media === 'object') {
      const mediaPatch: Record<string, any> = {}
      let hasMediaIntent = false
      if (body.media.thumbnail !== undefined) {
        hasMediaIntent = true
        const v = body.media.thumbnail
        if (v === null || v === '') mediaPatch.thumbnail = null
        else {
          const n = Number(v)
          if (!Number.isFinite(n) || n <= 0) return NextResponse.json({ error: 'media.thumbnail must be a valid media id or null' }, { status: 400 })
          mediaPatch.thumbnail = n
        }
      }
      if (body.media.storeFrontImage !== undefined) {
        hasMediaIntent = true
        const v = body.media.storeFrontImage
        if (v === null || v === '') mediaPatch.storeFrontImage = null
        else {
          const n = Number(v)
          if (!Number.isFinite(n) || n <= 0) return NextResponse.json({ error: 'media.storeFrontImage must be a valid media id or null' }, { status: 400 })
          mediaPatch.storeFrontImage = n
        }
      }
      if (body.media.interiorImages !== undefined) {
        hasMediaIntent = true
        const v = body.media.interiorImages
        if (v === null || (Array.isArray(v) && v.length === 0)) mediaPatch.interiorImages = []
        else if (Array.isArray(v)) {
          const nums = v.map((x: unknown) => Number(x)).filter((n) => Number.isFinite(n) && n > 0)
          if (nums.length !== v.length) return NextResponse.json({ error: 'media.interiorImages must be array of valid media ids' }, { status: 400 })
          mediaPatch.interiorImages = nums
        } else return NextResponse.json({ error: 'media.interiorImages must be array or null' }, { status: 400 })
      }
      if (body.media.menuImages !== undefined) {
        hasMediaIntent = true
        const v = body.media.menuImages
        if (v === null || (Array.isArray(v) && v.length === 0)) mediaPatch.menuImages = []
        else if (Array.isArray(v)) {
          const nums = v.map((x: unknown) => Number(x)).filter((n) => Number.isFinite(n) && n > 0)
          if (nums.length !== v.length) return NextResponse.json({ error: 'media.menuImages must be array of valid media ids' }, { status: 400 })
          mediaPatch.menuImages = nums
        } else return NextResponse.json({ error: 'media.menuImages must be array or null' }, { status: 400 })
      }
      // Only emit patch.media if caller actually intended a media change.
      // This prevents name-only edits from emitting { thumbnail: 26, storeFrontImage: null } and wiping storeFrontImage.
      if (hasMediaIntent) {
        patch.media = mediaPatch
      }
    }

    // Active Address linking — EXACT mirror of Merchants.activeAddress.filterOptions
    // (collections/Merchants.ts): allowed ids are addresses where
    // { user equals vendorUserId }, where vendorUserId = vendors.user for THIS outlet's vendor
    // (merchant.vendor -> vendors.user). Manual `address.*` fields below then edit the
    // newly-linked address (not the old one).
    // Resolve vendorUserId exactly like the collection does:
    // vendor as id -> vendors.findByID depth:1 -> vendors.user; vendor as object with .user -> extract.
    let outletVendorUserId: number | null = null
    {
      const mv = (merchant as Record<string, any>).vendor
      if (mv && typeof mv === 'object' && (mv as Record<string, unknown>).user) {
        const u = (mv as Record<string, any>).user as unknown
        outletVendorUserId =
          typeof u === 'object' && u !== null && 'id' in (u as Record<string, unknown>)
            ? Number((u as Record<string, unknown>).id)
            : Number(u as string | number)
        if (!Number.isFinite(outletVendorUserId)) outletVendorUserId = null
      } else if (typeof mv === 'string' || typeof mv === 'number') {
        try {
          const vDoc = (await payload.findByID({ collection: 'vendors', id: mv as number, depth: 1, overrideAccess: true })) as unknown as Record<string, any>
          const u = vDoc?.user as unknown
          outletVendorUserId =
            typeof u === 'object' && u !== null && 'id' in (u as Record<string, unknown>)
              ? Number((u as Record<string, unknown>).id)
              : Number(u as string | number)
          if (!Number.isFinite(outletVendorUserId)) outletVendorUserId = null
        } catch (e) {
          console.error(`[vendor/outlets/[id]] PATCH:${requestId} outlet vendor lookup failed`, e)
        }
      }
      // Fallback: ownership already verified outlet belongs to logged-in vendor.
      if (outletVendorUserId == null) outletVendorUserId = Number(authUser.id)
    }
    const activeLinkRaw = (body as Record<string, any>).activeAddress ?? (body as Record<string, any>).activeAddressId
    let linkedActiveAddressId: number | null = null
    let activeAddressCleared = false
    if (activeLinkRaw !== undefined) {
      if (activeLinkRaw === null || (typeof activeLinkRaw === 'string' && activeLinkRaw.trim() === '')) {
        patch.activeAddress = null
        activeAddressCleared = true
      } else {
        const n = Number(activeLinkRaw)
        if (!Number.isFinite(n) || n <= 0) return NextResponse.json({ error: 'activeAddress must be a numeric address id or null' }, { status: 400 })
        let addrDoc: Record<string, any> | null = null
        try {
          addrDoc = (await payload.findByID({ collection: 'addresses', id: n, depth: 0, overrideAccess: true })) as unknown as Record<string, any>
        } catch {
          return NextResponse.json({ error: 'activeAddress not found' }, { status: 400 })
        }
        if (!addrDoc) return NextResponse.json({ error: 'activeAddress not found' }, { status: 400 })
        const owner = typeof addrDoc.user === 'object' && addrDoc.user !== null ? (addrDoc.user as Record<string, unknown>).id : addrDoc.user
        if (String(owner) !== String(outletVendorUserId)) {
          return NextResponse.json({ error: `Forbidden: activeAddress must be owned by the vendor user (#${outletVendorUserId})` }, { status: 403 })
        }
        patch.activeAddress = n
        linkedActiveAddressId = n
        if (typeof addrDoc.latitude === 'number' && Number.isFinite(addrDoc.latitude)) patch.merchant_latitude = Number(addrDoc.latitude)
        if (typeof addrDoc.longitude === 'number' && Number.isFinite(addrDoc.longitude)) patch.merchant_longitude = Number(addrDoc.longitude)
      }
    }

    // Address — enterprise-grade: only mutate when caller provides non-null, non-empty values.
    // Mirrors web-admin vendors pattern: never treat `null`/`""` as "provided". Frontend's
    // dirty-tracking already omits unchanged address keys, so `undefined` means "not touched".
    // This prevents the destructive wipe where a name-only edit (address: {street: null, ...})
    // would null out street/locality/province/postal_code and corrupt formatted_address.
    const hasAddressPayload = body.address && typeof body.address === 'object' && Object.keys(body.address).length > 0
    if (hasAddressPayload && !activeAddressCleared) {
      const addrData = body.address as Record<string, any>
      const isMeaningful = (v: unknown) => v !== undefined && v !== null && String(v).trim() !== ''
      const isAddrFieldProvided = (k: string) => isMeaningful(addrData[k])
      // latitude/longitude can be 0, so check numeric presence separately
      const latProvided = addrData.latitude !== undefined && addrData.latitude !== null && String(addrData.latitude).trim() !== ''
      const lngProvided = addrData.longitude !== undefined && addrData.longitude !== null && String(addrData.longitude).trim() !== ''
      const anyAddrFieldProvided =
        ['street', 'locality', 'province', 'postalCode', 'country', 'formattedAddress', 'barangay', 'floor_unit_room', 'floorUnitRoom', 'delivery_instructions', 'deliveryInstructions', 'landmark_description', 'landmarkDescription'].some(isAddrFieldProvided) || latProvided || lngProvided
      if (anyAddrFieldProvided) {
        // When the caller just re-linked activeAddress, manual fields apply to the NEW address.
        let addressId: unknown = linkedActiveAddressId ?? (typeof merchant.activeAddress === 'object' ? (merchant.activeAddress as unknown as Record<string, unknown>)?.id : merchant.activeAddress)
        let curAddr = (typeof merchant.activeAddress === 'object' ? merchant.activeAddress : null) as Record<string, unknown> | null
        if (linkedActiveAddressId) {
          try {
            const linkedDoc = (await payload.findByID({ collection: 'addresses', id: linkedActiveAddressId, depth: 0, overrideAccess: true })) as unknown as Record<string, unknown>
            if (linkedDoc) curAddr = linkedDoc
          } catch {
            // fall back to merchant's previous address for formatted_address composition
          }
        }
        // Build formatted_address only from meaningful provided fields + existing fallbacks
        const streetVal = isAddrFieldProvided('street') ? String(addrData.street).trim() : null
        const localityVal = isAddrFieldProvided('locality') ? String(addrData.locality).trim() : null
        const provinceVal = isAddrFieldProvided('province') ? String(addrData.province).trim() : null
        const postalVal = isAddrFieldProvided('postalCode') ? String(addrData.postalCode).trim() : null
        const barangayProvided = isAddrFieldProvided('barangay')
        const floorProvided = isAddrFieldProvided('floor_unit_room') || isAddrFieldProvided('floorUnitRoom')
        const deliveryInstrProvided = isAddrFieldProvided('delivery_instructions') || isAddrFieldProvided('deliveryInstructions')
        const landmarkProvided = isAddrFieldProvided('landmark_description') || isAddrFieldProvided('landmarkDescription')
        const barangayVal = barangayProvided ? String((addrData.barangay ?? '')).trim() : null
        const floorVal = floorProvided ? String((addrData.floor_unit_room ?? addrData.floorUnitRoom ?? '')).trim() : null
        const deliveryInstrVal = deliveryInstrProvided ? String((addrData.delivery_instructions ?? addrData.deliveryInstructions ?? '')).trim() : null
        const landmarkVal = landmarkProvided ? String((addrData.landmark_description ?? addrData.landmarkDescription ?? '')).trim() : null
        const formattedAddress =
          (isAddrFieldProvided('formattedAddress') && String(addrData.formattedAddress).trim()) ||
          [streetVal ?? (curAddr?.street as string), localityVal ?? (curAddr?.locality as string), provinceVal ?? (curAddr?.administrative_area_level_1 as string), postalVal ?? (curAddr?.postal_code as string)]
            .filter(Boolean)
            .join(', ')
            .trim() ||
          (merchant as Record<string, unknown>).outletName as string

        const latVal = latProvided ? getNum(addrData.latitude, NaN) : NaN
        const lngVal = lngProvided ? getNum(addrData.longitude, NaN) : NaN
        if (latProvided && Number.isNaN(latVal)) return NextResponse.json({ error: 'latitude must be a number between -90 and 90' }, { status: 400 })
        if (lngProvided && Number.isNaN(lngVal)) return NextResponse.json({ error: 'longitude must be a number between -180 and 180' }, { status: 400 })
        if (latProvided && (latVal < -90 || latVal > 90)) return NextResponse.json({ error: 'latitude out of range' }, { status: 400 })
        if (lngProvided && (lngVal < -180 || lngVal > 180)) return NextResponse.json({ error: 'longitude out of range' }, { status: 400 })

        if (addressId) {
          const existingId = Number(addressId)
          const addrPatch: Record<string, unknown> = {}
          // Only write formatted_address if we actually computed a new one from provided fields
          const hasStreetLikeChange = isAddrFieldProvided('street') || isAddrFieldProvided('locality') || isAddrFieldProvided('province') || isAddrFieldProvided('postalCode')
          if (hasStreetLikeChange) addrPatch.formatted_address = formattedAddress
          else if (isAddrFieldProvided('formattedAddress')) addrPatch.formatted_address = formattedAddress
          if (isAddrFieldProvided('street')) addrPatch.street = streetVal
          if (isAddrFieldProvided('locality')) addrPatch.locality = localityVal
          if (isAddrFieldProvided('province')) addrPatch.administrative_area_level_1 = provinceVal
          if (isAddrFieldProvided('postalCode')) addrPatch.postal_code = postalVal
          if (isAddrFieldProvided('country')) addrPatch.country = String(addrData.country).trim() || 'Philippines'
          if (barangayProvided) addrPatch.barangay = barangayVal || null
          if (floorProvided) addrPatch.floor_unit_room = floorVal || null
          if (deliveryInstrProvided) addrPatch.delivery_instructions = deliveryInstrVal || null
          if (landmarkProvided) addrPatch.landmark_description = landmarkVal || null
          if (latProvided) addrPatch.latitude = latVal
          if (lngProvided) addrPatch.longitude = lngVal
          if (Object.keys(addrPatch).length > 0) {
            try {
              await payload.update({ collection: 'addresses', id: existingId, data: addrPatch as never, overrideAccess: true })
            } catch (e: unknown) {
              const msg = e instanceof Error ? e.message : String(e)
              console.error(`[vendor/outlets/[id]] PATCH:${requestId} address update failed`, msg)
              return NextResponse.json({ error: `Address update failed: ${msg}` }, { status: 400 })
            }
          }
          patch.activeAddress = existingId
        } else {
          const hasEnough = isAddrFieldProvided('street') || isAddrFieldProvided('locality') || isAddrFieldProvided('province') || (latProvided && lngProvided)
          if (hasEnough) {
            const newAddr = (await payload.create({
              collection: 'addresses',
              data: {
                // Owned by the outlet's vendor user (same owner the picker filters by).
                user: outletVendorUserId,
                formatted_address: formattedAddress,
                street: streetVal ?? null,
                locality: localityVal ?? null,
                administrative_area_level_1: provinceVal ?? null,
                postal_code: postalVal ?? null,
                country: isAddrFieldProvided('country') ? String(addrData.country).trim() : 'Philippines',
                barangay: barangayVal ?? null,
                floor_unit_room: floorVal ?? null,
                delivery_instructions: deliveryInstrVal ?? null,
                landmark_description: landmarkVal ?? null,
                latitude: latProvided ? latVal : 14.5995,
                longitude: lngProvided ? lngVal : 120.9842,
                address_type: 'partner',
              } as never,
              overrideAccess: true,
            })) as unknown as Record<string, unknown>
            patch.activeAddress = newAddr.id
          }
        }
        if (latProvided) patch.merchant_latitude = latVal
        if (lngProvided) patch.merchant_longitude = lngVal
      }
    }

    if (Object.keys(patch).length === 0) return NextResponse.json({ error: 'Nothing to update — no valid fields provided' }, { status: 400 })

    console.log(`[vendor/outlets/[id]] PATCH:${requestId} patch`, JSON.stringify(patch).slice(0, 3000))

    let updated: Record<string, unknown>
    try {
      updated = (await payload.update({ collection: 'merchants', id: merchant.id as number, data: patch as never, overrideAccess: true, depth: 0 })) as unknown as Record<string, unknown>
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e)
      const lower = msg.toLowerCase()
      console.error(`[vendor/outlets/[id]] PATCH:${requestId} payload.update failed`, msg, (e as { data?: unknown })?.data)
      if (lower.includes('unique') || lower.includes('duplicate') || lower.includes('already exists')) {
        return NextResponse.json({ error: 'Outlet code already exists — must be unique' }, { status: 409 })
      }
      return NextResponse.json({ error: msg }, { status: 400 })
    }

    const populated = await payload.findByID({ collection: 'merchants', id: updated.id as number, depth: 2, overrideAccess: true })
    const sanitized = sanitizeMerchant(populated as Record<string, any>)

    // Enterprise verification — mirror web-admin vendors pattern: verify every patched key
    // to prevent "fake success" where payload.update returns 200 but DB still holds stale values
    // (e.g., hook rollback, address transaction failure, or column mapping mismatch).
    const mismatches: Array<{ field: string; expected: unknown; actual: unknown }> = []
    const expectName = typeof body.outletName === 'string' ? body.outletName.trim() : null
    if (expectName && sanitized.outletName !== expectName) mismatches.push({ field: 'outletName', expected: expectName, actual: sanitized.outletName })
    const expectCode = typeof body.outletCode === 'string' ? body.outletCode.trim().toUpperCase() : null
    if (expectCode && sanitized.outletCode !== expectCode) mismatches.push({ field: 'outletCode', expected: expectCode, actual: sanitized.outletCode })
    if (patch.operationalStatus !== undefined && sanitized.operationalStatus !== patch.operationalStatus) mismatches.push({ field: 'operationalStatus', expected: patch.operationalStatus, actual: sanitized.operationalStatus })
    if (patch.isActive !== undefined && sanitized.isActive !== patch.isActive) mismatches.push({ field: 'isActive', expected: patch.isActive, actual: sanitized.isActive })
    if (patch.isAcceptingOrders !== undefined && sanitized.isAcceptingOrders !== patch.isAcceptingOrders) mismatches.push({ field: 'isAcceptingOrders', expected: patch.isAcceptingOrders, actual: sanitized.isAcceptingOrders })
    if (patch.contactInfo && typeof body.contactInfo === 'object') {
      const c = body.contactInfo as Record<string, unknown>
      if (c.phone !== undefined) {
        const exp = c.phone ? String(c.phone).trim() : ''
        if (sanitized.contactInfo.phone !== exp) mismatches.push({ field: 'contactInfo.phone', expected: exp, actual: sanitized.contactInfo.phone })
      }
      if (c.email !== undefined) {
        const exp = c.email ? String(c.email).trim().toLowerCase() : ''
        if (sanitized.contactInfo.email !== exp) mismatches.push({ field: 'contactInfo.email', expected: exp, actual: sanitized.contactInfo.email })
      }
    }
    // deliverySettings denormalized columns — verify via sanitized.deliverySettings which merges group + top-level
    if (patch.delivery_radius_meters !== undefined && sanitized.deliverySettings.deliveryRadiusMeters !== patch.delivery_radius_meters) mismatches.push({ field: 'deliverySettings.deliveryRadiusMeters', expected: patch.delivery_radius_meters, actual: sanitized.deliverySettings.deliveryRadiusMeters })
    if (patch.delivery_fee_per_km !== undefined && sanitized.deliverySettings.deliveryFeePerKm !== patch.delivery_fee_per_km) mismatches.push({ field: 'deliverySettings.deliveryFeePerKm', expected: patch.delivery_fee_per_km, actual: sanitized.deliverySettings.deliveryFeePerKm })
    if (patch.timezone !== undefined && sanitized.timezone !== patch.timezone) mismatches.push({ field: 'timezone', expected: patch.timezone, actual: sanitized.timezone })
    if (patch.is_currently_delivering !== undefined && sanitized.is_currently_delivering !== patch.is_currently_delivering) mismatches.push({ field: 'is_currently_delivering', expected: patch.is_currently_delivering, actual: sanitized.is_currently_delivering })
    if (patch.location_accuracy_radius !== undefined && sanitized.location_accuracy_radius !== patch.location_accuracy_radius) mismatches.push({ field: 'location_accuracy_radius', expected: patch.location_accuracy_radius, actual: sanitized.location_accuracy_radius })
    if (patch.peak_hours_multiplier !== undefined && sanitized.peak_hours_multiplier !== patch.peak_hours_multiplier) mismatches.push({ field: 'peak_hours_multiplier', expected: patch.peak_hours_multiplier, actual: sanitized.peak_hours_multiplier })
    if (patch.avg_delivery_time_minutes !== undefined && sanitized.avg_delivery_time_minutes !== patch.avg_delivery_time_minutes) mismatches.push({ field: 'avg_delivery_time_minutes', expected: patch.avg_delivery_time_minutes, actual: sanitized.avg_delivery_time_minutes })
    if (patch.service_area !== undefined) {
      const expected = JSON.stringify(patch.service_area)
      const actual = JSON.stringify(sanitized.service_area)
      if (expected !== actual) mismatches.push({ field: 'service_area', expected: patch.service_area, actual: sanitized.service_area })
    }
    if (patch.delivery_hours !== undefined) {
      const expected = JSON.stringify(patch.delivery_hours)
      const actual = JSON.stringify(sanitized.delivery_hours)
      if (expected !== actual) mismatches.push({ field: 'delivery_hours', expected: patch.delivery_hours, actual: sanitized.delivery_hours })
    }
    if (patch.activeAddress !== undefined) {
      const expected = patch.activeAddress === null ? null : Number(patch.activeAddress)
      const actual = sanitized.activeAddressId
      if (expected !== actual) mismatches.push({ field: 'activeAddress', expected, actual })
    }
    if (mismatches.length > 0) {
      console.error(`[vendor/outlets/[id]] PATCH:${requestId} verification failed`, { mismatches, id: merchant.id, patchKeys: Object.keys(patch) })
      return NextResponse.json({ error: 'Outlet update verification failed. The persisted record did not match the submitted payload.', details: { mismatches } }, { status: 500 })
    }

    console.log(`[vendor/outlets/[id]] PATCH:${requestId} success id=${merchant.id}`)
    return NextResponse.json({ success: true, message: 'Outlet updated successfully', outlet: sanitized, doc: sanitized })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to update outlet'
    console.error('[vendor/outlets/[id]] PATCH error:', err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const numericId = Number(id)
    const merchantIdForLookup: string | number = Number.isFinite(numericId) ? numericId : id
    const payload = await getPayload({ config: configPromise })
    const authUser = await authenticateVendor(payload, request)
    if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { merchant, error, status } = await verifyVendorOutletOwnership(payload, authUser.id, merchantIdForLookup)
    if (error || !merchant) return NextResponse.json({ error }, { status })

    await payload.delete({
      collection: 'merchants',
      id: merchant.id,
      overrideAccess: true,
    })

    return NextResponse.json({ success: true, message: 'Outlet deleted successfully' })
  } catch (err: any) {
    console.error('[vendor/outlets/[id]] DELETE error:', err)
    return NextResponse.json({ error: err?.message || 'Failed to delete outlet' }, { status: 500 })
  }
}
