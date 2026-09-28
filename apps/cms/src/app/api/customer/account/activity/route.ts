/**
 * GET /api/customer/account/activity?page=&limit=
 * Own security-activity feed (UserEvents). Auth: customer JWT (self only).
 */
import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import configPromise from '@payload-config'
import { authenticateCustomer } from '@/utils/mediaLibrary'

export async function GET(request: NextRequest) {
  try {
    const payload = await getPayload({ config: configPromise })
    const authUser = await authenticateCustomer(payload, request)
    if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = new URL(request.url)
    const page = Math.max(1, Number(searchParams.get('page') || 1))
    const limit = Math.min(100, Math.max(1, Number(searchParams.get('limit') || 20)))

    const res = await payload.find({
      collection: 'user-events',
      where: { user: { equals: Number(authUser.id) } },
      sort: '-createdAt',
      page,
      limit,
      depth: 0,
      overrideAccess: true,
    })

    return NextResponse.json({
      data: {
        docs: (res.docs || []).map((e: any) => ({
          id: e.id,
          eventType: e.eventType,
          eventData: e.eventData,
          createdAt: e.createdAt || e.timestamp,
        })),
        pagination: {
          page: res.page,
          limit: res.limit,
          totalDocs: res.totalDocs,
          totalPages: res.totalPages,
          hasNextPage: res.hasNextPage,
          hasPrevPage: res.hasPrevPage,
        },
      },
    })
  } catch (err: any) {
    console.error('[customer/account/activity] GET error:', err)
    return NextResponse.json({ error: err?.message || 'Internal Server Error' }, { status: 500 })
  }
}
