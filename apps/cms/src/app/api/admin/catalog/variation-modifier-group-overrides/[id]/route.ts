/**
 * @file apps/cms/src/app/api/admin/catalog/variation-modifier-group-overrides/[id]/route.ts
 */

import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import configPromise from '@payload-config'
import { authenticateAdmin } from '@/utils/mediaLibrary'
import { deleteCachedByPrefix } from '@encreasl/cache'

function str(v: unknown, fallback = ''): string { return typeof v === 'string' ? v : fallback }
function optionalString(v: unknown): string | null { return typeof v === 'string' ? v.trim() || null : null }
function num(v: unknown, fallback = 0): number { if (typeof v === 'number' && Number.isFinite(v)) return v; if (typeof v === 'string'){const n=Number(v); return Number.isFinite(n)?n:fallback} return fallback }
function extractId(value: unknown): number | null {
  if (value == null) return null
  if (typeof value === 'number') return Number.isFinite(value) ? value : null
  if (typeof value === 'string') { const n=Number(value); return Number.isNaN(n)?null:n }
  if (typeof value === 'object') { const o=value as any; if('id' in o) return extractId(o.id); if('value' in o) return extractId(o.value) }
  return null
}
function sanitizeVariationBrief(value: unknown): { id: number; name: string | null; sku: string } | number | null {
  if (value == null) return null
  if (typeof value === 'number' || typeof value === 'string') { const n=Number(value); return Number.isNaN(n)?null:n }
  if (typeof value === 'object') { const src=value as Record<string,unknown>; const id=Number(src.id); if(Number.isNaN(id)) return null; return { id, name: optionalString(src.name), sku: str((src as any).sku,'') } }
  return null
}
function sanitizeGroupBrief(value: unknown): { id: number; name: string } | number | null {
  if (value == null) return null
  if (typeof value === 'number' || typeof value === 'string') { const n=Number(value); return Number.isNaN(n)?null:n }
  if (typeof value === 'object') { const src=value as Record<string,unknown>; const id=Number(src.id); if(Number.isNaN(id)) return null; return { id, name: str(src.name,'') } }
  return null
}
function sanitizeDoc(raw: Record<string, any>): Record<string, any> {
  return {
    id: raw.id,
    variation_id: sanitizeVariationBrief(raw.variation_id),
    variation: sanitizeVariationBrief(raw.variation_id),
    base_modifier_group_id: sanitizeGroupBrief(raw.base_modifier_group_id),
    base_modifier_group: sanitizeGroupBrief(raw.base_modifier_group_id),
    mode: str(raw.mode,'inherit'),
    name_override: optionalString(raw.name_override),
    selection_type_override: raw.selection_type_override ? str(raw.selection_type_override,'') : null,
    required_behavior: str(raw.required_behavior,'inherit'),
    min_selections_override: raw.min_selections_override != null && raw.min_selections_override !== '' ? num(raw.min_selections_override,0) : null,
    max_selections_override: raw.max_selections_override != null && raw.max_selections_override !== '' ? num(raw.max_selections_override, NaN) : null,
    sort_order_override: raw.sort_order_override != null && raw.sort_order_override !== '' ? Math.trunc(num(raw.sort_order_override,0)) : null,
    is_active: typeof raw.is_active==='boolean'?raw.is_active:true,
    createdAt: String(raw.createdAt ?? ''),
    updatedAt: String(raw.updatedAt ?? ''),
  }
}

const MODES = new Set(['inherit','hide','override'])
const SELECTION_TYPES = new Set(['single','multiple'])
const REQUIRED_BEHAVIORS = new Set(['inherit','required','optional'])

async function resolveVariationProductId(payload: any, variationId: number): Promise<number | null> {
  try {
    const variation = await payload.findByID({ collection: 'prod-variations', id: variationId, depth: 0, overrideAccess: true })
    return extractId((variation as any)?.product_id)
  } catch { return null }
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
    try { doc = await payload.findByID({ collection: 'variation-modifier-group-overrides', id: docId as number, depth: 2, overrideAccess: true }) as unknown as Record<string, any> } catch (e:any) { return NextResponse.json({ error: 'Variation modifier group override not found', details: e?.message }, { status: 404 }) }
    if (!doc) return NextResponse.json({ error: 'Variation modifier group override not found' }, { status: 404 })
    const sanitized = sanitizeDoc(doc)
    return NextResponse.json({ doc: sanitized })
  } catch (err:any) { console.error('[admin/catalog/variation-modifier-group-overrides/[id]] GET error:', err); return NextResponse.json({ error: err?.message||'Failed to load variation modifier group override' }, { status: 500 }) }
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

    let existing: Record<string, any>
    try { existing = await payload.findByID({ collection: 'variation-modifier-group-overrides', id: docId as number, depth: 0, overrideAccess: true }) as unknown as Record<string, any> } catch (e:any){ return NextResponse.json({ error: 'Variation modifier group override not found' }, { status: 404 }) }

    const patch: Record<string, any> = {}

    // variation_id
    if (body.variation_id !== undefined || body.variationId !== undefined) {
      const raw = body.variation_id ?? body.variationId
      if (raw === null || raw === '') return NextResponse.json({ error: 'variation_id cannot be empty' }, { status: 400 })
      const vid = Number(raw)
      if (Number.isNaN(vid)) return NextResponse.json({ error: 'variation_id must be numeric' }, { status: 400 })
      try { const v = await payload.findByID({ collection: 'prod-variations', id: vid, depth: 0, overrideAccess: true }) as any; if(!v) return NextResponse.json({ error: 'variation_id does not exist' }, { status: 400 }) } catch { return NextResponse.json({ error: 'variation_id does not exist' }, { status: 400 }) }
      patch.variation_id = vid
    }
    if (body.base_modifier_group_id !== undefined || body.baseModifierGroupId !== undefined || body.baseGroupId !== undefined) {
      const raw = body.base_modifier_group_id ?? body.baseModifierGroupId ?? body.baseGroupId
      if (raw === null || raw === '') return NextResponse.json({ error: 'base_modifier_group_id cannot be empty' }, { status: 400 })
      const gid = Number(raw)
      if (Number.isNaN(gid)) return NextResponse.json({ error: 'base_modifier_group_id must be numeric' }, { status: 400 })
      try { const g = await payload.findByID({ collection: 'modifier-groups', id: gid, depth: 0, overrideAccess: true }) as any; if(!g) return NextResponse.json({ error: 'base_modifier_group_id does not exist' }, { status: 400 }) } catch { return NextResponse.json({ error: 'base_modifier_group_id does not exist' }, { status: 400 }) }
      patch.base_modifier_group_id = gid
    }
    if (body.mode !== undefined) {
      if (typeof body.mode !== 'string') return NextResponse.json({ error: 'mode must be a string' }, { status: 400 })
      const v = body.mode.trim().toLowerCase()
      if (!MODES.has(v)) return NextResponse.json({ error: `mode must be one of ${Array.from(MODES).join(', ')}` }, { status: 400 })
      patch.mode = v
    }
    if (body.name_override !== undefined || body.nameOverride !== undefined) {
      const raw = body.name_override ?? body.nameOverride
      if (raw === null || raw === '') patch.name_override = null
      else if (typeof raw === 'string') patch.name_override = raw.trim() || null
      else return NextResponse.json({ error: 'name_override must be a string or null' }, { status: 400 })
    }
    if (body.selection_type_override !== undefined) {
      if (body.selection_type_override === null || body.selection_type_override === '') patch.selection_type_override = null
      else {
        if (typeof body.selection_type_override !== 'string') return NextResponse.json({ error: 'selection_type_override must be a string' }, { status: 400 })
        const v = body.selection_type_override.trim().toLowerCase()
        if (!SELECTION_TYPES.has(v)) return NextResponse.json({ error: `selection_type_override must be one of ${Array.from(SELECTION_TYPES).join(', ')}` }, { status: 400 })
        patch.selection_type_override = v
      }
    }
    if (body.required_behavior !== undefined) {
      if (typeof body.required_behavior !== 'string') return NextResponse.json({ error: 'required_behavior must be a string' }, { status: 400 })
      const v = body.required_behavior.trim().toLowerCase()
      if (!REQUIRED_BEHAVIORS.has(v)) return NextResponse.json({ error: `required_behavior must be one of ${Array.from(REQUIRED_BEHAVIORS).join(', ')}` }, { status: 400 })
      patch.required_behavior = v
    }
    if (body.min_selections_override !== undefined) {
      if (body.min_selections_override === null || body.min_selections_override === '') patch.min_selections_override = null
      else {
        const n = Number(body.min_selections_override)
        if (!Number.isFinite(n)) return NextResponse.json({ error: 'min_selections_override must be numeric' }, { status: 400 })
        patch.min_selections_override = Math.trunc(n)
      }
    }
    if (body.max_selections_override !== undefined) {
      if (body.max_selections_override === null || body.max_selections_override === '') patch.max_selections_override = null
      else {
        const n = Number(body.max_selections_override)
        if (!Number.isFinite(n)) return NextResponse.json({ error: 'max_selections_override must be numeric' }, { status: 400 })
        patch.max_selections_override = Math.trunc(n)
      }
    }
    if (body.sort_order_override !== undefined) {
      if (body.sort_order_override === null || body.sort_order_override === '') patch.sort_order_override = null
      else {
        const n = Number(body.sort_order_override)
        if (!Number.isFinite(n)) return NextResponse.json({ error: 'sort_order_override must be numeric' }, { status: 400 })
        patch.sort_order_override = Math.trunc(n)
      }
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

    if (Object.keys(patch).length===0) return NextResponse.json({ error: 'Nothing to update' }, { status: 400 })

    // hook replication: if variation_id or base_modifier_group_id changed, validate ownership
    const mergedVariationId = patch.variation_id !== undefined ? patch.variation_id : extractId(existing.variation_id)
    const mergedGroupId = patch.base_modifier_group_id !== undefined ? patch.base_modifier_group_id : extractId(existing.base_modifier_group_id)
    if (mergedVariationId != null && mergedGroupId != null) {
      const productId = await resolveVariationProductId(payload, mergedVariationId)
      if (productId == null) return NextResponse.json({ error: 'Unable to resolve variation product' }, { status: 400 })
      let baseGroup: any = null
      try { baseGroup = await payload.findByID({ collection: 'modifier-groups', id: mergedGroupId, depth: 0, overrideAccess: true }) as any } catch {}
      const groupProductId = extractId(baseGroup?.product_id)
      if (!groupProductId || groupProductId !== productId) {
        return NextResponse.json({ error: 'The selected base modifier group does not belong to the selected variation parent product' }, { status: 400 })
      }
    }

    let updated: Record<string, any>
    try {
      updated = await payload.update({ collection: 'variation-modifier-group-overrides', id: docId as number, data: patch as any, depth: 2, overrideAccess: true }) as unknown as Record<string, any>
    } catch (e:any) {
      const msg = e?.message || 'Failed to update variation modifier group override'
      const lower = String(msg).toLowerCase()
      if (lower.includes('unique') || lower.includes('duplicate')) return NextResponse.json({ error: 'Duplicate variation_id + base_modifier_group_id combination', details: msg }, { status: 409 })
      return NextResponse.json({ error: msg, details: e?.data || e?.errors }, { status: 400 })
    }

    const sanitized = sanitizeDoc(updated)
    // Bust list cache so the update reflects immediately on /catalog/variation-modifier-group-overrides
    await deleteCachedByPrefix('admin:catalog-variation-modifier-group-overrides:')
    return NextResponse.json({ success: true, message: 'Variation modifier group override updated successfully', doc: sanitized })
  } catch (err:any) { console.error('[admin/catalog/variation-modifier-group-overrides/[id]] PATCH error:', err); return NextResponse.json({ error: err?.message||'Update failed' }, { status: 500 }) }
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
    try { deleted = await payload.delete({ collection: 'variation-modifier-group-overrides', id: docId as number, overrideAccess: true }) } catch (e:any) { return NextResponse.json({ error: e?.message||'Failed to delete variation modifier group override' }, { status: 400 }) }
    if (!deleted) return NextResponse.json({ error: 'Variation modifier group override not found' }, { status: 404 })
    // Bust list cache so the deletion reflects immediately on /catalog/variation-modifier-group-overrides
    await deleteCachedByPrefix('admin:catalog-variation-modifier-group-overrides:')
    return NextResponse.json({ success: true, id: deleted.id, message: 'Variation modifier group override deleted successfully' })
  } catch (err:any) { console.error('[admin/catalog/variation-modifier-group-overrides/[id]] DELETE error:', err); return NextResponse.json({ error: err?.message||'Delete failed' }, { status: 500 }) }
}
