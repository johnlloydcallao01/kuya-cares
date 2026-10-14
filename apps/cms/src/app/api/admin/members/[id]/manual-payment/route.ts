import { randomUUID } from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import configPromise from '@payload-config'
import { deleteCachedByPrefix } from '@encreasl/cache'
import { authenticateAdmin } from '@/utils/mediaLibrary'

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const payload = await getPayload({ config: configPromise })
    const admin = await authenticateAdmin(payload, request)
    if (!admin) return NextResponse.json({ error: 'Unauthorized: admin authentication required' }, { status: 401 })

    const { id: rawId } = await params
    const userId = Number(rawId)
    if (!Number.isSafeInteger(userId) || userId <= 0) return NextResponse.json({ error: 'Invalid member ID' }, { status: 400 })

    const memberResult = await payload.find({
      collection: 'users',
      where: { and: [{ id: { equals: userId } }, { role: { equals: 'member' } }] },
      limit: 1,
      depth: 0,
      overrideAccess: true,
    })
    const member = memberResult.docs[0]
    if (!member) return NextResponse.json({ error: 'Member not found' }, { status: 404 })
    if (member.memberMembershipStatus === 'active') {
      return NextResponse.json({ error: 'This member already has an active lifetime membership' }, { status: 409 })
    }

    let body: Record<string, unknown>
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
    }
    const reason = typeof body.reason === 'string' ? body.reason.trim() : ''
    if (reason.length < 5 || reason.length > 500) {
      return NextResponse.json({ error: 'Provide an offline payment reason of 5 to 500 characters' }, { status: 400 })
    }

    const settings = await payload.findGlobal({ slug: 'system-settings' })
    const expectedAmount = Number((settings as Record<string, any>)?.membership?.memberMembershipFeePhp)
    if (!Number.isFinite(expectedAmount) || expectedAmount <= 0) {
      return NextResponse.json({ error: 'The lifetime member fee is not configured in System Settings' }, { status: 409 })
    }
    const amountInCents = Math.round(expectedAmount * 100)
    if (
      !Number.isSafeInteger(amountInCents) ||
      amountInCents < 100 ||
      Math.abs(expectedAmount * 100 - amountInCents) > 0.000001
    ) {
      return NextResponse.json({ error: 'The configured member fee is not a valid PayMongo-compatible amount' }, { status: 409 })
    }
    const amount = amountInCents / 100
    const now = new Date().toISOString()
    const referenceId = randomUUID()
    const idempotencyKey = `manual-member-membership:${userId}`

    const priorPaid = await payload.find({
      collection: 'member-membership-payments',
      where: { and: [{ user: { equals: userId } }, { status: { equals: 'paid' } }] },
      sort: '-paidAt',
      limit: 1,
      depth: 0,
      overrideAccess: true,
    })
    if (priorPaid.docs[0]) {
      const paidPayment = priorPaid.docs[0]
      await payload.update({
        collection: 'users',
        id: userId,
        data: {
          memberMembershipStatus: 'active',
          memberMembershipPaidAt: paidPayment.paidAt ?? now,
        } as never,
        overrideAccess: true,
      })
      await deleteCachedByPrefix('admin:users:')
      return NextResponse.json({
        error: 'A paid membership record already exists. Member status was reconciled; refresh the member record.',
        reconciled: true,
      }, { status: 409 })
    }

    let payment
    try {
      payment = await payload.create({
        collection: 'member-membership-payments',
        data: {
          user: userId,
          amount,
          currency: 'PHP',
          status: 'paid',
          paymentProvider: 'manual',
          paymentReference: `MAN-MEM-${userId}-${referenceId}`,
          memberMembershipIdempotencyKey: idempotencyKey,
          paidAt: now,
        },
        depth: 0,
        overrideAccess: true,
      })
    } catch (error) {
      const concurrentPayment = await payload.find({
        collection: 'member-membership-payments',
        where: { and: [{ user: { equals: userId } }, { memberMembershipIdempotencyKey: { equals: idempotencyKey } }] },
        limit: 1,
        depth: 0,
        overrideAccess: true,
      })
      if (!concurrentPayment.docs[0]) throw error

      const existingPayment = concurrentPayment.docs[0]
      if (existingPayment.status === 'paid') {
        await payload.update({
          collection: 'users',
          id: userId,
          data: {
            memberMembershipStatus: 'active',
            memberMembershipPaidAt: existingPayment.paidAt ?? now,
          } as never,
          overrideAccess: true,
        })
        await deleteCachedByPrefix('admin:users:')
        return NextResponse.json({
          error: 'A manual membership payment was recorded concurrently. Member status was reconciled; refresh the member record.',
          reconciled: true,
        }, { status: 409 })
      }

      throw error
    }
    await payload.update({
      collection: 'users',
      id: userId,
      data: {
        memberMembershipStatus: 'active',
        memberMembershipPaidAt: now,
      } as never,
      overrideAccess: true,
    })
    await payload.create({
      collection: 'membership-audit-log',
      data: {
        action: 'admin_approve',
        reason,
        actor: admin.id,
        eventId: `member-manual-payment:${String(payment.id)}:${referenceId}`,
        metadata: {
          kind: 'member-membership-payment',
          operation: 'offline-payment-recorded',
          memberUserId: userId,
          paymentId: payment.id,
          amount,
          currency: 'PHP',
          provider: 'manual',
        },
      },
      overrideAccess: true,
    })
    await deleteCachedByPrefix('admin:users:')
    return NextResponse.json({
      doc: {
        id: payment.id,
        amount,
        currency: 'PHP',
        status: 'paid',
        paymentProvider: 'manual',
        paymentReference: `MAN-MEM-${userId}-${referenceId}`,
        paidAt: now,
      },
    }, { status: 201 })
  } catch (error) {
    console.error('[admin/members/[id]/manual-payment] POST error:', error)
    return NextResponse.json({ error: 'Failed to record the offline membership payment' }, { status: 500 })
  }
}
