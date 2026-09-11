/**
 * @file apps/cms/src/app/api/admin/catalog/variation-values/[id]/route.ts
 * @description BFF for single prod-variation-value (detail, update, delete)
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
function sanitizeVariation(value: unknown): { id: number; sku: string; name: string | null; product: ReturnType<typeof sanitizeProductBrief> } | number | null {
  if (value == null) return null
  if (typeof value === 'number' || typeof value === 'string') {
    const n = Number(value)
    return Number.isNaN(n) ? null : n
  }
  if (typeof value === 'object') {
    const src = value as Record<string, any>
    const id = Number(src.id)
    if (Number.isNaN(id)) return null
    return { id, sku: str(src.sku, ''), name: optionalString(src.name), product: sanitizeProductBrief(src.product_id) }
  }
  return null
}
function sanitizeAttribute(value: unknown): { id: number; name: string; slug: string; type: string } | number | null {
  if (value == null) return null
  if (typeof value === 'number' || typeof value === 'string') {
    const n = Number(value)
    return Number.isNaN(n) ? null : n
  }
  if (typeof value === 'object') {
    const src = value as Record<string, any>
    const id = Number(src.id)
    if (Number.isNaN(id)) return null
    return { id, name: str(src.name, ''), slug: str(src.slug, ''), type: str(src.type, 'select') }
  }
  return null
}
function sanitizeTerm(value: unknown): { id: number; name: string; slug: string; value: string | null; attribute_id: number | null } | number | null {
  if (value == null) return null
  if (typeof value === 'number' || typeof value === 'string') {
    const n = Number(value)
    return Number.isNaN(n) ? null : n
  }
  if (typeof value === 'object') {
    const src = value as Record<string, any>
    const id = Number(src.id)
    if (Number.isNaN(id)) return null
    const attrRaw = src.attribute_id
    const attrIdNum = attrRaw && typeof attrRaw === 'object' && 'id' in attrRaw ? Number((attrRaw as any).id) : typeof attrRaw === 'number' ? attrRaw : typeof attrRaw === 'string' ? Number(attrRaw) : null
    return { id, name: str(src.name, ''), slug: str(src.slug, ''), value: optionalString(src.value), attribute_id: attrIdNum !== null && !Number.isNaN(attrIdNum) ? attrIdNum : null }
  }
  return null
}
function sanitizeDoc(raw: Record<string, any>): Record<string, any> {
  const variationRaw = raw.variation_id
  const attributeRaw = raw.attribute_id
  const termRaw = raw.term_id
  const variation = sanitizeVariation(variationRaw)
  const attribute = sanitizeAttribute(attributeRaw)
  const term = sanitizeTerm(termRaw)
  const variationIdNum = variation && typeof variation === 'object' && 'id' in variation ? (variation as any).id : typeof variationRaw === 'number' ? variationRaw : typeof variationRaw === 'string' ? Number(variationRaw) : null
  const attributeIdNum = attribute && typeof attribute === 'object' && 'id' in attribute ? (attribute as any).id : typeof attributeRaw === 'number' ? attributeRaw : typeof attributeRaw === 'string' ? Number(attributeRaw) : null
  const termIdNum = term && typeof term === 'object' && 'id' in term ? (term as any).id : typeof termRaw === 'number' ? termRaw : typeof termRaw === 'string' ? Number(termRaw) : null
  return {
    id: raw.id,
    variation_id: variationIdNum,
    variation: typeof variation === 'object' && variation !== null && 'id' in variation ? variation : null,
    variationBrief: typeof variation === 'object' && variation !== null && 'id' in variation ? variation : null,
    attribute_id: attributeIdNum,
    attribute: typeof attribute === 'object' && attribute !== null && 'id' in attribute ? attribute : null,
    term_id: termIdNum,
    term: typeof term === 'object' && term !== null && 'id' in term ? term : null,
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
      doc = (await payload.findByID({ collection: 'prod-variation-values', id: docId as number, depth: 2, overrideAccess: true })) as unknown as Record<string, any>
    } catch (e: any) {
      return NextResponse.json({ error: 'Variation value not found', details: e?.message }, { status: 404 })
    }
    if (!doc) return NextResponse.json({ error: 'Variation value not found' }, { status: 404 })
    const sanitized = sanitizeDoc(doc)
    return NextResponse.json({ doc: sanitized })
  } catch (err: any) {
    console.error('[admin/catalog/variation-values/[id]] GET error:', err)
    return NextResponse.json({ error: err?.message || 'Failed to load variation value' }, { status: 500 })
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

    // fetch existing
    let existing: Record<string, any>
    try {
      existing = (await payload.findByID({ collection: 'prod-variation-values', id: docId as number, depth: 2, overrideAccess: true })) as unknown as Record<string, any>
    } catch (e: any) {
      return NextResponse.json({ error: 'Variation value not found', details: e?.message }, { status: 404 })
    }
    if (!existing) return NextResponse.json({ error: 'Variation value not found' }, { status: 404 })

    const patch: Record<string, any> = {}

    // determine final values for validation
    const existingVarIdRaw = (existing as any).variation_id
    const existingAttrIdRaw = (existing as any).attribute_id
    const existingTermIdRaw = (existing as any).term_id
    const existingVarId = existingVarIdRaw && typeof existingVarIdRaw === 'object' && 'id' in existingVarIdRaw ? Number((existingVarIdRaw as any).id) : Number(existingVarIdRaw)
    const existingAttrId = existingAttrIdRaw && typeof existingAttrIdRaw === 'object' && 'id' in existingAttrIdRaw ? Number((existingAttrIdRaw as any).id) : Number(existingAttrIdRaw)
    const existingTermId = existingTermIdRaw && typeof existingTermIdRaw === 'object' && 'id' in existingTermIdRaw ? Number((existingTermIdRaw as any).id) : Number(existingTermIdRaw)

    let targetVariationId = Number.isNaN(existingVarId) ? null : existingVarId
    let targetAttributeId = Number.isNaN(existingAttrId) ? null : existingAttrId
    let targetTermId = Number.isNaN(existingTermId) ? null : existingTermId

    if (body.variation_id !== undefined || body.variationId !== undefined || body.variation !== undefined) {
      const raw = body.variation_id ?? body.variationId ?? body.variation
      if (raw === null || raw === '') return NextResponse.json({ error: 'variation_id cannot be empty' }, { status: 400 })
      const n = Number(raw)
      if (Number.isNaN(n) || !Number.isFinite(n)) return NextResponse.json({ error: 'variation_id must be numeric' }, { status: 400 })
      try {
        const v = await payload.findByID({ collection: 'prod-variations', id: n as number, depth: 0, overrideAccess: true })
        if (!v) return NextResponse.json({ error: `variation_id ${n} does not exist` }, { status: 400 })
      } catch {
        return NextResponse.json({ error: `variation_id ${n} does not exist` }, { status: 400 })
      }
      patch.variation_id = n
      targetVariationId = n
    }

    if (body.attribute_id !== undefined || body.attributeId !== undefined || body.attribute !== undefined) {
      const raw = body.attribute_id ?? body.attributeId ?? body.attribute
      if (raw === null || raw === '') return NextResponse.json({ error: 'attribute_id cannot be empty' }, { status: 400 })
      const n = Number(raw)
      if (Number.isNaN(n) || !Number.isFinite(n)) return NextResponse.json({ error: 'attribute_id must be numeric' }, { status: 400 })
      try {
        const a = await payload.findByID({ collection: 'prod-attributes', id: n as number, depth: 0, overrideAccess: true })
        if (!a) return NextResponse.json({ error: `attribute_id ${n} does not exist` }, { status: 400 })
      } catch {
        return NextResponse.json({ error: `attribute_id ${n} does not exist` }, { status: 400 })
      }
      patch.attribute_id = n
      targetAttributeId = n
    }

    if (body.term_id !== undefined || body.termId !== undefined || body.term !== undefined) {
      const raw = body.term_id ?? body.termId ?? body.term
      if (raw === null || raw === '') return NextResponse.json({ error: 'term_id cannot be empty' }, { status: 400 })
      const n = Number(raw)
      if (Number.isNaN(n) || !Number.isFinite(n)) return NextResponse.json({ error: 'term_id must be numeric' }, { status: 400 })
      // validate exists now, but term->attribute check later after final targetAttributeId known
      try {
        const termRes = await payload.find({ collection: 'prod-attribute-terms', where: { id: { equals: n } }, limit: 1, depth: 0, overrideAccess: true })
        const t = (termRes.docs?.[0] as any) ?? null
        if (!t) return NextResponse.json({ error: `term_id ${n} does not exist` }, { status: 400 })
      } catch {
        return NextResponse.json({ error: `term_id ${n} does not exist` }, { status: 400 })
      }
      patch.term_id = n
      targetTermId = n
    }

    if (Object.keys(patch).length === 0) return NextResponse.json({ error: 'Nothing to update' }, { status: 400 })

    // validate term belongs to attribute using final targetAttributeId and targetTermId
    if (targetTermId !== null && targetAttributeId !== null) {
      try {
        const termRes = await payload.find({
          collection: 'prod-attribute-terms',
          where: { id: { equals: targetTermId } },
          limit: 1,
          depth: 0,
          overrideAccess: true,
        })
        const t = (termRes.docs?.[0] as any) ?? null
        if (!t) return NextResponse.json({ error: `term_id ${targetTermId} does not exist` }, { status: 400 })
        const termAttrId = typeof t.attribute_id === 'object' ? (t.attribute_id as any).id : t.attribute_id
        if (Number(termAttrId) !== Number(targetAttributeId)) {
          return NextResponse.json({ error: 'Term does not belong to the selected attribute', details: `term attribute ${termAttrId} != selected ${targetAttributeId}` }, { status: 400 })
        }
      } catch (e: any) {
        return NextResponse.json({ error: e?.message || 'Failed to validate term' }, { status: 400 })
      }
    }

    // duplicate check on update: same variation_id + attribute_id already exists (different id)
    if (targetVariationId !== null && targetAttributeId !== null) {
      try {
        const dup = await payload.find({
          collection: 'prod-variation-values',
          where: {
            and: [{ variation_id: { equals: targetVariationId } }, { attribute_id: { equals: targetAttributeId } }],
          },
          limit: 10,
          depth: 0,
          overrideAccess: true,
        })
        const conflict = dup.docs.find((d: any) => String(d.id) !== String(docId))
        if (conflict) {
          return NextResponse.json(
            { error: `Duplicate attribute for variation: attribute #${targetAttributeId} already assigned to variation #${targetVariationId}`, code: 'DUPLICATE_ATTRIBUTE_FOR_VARIATION' },
            { status: 409 },
          )
        }
      } catch {}
    }

    let updated: Record<string, any>
    try {
      updated = (await payload.update({ collection: 'prod-variation-values', id: docId as number, data: patch as any, depth: 2, overrideAccess: true })) as unknown as Record<string, any>
    } catch (e: any) {
      const msg = e?.message || 'Failed to update variation value'
      const lower = String(msg).toLowerCase()
      if (lower.includes('term does not belong')) return NextResponse.json({ error: 'Term does not belong to the selected attribute', details: msg }, { status: 400 })
      if (lower.includes('unique') || lower.includes('duplicate')) return NextResponse.json({ error: 'Duplicate attribute for variation', code: 'DUPLICATE_ATTRIBUTE_FOR_VARIATION', details: msg }, { status: 409 })
      return NextResponse.json({ error: msg, details: e?.data || e?.errors }, { status: 400 })
    }

    const sanitized = sanitizeDoc(updated)
    // Bust list cache so the update reflects immediately on /catalog/variation-values
    await deleteCachedByPrefix('admin:catalog-variation-values:')
    return NextResponse.json({ success: true, message: 'Variation value updated successfully', doc: sanitized })
  } catch (err: any) {
    console.error('[admin/catalog/variation-values/[id]] PATCH error:', err)
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
      deleted = await payload.delete({ collection: 'prod-variation-values', id: docId as number, overrideAccess: true })
    } catch (e: any) {
      const msg = e?.message || 'Failed to delete variation value'
      if (String(msg).toLowerCase().includes('not found')) return NextResponse.json({ error: 'Variation value not found', details: msg }, { status: 404 })
      return NextResponse.json({ error: msg }, { status: 400 })
    }
    if (!deleted) return NextResponse.json({ error: 'Variation value not found' }, { status: 404 })
    // Bust list cache so the deletion reflects immediately on /catalog/variation-values
    await deleteCachedByPrefix('admin:catalog-variation-values:')
    return NextResponse.json({ success: true, id: deleted.id, message: 'Variation value deleted successfully' })
  } catch (err: any) {
    console.error('[admin/catalog/variation-values/[id]] DELETE error:', err)
    return NextResponse.json({ error: err?.message || 'Delete failed' }, { status: 500 })
  }
}
