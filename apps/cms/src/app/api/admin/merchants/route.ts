/**
 * @file apps/cms/src/app/api/admin/merchants/route.ts
 * @description BFF aggregation for web-admin /merchants — enterprise outlet management.
 * Backend owns: vendor join, address/category joins, search/filter, pagination, stats, sanitization with overrideAccess.
 * GET  /api/admin/merchants?page=1&limit=10&search=&isActive=true&operationalStatus=open&vendor=<id> etc
 * POST /api/admin/merchants — create outlet (admin-only)
 */

import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import configPromise from '@payload-config'
import { authenticateAdmin } from '@/utils/mediaLibrary'
import { withAdminRequestSlot } from '@/utils/adminRequestGate'
import { getCached, setCached, deleteCachedByPrefix } from '@encreasl/cache'
import { getStoreHoursStatus, validateStoreHoursFields } from '@/utils/storeHours'

function optionalString(v: unknown): string | null { return typeof v === 'string' ? v.trim() || null : null }
function str(v: unknown, fb = ''): string { return typeof v === 'string' ? v : fb }
function num(v: unknown, fb = 0): number { if (typeof v === 'number' && Number.isFinite(v)) return v; if (typeof v === 'string'){ const n=Number(v); return Number.isFinite(n)?n:fb } return fb }
function parseCsv(s: string | null): string[] { if(!s) return []; return s.split(',').map(x=>x.trim().toLowerCase()).filter(Boolean) }
function badRequest(m: string, d?: unknown){ return NextResponse.json({ error: m, details: d }, { status: 400 }) }

function sanitizeMediaRef(v: unknown): { id:number; url:string|null } | null {
  if(!v || typeof v!=='object') return null
  const s=v as Record<string, unknown>
  const id=Number(s.id); if(Number.isNaN(id)) return null
  const url= typeof s.cloudinaryURL==='string'?s.cloudinaryURL : typeof s.url==='string'?s.url:null
  return { id, url }
}
function sanitizeVendorBrief(v: unknown){
  if(!v || typeof v!=='object') return null
  const o=v as Record<string, any>
  const id=Number(o.id); if(Number.isNaN(id)) return null
  return { id, businessName: str(o.businessName,''), verificationStatus: str(o.verificationStatus,'pending'), businessType: str(o.businessType,'other'), isActive: !!o.isActive, logo: sanitizeMediaRef(o.logo) }
}
function sanitizeMerchantDoc(raw: Record<string, any>): Record<string, any> {
  const vendorVal = raw.vendor
  const vendor = sanitizeVendorBrief(vendorVal)
  const mediaThumb = sanitizeMediaRef((raw.media as any)?.thumbnail)
  const mediaFront = sanitizeMediaRef((raw.media as any)?.storeFrontImage)
  const cats = Array.isArray(raw.merchant_categories) ? raw.merchant_categories.map((c:any)=> typeof c==='object'? { id: Number(c.id), name: str(c.name) } : { id: Number(c), name: String(c) }) : []
  const storeHoursStatus = getStoreHoursStatus(raw)
  const addr = raw.activeAddress && typeof raw.activeAddress==='object' ? { id: Number((raw.activeAddress as any).id), formatted_address: str((raw.activeAddress as any).formatted_address) } : raw.activeAddress ? { id: Number(raw.activeAddress), formatted_address: '' } : null
  return {
    id: raw.id,
    outletName: str(raw.outletName,''),
    outletCode: str(raw.outletCode,''),
    vendor,
    vendorId: vendor?.id ?? (typeof raw.vendor === 'number' || typeof raw.vendor === 'string' ? Number(raw.vendor) : null),
    contactInfo: raw.contactInfo ?? null,
    isActive: typeof raw.isActive==='boolean'?raw.isActive:true,
    isAcceptingOrders: typeof raw.isAcceptingOrders==='boolean'?raw.isAcceptingOrders:true,
    operationalStatus: str(raw.operationalStatus,'open'),
    isOpenNow: storeHoursStatus.isOpen,
    storeHoursStatus,
    nextOpeningAt: storeHoursStatus.nextOpeningAt ?? null,
    operatingHours: raw.operatingHours ?? null,
    deliverySettings: raw.deliverySettings ?? null,
    description: optionalString(raw.description),
    tags: raw.tags ?? null,
    merchant_categories: cats,
    activeAddress: addr,
    merchant_latitude: raw.merchant_latitude ?? null,
    merchant_longitude: raw.merchant_longitude ?? null,
    delivery_radius_meters: raw.delivery_radius_meters ?? raw.deliverySettings?.deliveryFee ?? null,
    timezone: str(raw.timezone,'Asia/Manila'),
    is_currently_delivering: typeof raw.is_currently_delivering==='boolean'?raw.is_currently_delivering:true,
    avg_delivery_time_minutes: raw.avg_delivery_time_minutes ?? null,
    createdAt: String(raw.createdAt ?? ''),
    updatedAt: String(raw.updatedAt ?? ''),
    media: { thumbnail: mediaThumb, storeFrontImage: mediaFront },
  }
}

const OPERATIONAL_STATUSES = new Set(['open','closed','busy','temp_closed','maintenance'])

export async function GET(request: NextRequest) {
  return withAdminRequestSlot(async () => {
    try{
    const payload = await getPayload({ config: configPromise })
    const admin = await authenticateAdmin(payload, request)
    if(!admin) return NextResponse.json({ error: 'Unauthorized: admin authentication required' }, { status: 401 })

    const { searchParams } = new URL(request.url)
    const cacheQuery = Array.from(searchParams.entries())
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
      .join('&') || 'page=1&limit=10&sort=-createdAt'
    const cacheKey = `admin:merchants:${admin.id}:${cacheQuery}`
    const cached = await getCached<Record<string, unknown>>(cacheKey)
    if (cached) return NextResponse.json(cached, { headers: { 'X-Merchants-Cache': 'HIT' } })

    const page = Math.max(1, parseInt(searchParams.get('page')||'1',10)||1)
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit')||'10',10)||10))
    const search = searchParams.get('search')?.trim() || ''
    const sort = searchParams.get('sort') || '-createdAt'
    const isActiveParam = searchParams.get('isActive')
    const isActiveFilter = isActiveParam==='true'?true:isActiveParam==='false'?false:null
    const isAcceptingParam = searchParams.get('isAcceptingOrders')
    const isAcceptingFilter = isAcceptingParam==='true'?true:isAcceptingParam==='false'?false:null
    const operationalCsv = parseCsv(searchParams.get('operationalStatus'))
    const vendorParam = searchParams.get('vendor')
    const vendorIdFilter = vendorParam ? Number(vendorParam) : null
    const verificationCsv = parseCsv(searchParams.get('verificationStatus'))
    const businessTypeCsv = parseCsv(searchParams.get('businessType'))

    // Build where for direct merchant fields
    const where: Record<string, any> = {}
    const and: any[] = []
    if(search){
      and.push({ or: [
        { outletName: { contains: search } },
        { outletCode: { contains: search } },
        { 'contactInfo.email': { contains: search } },
        { 'contactInfo.phone': { contains: search } },
        { 'contactInfo.managerName': { contains: search } },
      ]})
    }
    if(isActiveFilter!==null) where.isActive = { equals: isActiveFilter }
    if(isAcceptingFilter!==null) where.isAcceptingOrders = { equals: isAcceptingFilter }
    if(operationalCsv.length) where.operationalStatus = { in: operationalCsv.filter(v=>OPERATIONAL_STATUSES.has(v)) }
    if(vendorIdFilter && !Number.isNaN(vendorIdFilter)) where.vendor = { equals: vendorIdFilter }

    const finalWhere = and.length ? { and: [...and, where] } : where

    const needsVendorDocuments = Boolean(search || verificationCsv.length || businessTypeCsv.length)
    // The table needs direct relations only. Stats use count queries instead of
    // transferring every merchant and vendor document on every request.
    const [paginated, vendorStats, merchantStats] = await Promise.all([
      payload.find({ collection: 'merchants', where: Object.keys(finalWhere).length?finalWhere:undefined, page, limit, sort, depth: 1, overrideAccess: true }),
      Promise.all([
        payload.find({ collection: 'vendors', limit: 1, depth: 0, overrideAccess: true } as any),
        payload.find({ collection: 'vendors', where: { isActive: { equals: true } }, limit: 1, depth: 0, overrideAccess: true } as any),
        needsVendorDocuments
          ? payload.find({ collection: 'vendors', limit: 2000, depth: 0, overrideAccess: true, pagination: false } as any)
          : Promise.resolve({ docs: [] }),
      ]),
      Promise.all([
        payload.find({ collection: 'merchants', limit: 1, depth: 0, overrideAccess: true } as any),
        payload.find({ collection: 'merchants', where: { isActive: { equals: true } }, limit: 1, depth: 0, overrideAccess: true } as any),
        payload.find({ collection: 'merchants', where: { isAcceptingOrders: { equals: true } }, limit: 1, depth: 0, overrideAccess: true } as any),
        ...Array.from(OPERATIONAL_STATUSES, status => payload.find({ collection: 'merchants', where: { operationalStatus: { equals: status } }, limit: 1, depth: 0, overrideAccess: true } as any)),
      ]),
    ])

    const vendorsDocs = (vendorStats[2].docs as any[]) || []
    const vendorMap = new Map<string, any>()
    vendorsDocs.forEach((v:any)=> vendorMap.set(String(v.id), v))

    // Enrich paginated docs with sanitized vendor + filter by verification/businessType if needed (post-filter if vendor join)
    let docsRaw = paginated.docs as unknown as Record<string, any>[]
    const pageVendorIds = Array.from(new Set(docsRaw.map((merchant) => {
      const rawVendor = merchant.vendor
      return rawVendor && typeof rawVendor === 'object' ? rawVendor.id : rawVendor
    }).filter(Boolean)))
    if (pageVendorIds.length) {
      const pageVendors = await payload.find({
        collection: 'vendors',
        where: { id: { in: pageVendorIds } },
        limit: pageVendorIds.length,
        depth: 1,
        overrideAccess: true,
        pagination: false,
      } as any)
      pageVendors.docs.forEach((vendor: any) => vendorMap.set(String(vendor.id), vendor))
    }
    docsRaw = docsRaw.map((merchant) => {
      const rawVendor = merchant.vendor
      const vendorId = rawVendor && typeof rawVendor === 'object' ? rawVendor.id : rawVendor
      const vendor = vendorMap.get(String(vendorId))
      return vendor ? { ...merchant, vendor } : merchant
    })
    // Post-filter for vendor verification/businessType because where on relationship not directly filterable via simple where
    if(verificationCsv.length || businessTypeCsv.length){
      docsRaw = docsRaw.filter((m)=>{
        const rawVendor = (m as any).vendor
        const vendorObj = rawVendor && typeof rawVendor==='object' ? rawVendor as Record<string, unknown> : null
        const vendorId = vendorObj ? String((vendorObj as any).id ?? '') : String(rawVendor ?? '')
        const vendorDoc = vendorId ? vendorMap.get(vendorId) : null
        if(!vendorDoc) return false
        if(verificationCsv.length && !verificationCsv.includes(String(vendorDoc.verificationStatus||'').toLowerCase())) return false
        if(businessTypeCsv.length && !businessTypeCsv.includes(String(vendorDoc.businessType||'').toLowerCase())) return false
        return true
      })
    }
    // If search should also match vendor businessName, include those (already filtered partly, but ensure)
    if(search && (verificationCsv.length || businessTypeCsv.length)){
      // already handled
    } else if(search){
      // also include vendor businessName match (not covered by direct where)
      const vendorMatchedIds = new Set<string>()
      vendorsDocs.forEach((v:any)=>{
        const hay = `${v.businessName||''} ${v.legalName||''}`.toLowerCase()
        if(hay.includes(search.toLowerCase())) vendorMatchedIds.add(String(v.id))
      })
      if(vendorMatchedIds.size){
        const extra = docsRaw // already have direct matches, now also add vendor-matched that were not in direct where
        // We already have paginated docs limited, so to include vendor-matched we need to fetch those merchant docs separately if not in current page
        // For simplicity, if search matches vendor, and current page doesn't contain those merchants, we will keep current docs but also note that totalDocs may be off
        // For enterprise, better to do full scan for search vendor match and merge
        // We'll fetch all merchants matching vendor ids and search, then re-paginate in memory for accuracy when search matches vendor
        // To keep simple and correct, do in-memory pagination after filtering
        const allDocsForSearch = (await payload.find({ collection: 'merchants', where: Object.keys(where).length?where:undefined, limit: 5000, depth: 2, overrideAccess: true, pagination: false } as any)).docs as unknown as Record<string, any>[]
        let filteredAll = allDocsForSearch.filter((m)=>{
          const rawVendor = (m as any).vendor
          const vendorObj = rawVendor && typeof rawVendor==='object' ? rawVendor as Record<string, unknown> : null
          const vendorId = vendorObj ? String((vendorObj as any).id ?? '') : String(rawVendor ?? '')
          const vendorDoc = vendorId ? vendorMap.get(vendorId) : null
          const directMatch = String(m.outletName||'').toLowerCase().includes(search.toLowerCase()) || String(m.outletCode||'').toLowerCase().includes(search.toLowerCase())
          const vendorMatch = vendorDoc ? `${vendorDoc.businessName||''} ${vendorDoc.legalName||''}`.toLowerCase().includes(search.toLowerCase()) : false
          return directMatch || vendorMatch
        })
        // Apply verification/businessType post-filter again
        if(verificationCsv.length || businessTypeCsv.length){
          filteredAll = filteredAll.filter((m)=>{
            const rawVendor = (m as any).vendor
            const vendorObj = rawVendor && typeof rawVendor==='object' ? rawVendor as Record<string, unknown> : null
            const vendorId = vendorObj ? String((vendorObj as any).id ?? '') : String(rawVendor ?? '')
            const vendorDoc = vendorId ? vendorMap.get(vendorId) : null
            if(!vendorDoc) return false
            if(verificationCsv.length && !verificationCsv.includes(String(vendorDoc.verificationStatus||'').toLowerCase())) return false
            if(businessTypeCsv.length && !businessTypeCsv.includes(String(vendorDoc.businessType||'').toLowerCase())) return false
            return true
          })
        }
        // Re-sort and paginate
        // sort handling simplified: -createdAt
        filteredAll.sort((a:any,b:any)=> String(b.createdAt||'').localeCompare(String(a.createdAt||'')))
        const start = (page-1)*limit
        docsRaw = filteredAll.slice(start, start+limit)
        // Override pagination totalDocs to reflect filtered total
        ;(paginated as any).totalDocs = filteredAll.length
        ;(paginated as any).totalPages = Math.ceil(filteredAll.length/limit)
        ;(paginated as any).hasNextPage = page < (paginated as any).totalPages
        ;(paginated as any).hasPrevPage = page > 1
      }
    }

    const docs = docsRaw.map(sanitizeMerchantDoc)

    // Stats are exact totals from count queries, not capped document arrays.
    const totalMerchants = merchantStats[0].totalDocs || 0
    const activeCount = merchantStats[1].totalDocs || 0
    const acceptingCount = merchantStats[2].totalDocs || 0
    const operationalBreakdown: Record<string, number> = {}
    Array.from(OPERATIONAL_STATUSES).forEach((status, index) => {
      operationalBreakdown[status] = merchantStats[index + 3].totalDocs || 0
    })
    const totalVendors = vendorStats[0].totalDocs || 0
    const activeVendors = vendorStats[1].totalDocs || 0

    const response = {
      docs,
      pagination: {
        page: (paginated as any).page || page,
        limit: (paginated as any).limit || limit,
        totalDocs: (paginated as any).totalDocs ?? docs.length,
        totalPages: (paginated as any).totalPages ?? 1,
        hasNextPage: (paginated as any).hasNextPage ?? false,
        hasPrevPage: (paginated as any).hasPrevPage ?? false,
      },
      stats: {
        totalMerchants,
        totalVendors,
        activeMerchants: activeCount,
        acceptingOrders: acceptingCount,
        activeVendors,
        operationalBreakdown,
        filteredCount: (paginated as any).totalDocs ?? docs.length,
      },
      meta: { generatedAt: new Date().toISOString(), sort, search }
    }
    await setCached(cacheKey, response, 20)
    return NextResponse.json(response, { headers: { 'X-Merchants-Cache': 'MISS' } })
    }catch(err:any){
      console.error('[admin/merchants] GET error:', err)
      return NextResponse.json({ error: err?.message || 'Failed to load merchants' }, { status: 500 })
    }
  })
}

export async function POST(request: NextRequest){
  try{
    const payload = await getPayload({ config: configPromise })
    const admin = await authenticateAdmin(payload, request)
    if(!admin) return NextResponse.json({ error: 'Unauthorized: admin authentication required' }, { status: 401 })
    let body: Record<string, any>
    try{ body = await request.json() } catch { return badRequest('Invalid JSON body') }
    try { Object.assign(body, validateStoreHoursFields(body)) } catch (error) { return badRequest(error instanceof Error ? error.message : 'Invalid store hours') }

    const vendorRaw = body.vendor
    const vendorId = typeof vendorRaw === 'number' ? vendorRaw : typeof vendorRaw === 'string' ? Number(vendorRaw) : Number(body.vendorId)
    if(!vendorId || Number.isNaN(vendorId)) return badRequest('vendor is required (vendor user organization id)')
    // Verify vendor exists
    try{
      await payload.findByID({ collection: 'vendors', id: vendorId, depth: 0, overrideAccess: true }) as any
    }catch{ return badRequest('vendor not found') }

    const outletName = typeof body.outletName === 'string' ? body.outletName.trim() : ''
    if(!outletName || outletName.length<2) return badRequest('outletName is required (min 2 chars)')
    let outletCode = typeof body.outletCode === 'string' ? body.outletCode.trim() : ''
    if(!outletCode){
      const sanitized = outletName.replace(/[^a-zA-Z0-9]/g,'').toUpperCase().slice(0,12) || 'OUTLET'
      outletCode = `${sanitized}-${Date.now().toString().slice(-6)}`
    }
    const timezone = typeof body.timezone === 'string' && body.timezone.trim() ? body.timezone.trim() : 'Asia/Manila'
    try{ Intl.DateTimeFormat(undefined, { timeZone: timezone }) }catch{ return badRequest('timezone must be a valid IANA identifier (e.g. Asia/Manila)') }

    const isActive = typeof body.isActive === 'boolean' ? body.isActive : true
    const isAcceptingOrders = typeof body.isAcceptingOrders === 'boolean' ? body.isAcceptingOrders : true
    const operationalStatusRaw = typeof body.operationalStatus === 'string' ? body.operationalStatus.trim().toLowerCase() : 'open'
    const operationalStatus = OPERATIONAL_STATUSES.has(operationalStatusRaw) ? operationalStatusRaw : 'open'

    const contactInfo = body.contactInfo ?? null
    if(contactInfo && typeof contactInfo !== 'object') return badRequest('contactInfo must be an object')
    if(contactInfo && contactInfo.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(contactInfo.email).trim())) return badRequest('contactInfo.email must be valid')

    const description = typeof body.description === 'string' ? body.description.trim() || null : null
    const tags = body.tags ?? null
    const merchant_categories = Array.isArray(body.merchant_categories) ? body.merchant_categories.map((v:any)=> Number(v)).filter((n:number)=>!Number.isNaN(n)) : Array.isArray(body.merchantCategories) ? body.merchantCategories.map((v:any)=> Number(v)).filter((n:number)=>!Number.isNaN(n)) : null
    const activeAddress = body.activeAddress != null && body.activeAddress !== '' ? Number(body.activeAddress) : null
    if(activeAddress !== null && Number.isNaN(activeAddress)) return badRequest('activeAddress must be numeric id or null')

    const operatingHours = body.operatingHours ?? null
    const specialHours = body.specialHours ?? null
    const deliverySettings = body.deliverySettings ?? null
    const delivery_hours = body.delivery_hours ?? body.deliveryHours ?? null
    const merchant_latitude = body.merchant_latitude != null ? Number(body.merchant_latitude) : null
    const merchant_longitude = body.merchant_longitude != null ? Number(body.merchant_longitude) : null
    if(merchant_latitude !== null && (Number.isNaN(merchant_latitude) || merchant_latitude < -90 || merchant_latitude > 90)) return badRequest('merchant_latitude must be between -90 and 90')
    if(merchant_longitude !== null && (Number.isNaN(merchant_longitude) || merchant_longitude < -180 || merchant_longitude > 180)) return badRequest('merchant_longitude must be between -180 and 180')

    const delivery_radius_meters = body.delivery_radius_meters != null ? Number(body.delivery_radius_meters) : body.deliveryRadiusMeters != null ? Number(body.deliveryRadiusMeters) : 5000
    const max_delivery_radius_meters = body.max_delivery_radius_meters != null ? Number(body.max_delivery_radius_meters) : 10000
    const min_order_amount = body.min_order_amount != null ? Number(body.min_order_amount) : null
    const delivery_fee_base = body.delivery_fee_base != null ? Number(body.delivery_fee_base) : null
    const delivery_fee_per_km = body.delivery_fee_per_km != null ? Number(body.delivery_fee_per_km) : null
    const free_delivery_threshold = body.free_delivery_threshold != null ? Number(body.free_delivery_threshold) : null
    const is_currently_delivering = typeof body.is_currently_delivering === 'boolean' ? body.is_currently_delivering : typeof body.isCurrentlyDelivering === 'boolean' ? body.isCurrentlyDelivering : true
    const avg_delivery_time_minutes = body.avg_delivery_time_minutes != null ? Number(body.avg_delivery_time_minutes) : null
    const delivery_success_rate = body.delivery_success_rate != null ? Number(body.delivery_success_rate) : null
    if(delivery_success_rate !== null && (Number.isNaN(delivery_success_rate) || delivery_success_rate < 0 || delivery_success_rate > 1)) return badRequest('delivery_success_rate must be between 0 and 1')

    const media: Record<string, any> = {}
    if(body.media?.thumbnail != null && body.media.thumbnail !== '') media.thumbnail = Number(body.media.thumbnail)
    else if(body.thumbnail != null && body.thumbnail !== '') media.thumbnail = Number(body.thumbnail)
    if(body.media?.storeFrontImage != null && body.media.storeFrontImage !== '') media.storeFrontImage = Number(body.media.storeFrontImage)
    else if(body.storeFrontImage != null && body.storeFrontImage !== '') media.storeFrontImage = Number(body.storeFrontImage)

    const data: Record<string, any> = {
      vendor: vendorId,
      outletName,
      outletCode,
      contactInfo: contactInfo ?? undefined,
      isActive,
      isAcceptingOrders,
      operationalStatus,
      operatingHours: operatingHours ?? undefined,
      specialHours: specialHours ?? undefined,
      deliverySettings: deliverySettings ?? undefined,
      description: description ?? undefined,
      tags: tags ?? undefined,
      merchant_categories: merchant_categories ?? undefined,
      activeAddress: activeAddress ?? undefined,
      merchant_latitude: merchant_latitude ?? undefined,
      merchant_longitude: merchant_longitude ?? undefined,
      delivery_radius_meters: delivery_radius_meters ?? undefined,
      max_delivery_radius_meters: max_delivery_radius_meters ?? undefined,
      min_order_amount: min_order_amount ?? undefined,
      delivery_fee_base: delivery_fee_base ?? undefined,
      delivery_fee_per_km: delivery_fee_per_km ?? undefined,
      free_delivery_threshold: free_delivery_threshold ?? undefined,
      is_currently_delivering,
      avg_delivery_time_minutes: avg_delivery_time_minutes ?? undefined,
      delivery_success_rate: delivery_success_rate ?? undefined,
      timezone,
      delivery_hours: delivery_hours ?? undefined,
    }
    if(Object.keys(media).length) data.media = media

    let created: Record<string, any>
    try{
      created = await payload.create({ collection: 'merchants', data: data as any, depth: 2, overrideAccess: true }) as unknown as Record<string, any>
    }catch(e:any){
      const msg=e?.message||'Failed to create merchant'
      const lower=String(msg).toLowerCase()
      if(lower.includes('unique')||lower.includes('duplicate')) return NextResponse.json({ error: 'Duplicate outletCode: already exists', details: msg }, { status: 409 })
      return NextResponse.json({ error: msg, details: e?.data||e?.errors }, { status: 400 })
    }
    const sanitized = sanitizeMerchantDoc(created)
    // Bust list cache (all admins / query variants) so the new outlet shows immediately
    await deleteCachedByPrefix('admin:merchants:')
    return NextResponse.json({ success: true, message: 'Merchant created successfully', doc: sanitized }, { status: 201 })
  }catch(err:any){
    console.error('[admin/merchants] POST error:', err)
    return NextResponse.json({ error: err?.message || 'Internal Server Error' }, { status: 500 })
  }
}
