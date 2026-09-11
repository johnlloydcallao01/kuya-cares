/**
 * @file apps/cms/src/app/api/admin/customers/addresses/route.ts
 * @description BFF aggregation endpoint for web-admin Customer Addresses page (enterprise-grade).
 * Follows docs/BFF-pattern.md and apps/cms/src/app/api/admin/vendors/route.ts / customers/route.ts:
 * backend owns context resolution, joins, filtering, pagination, and sanitization
 * with overrideAccess:true. Frontend is thin consumer.
 *
 * GET  /api/admin/customers/addresses?page=1&limit=10&search=&address_type=home,work&is_verified=true&is_default=false&is_active=true&verification_method=GPS_CONFIRMED&geocoding_accuracy=ROOFTOP&locality=Manila&sort=-createdAt
 *      -> { docs: [{ ...address, customer, customerActiveAddressId, customerActiveAddress, isActiveAddress }], pagination, stats: {..., activeCount, savedCount, totalActiveCustomers}, meta }
 *      Admin perspective: active current address = customers.activeAddress (not addresses.is_default).
 *      Each doc exposes isActiveAddress + customerActiveAddress so the page can show
 *      "Active current" vs "Saved" per customer. Filter with is_active=true (active only) / false (saved only).
 * POST /api/admin/customers/addresses -> create address (admin can create for any user)
 * Access: admin-only via authenticateAdmin (JWT / Bearer / payload-token cookie)
 */

import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import configPromise from '@payload-config'
import { authenticateAdmin } from '@/utils/mediaLibrary'
import { getCached, setCached } from '@encreasl/cache'

function optionalString(v: unknown): string | null {
  return typeof v === 'string' ? v.trim() || null : null
}
function str(v: unknown, fallback = ''): string {
  return typeof v === 'string' ? v : fallback
}
function num(v: unknown, fallback = 0): number {
  if (typeof v === 'number' && Number.isFinite(v)) return v
  if (typeof v === 'string') {
    const n = Number(v)
    return Number.isFinite(n) ? n : fallback
  }
  return fallback
}
function sanitizeMediaRef(value: unknown): { id: number; url: string | null; filename: string | null } | null {
  if (!value || typeof value !== 'object') return null
  const src = value as Record<string, unknown>
  const id = Number(src.id)
  if (Number.isNaN(id)) return null
  const url =
    typeof src.cloudinaryURL === 'string'
      ? src.cloudinaryURL
      : typeof src.url === 'string'
        ? src.url
        : null
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
  const locality = optionalString(raw.locality)
  const adminArea1 = optionalString(raw.administrative_area_level_1)
  const postal = optionalString(raw.postal_code)
  // short address: barangay + locality + admin + postal
  const shortAddress =
    [optionalString(raw.barangay), locality, adminArea1, postal].filter(Boolean).join(', ') ||
    String(raw.formatted_address || '').slice(0, 80)
  return {
    id: raw.id,
    user: userBrief,
    formatted_address: str(raw.formatted_address, ''),
    shortAddress,
    google_place_id: optionalString(raw.google_place_id),
    street_number: optionalString(raw.street_number),
    route: optionalString(raw.route),
    subpremise: optionalString(raw.subpremise),
    street: optionalString(raw.street),
    floor_unit_room: optionalString(raw.floor_unit_room),
    delivery_instructions: optionalString(raw.delivery_instructions),
    label: optionalString(raw.label),
    barangay: optionalString(raw.barangay),
    locality,
    administrative_area_level_2: optionalString(raw.administrative_area_level_2),
    administrative_area_level_1: adminArea1,
    country: optionalString(raw.country) || 'Philippines',
    postal_code: postal,
    latitude: typeof raw.latitude === 'number' ? raw.latitude : raw.latitude != null ? num(raw.latitude, NaN) : null,
    longitude: typeof raw.longitude === 'number' ? raw.longitude : raw.longitude != null ? num(raw.longitude, NaN) : null,
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

function parseCsv(value: string | null): string[] {
  if (!value) return []
  return value
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean)
}
function sanitizeAddressBrief(value: unknown): Record<string, any> | null {
  if (!value || typeof value !== 'object') return null
  const a = value as Record<string, any>
  const id = Number(a.id)
  if (Number.isNaN(id)) return null
  return {
    id,
    formatted_address: str(a.formatted_address, ''),
    shortAddress:
      [optionalString(a.barangay), optionalString(a.locality), optionalString(a.administrative_area_level_1), optionalString(a.postal_code)]
        .filter(Boolean)
        .join(', ') || String(a.formatted_address || '').slice(0, 80),
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
function badRequest(message: string, details?: unknown) {
  return NextResponse.json({ error: message, details }, { status: 400 })
}

const ADDRESS_TYPES = new Set(['home', 'work', 'partner', 'billing', 'shipping', 'pickup', 'delivery'])
const VERIFICATION_METHODS = new Set(['GPS_CONFIRMED', 'DELIVERY_CONFIRMED', 'USER_CONFIRMED', 'UNVERIFIED'])
const GEOCODING_ACCURACIES = new Set(['ROOFTOP', 'RANGE_INTERPOLATED', 'GEOMETRIC_CENTER', 'APPROXIMATE'])
const COORDINATE_SOURCES = new Set(['GPS', 'GOOGLE_GEOCODING', 'MANUAL', 'ESTIMATED'])

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
      .join('&') || 'page=1&limit=20'
    const cacheKey = `admin:customer-addresses:${admin.id}:${cacheQuery}`
    const cached = await getCached<Record<string, unknown>>(cacheKey)
    if (cached) return NextResponse.json(cached, { headers: { 'X-CustomerAddresses-Cache': 'HIT' } })

    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10) || 1)
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '10', 10) || 10))
    const search = searchParams.get('search')?.trim() || ''
    const sort = searchParams.get('sort') || '-createdAt'
    const addressTypeCsv = parseCsv(searchParams.get('address_type') || searchParams.get('addressType'))
    const verificationMethodCsv = parseCsv((searchParams.get('verification_method') || searchParams.get('verificationMethod') || '').toUpperCase().toLowerCase()) // normalize then compare uppercase set via lower
    // actually need upper for verification methods, parse separately
    const verificationMethodRaw = searchParams.get('verification_method') || searchParams.get('verificationMethod')
    const verificationMethods = verificationMethodRaw ? verificationMethodRaw.split(',').map((s) => s.trim().toUpperCase()).filter(Boolean) : []
    const geocodingCsv = searchParams.get('geocoding_accuracy') || searchParams.get('geocodingAccuracy')
    const geocodingMethods = geocodingCsv ? geocodingCsv.split(',').map((s) => s.trim().toUpperCase()).filter(Boolean) : []
    const coordinateSourceRaw = searchParams.get('coordinate_source') || searchParams.get('coordinateSource')
    const coordinateSources = coordinateSourceRaw ? coordinateSourceRaw.split(',').map((s) => s.trim().toUpperCase()).filter(Boolean) : []
    const isVerifiedParam = searchParams.get('is_verified') ?? searchParams.get('isVerified')
    const isVerifiedFilter = isVerifiedParam === 'true' ? true : isVerifiedParam === 'false' ? false : null
    const isDefaultParam = searchParams.get('is_default') ?? searchParams.get('isDefault')
    const isDefaultFilter = isDefaultParam === 'true' ? true : isDefaultParam === 'false' ? false : null
    const localityFilter = searchParams.get('locality')?.trim() || ''
    const provinceFilter = searchParams.get('province')?.trim() || searchParams.get('administrative_area_level_1')?.trim() || ''
    const postalFilter = searchParams.get('postal_code')?.trim() || searchParams.get('postalCode')?.trim() || ''
    const userIdFilter = searchParams.get('userId')?.trim() || searchParams.get('user')?.trim() || ''
    const customerIdFilter = searchParams.get('customerId')?.trim() || ''
    const isActiveParam = searchParams.get('is_active') ?? searchParams.get('isActive')
    const isActiveFilter = isActiveParam === 'true' ? true : isActiveParam === 'false' ? false : null

    // ── Admin perspective: active current address lives on customers.activeAddress,
    // not on addresses.is_default. Resolve all customers once (overrideAccess) so we can
    // (a) filter by active-vs-saved via addresses.id, (b) enrich each row with its
    // customer's current active address. This keeps the frontend thin per docs/BFF-pattern.md.
    const customersForActive = await payload
      .find({ collection: 'customers', limit: 5000, depth: 0, overrideAccess: true, pagination: false } as any)
      .catch(() => ({ docs: [] }) as any)
    const activeIdSet = new Set<number>()
    const activeByUserId = new Map<number, number>()
    const customerByUserId = new Map<number, Record<string, any>>()
    for (const c of ((customersForActive as any).docs as Record<string, any>[] ?? [])) {
      const rawUser = (c as any).user
      const uid = rawUser && typeof rawUser === 'object' ? Number((rawUser as any).id) : Number(rawUser)
      if (!Number.isFinite(uid)) continue
      customerByUserId.set(uid, c as Record<string, any>)
      const rawActive = (c as any).activeAddress
      const aid = rawActive && typeof rawActive === 'object' ? Number((rawActive as any).id) : Number(rawActive)
      if (Number.isFinite(aid) && aid > 0) {
        activeIdSet.add(aid)
        activeByUserId.set(uid, aid)
      }
    }

    const where: Record<string, any> = {}
    const and: any[] = []

    // address_type filter
    if (addressTypeCsv.length) {
      const filtered = addressTypeCsv.filter((v) => ADDRESS_TYPES.has(v))
      if (filtered.length) where.address_type = { in: filtered }
    }
    if (verificationMethods.length) {
      const filtered = verificationMethods.filter((v) => VERIFICATION_METHODS.has(v))
      if (filtered.length) where.verification_method = { in: filtered }
    }
    if (geocodingMethods.length) {
      const filtered = geocodingMethods.filter((v) => GEOCODING_ACCURACIES.has(v))
      if (filtered.length) where.geocoding_accuracy = { in: filtered }
    }
    if (coordinateSources.length) {
      const filtered = coordinateSources.filter((v) => COORDINATE_SOURCES.has(v))
      if (filtered.length) where.coordinate_source = { in: filtered }
    }
    if (isVerifiedFilter !== null) where.is_verified = { equals: isVerifiedFilter }
    if (isDefaultFilter !== null) where.is_default = { equals: isDefaultFilter }
    if (localityFilter) where.locality = { contains: localityFilter }
    if (provinceFilter) where.administrative_area_level_1 = { contains: provinceFilter }
    if (postalFilter) where.postal_code = { contains: postalFilter }
    if (userIdFilter) {
      const uid = Number(userIdFilter)
      if (!Number.isNaN(uid)) where.user = { equals: uid }
    }
    if (customerIdFilter) {
      // customerId -> resolve user id via customers collection
      const cid = Number(customerIdFilter)
      if (!Number.isNaN(cid)) {
        try {
          const cust = await payload.findByID({ collection: 'customers', id: cid, depth: 0, overrideAccess: true }) as any
          const uid = cust?.user
          const uidNum = typeof uid === 'object' && uid !== null ? Number((uid as any).id) : Number(uid)
          if (Number.isFinite(uidNum)) where.user = { equals: uidNum }
        } catch {}
      }
    }

    // Search: join across address fields + user email/name
    let userIdsForSearch: number[] | null = null
    if (search) {
      // find users matching search
      try {
        const usersRes = await payload.find({
          collection: 'users',
          where: {
            or: [
              { firstName: { contains: search } },
              { lastName: { contains: search } },
              { email: { contains: search } },
              { username: { contains: search } },
              { phone: { contains: search } },
            ],
          },
          limit: 200,
          depth: 0,
          overrideAccess: true,
          pagination: false,
        } as any)
        const ids = (usersRes.docs as any[]).map((u) => Number(u.id)).filter((n) => Number.isFinite(n))
        userIdsForSearch = ids
      } catch {
        userIdsForSearch = []
      }

      const or: any[] = [
        { formatted_address: { contains: search } },
        { locality: { contains: search } },
        { barangay: { contains: search } },
        { postal_code: { contains: search } },
        { administrative_area_level_1: { contains: search } },
        { administrative_area_level_2: { contains: search } },
        { street: { contains: search } },
        { label: { contains: search } },
        { google_place_id: { contains: search } },
        { route: { contains: search } },
        { floor_unit_room: { contains: search } },
      ]
      if (userIdsForSearch && userIdsForSearch.length > 0) {
        or.push({ user: { in: userIdsForSearch } })
      }
      and.push({ or })
    }

    // Active-vs-saved filter: active current = customers.activeAddress id set.
    if (isActiveFilter !== null) {
      const ids = Array.from(activeIdSet)
      if (isActiveFilter === true) {
        if (!ids.length) {
          return NextResponse.json({
            docs: [],
            pagination: { page, limit, totalDocs: 0, totalPages: 0, hasNextPage: false, hasPrevPage: false },
            stats: {
              totalAddresses: 0,
              totalAll: 0,
              filteredTotal: 0,
              addressTypeBreakdown: {},
              verificationMethodBreakdown: {},
              geocodingBreakdown: {},
              coordinateSourceBreakdown: {},
              localityBreakdown: {},
              topLocalities: [],
              verifiedCount: 0,
              unverifiedCount: 0,
              defaultCount: 0,
              highQualityCount: 0,
              activeCount: 0,
              savedCount: 0,
              totalActiveCustomers: activeIdSet.size,
            },
            meta: { generatedAt: new Date().toISOString(), sort, search, isActiveFilter },
          })
        }
        where.id = { in: ids }
      } else {
        if (ids.length) where.id = { not_in: ids }
      }
    }

    const finalWhere = and.length ? { and: [...and, where] } : where

    // parallel: paginated list + full stats (bounded)
    const [paginated, statsAll] = await Promise.all([
      payload.find({
        collection: 'addresses',
        where: Object.keys(finalWhere).length ? finalWhere : undefined,
        page,
        limit,
        sort,
        depth: 2,
        overrideAccess: true,
      }),
      payload
        .find({
          collection: 'addresses',
          where: undefined,
          limit: 0,
          pagination: false,
          depth: 0,
          overrideAccess: true,
        } as any)
        .catch(() => ({ docs: [], totalDocs: 0 } as any))
        .then(async () => {
          const r = await payload.find({ collection: 'addresses', limit: 2000, depth: 0, overrideAccess: true, pagination: false } as any)
          return r
        }),
    ])

    const statsDocs = (statsAll as any).docs as Record<string, any>[] ?? []
    const rawDocs = paginated.docs as unknown as Record<string, any>[] ?? []

    // Fetch active-address docs for customers on this page so each row can show
    // both its own saved data AND the customer's current active address.
    const neededActiveIds = Array.from(
      new Set(
        rawDocs
          .map((d) => {
            const u = (d as any).user
            const uid = u && typeof u === 'object' ? Number((u as any).id) : Number(u)
            return Number.isFinite(uid) ? activeByUserId.get(uid) : undefined
          })
          .filter((n): n is number => typeof n === 'number' && Number.isFinite(n)),
      ),
    )
    let activeDocMap = new Map<number, Record<string, any>>()
    if (neededActiveIds.length) {
      try {
        const activeRes = await payload.find({
          collection: 'addresses',
          where: { id: { in: neededActiveIds } },
          limit: neededActiveIds.length,
          depth: 0,
          overrideAccess: true,
          pagination: false,
        } as any)
        for (const a of ((activeRes as any).docs as Record<string, any>[] ?? [])) {
          activeDocMap.set(Number((a as any).id), a)
        }
      } catch {}
    }

    const docs = rawDocs.map((d) => {
      const base = sanitizeAddressDoc(d)
      const u = (d as any).user
      const uid = u && typeof u === 'object' ? Number((u as any).id) : Number(u)
      const cust = Number.isFinite(uid) ? customerByUserId.get(uid) : undefined
      const customerActiveAddressId = Number.isFinite(uid) ? (activeByUserId.get(uid) ?? null) : null
      const isActiveAddress = customerActiveAddressId != null && Number(base.id) === Number(customerActiveAddressId)
      const activeRaw = customerActiveAddressId != null ? activeDocMap.get(Number(customerActiveAddressId)) : undefined
      return {
        ...base,
        customer: cust
          ? {
              id: Number((cust as any).id),
              srn: typeof (cust as any).srn === 'string' ? (cust as any).srn : null,
              currentLevel: typeof (cust as any).currentLevel === 'string' ? (cust as any).currentLevel : null,
              email: typeof (cust as any).email === 'string' ? (cust as any).email : (base.user as any)?.email ?? null,
              activeAddressId: customerActiveAddressId,
            }
          : null,
        customerActiveAddressId,
        customerActiveAddress: activeRaw ? sanitizeAddressBrief(activeRaw) : null,
        isActiveAddress,
      }
    })

    // stats aggregation from statsDocs
    const totalAddresses = typeof paginated.totalDocs === 'number' ? paginated.totalDocs : docs.length
    const totalAll = statsDocs.length
    const addressTypeBreakdown: Record<string, number> = {}
    const verificationMethodBreakdown: Record<string, number> = {}
    const geocodingBreakdown: Record<string, number> = {}
    const coordinateSourceBreakdown: Record<string, number> = {}
    const localityBreakdown: Record<string, number> = {}
    let verifiedCount = 0
    let unverifiedCount = 0
    let defaultCount = 0
    let highQualityCount = 0 // score >= 80
    let activeCount = 0
    for (const a of statsDocs) {
      const at = String(a.address_type || 'home').toLowerCase()
      addressTypeBreakdown[at] = (addressTypeBreakdown[at] || 0) + 1
      const vm = String(a.verification_method || 'UNVERIFIED').toUpperCase()
      verificationMethodBreakdown[vm] = (verificationMethodBreakdown[vm] || 0) + 1
      const ga = String(a.geocoding_accuracy || 'APPROXIMATE').toUpperCase()
      geocodingBreakdown[ga] = (geocodingBreakdown[ga] || 0) + 1
      const cs = String(a.coordinate_source || 'GOOGLE_GEOCODING').toUpperCase()
      coordinateSourceBreakdown[cs] = (coordinateSourceBreakdown[cs] || 0) + 1
      const loc = String(a.locality || 'Unknown')
      localityBreakdown[loc] = (localityBreakdown[loc] || 0) + 1
      if (a.is_verified) verifiedCount++
      else unverifiedCount++
      if (a.is_default) defaultCount++
      if (activeIdSet.has(Number((a as any).id))) activeCount++
      if (typeof a.address_quality_score === 'number' && a.address_quality_score >= 80) highQualityCount++
    }

    // top localities sorted
    const topLocalities = Object.entries(localityBreakdown)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name, count]) => ({ name, count }))

    const responseBody = {
      docs,
      pagination: {
        page: paginated.page,
        limit: paginated.limit,
        totalDocs: paginated.totalDocs,
        totalPages: paginated.totalPages,
        hasNextPage: paginated.hasNextPage,
        hasPrevPage: paginated.hasPrevPage,
      },
      stats: {
        totalAddresses,
        totalAll,
        filteredTotal: totalAddresses,
        addressTypeBreakdown,
        verificationMethodBreakdown,
        geocodingBreakdown,
        coordinateSourceBreakdown,
        localityBreakdown,
        topLocalities,
        verifiedCount,
        unverifiedCount,
        defaultCount,
        highQualityCount,
        activeCount,
        savedCount: Math.max(0, totalAll - activeCount),
        totalActiveCustomers: activeIdSet.size,
      },
      meta: { generatedAt: new Date().toISOString(), sort, search, isActiveFilter },
    }
    await setCached(cacheKey, responseBody, 20)
    return NextResponse.json(responseBody, { headers: { 'X-CustomerAddresses-Cache': 'MISS' } })
  } catch (err: any) {
    console.error('[admin/customers/addresses] GET error:', err)
    return NextResponse.json({ error: err?.message || 'Failed to load addresses' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const payload = await getPayload({ config: configPromise })
    const admin = await authenticateAdmin(payload, request)
    if (!admin) return NextResponse.json({ error: 'Unauthorized: admin authentication required' }, { status: 401 })

    let body: Record<string, any>
    try {
      body = await request.json()
    } catch {
      return badRequest('Invalid JSON body')
    }

    // Require user and formatted_address
    const userRaw = body.user ?? body.userId
    if (userRaw == null || userRaw === '') return badRequest('user (userId) is required')
    const userId = Number(userRaw)
    if (Number.isNaN(userId)) return badRequest('user must be numeric user id')
    // verify user exists and is customer/vendor/service/admin
    try {
      const u: any = await payload.findByID({ collection: 'users', id: userId, depth: 0, overrideAccess: true })
      if (!u) return badRequest('user not found')
    } catch {
      return badRequest('user not found')
    }

    const formatted_address = typeof body.formatted_address === 'string' ? body.formatted_address.trim() : ''
    if (!formatted_address || formatted_address.length < 5) return badRequest('formatted_address is required (min 5 chars)')

    const address_typeRaw = typeof body.address_type === 'string' ? body.address_type.trim().toLowerCase() : 'home'
    const address_type = ADDRESS_TYPES.has(address_typeRaw) ? address_typeRaw : 'home'
    if (body.address_type !== undefined && !ADDRESS_TYPES.has(address_typeRaw)) {
      return badRequest(`address_type must be one of: ${Array.from(ADDRESS_TYPES).join(', ')}`)
    }

    // Validate optional enums if provided
    let verification_method: string | undefined = undefined
    if (body.verification_method !== undefined && body.verification_method !== null && body.verification_method !== '') {
      const v = String(body.verification_method).trim().toUpperCase()
      if (!VERIFICATION_METHODS.has(v)) return badRequest(`verification_method must be one of: ${Array.from(VERIFICATION_METHODS).join(', ')}`)
      verification_method = v
    }
    let geocoding_accuracy: string | undefined = undefined
    if (body.geocoding_accuracy !== undefined && body.geocoding_accuracy !== null && body.geocoding_accuracy !== '') {
      const v = String(body.geocoding_accuracy).trim().toUpperCase()
      if (!GEOCODING_ACCURACIES.has(v)) return badRequest(`geocoding_accuracy must be one of: ${Array.from(GEOCODING_ACCURACIES).join(', ')}`)
      geocoding_accuracy = v
    }
    let coordinate_source: string | undefined = undefined
    if (body.coordinate_source !== undefined && body.coordinate_source !== null && body.coordinate_source !== '') {
      const v = String(body.coordinate_source).trim().toUpperCase()
      if (!COORDINATE_SOURCES.has(v)) return badRequest(`coordinate_source must be one of: ${Array.from(COORDINATE_SOURCES).join(', ')}`)
      coordinate_source = v
    }

    const data: Record<string, any> = {
      user: userId,
      formatted_address,
      address_type,
    }

    // optional string fields
    const stringFields = [
      'google_place_id',
      'street_number',
      'route',
      'subpremise',
      'street',
      'floor_unit_room',
      'delivery_instructions',
      'label',
      'barangay',
      'locality',
      'administrative_area_level_2',
      'administrative_area_level_1',
      'country',
      'postal_code',
      'accessibility_notes',
      'landmark_description',
      'notes',
    ] as const
    for (const f of stringFields) {
      if (body[f] !== undefined) {
        data[f] = typeof body[f] === 'string' ? (body[f].trim() || null) : body[f] ?? null
      }
    }
    if (body.country === undefined && !data.country) data.country = 'Philippines'

    // numeric fields
    if (body.latitude !== undefined && body.latitude !== null && body.latitude !== '') {
      const n = Number(body.latitude)
      if (Number.isNaN(n)) return badRequest('latitude must be numeric')
      data.latitude = n
    }
    if (body.longitude !== undefined && body.longitude !== null && body.longitude !== '') {
      const n = Number(body.longitude)
      if (Number.isNaN(n)) return badRequest('longitude must be numeric')
      data.longitude = n
    }
    if (body.altitude !== undefined && body.altitude !== null && body.altitude !== '') {
      const n = Number(body.altitude)
      if (!Number.isNaN(n)) data.altitude = n
    }
    if (body.address_quality_score !== undefined && body.address_quality_score !== null && body.address_quality_score !== '') {
      const n = Number(body.address_quality_score)
      if (!Number.isNaN(n)) data.address_quality_score = Math.min(100, Math.max(1, Math.round(n)))
    }
    if (body.service_radius_meters !== undefined && body.service_radius_meters !== null && body.service_radius_meters !== '') {
      const n = Number(body.service_radius_meters)
      if (!Number.isNaN(n) && n >= 0) data.service_radius_meters = n
    }

    if (verification_method !== undefined) data.verification_method = verification_method
    if (geocoding_accuracy !== undefined) data.geocoding_accuracy = geocoding_accuracy
    if (coordinate_source !== undefined) data.coordinate_source = coordinate_source

    if (body.is_default !== undefined) data.is_default = !!body.is_default
    if (body.is_verified !== undefined) data.is_verified = !!body.is_verified
    if (body.isDefault !== undefined) data.is_default = !!body.isDefault
    if (body.isVerified !== undefined) data.is_verified = !!body.isVerified

    // default coordinate_source if not set
    if (!data.coordinate_source) data.coordinate_source = 'GOOGLE_GEOCODING'
    if (!data.verification_method) data.verification_method = 'UNVERIFIED'

    // If is_default true, unset others for same user (enterprise: only one default per user)
    if (data.is_default) {
      try {
        const existingDefaults = await payload.find({
          collection: 'addresses',
          where: { user: { equals: userId }, is_default: { equals: true } },
          limit: 100,
          depth: 0,
          overrideAccess: true,
          pagination: false,
        } as any)
        for (const d of (existingDefaults.docs as any[]) ?? []) {
          try {
            await payload.update({ collection: 'addresses', id: d.id, data: { is_default: false } as any, overrideAccess: true, depth: 0 })
          } catch {}
        }
      } catch {}
    }

    let created: Record<string, any>
    try {
      created = (await payload.create({ collection: 'addresses', data: data as any, depth: 2, overrideAccess: true })) as unknown as Record<string, any>
    } catch (e: any) {
      const msg = e?.message || 'Failed to create address'
      return NextResponse.json({ error: msg, details: e?.data || e?.errors }, { status: 400 })
    }

    const sanitized = sanitizeAddressDoc(created)
    return NextResponse.json({ success: true, message: 'Address created successfully', doc: sanitized }, { status: 201 })
  } catch (err: any) {
    console.error('[admin/customers/addresses] POST error:', err)
    return NextResponse.json({ error: err?.message || 'Internal Server Error' }, { status: 500 })
  }
}
