/**
 * @file apps/cms/src/app/api/admin/users/route.ts
 * @description BFF aggregation endpoint for web-admin users page (enterprise-grade).
 * Follows docs/BFF-pattern.md and apps/cms/src/app/api/admin/vendors/route.ts:
 * backend owns context resolution, joins, filtering, pagination, and sanitization
 * with overrideAccess:true. Frontend is thin consumer.
 *
 * GET  /api/admin/users?page=1&limit=20&search=&role=admin,customer&isActive=true&gender=male&civilStatus=single&sort=-createdAt
 *      -> { docs, pagination, stats, meta }
 * POST /api/admin/users -> create user (admin-only)
 * Access: admin-only via authenticateAdmin (JWT / Bearer / payload-token cookie)
 */

import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import configPromise from '@payload-config'
import { authenticateAdmin } from '@/utils/mediaLibrary'
import { withAdminRequestSlot } from '@/utils/adminRequestGate'
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
function sanitizeUserDoc(raw: Record<string, any>): Record<string, any> {
  return {
    id: raw.id,
    email: str(raw.email, ''),
    firstName: str(raw.firstName, ''),
    lastName: str(raw.lastName, ''),
    middleName: optionalString(raw.middleName),
    nameExtension: optionalString(raw.nameExtension),
    phone: optionalString(raw.phone),
    username: optionalString(raw.username),
    gender: optionalString(raw.gender),
    civilStatus: optionalString(raw.civilStatus),
    nationality: optionalString(raw.nationality),
    birthDate: raw.birthDate ? String(raw.birthDate) : null,
    placeOfBirth: optionalString(raw.placeOfBirth),
    completeAddress: optionalString(raw.completeAddress),
    role: str(raw.role, 'customer'),
    isActive: typeof raw.isActive === 'boolean' ? raw.isActive : true,
    lastLogin: raw.lastLogin ? String(raw.lastLogin) : null,
    profilePicture: sanitizeMediaRef(raw.profilePicture),
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
function badRequest(message: string, details?: unknown) {
  return NextResponse.json({ error: message, details }, { status: 400 })
}

const ROLES = new Set(['admin', 'customer', 'service', 'vendor', 'driver'])
const GENDERS = new Set(['male', 'female', 'other', 'prefer_not_to_say'])
const CIVIL_STATUSES = new Set(['single', 'married', 'divorced', 'widowed', 'separated'])

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
    const cacheKey = `admin:users:${admin.id}:${cacheQuery}`
    const cached = await getCached<Record<string, unknown>>(cacheKey)
    if (cached) return NextResponse.json(cached, { headers: { 'X-Users-Cache': 'HIT' } })

    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10) || 1)
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20', 10) || 20))
    const search = searchParams.get('search')?.trim() || ''
    const sort = searchParams.get('sort') || '-createdAt'
    const roleCsv = parseCsv(searchParams.get('role'))
    const genderCsv = parseCsv(searchParams.get('gender'))
    const civilCsv = parseCsv(searchParams.get('civilStatus'))
    const isActiveParam = searchParams.get('isActive')
    const isActiveFilter = isActiveParam === 'true' ? true : isActiveParam === 'false' ? false : null

    const where: Record<string, any> = {}
    const and: any[] = []

    if (search) {
      and.push({
        or: [
          { email: { contains: search } },
          { firstName: { contains: search } },
          { lastName: { contains: search } },
          { username: { contains: search } },
          { phone: { contains: search } },
        ],
      })
    }
    if (roleCsv.length) {
      const filtered = roleCsv.filter((v) => ROLES.has(v))
      if (filtered.length) where.role = { in: filtered }
    }
    if (isActiveFilter !== null) where.isActive = { equals: isActiveFilter }
    if (genderCsv.length) {
      const filtered = genderCsv.filter((v) => GENDERS.has(v))
      if (filtered.length) where.gender = { in: filtered }
    }
    if (civilCsv.length) {
      const filtered = civilCsv.filter((v) => CIVIL_STATUSES.has(v))
      if (filtered.length) where.civilStatus = { in: filtered }
    }

    const finalWhere = and.length ? { and: [...and, where] } : where

    // parallel: paginated list + full stats (bounded 2000)
    const [paginated, statsAll] = await Promise.all([
      payload.find({
        collection: 'users',
        where: Object.keys(finalWhere).length ? finalWhere : undefined,
        page,
        limit,
        sort,
        depth: 2, // need profilePicture populated
        overrideAccess: true,
      }),
      payload
        .find({
          collection: 'users',
          where: undefined,
          limit: 0,
          pagination: false,
          depth: 0,
          overrideAccess: true,
        } as any)
        .catch(() => ({ docs: [], totalDocs: 0 } as any))
        .then(async () => {
          const r = await payload.find({
            collection: 'users',
            limit: 2000,
            depth: 0,
            overrideAccess: true,
            pagination: false,
          } as any)
          return r
        }),
    ])

    const statsDocs = (statsAll as any).docs as Record<string, any>[] ?? []
    const docs = (paginated.docs as unknown as Record<string, any>[]).map((d) => sanitizeUserDoc(d))

    const totalUsers = typeof paginated.totalDocs === 'number' ? paginated.totalDocs : docs.length
    const totalAll = statsDocs.length
    const roleBreakdown: Record<string, number> = {}
    const genderBreakdown: Record<string, number> = {}
    const civilBreakdown: Record<string, number> = {}
    let activeCount = 0
    let inactiveCount = 0
    for (const u of statsDocs) {
      const r = String(u.role || 'customer')
      roleBreakdown[r] = (roleBreakdown[r] || 0) + 1
      const g = String(u.gender || 'unknown')
      genderBreakdown[g] = (genderBreakdown[g] || 0) + 1
      const c = String(u.civilStatus || 'unknown')
      civilBreakdown[c] = (civilBreakdown[c] || 0) + 1
      if (u.isActive === false) inactiveCount++
      else activeCount++
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
        totalUsers,
        totalAll,
        filteredTotal: totalUsers,
        roleBreakdown,
        genderBreakdown,
        civilBreakdown,
        activeCount,
        inactiveCount,
      },
      meta: { generatedAt: new Date().toISOString(), sort, search },
    }
    await setCached(cacheKey, response, 20)
    return NextResponse.json(response, { headers: { 'X-Users-Cache': 'MISS' } })
    } catch (err: any) {
      console.error('[admin/users] GET error:', err)
      return NextResponse.json({ error: err?.message || 'Failed to load users' }, { status: 500 })
    }
  })
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

    const firstName = typeof body.firstName === 'string' ? body.firstName.trim() : ''
    const lastName = typeof body.lastName === 'string' ? body.lastName.trim() : ''
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''
    const password = typeof body.password === 'string' ? body.password : ''
    const roleRaw = typeof body.role === 'string' ? body.role.trim().toLowerCase() : 'customer'

    if (!firstName || firstName.length < 2) return badRequest('firstName is required (min 2 chars)')
    if (!lastName || lastName.length < 2) return badRequest('lastName is required (min 2 chars)')
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return badRequest('email must be a valid email')
    if (!password || password.length < 8) return badRequest('password is required (min 8 chars)')
    if (!ROLES.has(roleRaw)) return badRequest(`role must be one of: ${Array.from(ROLES).join(', ')}`)

    const isActive = typeof body.isActive === 'boolean' ? body.isActive : true

    // optional fields whitelist with validation
    const middleName = typeof body.middleName === 'string' ? body.middleName.trim() || null : null
    const nameExtension = typeof body.nameExtension === 'string' ? body.nameExtension.trim() || null : null
    const phone = typeof body.phone === 'string' ? body.phone.trim() || null : null
    let username: string | null = null
    if (body.username !== undefined) {
      if (body.username === null || body.username === '') username = null
      else if (typeof body.username === 'string') {
        const v = body.username.trim()
        if (v && !/^[a-zA-Z0-9._-]+$/.test(v)) return badRequest('username may only contain letters, numbers, dot, underscore, hyphen')
        username = v || null
      }
    }
    let gender: string | null = null
    if (body.gender !== undefined) {
      if (body.gender === null || body.gender === '') gender = null
      else if (typeof body.gender === 'string') {
        const v = body.gender.trim().toLowerCase()
        if (!GENDERS.has(v)) return badRequest(`gender must be one of: ${Array.from(GENDERS).join(', ')}`)
        gender = v
      }
    }
    let civilStatus: string | null = null
    if (body.civilStatus !== undefined) {
      if (body.civilStatus === null || body.civilStatus === '') civilStatus = null
      else if (typeof body.civilStatus === 'string') {
        const v = body.civilStatus.trim().toLowerCase()
        if (!CIVIL_STATUSES.has(v)) return badRequest(`civilStatus must be one of: ${Array.from(CIVIL_STATUSES).join(', ')}`)
        civilStatus = v
      }
    }
    const nationality = typeof body.nationality === 'string' ? body.nationality.trim() || null : null
    const placeOfBirth = typeof body.placeOfBirth === 'string' ? body.placeOfBirth.trim() || null : null
    const completeAddress = typeof body.completeAddress === 'string' ? body.completeAddress.trim() || null : null
    let birthDate: string | null = null
    if (body.birthDate !== undefined) {
      if (body.birthDate === null || body.birthDate === '') birthDate = null
      else {
        const d = new Date(String(body.birthDate))
        if (Number.isNaN(d.getTime())) return badRequest('birthDate must be a valid date')
        birthDate = d.toISOString()
      }
    }

    // optional profilePicture media id
    let profilePicture: number | null = null
    if (body.profilePicture !== undefined && body.profilePicture !== null && body.profilePicture !== '') {
      const n = Number(body.profilePicture)
      if (Number.isNaN(n)) return badRequest('profilePicture must be numeric media id')
      profilePicture = n
    }

    const data: Record<string, any> = {
      email,
      password,
      firstName,
      lastName,
      role: roleRaw,
      isActive,
      middleName,
      nameExtension,
      phone,
      username,
      gender,
      civilStatus,
      nationality,
      placeOfBirth,
      completeAddress,
      birthDate,
    }
    // only attach profilePicture if provided to avoid null overwrite issues
    if (profilePicture !== null) data.profilePicture = profilePicture
    // remove nulls where collection expects undefined for optional?
    // payload handles null fine; keep explicit null for clearing.

    let created: Record<string, any>
    try {
      created = (await payload.create({
        collection: 'users',
        data: data as any,
        depth: 2,
        overrideAccess: true,
      })) as unknown as Record<string, any>
    } catch (e: any) {
      const msg = e?.message || 'Failed to create user'
      const lower = String(msg).toLowerCase()
      if (lower.includes('unique') || lower.includes('already exists') || lower.includes('duplicate')) {
        const field = lower.includes('username') ? 'username' : lower.includes('email') ? 'email' : 'email/username'
        return NextResponse.json({ error: `Duplicate ${field}: already exists`, details: msg }, { status: 409 })
      }
      return NextResponse.json({ error: msg, details: e?.data || e?.errors }, { status: 400 })
    }

    const sanitized = sanitizeUserDoc(created)
    return NextResponse.json({ success: true, message: 'User created successfully', doc: sanitized }, { status: 201 })
  } catch (err: any) {
    console.error('[admin/users] POST error:', err)
    return NextResponse.json({ error: err?.message || 'Internal Server Error' }, { status: 500 })
  }
}
