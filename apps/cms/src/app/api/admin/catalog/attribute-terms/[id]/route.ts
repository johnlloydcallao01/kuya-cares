/**
 * @file apps/cms/src/app/api/admin/catalog/attribute-terms/[id]/route.ts
 * @description BFF for single attribute-term (detail, update, delete)
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
function numVal(v: unknown, fallback = 0): number {
  if (typeof v === 'number' && Number.isFinite(v)) return v
  if (typeof v === 'string') {
    const n = Number(v)
    return Number.isFinite(n) ? n : fallback
  }
  return fallback
}
function slugify(name: string): string {
  return name
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/[\s-]+/g, '-')
}
function sanitizeDoc(raw: Record<string, any>): Record<string, any> {
  const attrRaw = raw.attribute_id
  let attribute: { id: number; name: string; slug: string; type: string } | null = null
  if (attrRaw && typeof attrRaw === 'object' && !Array.isArray(attrRaw)) {
    const a = attrRaw as Record<string, any>
    const id = Number(a.id)
    if (!Number.isNaN(id)) {
      attribute = {
        id,
        name: str(a.name, ''),
        slug: str(a.slug, ''),
        type: str(a.type, 'select'),
      }
    }
  }
  const attrIdNum =
    attribute?.id ??
    (typeof attrRaw === 'number' ? attrRaw : typeof attrRaw === 'string' ? Number(attrRaw) : null)
  return {
    id: raw.id,
    attribute_id: attrIdNum,
    attribute,
    name: str(raw.name, ''),
    slug: str(raw.slug, ''),
    value: optionalString(raw.value),
    sort_order: numVal(raw.sort_order, 0),
    is_active: typeof raw.is_active === 'boolean' ? raw.is_active : true,
    createdAt: String(raw.createdAt ?? ''),
    updatedAt: String(raw.updatedAt ?? ''),
  }
}

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
const HEX_RE = /^#[0-9A-Fa-f]{6}$/

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
      doc = (await payload.findByID({ collection: 'prod-attribute-terms', id: docId as number, depth: 2, overrideAccess: true })) as unknown as Record<string, any>
    } catch (e: any) {
      return NextResponse.json({ error: 'Attribute term not found', details: e?.message }, { status: 404 })
    }
    if (!doc) return NextResponse.json({ error: 'Attribute term not found' }, { status: 404 })
    const sanitized = sanitizeDoc(doc)
    return NextResponse.json({ doc: sanitized })
  } catch (err: any) {
    console.error('[admin/catalog/attribute-terms/[id]] GET error:', err)
    return NextResponse.json({ error: err?.message || 'Failed to load attribute term' }, { status: 500 })
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

    // fetch existing to validate
    let existing: Record<string, any>
    try {
      existing = (await payload.findByID({ collection: 'prod-attribute-terms', id: docId as number, depth: 2, overrideAccess: true })) as unknown as Record<string, any>
    } catch (e: any) {
      return NextResponse.json({ error: 'Attribute term not found', details: e?.message }, { status: 404 })
    }

    const patch: Record<string, any> = {}
    let targetAttributeId: number | null = null
    let targetAttributeType: string | null = null

    // attribute_id change
    if (body.attribute_id !== undefined || body.attributeId !== undefined) {
      const raw = body.attribute_id ?? body.attributeId
      if (raw === null || raw === '') {
        return NextResponse.json({ error: 'attribute_id cannot be empty' }, { status: 400 })
      }
      const n = Number(raw)
      if (Number.isNaN(n) || !Number.isFinite(n)) return NextResponse.json({ error: 'attribute_id must be numeric' }, { status: 400 })
      // validate exists
      let attrDoc: Record<string, any> | null = null
      try {
        attrDoc = (await payload.findByID({ collection: 'prod-attributes', id: n as number, depth: 0, overrideAccess: true })) as unknown as Record<string, any>
      } catch {
        return NextResponse.json({ error: `attribute_id ${n} does not exist` }, { status: 400 })
      }
      if (!attrDoc) return NextResponse.json({ error: `attribute_id ${n} not found` }, { status: 404 })
      patch.attribute_id = n
      targetAttributeId = n
      targetAttributeType = String((attrDoc as any).type || 'select').toLowerCase()
    } else {
      // keep existing
      const curAttr = (existing as any).attribute_id
      const curId =
        curAttr && typeof curAttr === 'object' && 'id' in curAttr
          ? Number((curAttr as any).id)
          : Number(curAttr)
      if (!Number.isNaN(curId)) {
        targetAttributeId = curId
        // need type if exists
        const curType =
          curAttr && typeof curAttr === 'object' && 'type' in curAttr
            ? String((curAttr as any).type).toLowerCase()
            : null
        if (curType) targetAttributeType = curType
        else {
          try {
            const a = (await payload.findByID({ collection: 'prod-attributes', id: curId as number, depth: 0, overrideAccess: true })) as any
            if (a) targetAttributeType = String(a.type || 'select').toLowerCase()
          } catch {}
        }
      }
    }

    if (body.name !== undefined) {
      if (typeof body.name !== 'string') return NextResponse.json({ error: 'name must be a string' }, { status: 400 })
      const v = body.name.trim()
      if (!v || v.length < 2) return NextResponse.json({ error: 'name must be at least 2 characters' }, { status: 400 })
      if (v.length > 100) return NextResponse.json({ error: 'name must be at most 100 characters' }, { status: 400 })
      patch.name = v
    }

    if (body.slug !== undefined) {
      if (typeof body.slug !== 'string') return NextResponse.json({ error: 'slug must be a string' }, { status: 400 })
      const v = body.slug.trim().toLowerCase()
      if (!v) return NextResponse.json({ error: 'slug cannot be empty' }, { status: 400 })
      if (v.length > 100) return NextResponse.json({ error: 'slug must be at most 100 characters' }, { status: 400 })
      if (!SLUG_RE.test(v)) return NextResponse.json({ error: 'slug must be lowercase alphanumeric with hyphens (e.g. red-color)' }, { status: 400 })
      patch.slug = v
    } else if (body.name !== undefined && patch.name) {
      // if name changed but slug not provided, do not auto overwrite — keep existing slug unless explicit
      // optional: could generate but spec says PATCH whitelist same fields, slug optional auto — we keep as is
    }

    if (body.value !== undefined) {
      if (body.value === null || String(body.value).trim() === '') {
        patch.value = null
      } else {
        const v = String(body.value).trim()
        if (v.length > 100) return NextResponse.json({ error: 'value must be at most 100 characters' }, { status: 400 })
        if (targetAttributeType === 'color' && v) {
          if (v.startsWith('#') && !HEX_RE.test(v)) {
            return NextResponse.json({ error: 'value for color attribute must be a valid hex color like #RRGGBB (e.g. #FF5733)' }, { status: 400 })
          }
        }
        patch.value = v
      }
    }

    if (body.sort_order !== undefined || body.sortOrder !== undefined) {
      const raw = body.sort_order ?? body.sortOrder
      if (raw === null || raw === '') {
        patch.sort_order = 0
      } else {
        const n = numVal(raw, NaN)
        if (Number.isNaN(n)) return NextResponse.json({ error: 'sort_order must be numeric' }, { status: 400 })
        patch.sort_order = Math.trunc(n)
      }
    }

    if (body.is_active !== undefined || body.isActive !== undefined) {
      const raw = body.is_active ?? body.isActive
      if (typeof raw === 'boolean') patch.is_active = raw
      else if (typeof raw === 'string') {
        const v = raw.trim().toLowerCase()
        if (v === 'true') patch.is_active = true
        else if (v === 'false') patch.is_active = false
        else return NextResponse.json({ error: 'is_active must be boolean' }, { status: 400 })
      } else if (raw === null) {
        patch.is_active = true
      } else {
        return NextResponse.json({ error: 'is_active must be boolean' }, { status: 400 })
      }
    }

    if (Object.keys(patch).length === 0) return NextResponse.json({ error: 'Nothing to update' }, { status: 400 })

    // if slug or attribute_id changed, check duplicate per attribute
    const finalSlug = patch.slug ?? String((existing as any).slug || '').toLowerCase()
    const finalAttrId = patch.attribute_id ?? targetAttributeId
    if (finalSlug && finalAttrId !== null && finalAttrId !== undefined) {
      try {
        const dup = await payload.find({
          collection: 'prod-attribute-terms',
          where: {
            and: [{ attribute_id: { equals: finalAttrId } }, { slug: { equals: finalSlug } }],
          },
          limit: 1,
          depth: 0,
          overrideAccess: true,
        })
        const conflict = dup.docs.find((d: any) => String(d.id) !== String(docId))
        if (conflict) {
          return NextResponse.json({ error: `Duplicate slug per attribute: ${finalSlug} already exists for attribute #${finalAttrId}` }, { status: 409 })
        }
      } catch {}
    }

    let updated: Record<string, any>
    try {
      updated = (await payload.update({ collection: 'prod-attribute-terms', id: docId as number, data: patch as any, depth: 2, overrideAccess: true })) as unknown as Record<string, any>
    } catch (e: any) {
      const msg = e?.message || 'Failed to update attribute term'
      const lower = String(msg).toLowerCase()
      if (lower.includes('unique') || lower.includes('duplicate')) return NextResponse.json({ error: 'Duplicate value violates unique constraint', details: msg }, { status: 409 })
      return NextResponse.json({ error: msg, details: e?.data || e?.errors }, { status: 400 })
    }

    const sanitized = sanitizeDoc(updated)
    // Bust list cache so the update reflects immediately on /catalog/attribute-terms
    await deleteCachedByPrefix('admin:catalog-attribute-terms:')
    return NextResponse.json({ success: true, message: 'Attribute term updated successfully', doc: sanitized })
  } catch (err: any) {
    console.error('[admin/catalog/attribute-terms/[id]] PATCH error:', err)
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

    const { searchParams } = new URL(request.url)
    const force = searchParams.get('force') === 'true'

    // Check if variation-values reference term_id -> 409 HAS_VALUES unless force
    let hasValues = false
    try {
      const refs = await payload.find({
        collection: 'prod-variation-values',
        where: { term_id: { equals: docId as number } },
        limit: 1,
        depth: 0,
        overrideAccess: true,
      })
      hasValues = (refs.totalDocs ?? refs.docs.length) > 0
    } catch {
      hasValues = false
    }

    if (hasValues && !force) {
      return NextResponse.json({ error: 'Attribute term has variation values. Delete or reassign them first, or use force=true to proceed.', code: 'HAS_VALUES' }, { status: 409 })
    }

    let deleted: any
    try {
      deleted = await payload.delete({ collection: 'prod-attribute-terms', id: docId as number, overrideAccess: true })
    } catch (e: any) {
      return NextResponse.json({ error: e?.message || 'Failed to delete attribute term' }, { status: 400 })
    }
    if (!deleted) return NextResponse.json({ error: 'Attribute term not found' }, { status: 404 })
    // Bust list cache so the deletion reflects immediately on /catalog/attribute-terms
    await deleteCachedByPrefix('admin:catalog-attribute-terms:')
    return NextResponse.json({ success: true, id: deleted.id, message: 'Attribute term deleted successfully' })
  } catch (err: any) {
    console.error('[admin/catalog/attribute-terms/[id]] DELETE error:', err)
    return NextResponse.json({ error: err?.message || 'Delete failed' }, { status: 500 })
  }
}
