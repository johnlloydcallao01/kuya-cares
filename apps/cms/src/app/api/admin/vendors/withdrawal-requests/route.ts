import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import configPromise from '@payload-config'
import { authenticateAdmin } from '@/utils/mediaLibrary'
import { listWithdrawalRows, type WithdrawalStatus } from '@/utils/withdrawalRequests'
import { withAdminRequestSlot } from '@/utils/adminRequestGate'

const statuses = new Set<WithdrawalStatus>(['pending', 'approved', 'paid', 'rejected', 'cancelled'])

export async function GET(request: NextRequest) {
  return withAdminRequestSlot(async () => {
    try {
      const payload = await getPayload({ config: configPromise })
      const admin = await authenticateAdmin(payload, request)
      if (!admin) return NextResponse.json({ error: 'Unauthorized: admin authentication required' }, { status: 401 })

      const params = request.nextUrl.searchParams
      const rawStatus = params.get('status')
      if (rawStatus && !statuses.has(rawStatus as WithdrawalStatus)) {
        return NextResponse.json({ error: 'Invalid status filter' }, { status: 400 })
      }
      const rawVendorId = params.get('vendorId')
      const vendorId = rawVendorId == null ? undefined : Number(rawVendorId)
      if (vendorId != null && (!Number.isSafeInteger(vendorId) || vendorId <= 0)) {
        return NextResponse.json({ error: 'vendorId must be a positive integer' }, { status: 400 })
      }
      const rawLimit = Number(params.get('limit') ?? 25)
      const rawOffset = Number(params.get('offset') ?? 0)
      if (!Number.isSafeInteger(rawLimit) || rawLimit < 1 || !Number.isSafeInteger(rawOffset) || rawOffset < 0) {
        return NextResponse.json({ error: 'limit must be at least 1 and offset must be a non-negative whole number' }, { status: 400 })
      }
      const limit = Math.min(100, rawLimit)
      const offset = rawOffset
      const requests = await listWithdrawalRows(payload.db.drizzle as any, {
        vendorId,
        status: rawStatus as WithdrawalStatus | undefined,
        limit,
        offset,
      })
      return NextResponse.json({ requests, pagination: { limit, offset } })
    } catch (error) {
      console.error('[admin/vendors/withdrawal-requests] GET error:', error)
      return NextResponse.json({ error: 'Failed to load withdrawal requests' }, { status: 500 })
    }
  })
}
