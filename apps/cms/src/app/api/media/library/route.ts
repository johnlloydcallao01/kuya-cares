/**
 * @file apps/cms/src/app/api/media/library/route.ts
 * @description BFF endpoint for the web-admin Media Library page.
 * GET  /api/media/library          -> list media (search/filter/pagination) + usage aggregation
 * POST /api/media/library          -> upload a new media file (multipart form data)
 * Access: admin-only (the endpoint is the safe access boundary; overrideAccess used internally)
 */

import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import configPromise from '@payload-config'
import { authenticateAdmin, aggregateMediaUsage, mapMediaDoc, generateUniqueFilename } from '@/utils/mediaLibrary'
import { withAdminRequestSlot } from '@/utils/adminRequestGate'
import { getCached, setCached } from '@encreasl/cache'

const MAX_UPLOAD_SIZE = 50 * 1024 * 1024 // 50 MB
const MAX_FILE_SIZE_DB = 1024 * 1024 * 1024 // Payload default cap, defensive

export async function GET(request: NextRequest) {
  return withAdminRequestSlot(async () => {
    try {
    const payload = await getPayload({ config: configPromise })
    const admin = await authenticateAdmin(payload, request)
    if (!admin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const cacheQuery = Array.from(searchParams.entries())
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
      .join('&') || 'page=1&limit=24&sort=-createdAt'
    const cacheKey = `admin:media-library:${admin.id}:${cacheQuery}`
    const cached = await getCached<Record<string, unknown>>(cacheKey)
    if (cached) return NextResponse.json(cached, { headers: { 'X-Media-Cache': 'HIT' } })

    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10) || 1)
    const limit = Math.min(60, Math.max(1, parseInt(searchParams.get('limit') || '24', 10) || 24))
    const search = searchParams.get('search')?.trim() || ''
    const type = searchParams.get('type') || ''
    const sort = searchParams.get('sort') || '-createdAt'

    const where: Record<string, any> = {}

    if (search) {
      where.or = [
        { filename: { contains: search } },
        { alt: { contains: search } },
        { cloudinaryPublicId: { contains: search } },
      ]
    }

    if (type === 'image' || type === 'video') {
      where.mimeType = { contains: `${type}/` }
    }

    const result = await payload.find({
      collection: 'media',
      where,
      page,
      limit,
      sort,
      depth: 0,
      overrideAccess: true,
    })

    const mediaIds = result.docs.map((doc: any) => doc.id)
    const usageMap = await aggregateMediaUsage(payload, mediaIds)

    const docs = result.docs.map((doc: any) =>
      mapMediaDoc(doc, usageMap.get(doc.id) || [])
    )

    const response = {
      docs,
      totalDocs: result.totalDocs,
      totalPages: result.totalPages,
      page: result.page,
      hasNextPage: result.hasNextPage,
      hasPrevPage: result.hasPrevPage,
    }
    await setCached(cacheKey, response, 15)
    return NextResponse.json(response, { headers: { 'X-Media-Cache': 'MISS' } })
    } catch (err: any) {
      console.error('[media/library] GET error:', err)
      return NextResponse.json({ error: err?.message || 'Internal Server Error' }, { status: 500 })
    }
  })
}

export async function POST(request: NextRequest) {
  try {
    const payload = await getPayload({ config: configPromise })
    const admin = await authenticateAdmin(payload, request)
    if (!admin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    let formData: FormData
    try {
      formData = await request.formData()
    } catch {
      return NextResponse.json({ error: 'Invalid multipart form data' }, { status: 400 })
    }

    const file = formData.get('file')
    const alt = (formData.get('alt') as string) || ''

    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'No file provided (field "file" required)' }, { status: 400 })
    }

    if (file.size > MAX_UPLOAD_SIZE) {
      return NextResponse.json({ error: 'File exceeds the 50 MB upload limit' }, { status: 413 })
    }

    const buffer = Buffer.from(await file.arrayBuffer())
    if (buffer.byteLength > MAX_FILE_SIZE_DB) {
      return NextResponse.json({ error: 'File too large' }, { status: 413 })
    }

    // Generate a URL-safe unique filename to prevent uniqueness collisions in Payload/DB
    const sanitizedName = generateUniqueFilename(file.name)
    const created = await payload.create({
      collection: 'media',
      data: { alt },
      file: {
        data: buffer,
        mimetype: file.type || 'application/octet-stream',
        name: sanitizedName,
        // provide both name and filename for adapter compatibility (grandline proven pattern uses `name`)
        filename: sanitizedName,
        size: file.size,
      } as any,
      overrideAccess: true,
    })

    return NextResponse.json({ doc: mapMediaDoc(created) }, { status: 201 })
  } catch (err: any) {
    console.error('[media/library] POST error:', err)
    console.error('[media/library] POST error data:', err?.data)
    console.error('[media/library] POST error errors:', err?.errors)
    const details = err?.data?.errors?.[0]?.message || err?.errors?.[0]?.message || err?.data?.message || ''
    const message = err?.message || 'Upload failed'
    return NextResponse.json({ error: details ? `${message}: ${details}` : message, details: err?.data || err?.errors }, { status: 500 })
  }
}
