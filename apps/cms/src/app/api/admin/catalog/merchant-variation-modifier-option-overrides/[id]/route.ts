/**
 * @file apps/cms/src/app/api/admin/catalog/merchant-variation-modifier-option-overrides/[id]/route.ts
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
function sanitizeMerchantProductBrief(value: unknown): { id: number; display_title: string | null } | number | null {
  if (value == null) return null
  if (typeof value === 'number' || typeof value === 'string') { const n=Number(value); return Number.isNaN(n)?null:n }
  if (typeof value === 'object') { const src=value as Record<string,unknown>; const id=Number(src.id); if(Number.isNaN(id)) return null; return { id, display_title: optionalString(src.display_title) || optionalString((src as any).displayTitle) || null } }
  return null
}
function sanitizeVariationBrief(value: unknown): { id: number; name: string | null; sku: string } | number | null {
  if (value == null) return null
  if (typeof value === 'number' || typeof value === 'string') { const n=Number(value); return Number.isNaN(n)?null:n }
  if (typeof value === 'object') { const src=value as Record<string,unknown>; const id=Number(src.id); if(Number.isNaN(id)) return null; return { id, name: optionalString(src.name), sku: str((src as any).sku,'') } }
  return null
}
function sanitizeOptionBrief(value: unknown): { id: number; name: string } | number | null {
  if (value == null) return null
  if (typeof value === 'number' || typeof value === 'string') { const n=Number(value); return Number.isNaN(n)?null:n }
  if (typeof value === 'object') { const src=value as Record<string,unknown>; const id=Number(src.id); if(Number.isNaN(id)) return null; return { id, name: str(src.name,'') } }
  return null
}
function sanitizeDoc(raw: Record<string, any>): Record<string, any> {
  return {
    id: raw.id,
    merchant_product_id: sanitizeMerchantProductBrief(raw.merchant_product_id),
    merchant_product: sanitizeMerchantProductBrief(raw.merchant_product_id),
    variation_id: sanitizeVariationBrief(raw.variation_id),
    variation: sanitizeVariationBrief(raw.variation_id),
    target_option_source: str(raw.target_option_source,'product_base'),
    base_modifier_option_id: sanitizeOptionBrief(raw.base_modifier_option_id),
    base_modifier_option: sanitizeOptionBrief(raw.base_modifier_option_id),
    variation_modifier_option_id: sanitizeOptionBrief(raw.variation_modifier_option_id),
    variation_modifier_option: sanitizeOptionBrief(raw.variation_modifier_option_id),
    mode: str(raw.mode,'inherit'),
    name_override: optionalString(raw.name_override),
    price_adjustment_override: raw.price_adjustment_override != null && raw.price_adjustment_override !== '' ? num(raw.price_adjustment_override,0) : null,
    default_behavior: str(raw.default_behavior,'inherit'),
    availability_behavior: str(raw.availability_behavior,'inherit'),
    sort_order_override: raw.sort_order_override != null && raw.sort_order_override !== '' ? Math.trunc(num(raw.sort_order_override,0)) : null,
    is_active: typeof raw.is_active==='boolean'?raw.is_active:true,
    createdAt: String(raw.createdAt ?? ''),
    updatedAt: String(raw.updatedAt ?? ''),
  }
}

const MODES = new Set(['inherit','hide','override'])
const TARGET_SOURCES = new Set(['product_base','variation_added'])
const DEFAULT_BEHAVIORS = new Set(['inherit','default','not_default'])
const AVAILABILITY_BEHAVIORS = new Set(['inherit','available','unavailable'])

async function resolveMerchantProductProductId(payload: any, merchantProductId: number): Promise<number | null> {
  try {
    const mp = await payload.findByID({ collection: 'merchant-products', id: merchantProductId, depth: 0, overrideAccess: true })
    return extractId((mp as any)?.product_id)
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
    try { doc = await payload.findByID({ collection: 'merchant-variation-modifier-option-overrides', id: docId as number, depth: 2, overrideAccess: true }) as unknown as Record<string, any> } catch (e:any) { return NextResponse.json({ error: 'Merchant variation modifier option override not found', details: e?.message }, { status: 404 }) }
    if (!doc) return NextResponse.json({ error: 'Merchant variation modifier option override not found' }, { status: 404 })
    const sanitized = sanitizeDoc(doc)
    return NextResponse.json({ doc: sanitized })
  } catch (err:any) { console.error('[admin/catalog/merchant-variation-modifier-option-overrides/[id]] GET error:', err); return NextResponse.json({ error: err?.message||'Failed to load merchant variation modifier option override' }, { status: 500 }) }
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
    try { existing = await payload.findByID({ collection: 'merchant-variation-modifier-option-overrides', id: docId as number, depth: 0, overrideAccess: true }) as unknown as Record<string, any> } catch (e:any){ return NextResponse.json({ error: 'Merchant variation modifier option override not found' }, { status: 404 }) }

    const patch: Record<string, any> = {}

    if (body.merchant_product_id !== undefined || body.merchantProductId !== undefined || body.merchant_product !== undefined) {
      const raw = body.merchant_product_id ?? body.merchantProductId ?? body.merchant_product
      if (raw === null || raw === '') return NextResponse.json({ error: 'merchant_product_id cannot be empty' }, { status: 400 })
      const mpId = Number(raw)
      if (Number.isNaN(mpId)) return NextResponse.json({ error: 'merchant_product_id must be numeric' }, { status: 400 })
      try { const mp = await payload.findByID({ collection: 'merchant-products', id: mpId, depth: 0, overrideAccess: true }) as any; if(!mp) return NextResponse.json({ error: 'merchant_product_id does not exist' }, { status: 400 }) } catch { return NextResponse.json({ error: 'merchant_product_id does not exist' }, { status: 400 }) }
      patch.merchant_product_id = mpId
    }
    if (body.variation_id !== undefined || body.variationId !== undefined) {
      const raw = body.variation_id ?? body.variationId
      if (raw === null || raw === '') return NextResponse.json({ error: 'variation_id cannot be empty' }, { status: 400 })
      const vid = Number(raw)
      if (Number.isNaN(vid)) return NextResponse.json({ error: 'variation_id must be numeric' }, { status: 400 })
      try { const v = await payload.findByID({ collection: 'prod-variations', id: vid, depth: 0, overrideAccess: true }) as any; if(!v) return NextResponse.json({ error: 'variation_id does not exist' }, { status: 400 }) } catch { return NextResponse.json({ error: 'variation_id does not exist' }, { status: 400 }) }
      patch.variation_id = vid
    }
    if (body.target_option_source !== undefined || body.targetOptionSource !== undefined) {
      const raw = body.target_option_source ?? body.targetOptionSource
      if (typeof raw !== 'string') return NextResponse.json({ error: 'target_option_source must be a string' }, { status: 400 })
      const v = raw.trim().toLowerCase()
      if (!TARGET_SOURCES.has(v)) return NextResponse.json({ error: `target_option_source must be one of ${Array.from(TARGET_SOURCES).join(', ')}` }, { status: 400 })
      patch.target_option_source = v
    }
    if (body.base_modifier_option_id !== undefined || body.baseModifierOptionId !== undefined) {
      const raw = body.base_modifier_option_id ?? body.baseModifierOptionId
      if (raw === null || raw === '') patch.base_modifier_option_id = null
      else {
        const oid = Number(raw)
        if (Number.isNaN(oid)) return NextResponse.json({ error: 'base_modifier_option_id must be numeric' }, { status: 400 })
        try { const o = await payload.findByID({ collection: 'modifier-options', id: oid, depth: 0, overrideAccess: true }) as any; if(!o) return NextResponse.json({ error: 'base_modifier_option_id does not exist' }, { status: 400 }) } catch { return NextResponse.json({ error: 'base_modifier_option_id does not exist' }, { status: 400 }) }
        patch.base_modifier_option_id = oid
      }
    }
    if (body.variation_modifier_option_id !== undefined || body.variationModifierOptionId !== undefined) {
      const raw = body.variation_modifier_option_id ?? body.variationModifierOptionId
      if (raw === null || raw === '') patch.variation_modifier_option_id = null
      else {
        const oid = Number(raw)
        if (Number.isNaN(oid)) return NextResponse.json({ error: 'variation_modifier_option_id must be numeric' }, { status: 400 })
        try { const o = await payload.findByID({ collection: 'variation-modifier-options', id: oid, depth: 0, overrideAccess: true }) as any; if(!o) return NextResponse.json({ error: 'variation_modifier_option_id does not exist' }, { status: 400 }) } catch { return NextResponse.json({ error: 'variation_modifier_option_id does not exist' }, { status: 400 }) }
        patch.variation_modifier_option_id = oid
      }
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
    if (body.price_adjustment_override !== undefined) {
      if (body.price_adjustment_override === null || body.price_adjustment_override === '') patch.price_adjustment_override = null
      else {
        const n = Number(body.price_adjustment_override)
        if (!Number.isFinite(n)) return NextResponse.json({ error: 'price_adjustment_override must be numeric' }, { status: 400 })
        patch.price_adjustment_override = n
      }
    }
    if (body.default_behavior !== undefined) {
      if (typeof body.default_behavior !== 'string') return NextResponse.json({ error: 'default_behavior must be a string' }, { status: 400 })
      const v = body.default_behavior.trim().toLowerCase()
      if (!DEFAULT_BEHAVIORS.has(v)) return NextResponse.json({ error: `default_behavior must be one of ${Array.from(DEFAULT_BEHAVIORS).join(', ')}` }, { status: 400 })
      patch.default_behavior = v
    }
    if (body.availability_behavior !== undefined) {
      if (typeof body.availability_behavior !== 'string') return NextResponse.json({ error: 'availability_behavior must be a string' }, { status: 400 })
      const v = body.availability_behavior.trim().toLowerCase()
      if (!AVAILABILITY_BEHAVIORS.has(v)) return NextResponse.json({ error: `availability_behavior must be one of ${Array.from(AVAILABILITY_BEHAVIORS).join(', ')}` }, { status: 400 })
      patch.availability_behavior = v
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

    const mergedMerchantProductId = patch.merchant_product_id !== undefined ? patch.merchant_product_id : extractId(existing.merchant_product_id)
    const mergedVariationId = patch.variation_id !== undefined ? patch.variation_id : extractId(existing.variation_id)
    const mergedTargetSource = patch.target_option_source !== undefined ? patch.target_option_source : str(existing.target_option_source,'product_base')
    const mergedBaseOid = patch.base_modifier_option_id !== undefined ? patch.base_modifier_option_id : extractId(existing.base_modifier_option_id)
    const mergedVarOid = patch.variation_modifier_option_id !== undefined ? patch.variation_modifier_option_id : extractId(existing.variation_modifier_option_id)

    if (mergedMerchantProductId != null && mergedVariationId != null) {
      const productId = await resolveMerchantProductProductId(payload, mergedMerchantProductId)
      if (productId == null) return NextResponse.json({ error: 'Unable to resolve merchant product catalog item' }, { status: 400 })
      let variationDoc: any = null
      try { variationDoc = await payload.findByID({ collection: 'prod-variations', id: mergedVariationId, depth: 0, overrideAccess: true }) as any } catch {}
      const variationProductId = extractId(variationDoc?.product_id)
      if (!variationProductId || variationProductId !== productId) {
        return NextResponse.json({ error: 'The selected variation does not belong to the selected merchant product catalog item' }, { status: 400 })
      }

      if (mergedTargetSource === 'product_base') {
        if (mergedBaseOid == null) return NextResponse.json({ error: 'A base product modifier option is required when the target source is Product Base' }, { status: 400 })
        let baseOption: any = null
        try { baseOption = await payload.findByID({ collection: 'modifier-options', id: mergedBaseOid, depth: 0, overrideAccess: true }) as any } catch {}
        const baseGroupId = extractId(baseOption?.modifier_group_id)
        if (!baseGroupId) return NextResponse.json({ error: 'The selected base modifier option is missing its parent modifier group' }, { status: 400 })
        let baseGroup: any = null
        try { baseGroup = await payload.findByID({ collection: 'modifier-groups', id: baseGroupId, depth: 0, overrideAccess: true }) as any } catch {}
        const groupProductId = extractId(baseGroup?.product_id)
        if (!groupProductId || groupProductId !== productId) {
          return NextResponse.json({ error: 'The selected base modifier option does not belong to the selected merchant product catalog item' }, { status: 400 })
        }
        patch.base_modifier_option_id = mergedBaseOid
        patch.variation_modifier_option_id = null
      } else {
        if (mergedVarOid == null) return NextResponse.json({ error: 'A variation modifier option is required when the target source is Variation Added' }, { status: 400 })
        let varOption: any = null
        try { varOption = await payload.findByID({ collection: 'variation-modifier-options', id: mergedVarOid, depth: 0, overrideAccess: true }) as any } catch {}
        const groupId = extractId(varOption?.variation_modifier_group_id)
        if (!groupId) return NextResponse.json({ error: 'The selected variation modifier option is missing its parent variation modifier group' }, { status: 400 })
        let varGroup: any = null
        try { varGroup = await payload.findByID({ collection: 'variation-modifier-groups', id: groupId, depth: 0, overrideAccess: true }) as any } catch {}
        const gidVariationId = extractId(varGroup?.variation_id)
        if (!gidVariationId || gidVariationId !== mergedVariationId) {
          return NextResponse.json({ error: 'The selected variation modifier option does not belong to the selected variation' }, { status: 400 })
        }
        patch.variation_modifier_option_id = mergedVarOid
        patch.base_modifier_option_id = null
      }
    }

    let updated: Record<string, any>
    try {
      updated = await payload.update({ collection: 'merchant-variation-modifier-option-overrides', id: docId as number, data: patch as any, depth: 2, overrideAccess: true }) as unknown as Record<string, any>
    } catch (e:any) {
      const msg = e?.message || 'Failed to update merchant variation modifier option override'
      const lower = String(msg).toLowerCase()
      if (lower.includes('unique') || lower.includes('duplicate')) return NextResponse.json({ error: 'Duplicate merchant_product_id + variation_id + base/variation option combination', details: msg }, { status: 409 })
      return NextResponse.json({ error: msg, details: e?.data || e?.errors }, { status: 400 })
    }

    const sanitized = sanitizeDoc(updated)
    // Bust list cache so the update reflects immediately on /catalog/merchant-variation-modifier-option-overrides
    await deleteCachedByPrefix('admin:catalog-merchant-variation-modifier-option-overrides:')
    return NextResponse.json({ success: true, message: 'Merchant variation modifier option override updated successfully', doc: sanitized })
  } catch (err:any) { console.error('[admin/catalog/merchant-variation-modifier-option-overrides/[id]] PATCH error:', err); return NextResponse.json({ error: err?.message||'Update failed' }, { status: 500 }) }
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
    try { deleted = await payload.delete({ collection: 'merchant-variation-modifier-option-overrides', id: docId as number, overrideAccess: true }) } catch (e:any) { return NextResponse.json({ error: e?.message||'Failed to delete merchant variation modifier option override' }, { status: 400 }) }
    if (!deleted) return NextResponse.json({ error: 'Merchant variation modifier option override not found' }, { status: 404 })
    // Bust list cache so the deletion reflects immediately on /catalog/merchant-variation-modifier-option-overrides
    await deleteCachedByPrefix('admin:catalog-merchant-variation-modifier-option-overrides:')
    return NextResponse.json({ success: true, id: deleted.id, message: 'Merchant variation modifier option override deleted successfully' })
  } catch (err:any) { console.error('[admin/catalog/merchant-variation-modifier-option-overrides/[id]] DELETE error:', err); return NextResponse.json({ error: err?.message||'Delete failed' }, { status: 500 }) }
}
