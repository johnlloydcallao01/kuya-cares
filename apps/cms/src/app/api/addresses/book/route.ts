import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import configPromise from '@payload-config'

const ALLOWED_TYPES = ['home', 'work', 'partner', 'billing', 'shipping', 'pickup', 'delivery']

function relId(v: unknown): string | null {
  if (v == null) return null
  if (typeof v === 'string' || typeof v === 'number') return String(v)
  if (typeof v === 'object' && v !== null && 'id' in (v as any)) return String((v as any).id)
  return null
}

function mapAddress(d: any, activeId: string | null) {
  return {
    id: d.id,
    formattedAddress: d.formatted_address,
    street: d.street,
    floorUnitRoom: d.floor_unit_room,
    deliveryInstructions: d.delivery_instructions,
    label: d.label,
    addressType: d.address_type,
    barangay: d.barangay,
    locality: d.locality,
    province: d.administrative_area_level_1,
    postalCode: d.postal_code,
    country: d.country,
    latitude: d.latitude,
    longitude: d.longitude,
    isDefault: !!d.is_default,
    isVerified: !!d.is_verified,
    isActive: activeId != null && String(d.id) === String(activeId),
    createdAt: d.createdAt,
    updatedAt: d.updatedAt,
  }
}

async function resolveCustomer(payload: any, userId: string) {
  const numericUser = Number(userId)
  const { docs } = await payload.find({
    collection: 'customers',
    where: { user: { equals: Number.isFinite(numericUser) ? numericUser : userId } },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })
  if (docs[0]) return docs[0]
  try {
    return await payload.create({
      collection: 'customers',
      data: { user: Number.isFinite(numericUser) ? numericUser : (userId as any) },
      overrideAccess: true,
    })
  } catch {
    return null
  }
}

/**
 * GET /api/addresses/book?userId=&q=&type=&page=&limit=
 *
 * Backend aggregation endpoint for the /addresses page (BFF pattern).
 * Owns user -> customer resolution (auto-provisions), address list with
 * active flag, and book stats. Frontend calls only this for reads.
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')
    const q = (searchParams.get('q') || '').trim().toLowerCase()
    const type = searchParams.get('type')
    const page = Math.max(1, Number(searchParams.get('page') || 1))
    const limit = Math.min(100, Math.max(1, Number(searchParams.get('limit') || 50)))

    if (!userId) {
      return NextResponse.json({ error: 'userId is required' }, { status: 400 })
    }
    if (type && type !== 'all' && !ALLOWED_TYPES.includes(type)) {
      return NextResponse.json({ error: `type must be one of all,${ALLOWED_TYPES.join(',')}` }, { status: 400 })
    }

    const payload = await getPayload({ config: configPromise })
    const customer = await resolveCustomer(payload, userId)
    if (!customer) {
      return NextResponse.json({ error: 'Customer not found for user', code: 'NO_CUSTOMER' }, { status: 404 })
    }

    const and: any[] = [{ user: { equals: customer.user } }]
    if (type && type !== 'all') and.push({ address_type: { equals: type } })

    const res = await payload.find({
      collection: 'addresses',
      where: { and },
      sort: '-createdAt',
      page,
      limit,
      depth: 0,
      overrideAccess: true,
    })

    const activeId = relId((customer as any).activeAddress)
    let docs = (res.docs || []).map((d: any) => mapAddress(d, activeId))
    if (q) {
      docs = docs.filter((d: any) =>
        `${d.formattedAddress || ''} ${d.street || ''} ${d.label || ''} ${d.locality || ''} ${d.barangay || ''}`
          .toLowerCase()
          .includes(q),
      )
    }
    // Active-first (Foodpanda/Shopee convention).
    docs.sort((a: any, b: any) => Number(b.isActive) - Number(a.isActive))

    // Book-wide stats (§docs/performance.md §4b item 5): home/work/verified
    // used to filter the CURRENT PAGE slice, going wrong past page one or
    // under a type filter. Scoped counts keep them exact for the whole book.
    const statsWhere = (extra: any) =>
      payload.count({
        collection: 'addresses',
        where: { and: [{ user: { equals: customer.user } }, extra] },
        overrideAccess: true,
      })
    const [homeCount, workCount, verifiedCount] = await Promise.all([
      statsWhere({ address_type: { equals: 'home' } }),
      statsWhere({ address_type: { equals: 'work' } }),
      statsWhere({ is_verified: { equals: true } }),
    ])
    return NextResponse.json({
      data: {
        customerId: customer.id,
        activeAddressId: activeId,
        activeAddress: activeId ? docs.find((d: any) => d.isActive) ?? null : null,
        addresses: docs,
        pagination: {
          page: res.page,
          limit: res.limit,
          totalDocs: res.totalDocs,
          totalPages: res.totalPages,
          hasNextPage: res.hasNextPage,
          hasPrevPage: res.hasPrevPage,
        },
        stats: {
          total: res.totalDocs ?? docs.length,
          home: homeCount?.totalDocs ?? 0,
          work: workCount?.totalDocs ?? 0,
          verified: verifiedCount?.totalDocs ?? 0,
        },
      },
    })
  } catch (err: any) {
    console.error('[addresses/book] Error:', err)
    return NextResponse.json({ error: err?.message || 'Internal Server Error' }, { status: 500 })
  }
}

const CREATE_FIELDS = [
  'formatted_address',
  'google_place_id',
  'latitude',
  'longitude',
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
  'address_type',
  'is_default',
] as const

/**
 * POST /api/addresses/book { userId, setActive?, ...address fields }
 * Creates an address owned by the user's account. Enforces single
 * is_default server-side and can set it active in the same call.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}))
    const { userId, setActive, ...input } = body as Record<string, any>
    if (!userId) {
      return NextResponse.json({ error: 'userId is required' }, { status: 400 })
    }
    const formatted = String(input.formatted_address || '').trim()
    if (formatted.length < 5) {
      return NextResponse.json({ error: 'formatted_address must be at least 5 characters' }, { status: 400 })
    }
    if (input.address_type && !ALLOWED_TYPES.includes(input.address_type)) {
      return NextResponse.json({ error: `address_type must be one of ${ALLOWED_TYPES.join(',')}` }, { status: 400 })
    }

    const payload = await getPayload({ config: configPromise })
    const customer = await resolveCustomer(payload, String(userId))
    if (!customer) {
      return NextResponse.json({ error: 'Customer not found for user', code: 'NO_CUSTOMER' }, { status: 404 })
    }
    const ownerUserId = relId((customer as any).user)

    const data: Record<string, any> = { user: Number(ownerUserId) || ownerUserId }
    for (const f of CREATE_FIELDS) {
      if (input[f] !== undefined && input[f] !== '') data[f] = input[f]
    }
    if (!data.country) data.country = 'Philippines'
    if (!data.address_type) data.address_type = 'home'

    // Single-default enforcement (moved server-side from mobile clients).
    if (data.is_default) {
      await payload.update({
        collection: 'addresses',
        where: { and: [{ user: { equals: data.user } }, { is_default: { equals: true } }] },
        data: { is_default: false },
        overrideAccess: true,
      })
    }

    const created = await payload.create({ collection: 'addresses', data: data as any, overrideAccess: true })

    let activeAddressId = relId((customer as any).activeAddress)
    if (setActive) {
      await payload.update({
        collection: 'customers',
        id: customer.id,
        data: { activeAddress: (created as any).id },
        overrideAccess: true,
      })
      activeAddressId = String((created as any).id)
    }

    return NextResponse.json(
      { data: { address: mapAddress(created, activeAddressId), activeAddressId } },
      { status: 201 },
    )
  } catch (err: any) {
    console.error('[addresses/book POST] Error:', err)
    return NextResponse.json({ error: err?.message || 'Failed to create address' }, { status: 500 })
  }
}
