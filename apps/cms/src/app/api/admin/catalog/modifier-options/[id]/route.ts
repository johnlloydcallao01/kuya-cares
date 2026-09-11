/**
 * @file apps/cms/src/app/api/admin/catalog/modifier-options/[id]/route.ts
 */

import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import configPromise from '@payload-config'
import { authenticateAdmin } from '@/utils/mediaLibrary'
import { deleteCachedByPrefix } from '@encreasl/cache'

function str(v: unknown, fallback=''): string { return typeof v==='string'?v:fallback }
function num(v: unknown, fallback=0): number { if(typeof v==='number'&&Number.isFinite(v)) return v; if(typeof v==='string'){const n=Number(v); return Number.isFinite(n)?n:fallback} return fallback }
function sanitizeGroupBrief(value: unknown): { id: number; name: string } | number | null {
  if(value==null) return null
  if(typeof value==='number'||typeof value==='string'){const n=Number(value); return Number.isNaN(n)?null:n}
  if(typeof value==='object'){const src=value as Record<string,unknown>; const id=Number(src.id); if(Number.isNaN(id)) return null; return {id, name: str(src.name,'')}}
  return null
}
function sanitizeDoc(raw: Record<string, any>): Record<string, any> {
  return {
    id: raw.id,
    modifier_group_id: sanitizeGroupBrief(raw.modifier_group_id),
    modifier_group: sanitizeGroupBrief(raw.modifier_group_id),
    name: str(raw.name,''),
    price_adjustment: raw.price_adjustment!=null?num(raw.price_adjustment,0):0,
    is_default: typeof raw.is_default==='boolean'?raw.is_default:false,
    is_available: typeof raw.is_available==='boolean'?raw.is_available:true,
    sort_order: raw.sort_order!=null?Math.trunc(num(raw.sort_order,0)):0,
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
    try { doc = await payload.findByID({ collection: 'modifier-options', id: docId as number, depth: 2, overrideAccess: true }) as unknown as Record<string, any> } catch (e:any){ return NextResponse.json({ error: 'Modifier option not found', details: e?.message }, { status: 404 }) }
    if (!doc) return NextResponse.json({ error: 'Modifier option not found' }, { status: 404 })
    const sanitized = sanitizeDoc(doc)
    return NextResponse.json({ doc: sanitized })
  } catch (err:any){ console.error('[admin/catalog/modifier-options/[id]] GET error:', err); return NextResponse.json({ error: err?.message||'Failed to load modifier option' }, { status: 500 })}
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
    if (body.modifier_group_id !== undefined || body.modifierGroupId !== undefined || body.groupId !== undefined) {
      const raw = body.modifier_group_id ?? body.modifierGroupId ?? body.groupId
      if(raw===null||raw==='') return NextResponse.json({ error: 'modifier_group_id cannot be empty' }, { status: 400 })
      const gid=Number(raw); if(Number.isNaN(gid)) return NextResponse.json({ error: 'modifier_group_id must be numeric' }, { status: 400 })
      try{ const grp= await payload.findByID({ collection: 'modifier-groups', id: gid, depth:0, overrideAccess:true }) as any; if(!grp) return NextResponse.json({ error: 'modifier_group_id does not exist' }, { status: 400 }) } catch { return NextResponse.json({ error: 'modifier_group_id does not exist' }, { status: 400 }) }
      patch.modifier_group_id = gid
    }
    if (body.name !== undefined) {
      if(typeof body.name!=='string') return NextResponse.json({ error: 'name must be a string' }, { status: 400 })
      const v=body.name.trim(); if(!v||v.length<2) return NextResponse.json({ error: 'name must be at least 2 characters' }, { status: 400 }); if(v.length>255) return NextResponse.json({ error: 'name must be at most 255 characters' }, { status: 400 })
      patch.name=v
    }
    if (body.price_adjustment !== undefined) {
      if(body.price_adjustment===null||body.price_adjustment==='') patch.price_adjustment=0
      else { const n=Number(body.price_adjustment); if(!Number.isFinite(n)) return NextResponse.json({ error: 'price_adjustment must be finite numeric' }, { status: 400 }); patch.price_adjustment=n }
    }
    if (body.is_default !== undefined) {
      if(typeof body.is_default==='boolean') patch.is_default=body.is_default
      else if(typeof body.is_default==='string'){const v=body.is_default.trim().toLowerCase(); if(v==='true') patch.is_default=true; else if(v==='false') patch.is_default=false; else return NextResponse.json({ error: 'is_default must be boolean' }, { status:400 })}
      else return NextResponse.json({ error: 'is_default must be boolean' }, { status:400 })
    }
    if (body.is_available !== undefined) {
      if(typeof body.is_available==='boolean') patch.is_available=body.is_available
      else if(typeof body.is_available==='string'){const v=body.is_available.trim().toLowerCase(); if(v==='true') patch.is_available=true; else if(v==='false') patch.is_available=false; else return NextResponse.json({ error: 'is_available must be boolean' }, { status:400 })}
      else return NextResponse.json({ error: 'is_available must be boolean' }, { status:400 })
    }
    if (body.sort_order !== undefined) {
      if(body.sort_order===null||body.sort_order==='') patch.sort_order=0
      else { const n=Number(body.sort_order); if(!Number.isFinite(n)) return NextResponse.json({ error: 'sort_order must be numeric' }, { status:400 }); patch.sort_order=Math.trunc(n) }
    }

    if(Object.keys(patch).length===0) return NextResponse.json({ error: 'Nothing to update' }, { status: 400 })
    let updated: Record<string, any>
    try { updated = await payload.update({ collection: 'modifier-options', id: docId as number, data: patch as any, depth: 2, overrideAccess: true }) as unknown as Record<string, any> } catch(e:any){ const msg=e?.message||'Failed to update modifier option'; const lower=String(msg).toLowerCase(); if(lower.includes('unique')||lower.includes('duplicate')) return NextResponse.json({ error: 'Duplicate value violates unique constraint', details: msg }, { status:409 }); return NextResponse.json({ error: msg, details: e?.data||e?.errors }, { status:400 }) }
    const sanitized=sanitizeDoc(updated)
    // Bust list cache so the update reflects immediately on /catalog/modifier-options
    await deleteCachedByPrefix('admin:catalog-modifier-options:')
    return NextResponse.json({ success: true, message: 'Modifier option updated successfully', doc: sanitized })
  } catch(err:any){ console.error('[admin/catalog/modifier-options/[id]] PATCH error:', err); return NextResponse.json({ error: err?.message||'Update failed' }, { status:500 }) }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const payload = await getPayload({ config: configPromise })
    const admin = await authenticateAdmin(payload, request)
    if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const numericId = Number(id)
    const docId: number | string = Number.isFinite(numericId) ? numericId : id
    let deleted:any
    try { deleted = await payload.delete({ collection: 'modifier-options', id: docId as number, overrideAccess: true }) } catch(e:any){ return NextResponse.json({ error: e?.message||'Failed to delete modifier option' }, { status:400 }) }
    if(!deleted) return NextResponse.json({ error: 'Modifier option not found' }, { status:404 })
    // Bust list cache so the deletion reflects immediately on /catalog/modifier-options
    await deleteCachedByPrefix('admin:catalog-modifier-options:')
    return NextResponse.json({ success: true, id: deleted.id, message: 'Modifier option deleted successfully' })
  } catch(err:any){ console.error('[admin/catalog/modifier-options/[id]] DELETE error:', err); return NextResponse.json({ error: err?.message||'Delete failed' }, { status:500 }) }
}
