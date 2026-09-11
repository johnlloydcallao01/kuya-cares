/**
 * @file apps/cms/src/app/api/admin/products/[id]/route.ts
 * @description BFF for single product — admin-only.
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
function sanitizeDoc(raw: Record<string, any>): Record<string, any> {
  const primaryImage = sanitizeMediaRef((raw.media as any)?.primaryImage)
  const categories = Array.isArray(raw.categories) ? raw.categories.map((c: any) => typeof c === 'object' ? { id: Number(c.id), name: String(c.name || c.title || ''), slug: String(c.slug || '') } : { id: Number(c), name: String(c), slug: '' }) : []
  const vendor = raw.createdByVendor && typeof raw.createdByVendor === 'object' ? { id: Number((raw.createdByVendor as any).id), businessName: String((raw.createdByVendor as any).businessName || '') } : raw.createdByVendor ? { id: Number(raw.createdByVendor), businessName: '' } : null
  const merchant = raw.createdByMerchant && typeof raw.createdByMerchant === 'object' ? { id: Number((raw.createdByMerchant as any).id), outletName: String((raw.createdByMerchant as any).outletName || '') } : null
  return {
    id: raw.id,
    name: String(raw.name || ''),
    slug: String(raw.slug || ''),
    sku: raw.sku ? String(raw.sku) : null,
    productType: String(raw.productType || 'simple'),
    basePrice: raw.basePrice != null ? Number(raw.basePrice) : null,
    compareAtPrice: raw.compareAtPrice != null ? Number(raw.compareAtPrice) : null,
    isActive: typeof raw.isActive === 'boolean' ? raw.isActive : true,
    catalogVisibility: String(raw.catalogVisibility || 'visible'),
    categories,
    primaryImage,
    shortDescription: raw.shortDescription ? String(raw.shortDescription) : null,
    description: raw.description ?? null,
    vendor,
    merchant,
    assign_to_all_vendor_merchants: !!raw.assign_to_all_vendor_merchants,
    createdAt: String(raw.createdAt || ''),
    updatedAt: String(raw.updatedAt || ''),
  }
}

const PRODUCT_TYPES = new Set(['simple', 'variable', 'grouped'])
const VISIBILITY = new Set(['visible', 'catalog', 'search', 'hidden'])

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const payload = await getPayload({ config: configPromise })
    const admin = await authenticateAdmin(payload, request)
    if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const numericId = Number(id)
    const docId: number | string = Number.isFinite(numericId) ? numericId : id
    let doc: Record<string, any>
    try { doc = await payload.findByID({ collection: 'products', id: docId as number, depth: 2, overrideAccess: true }) as unknown as Record<string, any> } catch (e: any) { return NextResponse.json({ error: 'Product not found', details: e?.message }, { status: 404 }) }
    if (!doc) return NextResponse.json({ error: 'Product not found' }, { status: 404 })
    const sanitized = sanitizeDoc(doc)
    return NextResponse.json({ doc: sanitized })
  } catch (err: any) { console.error('[admin/products/[id]] GET error:', err); return NextResponse.json({ error: err?.message || 'Failed to load product' }, { status: 500 }) }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const payload = await getPayload({ config: configPromise })
    const admin = await authenticateAdmin(payload, request)
    if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    let body: Record<string, any>
    try { body = await request.json() } catch { return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 }) }
    const numericId = Number(id)
    const docId: number | string = Number.isFinite(numericId) ? numericId : id
    const patch: Record<string, any> = {}
    if (typeof body.name === 'string') {
      const v = body.name.trim(); if (!v || v.length < 2) return NextResponse.json({ error: 'name must be at least 2 characters' }, { status: 400 }); patch.name = v
    }
    if (typeof body.slug === 'string') {
      const v = body.slug.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, ''); if (!v) return NextResponse.json({ error: 'slug cannot be empty' }, { status: 400 }); patch.slug = v
    }
    if (typeof body.sku === 'string' || body.sku === null) patch.sku = body.sku ? String(body.sku).trim().toUpperCase() || null : null
    if (typeof body.productType === 'string') {
      const v = body.productType.trim().toLowerCase(); if (!PRODUCT_TYPES.has(v)) return NextResponse.json({ error: `productType must be one of ${Array.from(PRODUCT_TYPES).join(', ')}` }, { status: 400 }); patch.productType = v
    }
    if (typeof body.catalogVisibility === 'string') {
      const v = body.catalogVisibility.trim().toLowerCase(); if (!VISIBILITY.has(v)) return NextResponse.json({ error: `catalogVisibility must be one of ${Array.from(VISIBILITY).join(', ')}` }, { status: 400 }); patch.catalogVisibility = v
    }
    if (typeof body.isActive === 'boolean') patch.isActive = body.isActive
    else if (body.isActive !== undefined) { const v = String(body.isActive).toLowerCase(); if (v === 'true') patch.isActive = true; else if (v === 'false') patch.isActive = false }
    if (typeof body.shortDescription === 'string' || body.shortDescription === null) patch.shortDescription = body.shortDescription ? String(body.shortDescription).trim().slice(0, 500) || null : null
    if (body.description !== undefined) patch.description = body.description
    if (body.categories !== undefined) patch.categories = Array.isArray(body.categories) ? body.categories.map((v: any) => Number(v)).filter((n: number) => !Number.isNaN(n)) : null
    if (body.basePrice !== undefined) {
      if (body.basePrice === null || body.basePrice === '') patch.basePrice = null
      else { const n = Number(body.basePrice); if (Number.isNaN(n) || n < 0) return NextResponse.json({ error: 'basePrice must be >= 0' }, { status: 400 }); patch.basePrice = n }
    }
    if (body.compareAtPrice !== undefined) {
      if (body.compareAtPrice === null || body.compareAtPrice === '') patch.compareAtPrice = null
      else { const n = Number(body.compareAtPrice); if (Number.isNaN(n) || n < 0) return NextResponse.json({ error: 'compareAtPrice must be >= 0' }, { status: 400 }); patch.compareAtPrice = n }
    }
    if (body.primaryImage !== undefined) patch.media = { ...(patch.media || {}), primaryImage: body.primaryImage === null || body.primaryImage === '' ? null : Number(body.primaryImage) }
    if (body.media?.primaryImage !== undefined) patch.media = { ...(patch.media || {}), primaryImage: body.media.primaryImage === null || body.media.primaryImage === '' ? null : Number(body.media.primaryImage) }
    if (typeof body.assign_to_all_vendor_merchants === 'boolean') patch.assign_to_all_vendor_merchants = body.assign_to_all_vendor_merchants
    if (body.createdByVendor !== undefined) {
      if (body.createdByVendor === null || body.createdByVendor === '') patch.createdByVendor = null
      else { const n = Number(body.createdByVendor); if (Number.isNaN(n)) return NextResponse.json({ error: 'createdByVendor must be numeric' }, { status: 400 }); patch.createdByVendor = n }
    }
    if (body.createdByMerchant !== undefined) {
      if (body.createdByMerchant === null || body.createdByMerchant === '') patch.createdByMerchant = null
      else { const n = Number(body.createdByMerchant); if (Number.isNaN(n)) return NextResponse.json({ error: 'createdByMerchant must be numeric' }, { status: 400 }); patch.createdByMerchant = n }
    }
    if (Object.keys(patch).length === 0) return NextResponse.json({ error: 'Nothing to update' }, { status: 400 })
    // handle media nested structure: if patch.media exists, ensure correct shape
    if (patch.media && typeof patch.media.primaryImage !== 'undefined' && patch.media.primaryImage === null) {
      // keep null to clear
    }

    let updated: Record<string, any>
    try { updated = await payload.update({ collection: 'products', id: docId as number, data: patch as any, depth: 2, overrideAccess: true }) as unknown as Record<string, any> } catch (e: any) {
      const msg = e?.message || 'Failed to update product'
      const lower = String(msg).toLowerCase()
      if (lower.includes('unique') || lower.includes('duplicate')) return NextResponse.json({ error: 'Duplicate slug/sku: already exists', details: msg }, { status: 409 })
      return NextResponse.json({ error: msg, details: e?.data || e?.errors }, { status: 400 })
    }
    const sanitized = sanitizeDoc(updated)
    // Bust list cache so the update reflects immediately on /products.
    // Master names are embedded in the merchant-products aggregate, so bust that too.
    await deleteCachedByPrefix('admin:products:')
    await deleteCachedByPrefix('admin:merchant-products:')
    return NextResponse.json({ success: true, message: 'Product updated successfully', doc: sanitized })
  } catch (err: any) { console.error('[admin/products/[id]] PATCH error:', err); return NextResponse.json({ error: err?.message || 'Update failed' }, { status: 500 }) }
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
    try { deleted = await payload.delete({ collection: 'products', id: docId as number, overrideAccess: true }) } catch (e: any) { return NextResponse.json({ error: e?.message || 'Failed to delete product' }, { status: 400 }) }
    if (!deleted) return NextResponse.json({ error: 'Product not found' }, { status: 404 })
    // Bust list cache so the deletion reflects immediately on /products
    await deleteCachedByPrefix('admin:products:')
    return NextResponse.json({ success: true, id: deleted.id, message: 'Product deleted successfully' })
  } catch (err: any) { console.error('[admin/products/[id]] DELETE error:', err); return NextResponse.json({ error: err?.message || 'Delete failed' }, { status: 500 }) }
}
