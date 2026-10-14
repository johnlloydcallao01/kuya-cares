import { randomBytes, randomUUID } from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import configPromise from '@payload-config'
import { authenticateAdmin } from '@/utils/mediaLibrary'

function parsePositiveInt(value: string | null, fallback: number, max: number): number {
  const parsed = Number(value)
  return Number.isSafeInteger(parsed) && parsed > 0 ? Math.min(parsed, max) : fallback
}

function safeUser(value: unknown) {
  if (!value || typeof value !== 'object') return null
  const user = value as Record<string, unknown>
  return {
    id: user.id,
    email: String(user.email ?? ''),
    firstName: String(user.firstName ?? ''),
    lastName: String(user.lastName ?? ''),
  }
}

function safeInvite(invite: Record<string, any>) {
  const expiresAt = invite.expiresAt ? String(invite.expiresAt) : null
  const status = invite.status === 'pending' && expiresAt && Date.parse(expiresAt) <= Date.now()
    ? 'expired'
    : String(invite.status ?? 'pending')
  return {
    id: invite.id,
    code: String(invite.code ?? ''),
    email: invite.email ?? null,
    status,
    invitedBy: safeUser(invite.invitedBy),
    claimedBy: safeUser(invite.claimedBy),
    expiresAt,
    claimedAt: invite.claimedAt ?? null,
    notes: invite.notes ?? null,
    createdAt: String(invite.createdAt ?? ''),
  }
}

export async function GET(request: NextRequest) {
  try {
    const payload = await getPayload({ config: configPromise })
    const admin = await authenticateAdmin(payload, request)
    if (!admin) return NextResponse.json({ error: 'Unauthorized: admin authentication required' }, { status: 401 })

    const params = request.nextUrl.searchParams
    const page = parsePositiveInt(params.get('page'), 1, 100000)
    const limit = parsePositiveInt(params.get('limit'), 20, 100)
    const search = (params.get('search') ?? '').trim()
    const status = params.get('status')
    const and: Record<string, unknown>[] = []
    if (status && ['pending', 'claimed', 'revoked', 'expired'].includes(status)) {
      if (status === 'expired') {
        and.push({
          or: [
            { status: { equals: 'expired' } },
            { and: [{ status: { equals: 'pending' } }, { expiresAt: { less_than_equal: new Date().toISOString() } }] },
          ],
        })
      } else {
        and.push({ status: { equals: status } })
        if (status === 'pending') {
          and.push({ or: [{ expiresAt: { greater_than: new Date().toISOString() } }, { expiresAt: { exists: false } }] })
        }
      }
    }
    if (search) {
      and.push({
        or: [
          { code: { contains: search.toUpperCase() } },
          { email: { contains: search } },
        ],
      })
    }

    const result = await payload.find({
      collection: 'member-invites',
      where: and.length ? { and } as never : undefined,
      page,
      limit,
      sort: '-createdAt',
      depth: 1,
      overrideAccess: true,
    })
    return NextResponse.json({
      docs: result.docs.map((doc) => safeInvite(doc as unknown as Record<string, any>)),
      pagination: {
        page: result.page,
        limit: result.limit,
        totalDocs: result.totalDocs,
        totalPages: result.totalPages,
        hasNextPage: result.hasNextPage,
        hasPrevPage: result.hasPrevPage,
      },
    }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    console.error('[admin/members/invites] GET error:', error)
    return NextResponse.json({ error: 'Failed to load member invitations' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const payload = await getPayload({ config: configPromise })
    const admin = await authenticateAdmin(payload, request)
    if (!admin) return NextResponse.json({ error: 'Unauthorized: admin authentication required' }, { status: 401 })

    let body: Record<string, unknown>
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
    }
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: 'Enter a valid invitee email address' }, { status: 400 })
    }
    const notes = typeof body.notes === 'string' ? body.notes.trim() : ''
    if (notes.length > 1000) return NextResponse.json({ error: 'Notes must be 1,000 characters or fewer' }, { status: 400 })

    const expiryInput = body.expiresAt == null || body.expiresAt === ''
      ? Date.now() + 30 * 24 * 60 * 60 * 1000
      : Date.parse(String(body.expiresAt))
    if (!Number.isFinite(expiryInput) || expiryInput <= Date.now()) {
      return NextResponse.json({ error: 'Invitation expiry must be a valid future date' }, { status: 400 })
    }
    const expiresAt = new Date(expiryInput).toISOString()

    const invite = await payload.create({
      collection: 'member-invites',
      data: {
        code: randomBytes(9).toString('hex').toUpperCase(),
        ...(email ? { email } : {}),
        status: 'pending',
        invitedBy: admin.id,
        expiresAt,
        ...(notes ? { notes } : {}),
      },
      depth: 1,
      overrideAccess: true,
    })
    await payload.create({
      collection: 'membership-audit-log',
      data: {
        action: 'override',
        reason: 'Member invitation created',
        actor: admin.id,
        eventId: `member-invite:${String(invite.id)}:${randomUUID()}`,
        metadata: { kind: 'member-invite', operation: 'create', inviteId: invite.id, email: email || null, expiresAt },
      },
      overrideAccess: true,
    })
    return NextResponse.json({ doc: safeInvite(invite as unknown as Record<string, any>) }, { status: 201 })
  } catch (error) {
    console.error('[admin/members/invites] POST error:', error)
    return NextResponse.json({ error: 'Failed to create member invitation' }, { status: 500 })
  }
}
