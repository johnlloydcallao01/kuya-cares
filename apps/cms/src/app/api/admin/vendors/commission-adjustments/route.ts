import { randomUUID } from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import configPromise from '@payload-config'
import { deleteCachedByPrefix } from '@encreasl/cache'
import { authenticateAdmin } from '@/utils/mediaLibrary'

function parseMoney(value: unknown, field: string): number {
  const amount = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(amount) || Math.abs(amount * 100 - Math.round(amount * 100)) > 0.000001) {
    throw new Error(`${field} must be a finite amount with no more than two decimal places.`)
  }
  return Math.round(amount * 100) / 100
}

export async function POST(request: NextRequest) {
  try {
    const payload = await getPayload({ config: configPromise })
    const admin = await authenticateAdmin(payload, request)
    if (!admin) return NextResponse.json({ error: 'Unauthorized: admin authentication required' }, { status: 401 })

    let body: Record<string, unknown>
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
    }

    const vendorId = body.vendorId
    if ((typeof vendorId !== 'string' && typeof vendorId !== 'number') || !String(vendorId).trim()) {
      return NextResponse.json({ error: 'vendorId is required' }, { status: 400 })
    }
    const normalizedVendorId = Number(vendorId)
    if (!Number.isSafeInteger(normalizedVendorId) || normalizedVendorId <= 0) {
      return NextResponse.json({ error: 'vendorId must be a positive integer' }, { status: 400 })
    }
    const reason = typeof body.reason === 'string' ? body.reason.trim() : ''
    if (!reason || reason.length > 500) {
      return NextResponse.json({ error: 'A reason of 1 to 500 characters is required' }, { status: 400 })
    }

    let commissionAmount: number
    let transactionFeeAmount: number
    let vendorBalanceAmount: number
    try {
      commissionAmount = parseMoney(body.commissionAmount, 'commissionAmount')
      transactionFeeAmount = parseMoney(body.transactionFeeAmount, 'transactionFeeAmount')
      vendorBalanceAmount = parseMoney(body.vendorBalanceAmount, 'vendorBalanceAmount')
    } catch (error) {
      return NextResponse.json({ error: error instanceof Error ? error.message : 'Invalid adjustment amounts' }, { status: 400 })
    }
    if (commissionAmount === 0 && transactionFeeAmount === 0 && vendorBalanceAmount === 0) {
      return NextResponse.json({ error: 'Enter a non-zero commission, fee, or vendor balance adjustment' }, { status: 400 })
    }

    const vendorResult = await payload.find({
      collection: 'vendors',
      where: { id: { equals: normalizedVendorId } },
      limit: 1,
      depth: 0,
      overrideAccess: true,
      pagination: false,
    })
    if (vendorResult.docs.length === 0) {
      return NextResponse.json({ error: 'Vendor not found' }, { status: 404 })
    }

    const doc = await payload.create({
      collection: 'vendor-commission-entries',
      data: {
        vendor: normalizedVendorId,
        entry_type: 'adjustment',
        idempotency_key: `commission:manual-adjustment:${randomUUID()}`,
        currency: 'PHP',
        commission_percent: 0,
        commission_base_amount: 0,
        commission_vendor_discount: 0,
        commission_amount: commissionAmount,
        commission_transaction_fee: transactionFeeAmount,
        commission_vendor_net: vendorBalanceAmount,
        seller_shipping_proceeds: 0,
        commission_source: 'vendor',
        adjustment_reason: reason,
        adjustment_actor: admin.id,
        effective_at: new Date().toISOString(),
      },
      overrideAccess: true,
    })

    await deleteCachedByPrefix('admin:payouts:')
    await deleteCachedByPrefix('admin:finance:')
    return NextResponse.json({ doc }, { status: 201 })
  } catch (error) {
    console.error('[admin/vendors/commission-adjustments] POST error:', error)
    return NextResponse.json({ error: 'Failed to post the commission adjustment' }, { status: 500 })
  }
}
