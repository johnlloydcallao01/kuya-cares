import type { Payload } from 'payload'
import { sql } from '@payloadcms/db-postgres'

export type WithdrawalStatus = 'pending' | 'approved' | 'paid' | 'rejected' | 'cancelled'

export interface WithdrawalBalance {
  lifetimePayable: number
  reserved: number
  paid: number
  available: number
  currency: 'PHP'
}

export interface WithdrawalRequestRecord {
  id: number
  vendorId: number
  vendorName: string | null
  amount: number
  currency: 'PHP'
  status: WithdrawalStatus
  payoutDestination: string
  paymentReference: string | null
  reason: string | null
  idempotencyKey: string | null
  requestedBy: number
  requestedAt: string
  decidedBy: number | null
  decidedAt: string | null
  paidBy: number | null
  paidAt: string | null
  cancelledBy: number | null
  cancelledAt: string | null
  createdAt: string
  updatedAt: string
}

type Transaction = any

function rows<T>(result: unknown): T[] {
  if (Array.isArray(result)) return result as T[]
  if (result && typeof result === 'object' && 'rows' in result) {
    const resultRows = (result as { rows?: unknown }).rows
    if (Array.isArray(resultRows)) return resultRows as T[]
  }
  return []
}

function amount(value: unknown): number {
  const numeric = Number(value ?? 0)
  return Number.isFinite(numeric) ? Math.round(numeric * 100) / 100 : 0
}

export function parsePhpAmount(value: unknown): number | null {
  const raw = typeof value === 'string' ? value.trim() : value
  if (typeof raw !== 'number' && typeof raw !== 'string') return null
  if (typeof raw === 'string' && !/^\d+(?:\.\d{1,2})?$/.test(raw)) return null
  const parsed = typeof raw === 'number' ? raw : Number(raw)
  const cents = Math.round(parsed * 100)
  if (
    !Number.isFinite(parsed) ||
    parsed < 1 ||
    !Number.isSafeInteger(cents) ||
    Math.abs(parsed * 100 - cents) > 0.000001
  ) {
    return null
  }
  return cents / 100
}

export function calculateWithdrawalBalance(totals: {
  lifetimePayable: unknown
  reserved: unknown
  paid: unknown
}): WithdrawalBalance {
  const lifetimePayable = amount(totals.lifetimePayable)
  const reserved = amount(totals.reserved)
  const paid = amount(totals.paid)
  return {
    lifetimePayable,
    reserved,
    paid,
    available: Math.max(0, amount(lifetimePayable - reserved - paid)),
    currency: 'PHP',
  }
}

export function canTransitionWithdrawal(from: string, to: WithdrawalStatus): boolean {
  const transitions: Record<string, WithdrawalStatus[]> = {
    pending: ['approved', 'rejected', 'cancelled'],
    approved: ['paid', 'cancelled'],
  }
  return from === to || !!transitions[from]?.includes(to)
}

export function getOwnedActiveVendorIds(userId: number, vendorDocs: Array<Record<string, unknown>>): number[] {
  return vendorDocs
    .filter((vendor) => {
      const rawUser = vendor.user
      const ownerId =
        rawUser && typeof rawUser === 'object' && 'id' in rawUser
          ? Number((rawUser as { id: unknown }).id)
          : Number(rawUser)
      return ownerId === userId && vendor.isActive !== false
    })
    .map((vendor) => Number(vendor.id))
    .filter((id) => Number.isSafeInteger(id) && id > 0)
}

export function mapWithdrawalRow(row: Record<string, unknown>): WithdrawalRequestRecord {
  return {
    id: Number(row.id),
    vendorId: Number(row.vendorId),
    vendorName: row.vendorName == null ? null : String(row.vendorName),
    amount: amount(row.amount),
    currency: 'PHP',
    status: row.status as WithdrawalStatus,
    payoutDestination: String(row.payoutDestination ?? ''),
    paymentReference: row.paymentReference == null ? null : String(row.paymentReference),
    reason: row.reason == null ? null : String(row.reason),
    idempotencyKey: row.idempotencyKey == null ? null : String(row.idempotencyKey),
    requestedBy: Number(row.requestedBy),
    requestedAt: String(row.requestedAt),
    decidedBy: row.decidedBy == null ? null : Number(row.decidedBy),
    decidedAt: row.decidedAt == null ? null : String(row.decidedAt),
    paidBy: row.paidBy == null ? null : Number(row.paidBy),
    paidAt: row.paidAt == null ? null : String(row.paidAt),
    cancelledBy: row.cancelledBy == null ? null : Number(row.cancelledBy),
    cancelledAt: row.cancelledAt == null ? null : String(row.cancelledAt),
    createdAt: String(row.createdAt),
    updatedAt: String(row.updatedAt),
  }
}

async function getBalance(
  queryable: { execute: (query: any) => Promise<unknown> },
  vendorId: number,
): Promise<WithdrawalBalance> {
  const result = await queryable.execute(sql`
    SELECT
      COALESCE((
        SELECT SUM(GREATEST(COALESCE(o.commission_vendor_net, 0), 0))
        FROM orders o
        JOIN merchants m ON m.id = o.merchant_id
        WHERE m.vendor_id = ${vendorId}
          AND EXISTS (
            SELECT 1 FROM transactions t
            WHERE t.order_id = o.id
              AND t.status IN ('paid', 'partially_refunded')
          )
      ), 0) + COALESCE((
        SELECT SUM(e.commission_vendor_net)
        FROM vendor_commission_entries e
        WHERE e.vendor_id = ${vendorId}
          AND e.entry_type = 'adjustment'
          AND e.currency = 'PHP'
      ), 0) AS lifetime_payable,
      COALESCE((
        SELECT SUM(w.amount)
        FROM vendor_withdrawal_requests w
        WHERE w.vendor_id = ${vendorId} AND w.status IN ('pending', 'approved')
      ), 0) AS reserved,
      COALESCE((
        SELECT SUM(w.amount)
        FROM vendor_withdrawal_requests w
        WHERE w.vendor_id = ${vendorId} AND w.status = 'paid'
      ), 0) AS paid
  `)
  const summary = rows<Record<string, unknown>>(result)[0] ?? {}
  return calculateWithdrawalBalance({
    lifetimePayable: summary.lifetime_payable,
    reserved: summary.reserved,
    paid: summary.paid,
  })
}

export async function getWithdrawalBalance(
  payload: Payload,
  vendorId: number,
): Promise<WithdrawalBalance> {
  return getBalance(payload.db.drizzle as any, vendorId)
}

export async function lockVendor(tx: Transaction, vendorId: number, userId: number): Promise<boolean> {
  const result = await tx.execute(sql`
    SELECT id
    FROM vendors
    WHERE id = ${vendorId} AND user_id = ${userId} AND is_active = true
    FOR UPDATE
  `)
  return rows<Record<string, unknown>>(result).length > 0
}

export async function getLockedWithdrawalBalance(
  tx: Transaction,
  vendorId: number,
): Promise<WithdrawalBalance> {
  return getBalance(tx, vendorId)
}

export async function findIdempotentWithdrawal(
  tx: Transaction,
  vendorId: number,
  key: string,
): Promise<WithdrawalRequestRecord | null> {
  const result = await tx.execute(sql`
    SELECT id, vendor_id AS "vendorId", amount, status, payout_destination AS "payoutDestination",
      payment_reference AS "paymentReference", reason, idempotency_key AS "idempotencyKey",
      requested_by AS "requestedBy", requested_at AS "requestedAt", decided_by AS "decidedBy",
      decided_at AS "decidedAt", paid_by AS "paidBy", paid_at AS "paidAt",
      cancelled_by AS "cancelledBy", cancelled_at AS "cancelledAt",
      created_at AS "createdAt", updated_at AS "updatedAt"
    FROM vendor_withdrawal_requests
    WHERE vendor_id = ${vendorId} AND idempotency_key = ${key}
    LIMIT 1
  `)
  const row = rows<Record<string, unknown>>(result)[0]
  return row ? mapWithdrawalRow(row) : null
}

export async function listWithdrawalRows(
  queryable: { execute: (query: any) => Promise<unknown> },
  filter: { vendorIds?: number[]; vendorId?: number; status?: WithdrawalStatus; limit: number; offset: number },
): Promise<WithdrawalRequestRecord[]> {
  const where: any[] = []
  if (filter.vendorIds) {
    if (filter.vendorIds.length === 0) return []
    where.push(sql`w.vendor_id IN (${sql.join(filter.vendorIds.map((id) => sql`${id}`), sql`, `)})`)
  }
  if (filter.vendorId != null) where.push(sql`w.vendor_id = ${filter.vendorId}`)
  if (filter.status) where.push(sql`w.status = ${filter.status}`)
  const whereSql = where.length ? sql`WHERE ${sql.join(where, sql` AND `)}` : sql``
  const result = await queryable.execute(sql`
    SELECT w.id, w.vendor_id AS "vendorId", v.business_name AS "vendorName",
      w.amount, w.status, w.payout_destination AS "payoutDestination",
      w.payment_reference AS "paymentReference", w.reason, w.idempotency_key AS "idempotencyKey",
      w.requested_by AS "requestedBy", w.requested_at AS "requestedAt", w.decided_by AS "decidedBy",
      w.decided_at AS "decidedAt", w.paid_by AS "paidBy", w.paid_at AS "paidAt",
      w.cancelled_by AS "cancelledBy", w.cancelled_at AS "cancelledAt",
      w.created_at AS "createdAt", w.updated_at AS "updatedAt"
    FROM vendor_withdrawal_requests w
    JOIN vendors v ON v.id = w.vendor_id
    ${whereSql}
    ORDER BY w.created_at DESC, w.id DESC
    LIMIT ${filter.limit} OFFSET ${filter.offset}
  `)
  return rows<Record<string, unknown>>(result).map(mapWithdrawalRow)
}
