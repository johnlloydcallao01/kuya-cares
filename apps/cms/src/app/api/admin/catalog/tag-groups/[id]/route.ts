/**
 * @file apps/cms/src/app/api/admin/catalog/tag-groups/[id]/route.ts
 * @description BFF for single tag-group — admin-only.
 */

import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import configPromise from '@payload-config'
import { authenticateAdmin } from '@/utils/mediaLibrary'
import { deleteCachedByPrefix } from '@encreasl/cache'

const HEX_REGEX = /^#([0-9a-fA-F]{6})$/
const SLUG_REGEX = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

function sanitizeDoc(raw: Record<string, any>, tagCount: number): Record<string, any> {
  return {
    id: raw.id,
    name: String(raw.name || ''),
    slug: String(raw.slug || ''),
    description: raw.description ? String(raw.description) : null,
    color: raw.color ? String(raw.color) : null,
    icon: raw.icon ? String(raw.icon) : null,
    is_filterable: typeof raw.is_filterable === 'boolean' ? raw.is_filterable : true,
    is_searchable: typeof raw.is_searchable === 'boolean' ? raw.is_searchable : true,
    display_order: typeof raw.display_order === 'number' ? raw.display_order : 0,
    is_active: typeof raw.is_active === 'boolean' ? raw.is_active : true,
    tagCount,
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
      doc = (await payload.findByID({ collection: 'tag-groups', id: docId as number, depth: 0, overrideAccess: true })) as unknown as Record<string, any>
    } catch (e: any) {
      return NextResponse.json({ error: 'Tag group not found', details: e?.message }, { status: 404 })
    }
    if (!doc) return NextResponse.json({ error: 'Tag group not found' }, { status: 404 })

    let tagCount = 0
    try {
      const mRes = await payload.find({ collection: 'tag-group-memberships', where: { tag_group_id: { equals: doc.id } }, limit: 0, depth: 0, overrideAccess: true, pagination: false } as any)
      tagCount = typeof (mRes as any).totalDocs === 'number' ? (mRes as any).totalDocs : (mRes as any).docs?.length || 0
      if (tagCount === 0) {
        const allM = await payload.find({ collection: 'tag-group-memberships', limit: 2000, depth: 0, overrideAccess: true, pagination: false } as any)
        tagCount = ((allM as any).docs as any[]).filter((m: any) => {
          const gid = m.tag_group_id
          const cid = typeof gid === 'object' ? String((gid as any).id ?? gid) : String(gid)
          return cid === String(doc.id)
        }).length
      }
    } catch {}

    const sanitized = sanitizeDoc(doc, tagCount)
    return NextResponse.json({ doc: sanitized })
  } catch (err: any) {
    console.error('[admin/catalog/tag-groups/[id]] GET error:', err)
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
      const raw = body.slug.trim()
      if (raw === '') {
        // allow clearing to auto? treat as not updating — but spec says slug auto lower hyphen; for PATCH we require explicit; if empty ignore
        // We do not set patch.slug; frontend sends lower hyphen or undefined; so if empty we skip
      } else {
        const v = raw.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
        if (!v) return NextResponse.json({ error: 'slug cannot be empty' }, { status: 400 })
        if (v.length > 100) return NextResponse.json({ error: 'slug must be at most 100 chars' }, { status: 400 })
        if (!SLUG_REGEX.test(v)) return NextResponse.json({ error: 'slug must be lowercase alphanumeric with hyphens' }, { status: 400 })
        patch.slug = v
      }
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
    if (body.icon !== undefined) {
      if (body.icon === null || String(body.icon).trim() === '') patch.icon = null
      else {
        const v = String(body.icon).trim()
        if (v.length > 50) return NextResponse.json({ error: 'icon must be at most 50 chars' }, { status: 400 })
        patch.icon = v
      }
    }
    if (body.is_filterable !== undefined) {
      if (typeof body.is_filterable === 'boolean') patch.is_filterable = body.is_filterable
      else {
        const v = String(body.is_filterable).toLowerCase()
        if (v === 'true') patch.is_filterable = true
        else if (v === 'false') patch.is_filterable = false
        else return NextResponse.json({ error: 'is_filterable must be boolean' }, { status: 400 })
      }
    }
    if (body.is_searchable !== undefined) {
      if (typeof body.is_searchable === 'boolean') patch.is_searchable = body.is_searchable
      else {
        const v = String(body.is_searchable).toLowerCase()
        if (v === 'true') patch.is_searchable = true
        else if (v === 'false') patch.is_searchable = false
        else return NextResponse.json({ error: 'is_searchable must be boolean' }, { status: 400 })
      }
    }
    if (body.display_order !== undefined) {
      const n = Number(body.display_order)
      if (Number.isNaN(n)) return NextResponse.json({ error: 'display_order must be numeric' }, { status: 400 })
      patch.display_order = n
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

    if (Object.keys(patch).length === 0) return NextResponse.json({ error: 'Nothing to update' }, { status: 400 })

    let updated: Record<string, any>
    try {
      updated = (await payload.update({ collection: 'tag-groups', id: docId as number, data: patch as any, depth: 0, overrideAccess: true })) as unknown as Record<string, any>
    } catch (e: any) {
      const msg = e?.message || 'Failed to update tag group'
      const lower = String(msg).toLowerCase()
      if (lower.includes('unique') || lower.includes('duplicate')) return NextResponse.json({ error: 'Duplicate slug: already exists', details: msg }, { status: 409 })
      return NextResponse.json({ error: msg, details: e?.data || e?.errors }, { status: 400 })
    }
    // compute tagCount for response
    let tagCount = 0
    try {
      const mRes = await payload.find({ collection: 'tag-group-memberships', where: { tag_group_id: { equals: (updated as any).id } }, limit: 0, depth: 0, overrideAccess: true, pagination: false } as any)
      tagCount = typeof (mRes as any).totalDocs === 'number' ? (mRes as any).totalDocs : (mRes as any).docs?.length || 0
      if (tagCount === 0) {
        const allM = await payload.find({ collection: 'tag-group-memberships', limit: 2000, depth: 0, overrideAccess: true, pagination: false } as any)
        tagCount = ((allM as any).docs as any[]).filter((m: any) => {
          const gid = m.tag_group_id
          const cid = typeof gid === 'object' ? String((gid as any).id ?? gid) : String(gid)
          return cid === String((updated as any).id)
        }).length
      }
    } catch {}
    const sanitized = sanitizeDoc(updated, tagCount)
    // Bust list cache so the update reflects immediately on /catalog/tag-groups
    await deleteCachedByPrefix('admin:catalog-tag-groups:')
    return NextResponse.json({ success: true, message: 'Tag group updated successfully', doc: sanitized })
  } catch (err: any) {
    console.error('[admin/catalog/tag-groups/[id]] PATCH error:', err)
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

    let tagCount = 0
    try {
      const mRes = await payload.find({ collection: 'tag-group-memberships', where: { tag_group_id: { equals: docId as number } }, limit: 0, depth: 0, overrideAccess: true, pagination: false } as any)
      tagCount = typeof (mRes as any).totalDocs === 'number' ? (mRes as any).totalDocs : (mRes as any).docs?.length || 0
      if (tagCount === 0) {
        const allM = await payload.find({ collection: 'tag-group-memberships', limit: 2000, depth: 0, overrideAccess: true, pagination: false } as any)
        tagCount = ((allM as any).docs as any[]).filter((m: any) => {
          const gid = m.tag_group_id
          const cid = typeof gid === 'object' ? String((gid as any).id ?? gid) : String(gid)
          return cid === String(docId)
        }).length
      }
    } catch {}

    if (tagCount > 0) return NextResponse.json({ error: `Tag group is in use by ${tagCount} membership(s) via tag-group-memberships`, code: 'IN_USE' }, { status: 409 })

    let deleted: any
    try {
      deleted = await payload.delete({ collection: 'tag-groups', id: docId as number, overrideAccess: true })
    } catch (e: any) {
      return NextResponse.json({ error: e?.message || 'Failed to delete tag group' }, { status: 400 })
    }
    if (!deleted) return NextResponse.json({ error: 'Tag group not found' }, { status: 404 })
    // Bust list cache so the deletion reflects immediately on /catalog/tag-groups
    await deleteCachedByPrefix('admin:catalog-tag-groups:')
    return NextResponse.json({ success: true, id: deleted.id, message: 'Tag group deleted successfully' })
  } catch (err: any) {
    console.error('[admin/catalog/tag-groups/[id]] DELETE error:', err)
    return NextResponse.json({ error: err?.message || 'Delete failed' }, { status: 500 })
  }
}
