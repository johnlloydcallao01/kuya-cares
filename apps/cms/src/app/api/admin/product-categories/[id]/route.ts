/**
 * @file apps/cms/src/app/api/admin/product-categories/[id]/route.ts
 * @description BFF for single product category (detail, update, delete) - admin-only safe boundary.
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
function sanitizeParent(v: unknown): { id: number; name: string; slug: string; categoryPath: string | null } | null {
  if (!v || typeof v !== 'object') return null
  const s = v as Record<string, unknown>
  const id = Number(s.id); if (Number.isNaN(id)) return null
  return { id, name: String(s.name || ''), slug: String(s.slug || ''), categoryPath: (s.categoryPath as string) || null }
}
function sanitizeDoc(raw: Record<string, any>, productCount: number): Record<string, any> {
  return {
    id: raw.id,
    name: String(raw.name || ''),
    slug: String(raw.slug || ''),
    description: raw.description ? String(raw.description) : null,
    parentCategory: sanitizeParent(raw.parentCategory),
    categoryLevel: typeof raw.categoryLevel === 'number' ? raw.categoryLevel : null,
    categoryPath: raw.categoryPath ? String(raw.categoryPath) : null,
    displayOrder: typeof raw.displayOrder === 'number' ? raw.displayOrder : 0,
    isActive: typeof raw.isActive === 'boolean' ? raw.isActive : true,
    isFeatured: typeof raw.isFeatured === 'boolean' ? raw.isFeatured : false,
    media: {
      icon: sanitizeMediaRef(raw.media?.icon),
      bannerImage: sanitizeMediaRef(raw.media?.bannerImage),
      thumbnailImage: sanitizeMediaRef(raw.media?.thumbnailImage),
    },
    attributes: {
      categoryType: raw.attributes?.categoryType ? String(raw.attributes.categoryType) : null,
      dietaryTags: Array.isArray(raw.attributes?.dietaryTags) ? raw.attributes.dietaryTags : raw.attributes?.dietaryTags ?? null,
      ageRestriction: raw.attributes?.ageRestriction ? String(raw.attributes.ageRestriction) : 'none',
      requiresPrescription: typeof raw.attributes?.requiresPrescription === 'boolean' ? raw.attributes.requiresPrescription : false,
    },
    seo: {
      metaTitle: raw.seo?.metaTitle ? String(raw.seo.metaTitle) : null,
      metaDescription: raw.seo?.metaDescription ? String(raw.seo.metaDescription) : null,
      keywords: Array.isArray(raw.seo?.keywords) ? raw.seo.keywords : raw.seo?.keywords ?? null,
      canonicalUrl: raw.seo?.canonicalUrl ? String(raw.seo.canonicalUrl) : null,
    },
    productCount,
    createdAt: String(raw.createdAt || ''),
    updatedAt: String(raw.updatedAt || ''),
  }
}

const CATEGORY_TYPES = new Set(['food', 'beverages', 'desserts', 'snacks', 'groceries', 'pharmacy', 'personal_care', 'household', 'other'])
const AGE_RESTRICTIONS = new Set(['none', '18_plus', '21_plus'])

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const payload = await getPayload({ config: configPromise })
    const admin = await authenticateAdmin(payload, request)
    if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const numericId = Number(id)
    const docId: number | string = Number.isFinite(numericId) ? numericId : id
    let doc: Record<string, any>
    try { doc = await payload.findByID({ collection: 'product-categories', id: docId as number, depth: 1, overrideAccess: true }) as unknown as Record<string, any> } catch (e: any) { return NextResponse.json({ error: 'Product category not found', details: e?.message }, { status: 404 }) }
    if (!doc) return NextResponse.json({ error: 'Product category not found' }, { status: 404 })

    // product count for this category
    let productCount = 0
    try {
      const prodRes = await payload.find({ collection: 'products', where: { categories: { contains: doc.id } }, limit: 0, depth: 0, overrideAccess: true, pagination: false } as any)
      productCount = (prodRes as any).totalDocs ?? (prodRes as any).docs?.length ?? 0
      if (productCount === 0) {
        // fallback via products_rels scan if contains not supported
        const allProds = await payload.find({ collection: 'products', limit: 5000, depth: 0, overrideAccess: true, pagination: false } as any)
        let cnt = 0
        for (const p of ((allProds as any).docs as any[]) || []) {
          const cats: any[] = Array.isArray((p as any).categories) ? (p as any).categories : []
          for (const c of cats) {
            const cid = typeof c === 'object' ? String((c as any).id) : String(c)
            if (cid === String(doc.id)) { cnt++; break }
          }
        }
        productCount = cnt
      }
    } catch {}
    const sanitized = sanitizeDoc(doc, productCount)
    return NextResponse.json({ doc: sanitized })
  } catch (err: any) {
    console.error('[admin/product-categories/[id]] GET error:', err)
    return NextResponse.json({ error: err?.message || 'Failed to load product category' }, { status: 500 })
  }
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
      const raw = body.slug.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
      if (!raw) return NextResponse.json({ error: 'slug cannot be empty' }, { status: 400 }); patch.slug = raw
    } else if (body.slug !== undefined && body.slug !== null && body.slug !== '') {
      return NextResponse.json({ error: 'slug must be a string' }, { status: 400 })
    }
    if (typeof body.description === 'string' || body.description === null) {
      if (body.description !== undefined) patch.description = typeof body.description === 'string' ? body.description.trim() || null : null
    }
    if (body.displayOrder !== undefined) {
      const n = Number(body.displayOrder); if (Number.isNaN(n)) return NextResponse.json({ error: 'displayOrder must be numeric' }, { status: 400 }); patch.displayOrder = n
    }
    if (typeof body.isActive === 'boolean') patch.isActive = body.isActive
    else if (body.isActive !== undefined) {
      const v = String(body.isActive).toLowerCase(); if (v === 'true') patch.isActive = true; else if (v === 'false') patch.isActive = false; else return NextResponse.json({ error: 'isActive must be boolean' }, { status: 400 })
    }
    if (typeof body.isFeatured === 'boolean') patch.isFeatured = body.isFeatured
    else if (body.isFeatured !== undefined) {
      const v = String(body.isFeatured).toLowerCase(); if (v === 'true') patch.isFeatured = true; else if (v === 'false') patch.isFeatured = false; else return NextResponse.json({ error: 'isFeatured must be boolean' }, { status: 400 })
    }
    if (body.parentCategory !== undefined) {
      if (body.parentCategory === null || body.parentCategory === '') patch.parentCategory = null
      else {
        const pid = Number(body.parentCategory); if (Number.isNaN(pid)) return NextResponse.json({ error: 'parentCategory must be numeric id or null' }, { status: 400 })
        if (pid === Number(docId)) return NextResponse.json({ error: 'parentCategory cannot be itself' }, { status: 400 })
        // validate exists
        try { const parentDoc = await payload.findByID({ collection: 'product-categories', id: pid, depth: 0, overrideAccess: true }) as any; if (!parentDoc) return NextResponse.json({ error: 'parentCategory does not exist' }, { status: 400 }) } catch { return NextResponse.json({ error: 'parentCategory does not exist' }, { status: 400 }) }
        patch.parentCategory = pid
      }
    }
    // media
    if (body.media !== undefined || body.icon !== undefined || body.bannerImage !== undefined || body.thumbnailImage !== undefined) {
      const src = (body.media && typeof body.media === 'object' ? body.media : {}) as Record<string, any>
      const mediaPatch: Record<string, any> = {}
      const iconRaw = src.icon ?? body.icon
      if (iconRaw !== undefined) {
        if (iconRaw === null || iconRaw === '') mediaPatch.icon = null
        else { const n = Number(iconRaw); if (Number.isNaN(n)) return NextResponse.json({ error: 'media.icon must be media id' }, { status: 400 }); mediaPatch.icon = n }
      }
      const bannerRaw = src.bannerImage ?? body.bannerImage
      if (bannerRaw !== undefined) {
        if (bannerRaw === null || bannerRaw === '') mediaPatch.bannerImage = null
        else { const n = Number(bannerRaw); if (Number.isNaN(n)) return NextResponse.json({ error: 'media.bannerImage must be media id' }, { status: 400 }); mediaPatch.bannerImage = n }
      }
      const thumbRaw = src.thumbnailImage ?? body.thumbnailImage
      if (thumbRaw !== undefined) {
        if (thumbRaw === null || thumbRaw === '') mediaPatch.thumbnailImage = null
        else { const n = Number(thumbRaw); if (Number.isNaN(n)) return NextResponse.json({ error: 'media.thumbnailImage must be media id' }, { status: 400 }); mediaPatch.thumbnailImage = n }
      }
      if (Object.keys(mediaPatch).length) patch.media = mediaPatch
    }
    // attributes
    if (body.attributes !== undefined || body.categoryType !== undefined || body.dietaryTags !== undefined || body.ageRestriction !== undefined || body.requiresPrescription !== undefined) {
      const src = (body.attributes && typeof body.attributes === 'object' ? body.attributes : {}) as Record<string, any>
      const attrPatch: Record<string, any> = {}
      const ctRaw = src.categoryType ?? body.categoryType
      if (ctRaw !== undefined) {
        if (ctRaw === null || ctRaw === '') attrPatch.categoryType = null
        else {
          const v = String(ctRaw).trim().toLowerCase()
          if (!CATEGORY_TYPES.has(v)) return NextResponse.json({ error: `attributes.categoryType must be one of ${Array.from(CATEGORY_TYPES).join(', ')}` }, { status: 400 })
          attrPatch.categoryType = v
        }
      }
      const dtRaw = src.dietaryTags ?? body.dietaryTags
      if (dtRaw !== undefined) {
        if (dtRaw === null || dtRaw === '') attrPatch.dietaryTags = null
        else if (Array.isArray(dtRaw)) { const arr = dtRaw.map((s: any) => String(s).trim()).filter(Boolean); attrPatch.dietaryTags = arr.length ? arr : null }
        else if (typeof dtRaw === 'string') { const arr = dtRaw.split(',').map((s: string) => s.trim()).filter(Boolean); attrPatch.dietaryTags = arr.length ? arr : null }
        else return NextResponse.json({ error: 'attributes.dietaryTags must be array or comma-separated string' }, { status: 400 })
      }
      const ageRaw = src.ageRestriction ?? body.ageRestriction
      if (ageRaw !== undefined) {
        if (ageRaw === null || ageRaw === '') attrPatch.ageRestriction = 'none'
        else {
          const v = String(ageRaw).trim().toLowerCase()
          if (!AGE_RESTRICTIONS.has(v)) return NextResponse.json({ error: `attributes.ageRestriction must be one of ${Array.from(AGE_RESTRICTIONS).join(', ')}` }, { status: 400 })
          attrPatch.ageRestriction = v
        }
      }
      const rpRaw = src.requiresPrescription ?? body.requiresPrescription
      if (rpRaw !== undefined) {
        if (typeof rpRaw === 'boolean') attrPatch.requiresPrescription = rpRaw
        else if (typeof rpRaw === 'string') {
          const t = rpRaw.trim().toLowerCase()
          if (t === 'true') attrPatch.requiresPrescription = true
          else if (t === 'false') attrPatch.requiresPrescription = false
          else return NextResponse.json({ error: 'attributes.requiresPrescription must be boolean' }, { status: 400 })
        } else return NextResponse.json({ error: 'attributes.requiresPrescription must be boolean' }, { status: 400 })
      }
      if (Object.keys(attrPatch).length) patch.attributes = attrPatch
    }
    // seo
    if (body.seo !== undefined || body.metaTitle !== undefined || body.metaDescription !== undefined || body.keywords !== undefined || body.canonicalUrl !== undefined) {
      const src = (body.seo && typeof body.seo === 'object' ? body.seo : {}) as Record<string, any>
      const seoPatch: Record<string, any> = {}
      const mtRaw = src.metaTitle ?? body.metaTitle
      if (mtRaw !== undefined) seoPatch.metaTitle = typeof mtRaw === 'string' ? mtRaw.trim() || null : null
      const mdRaw = src.metaDescription ?? body.metaDescription
      if (mdRaw !== undefined) seoPatch.metaDescription = typeof mdRaw === 'string' ? mdRaw.trim() || null : null
      const kwRaw = src.keywords ?? body.keywords
      if (kwRaw !== undefined) {
        if (kwRaw === null || kwRaw === '') seoPatch.keywords = null
        else if (Array.isArray(kwRaw)) { const arr = kwRaw.map((s: any) => String(s).trim()).filter(Boolean); seoPatch.keywords = arr.length ? arr : null }
        else if (typeof kwRaw === 'string') { const arr = kwRaw.split(',').map((s: string) => s.trim()).filter(Boolean); seoPatch.keywords = arr.length ? arr : null }
        else return NextResponse.json({ error: 'seo.keywords must be array or comma-separated string' }, { status: 400 })
      }
      const canonRaw = src.canonicalUrl ?? body.canonicalUrl
      if (canonRaw !== undefined) {
        if (canonRaw === null || String(canonRaw).trim() === '') seoPatch.canonicalUrl = null
        else { const v = String(canonRaw).trim(); try { new URL(v); seoPatch.canonicalUrl = v } catch { return NextResponse.json({ error: 'seo.canonicalUrl must be valid URL' }, { status: 400 }) } }
      }
      if (Object.keys(seoPatch).length) patch.seo = seoPatch
    }

    if (Object.keys(patch).length === 0) return NextResponse.json({ error: 'Nothing to update' }, { status: 400 })

    let updated: Record<string, any>
    try {
      updated = await payload.update({ collection: 'product-categories', id: docId as number, data: patch as any, depth: 1, overrideAccess: true }) as unknown as Record<string, any>
    } catch (e: any) {
      const msg = e?.message || 'Failed to update product category'
      const lower = String(msg).toLowerCase()
      if (lower.includes('unique') || lower.includes('duplicate')) return NextResponse.json({ error: 'Duplicate slug: already exists', details: msg }, { status: 409 })
      return NextResponse.json({ error: msg, details: e?.data || e?.errors }, { status: 400 })
    }
    const sanitized = sanitizeDoc(updated, 0)
    // Bust list cache so the update reflects immediately on /product-categories
    await deleteCachedByPrefix('admin:product-categories:')
    return NextResponse.json({ success: true, message: 'Product category updated successfully', doc: sanitized })
  } catch (err: any) {
    console.error('[admin/product-categories/[id]] PATCH error:', err)
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

    // Check productCount
    let productCount = 0
    try {
      const prodRes = await payload.find({ collection: 'products', where: { categories: { contains: docId as number } }, limit: 1, depth: 0, overrideAccess: true, pagination: false } as any)
      productCount = (prodRes as any).totalDocs ?? (prodRes as any).docs?.length ?? 0
      if (productCount === 0) {
        const allProds = await payload.find({ collection: 'products', limit: 5000, depth: 0, overrideAccess: true, pagination: false } as any)
        for (const p of ((allProds as any).docs as any[]) || []) {
          const cats: any[] = Array.isArray((p as any).categories) ? (p as any).categories : []
          for (const c of cats) {
            const cid = typeof c === 'object' ? String((c as any).id) : String(c)
            if (cid === String(docId)) { productCount = 1; break }
          }
          if (productCount) break
        }
      }
    } catch {}

    let childCount = 0
    try {
      const childRes = await payload.find({ collection: 'product-categories', where: { parentCategory: { equals: docId as number } }, limit: 1, depth: 0, overrideAccess: true })
      childCount = (childRes as any).totalDocs ?? (childRes as any).docs?.length ?? 0
    } catch {}

    if (productCount > 0) return NextResponse.json({ error: `Category is in use by ${productCount} product(s). Reassign products first.`, code: 'IN_USE' }, { status: 409 })
    if (childCount > 0) return NextResponse.json({ error: `Category has ${childCount} child category(ies). Delete or reassign them first.`, code: 'HAS_CHILDREN' }, { status: 409 })

    let deleted: any
    try { deleted = await payload.delete({ collection: 'product-categories', id: docId as number, overrideAccess: true }) } catch (e: any) { return NextResponse.json({ error: e?.message || 'Failed to delete product category' }, { status: 400 }) }
    if (!deleted) return NextResponse.json({ error: 'Product category not found' }, { status: 404 })
    // Bust list cache so the deletion reflects immediately on /product-categories
    await deleteCachedByPrefix('admin:product-categories:')
    return NextResponse.json({ success: true, id: deleted.id, message: 'Product category deleted successfully' })
  } catch (err: any) {
    console.error('[admin/product-categories/[id]] DELETE error:', err)
    return NextResponse.json({ error: err?.message || 'Delete failed' }, { status: 500 })
  }
}
