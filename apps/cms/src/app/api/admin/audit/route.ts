import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import configPromise from '@payload-config'
import { authenticateAdmin } from '@/utils/mediaLibrary'
import { getCached, setCached } from '@encreasl/cache'

function str(v: unknown, fb = ''): string {
  return typeof v === 'string' ? v : fb
}
function optionalString(v: unknown): string | null {
  return typeof v === 'string' ? v.trim() || null : null
}
function parseCsv(v: string | null): string[] {
  if (!v) return []
  return v
    .split(',')
    .map((s) => s.trim().toUpperCase())
    .filter(Boolean)
}

function sanitizeUserBrief(value: unknown): { id: number; email: string; firstName: string; lastName: string; role: string } | null {
  if (!value || typeof value !== 'object') return null
  const u = value as Record<string, any>
  const id = Number(u.id)
  if (Number.isNaN(id)) return null
  return {
    id,
    email: str(u.email, ''),
    firstName: str(u.firstName, ''),
    lastName: str(u.lastName, ''),
    role: str(u.role, 'unknown'),
  }
}

function sanitizeDoc(raw: Record<string, any>): Record<string, any> {
  const ts = raw.timestamp ? String(raw.timestamp) : raw.createdAt ? String(raw.createdAt) : null
  return {
    id: raw.id,
    user: sanitizeUserBrief(raw.user),
    userId: typeof raw.user === 'object' && raw.user !== null ? (raw.user as any).id : raw.user ?? null,
    eventType: str(raw.eventType, 'UNKNOWN'),
    eventData: raw.eventData ?? null,
    triggeredBy: sanitizeUserBrief(raw.triggeredBy),
    triggeredById: typeof raw.triggeredBy === 'object' && raw.triggeredBy !== null ? (raw.triggeredBy as any).id : raw.triggeredBy ?? null,
    timestamp: ts,
    createdAt: String(raw.createdAt ?? ts ?? ''),
    updatedAt: String(raw.updatedAt ?? ''),
    ipAddress: optionalString(raw.ipAddress),
    userAgent: optionalString(raw.userAgent),
  }
}

const EVENT_TYPES = new Set([
  'USER_CREATED',
  'ROLE_CHANGED',
  'PROFILE_UPDATED',
  'USER_DEACTIVATED',
  'USER_REACTIVATED',
  'LOGIN_SUCCESS',
  'LOGIN_FAILED',
  'PASSWORD_CHANGED',
])

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
    const cacheKey = `admin:audit:${admin.id}:${cacheQuery}`
    const cached = await getCached<Record<string, unknown>>(cacheKey)
    if (cached) return NextResponse.json(cached, { headers: { 'X-Audit-Cache': 'HIT' } })

    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10) || 1)
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20', 10) || 20))
    const search = searchParams.get('search')?.trim() || ''
    const sort = searchParams.get('sort') || '-timestamp'
    const eventTypeCsv = parseCsv(searchParams.get('eventType'))
    const userIdParam = searchParams.get('userId')?.trim() || searchParams.get('user')?.trim() || ''
    const triggeredByParam = searchParams.get('triggeredBy')?.trim() || ''
    const fromParam = searchParams.get('from')?.trim() || searchParams.get('fromDate')?.trim() || ''
    const toParam = searchParams.get('to')?.trim() || searchParams.get('toDate')?.trim() || ''
    const ipParam = searchParams.get('ip')?.trim() || ''

    const where: Record<string, any> = {}
    const and: any[] = []

    if (search) {
      and.push({
        or: [
          { eventType: { contains: search } },
          { ipAddress: { contains: search } },
          { userAgent: { contains: search } },
        ],
      })
    }
    if (ipParam) {
      where.ipAddress = { contains: ipParam }
    }
    if (eventTypeCsv.length) {
      const filtered = eventTypeCsv.filter((v) => EVENT_TYPES.has(v))
      if (filtered.length) where.eventType = { in: filtered }
    }
    if (userIdParam) {
      const uid = Number(userIdParam)
      if (Number.isFinite(uid)) where.user = { equals: uid }
      else where.user = { equals: userIdParam }
    }
    if (triggeredByParam) {
      const tid = Number(triggeredByParam)
      if (Number.isFinite(tid)) where.triggeredBy = { equals: tid }
      else where.triggeredBy = { equals: triggeredByParam }
    }
    // date range on timestamp (fallback createdAt via same field if needed)
    if (fromParam || toParam) {
      const tsWhere: Record<string, any> = {}
      if (fromParam) {
        const d = new Date(fromParam)
        if (!Number.isNaN(d.getTime())) tsWhere.greater_than_equal = d.toISOString()
      }
      if (toParam) {
        const d = new Date(toParam)
        if (!Number.isNaN(d.getTime())) {
          // inclusive to end of day if date only
          const iso = toParam.length <= 10 ? new Date(d.getTime() + 24 * 60 * 60 * 1000 - 1).toISOString() : d.toISOString()
          tsWhere.less_than_equal = iso
        }
      }
      if (Object.keys(tsWhere).length) where.timestamp = tsWhere
    }

    const finalWhere = and.length ? { and: [...and, where] } : where

    // sort mapping: allow -timestamp, timestamp, -createdAt, etc. fallback to -timestamp
    const allowedSorts = new Set(['-timestamp', 'timestamp', '-createdAt', 'createdAt', '-updatedAt', 'updatedAt', '-eventType', 'eventType'])
    const safeSort = allowedSorts.has(sort) ? sort : '-timestamp'

    const [paginated, statsAll] = await Promise.all([
      payload.find({
        collection: 'user-events',
        where: Object.keys(finalWhere).length ? (finalWhere as any) : undefined,
        page,
        limit,
        sort: safeSort as any,
        depth: 1,
        overrideAccess: true,
      }),
      // stats aggregation bounded 2000 for performance like vendors
      payload
        .find({
          collection: 'user-events',
          limit: 2000,
          depth: 0,
          overrideAccess: true,
          pagination: false,
        } as any)
        .catch(() => ({ docs: [] } as any)),
    ])

    const docs = (paginated.docs as any[]).map((d) => sanitizeDoc(d as Record<string, any>))

    // stats breakdown
    const statsDocs = (statsAll as any).docs as any[] | undefined
    const allForStats = Array.isArray(statsDocs) ? statsDocs : []
    const eventTypeBreakdown: Record<string, number> = {
      USER_CREATED: 0,
      ROLE_CHANGED: 0,
      PROFILE_UPDATED: 0,
      USER_DEACTIVATED: 0,
      USER_REACTIVATED: 0,
      LOGIN_SUCCESS: 0,
      LOGIN_FAILED: 0,
      PASSWORD_CHANGED: 0,
    }
    let loginSuccessCount = 0
    let loginFailedCount = 0
    let securityCount = 0 // PASSWORD_CHANGED + ROLE_CHANGED + DEACTIVATED
    const userSet = new Set<string>()
    for (const d of allForStats) {
      const et = String((d as any).eventType || '').toUpperCase()
      if (et in eventTypeBreakdown) eventTypeBreakdown[et]++
      else eventTypeBreakdown[et] = (eventTypeBreakdown[et] || 0) + 1
      if (et === 'LOGIN_SUCCESS') loginSuccessCount++
      if (et === 'LOGIN_FAILED') loginFailedCount++
      if (['PASSWORD_CHANGED', 'ROLE_CHANGED', 'USER_DEACTIVATED', 'USER_REACTIVATED'].includes(et)) securityCount++
      const uid = (d as any).user
      const uidStr = uid && typeof uid === 'object' ? String((uid as any).id ?? '') : String(uid ?? '')
      if (uidStr) userSet.add(uidStr)
    }

    const totalDocs = paginated.totalDocs ?? docs.length
    const totalAll = (statsAll as any).totalDocs ?? allForStats.length

    const stats = {
      totalEvents: totalDocs,
      totalAll,
      filteredTotal: totalDocs,
      eventTypeBreakdown,
      loginSuccessCount,
      loginFailedCount,
      securityCount,
      uniqueUsers: userSet.size,
    }

    const responseBody = {
      docs,
      pagination: {
        page: paginated.page ?? page,
        limit: paginated.limit ?? limit,
        totalDocs,
        totalPages: paginated.totalPages ?? (Math.ceil(totalDocs / limit) || 1),
        hasNextPage: paginated.hasNextPage ?? page * limit < totalDocs,
        hasPrevPage: paginated.hasPrevPage ?? (page > 1),
      },
      stats,
      meta: {
        generatedAt: new Date().toISOString(),
        sort: safeSort,
        search,
      },
    }
    await setCached(cacheKey, responseBody, 20)
    return NextResponse.json(responseBody, { headers: { 'X-Audit-Cache': 'MISS' } })
  } catch (err: any) {
    console.error('[admin/audit] GET error:', err)
    return NextResponse.json({ error: err?.message || 'Failed to load audit logs' }, { status: 500 })
  }
}
