import { NextRequest, NextResponse } from 'next/server'
import { sql } from '@payloadcms/db-postgres'
import { getPayload } from 'payload'
import configPromise from '@payload-config'
import { authenticateVendorOrMember } from '@/utils/mediaLibrary'
import {
  findIdempotentWithdrawal,
  getOwnedActiveVendorIds,
  getLockedWithdrawalBalance,
  getWithdrawalBalance,
  listWithdrawalRows,
  lockVendor,
  mapWithdrawalRow,
  parsePhpAmount,
} from '@/utils/withdrawalRequests'

export async function GET(request: NextRequest) {
  try {
    const payload = await getPayload({ config: configPromise })
    const user = await authenticateVendorOrMember(payload, request)
    if (!user) return NextResponse.json({ error: 'Vendor/member authentication required' }, { status: 401 })

    const vendorResult = await payload.find({
      collection: 'vendors',
      where: { and: [{ user: { equals: user.id } }, { isActive: { equals: true } }] },
      limit: 100,
      depth: 0,
      pagination: false,
      overrideAccess: true,
    })
    const vendorDocs = vendorResult.docs as unknown as Array<Record<string, unknown>>
    const vendorIds = getOwnedActiveVendorIds(Number(user.id), vendorDocs)
    const params = request.nextUrl.searchParams
    const rawLimit = Number(params.get('limit') ?? 25)
    const rawOffset = Number(params.get('offset') ?? 0)
    if (!Number.isSafeInteger(rawLimit) || rawLimit < 1 || !Number.isSafeInteger(rawOffset) || rawOffset < 0) {
      return NextResponse.json({ error: 'limit must be at least 1 and offset must be a non-negative whole number' }, { status: 400 })
    }
    const limit = Math.min(100, rawLimit)
    const offset = rawOffset
    const [requests, vendorBalances] = await Promise.all([
      listWithdrawalRows(payload.db.drizzle as any, { vendorIds, limit, offset }),
      Promise.all(vendorIds.map(async (id) => {
        const vendor = vendorDocs.find((doc) => Number(doc.id) === id)
        return {
          vendorId: id,
          vendorName: vendor?.businessName == null ? null : String(vendor.businessName),
          ...await getWithdrawalBalance(payload, id),
        }
      })),
    ])
    const balance = vendorBalances.reduce(
      (total, item) => ({
        lifetimePayable: total.lifetimePayable + item.lifetimePayable,
        reserved: total.reserved + item.reserved,
        paid: total.paid + item.paid,
        available: total.available + item.available,
        currency: 'PHP' as const,
      }),
      { lifetimePayable: 0, reserved: 0, paid: 0, available: 0, currency: 'PHP' as const },
    )
    return NextResponse.json({ requests, balance, vendorBalances, pagination: { limit, offset } })
  } catch (error) {
    console.error('[vendor/withdrawal-requests] GET error:', error)
    return NextResponse.json({ error: 'Failed to load withdrawal requests' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const payload = await getPayload({ config: configPromise })
    const user = await authenticateVendorOrMember(payload, request)
    if (!user) return NextResponse.json({ error: 'Vendor/member authentication required' }, { status: 401 })

    let body: Record<string, unknown>
    try {
      const parsed = await request.json()
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        return NextResponse.json({ error: 'Request body must be a JSON object' }, { status: 400 })
      }
      body = parsed as Record<string, unknown>
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
    }
    const requestAmount = parsePhpAmount(body.amount)
    if (requestAmount == null) {
      return NextResponse.json({ error: 'amount must be at least PHP 1 with no more than two decimal places' }, { status: 400 })
    }
    const payoutDestination = typeof body.payoutDestination === 'string' ? body.payoutDestination.trim() : ''
    if (!payoutDestination || payoutDestination.length > 1000) {
      return NextResponse.json({ error: 'payoutDestination is required and must be at most 1000 characters' }, { status: 400 })
    }
    const reason = typeof body.reason === 'string' ? body.reason.trim() : ''
    if (reason.length > 500) {
      return NextResponse.json({ error: 'reason must be at most 500 characters' }, { status: 400 })
    }
    const idempotencyKey = (request.headers.get('Idempotency-Key') || body.idempotencyKey || '').toString().trim() || null
    if (!idempotencyKey || idempotencyKey.length > 200) {
      return NextResponse.json({ error: 'Idempotency-Key is required and must be at most 200 characters' }, { status: 400 })
    }

    const rawVendorId = body.vendorId == null || body.vendorId === '' ? null : Number(body.vendorId)
    if (rawVendorId != null && (!Number.isSafeInteger(rawVendorId) || rawVendorId <= 0)) {
      return NextResponse.json({ error: 'vendorId must be a positive integer' }, { status: 400 })
    }
    const vendorResult = await payload.find({
      collection: 'vendors',
      where: { and: [{ user: { equals: user.id } }, { isActive: { equals: true } }] },
      limit: 100,
      depth: 0,
      pagination: false,
      overrideAccess: true,
    })
    const vendorIds = getOwnedActiveVendorIds(Number(user.id), vendorResult.docs as unknown as Array<Record<string, unknown>>)
    if (vendorIds.length === 0) return NextResponse.json({ error: 'No active vendor account is linked to this user' }, { status: 403 })
    if (rawVendorId != null && !vendorIds.includes(rawVendorId)) {
      return NextResponse.json({ error: 'The selected vendor account is not linked to this user' }, { status: 403 })
    }
    if (rawVendorId == null && vendorIds.length !== 1) {
      return NextResponse.json({ error: 'Select the vendor account for this withdrawal request' }, { status: 400 })
    }
    const vendorId = rawVendorId ?? vendorIds[0]
    if (!Number.isSafeInteger(vendorId) || vendorId <= 0) return NextResponse.json({ error: 'Invalid vendor account' }, { status: 409 })

    const created = await payload.db.drizzle.transaction(async (tx) => {
      if (!(await lockVendor(tx as any, vendorId, Number(user.id)))) {
        return { vendorUnavailable: true as const }
      }
      const existing = await findIdempotentWithdrawal(tx as any, vendorId, idempotencyKey)
      if (existing) {
        if (existing.amount !== requestAmount || existing.payoutDestination !== payoutDestination) {
          return { conflict: true as const }
        }
        return { request: existing, replay: true as const }
      }
      const balance = await getLockedWithdrawalBalance(tx as any, vendorId)
      if (requestAmount > balance.available) return { insufficient: true as const, balance }
      const result = await tx.execute(sql`
        INSERT INTO vendor_withdrawal_requests
          (vendor_id, amount, currency, status, payout_destination, reason, idempotency_key, requested_by, requested_at, updated_at, created_at)
        VALUES
          (${vendorId}, ${requestAmount}, 'PHP', 'pending', ${payoutDestination}, ${reason || null}, ${idempotencyKey}, ${Number(user.id)}, now(), now(), now())
        RETURNING id, vendor_id AS "vendorId", amount, status, payout_destination AS "payoutDestination",
          payment_reference AS "paymentReference", reason, idempotency_key AS "idempotencyKey",
          requested_by AS "requestedBy", requested_at AS "requestedAt", decided_by AS "decidedBy",
          decided_at AS "decidedAt", paid_by AS "paidBy", paid_at AS "paidAt",
          cancelled_by AS "cancelledBy", cancelled_at AS "cancelledAt",
          created_at AS "createdAt", updated_at AS "updatedAt"
      `)
      const row = (result as any).rows?.[0]
      if (!row) throw new Error('Withdrawal request insert returned no row')
      return { request: mapWithdrawalRow(row), replay: false as const }
    })
    if ('vendorUnavailable' in created) {
      return NextResponse.json({ error: 'Vendor account is no longer active or linked to this user' }, { status: 403 })
    }
    if ('conflict' in created) return NextResponse.json({ error: 'Idempotency key was already used with different request details' }, { status: 409 })
    if ('insufficient' in created) return NextResponse.json({ error: 'Insufficient available balance', balance: created.balance }, { status: 409 })
    return NextResponse.json({ request: created.request, replay: created.replay }, { status: created.replay ? 200 : 201 })
  } catch (error) {
    console.error('[vendor/withdrawal-requests] POST error:', error)
    return NextResponse.json({ error: 'Failed to create withdrawal request' }, { status: 500 })
  }
}
