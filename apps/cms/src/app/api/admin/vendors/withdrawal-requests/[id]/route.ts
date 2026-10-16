import { NextRequest, NextResponse } from 'next/server'
import { sql } from '@payloadcms/db-postgres'
import { getPayload } from 'payload'
import configPromise from '@payload-config'
import { authenticateAdmin } from '@/utils/mediaLibrary'
import {
  canTransitionWithdrawal,
  mapWithdrawalRow,
  type WithdrawalStatus,
} from '@/utils/withdrawalRequests'

type RouteContext = { params: Promise<{ id: string }> }

const allowedStatuses = new Set<WithdrawalStatus>(['approved', 'paid', 'rejected', 'cancelled'])

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const payload = await getPayload({ config: configPromise })
    const admin = await authenticateAdmin(payload, request)
    if (!admin) return NextResponse.json({ error: 'Unauthorized: admin authentication required' }, { status: 401 })

    const { id: rawId } = await context.params
    const id = Number(rawId)
    if (!Number.isSafeInteger(id) || id <= 0) return NextResponse.json({ error: 'Invalid request id' }, { status: 400 })
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
    const status = body.status as WithdrawalStatus
    if (!allowedStatuses.has(status)) return NextResponse.json({ error: 'status must be approved, paid, rejected, or cancelled' }, { status: 400 })
    const paymentReference = typeof body.paymentReference === 'string' ? body.paymentReference.trim() : ''
    const reason = typeof body.reason === 'string' ? body.reason.trim() : ''
    if (status === 'paid' && (!paymentReference || paymentReference.length > 200)) {
      return NextResponse.json({ error: 'paymentReference is required for paid requests and must be at most 200 characters' }, { status: 400 })
    }
    if ((status === 'rejected' || status === 'cancelled') && (!reason || reason.length > 500)) {
      return NextResponse.json({ error: 'A reason of 1 to 500 characters is required for rejection or cancellation' }, { status: 400 })
    }
    if (paymentReference.length > 200 || reason.length > 500) {
      return NextResponse.json({ error: 'paymentReference/reason exceeds the maximum length' }, { status: 400 })
    }
    const auditNote = reason ? `Admin ${status} (${Number(admin.id)}): ${reason}` : null

    const outcome = await payload.db.drizzle.transaction(async (tx) => {
      const locked = await tx.execute(sql`
        SELECT id, vendor_id, amount, currency, status, payout_destination, payment_reference, reason,
          idempotency_key, requested_by, requested_at, decided_by, decided_at, paid_by, paid_at,
          cancelled_by, cancelled_at, created_at, updated_at
        FROM vendor_withdrawal_requests
        WHERE id = ${id}
        FOR UPDATE
      `)
      const current = (locked as any).rows?.[0]
      if (!current) return { notFound: true as const }
      if (status === current.status) {
        if (status === 'paid' && current.payment_reference !== paymentReference) {
          return { replayConflict: true as const }
        }
        return {
          request: mapWithdrawalRow({
            ...current,
            vendorId: current.vendor_id,
            payoutDestination: current.payout_destination,
            paymentReference: current.payment_reference,
            idempotencyKey: current.idempotency_key,
            requestedBy: current.requested_by,
            requestedAt: current.requested_at,
            decidedBy: current.decided_by,
            decidedAt: current.decided_at,
            paidBy: current.paid_by,
            paidAt: current.paid_at,
            cancelledBy: current.cancelled_by,
            cancelledAt: current.cancelled_at,
            createdAt: current.created_at,
            updatedAt: current.updated_at,
          }),
          replay: true as const,
        }
      }
      if (!canTransitionWithdrawal(String(current.status), status)) {
        return { invalidTransition: true as const, currentStatus: String(current.status) }
      }
      const now = new Date().toISOString()
      const result = await tx.execute(sql`
        UPDATE vendor_withdrawal_requests
        SET status = ${status},
            reason = CASE
              WHEN ${auditNote} IS NOT NULL THEN concat_ws(E'\n\n', NULLIF(reason, ''), ${auditNote})
              ELSE reason
            END,
            payment_reference = CASE WHEN ${status} = 'paid' THEN ${paymentReference} ELSE payment_reference END,
            decided_by = CASE WHEN ${status} IN ('approved', 'rejected') THEN ${Number(admin.id)} ELSE decided_by END,
            decided_at = CASE WHEN ${status} IN ('approved', 'rejected') THEN ${now}::timestamptz ELSE decided_at END,
            paid_by = CASE WHEN ${status} = 'paid' THEN ${Number(admin.id)} ELSE paid_by END,
            paid_at = CASE WHEN ${status} = 'paid' THEN ${now}::timestamptz ELSE paid_at END,
            cancelled_by = CASE WHEN ${status} = 'cancelled' THEN ${Number(admin.id)} ELSE cancelled_by END,
            cancelled_at = CASE WHEN ${status} = 'cancelled' THEN ${now}::timestamptz ELSE cancelled_at END,
            updated_at = ${now}::timestamptz
        WHERE id = ${id}
        RETURNING id, vendor_id AS "vendorId", amount, status, payout_destination AS "payoutDestination",
          payment_reference AS "paymentReference", reason, idempotency_key AS "idempotencyKey",
          requested_by AS "requestedBy", requested_at AS "requestedAt", decided_by AS "decidedBy",
          decided_at AS "decidedAt", paid_by AS "paidBy", paid_at AS "paidAt",
          cancelled_by AS "cancelledBy", cancelled_at AS "cancelledAt",
          created_at AS "createdAt", updated_at AS "updatedAt"
      `)
      const updated = (result as any).rows?.[0]
      if (!updated) throw new Error('Withdrawal status update returned no row')
      return { request: mapWithdrawalRow(updated), replay: false as const }
    })
    if ('notFound' in outcome) return NextResponse.json({ error: 'Withdrawal request not found' }, { status: 404 })
    if ('replayConflict' in outcome) {
      return NextResponse.json({ error: 'Request is already paid with a different payment reference' }, { status: 409 })
    }
    if ('invalidTransition' in outcome) {
      return NextResponse.json({
        error: `Cannot transition request from ${outcome.currentStatus} to ${status}`,
        currentStatus: outcome.currentStatus,
      }, { status: 409 })
    }
    return NextResponse.json({ request: outcome.request, replay: outcome.replay })
  } catch (error) {
    console.error('[admin/vendors/withdrawal-requests] PATCH error:', error)
    return NextResponse.json({ error: 'Failed to update withdrawal request' }, { status: 500 })
  }
}
