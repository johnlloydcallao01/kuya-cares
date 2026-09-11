/**
 * @file apps/cms/src/app/api/admin/catalog/variation-modifier-groups/[id]/route.ts
 */

import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import configPromise from '@payload-config'
import { authenticateAdmin } from '@/utils/mediaLibrary'
import { deleteCachedByPrefix } from '@encreasl/cache'

function str(v: unknown, fallback = ''): string { return typeof v === 'string' ? v : fallback }
function optionalString(v: unknown): string | null { return typeof v === 'string' ? v.trim() || null : null }
function num(v: unknown, fallback = 0): number { if (typeof v === 'number' && Number.isFinite(v)) return v; if (typeof v === 'string'){const n=Number(v); return Number.isFinite(n)?n:fallback} return fallback }
function sanitizeVariationBrief(value: unknown): { id: number; name: string | null; sku: string } | number | null {
  if (value == null) return null
  if (typeof value === 'number' || typeof value === 'string') { const n=Number(value); return Number.isNaN(n)?null:n }
  if (typeof value === 'object') { const src=value as Record<string,unknown>; const id=Number(src.id); if(Number.isNaN(id)) return null; return { id, name: optionalString(src.name), sku: str((src as any).sku,'') } }
  return null
}
function sanitizeDoc(raw: Record<string, any>): Record<string, any> {
  return {
    id: raw.id,
    variation_id: sanitizeVariationBrief(raw.variation_id),
    variation: sanitizeVariationBrief(raw.variation_id),
    name: str(raw.name,''),
    selection_type: str(raw.selection_type,'single'),
    is_required: typeof raw.is_required==='boolean'?raw.is_required:false,
    min_selections: raw.min_selections!=null?num(raw.min_selections,0):0,
    max_selections: raw.max_selections!=null && raw.max_selections!==''?num(raw.max_selections, NaN):null,
    sort_order: raw.sort_order!=null?Math.trunc(num(raw.sort_order,0)):0,
    is_active: typeof raw.is_active==='boolean'?raw.is_active:true,
    createdAt: String(raw.createdAt ?? ''),
    updatedAt: String(raw.updatedAt ?? ''),
  }
}

const SELECTION_TYPES = new Set(['single','multiple'])

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const payload = await getPayload({ config: configPromise })
    const admin = await authenticateAdmin(payload, request)
    if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const numericId = Number(id)
    const docId: number | string = Number.isFinite(numericId) ? numericId : id
    let doc: Record<string, any>
    try { doc = await payload.findByID({ collection: 'variation-modifier-groups', id: docId as number, depth: 2, overrideAccess: true }) as unknown as Record<string, any> } catch (e:any) { return NextResponse.json({ error: 'Variation modifier group not found', details: e?.message }, { status: 404 }) }
    if (!doc) return NextResponse.json({ error: 'Variation modifier group not found' }, { status: 404 })
    const sanitized = sanitizeDoc(doc)
    return NextResponse.json({ doc: sanitized })
  } catch (err:any) { console.error('[admin/catalog/variation-modifier-groups/[id]] GET error:', err); return NextResponse.json({ error: err?.message||'Failed to load variation modifier group' }, { status: 500 }) }
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

    // need existing to validate min/max cross-field when partially updated
    let existing: Record<string, any>
    try { existing = await payload.findByID({ collection: 'variation-modifier-groups', id: docId as number, depth: 0, overrideAccess: true }) as unknown as Record<string, any> } catch (e:any){ return NextResponse.json({ error: 'Variation modifier group not found' }, { status: 404 }) }

    const patch: Record<string, any> = {}

    if (body.variation_id !== undefined || body.variationId !== undefined) {
      const raw = body.variation_id ?? body.variationId
      if (raw === null || raw === '') return NextResponse.json({ error: 'variation_id cannot be empty' }, { status: 400 })
      const vid = Number(raw)
      if (Number.isNaN(vid)) return NextResponse.json({ error: 'variation_id must be numeric' }, { status: 400 })
      try { const variation = await payload.findByID({ collection: 'prod-variations', id: vid, depth: 0, overrideAccess: true }) as any; if(!variation) return NextResponse.json({ error: 'variation_id does not exist' }, { status: 400 }) } catch { return NextResponse.json({ error: 'variation_id does not exist' }, { status: 400 }) }
      patch.variation_id = vid
    }
    if (body.name !== undefined) {
      if (typeof body.name !== 'string') return NextResponse.json({ error: 'name must be a string' }, { status: 400 })
      const v = body.name.trim()
      if (!v || v.length < 2) return NextResponse.json({ error: 'name must be at least 2 characters' }, { status: 400 })
      if (v.length > 255) return NextResponse.json({ error: 'name must be at most 255 characters' }, { status: 400 })
      patch.name = v
    }
    if (body.selection_type !== undefined) {
      if (typeof body.selection_type !== 'string') return NextResponse.json({ error: 'selection_type must be a string' }, { status: 400 })
      const v = body.selection_type.trim().toLowerCase()
      if (!SELECTION_TYPES.has(v)) return NextResponse.json({ error: `selection_type must be one of ${Array.from(SELECTION_TYPES).join(', ')}` }, { status: 400 })
      patch.selection_type = v
    }
    if (body.is_required !== undefined) {
      if (typeof body.is_required === 'boolean') patch.is_required = body.is_required
      else if (typeof body.is_required === 'string') {
        const v = body.is_required.trim().toLowerCase()
        if (v==='true') patch.is_required = true
        else if (v==='false') patch.is_required = false
        else return NextResponse.json({ error: 'is_required must be boolean' }, { status: 400 })
      } else return NextResponse.json({ error: 'is_required must be boolean' }, { status: 400 })
    }
    if (body.is_active !== undefined) {
      if (typeof body.is_active === 'boolean') patch.is_active = body.is_active
      else if (typeof body.is_active === 'string') {
        const v = body.is_active.trim().toLowerCase()
        if (v==='true') patch.is_active = true
        else if (v==='false') patch.is_active = false
        else return NextResponse.json({ error: 'is_active must be boolean' }, { status: 400 })
      } else return NextResponse.json({ error: 'is_active must be boolean' }, { status: 400 })
    }
    if (body.min_selections !== undefined) {
      if (body.min_selections === null || body.min_selections === '') patch.min_selections = 0
      else {
        const n = Number(body.min_selections)
        if (!Number.isFinite(n)) return NextResponse.json({ error: 'min_selections must be numeric' }, { status: 400 })
        patch.min_selections = Math.trunc(n)
      }
    }
    if (body.max_selections !== undefined) {
      if (body.max_selections === null || body.max_selections === '') patch.max_selections = null
      else {
        const n = Number(body.max_selections)
        if (!Number.isFinite(n)) return NextResponse.json({ error: 'max_selections must be numeric or null' }, { status: 400 })
        patch.max_selections = Math.trunc(n)
      }
    }
    if (body.sort_order !== undefined) {
      if (body.sort_order === null || body.sort_order === '') patch.sort_order = 0
      else {
        const n = Number(body.sort_order)
        if (!Number.isFinite(n)) return NextResponse.json({ error: 'sort_order must be numeric' }, { status: 400 })
        patch.sort_order = Math.trunc(n)
      }
    }

    if (Object.keys(patch).length===0) return NextResponse.json({ error: 'Nothing to update' }, { status: 400 })

    // validate cross-field logic like hook — need merged values
    const merged_selection = (patch.selection_type ?? existing.selection_type) as string
    const merged_is_required = patch.is_required !== undefined ? patch.is_required : !!existing.is_required
    let merged_min = patch.min_selections !== undefined ? patch.min_selections : (existing.min_selections ?? 0)
    let merged_max: number | null = patch.max_selections !== undefined ? patch.max_selections : (existing.max_selections ?? null)
    merged_min = Number(merged_min); merged_max = merged_max!=null?Number(merged_max):null
    if (Number.isFinite(merged_min) && merged_min < 0) return NextResponse.json({ error: 'Minimum selections cannot be negative' }, { status: 400 })
    if (merged_max !== null) {
      if (!Number.isFinite(merged_max) || merged_max < 1) return NextResponse.json({ error: 'Maximum selections must be at least 1 when provided' }, { status: 400 })
      if (Number.isFinite(merged_min) && merged_max < merged_min) return NextResponse.json({ error: 'Maximum selections cannot be lower than minimum selections' }, { status: 400 })
    }
    if (merged_selection === 'single' && merged_max !== null && merged_max > 1) return NextResponse.json({ error: 'Single-selection groups cannot allow more than 1 selection' }, { status: 400 })
    if (!merged_is_required) patch.min_selections = 0

    let updated: Record<string, any>
    try {
      updated = await payload.update({ collection: 'variation-modifier-groups', id: docId as number, data: patch as any, depth: 2, overrideAccess: true }) as unknown as Record<string, any>
    } catch (e:any) {
      const msg = e?.message || 'Failed to update variation modifier group'
      const lower = String(msg).toLowerCase()
      if (lower.includes('unique') || lower.includes('duplicate')) return NextResponse.json({ error: 'Duplicate value violates unique constraint', details: msg }, { status: 409 })
      return NextResponse.json({ error: msg, details: e?.data || e?.errors }, { status: 400 })
    }

    const sanitized = sanitizeDoc(updated)
    // Bust list cache so the update reflects immediately on /catalog/variation-modifier-groups
    await deleteCachedByPrefix('admin:catalog-variation-modifier-groups:')
    return NextResponse.json({ success: true, message: 'Variation modifier group updated successfully', doc: sanitized })
  } catch (err:any) { console.error('[admin/catalog/variation-modifier-groups/[id]] PATCH error:', err); return NextResponse.json({ error: err?.message||'Update failed' }, { status: 500 }) }
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

    let hasOptions = false
    try {
      const opts = await payload.find({ collection: 'variation-modifier-options', where: { variation_modifier_group_id: { equals: docId as number } }, limit: 1, depth: 0, overrideAccess: true })
      hasOptions = (opts.totalDocs ?? opts.docs.length) > 0
    } catch {}
    if (hasOptions && !force) {
      return NextResponse.json({ error: 'Variation modifier group has options. Delete or reassign them first, or use force=true to proceed.', code: 'HAS_OPTIONS' }, { status: 409 })
    }

    let deleted: any
    try { deleted = await payload.delete({ collection: 'variation-modifier-groups', id: docId as number, overrideAccess: true }) } catch (e:any) { return NextResponse.json({ error: e?.message||'Failed to delete variation modifier group' }, { status: 400 }) }
    if (!deleted) return NextResponse.json({ error: 'Variation modifier group not found' }, { status: 404 })
    // Bust list cache so the deletion reflects immediately on /catalog/variation-modifier-groups
    await deleteCachedByPrefix('admin:catalog-variation-modifier-groups:')
    return NextResponse.json({ success: true, id: deleted.id, message: 'Variation modifier group deleted successfully' })
  } catch (err:any) { console.error('[admin/catalog/variation-modifier-groups/[id]] DELETE error:', err); return NextResponse.json({ error: err?.message||'Delete failed' }, { status: 500 }) }
}
