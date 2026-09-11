/**
 * @file apps/cms/src/app/api/admin/profile/route.ts
 * @description BFF aggregation endpoint for web-admin profile page.
 * Follows docs/BFF-pattern.md: backend owns user/context lookup, relationship joins,
 * and access-sensitive querying with overrideAccess:true. Frontend calls one endpoint.
 *
 * GET  /api/admin/profile?userId=123  -> aggregated profile (user + admin + raw + activities)
 * PATCH /api/admin/profile           -> update profile fields (body: { userId, ...fields })
 * Auth: admin JWT via Authorization: JWT <token> or payload-token cookie (authenticateAdmin)
 */

import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import configPromise from '@payload-config'
import { authenticateAdmin } from '@/utils/mediaLibrary'
import { withAdminRequestSlot } from '@/utils/adminRequestGate'
import { deleteCached, getCached, setCached } from '@encreasl/cache'

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

function badRequest(message: string, details?: unknown) {
  return NextResponse.json({ error: message, details }, { status: 400 })
}

export async function GET(request: NextRequest) {
  return withAdminRequestSlot(async () => {
    try {
    const payload = await getPayload({ config: configPromise })
    const authUser = await authenticateAdmin(payload, request)
    if (!authUser) {
      return NextResponse.json({ error: 'Unauthorized: admin authentication required' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const rawUserId = searchParams.get('userId') || String(authUser.id)
    const userIdNum = Number(rawUserId)
    if (!rawUserId || Number.isNaN(userIdNum)) {
      return badRequest('userId is required and must be numeric')
    }

    // Enforce that non-system admins can only fetch own profile (system admins can fetch any)
    // Fetch auth user's admin record to check level
    let isSystemAdmin = false
    try {
      const authAdminRes = await payload.find({
        collection: 'admins',
        where: { user: { equals: authUser.id } },
        limit: 1,
        depth: 0,
        overrideAccess: true,
      })
      const level = (authAdminRes.docs[0] as any)?.adminLevel
      isSystemAdmin = level === 'system'
    } catch {
      // ignore, default false
    }

    if (String(authUser.id) !== String(userIdNum) && !isSystemAdmin) {
      return NextResponse.json({ error: 'Forbidden: can only fetch own profile' }, { status: 403 })
    }

    const cacheKey = `admin:profile:${userIdNum}`
    const cached = await getCached<Record<string, unknown>>(cacheKey)
    if (cached) return NextResponse.json(cached, { headers: { 'X-Profile-Cache': 'HIT' } })

    // 1. Resolve user (overrideAccess: true is safe boundary - endpoint is admin-only)
    let userDoc: Record<string, any>
    try {
      userDoc = await payload.findByID({
        collection: 'users',
        id: userIdNum,
        depth: 2,
        overrideAccess: true,
      }) as unknown as Record<string, any>
    } catch (e: any) {
      return NextResponse.json({ error: 'User not found', details: e?.message }, { status: 404 })
    }

    if (!userDoc || userDoc.role !== 'admin') {
      return NextResponse.json({ error: 'User not found or not admin' }, { status: 404 })
    }

    // 2. Resolve admin record (relationship)
    let adminDoc: Record<string, any> | null = null
    try {
      const adminRes = await payload.find({
        collection: 'admins',
        where: { user: { equals: userIdNum } },
        limit: 1,
        depth: 0,
        overrideAccess: true,
      })
      adminDoc = (adminRes.docs[0] as Record<string, any>) || null
    } catch {
      adminDoc = null
    }

    // 3. Fetch recent activities (user-events)
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

    // Sanitize for frontend
    const user = sanitizeUserForResponse(userDoc)
    const raw = sanitizeUserForResponse(userDoc) // includes loginAttempts etc for frontend's raw
    // But raw should include all fields; sanitize already includes them
    // Keep admin shape minimal
    const admin = adminDoc
      ? {
          id: adminDoc.id,
          adminLevel: adminDoc.adminLevel || null,
          systemPermissions: adminDoc.systemPermissions || null,
          createdAt: adminDoc.createdAt || null,
          updatedAt: adminDoc.updatedAt || null,
        }
      : null

    const sanitizedActivities = activities.map((a) => ({
      id: a.id,
      eventType: a.eventType || 'UNKNOWN',
      eventData: a.eventData ?? null,
      timestamp: a.timestamp || null,
      createdAt: a.createdAt || null,
      ipAddress: a.ipAddress || null,
      userAgent: a.userAgent || null,
    }))

    const response = {
      user,
      raw,
      admin,
      activities: sanitizedActivities,
    }
    await setCached(cacheKey, response, 15)
    return NextResponse.json(response, { headers: { 'X-Profile-Cache': 'MISS' } })
    } catch (err: any) {
      console.error('[admin/profile] GET error:', err)
      return NextResponse.json({ error: err?.message || 'Internal Server Error' }, { status: 500 })
    }
  })
}

export async function PATCH(request: NextRequest) {
  try {
    const payload = await getPayload({ config: configPromise })
    const authUser = await authenticateAdmin(payload, request)
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

    // Only allow self-update unless system admin
    let isSystemAdmin = false
    try {
      const authAdminRes = await payload.find({
        collection: 'admins',
        where: { user: { equals: authUser.id } },
        limit: 1,
        depth: 0,
        overrideAccess: true,
      })
      isSystemAdmin = (authAdminRes.docs[0] as any)?.adminLevel === 'system'
    } catch {}
    if (String(authUser.id) !== String(userIdNum) && !isSystemAdmin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Validate required fields
    const firstName = typeof body.firstName === 'string' ? body.firstName.trim() : ''
    const lastName = typeof body.lastName === 'string' ? body.lastName.trim() : ''
    if (!firstName || firstName.length < 2) return badRequest('firstName must be at least 2 characters')
    if (!lastName || lastName.length < 2) return badRequest('lastName must be at least 2 characters')

    // Whitelist + normalize
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
      // Only include if changed; fetch current to compare
      const current = await payload.findByID({ collection: 'users', id: userIdNum, depth: 0, overrideAccess: true }) as any
      if (email !== current.email) patch.email = email
    }

    if (patch.username === '') patch.username = null
    if (typeof body.username === 'string' && body.username.trim().length > 0) {
      const u = body.username.trim()
      if (u.length < 3 || u.length > 30) return badRequest('username must be 3-30 characters')
      if (!/^[a-zA-Z0-9._-]+$/.test(u)) return badRequest('username may only contain letters, numbers, dots, dashes and underscores')
    }

    // Perform update with overrideAccess (endpoint is safe boundary)
    let updated: Record<string, any>
    try {
      updated = await payload.update({
        collection: 'users',
        id: userIdNum,
        data: patch,
        depth: 2,
        overrideAccess: true,
      }) as unknown as Record<string, any>
    } catch (e: any) {
      const msg = e?.message || 'Failed to update profile'
      const details = e?.data || e?.errors
      return NextResponse.json({ error: msg, details }, { status: 400 })
    }

    const user = sanitizeUserForResponse(updated)
    await deleteCached(`admin:profile:${userIdNum}`)
    return NextResponse.json({ success: true, message: 'Profile updated successfully', user })
  } catch (err: any) {
    console.error('[admin/profile] PATCH error:', err)
    return NextResponse.json({ error: err?.message || 'Internal Server Error' }, { status: 500 })
  }
}
