/**
 * POST /api/customer/account/deactivate { password }
 * Self-serve deactivation: verifies password, sets isActive=false +
 * deactivatedAt, revokes all sessions. Reactivation is admin-assisted.
 * Auth: customer/member JWT (self only).
 */
import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import configPromise from '@payload-config'
import { authenticateCustomerOrMember } from '@/utils/mediaLibrary'
import { logAccountEvent, revokeUserSessions, verifyCurrentPassword } from '../_shared'

export async function POST(request: NextRequest) {
  try {
    const payload = await getPayload({ config: configPromise })
    const authUser = await authenticateCustomerOrMember(payload, request)
    if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    let body: Record<string, any>
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
    }
    const password = typeof body.password === 'string' ? body.password : ''
    if (!password) return NextResponse.json({ error: 'Password confirmation is required' }, { status: 400 })

    const ok = await verifyCurrentPassword(payload, Number(authUser.id), String(authUser.email), password)
    if (!ok) return NextResponse.json({ error: 'Password is incorrect.' }, { status: 401 })

    await payload.update({
      collection: 'users',
      id: Number(authUser.id),
      data: { isActive: false, deactivatedAt: new Date().toISOString() } as any,
      overrideAccess: true,
      depth: 0,
    })
    await revokeUserSessions(payload, Number(authUser.id))
    await logAccountEvent(payload, authUser.id, 'USER_DEACTIVATED', { via: 'self_service' }, authUser.id)

    return NextResponse.json({
      success: true,
      message: 'Account deactivated. Contact support to reactivate.',
    })
  } catch (err: any) {
    console.error('[customer/account/deactivate] POST error:', err)
    return NextResponse.json({ error: err?.message || 'Internal Server Error' }, { status: 500 })
  }
}
