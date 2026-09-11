/**
 * @file apps/cms/src/app/api/admin/merchants/[id]/route.ts
 * @description BFF for single merchant (detail, update, delete) — admin-only safe boundary.
 */

import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import configPromise from '@payload-config'
import { authenticateAdmin } from '@/utils/mediaLibrary'
import { getStoreHoursStatus, validateStoreHoursFields } from '@/utils/storeHours'
import { deleteCachedByPrefix } from '@encreasl/cache'

function str(v: unknown, fb=''): string { return typeof v==='string'?v:fb }
function num(v: unknown, fb=0): number { if(typeof v==='number'&&Number.isFinite(v)) return v; if(typeof v==='string'){ const n=Number(v); return Number.isFinite(n)?n:fb } return fb }
function optionalString(v: unknown): string | null { return typeof v==='string'?v.trim()||null:null }
function sanitizeMediaRef(v: unknown): { id:number; url:string|null } | null {
  if(!v||typeof v!=='object') return null
  const s=v as Record<string, unknown>; const id=Number(s.id); if(Number.isNaN(id)) return null
  const url= typeof s.cloudinaryURL==='string'?s.cloudinaryURL : typeof s.url==='string'?s.url:null
  return { id, url }
}
function sanitizeVendorBrief(v: unknown){
  if(!v||typeof v!=='object') return null
  const o=v as Record<string, any>; const id=Number(o.id); if(Number.isNaN(id)) return null
  return { id, businessName: str(o.businessName,''), verificationStatus: str(o.verificationStatus,'pending'), businessType: str(o.businessType,'other'), isActive: !!o.isActive, logo: sanitizeMediaRef(o.logo) }
}
function sanitizeMerchantDoc(raw: Record<string, any>, merchantCountForVendor?: number){
  const vendorVal=raw.vendor; const vendor=sanitizeVendorBrief(vendorVal)
  const mediaThumb=sanitizeMediaRef((raw.media as any)?.thumbnail)
  const mediaFront=sanitizeMediaRef((raw.media as any)?.storeFrontImage)
  const interiorRaw = (raw.media as any)?.interiorImages ?? raw.interiorImages ?? null
  const menuRaw = (raw.media as any)?.menuImages ?? raw.menuImages ?? null
  const interiorImages = Array.isArray(interiorRaw) ? interiorRaw : interiorRaw ? [interiorRaw] : null
  const menuImages = Array.isArray(menuRaw) ? menuRaw : menuRaw ? [menuRaw] : null
  const cats=Array.isArray(raw.merchant_categories)? raw.merchant_categories.map((c:any)=> typeof c==='object'?{id:Number(c.id),name:str(c.name)}:{id:Number(c),name:String(c)}):[]
  const storeHoursStatus = getStoreHoursStatus(raw)
  const addr=raw.activeAddress && typeof raw.activeAddress==='object'? { id:Number((raw.activeAddress as any).id), formatted_address: str((raw.activeAddress as any).formatted_address)} : raw.activeAddress?{id:Number(raw.activeAddress),formatted_address:''}:null
  return {
    id: raw.id,
    outletName: str(raw.outletName,''),
    outletCode: str(raw.outletCode,''),
    vendor,
    vendorId: vendor?.id ?? (typeof raw.vendor==='number'||typeof raw.vendor==='string'?Number(raw.vendor):null),
    contactInfo: raw.contactInfo ?? null,
    isActive: typeof raw.isActive==='boolean'?raw.isActive:true,
    isAcceptingOrders: typeof raw.isAcceptingOrders==='boolean'?raw.isAcceptingOrders:true,
    operationalStatus: str(raw.operationalStatus,'open'),
    isOpenNow: storeHoursStatus.isOpen,
    storeHoursStatus,
    nextOpeningAt: storeHoursStatus.nextOpeningAt ?? null,
    operatingHours: raw.operatingHours ?? null,
    specialHours: raw.specialHours ?? null,
    deliverySettings: raw.deliverySettings ?? null,
    delivery_hours: raw.delivery_hours ?? raw.deliveryHours ?? null,
    deliveryHours: raw.delivery_hours ?? raw.deliveryHours ?? null,
    description: optionalString(raw.description),
    specialInstructions: optionalString(raw.specialInstructions),
    tags: raw.tags ?? null,
    merchant_categories: cats,
    activeAddress: addr,
    merchant_latitude: raw.merchant_latitude ?? null,
    merchant_longitude: raw.merchant_longitude ?? null,
    merchant_coordinates: raw.merchant_coordinates ?? null,
    location_accuracy_radius: raw.location_accuracy_radius ?? null,
    delivery_radius_meters: raw.delivery_radius_meters ?? null,
    max_delivery_radius_meters: raw.max_delivery_radius_meters ?? null,
    min_order_amount: raw.min_order_amount ?? null,
    delivery_fee_base: raw.delivery_fee_base ?? null,
    delivery_fee_per_km: raw.delivery_fee_per_km ?? null,
    free_delivery_threshold: raw.free_delivery_threshold ?? null,
    is_currently_delivering: typeof raw.is_currently_delivering==='boolean'?raw.is_currently_delivering:true,
    isCurrentlyDelivering: typeof raw.is_currently_delivering==='boolean'?raw.is_currently_delivering:true,
    avg_delivery_time_minutes: raw.avg_delivery_time_minutes ?? null,
    delivery_success_rate: raw.delivery_success_rate ?? null,
    peak_hours_multiplier: raw.peak_hours_multiplier ?? null,
    timezone: str(raw.timezone,'Asia/Manila'),
    next_available_slot: raw.next_available_slot ?? null,
    service_area: raw.service_area ?? null,
    priority_zones: raw.priority_zones ?? null,
    restricted_areas: raw.restricted_areas ?? null,
    delivery_zones: raw.delivery_zones ?? null,
    service_area_geometry: raw.service_area_geometry ?? null,
    priority_zones_geometry: raw.priority_zones_geometry ?? null,
    restricted_areas_geometry: raw.restricted_areas_geometry ?? null,
    delivery_zones_geometry: raw.delivery_zones_geometry ?? null,
    totalMerchantsForVendor: merchantCountForVendor ?? null,
    createdAt: String(raw.createdAt ?? ''),
    updatedAt: String(raw.updatedAt ?? ''),
    media: { thumbnail: mediaThumb, storeFrontImage: mediaFront, interiorImages, menuImages },
  }
}
const OPERATIONAL_STATUSES=new Set(['open','closed','busy','temp_closed','maintenance'])

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }){
  try{
    const { id }=await params
    const payload=await getPayload({ config: configPromise })
    const admin=await authenticateAdmin(payload, request)
    if(!admin) return NextResponse.json({ error:'Unauthorized' },{status:401})
    const numericId=Number(id)
    const docId:number|string=Number.isFinite(numericId)?numericId:id
    let doc: Record<string, any>
    try{ doc=await payload.findByID({ collection:'merchants', id: docId as number, depth: 2, overrideAccess: true }) as unknown as Record<string, any> }catch(e:any){ return NextResponse.json({ error:'Merchant not found', details:e?.message },{status:404})}
    if(!doc) return NextResponse.json({ error:'Merchant not found' },{status:404})
    // enrich with vendor merchant count
    let vendorMerchantCount: number | null = null
    try{
      const vendorId = typeof doc.vendor==='object' ? (doc.vendor as any).id : doc.vendor
      if(vendorId){
        const mRes=await payload.find({ collection:'merchants', where:{ vendor:{ equals: vendorId } }, limit:0, depth:0, overrideAccess:true, pagination:false} as any)
        vendorMerchantCount = typeof (mRes as any).totalDocs==='number' ? (mRes as any).totalDocs : (mRes as any).docs?.length ?? null
      }
    }catch{}
    const sanitized=sanitizeMerchantDoc(doc, vendorMerchantCount ?? undefined)
    return NextResponse.json({ doc: sanitized })
  }catch(err:any){ console.error('[admin/merchants/[id]] GET error:',err); return NextResponse.json({ error:err?.message||'Failed to load merchant' },{status:500})}
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }){
  try{
    const { id }=await params
    const payload=await getPayload({ config: configPromise })
    const admin=await authenticateAdmin(payload, request)
    if(!admin) return NextResponse.json({ error:'Unauthorized' },{status:401})
    let body: Record<string, any>
    try{ body=await request.json() }catch{ return NextResponse.json({ error:'Invalid JSON body' },{status:400})}
    try { Object.assign(body, validateStoreHoursFields(body)) } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : 'Invalid store hours' }, { status: 400 }) }
    const numericId=Number(id)
    const docId:number|string=Number.isFinite(numericId)?numericId:id
    const patch: Record<string, any>={}
    if(typeof body.outletName==='string'){
      const v=body.outletName.trim(); if(!v||v.length<2) return NextResponse.json({ error:'outletName must be at least 2 characters' },{status:400}); patch.outletName=v
    }
    if(typeof body.outletCode==='string'){
      const v=body.outletCode.trim(); if(!v) return NextResponse.json({ error:'outletCode cannot be empty' },{status:400}); patch.outletCode=v
    }
    if(body.vendor!==undefined){
      const vid= typeof body.vendor==='number'?body.vendor : typeof body.vendor==='string'?Number(body.vendor):Number(body.vendorId)
      if(!vid||Number.isNaN(vid)) return NextResponse.json({ error:'vendor must be numeric id' },{status:400})
      try{ await payload.findByID({ collection:'vendors', id: vid, depth:0, overrideAccess:true }) }catch{ return NextResponse.json({ error:'vendor not found' },{status:400})}
      patch.vendor=vid
    }
    if(typeof body.timezone==='string'){
      const v=body.timezone.trim(); if(v){ try{ Intl.DateTimeFormat(undefined,{timeZone:v}) }catch{ return NextResponse.json({ error:'timezone must be valid IANA identifier' },{status:400}) } patch.timezone=v }
    }
    if(typeof body.isActive==='boolean') patch.isActive=body.isActive
    else if(body.isActive!==undefined){ const v=String(body.isActive).toLowerCase(); if(v==='true') patch.isActive=true; else if(v==='false') patch.isActive=false }
    if(typeof body.isAcceptingOrders==='boolean') patch.isAcceptingOrders=body.isAcceptingOrders
    else if(body.isAcceptingOrders!==undefined){ const v=String(body.isAcceptingOrders).toLowerCase(); if(v==='true') patch.isAcceptingOrders=true; else if(v==='false') patch.isAcceptingOrders=false }
    if(typeof body.operationalStatus==='string'){
      const v=body.operationalStatus.trim().toLowerCase(); if(!OPERATIONAL_STATUSES.has(v)) return NextResponse.json({ error:`operationalStatus must be one of ${Array.from(OPERATIONAL_STATUSES).join(', ')}` },{status:400}); patch.operationalStatus=v
    }
    if(body.contactInfo!==undefined) patch.contactInfo=body.contactInfo
    if(body.description!==undefined) patch.description= typeof body.description==='string' ? (body.description.trim()||null) : null
    if(body.specialInstructions!==undefined) patch.specialInstructions= typeof body.specialInstructions==='string' ? (body.specialInstructions.trim()||null) : body.specialInstructions===null ? null : String(body.specialInstructions)
    if(body.special_instructions!==undefined) patch.specialInstructions= typeof body.special_instructions==='string' ? (body.special_instructions.trim()||null) : null
    if(body.tags!==undefined) patch.tags=body.tags
    if(body.merchant_categories!==undefined) patch.merchant_categories= Array.isArray(body.merchant_categories)? body.merchant_categories.map((v:any)=>Number(v)).filter((n:number)=>!Number.isNaN(n)) : body.merchant_categories===null ? null : body.merchant_categories
    if(body.merchantCategories!==undefined) patch.merchant_categories= Array.isArray(body.merchantCategories)? body.merchantCategories.map((v:any)=>Number(v)).filter((n:number)=>!Number.isNaN(n)) : null
    if(body.activeAddress!==undefined) patch.activeAddress= body.activeAddress===null||body.activeAddress==='' ? null : Number(body.activeAddress)
    if(body.operatingHours!==undefined) patch.operatingHours=body.operatingHours
    if(body.specialHours!==undefined) patch.specialHours=body.specialHours
    if(body.deliverySettings!==undefined) patch.deliverySettings=body.deliverySettings
    if(body.delivery_hours!==undefined) patch.delivery_hours=body.delivery_hours
    if(body.deliveryHours!==undefined) patch.delivery_hours=body.deliveryHours
    if(body.merchant_latitude!==undefined){ const n=Number(body.merchant_latitude); if(!Number.isNaN(n) && (n<-90||n>90)) return NextResponse.json({ error:'merchant_latitude must be between -90 and 90' },{status:400}); patch.merchant_latitude= Number.isNaN(n)?null:n }
    if(body.merchant_longitude!==undefined){ const n=Number(body.merchant_longitude); if(!Number.isNaN(n) && (n<-180||n>180)) return NextResponse.json({ error:'merchant_longitude must be between -180 and 180' },{status:400}); patch.merchant_longitude= Number.isNaN(n)?null:n }
    if(body.delivery_radius_meters!==undefined) patch.delivery_radius_meters=Number(body.delivery_radius_meters)
    if(body.max_delivery_radius_meters!==undefined) patch.max_delivery_radius_meters=Number(body.max_delivery_radius_meters)
    if(body.min_order_amount!==undefined) patch.min_order_amount=Number(body.min_order_amount)
    if(body.delivery_fee_base!==undefined) patch.delivery_fee_base=Number(body.delivery_fee_base)
    if(body.delivery_fee_per_km!==undefined) patch.delivery_fee_per_km=Number(body.delivery_fee_per_km)
    if(body.free_delivery_threshold!==undefined) patch.free_delivery_threshold=Number(body.free_delivery_threshold)
    if(typeof body.is_currently_delivering==='boolean') patch.is_currently_delivering=body.is_currently_delivering
    else if(body.is_currently_delivering!==undefined){ const v=String(body.is_currently_delivering).toLowerCase(); if(v==='true') patch.is_currently_delivering=true; else if(v==='false') patch.is_currently_delivering=false }
    if(typeof body.isCurrentlyDelivering==='boolean') patch.is_currently_delivering=body.isCurrentlyDelivering
    else if(body.isCurrentlyDelivering!==undefined){ const v=String(body.isCurrentlyDelivering).toLowerCase(); if(v==='true') patch.is_currently_delivering=true; else if(v==='false') patch.is_currently_delivering=false }
    if(body.is_currently_delivering!==undefined && typeof body.is_currently_delivering!=='boolean' && typeof body.is_currently_delivering!=='string') patch.is_currently_delivering= !!body.is_currently_delivering
    if(body.avg_delivery_time_minutes!==undefined) patch.avg_delivery_time_minutes= body.avg_delivery_time_minutes===null||body.avg_delivery_time_minutes==='' ? null : Number(body.avg_delivery_time_minutes)
    if(body.delivery_success_rate!==undefined){ const n=Number(body.delivery_success_rate); if(body.delivery_success_rate===null||body.delivery_success_rate==='') patch.delivery_success_rate=null; else { if(!Number.isNaN(n) && (n<0||n>1)) return NextResponse.json({ error:'delivery_success_rate must be between 0 and 1' },{status:400}); patch.delivery_success_rate=n } }
    if(body.peak_hours_multiplier!==undefined){ const n=Number(body.peak_hours_multiplier); if(body.peak_hours_multiplier===null||body.peak_hours_multiplier==='') patch.peak_hours_multiplier=null; else { if(!Number.isNaN(n) && n<1) return NextResponse.json({ error:'peak_hours_multiplier must be >= 1' },{status:400}); patch.peak_hours_multiplier=n } }
    if(body.peakHoursMultiplier!==undefined) patch.peak_hours_multiplier= body.peakHoursMultiplier===null||body.peakHoursMultiplier==='' ? null : Number(body.peakHoursMultiplier)
    if(body.location_accuracy_radius!==undefined) patch.location_accuracy_radius= body.location_accuracy_radius===null||body.location_accuracy_radius==='' ? null : Number(body.location_accuracy_radius)
    if(body.locationAccuracyRadius!==undefined) patch.location_accuracy_radius= body.locationAccuracyRadius===null||body.locationAccuracyRadius==='' ? null : Number(body.locationAccuracyRadius)
    if(body.next_available_slot!==undefined) patch.next_available_slot= body.next_available_slot===null||body.next_available_slot==='' ? null : new Date(body.next_available_slot).toISOString()
    if(body.nextAvailableSlot!==undefined) patch.next_available_slot= body.nextAvailableSlot===null||body.nextAvailableSlot==='' ? null : new Date(body.nextAvailableSlot).toISOString()
    if(body.service_area!==undefined) patch.service_area=body.service_area
    if(body.serviceArea!==undefined) patch.service_area=body.serviceArea
    if(body.priority_zones!==undefined) patch.priority_zones=body.priority_zones
    if(body.priorityZones!==undefined) patch.priority_zones=body.priorityZones
    if(body.restricted_areas!==undefined) patch.restricted_areas=body.restricted_areas
    if(body.restrictedAreas!==undefined) patch.restricted_areas=body.restrictedAreas
    if(body.delivery_zones!==undefined) patch.delivery_zones=body.delivery_zones
    if(body.deliveryZones!==undefined) patch.delivery_zones=body.deliveryZones
    if(body.media!==undefined){
      const m: Record<string, any>={}
      if(body.media.thumbnail!==undefined) m.thumbnail= body.media.thumbnail===null||body.media.thumbnail==='' ? null : Number(body.media.thumbnail)
      if(body.media.storeFrontImage!==undefined) m.storeFrontImage= body.media.storeFrontImage===null||body.media.storeFrontImage==='' ? null : Number(body.media.storeFrontImage)
      if(body.media.interiorImages!==undefined) m.interiorImages= body.media.interiorImages===null ? null : Array.isArray(body.media.interiorImages) ? body.media.interiorImages.map((v:any)=> Number(v)).filter((n:number)=>!Number.isNaN(n)) : body.media.interiorImages
      if(body.media.menuImages!==undefined) m.menuImages= body.media.menuImages===null ? null : Array.isArray(body.media.menuImages) ? body.media.menuImages.map((v:any)=> Number(v)).filter((n:number)=>!Number.isNaN(n)) : body.media.menuImages
      patch.media=m
    } else {
      if(body.thumbnail!==undefined) patch.media={ ...(patch.media||{}), thumbnail: body.thumbnail===null||body.thumbnail==='' ? null : Number(body.thumbnail) }
      if(body.storeFrontImage!==undefined) patch.media={ ...(patch.media||{}), storeFrontImage: body.storeFrontImage===null||body.storeFrontImage==='' ? null : Number(body.storeFrontImage) }
      if(body.interiorImages!==undefined) patch.media={ ...(patch.media||{}), interiorImages: body.interiorImages===null?null:Array.isArray(body.interiorImages)?body.interiorImages.map((v:any)=>Number(v)).filter((n:number)=>!Number.isNaN(n)):body.interiorImages }
      if(body.menuImages!==undefined) patch.media={ ...(patch.media||{}), menuImages: body.menuImages===null?null:Array.isArray(body.menuImages)?body.menuImages.map((v:any)=>Number(v)).filter((n:number)=>!Number.isNaN(n)):body.menuImages }
    }

    if(Object.keys(patch).length===0) return NextResponse.json({ error:'Nothing to update' },{status:400})
    let updated: Record<string, any>
    try{ updated=await payload.update({ collection:'merchants', id: docId as number, data: patch as any, depth:2, overrideAccess:true }) as unknown as Record<string, any> }catch(e:any){
      const msg=e?.message||'Failed to update merchant'
      const lower=String(msg).toLowerCase()
      if(lower.includes('unique')||lower.includes('duplicate')) return NextResponse.json({ error:'Duplicate outletCode: already exists', details:msg },{status:409})
      return NextResponse.json({ error:msg, details:e?.data||e?.errors },{status:400})
    }
    const sanitized=sanitizeMerchantDoc(updated)
    // Bust list cache so the update reflects immediately on /merchants
    await deleteCachedByPrefix('admin:merchants:')
    return NextResponse.json({ success:true, message:'Merchant updated successfully', doc: sanitized })
  }catch(err:any){ console.error('[admin/merchants/[id]] PATCH error:',err); return NextResponse.json({ error:err?.message||'Update failed' },{status:500})}
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }){
  try{
    const { id }=await params
    const payload=await getPayload({ config: configPromise })
    const admin=await authenticateAdmin(payload, request)
    if(!admin) return NextResponse.json({ error:'Unauthorized' },{status:401})
    const numericId=Number(id)
    const docId:number|string=Number.isFinite(numericId)?numericId:id
    // Check for dependent merchant-products (optional safety)
    // For now allow delete; payload will handle constraints
    let deleted:any
    try{ deleted=await payload.delete({ collection:'merchants', id: docId as number, overrideAccess:true }) }catch(e:any){ return NextResponse.json({ error:e?.message||'Failed to delete merchant' },{status:400})}
    if(!deleted) return NextResponse.json({ error:'Merchant not found' },{status:404})
    // Bust list cache so the deletion reflects immediately on /merchants
    await deleteCachedByPrefix('admin:merchants:')
    return NextResponse.json({ success:true, id:deleted.id, message:'Merchant deleted successfully' })
  }catch(err:any){ console.error('[admin/merchants/[id]] DELETE error:',err); return NextResponse.json({ error:err?.message||'Delete failed' },{status:500})}
}
