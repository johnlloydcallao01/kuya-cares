/**
 * @file apps/cms/src/app/api/vendor/invoices/route.ts
 * @description GET vendor invoices (sanitized, vendor-scoped). ?page&limit&status
 */

import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import configPromise from '@payload-config'
import { authenticateVendor } from '@/utils/mediaLibrary'
import { sanitizeInvoice, clampLimit, resolveOwnVendorId } from '@/utils/membershipApi'

const STATUSES = new Set(['pending', 'paid', 'failed', 'past_due', 'void', 'refunded'])

export async function GET(request: NextRequest) {
  try {
    const payload = await getPayload({ config: configPromise })
    const vendorUser = await authenticateVendor(payload, request)
    if (!vendorUser) return NextResponse.json({ error: 'Unauthorized: vendor authentication required' }, { status: 401 })
    const vendorId = await resolveOwnVendorId(payload, vendorUser.id)
    if (!vendorId) return NextResponse.json({ error: 'Vendor profile not found' }, { status: 404 })

    const { searchParams } = new URL(request.url)
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10) || 1)
    const limit = clampLimit(searchParams.get('limit'))
    const status = searchParams.get('status')?.trim() || ''

    const where: Record<string, any> = { vendor: { equals: vendorId } }
    if (status) {
      if (!STATUSES.has(status)) return NextResponse.json({ error: `status must be one of: ${Array.from(STATUSES).join(', ')}` }, { status: 400 })
      where.status = { equals: status }
    }

    const res = await payload.find({
      collection: 'subscription-invoices' as any,
      where,
      page, limit, sort: '-createdAt', depth: 0, overrideAccess: true,
    })

    return NextResponse.json(
      {
        docs: (res.docs as any[]).map(sanitizeInvoice),
        pagination: {
          page: (res as any).page,
          limit: (res as any).limit,
          totalDocs: (res as any).totalDocs,
          totalPages: (res as any).totalPages,
          hasNextPage: (res as any).hasNextPage,
          hasPrevPage: (res as any).hasPrevPage,
        },
      },
      { status: 200 },
    )
  } catch (err: any) {
    console.error('[vendor/invoices] GET error:', err)
    return NextResponse.json({ error: err?.message || 'Internal Server Error' }, { status: 500 })
  }
}
