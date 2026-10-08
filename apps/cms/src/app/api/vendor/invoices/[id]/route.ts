/**
 * @file apps/cms/src/app/api/vendor/invoices/[id]/route.ts
 * @description GET single vendor invoice (sanitized, vendor-scoped, 403 on cross-vendor).
 */

import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import configPromise from '@payload-config'
import { authenticateVendorOrMember } from '@/utils/mediaLibrary'
import { sanitizeInvoice, resolveOwnVendorId, resolveOwnedVendorId } from '@/utils/membershipApi'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const payload = await getPayload({ config: configPromise })
    const vendorUser = await authenticateVendorOrMember(payload, request)
    if (!vendorUser) return NextResponse.json({ error: 'Unauthorized: seller authentication required' }, { status: 401 })
    const requestedVendorId = new URL(request.url).searchParams.get('vendorId')
    if (vendorUser.role === 'member' && !requestedVendorId) {
      return NextResponse.json({ error: 'vendorId is required' }, { status: 400 })
    }
    const vendorId = requestedVendorId
      ? await resolveOwnedVendorId(payload, vendorUser.id, requestedVendorId)
      : await resolveOwnVendorId(payload, vendorUser.id)
    if (!vendorId) return NextResponse.json({ error: 'Vendor profile not found or not owned by account' }, { status: requestedVendorId ? 403 : 404 })

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
