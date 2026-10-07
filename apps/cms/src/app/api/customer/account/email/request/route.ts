/**
 * POST /api/customer/account/email/request { newEmail }
 * Auth: customer JWT (self only). Validates + uniqueness-checks the new
 * email, stores a single-use token, sends a verification link to the NEW
 * address via Resend. Nothing changes until confirm.
 */
import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { getPayload } from 'payload'
import configPromise from '@payload-config'
import { authenticateCustomerOrMember } from '@/utils/mediaLibrary'
import { sendAccountEmail } from '../../_shared'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const TOKEN_TTL_MIN = 60

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

    const newEmail = String(body.newEmail || '').trim().toLowerCase()
    if (!EMAIL_RE.test(newEmail)) {
      return NextResponse.json({ error: 'A valid email address is required' }, { status: 400 })
    }
    if (newEmail === String(authUser.email || '').toLowerCase()) {
      return NextResponse.json({ error: 'This is already your email address' }, { status: 400 })
    }

    const { docs: taken } = await payload.find({
      collection: 'users',
      where: { email: { equals: newEmail } },
      limit: 1,
      depth: 0,
      overrideAccess: true,
    })
    if (taken[0]) {
      return NextResponse.json({ error: 'Email already in use' }, { status: 409 })
    }

    const raw = crypto.randomBytes(32).toString('hex')
    const token = crypto.createHash('sha256').update(raw).digest('hex')
    const expiresAt = new Date(Date.now() + TOKEN_TTL_MIN * 60 * 1000).toISOString()

    const existing = Array.isArray((authUser as any).emailChangeTokens) ? (authUser as any).emailChangeTokens : []
    const kept = existing
      .filter((t: any) => t?.expiresAt && new Date(t.expiresAt).getTime() > Date.now())
      .slice(-4)

    await payload.update({
      collection: 'users',
      id: Number(authUser.id),
      data: { emailChangeTokens: [...kept, { token, expiresAt, newEmail }] } as any,
      overrideAccess: true,
      depth: 0,
    })

    const base =
      process.env.RESET_PASSWORD_BASE_URL || process.env.WEB_PROD_URL || 'https://app.kuyacares.com'
    const link = `${base.replace(/\/+$/, '')}/settings?emailToken=${raw}`
    await sendAccountEmail(
      newEmail,
      'Verify your new email address',
      `<p>Hi ${authUser.firstName || 'there'},</p><p>Click to verify your new email (expires in ${TOKEN_TTL_MIN} minutes):</p><p><a href="${link}">${link}</a></p><p>If you did not request this, ignore this email.</p>`,
    )

    return NextResponse.json({ success: true, message: 'Verification link sent to your new email address.' })
  } catch (err: any) {
    console.error('[customer/account/email/request] POST error:', err)
    return NextResponse.json({ error: err?.message || 'Internal Server Error' }, { status: 500 })
  }
}
