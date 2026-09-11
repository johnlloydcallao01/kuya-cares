/**
 * @file apps/cms/src/app/api/admin/catalog/variations/[id]/route.ts
 */

import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import configPromise from '@payload-config'
import { authenticateAdmin } from '@/utils/mediaLibrary'
import { deleteCachedByPrefix } from '@encreasl/cache'

function str(v: unknown, fallback = ''): string {
  return typeof v === 'string' ? v : fallback
}
function optionalString(v: unknown): string | null {
  return typeof v === 'string' ? v.trim() || null : null
}
function num(v: unknown, fallback = 0): number {
  if (typeof v === 'number' && Number.isFinite(v)) return v
  if (typeof v === 'string') {
    const n = Number(v)
    return Number.isFinite(n) ? n : fallback
  }
  return fallback
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
    return {
      id,
      name: str(src.name, ''),
      slug: str(src.slug, ''),
      productType: str((src as any).productType, ''),
    }
  }
  return null
}
function sanitizeDoc(raw: Record<string, any>): Record<string, any> {
  return {
    id: raw.id,
    product_id: sanitizeProductBrief(raw.product_id),
    product: sanitizeProductBrief(raw.product_id),
    modifier_behavior_mode: str(raw.modifier_behavior_mode, 'inherit_product'),
    name: optionalString(raw.name),
    short_description: optionalString(raw.short_description),
    image: sanitizeMediaRef(raw.image),
    sku: str(raw.sku, ''),
    base_price: raw.base_price != null ? num(raw.base_price, 0) : null,
    compare_at_price: raw.compare_at_price != null ? num(raw.compare_at_price, 0) : null,
    stock_quantity: raw.stock_quantity != null ? Math.trunc(num(raw.stock_quantity, 0)) : 0,
    is_used_for_variations: typeof raw.is_used_for_variations === 'boolean' ? raw.is_used_for_variations : true,
    is_visible: typeof raw.is_visible === 'boolean' ? raw.is_visible : true,
    sort_order: raw.sort_order != null ? Math.trunc(num(raw.sort_order, 0)) : 0,
    modifier_configuration_hint: optionalString(raw.modifier_configuration_hint),
    effective_modifier_preview: raw.effective_modifier_preview ?? null,
    createdAt: String(raw.createdAt ?? ''),
    updatedAt: String(raw.updatedAt ?? ''),
  }
}

const MODE_VALUES = new Set(['inherit_product', 'variation_specific', 'hybrid'])

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
      doc = (await payload.findByID({
        collection: 'prod-variations',
        id: docId as number,
        depth: 2,
        overrideAccess: true,
      })) as unknown as Record<string, any>
    } catch (e: any) {
      return NextResponse.json({ error: 'Variation not found', details: e?.message }, { status: 404 })
    }
    if (!doc) return NextResponse.json({ error: 'Variation not found' }, { status: 404 })
    const sanitized = sanitizeDoc(doc)
    return NextResponse.json({ doc: sanitized })
  } catch (err: any) {
    console.error('[admin/catalog/variations/[id]] GET error:', err)
    return NextResponse.json({ error: err?.message || 'Failed to load variation' }, { status: 500 })
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

    const patch: Record<string, any> = {}

    if (body.product_id !== undefined || body.productId !== undefined) {
      const raw = body.product_id ?? body.productId
      if (raw === null || raw === '') {
        return NextResponse.json({ error: 'product_id cannot be empty' }, { status: 400 })
      }
      const pid = Number(raw)
      if (Number.isNaN(pid)) return NextResponse.json({ error: 'product_id must be numeric' }, { status: 400 })
      // validate exists and variable
      let prod: any
      try {
        prod = await payload.findByID({ collection: 'products', id: pid, depth: 0, overrideAccess: true })
      } catch {
        return NextResponse.json({ error: 'product_id does not exist' }, { status: 400 })
      }
      if (!prod) return NextResponse.json({ error: 'product_id does not exist' }, { status: 400 })
      const pType = String(prod.productType || '').toLowerCase()
      if (pType !== 'variable')
        return NextResponse.json({ error: 'product_id must reference a variable product (productType=variable)' }, { status: 400 })
      patch.product_id = pid
    }

    if (body.modifier_behavior_mode !== undefined) {
      if (typeof body.modifier_behavior_mode !== 'string')
        return NextResponse.json({ error: 'modifier_behavior_mode must be a string' }, { status: 400 })
      const v = body.modifier_behavior_mode.trim().toLowerCase()
      if (!MODE_VALUES.has(v))
        return NextResponse.json(
          { error: `modifier_behavior_mode must be one of ${Array.from(MODE_VALUES).join(', ')}` },
          { status: 400 },
        )
      patch.modifier_behavior_mode = v
    }

    if (body.name !== undefined) {
      if (body.name === null || body.name === '') patch.name = null
      else if (typeof body.name === 'string') patch.name = body.name.trim() || null
      else return NextResponse.json({ error: 'name must be a string' }, { status: 400 })
    }

    if (body.short_description !== undefined) {
      if (body.short_description === null || body.short_description === '') patch.short_description = null
      else if (typeof body.short_description === 'string') {
        if (body.short_description.length > 500)
          return NextResponse.json({ error: 'short_description must be at most 500 characters' }, { status: 400 })
        patch.short_description = body.short_description.trim() || null
      } else return NextResponse.json({ error: 'short_description must be a string' }, { status: 400 })
    }

    if (body.image !== undefined) {
      if (body.image === null || body.image === '') patch.image = null
      else {
        const n = Number(body.image)
        if (Number.isNaN(n)) return NextResponse.json({ error: 'image must be numeric media id or null' }, { status: 400 })
        patch.image = n
      }
    }

    if (body.base_price !== undefined) {
      if (body.base_price === null || body.base_price === '') patch.base_price = null
      else {
        const n = Number(body.base_price)
        if (Number.isNaN(n) || n < 0) return NextResponse.json({ error: 'base_price must be a number >= 0' }, { status: 400 })
        patch.base_price = n
      }
    }

    if (body.compare_at_price !== undefined) {
      if (body.compare_at_price === null || body.compare_at_price === '') patch.compare_at_price = null
      else {
        const n = Number(body.compare_at_price)
        if (Number.isNaN(n) || n < 0)
          return NextResponse.json({ error: 'compare_at_price must be a number >= 0' }, { status: 400 })
        patch.compare_at_price = n
      }
    }

    if (body.stock_quantity !== undefined) {
      const n = Number(body.stock_quantity)
      if (!Number.isFinite(n) || n < 0 || !Number.isInteger(Math.trunc(n)))
        return NextResponse.json({ error: 'stock_quantity must be an integer >= 0' }, { status: 400 })
      patch.stock_quantity = Math.trunc(n)
    }

    if (body.is_used_for_variations !== undefined) {
      if (typeof body.is_used_for_variations === 'boolean') patch.is_used_for_variations = body.is_used_for_variations
      else if (typeof body.is_used_for_variations === 'string') {
        const v = body.is_used_for_variations.trim().toLowerCase()
        if (v === 'true') patch.is_used_for_variations = true
        else if (v === 'false') patch.is_used_for_variations = false
        else return NextResponse.json({ error: 'is_used_for_variations must be boolean' }, { status: 400 })
      } else return NextResponse.json({ error: 'is_used_for_variations must be boolean' }, { status: 400 })
    }

    if (body.is_visible !== undefined) {
      if (typeof body.is_visible === 'boolean') patch.is_visible = body.is_visible
      else if (typeof body.is_visible === 'string') {
        const v = body.is_visible.trim().toLowerCase()
        if (v === 'true') patch.is_visible = true
        else if (v === 'false') patch.is_visible = false
        else return NextResponse.json({ error: 'is_visible must be boolean' }, { status: 400 })
      } else return NextResponse.json({ error: 'is_visible must be boolean' }, { status: 400 })
    }

    if (body.sort_order !== undefined) {
      const n = Number(body.sort_order)
      if (!Number.isFinite(n)) return NextResponse.json({ error: 'sort_order must be numeric' }, { status: 400 })
      patch.sort_order = Math.trunc(n)
    }

    if (Object.keys(patch).length === 0) return NextResponse.json({ error: 'Nothing to update' }, { status: 400 })

    let updated: Record<string, any>
    try {
      updated = (await payload.update({
        collection: 'prod-variations',
        id: docId as number,
        data: patch as any,
        depth: 2,
        overrideAccess: true,
      })) as unknown as Record<string, any>
    } catch (e: any) {
      const msg = e?.message || 'Failed to update variation'
      const lower = String(msg).toLowerCase()
      if (lower.includes('unique') || lower.includes('duplicate'))
        return NextResponse.json({ error: 'Duplicate value violates unique constraint', details: msg }, { status: 409 })
      return NextResponse.json({ error: msg, details: e?.data || e?.errors }, { status: 400 })
    }

    const sanitized = sanitizeDoc(updated)
    // Bust list cache so the update reflects immediately on /catalog/variations
    await deleteCachedByPrefix('admin:catalog-variations:')
    return NextResponse.json({ success: true, message: 'Variation updated successfully', doc: sanitized })
  } catch (err: any) {
    console.error('[admin/catalog/variations/[id]] PATCH error:', err)
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
      deleted = await payload.delete({ collection: 'prod-variations', id: docId as number, overrideAccess: true })
    } catch (e: any) {
      const msg = e?.message || 'Failed to delete variation'
      if (String(msg).toLowerCase().includes('not found'))
        return NextResponse.json({ error: 'Variation not found', details: msg }, { status: 404 })
      return NextResponse.json({ error: msg }, { status: 400 })
    }
    if (!deleted) return NextResponse.json({ error: 'Variation not found' }, { status: 404 })
    // Bust list cache so the deletion reflects immediately on /catalog/variations
    await deleteCachedByPrefix('admin:catalog-variations:')
    return NextResponse.json({ success: true, id: deleted.id, message: 'Variation deleted successfully' })
  } catch (err: any) {
    console.error('[admin/catalog/variations/[id]] DELETE error:', err)
    return NextResponse.json({ error: err?.message || 'Delete failed' }, { status: 500 })
  }
}
