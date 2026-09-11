/**
 * @file apps/cms/src/app/api/admin/order-items/[id]/route.ts
 * @description BFF for single order-item (detail) - admin-only safe boundary. Order items are immutable audit records.
 * GET  /api/admin/order-items/[id] -> sanitized order item
 * PATCH/DELETE -> 405 Method Not Allowed (read-only snapshot)
 */

import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import configPromise from '@payload-config'
import { authenticateAdmin } from '@/utils/mediaLibrary'

function optionalString(v: unknown): string | null {
  return typeof v === 'string' ? v.trim() || null : null
}
function str(v: unknown, fallback = ''): string {
  return typeof v === 'string' ? v : fallback
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
    if (!Number.isNaN(vid)) vendor = { id: vid, businessName: str(v.businessName, ''), logo: sanitizeMediaRef(v.logo) }
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
function sanitizeOrderBrief(value: unknown): Record<string, any> | null {
  if (value == null) return null
  if (typeof value !== 'object') {
    const id = Number(value)
    if (Number.isNaN(id)) return null
    return { id, status: null, placed_at: null, merchant: null }
  }
  const o = value as Record<string, any>
  const id = Number(o.id)
  if (Number.isNaN(id)) return null
  return {
    id,
    status: optionalString(o.status) ?? str(o.status, 'pending'),
    placed_at: o.placed_at ? String(o.placed_at) : null,
    merchant: o.merchant ? sanitizeMerchantBrief(o.merchant) : null,
  }
}
function sanitizeProductBrief(value: unknown): Record<string, any> | null {
  if (value == null) return null
  if (typeof value !== 'object') {
    const id = Number(value)
    if (Number.isNaN(id)) return null
    return { id, name: `Product #${id}`, slug: '', sku: null, productType: null, basePrice: null, primaryImage: null }
  }
  const p = value as Record<string, any>
  const id = Number(p.id)
  if (Number.isNaN(id)) return null
  const mediaGroup = p.media as Record<string, any> | undefined
  const primaryImage = mediaGroup?.primaryImage ? sanitizeMediaRef(mediaGroup.primaryImage) : null
  return {
    id,
    name: str(p.name, `Product #${id}`),
    slug: str(p.slug, ''),
    sku: optionalString(p.sku),
    productType: optionalString(p.productType),
    basePrice: p.basePrice != null ? num(p.basePrice, 0) : null,
    primaryImage,
  }
}
function sanitizeMerchantProductBrief(value: unknown): Record<string, any> | null {
  if (value == null) return null
  if (typeof value !== 'object') {
    const id = Number(value)
    if (Number.isNaN(id)) return null
    return { id, display_title: `MerchantProduct #${id}`, price_override: null, stock_quantity: null, is_active: null, is_available: null, merchant: null, product: null }
  }
  const mp = value as Record<string, any>
  const id = Number(mp.id)
  if (Number.isNaN(id)) return null
  const merchantRaw = mp.merchant_id ?? mp.merchant
  const productRaw = mp.product_id ?? mp.product
  return {
    id,
    display_title: optionalString(mp.display_title) ?? `MerchantProduct #${id}`,
    price_override: mp.price_override != null ? num(mp.price_override, 0) : null,
    stock_quantity: mp.stock_quantity != null ? num(mp.stock_quantity, 0) : null,
    is_active: typeof mp.is_active === 'boolean' ? mp.is_active : typeof mp.isActive === 'boolean' ? mp.isActive : null,
    is_available: typeof mp.is_available === 'boolean' ? mp.is_available : null,
    merchant: merchantRaw ? sanitizeMerchantBrief(merchantRaw) : null,
    product: productRaw ? sanitizeProductBrief(productRaw) : null,
  }
}
function sanitizeOrderItemDoc(raw: Record<string, any>): Record<string, any> {
  return {
    id: raw.id,
    order: sanitizeOrderBrief(raw.order),
    product: sanitizeProductBrief(raw.product),
    merchant_product: sanitizeMerchantProductBrief(raw.merchant_product),
    product_name_snapshot: str(raw.product_name_snapshot, ''),
    price_at_purchase: num(raw.price_at_purchase, 0),
    quantity: num(raw.quantity, 0),
    options_snapshot: raw.options_snapshot ?? null,
    total_price: num(raw.total_price, 0),
    createdAt: String(raw.createdAt ?? ''),
    updatedAt: String(raw.updatedAt ?? ''),
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
        collection: 'order-items',
        id: docId as number,
        depth: 2,
        overrideAccess: true,
      })) as unknown as Record<string, any>
    } catch (e: any) {
      return NextResponse.json({ error: 'Order item not found', details: e?.message }, { status: 404 })
    }
    if (!doc) return NextResponse.json({ error: 'Order item not found' }, { status: 404 })

    const sanitized = sanitizeOrderItemDoc(doc)
    return NextResponse.json({ doc: sanitized })
  } catch (err: any) {
    console.error('[admin/order-items/[id]] GET error:', err)
    return NextResponse.json({ error: err?.message || 'Failed to load order item' }, { status: 500 })
  }
}

export async function PATCH() {
  return NextResponse.json({ error: 'Method Not Allowed', message: 'Order items are immutable audit records' }, { status: 405 })
}

export async function DELETE() {
  return NextResponse.json({ error: 'Method Not Allowed', message: 'Order items are immutable audit records' }, { status: 405 })
}

export async function PUT() {
  return NextResponse.json({ error: 'Method Not Allowed', message: 'Order items are immutable audit records' }, { status: 405 })
}
