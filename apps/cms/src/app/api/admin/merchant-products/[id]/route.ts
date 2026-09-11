/**
 * @file apps/cms/src/app/api/admin/merchant-products/[id]/route.ts
 * @description BFF for single merchant product.
 */

import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import configPromise from '@payload-config'
import { authenticateAdmin } from '@/utils/mediaLibrary'
import { deleteCachedByPrefix } from '@encreasl/cache'

function sanitizeMediaRef(v: unknown): { id: number; url: string | null } | null {
  if (!v || typeof v !== 'object') return null
  const s = v as Record<string, unknown>
  const id = Number(s.id); if (Number.isNaN(id)) return null
  const url = typeof s.cloudinaryURL === 'string' ? s.cloudinaryURL : typeof s.url === 'string' ? s.url : null
  return { id, url }
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
    try { doc = await payload.findByID({ collection: 'merchant-products', id: docId as number, depth: 2, overrideAccess: true }) as unknown as Record<string, any> } catch (e: any) { return NextResponse.json({ error: 'Merchant product not found', details: e?.message }, { status: 404 }) }
    if (!doc) return NextResponse.json({ error: 'Merchant product not found' }, { status: 404 })
    // Enrich with sanitized product media
    const product = doc.product_id || doc.product
    const prod = product && typeof product === 'object' ? product as Record<string, any> : null
    const sanitized: Record<string, any> = {
      id: doc.id,
      merchant_id: typeof doc.merchant_id === 'object' ? (doc.merchant_id as any).id : doc.merchant_id,
      merchant: doc.merchant_id && typeof doc.merchant_id === 'object' ? { id: Number((doc.merchant_id as any).id), outletName: String((doc.merchant_id as any).outletName || '') } : null,
      product_id: prod ? Number(prod.id) : typeof doc.product_id === 'number' ? doc.product_id : null,
      product: prod ? { id: Number(prod.id), name: String(prod.name || ''), slug: String(prod.slug || ''), sku: prod.sku ? String(prod.sku) : null, productType: String(prod.productType || 'simple'), basePrice: prod.basePrice != null ? Number(prod.basePrice) : null, primaryImage: sanitizeMediaRef((prod.media as any)?.primaryImage) } : null,
      price_override: doc.price_override != null ? Number(doc.price_override) : null,
      stock_quantity: doc.stock_quantity != null ? Number(doc.stock_quantity) : null,
      is_active: typeof doc.is_active === 'boolean' ? doc.is_active : true,
      is_available: typeof doc.is_available === 'boolean' ? doc.is_available : true,
      createdAt: String(doc.createdAt || ''),
      updatedAt: String(doc.updatedAt || ''),
    }
    return NextResponse.json({ doc: sanitized })
  } catch (err: any) { console.error('[admin/merchant-products/[id]] GET error:', err); return NextResponse.json({ error: err?.message || 'Failed' }, { status: 500 }) }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const payload = await getPayload({ config: configPromise })
    const admin = await authenticateAdmin(payload, request)
    if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    let body: Record<string, any>
    try { body = await request.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }
    const numericId = Number(id)
    const docId: number | string = Number.isFinite(numericId) ? numericId : id
    const patch: Record<string, any> = {}
    if (body.price_override !== undefined) {
      if (body.price_override === null || body.price_override === '') patch.price_override = null
      else { const n = Number(body.price_override); if (Number.isNaN(n) || n < 0) return NextResponse.json({ error: 'price_override must be >=0' }, { status: 400 }); patch.price_override = n }
    }
    if (body.stock_quantity !== undefined) {
      if (body.stock_quantity === null || body.stock_quantity === '') patch.stock_quantity = null
      else { const n = Number(body.stock_quantity); if (Number.isNaN(n) || n < 0) return NextResponse.json({ error: 'stock_quantity must be >=0' }, { status: 400 }); patch.stock_quantity = n }
    }
    if (typeof body.is_active === 'boolean') patch.is_active = body.is_active
    if (typeof body.is_available === 'boolean') patch.is_available = body.is_available
    if (body.merchant_id !== undefined) {
      const n = Number(body.merchant_id); if (Number.isNaN(n)) return NextResponse.json({ error: 'merchant_id must be numeric' }, { status: 400 }); patch.merchant_id = n
    }
    if (body.product_id !== undefined) {
      const n = Number(body.product_id); if (Number.isNaN(n)) return NextResponse.json({ error: 'product_id must be numeric' }, { status: 400 }); patch.product_id = n
    }
    if (Object.keys(patch).length === 0) return NextResponse.json({ error: 'Nothing to update' }, { status: 400 })
    let updated: Record<string, any>
    try { updated = await payload.update({ collection: 'merchant-products', id: docId as number, data: patch as any, depth: 2, overrideAccess: true }) as unknown as Record<string, any> } catch (e: any) {
      const msg = e?.message || 'Failed to update'; return NextResponse.json({ error: msg, details: e?.data || e?.errors }, { status: 400 })
    }
    // Bust list cache so the update reflects immediately on /products
    await deleteCachedByPrefix('admin:merchant-products:')
    return NextResponse.json({ success: true, message: 'Merchant product updated', doc: updated })
  } catch (err: any) { console.error('[admin/merchant-products/[id]] PATCH error:', err); return NextResponse.json({ error: err?.message || 'Failed' }, { status: 500 }) }
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
    try { deleted = await payload.delete({ collection: 'merchant-products', id: docId as number, overrideAccess: true }) } catch (e: any) { return NextResponse.json({ error: e?.message || 'Failed to delete' }, { status: 400 }) }
    if (!deleted) return NextResponse.json({ error: 'Merchant product not found' }, { status: 404 })
    // Bust list cache so the deletion reflects immediately on /products
    await deleteCachedByPrefix('admin:merchant-products:')
    return NextResponse.json({ success: true, id: deleted.id, message: 'Merchant product deleted' })
  } catch (err: any) { console.error('[admin/merchant-products/[id]] DELETE error:', err); return NextResponse.json({ error: err?.message || 'Delete failed' }, { status: 500 }) }
}
