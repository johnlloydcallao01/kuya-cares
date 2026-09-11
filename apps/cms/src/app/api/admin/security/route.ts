import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import configPromise from '@payload-config'
import { authenticateAdmin } from '@/utils/mediaLibrary'
import { deleteCached, getCached, setCached } from '@encreasl/cache'

function str(v: unknown, fb = ''): string {
  return typeof v === 'string' ? v : fb
}

export async function GET(request: NextRequest) {
  try {
    const payload = await getPayload({ config: configPromise })
    const admin = await authenticateAdmin(payload, request)
    if (!admin) return NextResponse.json({ error: 'Unauthorized: admin authentication required' }, { status: 401 })

    const cacheKey = `admin:security:${admin.id}`
    const cached = await getCached<Record<string, unknown>>(cacheKey)
    if (cached) return NextResponse.json(cached, { headers: { 'X-Security-Cache': 'HIT' } })

    // parallel aggregation: users stats + locked + audit stats + system settings
    const now = new Date()
    const [usersStatsRes, lockedRes, inactiveRes, adminsRes, auditStatsRes, systemSettingsRes] = await Promise.all([
      payload.find({ collection: 'users', limit: 2000, depth: 0, overrideAccess: true, pagination: false } as any).catch(() => ({ docs: [], totalDocs: 0 } as any)),
      payload.find({ collection: 'users', where: { lockUntil: { greater_than: now.toISOString() } }, limit: 100, depth: 0, overrideAccess: true }).catch(() => ({ docs: [], totalDocs: 0 } as any)),
      payload.find({ collection: 'users', where: { isActive: { equals: false } }, limit: 100, depth: 0, overrideAccess: true }).catch(() => ({ docs: [], totalDocs: 0 } as any)),
      payload.find({ collection: 'admins', limit: 2000, depth: 0, overrideAccess: true, pagination: false } as any).catch(() => ({ docs: [] } as any)),
      payload.find({ collection: 'user-events', limit: 2000, depth: 0, overrideAccess: true, pagination: false } as any).catch(() => ({ docs: [] } as any)),
      payload.findGlobal({ slug: 'system-settings', depth: 0, overrideAccess: true } as any).catch(() => null as any),
    ])

    const usersDocs = ((usersStatsRes as any).docs as any[]) || []
    const totalUsers = (usersStatsRes as any).totalDocs ?? usersDocs.length
    const lockedDocs = ((lockedRes as any).docs as any[]) || []
    const lockedCount = (lockedRes as any).totalDocs ?? lockedDocs.length
    const inactiveDocs = ((inactiveRes as any).docs as any[]) || []
    const inactiveCount = (inactiveRes as any).totalDocs ?? inactiveDocs.length
    const activeCount = Math.max(0, totalUsers - inactiveCount)

    const roleBreakdown: Record<string, number> = { admin: 0, customer: 0, vendor: 0, driver: 0, service: 0 }
    const activeRole: Record<string, number> = { admin: 0, customer: 0, vendor: 0, driver: 0, service: 0 }
    for (const u of usersDocs) {
      const r = String((u as any).role || 'customer').toLowerCase()
      if (r in roleBreakdown) roleBreakdown[r]++
      else roleBreakdown[r] = (roleBreakdown[r] || 0) + 1
      if ((u as any).isActive !== false) {
        if (r in activeRole) activeRole[r]++
        else activeRole[r] = (activeRole[r] || 0) + 1
      }
    }

    const adminDocs = ((adminsRes as any).docs as any[]) || []
    const adminLevelBreakdown: Record<string, number> = { system: 0, department: 0, content: 0 }
    for (const a of adminDocs) {
      const lvl = String((a as any).adminLevel || '').toLowerCase()
      if (lvl in adminLevelBreakdown) adminLevelBreakdown[lvl]++
    }

    // audit stats from user-events
    const auditDocs = ((auditStatsRes as any).docs as any[]) || []
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
    let loginSuccess = 0
    let loginFailed = 0
    let securityEvents = 0
    for (const d of auditDocs) {
      const et = String((d as any).eventType || '').toUpperCase()
      if (et in eventTypeBreakdown) eventTypeBreakdown[et]++
      else eventTypeBreakdown[et] = (eventTypeBreakdown[et] || 0) + 1
      if (et === 'LOGIN_SUCCESS') loginSuccess++
      if (et === 'LOGIN_FAILED') loginFailed++
      if (['PASSWORD_CHANGED', 'ROLE_CHANGED', 'USER_DEACTIVATED', 'USER_REACTIVATED'].includes(et)) securityEvents++
    }

    // locked preview (top 5)
    const lockedPreview = lockedDocs.slice(0, 5).map((u: any) => ({
      id: u.id,
      email: str(u.email, ''),
      firstName: str(u.firstName, ''),
      lastName: str(u.lastName, ''),
      role: str(u.role, ''),
      loginAttempts: u.loginAttempts ?? 0,
      lockUntil: u.lockUntil ? String(u.lockUntil) : null,
      isActive: !!u.isActive,
    }))

    // auth policy (from Users collection config hardcoded)
    const authPolicy = {
      tokenExpirationDays: 30,
      tokenExpirationSeconds: 30 * 24 * 60 * 60,
      maxLoginAttempts: 5,
      lockTimeMinutes: 10,
      lockTimeMs: 600 * 1000,
      useAPIKey: true,
      cookieSecure: process.env.NODE_ENV === 'production',
      cookieSameSite: 'Lax' as const,
    }

    const passwordPolicy = {
      minLength: 8,
      maxLength: 40,
      requireUppercase: true,
      requireNumber: true,
      requireSpecial: true,
      description: '8–40 characters, must include uppercase, number, and special character. Must differ from current password.',
    }

    // system settings
    const sys = systemSettingsRes as any
    const systemSettings = {
      maintenanceMode: !!sys?.maintenanceMode,
      deliveryProvider: sys?.deliveryProvider || 'lalamove',
      hasSystemSettings: !!sys,
    }

    // rate limit config (from payload.config forgot/reset handlers)
    const rateLimits = {
      forgotPasswordIp: '20 per 15min',
      forgotPasswordEmail: '5 per 60min',
      resetPasswordIp: '10 per 15min',
    }

    // recent security events (last 8 failed logins + deactivations)
    let recentSecurityEvents: any[] = []
    try {
      const r = await payload.find({
        collection: 'user-events',
        where: { eventType: { in: ['LOGIN_FAILED', 'PASSWORD_CHANGED', 'ROLE_CHANGED', 'USER_DEACTIVATED'] } },
        sort: '-timestamp',
        limit: 8,
        depth: 1,
        overrideAccess: true,
      })
      recentSecurityEvents = (r.docs as any[]).map((e) => ({
        id: e.id,
        eventType: String(e.eventType),
        timestamp: e.timestamp ? String(e.timestamp) : String(e.createdAt),
        user: e.user && typeof e.user === 'object' ? { id: e.user.id, email: String(e.user.email || ''), firstName: String(e.user.firstName || ''), lastName: String(e.user.lastName || ''), role: String(e.user.role || '') } : null,
        triggeredBy: e.triggeredBy && typeof e.triggeredBy === 'object' ? { id: e.triggeredBy.id, email: String(e.triggeredBy.email || '') } : null,
        ipAddress: e.ipAddress ? String(e.ipAddress) : null,
      }))
    } catch {}

    const responseBody = {
      stats: {
        totalUsers,
        activeCount,
        inactiveCount,
        lockedCount,
        roleBreakdown,
        activeRole,
        adminLevelBreakdown,
        adminCount: adminDocs.length,
        totalAdmins: adminDocs.length,
      },
      lockedPreview,
      auditStats: {
        totalAll: (auditStatsRes as any).totalDocs ?? auditDocs.length,
        eventTypeBreakdown,
        loginSuccess,
        loginFailed,
        securityEvents,
      },
      authPolicy,
      passwordPolicy,
      systemSettings,
      rateLimits,
      recentSecurityEvents,
      meta: {
        generatedAt: new Date().toISOString(),
      },
    }
    await setCached(cacheKey, responseBody, 20)
    return NextResponse.json(responseBody, { headers: { 'X-Security-Cache': 'MISS' } })
  } catch (err: any) {
    console.error('[admin/security] GET error:', err)
    return NextResponse.json({ error: err?.message || 'Failed to load security overview' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const payload = await getPayload({ config: configPromise })
    const admin = await authenticateAdmin(payload, request)
    if (!admin) return NextResponse.json({ error: 'Unauthorized: admin authentication required' }, { status: 401 })

    let body: Record<string, any>
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
    }

    // Only allow updating system settings maintenanceMode via this endpoint (security-relevant kill switch)
    // For other security policies (maxLoginAttempts etc), they are code-level; we return 400 with guidance
    if (body.maintenanceMode !== undefined) {
      const val = body.maintenanceMode
      let bool: boolean
      if (typeof val === 'boolean') bool = val
      else if (typeof val === 'string') bool = val.toLowerCase() === 'true'
      else return NextResponse.json({ error: 'maintenanceMode must be boolean' }, { status: 400 })

      try {
        const updated = await payload.updateGlobal({ slug: 'system-settings', data: { maintenanceMode: bool }, overrideAccess: true, depth: 0 } as any)
        await deleteCached(`admin:security:${admin.id}`)
        return NextResponse.json({ success: true, message: `Maintenance mode ${bool ? 'enabled' : 'disabled'}`, systemSettings: updated })
      } catch (e: any) {
        return NextResponse.json({ error: e?.message || 'Failed to update system settings' }, { status: 400 })
      }
    }

    // Handle unlock user action via this endpoint as well (alternative to users/[id] unlock)
    if (body.unlockUserId !== undefined) {
      const uid = Number(body.unlockUserId)
      if (Number.isNaN(uid)) return NextResponse.json({ error: 'unlockUserId must be numeric' }, { status: 400 })
      try {
        const updated = await payload.update({ collection: 'users', id: uid, data: { loginAttempts: 0, lockUntil: null } as any, overrideAccess: true, depth: 0 })
        await deleteCached(`admin:security:${admin.id}`)
        return NextResponse.json({ success: true, message: 'User unlocked', user: { id: updated.id, email: (updated as any).email } })
      } catch (e: any) {
        return NextResponse.json({ error: e?.message || 'Failed to unlock user' }, { status: 400 })
      }
    }

    return NextResponse.json({ error: 'Nothing to update. Allowed: { maintenanceMode: boolean, unlockUserId: number }' }, { status: 400 })
  } catch (err: any) {
    console.error('[admin/security] PATCH error:', err)
    return NextResponse.json({ error: err?.message || 'Update failed' }, { status: 500 })
  }
}
