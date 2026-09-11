/**
 * @file apps/cms/src/app/api/vendor/profile/password/route.ts
 * @description BFF for vendor password change. Backend owns verification and policy.
 * POST /api/vendor/profile/password  body: { userId?, currentPassword, newPassword }
 */

import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import configPromise from '@payload-config'
import { authenticateVendor } from '@/utils/mediaLibrary'

export async function POST(request: NextRequest) {
  try {
    const payload = await getPayload({ config: configPromise })
    const authUser = await authenticateVendor(payload, request)
    if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    let body: Record<string, any>
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
    }

    const rawUserId = body.userId ? String(body.userId) : String(authUser.id)
    const userIdNum = Number(rawUserId)
    if (Number.isNaN(userIdNum)) return NextResponse.json({ error: 'userId must be numeric' }, { status: 400 })

    if (String(authUser.id) !== String(userIdNum)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const currentPassword = typeof body.currentPassword === 'string' ? body.currentPassword : ''
    const newPassword = typeof body.newPassword === 'string' ? body.newPassword : ''
    if (!currentPassword || !newPassword) return NextResponse.json({ error: 'Both passwords are required' }, { status: 400 })

    const hasUpper = /[A-Z]/.test(newPassword)
    const hasNumber = /[0-9]/.test(newPassword)
    const hasSpecial = /[^A-Za-z0-9]/.test(newPassword)
    const lenOk = newPassword.length >= 8 && newPassword.length <= 40
    if (!(lenOk && hasUpper && hasNumber && hasSpecial)) {
      return NextResponse.json({ error: 'Password must be 8-40 characters and include uppercase, number and special character.' }, { status: 400 })
    }
    if (newPassword === currentPassword) return NextResponse.json({ error: 'New password must differ from current password.' }, { status: 400 })

    let userDoc: Record<string, any>
    try {
      userDoc = (await payload.findByID({ collection: 'users', id: userIdNum, depth: 0, overrideAccess: true })) as any
    } catch {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }
    const email = userDoc.email as string
    if (!email) return NextResponse.json({ error: 'User email missing' }, { status: 400 })

    try {
      await payload.login({
        collection: 'users',
        data: { email, password: currentPassword },
        overrideAccess: true,
      })
    } catch {
      return NextResponse.json({ error: 'Current password is incorrect.' }, { status: 401 })
    }

    try {
      await payload.update({
        collection: 'users',
        id: userIdNum,
        data: { password: newPassword },
        overrideAccess: true,
        depth: 0,
      })
    } catch (e: any) {
      return NextResponse.json({ error: e?.message || 'Failed to change password' }, { status: 500 })
    }

    return NextResponse.json({ success: true, message: 'Password changed successfully. Please keep it secure.' })
  } catch (err: any) {
    console.error('[vendor/profile/password] POST error:', err)
    return NextResponse.json({ error: err?.message || 'Internal Server Error' }, { status: 500 })
  }
}
