/**
 * @file apps/cms/src/app/api/vendor/profile/route.ts
 * @description BFF aggregation endpoint for web-merchant vendor profile page.
 * Follows same BFF thin consumer pattern as apps/cms/src/app/api/admin/profile/route.ts
 * but scoped to vendor role with business identity join.
 *
 * GET  /api/vendor/profile?userId=123  -> aggregated profile (user + vendor + merchants summary + activities)
 * PATCH /api/vendor/profile            -> update personal profile fields (users collection)
 * Auth: vendor JWT via Authorization: JWT <token> or payload-token cookie (authenticateVendor)
 */

import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import configPromise from '@payload-config'
import { authenticateVendor } from '@/utils/mediaLibrary'

function optionalString(v: unknown): string | null {
  return typeof v === 'string' ? v : null
}

function sanitizeProfilePicture(value: unknown): Record<string, any> | null {
  if (!value || typeof value !== 'object') return null
  const src = value as Record<string, unknown>
  const id = Number(src.id)
  const url = optionalString(src.cloudinaryURL) || optionalString(src.url)
  if (!url || Number.isNaN(id)) return null
  return {
    id,
    filename: optionalString(src.filename) || '',
    url,
    alt: optionalString(src.alt) || null,
    cloudinaryPublicId: optionalString(src.cloudinaryPublicId) || null,
  }
}

function sanitizeMediaRef(value: unknown): Record<string, any> | null {
  if (!value || typeof value !== 'object') return null
  const src = value as Record<string, unknown>
  const id = Number(src.id)
  const url = optionalString(src.cloudinaryURL) || optionalString(src.url)
  if (Number.isNaN(id)) return null
  return {
    id,
    filename: optionalString(src.filename) || '',
    url: url || null,
    alt: optionalString(src.alt) || null,
    cloudinaryPublicId: optionalString(src.cloudinaryPublicId) || null,
  }
}

function sanitizeUserForResponse(raw: Record<string, any>): Record<string, any> {
  const profilePicture = sanitizeProfilePicture(raw.profilePicture)
  return {
    id: raw.id,
    email: optionalString(raw.email) || '',
    firstName: optionalString(raw.firstName) || '',
    lastName: optionalString(raw.lastName) || '',
    middleName: optionalString(raw.middleName),
    nameExtension: optionalString(raw.nameExtension),
    username: optionalString(raw.username),
    role: raw.role || null,
    isActive: typeof raw.isActive === 'boolean' ? raw.isActive : null,
    gender: optionalString(raw.gender),
    civilStatus: optionalString(raw.civilStatus),
    nationality: optionalString(raw.nationality),
    birthDate: optionalString(raw.birthDate),
    placeOfBirth: optionalString(raw.placeOfBirth),
    completeAddress: optionalString(raw.completeAddress),
    phone: optionalString(raw.phone),
    lastLogin: optionalString(raw.lastLogin),
    profilePicture,
    createdAt: optionalString(raw.createdAt) || '',
    updatedAt: optionalString(raw.updatedAt) || '',
    loginAttempts: typeof raw.loginAttempts === 'number' ? raw.loginAttempts : null,
    lockUntil: optionalString(raw.lockUntil),
    sessions: Array.isArray(raw.sessions) ? raw.sessions : null,
  }
}

function sanitizeVendorForResponse(raw: Record<string, any> | null): Record<string, any> | null {
  if (!raw) return null
  return {
    id: raw.id,
    businessName: optionalString(raw.businessName) || '',
    legalName: optionalString(raw.legalName) || '',
    businessRegistrationNumber: optionalString(raw.businessRegistrationNumber) || null,
    taxIdentificationNumber: optionalString(raw.taxIdentificationNumber) || null,
    primaryContactEmail: optionalString(raw.primaryContactEmail) || '',
    primaryContactPhone: optionalString(raw.primaryContactPhone) || '',
    websiteUrl: optionalString(raw.websiteUrl),
    businessType: optionalString(raw.businessType) || null,
    cuisineTypes: raw.cuisineTypes ?? null,
    isActive: typeof raw.isActive === 'boolean' ? raw.isActive : null,
    verificationStatus: optionalString(raw.verificationStatus) || 'pending',
    onboardingDate: optionalString(raw.onboardingDate),
    averageRating: typeof raw.averageRating === 'number' ? raw.averageRating : 0,
    totalReviews: typeof raw.totalReviews === 'number' ? raw.totalReviews : 0,
    totalOrders: typeof raw.totalOrders === 'number' ? raw.totalOrders : 0,
    totalMerchants: typeof raw.totalMerchants === 'number' ? raw.totalMerchants : 0,
    description: optionalString(raw.description),
    operatingHours: raw.operatingHours ?? null,
    socialMediaLinks: raw.socialMediaLinks ?? null,
    businessLicense: sanitizeMediaRef(raw.businessLicense),
    taxCertificate: sanitizeMediaRef(raw.taxCertificate),
    logo: sanitizeMediaRef(raw.logo),
    createdAt: optionalString(raw.createdAt) || '',
    updatedAt: optionalString(raw.updatedAt) || '',
  }
}

function sanitizeMerchants(docs: Record<string, any>[]): Record<string, any>[] {
  return docs.map((m) => ({
    id: m.id,
    outletName: optionalString(m.outletName) || `Outlet #${m.id}`,
    outletSlug: optionalString(m.outletSlug) || null,
    operationalStatus: optionalString(m.operationalStatus) || 'closed',
    isActive: typeof m.isActive === 'boolean' ? m.isActive : null,
    isAcceptingOrders: typeof m.isAcceptingOrders === 'boolean' ? m.isAcceptingOrders : null,
    averageRating: typeof m.averageRating === 'number' ? m.averageRating : 0,
    totalReviews: typeof m.totalReviews === 'number' ? m.totalReviews : 0,
    createdAt: optionalString(m.createdAt) || '',
    updatedAt: optionalString(m.updatedAt) || '',
  }))
}

function badRequest(message: string, details?: unknown) {
  return NextResponse.json({ error: message, details }, { status: 400 })
}

export async function GET(request: NextRequest) {
  try {
    const payload = await getPayload({ config: configPromise })
    const authUser = await authenticateVendor(payload, request)
    if (!authUser) {
      return NextResponse.json({ error: 'Unauthorized: vendor authentication required' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const rawUserId = searchParams.get('userId') || String(authUser.id)
    const userIdNum = Number(rawUserId)
    if (!rawUserId || Number.isNaN(userIdNum)) {
      return badRequest('userId is required and must be numeric')
    }

    // Vendor can only fetch own profile (no cross-user admin privilege like system admin)
    if (String(authUser.id) !== String(userIdNum)) {
      return NextResponse.json({ error: 'Forbidden: can only fetch own profile' }, { status: 403 })
    }

    // 1. Resolve user
    let userDoc: Record<string, any>
    try {
      userDoc = (await payload.findByID({
        collection: 'users',
        id: userIdNum,
        depth: 2,
        overrideAccess: true,
      })) as unknown as Record<string, any>
    } catch (e: any) {
      return NextResponse.json({ error: 'User not found', details: e?.message }, { status: 404 })
    }

    if (!userDoc || userDoc.role !== 'vendor') {
      return NextResponse.json({ error: 'User not found or not vendor' }, { status: 404 })
    }

    // 2. Resolve vendor business record
    let vendorDoc: Record<string, any> | null = null
    try {
      const vendorRes = await payload.find({
        collection: 'vendors',
        where: { user: { equals: userIdNum } },
        limit: 1,
        depth: 2,
        overrideAccess: true,
      })
      vendorDoc = (vendorRes.docs[0] as Record<string, any>) || null
    } catch {
      vendorDoc = null
    }

    // 3. Resolve merchants summary (outlets belonging to this vendor)
    let merchants: Record<string, any>[] = []
    let merchantsCount = 0
    if (vendorDoc?.id) {
      try {
        const mRes = await payload.find({
          collection: 'merchants',
          where: { vendor: { equals: vendorDoc.id } },
          limit: 50,
          depth: 0,
          sort: '-createdAt',
          overrideAccess: true,
        })
        merchants = mRes.docs as unknown as Record<string, any>[]
        merchantsCount = typeof mRes.totalDocs === 'number' ? mRes.totalDocs : merchants.length
      } catch {
        merchants = []
      }
    }

    // 4. Recent activities
    let activities: Record<string, any>[] = []
    try {
      const actRes = await payload.find({
        collection: 'user-events',
        where: { user: { equals: userIdNum } },
        sort: '-timestamp',
        limit: 8,
        depth: 0,
        overrideAccess: true,
      })
      activities = actRes.docs as unknown as Record<string, any>[]
    } catch {
      activities = []
    }

    const user = sanitizeUserForResponse(userDoc)
    const raw = sanitizeUserForResponse(userDoc)
    const vendor = sanitizeVendorForResponse(vendorDoc)
    const sanitizedMerchants = sanitizeMerchants(merchants)
    const sanitizedActivities = activities.map((a) => ({
      id: a.id,
      eventType: a.eventType || 'UNKNOWN',
      eventData: a.eventData ?? null,
      timestamp: a.timestamp || null,
      createdAt: a.createdAt || null,
      ipAddress: a.ipAddress || null,
      userAgent: a.userAgent || null,
    }))

    return NextResponse.json({
      user,
      raw,
      vendor,
      merchants: sanitizedMerchants,
      merchantsCount,
      activities: sanitizedActivities,
    })
  } catch (err: any) {
    console.error('[vendor/profile] GET error:', err)
    return NextResponse.json({ error: err?.message || 'Internal Server Error' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const payload = await getPayload({ config: configPromise })
    const authUser = await authenticateVendor(payload, request)
    if (!authUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    let body: Record<string, any>
    try {
      body = await request.json()
    } catch {
      return badRequest('Invalid JSON body')
    }

    const rawUserId = body.userId ? String(body.userId) : String(authUser.id)
    const userIdNum = Number(rawUserId)
    if (Number.isNaN(userIdNum)) return badRequest('userId must be numeric')

    if (String(authUser.id) !== String(userIdNum)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Validate required fields
    const firstName = typeof body.firstName === 'string' ? body.firstName.trim() : ''
    const lastName = typeof body.lastName === 'string' ? body.lastName.trim() : ''
    if (!firstName || firstName.length < 2) return badRequest('firstName must be at least 2 characters')
    if (!lastName || lastName.length < 2) return badRequest('lastName must be at least 2 characters')

    const patch: Record<string, any> = {
      firstName,
      lastName,
      middleName: typeof body.middleName === 'string' ? body.middleName.trim() || null : null,
      nameExtension: typeof body.nameExtension === 'string' ? body.nameExtension.trim() || null : null,
      username: typeof body.username === 'string' ? body.username.trim() || null : null,
      phone: typeof body.phone === 'string' ? body.phone.trim() || null : null,
      gender: typeof body.gender === 'string' ? body.gender || null : null,
      civilStatus: typeof body.civilStatus === 'string' ? body.civilStatus || null : null,
      nationality: typeof body.nationality === 'string' ? body.nationality.trim() || null : null,
      placeOfBirth: typeof body.placeOfBirth === 'string' ? body.placeOfBirth.trim() || null : null,
      completeAddress: typeof body.completeAddress === 'string' ? body.completeAddress.trim() || null : null,
    }

    if (body.birthDate) {
      const d = new Date(String(body.birthDate))
      patch.birthDate = isNaN(d.getTime()) ? null : d.toISOString()
    } else {
      patch.birthDate = null
    }

    if (typeof body.email === 'string' && body.email.trim()) {
      const email = body.email.trim().toLowerCase()
      const ok = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
      if (!ok) return badRequest('Invalid email')
      const current = (await payload.findByID({ collection: 'users', id: userIdNum, depth: 0, overrideAccess: true })) as any
      if (email !== current.email) patch.email = email
    }

    if (patch.username === '') patch.username = null
    if (typeof body.username === 'string' && body.username.trim().length > 0) {
      const u = body.username.trim()
      if (u.length < 3 || u.length > 30) return badRequest('username must be 3-30 characters')
      if (!/^[a-zA-Z0-9._-]+$/.test(u)) return badRequest('username may only contain letters, numbers, dots, dashes and underscores')
    }

    let updated: Record<string, any>
    try {
      updated = (await payload.update({
        collection: 'users',
        id: userIdNum,
        data: patch,
        depth: 2,
        overrideAccess: true,
      })) as unknown as Record<string, any>
    } catch (e: any) {
      const msg = e?.message || 'Failed to update profile'
      const details = e?.data || e?.errors
      return NextResponse.json({ error: msg, details }, { status: 400 })
    }

    const user = sanitizeUserForResponse(updated)
    return NextResponse.json({ success: true, message: 'Profile updated successfully', user })
  } catch (err: any) {
    console.error('[vendor/profile] PATCH error:', err)
    return NextResponse.json({ error: err?.message || 'Internal Server Error' }, { status: 500 })
  }
}
