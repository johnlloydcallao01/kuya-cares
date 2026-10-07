import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import configPromise from '@payload-config'
import { authenticateCustomerOrMember } from '@/utils/mediaLibrary'

/**
 * POST /api/customers/ensure
 * Idempotent find-or-create for the companion customers row (Option A).
 * Unified members keep a single users row (role member) PLUS one customers
 * row so existing food commerce (cart/checkout/orders/reviews) works
 * unchanged — no schema change to Orders/CartItems/Reviews.
 *
 * Auth: customer OR member JWT via `Authorization: JWT|Bearer <token>`.
 * Called once per web session (login + session restore), best-effort.
 *
 * Returns `{ customerId, created }`. Unique-constraint safe: on a
 * duplicate-`user` race the existing row is re-found and returned.
 */
export async function POST(request: NextRequest) {
  try {
    const payload = await getPayload({ config: configPromise })
    const authUser = await authenticateCustomerOrMember(payload, request)
    if (!authUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = authUser.id

    const findExisting = async () => {
      const { docs } = await payload.find({
        collection: 'customers',
        where: { user: { equals: userId } },
        limit: 1,
        depth: 0,
        overrideAccess: true,
      })
      return (docs[0] as unknown as Record<string, unknown> | undefined) ?? null
    }

    const existing = await findExisting()
    if (existing) {
      return NextResponse.json({ customerId: String(existing.id), created: false })
    }

    try {
      const created = await payload.create({
        collection: 'customers',
        data: {
          user: userId,
          enrollmentDate: new Date().toISOString(),
          currentLevel: 'beginner',
        },
        overrideAccess: true,
        depth: 0,
      })
      return NextResponse.json({ customerId: String(created.id), created: true })
    } catch (createError) {
      // Unique-constraint race (hook or concurrent ensure created it first):
      // re-find and return the winner instead of 500ing.
      console.error('[customers/ensure] create race, re-finding:', createError)
      const winner = await findExisting().catch(() => null)
      if (winner) {
        return NextResponse.json({ customerId: String(winner.id), created: false })
      }
      throw createError
    }
  } catch (err: unknown) {
    console.error('[customers/ensure] POST error:', err)
    const message = err instanceof Error ? err.message : 'Internal Server Error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
