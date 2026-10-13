import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import configPromise from '@payload-config'
import { authenticateAdmin } from '@/utils/mediaLibrary'

export async function GET(request: NextRequest) {
  try {
    const payload = await getPayload({ config: configPromise })
    const admin = await authenticateAdmin(payload, request)
    if (!admin) return NextResponse.json({ error: 'Unauthorized: admin authentication required' }, { status: 401 })

    const result = await payload.find({
      collection: 'membership-audit-log',
      where: { action: { equals: 'override' } },
      limit: 1000,
      sort: '-createdAt',
      depth: 1,
      overrideAccess: true,
    })
    const docs = result.docs.filter((entry) => {
      const metadata = entry.metadata
      return !!metadata && typeof metadata === 'object' && (metadata as Record<string, unknown>).kind === 'commission-rule'
    })
    return NextResponse.json({ docs, totalDocs: docs.length })
  } catch (error) {
    console.error('[admin/commission-rules/audit] GET error:', error)
    return NextResponse.json({ error: 'Failed to load commission rule audit history' }, { status: 500 })
  }
}
