/**
 * @file apps/cms/src/app/api/admin/transactions/[id]/route.ts
 * @description BFF for single transaction detail - admin-only safe boundary (read-only).
 * GET  /api/admin/transactions/[id] -> sanitized transaction + order population
 * PATCH/POST/PUT/DELETE -> 405 Method Not Allowed (read-only endpoint)
 */

import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import configPromise from '@payload-config'
import { authenticateAdmin } from '@/utils/mediaLibrary'

function optionalString(v: unknown): string | null {
  return typeof v === 'string' ? v.trim() || null : null
}
function str(v: unknown, fb = ''): string {
  return typeof v === 'string' ? v : fb
}
function num(v: unknown, fb = 0): number {
  if (typeof v === 'number' && Number.isFinite(v)) return v
  if (typeof v === 'string') {
    const n = Number(v)
    return Number.isFinite(n) ? n : fb
  }
  return fb
}
function sanitizeMediaRef(value: unknown): { id: number; url: string | null; filename: string | null } | null {
  if (!value || typeof value !== 'object') return null
  const src = value as Record<string, unknown>
  const id = Number(src.id)
  if (Number.isNaN(id)) return null
  const url =
    typeof src.cloudinaryURL === 'string' ? src.cloudinaryURL : typeof src.url === 'string' ? src.url : null
  return { id, url, filename: typeof src.filename === 'string' ? src.filename : null }
}

function sanitizeMerchantBrief(value: unknown): Record<string, any> | null {
  if (value == null) return null
  if (typeof value !== 'object') {
    const id = Number(value)
    if (Number.isNaN(id)) return null
    return { id, outletName: `Outlet #${id}`, outletCode: '', isActive: null, vendor: null }
  }
  const m = value as Record<string, any>
  const id = Number(m.id)
  if (Number.isNaN(id)) return null
  const rawVendor = m.vendor
  let vendor: Record<string, any> | null = null
  if (rawVendor && typeof rawVendor === 'object') {
    const v = rawVendor as Record<string, any>
    const vid = Number(v.id)
    if (!Number.isNaN(vid)) {
      vendor = { id: vid, businessName: str(v.businessName, ''), logo: sanitizeMediaRef(v.logo) }
    }
  } else if (rawVendor != null) {
    const vid = Number(rawVendor)
    if (!Number.isNaN(vid)) vendor = { id: vid, businessName: '', logo: null }
  }
  return {
    id,
    outletName: str(m.outletName, `Outlet #${id}`),
    outletCode: str(m.outletCode, ''),
    isActive: typeof m.isActive === 'boolean' ? m.isActive : null,
    vendor,
  }
}

function sanitizeCustomerBrief(value: unknown): Record<string, any> | null {
  if (value == null) return null
  if (typeof value !== 'object') {
    const id = Number(value)
    if (Number.isNaN(id)) return null
    return { id, email: '', user: null }
  }
  const c = value as Record<string, any>
  const id = Number(c.id)
  if (Number.isNaN(id)) return null
  const rawUser = c.user
  let user: Record<string, any> | null = null
  if (rawUser && typeof rawUser === 'object') {
    const u = rawUser as Record<string, any>
    const uid = Number(u.id)
    if (!Number.isNaN(uid)) {
      user = {
        id: uid,
        email: str(u.email, str(c.email, '')),
        firstName: str(u.firstName, ''),
        lastName: str(u.lastName, ''),
        phone: optionalString(u.phone),
      }
    }
  } else if (rawUser != null) {
    const uid = Number(rawUser)
    if (!Number.isNaN(uid)) user = { id: uid, email: str(c.email, ''), firstName: '', lastName: '', phone: null }
  }
  return { id, email: str(c.email, user ? str((user as any).email, '') : ''), user }
}

function sanitizeOrderBrief(value: unknown): Record<string, any> | null {
  if (value == null) return null
  if (typeof value !== 'object') {
    const id = Number(value)
    if (Number.isNaN(id)) return null
    return { id, status: '', total: 0, subtotal: 0, placed_at: null, fulfillment_type: '', merchant: null, customer: null }
  }
  const o = value as Record<string, any>
  const id = Number(o.id)
  if (Number.isNaN(id)) return null
  return {
    id,
    status: str(o.status, 'pending'),
    total: num(o.total, 0),
    subtotal: num(o.subtotal, 0),
    delivery_fee: num(o.delivery_fee, 0),
    platform_fee: num(o.platform_fee, 0),
    fulfillment_type: str(o.fulfillment_type, ''),
    placed_at: o.placed_at ? String(o.placed_at) : null,
    lalamove_order_id: optionalString(o.lalamove_order_id),
    delivery_status: str(o.delivery_status, 'none'),
    merchant: sanitizeMerchantBrief(o.merchant),
    customer: sanitizeCustomerBrief(o.customer),
    createdAt: String(o.createdAt ?? ''),
    updatedAt: String(o.updatedAt ?? ''),
  }
}

function sanitizeTransactionDoc(raw: Record<string, any>): Record<string, any> {
  const status = str(raw.status, 'pending').toLowerCase()
  return {
    id: raw.id,
    payment_intent_id: optionalString(raw.payment_intent_id),
    payment_method: optionalString(raw.payment_method),
    amount: num(raw.amount, 0),
    currency: str(raw.currency, 'PHP') || 'PHP',
    status,
    paid_at: raw.paid_at ? String(raw.paid_at) : null,
    createdAt: String(raw.createdAt ?? ''),
    updatedAt: String(raw.updatedAt ?? ''),
    order: sanitizeOrderBrief(raw.order),
    isPaid: status === 'paid',
  }
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const payload = await getPayload({ config: configPromise })
    const admin = await authenticateAdmin(payload, request)
    if (!admin) return NextResponse.json({ error: 'Unauthorized: admin authentication required' }, { status: 401 })

    const numericId = Number(id)
    const docId: number | string = Number.isFinite(numericId) ? numericId : id

    let doc: Record<string, any>
    try {
      doc = (await payload.findByID({
        collection: 'transactions',
        id: docId as number,
        depth: 2,
        overrideAccess: true,
      })) as unknown as Record<string, any>
    } catch (e: any) {
      return NextResponse.json({ error: 'Transaction not found', details: e?.message }, { status: 404 })
    }
    if (!doc) return NextResponse.json({ error: 'Transaction not found' }, { status: 404 })

    // Enrich order with depth 2 fetch to ensure customer.user and merchant.vendor are populated
    // If transaction already has order populated, try to refresh it with a dedicated order query
    let enrichedOrder: unknown = doc.order
    const rawOrderId =
      doc.order && typeof doc.order === 'object' ? (doc.order as any).id : doc.order
    if (rawOrderId != null) {
      const orderIdNum = Number(rawOrderId)
      const orderId: number | string = Number.isFinite(orderIdNum) ? orderIdNum : String(rawOrderId)
      try {
        const orderDoc = (await payload.findByID({
          collection: 'orders',
          id: orderId as number,
          depth: 2,
          overrideAccess: true,
        })) as unknown as Record<string, any>
        if (orderDoc) enrichedOrder = orderDoc
      } catch {
        // fallback to already populated order
      }
    }

    const docWithEnrichedOrder = { ...doc, order: enrichedOrder }
    const sanitized = sanitizeTransactionDoc(docWithEnrichedOrder)
    return NextResponse.json({ doc: sanitized })
  } catch (err: any) {
    console.error('[admin/transactions/[id]] GET error:', err)
    return NextResponse.json({ error: err?.message || 'Failed to load transaction' }, { status: 500 })
  }
}

function methodNotAllowed() {
  return NextResponse.json({ error: 'Method Not Allowed: transactions BFF is read-only' }, { status: 405 })
}

export async function PATCH() {
  return methodNotAllowed()
}
export async function POST() {
  return methodNotAllowed()
}
export async function PUT() {
  return methodNotAllowed()
}
export async function DELETE() {
  return methodNotAllowed()
}
