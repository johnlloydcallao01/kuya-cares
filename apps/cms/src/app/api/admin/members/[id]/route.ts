import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'node:crypto'
import { getPayload } from 'payload'
import configPromise from '@payload-config'
import { authenticateAdmin } from '@/utils/mediaLibrary'

type RecordValue = Record<string, any>

function relatedBrief(value: unknown) {
  if (value == null) return null
  const doc = typeof value === 'object' ? value as RecordValue : { id: value }
  return {
    id: doc.id,
    title: String(doc.title ?? doc.name ?? doc.paymentReference ?? ''),
    status: String(doc.status ?? ''),
  }
}

function userBrief(value: unknown) {
  if (value == null) return null
  const user = typeof value === 'object' ? value as RecordValue : { id: value }
  return {
    id: user.id,
    email: String(user.email ?? ''),
    firstName: String(user.firstName ?? ''),
    lastName: String(user.lastName ?? ''),
  }
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const payload = await getPayload({ config: configPromise })
    const admin = await authenticateAdmin(payload, request)
    if (!admin) return NextResponse.json({ error: 'Unauthorized: admin authentication required' }, { status: 401 })

    const { id: rawId } = await params
    const id = Number(rawId)
    if (!Number.isSafeInteger(id) || id <= 0) return NextResponse.json({ error: 'Invalid member ID' }, { status: 400 })

    const memberResult = await payload.find({
      collection: 'users',
      where: { and: [{ id: { equals: id } }, { role: { equals: 'member' } }] },
      limit: 1,
      depth: 0,
      overrideAccess: true,
    })
    const member = memberResult.docs[0]
    if (!member) return NextResponse.json({ error: 'Member not found' }, { status: 404 })

    const [payments, invites, orders, settings, vendors] = await Promise.all([
      payload.find({
        collection: 'member-membership-payments',
        where: { user: { equals: id } },
        sort: '-createdAt',
        limit: 100,
        depth: 0,
        overrideAccess: true,
      }),
      payload.find({
        collection: 'member-invites',
        where: { or: [{ invitedBy: { equals: id } }, { claimedBy: { equals: id } }] },
        sort: '-createdAt',
        limit: 100,
        depth: 1,
        overrideAccess: true,
      }),
      payload.find({
        collection: 'member-orders',
        where: { or: [{ buyer: { equals: id } }, { seller: { equals: id } }] },
        sort: '-createdAt',
        limit: 100,
        depth: 1,
        overrideAccess: true,
      }),
      payload.findGlobal({ slug: 'system-settings' }),
      payload.find({
        collection: 'vendors',
        where: { user: { equals: id } },
        sort: 'businessName',
        limit: 100,
        depth: 0,
        overrideAccess: true,
      }),
    ])
    const configuredFee = Number((settings as RecordValue)?.membership?.memberMembershipFeePhp)

    const safeMember = {
      id: member.id,
      email: member.email,
      firstName: member.firstName ?? '',
      lastName: member.lastName ?? '',
      middleName: member.middleName ?? null,
      username: member.username ?? null,
      phone: member.phone ?? null,
      isActive: member.isActive !== false,
      membershipStatus: member.memberMembershipStatus ?? 'pending_payment',
      membershipPaidAt: member.memberMembershipPaidAt ?? null,
      createdAt: member.createdAt,
      lastLogin: member.lastLogin ?? null,
    }

    return NextResponse.json({
      member: safeMember,
      vendors: vendors.docs.map((vendor) => ({
        id: vendor.id,
        businessName: String(vendor.businessName ?? ''),
      })),
      membershipFeePhp: Number.isFinite(configuredFee) ? configuredFee : null,
      payments: {
        docs: payments.docs.map((doc) => ({
          id: doc.id,
          amount: Number(doc.amount ?? 0),
          currency: String(doc.currency ?? 'PHP'),
          status: String(doc.status ?? 'pending'),
          paymentProvider: String(doc.paymentProvider ?? ''),
          paymentReference: String(doc.paymentReference ?? ''),
          paidAt: doc.paidAt ?? null,
          createdAt: doc.createdAt,
        })),
        totalDocs: payments.totalDocs,
      },
      invites: {
        docs: invites.docs.map((doc) => ({
          id: doc.id,
          code: doc.code,
          email: doc.email ?? null,
          status: doc.status,
          invitedBy: userBrief(doc.invitedBy),
          claimedBy: userBrief(doc.claimedBy),
          expiresAt: doc.expiresAt ?? null,
          claimedAt: doc.claimedAt ?? null,
          createdAt: doc.createdAt,
        })),
        totalDocs: invites.totalDocs,
      },
      orders: {
        docs: orders.docs.map((doc) => ({
          id: doc.id,
          listing: relatedBrief(doc.listing),
          buyer: userBrief(doc.buyer),
          seller: userBrief(doc.seller),
          price: Number(doc.price ?? 0),
          currency: 'PHP',
          status: doc.status,
          createdAt: doc.createdAt,
          completedAt: doc.completedAt ?? null,
        })),
        totalDocs: orders.totalDocs,
      },
    }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    console.error('[admin/members/[id]] GET error:', error)
    return NextResponse.json({ error: 'Failed to load member details' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const payload = await getPayload({ config: configPromise })
    const admin = await authenticateAdmin(payload, request)
    if (!admin) return NextResponse.json({ error: 'Unauthorized: admin authentication required' }, { status: 401 })

    const { id: rawId } = await params
    const id = Number(rawId)
    if (!Number.isSafeInteger(id) || id <= 0) return NextResponse.json({ error: 'Invalid member ID' }, { status: 400 })

    let body: Record<string, unknown>
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
    }
    if (body.membershipStatus !== 'active' && body.membershipStatus !== 'pending_payment') {
      return NextResponse.json(
        { error: 'membershipStatus must be active or pending_payment' },
        { status: 400 },
      )
    }

    const memberResult = await payload.find({
      collection: 'users',
      where: { and: [{ id: { equals: id } }, { role: { equals: 'member' } }] },
      limit: 1,
      depth: 0,
      overrideAccess: true,
    })
    const member = memberResult.docs[0]
    if (!member) return NextResponse.json({ error: 'Member not found' }, { status: 404 })

    const previousStatus = member.memberMembershipStatus ?? 'pending_payment'
    const updated = await payload.update({
      collection: 'users',
      id,
      data: { memberMembershipStatus: body.membershipStatus },
      depth: 0,
      overrideAccess: true,
    })
    if (previousStatus !== body.membershipStatus) {
      await payload.create({
        collection: 'membership-audit-log',
        data: {
          action: 'override',
          reason: `Member membership status changed from ${previousStatus} to ${body.membershipStatus}`,
          actor: admin.id,
          eventId: `member-status:${id}:${randomUUID()}`,
          metadata: {
            kind: 'member',
            memberId: id,
            email: member.email,
            previousStatus,
            membershipStatus: body.membershipStatus,
          },
        },
        overrideAccess: true,
      })
    }

    return NextResponse.json({
      member: {
        id: updated.id,
        membershipStatus: updated.memberMembershipStatus ?? 'pending_payment',
        membershipPaidAt: updated.memberMembershipPaidAt ?? null,
      },
    }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    console.error('[admin/members/[id]] PATCH error:', error)
    return NextResponse.json({ error: 'Failed to update member membership status' }, { status: 500 })
  }
}
