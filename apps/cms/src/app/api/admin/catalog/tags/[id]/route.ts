/**
 * @file apps/cms/src/app/api/admin/catalog/tags/[id]/route.ts
 * @description BFF for single prod-tag — admin-only.
 */

import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import configPromise from '@payload-config'
import { authenticateAdmin } from '@/utils/mediaLibrary'
import { deleteCachedByPrefix } from '@encreasl/cache'

const TAG_TYPES = new Set(['general', 'dietary', 'cuisine', 'promotion', 'feature', 'allergen', 'spice_level', 'temperature', 'size_category'])
const HEX_REGEX = /^#([0-9a-fA-F]{6})$/

function sanitizeParent(v: unknown): { id: number; name: string; slug: string } | null {
  if (!v || typeof v !== 'object') return null
  const s = v as Record<string, unknown>
  const id = Number(s.id)
  if (Number.isNaN(id)) return null
  return { id, name: String(s.name || ''), slug: String(s.slug || '') }
}
function sanitizeDoc(raw: Record<string, any>, productCount: number, groupCount: number): Record<string, any> {
  return {
    id: raw.id,
    name: String(raw.name || ''),
    slug: String(raw.slug || ''),
    description: raw.description ? String(raw.description) : null,
    color: raw.color ? String(raw.color) : null,
    tag_type: raw.tag_type ? String(raw.tag_type) : 'general',
    parent_tag_id: sanitizeParent(raw.parent_tag_id),
    usage_count: typeof raw.usage_count === 'number' ? raw.usage_count : 0,
    is_active: typeof raw.is_active === 'boolean' ? raw.is_active : true,
    is_featured: typeof raw.is_featured === 'boolean' ? raw.is_featured : false,
    productCount,
    groupCount,
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
    try {
      doc = (await payload.findByID({ collection: 'prod-tags', id: docId as number, depth: 1, overrideAccess: true })) as unknown as Record<string, any>
    } catch (e: any) {
      return NextResponse.json({ error: 'Tag not found', details: e?.message }, { status: 404 })
    }
    if (!doc) return NextResponse.json({ error: 'Tag not found' }, { status: 404 })

    // productCount via prod-tags-junction where tag_id = id
    let productCount = 0
    let groupCount = 0
    try {
      const [jRes, mRes] = await Promise.all([
        payload.find({ collection: 'prod-tags-junction', where: { tag_id: { equals: doc.id } }, limit: 0, depth: 0, overrideAccess: true, pagination: false } as any),
        payload.find({ collection: 'tag-group-memberships', where: { tag_id: { equals: doc.id } }, limit: 0, depth: 0, overrideAccess: true, pagination: false } as any),
      ])
      productCount = typeof (jRes as any).totalDocs === 'number' ? (jRes as any).totalDocs : (jRes as any).docs?.length || 0
      groupCount = typeof (mRes as any).totalDocs === 'number' ? (mRes as any).totalDocs : (mRes as any).docs?.length || 0
      // fallback scans if totalDocs not available and contains semantics differ
      if (productCount === 0) {
        const allJ = await payload.find({ collection: 'prod-tags-junction', limit: 5000, depth: 0, overrideAccess: true, pagination: false } as any)
        productCount = ((allJ as any).docs as any[]).filter((j: any) => {
          const tid = j.tag_id
          const cid = typeof tid === 'object' ? String((tid as any).id ?? tid) : String(tid)
          return cid === String(doc.id)
        }).length
      }
      if (groupCount === 0) {
        const allM = await payload.find({ collection: 'tag-group-memberships', limit: 5000, depth: 0, overrideAccess: true, pagination: false } as any)
        groupCount = ((allM as any).docs as any[]).filter((m: any) => {
          const tid = m.tag_id
          const cid = typeof tid === 'object' ? String((tid as any).id ?? tid) : String(tid)
          return cid === String(doc.id)
        }).length
      }
    } catch {}

    const sanitized = sanitizeDoc(doc, productCount, groupCount)
    return NextResponse.json({ doc: sanitized })
  } catch (err: any) {
    console.error('[admin/catalog/tags/[id]] GET error:', err)
    return NextResponse.json({ error: err?.message || 'Failed to load' }, { status: 500 })
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
      if (typeof body.name !== 'string') return NextResponse.json({ error: 'name must be string' }, { status: 400 })
      const v = body.name.trim()
      if (!v || v.length < 2) return NextResponse.json({ error: 'name must be at least 2 characters' }, { status: 400 })
      if (v.length > 100) return NextResponse.json({ error: 'name must be at most 100 chars' }, { status: 400 })
      patch.name = v
    }
    if (body.slug !== undefined) {
      if (typeof body.slug !== 'string') return NextResponse.json({ error: 'slug must be string' }, { status: 400 })
      const v = body.slug.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
      if (!v) return NextResponse.json({ error: 'slug cannot be empty' }, { status: 400 })
      if (v.length > 100) return NextResponse.json({ error: 'slug must be at most 100 chars' }, { status: 400 })
      if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(v)) return NextResponse.json({ error: 'slug must be lowercase alphanumeric with hyphens' }, { status: 400 })
      patch.slug = v
    }
    if (body.description !== undefined) {
      if (body.description === null) patch.description = null
      else if (typeof body.description === 'string') patch.description = body.description.trim() || null
      else return NextResponse.json({ error: 'description must be string or null' }, { status: 400 })
    }
    if (body.color !== undefined) {
      if (body.color === null || String(body.color).trim() === '') patch.color = null
      else {
        const c = String(body.color).trim()
        if (c.length > 7) return NextResponse.json({ error: 'color must be at most 7 chars (#RRGGBB)' }, { status: 400 })
        if (!HEX_REGEX.test(c)) return NextResponse.json({ error: 'color must be hex #RRGGBB' }, { status: 400 })
        patch.color = c
      }
    }
    if (body.tag_type !== undefined) {
      if (typeof body.tag_type !== 'string') return NextResponse.json({ error: 'tag_type must be string' }, { status: 400 })
      const v = String(body.tag_type).trim().toLowerCase()
      if (!TAG_TYPES.has(v)) return NextResponse.json({ error: `tag_type must be one of: ${Array.from(TAG_TYPES).join(', ')}` }, { status: 400 })
      patch.tag_type = v
    }
    if (body.parent_tag_id !== undefined) {
      if (body.parent_tag_id === null || body.parent_tag_id === '') patch.parent_tag_id = null
      else {
        const pid = Number(body.parent_tag_id)
        if (Number.isNaN(pid)) return NextResponse.json({ error: 'parent_tag_id must be numeric id or null' }, { status: 400 })
        if (pid === Number(docId)) return NextResponse.json({ error: 'parent_tag_id cannot be itself' }, { status: 400 })
        // validate exists
        try {
          const parentDoc = (await payload.findByID({ collection: 'prod-tags', id: pid, depth: 0, overrideAccess: true })) as any
          if (!parentDoc) return NextResponse.json({ error: 'parent_tag_id does not exist' }, { status: 400 })
        } catch {
          return NextResponse.json({ error: 'parent_tag_id does not exist' }, { status: 400 })
        }
        // circular check: walk up chain from pid, ensure not reaching docId
        try {
          let cur: number | null = pid
          const seen = new Set<string>()
          for (let depth = 0; depth < 20 && cur !== null; depth++) {
            if (String(cur) === String(docId)) return NextResponse.json({ error: 'Circular parent_tag_id detected' }, { status: 400 })
            if (seen.has(String(cur))) break
            seen.add(String(cur))
            const curDoc = (await payload.findByID({ collection: 'prod-tags', id: cur, depth: 0, overrideAccess: true })) as any
            const p = curDoc?.parent_tag_id
            if (!p) break
            cur = typeof p === 'object' ? Number((p as any).id ?? p) : Number(p)
            if (Number.isNaN(cur)) break
          }
        } catch {}
        patch.parent_tag_id = pid
      }
    }
    if (body.is_active !== undefined) {
      if (typeof body.is_active === 'boolean') patch.is_active = body.is_active
      else {
        const v = String(body.is_active).toLowerCase()
        if (v === 'true') patch.is_active = true
        else if (v === 'false') patch.is_active = false
        else return NextResponse.json({ error: 'is_active must be boolean' }, { status: 400 })
      }
    }
    if (body.is_featured !== undefined) {
      if (typeof body.is_featured === 'boolean') patch.is_featured = body.is_featured
      else {
        const v = String(body.is_featured).toLowerCase()
        if (v === 'true') patch.is_featured = true
        else if (v === 'false') patch.is_featured = false
        else return NextResponse.json({ error: 'is_featured must be boolean' }, { status: 400 })
      }
    }
    // usage_count is readOnly — ignore

    if (Object.keys(patch).length === 0) return NextResponse.json({ error: 'Nothing to update' }, { status: 400 })

    let updated: Record<string, any>
    try {
      updated = (await payload.update({ collection: 'prod-tags', id: docId as number, data: patch as any, depth: 1, overrideAccess: true })) as unknown as Record<string, any>
    } catch (e: any) {
      const msg = e?.message || 'Failed to update tag'
      const lower = String(msg).toLowerCase()
      if (lower.includes('unique') || lower.includes('duplicate')) return NextResponse.json({ error: 'Duplicate slug: already exists', details: msg }, { status: 409 })
      return NextResponse.json({ error: msg, details: e?.data || e?.errors }, { status: 400 })
    }
    const sanitized = sanitizeDoc(updated, 0, 0)
    // Bust list cache so the update reflects immediately on /catalog/tags
    await deleteCachedByPrefix('admin:catalog-tags:')
    return NextResponse.json({ success: true, message: 'Tag updated successfully', doc: sanitized })
  } catch (err: any) {
    console.error('[admin/catalog/tags/[id]] PATCH error:', err)
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

    // productCount via prod-tags-junction where tag_id = id
    let productCount = 0
    let groupCount = 0
    let childCount = 0
    try {
      const [jRes, mRes, childRes] = await Promise.all([
        payload.find({ collection: 'prod-tags-junction', where: { tag_id: { equals: docId as number } }, limit: 1, depth: 0, overrideAccess: true }),
        payload.find({ collection: 'tag-group-memberships', where: { tag_id: { equals: docId as number } }, limit: 1, depth: 0, overrideAccess: true }),
        payload.find({ collection: 'prod-tags', where: { parent_tag_id: { equals: docId as number } }, limit: 1, depth: 0, overrideAccess: true }),
      ])
      productCount = (jRes as any).totalDocs ?? (jRes as any).docs?.length ?? 0
      groupCount = (mRes as any).totalDocs ?? (mRes as any).docs?.length ?? 0
      childCount = (childRes as any).totalDocs ?? (childRes as any).docs?.length ?? 0
      // fallback scans
      if (productCount === 0) {
        const allJ = await payload.find({ collection: 'prod-tags-junction', limit: 2000, depth: 0, overrideAccess: true, pagination: false } as any)
        productCount = ((allJ as any).docs as any[]).filter((j: any) => {
          const tid = j.tag_id
          const cid = typeof tid === 'object' ? String((tid as any).id ?? tid) : String(tid)
          return cid === String(docId)
        }).length
      }
      if (groupCount === 0) {
        const allM = await payload.find({ collection: 'tag-group-memberships', limit: 2000, depth: 0, overrideAccess: true, pagination: false } as any)
        groupCount = ((allM as any).docs as any[]).filter((m: any) => {
          const tid = m.tag_id
          const cid = typeof tid === 'object' ? String((tid as any).id ?? tid) : String(tid)
          return cid === String(docId)
        }).length
      }
      if (childCount === 0) {
        const allT = await payload.find({ collection: 'prod-tags', limit: 2000, depth: 0, overrideAccess: true, pagination: false } as any)
        childCount = ((allT as any).docs as any[]).filter((t: any) => {
          const p = t.parent_tag_id
          const cid = typeof p === 'object' ? String((p as any).id ?? p) : String(p)
          return cid === String(docId)
        }).length
      }
    } catch {}

    if (productCount > 0) return NextResponse.json({ error: `Tag is in use by ${productCount} product(s) via prod-tags-junction`, code: 'IN_USE' }, { status: 409 })
    if (groupCount > 0) return NextResponse.json({ error: `Tag is in use by ${groupCount} group(s) via tag-group-memberships`, code: 'IN_USE' }, { status: 409 })
    if (childCount > 0) return NextResponse.json({ error: `Tag has ${childCount} child tag(s). Delete or reassign them first.`, code: 'HAS_CHILDREN' }, { status: 409 })

    let deleted: any
    try {
      deleted = await payload.delete({ collection: 'prod-tags', id: docId as number, overrideAccess: true })
    } catch (e: any) {
      return NextResponse.json({ error: e?.message || 'Failed to delete tag' }, { status: 400 })
    }
    if (!deleted) return NextResponse.json({ error: 'Tag not found' }, { status: 404 })
    // Bust list cache so the deletion reflects immediately on /catalog/tags
    await deleteCachedByPrefix('admin:catalog-tags:')
    return NextResponse.json({ success: true, id: deleted.id, message: 'Tag deleted successfully' })
  } catch (err: any) {
    console.error('[admin/catalog/tags/[id]] DELETE error:', err)
    return NextResponse.json({ error: err?.message || 'Delete failed' }, { status: 500 })
  }
}
