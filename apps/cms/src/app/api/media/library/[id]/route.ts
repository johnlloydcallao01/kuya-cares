/**
 * @file apps/cms/src/app/api/media/library/[id]/route.ts
 * @description BFF endpoint for a single media item.
 * GET    /api/media/library/[id] -> single media + usage aggregation
 * PATCH  /api/media/library/[id] -> update alt text
 * DELETE /api/media/library/[id] -> delete media (also removes from Cloudinary)
 * Access: admin-only
 */

import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import configPromise from '@payload-config'
import { authenticateAdmin, aggregateMediaUsage, mapMediaDoc } from '@/utils/mediaLibrary'

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const payload = await getPayload({ config: configPromise })
    const admin = await authenticateAdmin(payload, request)
    if (!admin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const numericId = Number(id)
    const doc = await payload.findByID({
      collection: 'media',
      id: Number.isFinite(numericId) ? numericId : id,
      depth: 0,
      overrideAccess: true,
    })

    if (!doc) {
      return NextResponse.json({ error: 'Media not found' }, { status: 404 })
    }

    const usageMap = await aggregateMediaUsage(payload, [doc.id])
    return NextResponse.json({ doc: mapMediaDoc(doc, usageMap.get(doc.id) || []) })
  } catch (err: any) {
    console.error('[media/library/[id]] GET error:', err)
    return NextResponse.json({ error: err?.message || 'Internal Server Error' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const payload = await getPayload({ config: configPromise })
    const admin = await authenticateAdmin(payload, request)
    if (!admin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    let body: Record<string, any>
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
    }

    const updateData: Record<string, any> = {}
    if (typeof body.alt === 'string') {
      updateData.alt = body.alt
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: 'Nothing to update' }, { status: 400 })
    }

    const numericId = Number(id)
    const updated = await payload.update({
      collection: 'media',
      id: Number.isFinite(numericId) ? numericId : id,
      data: updateData,
      overrideAccess: true,
    })

    return NextResponse.json({ doc: mapMediaDoc(updated) })
  } catch (err: any) {
    console.error('[media/library/[id]] PATCH error:', err)
    return NextResponse.json({ error: err?.message || 'Update failed' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const payload = await getPayload({ config: configPromise })
    const admin = await authenticateAdmin(payload, request)
    if (!admin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const numericId = Number(id)
    const deleted = await payload.delete({
      collection: 'media',
      id: Number.isFinite(numericId) ? numericId : id,
      overrideAccess: true,
    })

    if (!deleted) {
      return NextResponse.json({ error: 'Media not found' }, { status: 404 })
    }

    return NextResponse.json({ success: true, id: deleted.id })
  } catch (err: any) {
    console.error('[media/library/[id]] DELETE error:', err)
    return NextResponse.json({ error: err?.message || 'Delete failed' }, { status: 500 })
  }
}