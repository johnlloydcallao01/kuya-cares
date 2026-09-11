/**
 * @file apps/cms/src/app/api/admin/merchant-categories/[id]/route.ts
 * @description BFF for single merchant category — admin-only.
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
function sanitizeDoc(raw: Record<string, any>, merchantCount: number): Record<string, any> {
  return {
    id: raw.id,
    name: String(raw.name || ''),
    slug: String(raw.slug || ''),
    description: raw.description ? String(raw.description) : null,
    displayOrder: typeof raw.displayOrder === 'number' ? raw.displayOrder : 0,
    isActive: typeof raw.isActive === 'boolean' ? raw.isActive : true,
    isFeatured: !!raw.isFeatured,
    icon: sanitizeMediaRef(raw.icon),
    merchantCount,
    createdAt: String(raw.createdAt || ''),
    updatedAt: String(raw.updatedAt || ''),
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
    try { doc = await payload.findByID({ collection: 'merchant-categories', id: docId as number, depth: 1, overrideAccess: true }) as unknown as Record<string, any> } catch (e: any) { return NextResponse.json({ error: 'Merchant category not found', details: e?.message }, { status: 404 }) }
    if (!doc) return NextResponse.json({ error: 'Merchant category not found' }, { status: 404 })
    // merchant count
    let merchantCount = 0
    try {
      const mRes = await payload.find({ collection: 'merchants', where: { merchant_categories: { contains: doc.id } }, limit: 0, depth: 0, overrideAccess: true, pagination: false } as any)
      merchantCount = typeof (mRes as any).totalDocs === 'number' ? (mRes as any).totalDocs : (mRes as any).docs?.length || 0
      // fallback for hasMany: check contains via in
      if (merchantCount === 0) {
        const all = await payload.find({ collection: 'merchants', limit: 2000, depth: 0, overrideAccess: true, pagination: false } as any)
        merchantCount = (all.docs as any[]).filter((m: any) => {
          const cats: any[] = Array.isArray(m.merchant_categories) ? m.merchant_categories : []
          return cats.some((c: any) => String(typeof c === 'object' ? c.id ?? c : c) === String(doc.id))
        }).length
      }
    } catch {}
    const sanitized = sanitizeDoc(doc, merchantCount)
    return NextResponse.json({ doc: sanitized })
  } catch (err: any) { console.error('[admin/merchant-categories/[id]] GET error:', err); return NextResponse.json({ error: err?.message || 'Failed to load' }, { status: 500 }) }
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
    if (typeof body.description === 'string' || body.description === null) patch.description = body.description ? String(body.description).trim() || null : null
    if (body.displayOrder !== undefined) {
      const n = Number(body.displayOrder); if (Number.isNaN(n)) return NextResponse.json({ error: 'displayOrder must be numeric' }, { status: 400 }); patch.displayOrder = n
    }
    if (typeof body.isActive === 'boolean') patch.isActive = body.isActive
    else if (body.isActive !== undefined) { const v = String(body.isActive).toLowerCase(); if (v === 'true') patch.isActive = true; else if (v === 'false') patch.isActive = false }
    if (typeof body.isFeatured === 'boolean') patch.isFeatured = body.isFeatured
    else if (body.isFeatured !== undefined) { const v = String(body.isFeatured).toLowerCase(); if (v === 'true') patch.isFeatured = true; else if (v === 'false') patch.isFeatured = false }
    if (body.icon !== undefined) patch.icon = body.icon === null || body.icon === '' ? null : Number(body.icon)

    if (Object.keys(patch).length === 0) return NextResponse.json({ error: 'Nothing to update' }, { status: 400 })
    let updated: Record<string, any>
    try { updated = await payload.update({ collection: 'merchant-categories', id: docId as number, data: patch as any, depth: 1, overrideAccess: true }) as unknown as Record<string, any> } catch (e: any) {
      const msg = e?.message || 'Failed to update'; const lower = String(msg).toLowerCase()
      if (lower.includes('unique') || lower.includes('duplicate')) return NextResponse.json({ error: 'Duplicate slug: already exists', details: msg }, { status: 409 })
      return NextResponse.json({ error: msg, details: e?.data || e?.errors }, { status: 400 })
    }
    const sanitized = sanitizeDoc(updated, 0)
    // Bust list cache so the update reflects immediately on /merchant-categories
    await deleteCachedByPrefix('admin:merchant-categories:')
    return NextResponse.json({ success: true, message: 'Merchant category updated successfully', doc: sanitized })
  } catch (err: any) { console.error('[admin/merchant-categories/[id]] PATCH error:', err); return NextResponse.json({ error: err?.message || 'Update failed' }, { status: 500 }) }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const payload = await getPayload({ config: configPromise })
    const admin = await authenticateAdmin(payload, request)
    if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const numericId = Number(id)
    const docId: number | string = Number.isFinite(numericId) ? numericId : id
    // Check if category is in use
    try {
      const all = await payload.find({ collection: 'merchants', limit: 2000, depth: 0, overrideAccess: true, pagination: false } as any)
      const inUse = (all.docs as any[]).some((m: any) => {
        const cats: any[] = Array.isArray(m.merchant_categories) ? m.merchant_categories : []
        return cats.some((c: any) => String(typeof c === 'object' ? c.id ?? c : c) === String(docId))
      })
      if (inUse) return NextResponse.json({ error: 'Category is in use by merchants — reassign merchants first', code: 'IN_USE' }, { status: 409 })
    } catch {}
    let deleted: any
    try { deleted = await payload.delete({ collection: 'merchant-categories', id: docId as number, overrideAccess: true }) } catch (e: any) { return NextResponse.json({ error: e?.message || 'Failed to delete' }, { status: 400 }) }
    if (!deleted) return NextResponse.json({ error: 'Merchant category not found' }, { status: 404 })
    // Bust list cache so the deletion reflects immediately on /merchant-categories
    await deleteCachedByPrefix('admin:merchant-categories:')
    return NextResponse.json({ success: true, id: deleted.id, message: 'Merchant category deleted successfully' })
  } catch (err: any) { console.error('[admin/merchant-categories/[id]] DELETE error:', err); return NextResponse.json({ error: err?.message || 'Delete failed' }, { status: 500 }) }
}
