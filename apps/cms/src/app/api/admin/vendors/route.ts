/**
 * @file apps/cms/src/app/api/admin/vendors/route.ts
 * @description BFF aggregation endpoint for web-admin vendors page (enterprise-grade).
 * Follows docs/BFF-pattern.md: backend owns context resolution, joins, filtering, pagination,
 * and sanitization with overrideAccess:true. Frontend is thin consumer.
 *
 * GET  /api/admin/vendors?page=1&limit=20&search=&verificationStatus=verified,pending&businessType=restaurant&isActive=true&sort=-createdAt
 *      -> { docs, pagination, stats }
 * POST /api/admin/vendors -> create vendor (and owner user if needed)
 * Access: admin-only via authenticateAdmin (JWT Bearer/JWT or payload-token cookie)
 */

import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import configPromise from '@payload-config'
import { authenticateAdmin } from '@/utils/mediaLibrary'
import { validateStoreHoursFields } from '@/utils/storeHours'
import { withAdminRequestSlot } from '@/utils/adminRequestGate'
import { getCached, setCached, deleteCachedByPrefix } from '@encreasl/cache'
import crypto from 'crypto'

function optionalString(v: unknown): string | null {
  return typeof v === 'string' ? v.trim() || null : null
}
function str(v: unknown, fallback = ''): string {
  return typeof v === 'string' ? v : fallback
}
function num(v: unknown, fallback = 0): number {
  if (typeof v === 'number' && Number.isFinite(v)) return v
  if (typeof v === 'string') { const n = Number(v); return Number.isFinite(n) ? n : fallback }
  return fallback
}
function sanitizeMediaRef(value: unknown): { id: number; url: string | null; filename: string | null } | null {
  if (!value || typeof value !== 'object') return null
  const src = value as Record<string, unknown>
  const id = Number(src.id)
  if (Number.isNaN(id)) return null
  const url = typeof src.cloudinaryURL === 'string' ? src.cloudinaryURL : (typeof src.url === 'string' ? src.url : null)
  return { id, url, filename: typeof src.filename === 'string' ? src.filename : null }
}
function sanitizeUserBrief(value: unknown): { id: number; email: string; firstName: string; lastName: string; role: string; isActive: boolean | null; phone: string | null } | null {
  if (!value || typeof value !== 'object') return null
  const u = value as Record<string, any>
  const id = Number(u.id)
  if (Number.isNaN(id)) return null
  return {
    id,
    email: str(u.email, ''),
    firstName: str(u.firstName, ''),
    lastName: str(u.lastName, ''),
    role: str(u.role, 'vendor'),
    isActive: typeof u.isActive === 'boolean' ? u.isActive : null,
    phone: optionalString(u.phone),
  }
}
function sanitizeVendorDoc(raw: Record<string, any>, merchantCountMap: Map<string, number>): Record<string, any> {
  const userVal = raw.user
  const owner = sanitizeUserBrief(userVal)
  const idStr = String(raw.id)
  const liveMerchantCount = merchantCountMap.get(idStr) ?? num(raw.totalMerchants, 0)
  return {
    id: raw.id,
    businessName: str(raw.businessName, ''),
    legalName: str(raw.legalName, ''),
    businessRegistrationNumber: str(raw.businessRegistrationNumber, ''),
    taxIdentificationNumber: optionalString(raw.taxIdentificationNumber),
    primaryContactEmail: str(raw.primaryContactEmail, ''),
    primaryContactPhone: str(raw.primaryContactPhone, ''),
    websiteUrl: optionalString(raw.websiteUrl),
    businessType: str(raw.businessType, 'other'),
    cuisineTypes: raw.cuisineTypes ?? null,
    isActive: typeof raw.isActive === 'boolean' ? raw.isActive : true,
    verificationStatus: str(raw.verificationStatus, 'pending'),
    onboardingDate: raw.onboardingDate ? String(raw.onboardingDate) : null,
    averageRating: num(raw.averageRating, 0),
    totalReviews: num(raw.totalReviews, 0),
    totalOrders: num(raw.totalOrders, 0),
    totalMerchants: liveMerchantCount,
    storedTotalMerchants: num(raw.totalMerchants, 0),
    description: optionalString(raw.description),
    operatingHours: raw.operatingHours ?? null,
    socialMediaLinks: raw.socialMediaLinks ?? null,
    logo: sanitizeMediaRef(raw.logo),
    businessLicense: sanitizeMediaRef(raw.businessLicense),
    taxCertificate: sanitizeMediaRef(raw.taxCertificate),
    owner,
    createdAt: String(raw.createdAt ?? ''),
    updatedAt: String(raw.updatedAt ?? ''),
  }
}

function parseCsv(value: string | null): string[] {
  if (!value) return []
  return value.split(',').map((s) => s.trim().toLowerCase()).filter(Boolean)
}
function badRequest(message: string, details?: unknown) {
  return NextResponse.json({ error: message, details }, { status: 400 })
}

const BUSINESS_TYPES = new Set(['restaurant','fast_food','grocery','pharmacy','convenience','bakery','coffee_shop','other'])
const VERIFICATION_STATUSES = new Set(['pending','verified','rejected','suspended'])

export async function GET(request: NextRequest) {
  return withAdminRequestSlot(async () => {
    try {
    const payload = await getPayload({ config: configPromise })
    const admin = await authenticateAdmin(payload, request)
    if (!admin) return NextResponse.json({ error: 'Unauthorized: admin authentication required' }, { status: 401 })

    const { searchParams } = new URL(request.url)
    const cacheQuery = Array.from(searchParams.entries())
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
      .join('&') || 'page=1&limit=20&sort=-createdAt'
    const cacheKey = `admin:vendors:${admin.id}:${cacheQuery}`
    const cached = await getCached<Record<string, unknown>>(cacheKey)
    if (cached) return NextResponse.json(cached, { headers: { 'X-Vendors-Cache': 'HIT' } })

    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10) || 1)
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20', 10) || 20))
    const search = searchParams.get('search')?.trim() || ''
    const sort = searchParams.get('sort') || '-createdAt'
    const verificationCsv = parseCsv(searchParams.get('verificationStatus'))
    const businessTypeCsv = parseCsv(searchParams.get('businessType'))
    const isActiveParam = searchParams.get('isActive')
    const isActiveFilter = isActiveParam === 'true' ? true : isActiveParam === 'false' ? false : null

    const where: Record<string, any> = {}
    const and: any[] = []

    if (search) {
      and.push({
        or: [
          { businessName: { contains: search } },
          { legalName: { contains: search } },
          { businessRegistrationNumber: { contains: search } },
          { primaryContactEmail: { contains: search } },
          { primaryContactPhone: { contains: search } },
          { taxIdentificationNumber: { contains: search } },
        ],
      })
    }
    if (verificationCsv.length) {
      const filtered = verificationCsv.filter((v) => VERIFICATION_STATUSES.has(v))
      if (filtered.length) where.verificationStatus = { in: filtered }
    }
    if (businessTypeCsv.length) {
      const filtered = businessTypeCsv.filter((v) => BUSINESS_TYPES.has(v))
      if (filtered.length) where.businessType = { in: filtered }
    }
    if (isActiveFilter !== null) where.isActive = { equals: isActiveFilter }

    const finalWhere = and.length ? { and: [...and, where] } : where

    // parallel: paginated list + full stats + merchant aggregation
    const [paginated, statsAll, merchantsAll] = await Promise.all([
      payload.find({
        collection: 'vendors',
        where: Object.keys(finalWhere).length ? finalWhere : undefined,
        page,
        limit,
        sort,
        depth: 2, // need user + media populated for sanitization
        overrideAccess: true,
      }),
      payload.find({
        collection: 'vendors',
        where: undefined,
        limit: 0,
        pagination: false,
        depth: 0,
        overrideAccess: true,
      }).catch(() => ({ docs: [], totalDocs: 0 } as any)).then(async () => {
        // fetch all for stats breakdown (bounded)
        const r = await payload.find({ collection: 'vendors', limit: 2000, depth: 0, overrideAccess: true, pagination: false } as any)
        return r
      }),
      payload.find({
        collection: 'merchants',
        limit: 5000,
        depth: 0,
        overrideAccess: true,
        pagination: false,
      } as any),
    ])

    const statsDocs = (statsAll as any).docs as Record<string, any>[] ?? []

    // merchant counts per vendor (real-time)
    const merchantCountMap = new Map<string, number>()
    const merchantsDocs = (merchantsAll as any).docs as Record<string, any>[] ?? []
    for (const m of merchantsDocs) {
      const rawVendor = (m as any).vendor
      const vendorId = rawVendor && typeof rawVendor === 'object' ? String((rawVendor as any).id ?? '') : String(rawVendor ?? '')
      if (!vendorId) continue
      merchantCountMap.set(vendorId, (merchantCountMap.get(vendorId) || 0) + 1)
    }

    const docs = (paginated.docs as unknown as Record<string, any>[]).map((d) => sanitizeVendorDoc(d, merchantCountMap))

    // stats aggregation
    const totalVendors = typeof paginated.totalDocs === 'number' ? paginated.totalDocs : docs.length
    const totalAll = statsDocs.length
    const verificationBreakdown: Record<string, number> = { pending: 0, verified: 0, rejected: 0, suspended: 0 }
    const businessTypeBreakdown: Record<string, number> = {}
    let activeCount = 0
    let inactiveCount = 0
    for (const v of statsDocs) {
      const vs = String(v.verificationStatus || 'pending')
      verificationBreakdown[vs] = (verificationBreakdown[vs] || 0) + 1
      const bt = String(v.businessType || 'other')
      businessTypeBreakdown[bt] = (businessTypeBreakdown[bt] || 0) + 1
      if (v.isActive) activeCount++; else inactiveCount++
    }

    const response = {
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
        totalVendors,
        totalAll,
        filteredTotal: totalVendors,
        verificationBreakdown,
        businessTypeBreakdown,
        activeCount,
        inactiveCount,
      },
      meta: { generatedAt: new Date().toISOString(), sort, search },
    }
    await setCached(cacheKey, response, 20)
    return NextResponse.json(response, { headers: { 'X-Vendors-Cache': 'MISS' } })
    } catch (err: any) {
      console.error('[admin/vendors] GET error:', err)
      return NextResponse.json({ error: err?.message || 'Failed to load vendors' }, { status: 500 })
    }
  })
}

export async function POST(request: NextRequest) {
  try {
    const payload = await getPayload({ config: configPromise })
    const admin = await authenticateAdmin(payload, request)
    if (!admin) return NextResponse.json({ error: 'Unauthorized: admin authentication required' }, { status: 401 })

    let body: Record<string, any>
    try { body = await request.json() } catch { return badRequest('Invalid JSON body') }
    try { Object.assign(body, validateStoreHoursFields(body)) } catch (error) { return badRequest(error instanceof Error ? error.message : 'Invalid store hours') }

    // Validate required fields (enterprise-grade)
    const businessName = typeof body.businessName === 'string' ? body.businessName.trim() : ''
    const legalName = typeof body.legalName === 'string' ? body.legalName.trim() : ''
    const businessRegistrationNumber = typeof body.businessRegistrationNumber === 'string' ? body.businessRegistrationNumber.trim() : ''
    const primaryContactEmail = typeof body.primaryContactEmail === 'string' ? body.primaryContactEmail.trim().toLowerCase() : ''
    const primaryContactPhone = typeof body.primaryContactPhone === 'string' ? body.primaryContactPhone.trim() : ''
    const businessTypeRaw = typeof body.businessType === 'string' ? body.businessType.trim().toLowerCase() : 'restaurant'

    if (!businessName || businessName.length < 2) return badRequest('businessName is required (min 2 chars)')
    if (!legalName || legalName.length < 2) return badRequest('legalName is required (min 2 chars)')
    if (!businessRegistrationNumber) return badRequest('businessRegistrationNumber is required')
    if (!primaryContactEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(primaryContactEmail)) return badRequest('primaryContactEmail must be a valid email')
    if (!primaryContactPhone) return badRequest('primaryContactPhone is required')
    if (!BUSINESS_TYPES.has(businessTypeRaw)) return badRequest(`businessType must be one of: ${Array.from(BUSINESS_TYPES).join(', ')}`)

    const taxIdentificationNumber = typeof body.taxIdentificationNumber === 'string' ? body.taxIdentificationNumber.trim() || null : null
    const websiteUrl = typeof body.websiteUrl === 'string' ? body.websiteUrl.trim() || null : null
    if (websiteUrl) {
      try { new URL(websiteUrl) } catch { return badRequest('websiteUrl must be a valid URL (include https://)') }
    }
    const verificationStatusRaw = typeof body.verificationStatus === 'string' ? body.verificationStatus.trim().toLowerCase() : 'pending'
    const verificationStatus = VERIFICATION_STATUSES.has(verificationStatusRaw) ? verificationStatusRaw : 'pending'
    const isActive = typeof body.isActive === 'boolean' ? body.isActive : true
    const description = typeof body.description === 'string' ? body.description.trim() || null : null
    const cuisineTypes = body.cuisineTypes ?? null // json passthrough

    // === BUSINESS METRICS (pass through if provided, else default via collection) ===
    const clampNum = (v: unknown, min: number, max?: number, fallback = 0): number => {
      const n = num(v, fallback)
      if (Number.isNaN(n)) return fallback
      if (min !== undefined && n < min) return min
      if (max !== undefined && n > max) return max
      return n
    }
    const averageRating = clampNum(body.averageRating, 0, 5, 0)
    const totalReviews = clampNum(body.totalReviews, 0, undefined, 0)
    const totalOrders = clampNum(body.totalOrders, 0, undefined, 0)
    const totalMerchants = clampNum(body.totalMerchants, 0, undefined, 0)

    // === OPERATING HOURS (json passthrough; validated as object|null) ===
    let operatingHours: unknown = body.operatingHours ?? null
    if (operatingHours !== null && (typeof operatingHours !== 'object' || Array.isArray(operatingHours))) operatingHours = null

    // Owner user resolution
    let ownerUserId: number | null = null
    if (body.userId) {
      const uid = Number(body.userId)
      if (Number.isNaN(uid)) return badRequest('userId must be numeric')
      try {
        const u = await payload.findByID({ collection: 'users', id: uid, depth: 0, overrideAccess: true }) as any
        if (!u || u.role !== 'vendor') return badRequest('userId must reference a vendor user')
        ownerUserId = uid
      } catch { return badRequest('userId not found') }
    } else if (body.ownerUserId) {
      const uid = Number(body.ownerUserId)
      if (!Number.isNaN(uid)) {
        try {
          const u = await payload.findByID({ collection: 'users', id: uid, depth: 0, overrideAccess: true }) as any
          if (u && u.role === 'vendor') ownerUserId = uid
        } catch {}
      }
    }

    // If no owner user, create one from owner fields or primary contact
    if (!ownerUserId) {
      const ownerEmailRaw = typeof body.ownerEmail === 'string' ? body.ownerEmail.trim().toLowerCase() : primaryContactEmail
      const ownerEmail = ownerEmailRaw || primaryContactEmail
      if (!ownerEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(ownerEmail)) return badRequest('ownerEmail (or primaryContactEmail) must be valid to create vendor owner account')

      // Check existing user with that email
      const existing = await payload.find({ collection: 'users', where: { email: { equals: ownerEmail } }, limit: 1, depth: 0, overrideAccess: true })
      if (existing.docs.length) {
        const eu = existing.docs[0] as any
        if (eu.role !== 'vendor') return badRequest(`Email ${ownerEmail} already belongs to a ${eu.role} account`)
        ownerUserId = eu.id
      } else {
        // Create vendor user
        const firstName = typeof body.ownerFirstName === 'string' && body.ownerFirstName.trim() ? body.ownerFirstName.trim() : businessName.split(' ')[0] || 'Vendor'
        const lastName = typeof body.ownerLastName === 'string' && body.ownerLastName.trim() ? body.ownerLastName.trim() : 'Owner'
        // Require at least temp password or generate
        let tempPassword = typeof body.ownerPassword === 'string' ? body.ownerPassword : ''
        if (!tempPassword) tempPassword = crypto.randomBytes(12).toString('base64url') + 'A1!'
        if (tempPassword.length < 8) return badRequest('ownerPassword must be at least 8 characters (or omit to auto-generate)')
        // minimal policy: check strength if provided explicitly
        try {
          const created = await payload.create({
            collection: 'users',
            data: {
              email: ownerEmail,
              password: tempPassword,
              firstName,
              lastName,
              role: 'vendor',
              isActive: true,
            },
            overrideAccess: true,
          }) as any
          ownerUserId = created.id
        } catch (e: any) {
          const msg = e?.message || 'Failed to create vendor owner user'
          // surface duplicate email more clearly
          if (String(msg).toLowerCase().includes('email') && String(msg).toLowerCase().includes('unique')) {
            return NextResponse.json({ error: 'Email already in use', details: msg }, { status: 409 })
          }
          return NextResponse.json({ error: msg, details: e?.data }, { status: 400 })
        }
      }
    }

    if (!ownerUserId) return badRequest('Unable to resolve vendor owner user')

    // Build vendor data
    const vendorData: Record<string, any> = {
      user: ownerUserId,
      businessName,
      legalName,
      businessRegistrationNumber,
      taxIdentificationNumber,
      primaryContactEmail,
      primaryContactPhone,
      websiteUrl,
      businessType: businessTypeRaw,
      cuisineTypes: Array.isArray(cuisineTypes) ? cuisineTypes : (cuisineTypes ?? null),
      isActive,
      verificationStatus,
      description,
      operatingHours,
      socialMediaLinks: body.socialMediaLinks ?? null,
      onboardingDate: body.onboardingDate ? new Date(String(body.onboardingDate)).toISOString() : new Date().toISOString(),
      averageRating,
      totalReviews,
      totalOrders,
      totalMerchants,
    }

    // Optional media ids
    if (body.logo != null && body.logo !== '') vendorData.logo = Number(body.logo)
    if (body.businessLicense != null && body.businessLicense !== '') vendorData.businessLicense = Number(body.businessLicense)
    if (body.taxCertificate != null && body.taxCertificate !== '') vendorData.taxCertificate = Number(body.taxCertificate)

    let created: Record<string, any>
    try {
      created = await payload.create({ collection: 'vendors', data: vendorData as any, depth: 2, overrideAccess: true }) as unknown as Record<string, any>
    } catch (e: any) {
      const msg = e?.message || 'Failed to create vendor'
      const lower = String(msg).toLowerCase()
      if (lower.includes('unique') || lower.includes('already exists') || lower.includes('duplicate')) {
        const field = lower.includes('businessregistrationnumber') ? 'businessRegistrationNumber' : lower.includes('taxidentification') ? 'taxIdentificationNumber' : 'businessRegistrationNumber'
        return NextResponse.json({ error: `Duplicate ${field}: already exists`, details: msg }, { status: 409 })
      }
      return NextResponse.json({ error: msg, details: e?.data || e?.errors }, { status: 400 })
    }

    const merchantCountMap = new Map<string, number>()
    // compute merchant count for new vendor (0)
    const sanitized = sanitizeVendorDoc(created, merchantCountMap)
    // Bust list cache (all admins / query variants) so the new vendor shows immediately
    await deleteCachedByPrefix('admin:vendors:')
    return NextResponse.json({ success: true, message: 'Vendor created successfully', doc: sanitized }, { status: 201 })
  } catch (err: any) {
    console.error('[admin/vendors] POST error:', err)
    return NextResponse.json({ error: err?.message || 'Internal Server Error' }, { status: 500 })
  }
}
