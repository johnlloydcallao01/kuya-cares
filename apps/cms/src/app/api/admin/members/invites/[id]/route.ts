import { randomUUID } from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import configPromise from '@payload-config'
import { authenticateAdmin } from '@/utils/mediaLibrary'

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const payload = await getPayload({ config: configPromise })
    const admin = await authenticateAdmin(payload, request)
    if (!admin) return NextResponse.json({ error: 'Unauthorized: admin authentication required' }, { status: 401 })

    const { id: rawId } = await params
    const id = Number(rawId)
    if (!Number.isSafeInteger(id) || id <= 0) return NextResponse.json({ error: 'Invalid invitation ID' }, { status: 400 })
    let body: Record<string, unknown>
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
    }
    const reason = typeof body.reason === 'string' ? body.reason.trim() : ''
    if (body.status !== 'revoked' || !reason || reason.length > 500) {
      return NextResponse.json({ error: 'Revocation requires status "revoked" and a reason of 1 to 500 characters' }, { status: 400 })
    }

    const existing = await payload.findByID({ collection: 'member-invites', id, depth: 0, overrideAccess: true })
    if (existing.status !== 'pending') {
      return NextResponse.json({ error: `Only pending invitations can be revoked (current status: ${existing.status})` }, { status: 409 })
    }
    const invite = await payload.update({
      collection: 'member-invites',
      id,
      data: { status: 'revoked' },
      depth: 0,
      overrideAccess: true,
    })
    await payload.create({
      collection: 'membership-audit-log',
      data: {
        action: 'override',
        reason: `Member invitation revoked: ${reason}`,
        actor: admin.id,
        eventId: `member-invite:${String(invite.id)}:${randomUUID()}`,
        metadata: { kind: 'member-invite', operation: 'revoke', inviteId: invite.id, inviteCode: invite.code },
      },
      overrideAccess: true,
    })
    return NextResponse.json({ doc: { id: invite.id, status: invite.status } })
  } catch (error) {
    console.error('[admin/members/invites/[id]] PATCH error:', error)
    return NextResponse.json({ error: 'Failed to revoke invitation' }, { status: 500 })
  }
}
