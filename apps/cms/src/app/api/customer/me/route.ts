import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import configPromise from '@payload-config'
import { authenticateCustomer } from '@/utils/mediaLibrary'

/**
 * GET /api/customer/me
 * Self lookup for client `getCurrentCustomerId()` callers (they already
 * hit this path expecting `{ customerId }`).
 * Auth: customer JWT via `Authorization: JWT|Bearer <token>`.
 * 401 when missing/invalid — never 404, so clients can distinguish
 * "route exists, not signed in" from network errors.
 */
export async function GET(request: NextRequest) {
  try {
    const payload = await getPayload({ config: configPromise })
    const authUser = await authenticateCustomer(payload, request)
    if (!authUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { docs } = await payload.find({
      collection: 'customers',
      where: { user: { equals: Number(authUser.id) } },
      limit: 1,
      depth: 0,
      overrideAccess: true,
    })
    const customer = docs[0] as any
    if (!customer) {
      return NextResponse.json({ error: 'Customer not found', code: 'NO_CUSTOMER' }, { status: 404 })
    }

    return NextResponse.json({ customerId: String(customer.id) })
  } catch (err: any) {
    console.error('[customer/me] GET error:', err)
    return NextResponse.json({ error: err?.message || 'Internal Server Error' }, { status: 500 })
  }
}
