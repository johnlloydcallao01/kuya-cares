/**
 * @file apps/cms/src/app/api/vendor/invoices/route.ts
 * @description GET vendor invoices (sanitized, vendor-scoped). ?page&limit&status
 */

import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import configPromise from '@payload-config'
import { authenticateVendorOrMember } from '@/utils/mediaLibrary'
import { sanitizeInvoice, clampLimit, resolveOwnVendorId, resolveOwnedVendorId } from '@/utils/membershipApi'

const STATUSES = new Set(['pending', 'paid', 'failed', 'past_due', 'void', 'refunded'])

export async function GET(request: NextRequest) {
  try {
    const payload = await getPayload({ config: configPromise })
    const { searchParams } = new URL(request.url)
    const vendorUser = await authenticateVendorOrMember(payload, request)
    if (!vendorUser) return NextResponse.json({ error: 'Unauthorized: seller authentication required' }, { status: 401 })
    const requestedVendorId = searchParams.get('vendorId')
    if (vendorUser.role === 'member' && !requestedVendorId) {
      return NextResponse.json({ error: 'vendorId is required' }, { status: 400 })
    }
    const vendorId = requestedVendorId
      ? await resolveOwnedVendorId(payload, vendorUser.id, requestedVendorId)
      : await resolveOwnVendorId(payload, vendorUser.id)
    if (!vendorId) return NextResponse.json({ error: 'Vendor profile not found or not owned by account' }, { status: requestedVendorId ? 403 : 404 })

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
