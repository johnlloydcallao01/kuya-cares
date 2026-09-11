import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import configPromise from '@payload-config'
import { authenticateAdmin } from '@/utils/mediaLibrary'

function normalize(query: string) {
  return query.trim().toLowerCase().replace(/\s+/g, ' ')
}

export async function GET(request: NextRequest) {
  try {
    const payload = await getPayload({ config: configPromise })
    const admin = await authenticateAdmin(payload, request)
    if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = new URL(request.url)
    const limit = Math.min(20, Math.max(1, Number(searchParams.get('limit') || 10)))
    const result = await payload.find({
      collection: 'recent-searches',
      where: { user: { equals: admin.id } },
      limit,
      sort: '-updatedAt',
      depth: 0,
      pagination: false,
      overrideAccess: true,
    })

    return NextResponse.json({
      searches: result.docs.map((doc) => ({
        id: doc.id,
        query: doc.query,
        frequency: doc.frequency,
        updatedAt: doc.updatedAt,
      })),
    })
  } catch (error) {
    console.error('[admin/search/recent] GET error:', error)
    return NextResponse.json({ error: 'Failed to load recent searches' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const payload = await getPayload({ config: configPromise })
    const admin = await authenticateAdmin(payload, request)
    if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await request.json() as { query?: unknown }
    const query = typeof body.query === 'string' ? body.query.trim() : ''
    const normalizedQuery = normalize(query)
    if (!normalizedQuery) return NextResponse.json({ error: 'query is required' }, { status: 400 })

    const existing = await payload.find({
      collection: 'recent-searches',
      where: {
        user: { equals: admin.id },
        normalizedQuery: { equals: normalizedQuery },
      },
      limit: 1,
      depth: 0,
      overrideAccess: true,
    })

    const doc = existing.docs[0]
      ? await payload.update({
          collection: 'recent-searches',
          id: existing.docs[0].id,
          data: { query, frequency: Number(existing.docs[0].frequency || 0) + 1 },
          depth: 0,
          overrideAccess: true,
        })
      : await payload.create({
          collection: 'recent-searches',
          data: {
            user: admin.id,
            query,
            normalizedQuery,
            scope: 'global',
            frequency: 1,
            source: 'web',
          },
          depth: 0,
          overrideAccess: true,
        })

    return NextResponse.json({
      search: { id: doc.id, query: doc.query, frequency: doc.frequency, updatedAt: doc.updatedAt },
    }, { status: existing.docs[0] ? 200 : 201 })
  } catch (error) {
    console.error('[admin/search/recent] POST error:', error)
    return NextResponse.json({ error: 'Failed to save recent search' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const payload = await getPayload({ config: configPromise })
    const admin = await authenticateAdmin(payload, request)
    if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const query = new URL(request.url).searchParams.get('query')?.trim()
    const where: Record<string, unknown> = {
      user: { equals: admin.id },
    }
    if (query) where.normalizedQuery = { equals: normalize(query) }

    const result = await payload.find({ collection: 'recent-searches', where: where as any, limit: 100, depth: 0, pagination: false, overrideAccess: true })
    await Promise.all(result.docs.map((doc) => payload.delete({ collection: 'recent-searches', id: doc.id, overrideAccess: true })))
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[admin/search/recent] DELETE error:', error)
    return NextResponse.json({ error: 'Failed to clear recent searches' }, { status: 500 })
  }
}