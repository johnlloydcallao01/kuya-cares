/**
 * @file apps/cms/src/app/api/admin/catalog/grouped-items/[id]/route.ts
 */

import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import configPromise from '@payload-config'
import { authenticateAdmin } from '@/utils/mediaLibrary'
import { deleteCachedByPrefix } from '@encreasl/cache'

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
function sanitizeProductBrief(value: unknown): { id: number; name: string; slug: string; productType: string } | number | null {
  if (value == null) return null
  if (typeof value === 'number' || typeof value === 'string') {
    const n = Number(value)
    return Number.isNaN(n) ? null : n
  }
  if (typeof value === 'object') {
    const src = value as Record<string, unknown>
    const id = Number(src.id)
    if (Number.isNaN(id)) return null
    return { id, name: str(src.name, ''), slug: str(src.slug, ''), productType: str((src as any).productType, '') }
  }
  return null
}
function sanitizeDoc(raw: Record<string, any>): Record<string, any> {
  return {
    id: raw.id,
    parent_product_id: sanitizeProductBrief(raw.parent_product_id),
    parent_product: sanitizeProductBrief(raw.parent_product_id),
    child_product_id: sanitizeProductBrief(raw.child_product_id),
    child_product: sanitizeProductBrief(raw.child_product_id),
    default_quantity: raw.default_quantity != null ? num(raw.default_quantity, 1) : 1,
    sort_order: raw.sort_order != null ? Math.trunc(num(raw.sort_order, 0)) : 0,
    createdAt: String(raw.createdAt ?? ''),
    updatedAt: String(raw.updatedAt ?? ''),
  }
}

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
      doc = (await payload.findByID({ collection: 'prod-grouped-items', id: docId as number, depth: 1, overrideAccess: true })) as unknown as Record<string, any>
    } catch (e: any) {
      return NextResponse.json({ error: 'Grouped item not found', details: e?.message }, { status: 404 })
    }
    if (!doc) return NextResponse.json({ error: 'Grouped item not found' }, { status: 404 })
    const sanitized = sanitizeDoc(doc)
    return NextResponse.json({ doc: sanitized })
  } catch (err: any) {
    console.error('[admin/catalog/grouped-items/[id]] GET error:', err)
    return NextResponse.json({ error: err?.message || 'Failed to load grouped item' }, { status: 500 })
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

    let existing: Record<string, any>
    try {
      existing = (await payload.findByID({ collection: 'prod-grouped-items', id: docId as number, depth: 0, overrideAccess: true })) as unknown as Record<string, any>
    } catch (e: any) {
      return NextResponse.json({ error: 'Grouped item not found' }, { status: 404 })
    }

    const patch: Record<string, any> = {}

    // parent_product_id
    if (body.parent_product_id !== undefined || body.parentProductId !== undefined || body.parent !== undefined) {
      const raw = body.parent_product_id ?? body.parentProductId ?? body.parent
      if (raw === null || raw === '') return NextResponse.json({ error: 'parent_product_id cannot be empty' }, { status: 400 })
      const pid = Number(raw)
      if (Number.isNaN(pid)) return NextResponse.json({ error: 'parent_product_id must be numeric' }, { status: 400 })
      try {
        const prod = (await payload.findByID({ collection: 'products', id: pid, depth: 0, overrideAccess: true })) as any
        if (!prod) return NextResponse.json({ error: 'parent_product_id does not exist' }, { status: 400 })
        if (String((prod as any).productType || '').toLowerCase() !== 'grouped') return NextResponse.json({ error: 'parent_product_id must reference a product with productType=grouped' }, { status: 400 })
      } catch {
        return NextResponse.json({ error: 'parent_product_id does not exist' }, { status: 400 })
      }
      patch.parent_product_id = pid
    }
    if (body.child_product_id !== undefined || body.childProductId !== undefined || body.child !== undefined) {
      const raw = body.child_product_id ?? body.childProductId ?? body.child
      if (raw === null || raw === '') return NextResponse.json({ error: 'child_product_id cannot be empty' }, { status: 400 })
      const cid = Number(raw)
      if (Number.isNaN(cid)) return NextResponse.json({ error: 'child_product_id must be numeric' }, { status: 400 })
      try {
        const prod = (await payload.findByID({ collection: 'products', id: cid, depth: 0, overrideAccess: true })) as any
        if (!prod) return NextResponse.json({ error: 'child_product_id does not exist' }, { status: 400 })
        if (String((prod as any).productType || '').toLowerCase() === 'grouped') return NextResponse.json({ error: 'child_product_id cannot be a grouped product (no nested grouping)' }, { status: 400 })
      } catch {
        return NextResponse.json({ error: 'child_product_id does not exist' }, { status: 400 })
      }
      patch.child_product_id = cid
    }

    // check self-grouping if either changed
    const finalParent = patch.parent_product_id ?? (existing as any).parent_product_id
    const finalParentId = typeof finalParent === 'object' && finalParent !== null ? (finalParent as any).id : finalParent
    const finalChild = patch.child_product_id ?? (existing as any).child_product_id
    const finalChildId = typeof finalChild === 'object' && finalChild !== null ? (finalChild as any).id : finalChild
    if (finalParentId != null && finalChildId != null && String(finalParentId) === String(finalChildId)) {
      return NextResponse.json({ error: 'parent_product_id and child_product_id cannot be the same product' }, { status: 400 })
    }

    // duplicate check if parent or child changed
    if (patch.parent_product_id !== undefined || patch.child_product_id !== undefined) {
      const parentCheck = patch.parent_product_id ?? (typeof finalParentId === 'number' ? finalParentId : Number(finalParentId))
      const childCheck = patch.child_product_id ?? (typeof finalChildId === 'number' ? finalChildId : Number(finalChildId))
      if (Number.isFinite(Number(parentCheck)) && Number.isFinite(Number(childCheck))) {
        const dup = await payload.find({
          collection: 'prod-grouped-items',
          where: { and: [{ parent_product_id: { equals: Number(parentCheck) } }, { child_product_id: { equals: Number(childCheck) } }] },
          limit: 1,
          depth: 0,
          overrideAccess: true,
        })
        const dupDoc = (dup as any).docs?.[0]
        if (dupDoc && String(dupDoc.id) !== String(docId)) {
          return NextResponse.json({ error: 'Duplicate grouped item: this child is already in this parent group', code: 'HAS_DUPLICATE' }, { status: 409 })
        }
      }
    }

    if (body.default_quantity !== undefined || body.defaultQuantity !== undefined) {
      const raw = body.default_quantity ?? body.defaultQuantity
      if (raw === null || raw === '') patch.default_quantity = 1
      else {
        const n = Number(raw)
        if (!Number.isFinite(n)) return NextResponse.json({ error: 'default_quantity must be numeric' }, { status: 400 })
        if (n < 0) return NextResponse.json({ error: 'default_quantity cannot be negative' }, { status: 400 })
        patch.default_quantity = Math.trunc(n)
      }
    }
    if (body.sort_order !== undefined || body.sortOrder !== undefined) {
      const raw = body.sort_order ?? body.sortOrder
      if (raw === null || raw === '') patch.sort_order = 0
      else {
        const n = Number(raw)
        if (!Number.isFinite(n)) return NextResponse.json({ error: 'sort_order must be numeric' }, { status: 400 })
        patch.sort_order = Math.trunc(n)
      }
    }

    if (Object.keys(patch).length === 0) return NextResponse.json({ error: 'Nothing to update' }, { status: 400 })

    let updated: Record<string, any>
    try {
      updated = (await payload.update({ collection: 'prod-grouped-items', id: docId as number, data: patch as any, depth: 1, overrideAccess: true })) as unknown as Record<string, any>
    } catch (e: any) {
      const msg = e?.message || 'Failed to update grouped item'
      const lower = String(msg).toLowerCase()
      if (lower.includes('unique') || lower.includes('duplicate')) return NextResponse.json({ error: 'Duplicate grouped item: already exists', details: msg }, { status: 409 })
      return NextResponse.json({ error: msg, details: e?.data || e?.errors }, { status: 400 })
    }

    const sanitized = sanitizeDoc(updated)
    // Bust list cache so the update reflects immediately on /catalog/grouped-items
    await deleteCachedByPrefix('admin:catalog-grouped-items:')
    return NextResponse.json({ success: true, message: 'Grouped item updated successfully', doc: sanitized })
  } catch (err: any) {
    console.error('[admin/catalog/grouped-items/[id]] PATCH error:', err)
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

    let deleted: any
    try {
      deleted = await payload.delete({ collection: 'prod-grouped-items', id: docId as number, overrideAccess: true })
    } catch (e: any) {
      return NextResponse.json({ error: e?.message || 'Failed to delete grouped item' }, { status: 400 })
    }
    if (!deleted) return NextResponse.json({ error: 'Grouped item not found' }, { status: 404 })
    // Bust list cache so the deletion reflects immediately on /catalog/grouped-items
    await deleteCachedByPrefix('admin:catalog-grouped-items:')
    return NextResponse.json({ success: true, id: deleted.id, message: 'Grouped item deleted successfully' })
  } catch (err: any) {
    console.error('[admin/catalog/grouped-items/[id]] DELETE error:', err)
    return NextResponse.json({ error: err?.message || 'Delete failed' }, { status: 500 })
  }
}
