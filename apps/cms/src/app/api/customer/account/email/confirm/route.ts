/**
 * POST /api/customer/account/email/confirm { token }
 * Public (token bearer). Applies a pending email change, marks verified,
 * syncs customers.email, clears the token.
 */
import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { getPayload } from 'payload'
import configPromise from '@payload-config'
import { logAccountEvent } from '../../_shared'

export async function POST(request: NextRequest) {
  try {
    const payload = await getPayload({ config: configPromise })

    let body: Record<string, any>
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
    }
    const raw = String(body.token || '').trim()
    if (!raw) return NextResponse.json({ error: 'Token is required' }, { status: 400 })
    const digest = crypto.createHash('sha256').update(raw).digest('hex')

    const { docs } = await payload.find({
      collection: 'users',
      where: { 'emailChangeTokens.token': { equals: digest } },
      limit: 5,
      depth: 0,
      overrideAccess: true,
    })

    const match = (docs || []).find((u: any) =>
      (u.emailChangeTokens || []).some((t: any) => t?.token === digest),
    ) as any
    if (!match) {
      return NextResponse.json({ error: 'Invalid verification link', code: 'TOKEN_INVALID' }, { status: 400 })
    }
    const entry = (match.emailChangeTokens || []).find((t: any) => t?.token === digest)
    if (!entry || new Date(entry.expiresAt).getTime() <= Date.now()) {
      return NextResponse.json({ error: 'Verification link expired', code: 'TOKEN_EXPIRED' }, { status: 400 })
    }

    const newEmail = String(entry.newEmail).toLowerCase()
    const { docs: taken } = await payload.find({
      collection: 'users',
      where: { email: { equals: newEmail } },
      limit: 1,
      depth: 0,
      overrideAccess: true,
    })
    if (taken[0] && String((taken[0] as any).id) !== String(match.id)) {
      return NextResponse.json({ error: 'Email already in use', code: 'EMAIL_TAKEN' }, { status: 409 })
    }

    await payload.update({
      collection: 'users',
      id: match.id,
      data: {
        email: newEmail,
        emailVerifiedAt: new Date().toISOString(),
        emailChangeTokens: [],
        loginAttempts: 0,
        lockUntil: null,
      } as any,
      overrideAccess: true,
      depth: 0,
    })

    // Keep the denormalized customers.email in sync.
    try {
      const { docs: customers } = await payload.find({
        collection: 'customers',
        where: { user: { equals: match.id } },
        limit: 1,
        depth: 0,
        overrideAccess: true,
      })
      if (customers[0]) {
        await payload.update({
          collection: 'customers',
          id: customers[0].id,
          data: { email: newEmail },
          overrideAccess: true,
        })
      }
    } catch (e) {
      console.error('[customer/account/email/confirm] customer sync error:', e)
    }

    await logAccountEvent(payload, match.id, 'PROFILE_UPDATED', { changedFields: ['email'], via: 'email_confirm' }, match.id)

    return NextResponse.json({ success: true, message: 'Email verified and updated.' })
  } catch (err: any) {
    console.error('[customer/account/email/confirm] POST error:', err)
    return NextResponse.json({ error: err?.message || 'Internal Server Error' }, { status: 500 })
  }
}
