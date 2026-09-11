/**
 * @file apps/cms/src/app/api/vendor/outlets/[id]/status/route.ts
 * @description Fast dedicated endpoint for FoodPanda-style quick status toggle (Open, Busy, Pause, Closed).
 * PATCH /api/vendor/outlets/[id]/status
 */

import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import configPromise from '@payload-config'
import { authenticateVendor } from '@/utils/mediaLibrary'

const VALID_STATUSES = new Set(['open', 'closed', 'busy', 'temp_closed', 'maintenance'])

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const payload = await getPayload({ config: configPromise })
    const authUser = await authenticateVendor(payload, request)
    if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    let body: Record<string, any>
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
    }

    const { operationalStatus, isAcceptingOrders, isActive } = body

    if (operationalStatus !== undefined && !VALID_STATUSES.has(operationalStatus)) {
      return NextResponse.json({ error: 'Invalid operationalStatus value' }, { status: 400 })
    }

    // Verify vendor ownership
    const vendorRes = await payload.find({
      collection: 'vendors',
      where: { user: { equals: authUser.id } },
      limit: 1,
      depth: 0,
      overrideAccess: true,
    })
    const vendor = vendorRes.docs[0]
    if (!vendor) return NextResponse.json({ error: 'Vendor profile not found' }, { status: 404 })

    const merchant = await payload.findByID({
      collection: 'merchants',
      id,
      depth: 0,
      overrideAccess: true,
    })
    if (!merchant) return NextResponse.json({ error: 'Outlet not found' }, { status: 404 })

    const merchantVendorId = typeof merchant.vendor === 'object' ? (merchant.vendor as any).id : merchant.vendor
    if (String(merchantVendorId) !== String(vendor.id)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const patch: Record<string, any> = {}
    if (operationalStatus !== undefined) patch.operationalStatus = operationalStatus
    if (typeof isAcceptingOrders === 'boolean') patch.isAcceptingOrders = isAcceptingOrders
    if (typeof isActive === 'boolean') patch.isActive = isActive

    const updated = await payload.update({
      collection: 'merchants',
      id: merchant.id,
      data: patch as any,
      overrideAccess: true,
    })

    return NextResponse.json({
      success: true,
      outletId: String(updated.id),
      operationalStatus: updated.operationalStatus,
      isAcceptingOrders: updated.isAcceptingOrders,
      isActive: updated.isActive,
    })
  } catch (err: any) {
    console.error('[vendor/outlets/[id]/status] PATCH error:', err)
    return NextResponse.json({ error: err?.message || 'Failed to update outlet status' }, { status: 500 })
  }
}
