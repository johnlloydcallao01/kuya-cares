/**
 * @file apps/cms/src/app/api/admin/membership-invoices/route.ts
 * @description GET admin invoice list. ?status&vendor&plan&page&limit (+ withAdminRequestSlot).
 */

import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import configPromise from '@payload-config'
import { authenticateAdmin } from '@/utils/mediaLibrary'
import { withAdminRequestSlot } from '@/utils/adminRequestGate'
import { sanitizeInvoice, clampLimit } from '@/utils/membershipApi'

export async function GET(request: NextRequest) {
  return withAdminRequestSlot(async () => {
    try {
      const payload = await getPayload({ config: configPromise })
      const admin = await authenticateAdmin(payload, request)
      if (!admin) return NextResponse.json({ error: 'Unauthorized: admin authentication required' }, { status: 401 })

      const { searchParams } = new URL(request.url)
      const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10) || 1)
      const limit = clampLimit(searchParams.get('limit'))
      const status = searchParams.get('status')?.trim() || ''
      const vendor = searchParams.get('vendor')?.trim() || ''
      const plan = searchParams.get('plan')?.trim() || ''

      const and: any[] = []
      if (status) and.push({ status: { equals: status } })
      if (vendor) and.push({ vendor: { equals: vendor } })
      if (plan) and.push({ plan: { equals: plan } })
      const where = and.length ? { and } : undefined

      const res = await payload.find({
        collection: 'subscription-invoices' as any,
        where: where as any,
        page, limit, sort: '-createdAt', depth: 1, overrideAccess: true,
      })

      return NextResponse.json(
        {
          docs: (res.docs as any[]).map(sanitizeInvoice),
          pagination: {
            page: (res as any).page, limit: (res as any).limit,
            totalDocs: (res as any).totalDocs, totalPages: (res as any).totalPages,
            hasNextPage: (res as any).hasNextPage, hasPrevPage: (res as any).hasPrevPage,
          },
        },
        { status: 200 },
      )
    } catch (err: any) {
      console.error('[admin/membership-invoices] GET error:', err)
      return NextResponse.json({ error: err?.message || 'Internal Server Error' }, { status: 500 })
    }
  })
}
