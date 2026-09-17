/**
 * @file apps/cms/src/app/api/admin/users/_lib/countLinked.ts
 * @description Single source of truth for counting records linked to a user.
 * Used by BOTH the dependencies preview endpoint and the DELETE gate so the
 * UI and the backend can never disagree about whether a user owns content.
 *
 * Fail-CLOSED: any count query that throws is reported in `failed` instead of
 * being silently treated as zero. Callers must refuse to decide on deletion
 * when `failed.length > 0`.
 */
import type { Payload } from 'payload'

export type LinkedCountResult = {
  counts: Record<string, number>
  merchants: number
  orders: number
  vendorIds: Array<number | string>
  customerIds: Array<number | string>
  totalDirect: number
  totalLinked: number
  failed: string[]
}

export async function countLinkedRecords(payload: Payload, docId: number | string): Promise<LinkedCountResult> {
  const failed: string[] = []

  const run = async (key: string, fn: () => Promise<number>): Promise<number> => {
    try {
      return await fn()
    } catch (e: any) {
      console.warn(`[admin/users] countLinked "${key}" failed for user ${docId}:`, e?.message)
      failed.push(key)
      return 0
    }
  }

  const count = (key: string, collection: string, field: string) =>
    run(key, async () => {
      const res: any = await payload.find({
        collection: collection as any,
        where: { [field]: { equals: docId } },
        limit: 0,
        depth: 0,
        overrideAccess: true,
      } as any)
      return res.totalDocs ?? 0
    })

  const [vendors, addresses, customers, admins, drivers, wishlists, recentSearches, recentViews, userEvents, userNotifications, posts, emergencyContacts, notificationEventsTriggered, notificationTemplatesCreated, notificationTemplatesUpdated, orderTrackingActor, userEventsTriggered] = await Promise.all([
    count('vendors', 'vendors', 'user'),
    count('addresses', 'addresses', 'user'),
    count('customers', 'customers', 'user'),
    count('admins', 'admins', 'user'),
    count('drivers', 'drivers', 'user'),
    count('wishlists', 'wishlists', 'user'),
    count('recent-searches', 'recent-searches', 'user'),
    count('recent-views', 'recent-views', 'user'),
    count('user-events', 'user-events', 'user'),
    count('user-notifications', 'user-notifications', 'user'),
    count('posts', 'posts', 'author'),
    count('emergency-contacts', 'emergency-contacts', 'user'),
    count('notification-events', 'notification-events', 'triggeredBy'),
    count('notification-templates-created', 'notification-templates', 'createdBy'),
    count('notification-templates-updated', 'notification-templates', 'updatedBy'),
    count('order-tracking', 'order-tracking', 'actor'),
    count('user-events-triggered', 'user-events', 'triggeredBy'),
  ])

  const counts: Record<string, number> = {
    vendors,
    addresses,
    customers,
    admins,
    drivers,
    wishlists,
    recentSearches,
    recentViews,
    userEvents,
    userNotifications,
    posts,
    emergencyContacts,
    notificationEventsTriggered,
    notificationTemplatesCreated,
    notificationTemplatesUpdated,
    orderTrackingActor,
    userEventsTriggered,
  }

  // ---------- Second-order (via vendors/customers) ----------
  let merchants = 0
  let orders = 0
  let vendorIds: Array<number | string> = []
  let customerIds: Array<number | string> = []

  if (vendors > 0) {
    try {
      const vRes: any = await payload.find({
        collection: 'vendors',
        where: { user: { equals: docId } },
        limit: 100,
        depth: 0,
        overrideAccess: true,
        pagination: false,
      } as any)
      vendorIds = (vRes.docs || []).map((d: any) => d.id)
      if (vendorIds.length > 0) {
        merchants = await run('merchants', async () => {
          const mRes: any = await payload.find({
            collection: 'merchants',
            where: { vendor: { in: vendorIds } },
            limit: 0,
            depth: 0,
            overrideAccess: true,
          } as any)
          return mRes.totalDocs ?? 0
        })
      }
    } catch (e: any) {
      console.warn(`[admin/users] countLinked "vendors-ids" failed for user ${docId}:`, e?.message)
      failed.push('vendors-ids')
    }
  }

  if (customers > 0) {
    try {
      const cRes: any = await payload.find({
        collection: 'customers',
        where: { user: { equals: docId } },
        limit: 100,
        depth: 0,
        overrideAccess: true,
        pagination: false,
      } as any)
      customerIds = (cRes.docs || []).map((d: any) => d.id)
      if (customerIds.length > 0) {
        orders = await run('orders', async () => {
          const oRes: any = await payload.find({
            collection: 'orders',
            where: { customer: { in: customerIds } },
            limit: 0,
            depth: 0,
            overrideAccess: true,
          } as any)
          return oRes.totalDocs ?? 0
        })
      }
    } catch (e: any) {
      console.warn(`[admin/users] countLinked "customers-ids" failed for user ${docId}:`, e?.message)
      failed.push('customers-ids')
    }
  }

  const totalDirect = Object.values(counts).reduce((a, b) => a + (b as number), 0)
  const totalLinked = totalDirect + merchants + orders

  return { counts, merchants, orders, vendorIds, customerIds, totalDirect, totalLinked, failed }
}
