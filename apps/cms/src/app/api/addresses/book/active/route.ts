import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import configPromise from '@payload-config'

function relId(v: unknown): string | null {
  if (v == null) return null
  if (typeof v === 'string' || typeof v === 'number') return String(v)
  if (typeof v === 'object' && v !== null && 'id' in (v as any)) return String((v as any).id)
  return null
}

/**
 * POST /api/addresses/book/active { userId, addressId }
 * Ownership-verified active-address switch (customers.activeAddress is
 * the source of truth for checkout/delivery — not addresses.is_default).
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}))
    const { userId, addressId } = body as { userId?: unknown; addressId?: unknown }
    if (!userId) {
      return NextResponse.json({ error: 'userId is required' }, { status: 400 })
    }
    if (addressId === undefined || addressId === null || String(addressId) === '') {
      return NextResponse.json({ error: 'addressId is required' }, { status: 400 })
    }

    const payload = await getPayload({ config: configPromise })
    const numericUser = Number(userId)
    const { docs } = await payload.find({
      collection: 'customers',
      where: { user: { equals: Number.isFinite(numericUser) ? numericUser : userId } },
      limit: 1,
      depth: 0,
      overrideAccess: true,
    })
    const customer = docs[0]
    if (!customer) {
      return NextResponse.json({ error: 'Customer not found for user', code: 'NO_CUSTOMER' }, { status: 404 })
    }

    let address: any = null
    try {
      address = await payload.findByID({
        collection: 'addresses',
        id: Number(addressId) || (addressId as string),
        depth: 0,
        overrideAccess: true,
      })
    } catch {
      return NextResponse.json({ error: 'Address not found', code: 'NOT_FOUND' }, { status: 404 })
    }
    if (relId(address.user) !== relId((customer as any).user)) {
      return NextResponse.json({ error: 'Address does not belong to user', code: 'FORBIDDEN' }, { status: 403 })
    }

    await payload.update({
      collection: 'customers',
      id: customer.id,
      data: { activeAddress: address.id },
      overrideAccess: true,
    })
    return NextResponse.json({ data: { activeAddressId: String(address.id) } })
  } catch (err: any) {
    console.error('[addresses/book/active] Error:', err)
    return NextResponse.json({ error: err?.message || 'Failed to set active address' }, { status: 500 })
  }
}
