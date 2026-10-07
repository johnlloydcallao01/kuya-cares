/**
 * POST /api/customer/account/privacy { action: 'clear_history' | 'export' }
 * - clear_history: deletes own recent-searches, recent-views, wishlists.
 * - export: returns a portable JSON dump of own account data.
 * Auth: customer JWT (self only).
 */
import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import configPromise from '@payload-config'
import { authenticateCustomerOrMember } from '@/utils/mediaLibrary'
import { sanitizeAccountUser } from '../_shared'

const CLEARABLE = ['recent-searches', 'recent-views', 'wishlists'] as const

export async function POST(request: NextRequest) {
  try {
    const payload = await getPayload({ config: configPromise })
    const authUser = await authenticateCustomerOrMember(payload, request)
    if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    let body: Record<string, any>
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
    }

    if (body.action === 'clear_history') {
      const cleared: Record<string, number> = {}
      // Collections run sequentially (isolated failure accounting per
      // collection), but per-doc deletes run in a bounded pool — the old
      // serial loop made worst-case 15000 sequential round-trips.
      for (const collection of CLEARABLE) {
        try {
          const found = await payload.find({
            collection: collection as any,
            where: { user: { equals: Number(authUser.id) } },
            pagination: false,
            limit: 5000,
            depth: 0,
            overrideAccess: true,
          })
          const ids = ((found.docs || []) as any[]).map((d: any) => d.id)
          let n = 0
          const POOL = 10
          for (let i = 0; i < ids.length; i += POOL) {
            const results = await Promise.allSettled(
              ids.slice(i, i + POOL).map((id) =>
                payload.delete({ collection: collection as any, id, overrideAccess: true }),
              ),
            )
            n += results.filter((r) => r.status === 'fulfilled').length
          }
          cleared[collection] = n
        } catch {
          cleared[collection] = 0
        }
      }
      return NextResponse.json({ data: { cleared } })
    }

    if (body.action === 'export') {
      // Independent reads — one batch, not six sequential round-trips.
      const [user, { docs: customers }, addresses, methods, prefs] = await Promise.all([
        payload.findByID({
          collection: 'users',
          id: Number(authUser.id),
          depth: 1,
          overrideAccess: true,
        }),
        payload.find({
          collection: 'customers',
          where: { user: { equals: Number(authUser.id) } },
          limit: 1,
          depth: 0,
          overrideAccess: true,
        }),
        payload.find({
          collection: 'addresses',
          where: { user: { equals: Number(authUser.id) } },
          pagination: false,
          limit: 500,
          depth: 0,
          overrideAccess: true,
        }),
        payload.find({
          collection: 'payment-methods',
          where: { user: { equals: Number(authUser.id) } },
          pagination: false,
          limit: 50,
          depth: 0,
          overrideAccess: true,
        }),
        payload.find({
          collection: 'notification-preferences',
          where: { user: { equals: Number(authUser.id) } },
          limit: 1,
          depth: 0,
          overrideAccess: true,
        }),
      ])
      return NextResponse.json({
        data: {
          exportedAt: new Date().toISOString(),
          user: sanitizeAccountUser(user as Record<string, any>),
          customer: customers[0] ? { id: (customers[0] as any).id } : null,
          addresses: (addresses.docs || []).map((a: any) => ({
            id: a.id,
            formatted_address: a.formatted_address,
            label: a.label,
            address_type: a.address_type,
            locality: a.locality,
            createdAt: a.createdAt,
          })),
          paymentMethods: (methods.docs || []).map((m: any) => ({
            id: m.id,
            provider: m.provider,
            brand: m.brand,
            last4: m.last4,
            nickname: m.nickname,
          })),
          preferences: prefs.docs?.[0]
            ? {
                marketingOptIn: !!(prefs.docs[0] as any).marketingOptIn,
                promoEmail: (prefs.docs[0] as any).promoEmail !== false,
              }
            : null,
        },
      })
    }

    return NextResponse.json({ error: "action must be 'clear_history' or 'export'" }, { status: 400 })
  } catch (err: any) {
    console.error('[customer/account/privacy] POST error:', err)
    return NextResponse.json({ error: err?.message || 'Internal Server Error' }, { status: 500 })
  }
}
