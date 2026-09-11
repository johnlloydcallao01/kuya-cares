/**
 * @file apps/cms/src/app/api/admin/catalog/attributes/[id]/route.ts
 */

import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import configPromise from '@payload-config'
import { authenticateAdmin } from '@/utils/mediaLibrary'
import { deleteCachedByPrefix } from '@encreasl/cache'

function str(v: unknown, fallback = ''): string {
  return typeof v === 'string' ? v : fallback
}
function sanitizeDoc(raw: Record<string, any>): Record<string, any> {
  return {
    id: raw.id,
    name: str(raw.name, ''),
    slug: str(raw.slug, ''),
    type: str(raw.type, 'select'),
    is_active: typeof raw.is_active === 'boolean' ? raw.is_active : true,
    createdAt: String(raw.createdAt ?? ''),
    updatedAt: String(raw.updatedAt ?? ''),
  }
}

const ATTRIBUTE_TYPES = new Set(['select', 'color', 'button', 'radio'])
const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

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
      doc = (await payload.findByID({ collection: 'prod-attributes', id: docId as number, depth: 2, overrideAccess: true })) as unknown as Record<string, any>
    } catch (e: any) {
      return NextResponse.json({ error: 'Attribute not found', details: e?.message }, { status: 404 })
    }
    if (!doc) return NextResponse.json({ error: 'Attribute not found' }, { status: 404 })
    const sanitized = sanitizeDoc(doc)
    return NextResponse.json({ doc: sanitized })
  } catch (err: any) {
    console.error('[admin/catalog/attributes/[id]] GET error:', err)
    return NextResponse.json({ error: err?.message || 'Failed to load attribute' }, { status: 500 })
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

    const patch: Record<string, any> = {}

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
      if (!v) {
        // allow clearing to re-trigger hook? But hook needs data; we just skip empty
        // treat empty as no-op? Instead require valid
        return NextResponse.json({ error: 'slug cannot be empty' }, { status: 400 })
      }
      if (v.length > 100) return NextResponse.json({ error: 'slug must be at most 100 characters' }, { status: 400 })
      if (!SLUG_RE.test(v)) return NextResponse.json({ error: 'slug must be lowercase alphanumeric with hyphens (e.g. my-attribute)' }, { status: 400 })
      // uniqueness check
      const existing = await payload.find({
        collection: 'prod-attributes',
        where: { slug: { equals: v } },
        limit: 1,
        depth: 0,
        overrideAccess: true,
      })
      const conflict = existing.docs.find((d: any) => String(d.id) !== String(docId))
      if (conflict) return NextResponse.json({ error: `Duplicate slug: ${v} already exists`, details: `slug ${v} already exists` }, { status: 409 })
      patch.slug = v
    }
    if (body.type !== undefined) {
      if (typeof body.type !== 'string') return NextResponse.json({ error: 'type must be a string' }, { status: 400 })
      const v = body.type.trim().toLowerCase()
      if (!ATTRIBUTE_TYPES.has(v)) return NextResponse.json({ error: `type must be one of ${Array.from(ATTRIBUTE_TYPES).join(', ')}` }, { status: 400 })
      patch.type = v
    }
    if (body.is_active !== undefined) {
      if (typeof body.is_active === 'boolean') patch.is_active = body.is_active
      else if (typeof body.is_active === 'string') {
        const v = body.is_active.trim().toLowerCase()
        if (v === 'true') patch.is_active = true
        else if (v === 'false') patch.is_active = false
        else return NextResponse.json({ error: 'is_active must be boolean' }, { status: 400 })
      } else {
        return NextResponse.json({ error: 'is_active must be boolean' }, { status: 400 })
      }
    }

    if (Object.keys(patch).length === 0) return NextResponse.json({ error: 'Nothing to update' }, { status: 400 })

    let updated: Record<string, any>
    try {
      updated = (await payload.update({ collection: 'prod-attributes', id: docId as number, data: patch as any, depth: 2, overrideAccess: true })) as unknown as Record<string, any>
    } catch (e: any) {
      const msg = e?.message || 'Failed to update attribute'
      const lower = String(msg).toLowerCase()
      if (lower.includes('unique') || lower.includes('duplicate')) return NextResponse.json({ error: 'Duplicate value violates unique constraint', details: msg }, { status: 409 })
      return NextResponse.json({ error: msg, details: e?.data || e?.errors }, { status: 400 })
    }

    const sanitized = sanitizeDoc(updated)
    // Bust list cache so the update reflects immediately on /catalog/attributes
    await deleteCachedByPrefix('admin:catalog-attributes:')
    return NextResponse.json({ success: true, message: 'Attribute updated successfully', doc: sanitized })
  } catch (err: any) {
    console.error('[admin/catalog/attributes/[id]] PATCH error:', err)
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

    // Check if has attribute-terms
    let hasTerms = false
    try {
      const terms = await payload.find({
        collection: 'prod-attribute-terms',
        where: { attribute_id: { equals: docId as number } },
        limit: 1,
        depth: 0,
        overrideAccess: true,
      })
      hasTerms = (terms.totalDocs ?? terms.docs.length) > 0
    } catch {
      // if collection not found, treat as no terms
      hasTerms = false
    }

    if (hasTerms && !force) {
      return NextResponse.json({ error: 'Attribute has terms. Delete or reassign them first, or use force=true to proceed.', code: 'HAS_TERMS' }, { status: 409 })
    }

    let deleted: any
    try {
      deleted = await payload.delete({ collection: 'prod-attributes', id: docId as number, overrideAccess: true })
    } catch (e: any) {
      return NextResponse.json({ error: e?.message || 'Failed to delete attribute' }, { status: 400 })
    }
    if (!deleted) return NextResponse.json({ error: 'Attribute not found' }, { status: 404 })
    // Bust list cache so the deletion reflects immediately on /catalog/attributes
    await deleteCachedByPrefix('admin:catalog-attributes:')
    return NextResponse.json({ success: true, id: deleted.id, message: 'Attribute deleted successfully' })
  } catch (err: any) {
    console.error('[admin/catalog/attributes/[id]] DELETE error:', err)
    return NextResponse.json({ error: err?.message || 'Delete failed' }, { status: 500 })
  }
}
