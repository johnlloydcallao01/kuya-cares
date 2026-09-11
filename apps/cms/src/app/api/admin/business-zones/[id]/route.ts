/**
 * @file apps/cms/src/app/api/admin/business-zones/[id]/route.ts
 * @description BFF for single business zone (detail, update, delete) — admin-only safe boundary.
 */

import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import configPromise from '@payload-config'
import { authenticateAdmin } from '@/utils/mediaLibrary'
import { deleteCachedByPrefix } from '@encreasl/cache'

function str(v: unknown, fb = ''): string { return typeof v === 'string' ? v : fb }
function optionalString(v: unknown): string | null { return typeof v === 'string' ? v.trim() || null : null }

function sanitizeZoneDoc(raw: Record<string, any>): Record<string, any> {
  return {
    id: raw.id,
    name: str(raw.name, ''),
    slug: str(raw.slug, ''),
    description: optionalString(raw.description),
    boundary: raw.boundary ?? null,
    boundary_geometry: raw.boundary_geometry ?? raw.boundary ?? null,
    isActive: typeof raw.isActive === 'boolean' ? raw.isActive : true,
    disabledReason: optionalString(raw.disabledReason),
    displayOrder: typeof raw.displayOrder === 'number' ? raw.displayOrder : 0,
    timezone: str(raw.timezone, 'Asia/Manila'),
    createdAt: String(raw.createdAt ?? ''),
    updatedAt: String(raw.updatedAt ?? ''),
  }
}

function isValidGeoJSONBoundary(boundary: unknown): { valid: boolean; error?: string } {
  if (boundary == null) return { valid: true }
  if (typeof boundary !== 'object' || Array.isArray(boundary)) return { valid: false, error: 'boundary must be a GeoJSON object' }
  const obj = boundary as Record<string, unknown>
  const type = obj.type
  if (type !== 'Polygon' && type !== 'MultiPolygon') return { valid: false, error: 'boundary.type must be Polygon or MultiPolygon' }
  if (!Array.isArray(obj.coordinates)) return { valid: false, error: 'boundary.coordinates must be an array' }
  return { valid: true }
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
    try { doc = await payload.findByID({ collection: 'business-zones', id: docId as number, depth: 0, overrideAccess: true }) as unknown as Record<string, any> } catch (e: any) { return NextResponse.json({ error: 'Business zone not found', details: e?.message }, { status: 404 }) }
    if (!doc) return NextResponse.json({ error: 'Business zone not found' }, { status: 404 })

    // Merchant counts for this zone + sample merchants
    let merchantCount = 0
    let merchantsPreview: any[] = []
    try {
      const mRes = await payload.find({ collection: 'merchants', where: { businessZone: { equals: doc.id } }, limit: 10, depth: 1, overrideAccess: true, pagination: false } as any)
      const allRes = await payload.find({ collection: 'merchants', where: { businessZone: { equals: doc.id } }, limit: 0, depth: 0, overrideAccess: true } as any)
      merchantCount = typeof (allRes as any).totalDocs === 'number' ? (allRes as any).totalDocs : (allRes as any).docs?.length ?? 0
      merchantsPreview = ((mRes as any).docs || []).map((m: any) => ({
        id: m.id,
        outletName: String(m.outletName || ''),
        outletCode: String(m.outletCode || ''),
        isActive: !!m.isActive,
        isAcceptingOrders: !!m.isAcceptingOrders,
        merchant_latitude: m.merchant_latitude ?? null,
        merchant_longitude: m.merchant_longitude ?? null,
        service_area: m.service_area ?? null,
        vendor: m.vendor && typeof m.vendor === 'object' ? { id: (m.vendor as any).id, businessName: String((m.vendor as any).businessName || '') } : null,
      }))
    } catch {}

    const sanitized = sanitizeZoneDoc(doc)
    return NextResponse.json({ doc: { ...sanitized, merchantCount, merchantsPreview } })
  } catch (err: any) { console.error('[admin/business-zones/[id]] GET error:', err); return NextResponse.json({ error: err?.message || 'Failed to load zone' }, { status: 500 }) }
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
      const v = body.slug.trim().toLowerCase(); if (!v) return NextResponse.json({ error: 'slug cannot be empty' }, { status: 400 })
      const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
      if (!slugPattern.test(v)) return NextResponse.json({ error: 'slug must be URL-friendly' }, { status: 400 }); patch.slug = v
    }
    if (body.description !== undefined) patch.description = typeof body.description === 'string' ? (body.description.trim() || null) : null
    if (body.boundary !== undefined) {
      const v = body.boundary
      if (v !== null) {
        const chk = isValidGeoJSONBoundary(v)
        if (!chk.valid) return NextResponse.json({ error: chk.error || 'Invalid boundary' }, { status: 400 })
      }
      patch.boundary = v
    }
    if (typeof body.isActive === 'boolean') patch.isActive = body.isActive
    else if (body.isActive !== undefined) { const v = String(body.isActive).toLowerCase(); if (v === 'true') patch.isActive = true; else if (v === 'false') patch.isActive = false }
    if (body.disabledReason !== undefined) patch.disabledReason = typeof body.disabledReason === 'string' ? (body.disabledReason.trim() || null) : null
    if (body.displayOrder !== undefined) patch.displayOrder = body.displayOrder === null || body.displayOrder === '' ? 0 : Number(body.displayOrder)
    if (typeof body.timezone === 'string') {
      const v = body.timezone.trim(); if (v) { try { Intl.DateTimeFormat(undefined, { timeZone: v }) } catch { return NextResponse.json({ error: 'timezone must be valid IANA identifier' }, { status: 400 }) } patch.timezone = v }
    }
    if (Object.keys(patch).length === 0) return NextResponse.json({ error: 'Nothing to update' }, { status: 400 })
    let updated: Record<string, any>
    try { updated = await payload.update({ collection: 'business-zones', id: docId as number, data: patch as any, depth: 0, overrideAccess: true }) as unknown as Record<string, any> } catch (e: any) {
      const msg = e?.message || 'Failed to update zone'
      const lower = String(msg).toLowerCase()
      if (lower.includes('unique') || lower.includes('duplicate')) return NextResponse.json({ error: 'Duplicate slug: already exists', details: msg }, { status: 409 })
      return NextResponse.json({ error: msg, details: e?.data || e?.errors }, { status: 400 })
    }
    const sanitized = sanitizeZoneDoc(updated)
    // Bust list + overview caches so the update reflects immediately on /business-zones/admin
    await deleteCachedByPrefix('admin:business-zones:')
    await deleteCachedByPrefix('admin:business-zones-overview:')
    return NextResponse.json({ success: true, message: 'Business zone updated successfully', doc: sanitized })
  } catch (err: any) { console.error('[admin/business-zones/[id]] PATCH error:', err); return NextResponse.json({ error: err?.message || 'Update failed' }, { status: 500 }) }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const payload = await getPayload({ config: configPromise })
    const admin = await authenticateAdmin(payload, request)
    if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const numericId = Number(id)
    const docId: number | string = Number.isFinite(numericId) ? numericId : id

    // Safety: count merchants assigned to this zone
    let assignedCount = 0
    try {
      const r = await payload.find({ collection: 'merchants', where: { businessZone: { equals: numericId } }, limit: 0, overrideAccess: true } as any)
      assignedCount = typeof (r as any).totalDocs === 'number' ? (r as any).totalDocs : 0
    } catch {}
    if (assignedCount > 0) {
      return NextResponse.json({ error: `Cannot delete zone: ${assignedCount} merchant(s) still assigned. Reassign or unassign them first.` }, { status: 409 })
    }

    let deleted: any
    try { deleted = await payload.delete({ collection: 'business-zones', id: docId as number, overrideAccess: true }) } catch (e: any) { return NextResponse.json({ error: e?.message || 'Failed to delete zone' }, { status: 400 }) }
    if (!deleted) return NextResponse.json({ error: 'Business zone not found' }, { status: 404 })
    // Bust list + overview caches so the deletion reflects immediately on /business-zones/admin
    await deleteCachedByPrefix('admin:business-zones:')
    await deleteCachedByPrefix('admin:business-zones-overview:')
    return NextResponse.json({ success: true, id: deleted.id, message: 'Business zone deleted successfully' })
  } catch (err: any) { console.error('[admin/business-zones/[id]] DELETE error:', err); return NextResponse.json({ error: err?.message || 'Delete failed' }, { status: 500 }) }
}
