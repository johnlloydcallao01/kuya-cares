/**
 * GET /api/customer/account/summary
 * Auth: customer JWT (self only — userId comes from the token).
 * Backend aggregation endpoint for the settings page (BFF pattern).
 */
import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import configPromise from '@payload-config'
import { authenticateCustomer } from '@/utils/mediaLibrary'
import { sanitizeAccountUser } from '../_shared'

export async function GET(request: NextRequest) {
  try {
    const payload = await getPayload({ config: configPromise })
    const authUser = await authenticateCustomer(payload, request)
    if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    // Perf: one parallel batch instead of 7 sequential finds.
    // authUser is already the depth:0 user doc — reuse it, no re-fetch.
    // Avatar lookup only needs authUser, so kick it off in parallel with the
    // main batch instead of sequentially after (saves ~1 RTT on cold loads).
    const picId =
      authUser.profilePicture && typeof authUser.profilePicture === 'object'
        ? (authUser.profilePicture as any).id
        : (authUser.profilePicture as number | string | null)
    const mediaPromise: Promise<Record<string, any> | null> = picId
      ? payload
          .findByID({ collection: 'media', id: picId, depth: 0, overrideAccess: true })
          .catch(() => null)
      : Promise.resolve(null)
    const [customersRes, prefsRes, methods, devices, events, addressCount] = await Promise.all([
      payload.find({
        collection: 'customers',
        where: { user: { equals: authUser.id } },
        limit: 1,
        depth: 0,
        overrideAccess: true,
      }),
      payload.find({
        collection: 'notification-preferences',
        where: { user: { equals: authUser.id } },
        limit: 1,
        depth: 0,
        overrideAccess: true,
      }),
      payload.find({
        collection: 'payment-methods',
        where: { user: { equals: authUser.id } },
        sort: '-createdAt',
        limit: 20,
        depth: 0,
        overrideAccess: true,
      }),
      payload.find({
        collection: 'devices',
        where: { user: { equals: authUser.id } },
        limit: 20,
        depth: 0,
        overrideAccess: true,
      }),
      payload.find({
        collection: 'user-events',
        where: { user: { equals: authUser.id } },
        sort: '-createdAt',
        limit: 10,
        depth: 0,
        overrideAccess: true,
      }),
      payload
        .count({ collection: 'addresses', where: { user: { equals: authUser.id } }, overrideAccess: true })
        .then((r: any) => r?.totalDocs ?? 0)
        .catch(() => 0),
    ])
    const customer = customersRes.docs[0] as any
    const prefsDocs = prefsRes.docs

    const [orderCount, media] = await Promise.all([
      customer
        ? payload
            .count({ collection: 'orders', where: { customer: { equals: customer.id } }, overrideAccess: true })
            .then((r: any) => r?.totalDocs ?? 0)
            .catch(() => 0)
        : Promise.resolve(0),
      mediaPromise,
    ])

    // Avatar URL: authUser has the media id at depth 0 — resolve just that doc.
    const user: Record<string, any> = media ? { ...authUser, profilePicture: media } : authUser

    return NextResponse.json({
      data: {
        user: sanitizeAccountUser(user as Record<string, any>),
        customer: customer ? { id: customer.id, email: customer.email } : null,
        preferences: prefsDocs[0]
          ? {
              orderEmail: !!prefsDocs[0].orderEmail,
              orderPush: !!prefsDocs[0].orderPush,
              orderSms: !!prefsDocs[0].orderSms,
              promoEmail: !!prefsDocs[0].promoEmail,
              promoPush: !!prefsDocs[0].promoPush,
              promoSms: !!prefsDocs[0].promoSms,
              accountEmail: prefsDocs[0].accountEmail !== false,
              marketingOptIn: !!prefsDocs[0].marketingOptIn,
            }
          : null,
        paymentMethods: (methods.docs || []).map((m: any) => ({
          id: m.id,
          provider: m.provider,
          brand: m.brand,
          last4: m.last4,
          expMonth: m.expMonth,
          expYear: m.expYear,
          nickname: m.nickname,
          isDefault: !!m.isDefault,
        })),
        devices: (devices.docs || []).map((d: any) => ({
          id: d.id,
          platform: d.platform,
          appVersion: d.appVersion,
          createdAt: d.createdAt,
        })),
        recentActivity: (events.docs || []).map((e: any) => ({
          id: e.id,
          eventType: e.eventType,
          createdAt: e.createdAt || e.timestamp,
        })),
        counts: { addresses: addressCount, orders: orderCount },
      },
    })
  } catch (err: any) {
    console.error('[customer/account/summary] GET error:', err)
    return NextResponse.json({ error: err?.message || 'Internal Server Error' }, { status: 500 })
  }
}
