/**
 * @file apps/cms/src/app/api/admin/customers/[id]/route.ts
 * @description BFF for single customer (detail, update, delete) - admin-only safe boundary.
 * Mirrors apps/cms/src/app/api/admin/vendors/[id]/route.ts but for customers collection.
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
function sanitizeMediaRef(value: unknown): { id: number; url: string | null; filename: string | null } | null {
  if (!value || typeof value !== 'object') return null
  const src = value as Record<string, unknown>
  const id = Number(src.id)
  if (Number.isNaN(id)) return null
  const url = typeof src.cloudinaryURL === 'string' ? src.cloudinaryURL : typeof src.url === 'string' ? src.url : null
  return { id, url, filename: typeof src.filename === 'string' ? src.filename : null }
}
function sanitizeUserBrief(value: unknown): Record<string, any> | null {
  if (!value || typeof value !== 'object') return null
  const u = value as Record<string, any>
  const id = Number(u.id)
  if (Number.isNaN(id)) return null
  return {
    id,
    email: str(u.email, ''),
    firstName: str(u.firstName, ''),
    lastName: str(u.lastName, ''),
    middleName: optionalString(u.middleName),
    phone: optionalString(u.phone),
    username: optionalString(u.username),
    role: str(u.role, 'customer'),
    isActive: typeof u.isActive === 'boolean' ? u.isActive : true,
    birthDate: u.birthDate ? String(u.birthDate) : null,
    profilePicture: sanitizeMediaRef(u.profilePicture),
    createdAt: String(u.createdAt ?? ''),
    updatedAt: String(u.updatedAt ?? ''),
  }
}
function sanitizeAddressBrief(value: unknown): Record<string, any> | null {
  if (!value || typeof value !== 'object') return null
  const a = value as Record<string, any>
  const id = Number(a.id)
  if (Number.isNaN(id)) return null
  return {
    id,
    formatted_address: str(a.formatted_address, ''),
    locality: optionalString(a.locality),
    administrative_area_level_1: optionalString(a.administrative_area_level_1),
    postal_code: optionalString(a.postal_code),
    address_type: optionalString(a.address_type),
    is_default: !!a.is_default,
    is_verified: !!a.is_verified,
    latitude: typeof a.latitude === 'number' ? a.latitude : null,
    longitude: typeof a.longitude === 'number' ? a.longitude : null,
  }
}
function sanitizeCustomerDoc(raw: Record<string, any>, orderCount: number, addressCount: number, recentOrders?: any[]): Record<string, any> {
  const userBrief = sanitizeUserBrief(raw.user)
  const addressBrief = sanitizeAddressBrief(raw.activeAddress)
  return {
    id: raw.id,
    email: optionalString(raw.email) || (userBrief ? userBrief.email : ''),
    srn: optionalString(raw.srn),
    couponCode: optionalString(raw.couponCode),
    enrollmentDate: raw.enrollmentDate ? String(raw.enrollmentDate) : null,
    currentLevel: optionalString(raw.currentLevel) || 'beginner',
    activeAddress: addressBrief,
    user: userBrief,
    isActive: userBrief ? userBrief.isActive : true,
    orderCount,
    addressCount,
    recentOrders: recentOrders ?? [],
    createdAt: String(raw.createdAt ?? ''),
    updatedAt: String(raw.updatedAt ?? ''),
  }
}

const LEVEL_SET = new Set(['beginner', 'intermediate', 'advanced'])

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const payload = await getPayload({ config: configPromise })
    const admin = await authenticateAdmin(payload, request)
    if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const numericId = Number(id)
    const docId: number | string = Number.isFinite(numericId) ? numericId : id
    let doc: Record<string, any>
    try {
      doc = (await payload.findByID({ collection: 'customers', id: docId as number, depth: 2, overrideAccess: true })) as unknown as Record<string, any>
    } catch (e: any) {
      return NextResponse.json({ error: 'Customer not found', details: e?.message }, { status: 404 })
    }
    if (!doc) return NextResponse.json({ error: 'Customer not found' }, { status: 404 })

    const userId = (doc.user as any)?.id ?? doc.user
    const uidNum = Number(userId)

    const [ordersRes, addressesRes, recentEventsRes, wishlistsRes] = await Promise.all([
      payload
        .find({ collection: 'orders', where: { customer: { equals: doc.id } }, limit: 10, sort: '-placed_at', depth: 1, overrideAccess: true })
        .catch(() => ({ docs: [], totalDocs: 0 } as any)),
      Number.isFinite(uidNum)
        ? payload.find({ collection: 'addresses', where: { user: { equals: uidNum } }, limit: 50, depth: 0, overrideAccess: true }).catch(() => ({ docs: [], totalDocs: 0 } as any))
        : ({ docs: [], totalDocs: 0 } as any),
      Number.isFinite(uidNum)
        ? payload
            .find({ collection: 'user-events', where: { user: { equals: uidNum } }, sort: '-timestamp', limit: 8, depth: 0, overrideAccess: true })
            .catch(() => ({ docs: [] } as any))
        : ({ docs: [] } as any),
      Number.isFinite(uidNum)
        ? payload.find({ collection: 'wishlists', where: { user: { equals: uidNum } }, limit: 50, depth: 0, overrideAccess: true }).catch(() => ({ docs: [], totalDocs: 0 } as any))
        : ({ docs: [], totalDocs: 0 } as any),
    ])

    const orderCount = typeof (ordersRes as any).totalDocs === 'number' ? (ordersRes as any).totalDocs : (ordersRes as any).docs?.length ?? 0
    const addressCount = typeof (addressesRes as any).totalDocs === 'number' ? (addressesRes as any).totalDocs : (addressesRes as any).docs?.length ?? 0
    const recentOrders = ((ordersRes as any).docs as any[]).map((o) => ({
      id: o.id,
      status: String(o.status ?? ''),
      fulfillment_type: String(o.fulfillment_type ?? ''),
      total: Number(o.total ?? 0),
      placed_at: String(o.placed_at ?? o.createdAt ?? ''),
      merchant: o.merchant ? { id: (o.merchant as any).id ?? o.merchant, outletName: String((o.merchant as any).outletName ?? '') } : null,
    }))
    const recentEvents = ((recentEventsRes as any).docs as any[]).map((e) => ({
      id: e.id,
      eventType: String(e.eventType ?? ''),
      timestamp: String(e.timestamp ?? e.createdAt ?? ''),
      eventData: e.eventData ?? null,
    }))

    const sanitized = sanitizeCustomerDoc(doc, orderCount, addressCount, recentOrders)
    const related = {
      wishlistCount: (wishlistsRes as any).totalDocs ?? (wishlistsRes as any).docs?.length ?? 0,
      addressCount,
      orderCount,
    }

    return NextResponse.json({ doc: sanitized, related, recentEvents })
  } catch (err: any) {
    console.error('[admin/customers/[id]] GET error:', err)
    return NextResponse.json({ error: err?.message || 'Failed to load customer' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const payload = await getPayload({ config: configPromise })
    const admin = await authenticateAdmin(payload, request)
    if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    let body: Record<string, any>
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
    }

    const numericId = Number(id)
    const docId: number | string = Number.isFinite(numericId) ? numericId : id

    // Whitelist updatable fields enterprise-grade
    const patch: Record<string, any> = {}

    if (body.srn !== undefined) {
      if (body.srn === null || body.srn === '') patch.srn = null
      else if (typeof body.srn === 'string') {
        const v = body.srn.trim()
        if (v.length > 0) patch.srn = v
        else patch.srn = null
      }
    }
    if (body.couponCode !== undefined) {
      if (body.couponCode === null || body.couponCode === '') patch.couponCode = null
      else if (typeof body.couponCode === 'string') patch.couponCode = body.couponCode.trim() || null
    }
    if (body.enrollmentDate !== undefined) {
      if (body.enrollmentDate === null || body.enrollmentDate === '') patch.enrollmentDate = null
      else {
        const d = new Date(String(body.enrollmentDate))
        if (Number.isNaN(d.getTime())) return NextResponse.json({ error: 'enrollmentDate must be a valid date' }, { status: 400 })
        patch.enrollmentDate = d.toISOString()
      }
    }
    if (body.currentLevel !== undefined) {
      if (typeof body.currentLevel === 'string') {
        const v = body.currentLevel.trim().toLowerCase()
        if (!LEVEL_SET.has(v)) return NextResponse.json({ error: `currentLevel must be one of ${Array.from(LEVEL_SET).join(', ')}` }, { status: 400 })
        patch.currentLevel = v
      }
    }
    if (body.activeAddress !== undefined) {
      if (body.activeAddress === null || body.activeAddress === '') patch.activeAddress = null
      else {
        const n = Number(body.activeAddress)
        if (Number.isNaN(n)) return NextResponse.json({ error: 'activeAddress must be numeric address id' }, { status: 400 })
        try {
          await payload.findByID({ collection: 'addresses', id: n, depth: 0, overrideAccess: true })
          patch.activeAddress = n
        } catch {
          return NextResponse.json({ error: 'activeAddress not found' }, { status: 400 })
        }
      }
    }

    // isActive toggle: updates linked user isActive
    let shouldUpdateUserActive: boolean | null = null
    if (typeof body.isActive === 'boolean') shouldUpdateUserActive = body.isActive
    else if (body.isActive !== undefined) {
      const v = String(body.isActive).toLowerCase()
      if (v === 'true') shouldUpdateUserActive = true
      else if (v === 'false') shouldUpdateUserActive = false
    }

    if (Object.keys(patch).length === 0 && shouldUpdateUserActive === null) {
      return NextResponse.json({ error: 'Nothing to update' }, { status: 400 })
    }

    // Apply user active toggle before customer patch
    if (shouldUpdateUserActive !== null) {
      try {
        const current = (await payload.findByID({ collection: 'customers', id: docId as number, depth: 1, overrideAccess: true })) as any
        const uid = current?.user?.id ?? current?.user
        const uidNum = Number(uid)
        if (Number.isFinite(uidNum)) {
          await payload.update({ collection: 'users', id: uidNum, data: { isActive: shouldUpdateUserActive } as any, overrideAccess: true, depth: 0 })
        }
      } catch (e: any) {
        return NextResponse.json({ error: e?.message || 'Failed to update user status' }, { status: 400 })
      }
      if (Object.keys(patch).length === 0) {
        // only user toggle, return refreshed doc
        const refreshed = (await payload.findByID({ collection: 'customers', id: docId as number, depth: 2, overrideAccess: true })) as any
        // compute counts
        const uid = (refreshed.user as any)?.id ?? refreshed.user
        const uidNum = Number(uid)
        const [ordersRes, addressesRes] = await Promise.all([
          payload.find({ collection: 'orders', where: { customer: { equals: refreshed.id } }, limit: 0, depth: 0, overrideAccess: true, pagination: false } as any).catch(() => ({ totalDocs: 0 } as any)),
          Number.isFinite(uidNum) ? payload.find({ collection: 'addresses', where: { user: { equals: uidNum } }, limit: 0, depth: 0, overrideAccess: true, pagination: false } as any).catch(() => ({ totalDocs: 0 } as any)) : ({ totalDocs: 0 } as any),
        ])
        const orderCount = (ordersRes as any).totalDocs ?? 0
        const addressCount = (addressesRes as any).totalDocs ?? 0
        const sanitized = sanitizeCustomerDoc(refreshed, orderCount, addressCount)
        return NextResponse.json({ success: true, message: 'Customer updated successfully', doc: sanitized })
      }
    }

    let updated: Record<string, any>
    try {
      updated = (await payload.update({ collection: 'customers', id: docId as number, data: patch as any, depth: 2, overrideAccess: true })) as unknown as Record<string, any>
    } catch (e: any) {
      const msg = e?.message || 'Failed to update customer'
      const lower = String(msg).toLowerCase()
      if (lower.includes('unique') || lower.includes('duplicate')) return NextResponse.json({ error: 'Duplicate value violates unique constraint', details: msg }, { status: 409 })
      return NextResponse.json({ error: msg, details: e?.data || e?.errors }, { status: 400 })
    }

    const uid = (updated.user as any)?.id ?? updated.user
    const uidNum = Number(uid)
    const [ordersRes, addressesRes] = await Promise.all([
      payload.find({ collection: 'orders', where: { customer: { equals: updated.id } }, limit: 0, depth: 0, overrideAccess: true, pagination: false } as any).catch(() => ({ totalDocs: 0 } as any)),
      Number.isFinite(uidNum) ? payload.find({ collection: 'addresses', where: { user: { equals: uidNum } }, limit: 0, depth: 0, overrideAccess: true, pagination: false } as any).catch(() => ({ totalDocs: 0 } as any)) : ({ totalDocs: 0 } as any),
    ])
    const orderCount = (ordersRes as any).totalDocs ?? 0
    const addressCount = (addressesRes as any).totalDocs ?? 0
    const sanitized = sanitizeCustomerDoc(updated, orderCount, addressCount)
    return NextResponse.json({ success: true, message: 'Customer updated successfully', doc: sanitized })
  } catch (err: any) {
    console.error('[admin/customers/[id]] PATCH error:', err)
    return NextResponse.json({ error: err?.message || 'Update failed' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const payload = await getPayload({ config: configPromise })
    const admin = await authenticateAdmin(payload, request)
    if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const numericId = Number(id)
    const docId: number | string = Number.isFinite(numericId) ? numericId : id

    const { searchParams } = new URL(request.url)
    const force = searchParams.get('force') === 'true'

    // Check order dependencies (enterprise safety)
    let hasOrders = false
    let orderCount = 0
    try {
      const oRes: any = await payload.find({ collection: 'orders', where: { customer: { equals: docId as number } }, limit: 1, depth: 0, overrideAccess: true })
      orderCount = oRes.totalDocs ?? oRes.docs.length
      hasOrders = orderCount > 0
    } catch {}

    if (hasOrders && !force) {
      return NextResponse.json(
        {
          error: `Customer has ${orderCount} order(s). Delete or reassign them first, or use force=true to proceed.`,
          code: 'HAS_ORDERS',
          orderCount,
        },
        { status: 409 }
      )
    }

    if (hasOrders && force) {
      // optionally delete orders cascade — we do not auto-delete for safety but inform; allow deleting customer will fail if FK? customers not cascade to orders in payload, so we delete orders first
      try {
        const oRes: any = await payload.find({ collection: 'orders', where: { customer: { equals: docId as number } }, limit: 500, depth: 0, overrideAccess: true, pagination: false } as any)
        for (const o of oRes.docs || []) {
          try {
            await payload.delete({ collection: 'orders', id: o.id, overrideAccess: true })
          } catch {}
        }
      } catch {}
    }

    let deleted: any
    try {
      deleted = await payload.delete({ collection: 'customers', id: docId as number, overrideAccess: true })
    } catch (e: any) {
      return NextResponse.json({ error: e?.message || 'Failed to delete customer' }, { status: 400 })
    }
    if (!deleted) return NextResponse.json({ error: 'Customer not found' }, { status: 404 })
    return NextResponse.json({ success: true, id: deleted.id, message: 'Customer deleted successfully' })
  } catch (err: any) {
    console.error('[admin/customers/[id]] DELETE error:', err)
    return NextResponse.json({ error: err?.message || 'Delete failed' }, { status: 500 })
  }
}
