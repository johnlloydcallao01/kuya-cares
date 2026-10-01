/**
 * @file apps/cms/src/app/api/vendor/invoices/[id]/route.ts
 * @description GET single vendor invoice (sanitized, vendor-scoped, 403 on cross-vendor).
 */

import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import configPromise from '@payload-config'
import { authenticateVendor } from '@/utils/mediaLibrary'
import { sanitizeInvoice, resolveOwnVendorId } from '@/utils/membershipApi'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const payload = await getPayload({ config: configPromise })
    const vendorUser = await authenticateVendor(payload, request)
    if (!vendorUser) return NextResponse.json({ error: 'Unauthorized: vendor authentication required' }, { status: 401 })
    const vendorId = await resolveOwnVendorId(payload, vendorUser.id)
    if (!vendorId) return NextResponse.json({ error: 'Vendor profile not found' }, { status: 404 })

    const { id } = await params
    let invoice: any = null
    try {
      invoice = await payload.findByID({ collection: 'subscription-invoices' as any, id: id as any, depth: 0, overrideAccess: true })
    } catch {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })
    }
    const owner = invoice?.vendor && typeof invoice.vendor === 'object' ? String(invoice.vendor.id) : String(invoice?.vendor ?? '')
    if (owner !== String(vendorId)) {
      return NextResponse.json({ error: 'Forbidden: cross-vendor access denied' }, { status: 403 })
    }
    return NextResponse.json({ doc: sanitizeInvoice(invoice) }, { status: 200 })
  } catch (err: any) {
    console.error('[vendor/invoices/[id]] GET error:', err)
    return NextResponse.json({ error: err?.message || 'Internal Server Error' }, { status: 500 })
  }
}
