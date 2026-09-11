/**
 * @file apps/cms/src/app/api/admin/vendors/[id]/route.ts
 * @description BFF for single vendor (detail, update, delete) - admin-only safe boundary.
 */

import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import configPromise from '@payload-config'
import { authenticateAdmin } from '@/utils/mediaLibrary'
import { validateStoreHoursFields } from '@/utils/storeHours'
import { deleteCachedByPrefix } from '@encreasl/cache'

function optionalString(v: unknown): string | null { return typeof v === 'string' ? v.trim() || null : null }
function str(v: unknown, fb=''): string { return typeof v === 'string' ? v : fb }
function num(v: unknown, fb=0): number { if (typeof v === 'number' && Number.isFinite(v)) return v; if (typeof v === 'string'){const n=Number(v); return Number.isFinite(n)?n:fb} return fb }
function sanitizeMediaRef(value: unknown): { id: number; url: string | null; filename: string | null } | null {
  if (!value || typeof value !== 'object') return null
  const src = value as Record<string, unknown>
  const id = Number(src.id); if (Number.isNaN(id)) return null
  const url = typeof src.cloudinaryURL === 'string' ? src.cloudinaryURL : (typeof src.url==='string'?src.url:null)
  return { id, url, filename: typeof src.filename==='string'?src.filename:null }
}
function sanitizeUserBrief(value: unknown): any {
  if (!value || typeof value !== 'object') return null
  const u = value as Record<string, any>; const id=Number(u.id); if(Number.isNaN(id)) return null
  return { id, email: str(u.email,''), firstName: str(u.firstName,''), lastName: str(u.lastName,''), role: str(u.role,'vendor'), isActive: typeof u.isActive==='boolean'?u.isActive:null, phone: optionalString(u.phone) }
}
function sanitizeVendorDoc(raw: Record<string, any>, merchantCount: number, merchantsPreview: any[]): Record<string, any> {
  return {
    id: raw.id,
    businessName: str(raw.businessName,''),
    legalName: str(raw.legalName,''),
    businessRegistrationNumber: str(raw.businessRegistrationNumber,''),
    taxIdentificationNumber: optionalString(raw.taxIdentificationNumber),
    primaryContactEmail: str(raw.primaryContactEmail,''),
    primaryContactPhone: str(raw.primaryContactPhone,''),
    websiteUrl: optionalString(raw.websiteUrl),
    businessType: str(raw.businessType,'other'),
    cuisineTypes: raw.cuisineTypes ?? null,
    isActive: typeof raw.isActive==='boolean'?raw.isActive:true,
    verificationStatus: str(raw.verificationStatus,'pending'),
    onboardingDate: raw.onboardingDate?String(raw.onboardingDate):null,
    averageRating: num(raw.averageRating,0),
    totalReviews: num(raw.totalReviews,0),
    totalOrders: num(raw.totalOrders,0),
    totalMerchants: merchantCount,
    storedTotalMerchants: num(raw.totalMerchants,0),
    description: optionalString(raw.description),
    operatingHours: raw.operatingHours ?? null,
    socialMediaLinks: raw.socialMediaLinks ?? null,
    logo: sanitizeMediaRef(raw.logo),
    businessLicense: sanitizeMediaRef(raw.businessLicense),
    taxCertificate: sanitizeMediaRef(raw.taxCertificate),
    owner: sanitizeUserBrief(raw.user),
    createdAt: String(raw.createdAt ?? ''),
    updatedAt: String(raw.updatedAt ?? ''),
    merchantsPreview,
  }
}

const BUSINESS_TYPES = new Set(['restaurant','fast_food','grocery','pharmacy','convenience','bakery','coffee_shop','other'])
const VERIFICATION_STATUSES = new Set(['pending','verified','rejected','suspended'])

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const payload = await getPayload({ config: configPromise })
    const admin = await authenticateAdmin(payload, request)
    if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const numericId = Number(id)
    const docId: number | string = Number.isFinite(numericId) ? numericId : id
    let doc: Record<string, any>
    try { doc = await payload.findByID({ collection: 'vendors', id: docId as number, depth: 2, overrideAccess: true }) as unknown as Record<string, any> } catch (e:any) { return NextResponse.json({ error: 'Vendor not found', details: e?.message }, { status: 404 }) }
    if (!doc) return NextResponse.json({ error: 'Vendor not found' }, { status: 404 })

    // merchant aggregation for this vendor
    const [merchantsRes, ordersRes] = await Promise.all([
      payload.find({ collection: 'merchants', where: { vendor: { equals: doc.id } }, limit: 50, sort: '-createdAt', depth: 0, overrideAccess: true }),
      payload.find({ collection: 'orders', limit: 0, depth: 0, overrideAccess: true, pagination: false } as any).catch(()=>({ docs: [] } as any)),
    ])

    const merchantsPreview = (merchantsRes.docs as any[]).map((m) => ({
      id: m.id,
      outletName: String(m.outletName ?? `Outlet #${m.id}`),
      outletCode: String(m.outletCode ?? ''),
      isActive: !!m.isActive,
      isAcceptingOrders: !!m.isAcceptingOrders,
      operationalStatus: String(m.operationalStatus ?? 'closed'),
      averageRating: num((m as any).averageRating, 0),
      createdAt: String(m.createdAt ?? ''),
    }))
    const merchantCount = typeof merchantsRes.totalDocs === 'number' ? merchantsRes.totalDocs : merchantsPreview.length

    const sanitized = sanitizeVendorDoc(doc, merchantCount, merchantsPreview)
    return NextResponse.json({ doc: sanitized })
  } catch (err:any) { console.error('[admin/vendors/[id]] GET error:', err); return NextResponse.json({ error: err?.message||'Failed to load vendor' }, { status: 500 }) }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const payload = await getPayload({ config: configPromise })
    const admin = await authenticateAdmin(payload, request)
    if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    let body: Record<string, any>
    try { body = await request.json() } catch { return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 }) }
    try { Object.assign(body, validateStoreHoursFields(body)) } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : 'Invalid store hours' }, { status: 400 }) }

    const numericId = Number(id)
    const docId: number | string = Number.isFinite(numericId) ? numericId : id

    // Whitelist updatable fields enterprise-grade
    const patch: Record<string, any> = {}
    if (typeof body.businessName === 'string') {
      const v = body.businessName.trim(); if (!v || v.length<2) return NextResponse.json({ error: 'businessName must be at least 2 characters' }, { status: 400 }); patch.businessName = v
    }
    if (typeof body.legalName === 'string') {
      const v = body.legalName.trim(); if (!v || v.length<2) return NextResponse.json({ error: 'legalName must be at least 2 characters' }, { status: 400 }); patch.legalName = v
    }
    if (typeof body.businessRegistrationNumber === 'string') {
      const v = body.businessRegistrationNumber.trim(); if (!v) return NextResponse.json({ error: 'businessRegistrationNumber cannot be empty' }, { status: 400 }); patch.businessRegistrationNumber = v
    }
    if (body.taxIdentificationNumber !== undefined) {
      patch.taxIdentificationNumber = typeof body.taxIdentificationNumber === 'string' ? (body.taxIdentificationNumber.trim() || null) : null
    }
    if (typeof body.primaryContactEmail === 'string') {
      const v = body.primaryContactEmail.trim().toLowerCase(); if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) return NextResponse.json({ error: 'primaryContactEmail must be valid' }, { status: 400 }); patch.primaryContactEmail = v
    }
    if (typeof body.primaryContactPhone === 'string') {
      const v = body.primaryContactPhone.trim(); if (!v) return NextResponse.json({ error: 'primaryContactPhone cannot be empty' }, { status: 400 }); patch.primaryContactPhone = v
    }
    if (body.websiteUrl !== undefined) {
      if (body.websiteUrl === null || body.websiteUrl === '') patch.websiteUrl = null
      else if (typeof body.websiteUrl === 'string') { const v = body.websiteUrl.trim(); try { new URL(v); patch.websiteUrl = v } catch { return NextResponse.json({ error: 'websiteUrl must be valid URL' }, { status: 400 }) } }
    }
    if (typeof body.businessType === 'string') {
      const v = body.businessType.trim().toLowerCase(); if (!BUSINESS_TYPES.has(v)) return NextResponse.json({ error: `businessType must be one of ${Array.from(BUSINESS_TYPES).join(', ')}` }, { status: 400 }); patch.businessType = v
    }
    if (body.cuisineTypes !== undefined) patch.cuisineTypes = body.cuisineTypes ?? null
    if (typeof body.isActive === 'boolean') patch.isActive = body.isActive
    else if (body.isActive !== undefined) {
      const v = String(body.isActive).toLowerCase(); if (v==='true') patch.isActive=true; else if (v==='false') patch.isActive=false
    }
    if (typeof body.verificationStatus === 'string') {
      const v = body.verificationStatus.trim().toLowerCase(); if (!VERIFICATION_STATUSES.has(v)) return NextResponse.json({ error: `verificationStatus must be one of ${Array.from(VERIFICATION_STATUSES).join(', ')}` }, { status: 400 }); patch.verificationStatus = v
    }
    if (body.description !== undefined) patch.description = typeof body.description === 'string' ? (body.description.trim() || null) : null
    if (body.operatingHours !== undefined) patch.operatingHours = body.operatingHours ?? null
    if (body.socialMediaLinks !== undefined) patch.socialMediaLinks = body.socialMediaLinks ?? null
    if (body.logo !== undefined) patch.logo = body.logo === null || body.logo === '' ? null : Number(body.logo)
    if (body.businessLicense !== undefined) patch.businessLicense = body.businessLicense === null || body.businessLicense === '' ? null : Number(body.businessLicense)
    if (body.taxCertificate !== undefined) patch.taxCertificate = body.taxCertificate === null || body.taxCertificate === '' ? null : Number(body.taxCertificate)
    // business metrics (per Vendors.ts: averageRating 0-5, totals >= 0)
    if (body.averageRating !== undefined) {
      const n = num(body.averageRating, NaN); patch.averageRating = Number.isNaN(n) ? 0 : Math.min(5, Math.max(0, n))
    }
    if (body.totalReviews !== undefined) { const n = num(body.totalReviews, NaN); patch.totalReviews = Number.isNaN(n) ? 0 : Math.max(0, n) }
    if (body.totalOrders !== undefined) { const n = num(body.totalOrders, NaN); patch.totalOrders = Number.isNaN(n) ? 0 : Math.max(0, n) }
    if (body.totalMerchants !== undefined) { const n = num(body.totalMerchants, NaN); patch.totalMerchants = Number.isNaN(n) ? 0 : Math.max(0, n) }
    // onboardingDate (dayAndTime)
    if (body.onboardingDate !== undefined) {
      if (body.onboardingDate === null || body.onboardingDate === '') patch.onboardingDate = new Date().toISOString()
      else { const d = new Date(String(body.onboardingDate)); if (!Number.isNaN(d.getTime())) patch.onboardingDate = d.toISOString() }
    }
    // operatingHours must be object|null
    if (body.operatingHours !== undefined) patch.operatingHours = (body.operatingHours !== null && typeof body.operatingHours === 'object' && !Array.isArray(body.operatingHours)) ? body.operatingHours : null

    if (Object.keys(patch).length===0) return NextResponse.json({ error: 'Nothing to update' }, { status: 400 })

    let updated: Record<string, any>
    try {
      updated = await payload.update({ collection: 'vendors', id: docId as number, data: patch as any, depth: 2, overrideAccess: true }) as unknown as Record<string, any>
    } catch (e:any) {
      const msg = e?.message || 'Failed to update vendor'
      const lower = String(msg).toLowerCase()
      if (lower.includes('unique') || lower.includes('duplicate')) return NextResponse.json({ error: 'Duplicate value violates unique constraint', details: msg }, { status: 409 })
      return NextResponse.json({ error: msg, details: e?.data || e?.errors }, { status: 400 })
    }
    // merchant count refresh
    const merchantsRes = await payload.find({ collection: 'merchants', where: { vendor: { equals: updated.id } }, limit: 0, depth: 0, overrideAccess: true, pagination: false } as any).catch(()=>({ totalDocs: 0, docs: [] } as any))
    const count = typeof (merchantsRes as any).totalDocs === 'number' ? (merchantsRes as any).totalDocs : (merchantsRes as any).docs?.length ?? 0
    const sanitized = sanitizeVendorDoc(updated, count, [])
    // Bust list cache so the update reflects immediately on /vendors
    await deleteCachedByPrefix('admin:vendors:')
    return NextResponse.json({ success: true, message: 'Vendor updated successfully', doc: sanitized })
  } catch (err:any) { console.error('[admin/vendors/[id]] PATCH error:', err); return NextResponse.json({ error: err?.message||'Update failed' }, { status: 500 }) }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const payload = await getPayload({ config: configPromise })
    const admin = await authenticateAdmin(payload, request)
    if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const numericId = Number(id)
    const docId: number | string = Number.isFinite(numericId) ? numericId : id

    // Check merchant dependencies (enterprise safety)
    const { searchParams } = new URL(request.url)
    const force = searchParams.get('force') === 'true'
    let hasMerchants = false
    try {
      const mRes = await payload.find({ collection: 'merchants', where: { vendor: { equals: docId as number } }, limit: 1, depth: 0, overrideAccess: true })
      hasMerchants = (mRes.totalDocs ?? mRes.docs.length) > 0
    } catch {}
    if (hasMerchants && !force) {
      return NextResponse.json({ error: 'Vendor has merchant outlets. Delete or reassign them first, or use force=true to proceed.', code: 'HAS_MERCHANTS' }, { status: 409 })
    }
    if (hasMerchants && force) {
      // optionally delete merchants? For safety we block cascade and tell to handle manually
      // We'll not auto-delete merchants; just warn that force would detach? Here we just proceed to delete vendor after merchants are still there would cause FK? In payload they are independent; vendor relationship not constrained strictly; deleting vendor leaves merchants orphaned but allowed. We'll allow.
    }

    let deleted: any
    try { deleted = await payload.delete({ collection: 'vendors', id: docId as number, overrideAccess: true }) } catch (e:any) { return NextResponse.json({ error: e?.message||'Failed to delete vendor' }, { status: 400 }) }
    if (!deleted) return NextResponse.json({ error: 'Vendor not found' }, { status: 404 })
    // Bust list cache so the deletion reflects immediately on /vendors
    await deleteCachedByPrefix('admin:vendors:')
    return NextResponse.json({ success: true, id: deleted.id, message: 'Vendor deleted successfully' })
  } catch (err:any) { console.error('[admin/vendors/[id]] DELETE error:', err); return NextResponse.json({ error: err?.message||'Delete failed' }, { status: 500 }) }
}
