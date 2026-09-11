/**
 * @file apps/cms/src/app/api/admin/customers/addresses/[id]/route.ts
 * @description BFF for single customer address (detail, update, delete) - admin-only safe boundary.
 * Mirrors apps/cms/src/app/api/admin/vendors/[id]/route.ts but for addresses collection.
 */

import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import configPromise from '@payload-config'
import { authenticateAdmin } from '@/utils/mediaLibrary'

function optionalString(v: unknown): string | null {
  return typeof v === 'string' ? v.trim() || null : null
}
function str(v: unknown, fb = ''): string {
  return typeof v === 'string' ? v : fb
}
function sanitizeMediaRef(value: unknown): { id: number; url: string | null; filename: string | null } | null {
  if (!value || typeof value !== 'object') return null
  const src = value as Record<string, unknown>
  const id = Number(src.id)
  if (Number.isNaN(id)) return null
  const url = typeof src.cloudinaryURL === 'string' ? src.cloudinaryURL : typeof src.url === 'string' ? src.url : null
  return { id, url, filename: typeof src.filename === 'string' ? src.filename : null }
}
function sanitizeUserBrief(value: unknown): Record<string, any> | null {
  if (!value || typeof value !== 'object') return null
  const u = value as Record<string, any>
  const id = Number(u.id)
  if (Number.isNaN(id)) return null
  return {
    id,
    email: str(u.email, ''),
    firstName: str(u.firstName, ''),
    lastName: str(u.lastName, ''),
    middleName: optionalString(u.middleName),
    phone: optionalString(u.phone),
    username: optionalString(u.username),
    role: str(u.role, 'customer'),
    isActive: typeof u.isActive === 'boolean' ? u.isActive : true,
    birthDate: u.birthDate ? String(u.birthDate) : null,
    profilePicture: sanitizeMediaRef(u.profilePicture),
    createdAt: String(u.createdAt ?? ''),
    updatedAt: String(u.updatedAt ?? ''),
  }
}
function sanitizeAddressDoc(raw: Record<string, any>): Record<string, any> {
  const userBrief = sanitizeUserBrief(raw.user)
  return {
    id: raw.id,
    user: userBrief,
    formatted_address: str(raw.formatted_address, ''),
    google_place_id: optionalString(raw.google_place_id),
    street_number: optionalString(raw.street_number),
    route: optionalString(raw.route),
    subpremise: optionalString(raw.subpremise),
    street: optionalString(raw.street),
    floor_unit_room: optionalString(raw.floor_unit_room),
    delivery_instructions: optionalString(raw.delivery_instructions),
    label: optionalString(raw.label),
    barangay: optionalString(raw.barangay),
    locality: optionalString(raw.locality),
    administrative_area_level_2: optionalString(raw.administrative_area_level_2),
    administrative_area_level_1: optionalString(raw.administrative_area_level_1),
    country: optionalString(raw.country) || 'Philippines',
    postal_code: optionalString(raw.postal_code),
    latitude: typeof raw.latitude === 'number' ? raw.latitude : raw.latitude != null ? Number(raw.latitude) : null,
    longitude: typeof raw.longitude === 'number' ? raw.longitude : raw.longitude != null ? Number(raw.longitude) : null,
    coordinates: raw.coordinates ?? null,
    altitude: typeof raw.altitude === 'number' ? raw.altitude : null,
    address_quality_score: typeof raw.address_quality_score === 'number' ? raw.address_quality_score : null,
    geocoding_accuracy: optionalString(raw.geocoding_accuracy),
    coordinate_source: optionalString(raw.coordinate_source) || 'GOOGLE_GEOCODING',
    last_geocoded_at: raw.last_geocoded_at ? String(raw.last_geocoded_at) : null,
    verification_method: optionalString(raw.verification_method) || 'UNVERIFIED',
    address_boundary: raw.address_boundary ?? null,
    service_radius_meters: typeof raw.service_radius_meters === 'number' ? raw.service_radius_meters : null,
    accessibility_notes: optionalString(raw.accessibility_notes),
    landmark_description: optionalString(raw.landmark_description),
    address_type: optionalString(raw.address_type) || 'home',
    is_default: !!raw.is_default,
    is_verified: !!raw.is_verified,
    notes: optionalString(raw.notes),
    createdAt: String(raw.createdAt ?? ''),
    updatedAt: String(raw.updatedAt ?? ''),
  }
}

function sanitizeAddressBrief(value: unknown): Record<string, any> | null {
  if (!value || typeof value !== 'object') return null
  const a = value as Record<string, any>
  const nid = Number(a.id)
  if (Number.isNaN(nid)) return null
  return {
    id: nid,
    formatted_address: str(a.formatted_address, ''),
    locality: optionalString(a.locality),
    administrative_area_level_1: optionalString(a.administrative_area_level_1),
    postal_code: optionalString(a.postal_code),
    address_type: optionalString(a.address_type) || 'home',
    is_default: !!a.is_default,
    is_verified: !!a.is_verified,
    latitude: typeof a.latitude === 'number' ? a.latitude : null,
    longitude: typeof a.longitude === 'number' ? a.longitude : null,
  }
}

const ADDRESS_TYPES = new Set(['home', 'work', 'partner', 'billing', 'shipping', 'pickup', 'delivery'])
const VERIFICATION_METHODS = new Set(['GPS_CONFIRMED', 'DELIVERY_CONFIRMED', 'USER_CONFIRMED', 'UNVERIFIED'])
const GEOCODING_ACCURACIES = new Set(['ROOFTOP', 'RANGE_INTERPOLATED', 'GEOMETRIC_CENTER', 'APPROXIMATE'])
const COORDINATE_SOURCES = new Set(['GPS', 'GOOGLE_GEOCODING', 'MANUAL', 'ESTIMATED'])

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const payload = await getPayload({ config: configPromise })
    const admin = await authenticateAdmin(payload, request)
    if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const numericId = Number(id)
    const docId: number | string = Number.isFinite(numericId) ? numericId : id
    let doc: Record<string, any>
    try {
      doc = (await payload.findByID({ collection: 'addresses', id: docId as number, depth: 2, overrideAccess: true })) as unknown as Record<string, any>
    } catch (e: any) {
      return NextResponse.json({ error: 'Address not found', details: e?.message }, { status: 404 })
    }
    if (!doc) return NextResponse.json({ error: 'Address not found' }, { status: 404 })

    // optionally fetch customer link and related merchants using this address
    const userId = (doc.user as any)?.id ?? doc.user
    const uidNum = Number(userId)
    const [customerRes, merchantRes] = await Promise.all([
      Number.isFinite(uidNum)
        ? payload.find({ collection: 'customers', where: { user: { equals: uidNum } }, limit: 1, depth: 1, overrideAccess: true }).catch(() => ({ docs: [] } as any))
        : ({ docs: [] } as any),
      payload.find({ collection: 'merchants', where: { activeAddress: { equals: doc.id } }, limit: 10, depth: 0, overrideAccess: true }).catch(() => ({ docs: [] } as any)),
    ])

    const sanitized = sanitizeAddressDoc(doc)
    const customerRaw = (customerRes as any).docs?.[0] ?? null
    // Admin perspective: active current = customers.activeAddress id (not is_default).
    const rawActive = customerRaw?.activeAddress
    const customerActiveAddressId =
      rawActive && typeof rawActive === 'object' ? Number((rawActive as any).id) : rawActive != null ? Number(rawActive) : null
    const activeIdNum = customerActiveAddressId != null && Number.isFinite(Number(customerActiveAddressId)) ? Number(customerActiveAddressId) : null
    const isActiveAddress = activeIdNum != null && Number(sanitized.id) === activeIdNum
    const customerActiveAddress =
      rawActive && typeof rawActive === 'object' ? sanitizeAddressBrief(rawActive) : null
    const customerBrief = customerRaw
      ? {
          id: customerRaw.id,
          srn: customerRaw.srn || null,
          currentLevel: customerRaw.currentLevel || null,
          email: customerRaw.email || sanitized.user?.email || null,
          activeAddressId: activeIdNum,
          activeAddress: customerActiveAddress,
        }
      : null
    const linkedMerchants = ((merchantRes as any).docs as any[] ?? []).map((m: any) => ({
      id: m.id,
      outletName: String(m.outletName ?? ''),
      outletCode: String(m.outletCode ?? ''),
      isActive: !!m.isActive,
    }))

    return NextResponse.json({
      doc: { ...sanitized, isActiveAddress, customerActiveAddressId: activeIdNum, customerActiveAddress, customer: customerBrief },
      customer: customerBrief,
      isActiveAddress,
      customerActiveAddressId: activeIdNum,
      customerActiveAddress,
      linkedMerchants,
    })
  } catch (err: any) {
    console.error('[admin/customers/addresses/[id]] GET error:', err)
    return NextResponse.json({ error: err?.message || 'Failed to load address' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const payload = await getPayload({ config: configPromise })
    const admin = await authenticateAdmin(payload, request)
    if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    let body: Record<string, any>
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
    }

    const numericId = Number(id)
    const docId: number | string = Number.isFinite(numericId) ? numericId : id

    // Whitelist updatable fields enterprise-grade
    const patch: Record<string, any> = {}

    if (typeof body.formatted_address === 'string') {
      const v = body.formatted_address.trim()
      if (!v || v.length < 5) return NextResponse.json({ error: 'formatted_address must be at least 5 characters' }, { status: 400 })
      patch.formatted_address = v
    }
    if (body.google_place_id !== undefined) patch.google_place_id = body.google_place_id === null || body.google_place_id === '' ? null : String(body.google_place_id).trim() || null
    if (body.street_number !== undefined) patch.street_number = body.street_number === null || body.street_number === '' ? null : String(body.street_number).trim() || null
    if (body.route !== undefined) patch.route = body.route === null || body.route === '' ? null : String(body.route).trim() || null
    if (body.subpremise !== undefined) patch.subpremise = body.subpremise === null || body.subpremise === '' ? null : String(body.subpremise).trim() || null
    if (body.street !== undefined) patch.street = body.street === null || body.street === '' ? null : String(body.street).trim() || null
    if (body.floor_unit_room !== undefined) patch.floor_unit_room = body.floor_unit_room === null || body.floor_unit_room === '' ? null : String(body.floor_unit_room).trim() || null
    if (body.delivery_instructions !== undefined) patch.delivery_instructions = body.delivery_instructions === null || body.delivery_instructions === '' ? null : String(body.delivery_instructions).trim() || null
    if (body.label !== undefined) patch.label = body.label === null || body.label === '' ? null : String(body.label).trim() || null
    if (body.barangay !== undefined) patch.barangay = body.barangay === null || body.barangay === '' ? null : String(body.barangay).trim() || null
    if (body.locality !== undefined) patch.locality = body.locality === null || body.locality === '' ? null : String(body.locality).trim() || null
    if (body.administrative_area_level_2 !== undefined) patch.administrative_area_level_2 = body.administrative_area_level_2 === null || body.administrative_area_level_2 === '' ? null : String(body.administrative_area_level_2).trim() || null
    if (body.administrative_area_level_1 !== undefined) patch.administrative_area_level_1 = body.administrative_area_level_1 === null || body.administrative_area_level_1 === '' ? null : String(body.administrative_area_level_1).trim() || null
    if (body.country !== undefined) patch.country = body.country === null || body.country === '' ? null : String(body.country).trim() || null
    if (body.postal_code !== undefined) patch.postal_code = body.postal_code === null || body.postal_code === '' ? null : String(body.postal_code).trim() || null
    if (body.accessibility_notes !== undefined) patch.accessibility_notes = body.accessibility_notes === null || body.accessibility_notes === '' ? null : String(body.accessibility_notes).trim() || null
    if (body.landmark_description !== undefined) patch.landmark_description = body.landmark_description === null || body.landmark_description === '' ? null : String(body.landmark_description).trim() || null
    if (body.notes !== undefined) patch.notes = body.notes === null || body.notes === '' ? null : String(body.notes).trim() || null

    if (body.address_type !== undefined) {
      const v = String(body.address_type).trim().toLowerCase()
      if (!ADDRESS_TYPES.has(v)) return NextResponse.json({ error: `address_type must be one of ${Array.from(ADDRESS_TYPES).join(', ')}` }, { status: 400 })
      patch.address_type = v
    }
    if (body.verification_method !== undefined) {
      if (body.verification_method === null || body.verification_method === '') patch.verification_method = 'UNVERIFIED'
      else {
        const v = String(body.verification_method).trim().toUpperCase()
        if (!VERIFICATION_METHODS.has(v)) return NextResponse.json({ error: `verification_method must be one of ${Array.from(VERIFICATION_METHODS).join(', ')}` }, { status: 400 })
        patch.verification_method = v
      }
    }
    if (body.geocoding_accuracy !== undefined) {
      if (body.geocoding_accuracy === null || body.geocoding_accuracy === '') patch.geocoding_accuracy = null
      else {
        const v = String(body.geocoding_accuracy).trim().toUpperCase()
        if (!GEOCODING_ACCURACIES.has(v)) return NextResponse.json({ error: `geocoding_accuracy must be one of ${Array.from(GEOCODING_ACCURACIES).join(', ')}` }, { status: 400 })
        patch.geocoding_accuracy = v
      }
    }
    if (body.coordinate_source !== undefined) {
      if (body.coordinate_source === null || body.coordinate_source === '') patch.coordinate_source = null
      else {
        const v = String(body.coordinate_source).trim().toUpperCase()
        if (!COORDINATE_SOURCES.has(v)) return NextResponse.json({ error: `coordinate_source must be one of ${Array.from(COORDINATE_SOURCES).join(', ')}` }, { status: 400 })
        patch.coordinate_source = v
      }
    }

    if (body.latitude !== undefined) {
      if (body.latitude === null || body.latitude === '') patch.latitude = null
      else {
        const n = Number(body.latitude)
        if (Number.isNaN(n)) return NextResponse.json({ error: 'latitude must be numeric' }, { status: 400 })
        patch.latitude = n
      }
    }
    if (body.longitude !== undefined) {
      if (body.longitude === null || body.longitude === '') patch.longitude = null
      else {
        const n = Number(body.longitude)
        if (Number.isNaN(n)) return NextResponse.json({ error: 'longitude must be numeric' }, { status: 400 })
        patch.longitude = n
      }
    }
    if (body.altitude !== undefined) {
      if (body.altitude === null || body.altitude === '') patch.altitude = null
      else {
        const n = Number(body.altitude)
        if (!Number.isNaN(n)) patch.altitude = n
        else patch.altitude = null
      }
    }
    if (body.address_quality_score !== undefined) {
      if (body.address_quality_score === null || body.address_quality_score === '') patch.address_quality_score = null
      else {
        const n = Number(body.address_quality_score)
        if (Number.isNaN(n)) return NextResponse.json({ error: 'address_quality_score must be numeric 1-100' }, { status: 400 })
        patch.address_quality_score = Math.min(100, Math.max(1, Math.round(n)))
      }
    }
    if (body.service_radius_meters !== undefined) {
      if (body.service_radius_meters === null || body.service_radius_meters === '') patch.service_radius_meters = null
      else {
        const n = Number(body.service_radius_meters)
        if (!Number.isNaN(n) && n >= 0) patch.service_radius_meters = n
      }
    }

    // booleans: handle both snake and camel
    if (body.is_verified !== undefined || body.isVerified !== undefined) {
      const raw = body.is_verified !== undefined ? body.is_verified : body.isVerified
      if (typeof raw === 'boolean') patch.is_verified = raw
      else if (raw !== undefined) {
        const v = String(raw).toLowerCase()
        if (v === 'true') patch.is_verified = true
        else if (v === 'false') patch.is_verified = false
      }
    }
    if (body.is_default !== undefined || body.isDefault !== undefined) {
      const raw = body.is_default !== undefined ? body.is_default : body.isDefault
      if (typeof raw === 'boolean') patch.is_default = raw
      else if (raw !== undefined) {
        const v = String(raw).toLowerCase()
        if (v === 'true') patch.is_default = true
        else if (v === 'false') patch.is_default = false
      }
    }

    if (Object.keys(patch).length === 0) return NextResponse.json({ error: 'Nothing to update' }, { status: 400 })

    // If setting is_default true, unset others for same user
    if (patch.is_default === true) {
      try {
        const current = (await payload.findByID({ collection: 'addresses', id: docId as number, depth: 1, overrideAccess: true })) as any
        const uid = current?.user?.id ?? current?.user
        const uidNum = Number(uid)
        if (Number.isFinite(uidNum)) {
          const others = await payload.find({
            collection: 'addresses',
            where: { user: { equals: uidNum }, is_default: { equals: true } },
            limit: 100,
            depth: 0,
            overrideAccess: true,
            pagination: false,
          } as any)
          for (const d of (others.docs as any[]) ?? []) {
            if (Number(d.id) !== Number(docId)) {
              try {
                await payload.update({ collection: 'addresses', id: d.id, data: { is_default: false } as any, overrideAccess: true, depth: 0 })
              } catch {}
            }
          }
        }
      } catch {}
    }

    let updated: Record<string, any>
    try {
      updated = (await payload.update({ collection: 'addresses', id: docId as number, data: patch as any, depth: 2, overrideAccess: true })) as unknown as Record<string, any>
    } catch (e: any) {
      const msg = e?.message || 'Failed to update address'
      return NextResponse.json({ error: msg, details: e?.data || e?.errors }, { status: 400 })
    }

    const sanitized = sanitizeAddressDoc(updated)
    return NextResponse.json({ success: true, message: 'Address updated successfully', doc: sanitized })
  } catch (err: any) {
    console.error('[admin/customers/addresses/[id]] PATCH error:', err)
    return NextResponse.json({ error: err?.message || 'Update failed' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const payload = await getPayload({ config: configPromise })
    const admin = await authenticateAdmin(payload, request)
    if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const numericId = Number(id)
    const docId: number | string = Number.isFinite(numericId) ? numericId : id

    const { searchParams } = new URL(request.url)
    const force = searchParams.get('force') === 'true'

    // fetch doc to know user and check dependencies
    let doc: any
    try {
      doc = await payload.findByID({ collection: 'addresses', id: docId as number, depth: 0, overrideAccess: true })
    } catch (e: any) {
      return NextResponse.json({ error: 'Address not found', details: e?.message }, { status: 404 })
    }
    if (!doc) return NextResponse.json({ error: 'Address not found' }, { status: 404 })

    // Check if it's activeAddress for any customer
    let isActiveForCustomer = false
    let customerId: number | null = null
    try {
      const cRes: any = await payload.find({ collection: 'customers', where: { activeAddress: { equals: doc.id } }, limit: 1, depth: 0, overrideAccess: true })
      if ((cRes.totalDocs ?? cRes.docs.length) > 0) {
        isActiveForCustomer = true
        customerId = cRes.docs[0]?.id ?? null
      }
    } catch {}

    // Check if linked to merchants activeAddress
    let linkedMerchantsCount = 0
    try {
      const mRes: any = await payload.find({ collection: 'merchants', where: { activeAddress: { equals: doc.id } }, limit: 1, depth: 0, overrideAccess: true })
      linkedMerchantsCount = mRes.totalDocs ?? mRes.docs.length
    } catch {}

    if ((isActiveForCustomer || linkedMerchantsCount > 0) && !force) {
      const reasons: string[] = []
      if (isActiveForCustomer) reasons.push(`active address for customer #${customerId ?? ''}`.trim())
      if (linkedMerchantsCount > 0) reasons.push(`${linkedMerchantsCount} merchant outlet(s)`)
      return NextResponse.json(
        { error: `Address is ${reasons.join(' and ')}. Unlink or use force=true to proceed.`, code: 'HAS_DEPENDENCIES', isActiveForCustomer, linkedMerchantsCount },
        { status: 409 }
      )
    }

    // If force and is active for customer, clear it
    if (isActiveForCustomer && force && customerId != null) {
      try {
        await payload.update({ collection: 'customers', id: customerId as number, data: { activeAddress: null } as any, overrideAccess: true, depth: 0 })
      } catch {}
    }

    let deleted: any
    try {
      deleted = await payload.delete({ collection: 'addresses', id: docId as number, overrideAccess: true })
    } catch (e: any) {
      return NextResponse.json({ error: e?.message || 'Failed to delete address' }, { status: 400 })
    }
    if (!deleted) return NextResponse.json({ error: 'Address not found' }, { status: 404 })
    return NextResponse.json({ success: true, id: deleted.id, message: 'Address deleted successfully' })
  } catch (err: any) {
    console.error('[admin/customers/addresses/[id]] DELETE error:', err)
    return NextResponse.json({ error: err?.message || 'Delete failed' }, { status: 500 })
  }
}
