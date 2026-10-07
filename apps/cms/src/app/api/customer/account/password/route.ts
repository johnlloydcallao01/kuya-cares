/**
 * POST /api/customer/account/password { currentPassword, newPassword }
 * Auth: customer JWT (self only). Verifies current password via login,
 * enforces policy, rotates password, revokes all other sessions.
 */
import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import configPromise from '@payload-config'
import { authenticateCustomerOrMember } from '@/utils/mediaLibrary'
import { logAccountEvent, passwordPolicyError, revokeUserSessions, verifyCurrentPassword } from '../_shared'

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

    const currentPassword = typeof body.currentPassword === 'string' ? body.currentPassword : ''
    const newPassword = typeof body.newPassword === 'string' ? body.newPassword : ''
    if (!currentPassword || !newPassword) {
      return NextResponse.json({ error: 'Both passwords are required' }, { status: 400 })
    }
    const policyError = passwordPolicyError(newPassword)
    if (policyError) return NextResponse.json({ error: policyError }, { status: 400 })
    if (newPassword === currentPassword) {
      return NextResponse.json({ error: 'New password must differ from current password.' }, { status: 400 })
    }

    const ok = await verifyCurrentPassword(payload, Number(authUser.id), String(authUser.email), currentPassword)
    if (!ok) return NextResponse.json({ error: 'Current password is incorrect.' }, { status: 401 })

    await payload.update({
      collection: 'users',
      id: Number(authUser.id),
      data: { password: newPassword, loginAttempts: 0, lockUntil: null } as any,
      overrideAccess: true,
      depth: 0,
    })

    // Users.afterChange hook writes PASSWORD_CHANGED automatically.
    const sessionsRevoked = await revokeUserSessions(payload, Number(authUser.id))
    await logAccountEvent(payload, authUser.id, 'PASSWORD_CHANGED', { via: 'settings', sessionsRevoked }, authUser.id)

    return NextResponse.json({
      success: true,
      message: sessionsRevoked
        ? 'Password changed. All other devices were signed out — please sign in again.'
        : 'Password changed successfully.',
      sessionsRevoked,
    })
  } catch (err: any) {
    console.error('[customer/account/password] POST error:', err)
    return NextResponse.json({ error: err?.message || 'Internal Server Error' }, { status: 500 })
  }
}
