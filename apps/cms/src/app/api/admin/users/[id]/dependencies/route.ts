/**
 * @file apps/cms/src/app/api/admin/users/[id]/dependencies/route.ts
 * @description Enterprise read-only dependencies preview for user deletion.
 * Shows exactly what content is tied to a user before delete - powers "View Dependencies" modal.
 * Non-destructive (no deletion). Aggregates direct + second-order links (merchants, orders).
 */

import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import configPromise from '@payload-config'
import { authenticateAdmin } from '@/utils/mediaLibrary'
import { getCached, setCached } from '@encreasl/cache'
import { countLinkedRecords } from '../../_lib/countLinked'

function str(v: unknown, fb = ''): string {
  return typeof v === 'string' ? v : fb
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const payload = await getPayload({ config: configPromise })
    const admin = await authenticateAdmin(payload, request)
    if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const numericId = Number(id)
    const docId: number | string = Number.isFinite(numericId) ? numericId : id

    const cacheKey = `admin:user-dependencies:${admin.id}:${docId}`
    // Delete-gating reads bypass the cache (?fresh=true) so the modal never
    // decides on stale data. The inspection modal still uses the 20s cache.
    const fresh = new URL(request.url).searchParams.get('fresh') === 'true'
    if (!fresh) {
      const cached = await getCached<Record<string, unknown>>(cacheKey)
      if (cached) return NextResponse.json(cached, { headers: { 'X-UserDependencies-Cache': 'HIT' } })
    }

    // Ensure user exists
    let userDoc: Record<string, any>
    try {
      userDoc = (await payload.findByID({ collection: 'users', id: docId as number, depth: 0, overrideAccess: true })) as unknown as Record<string, any>
    } catch (e: any) {
      return NextResponse.json({ error: 'User not found', details: e?.message }, { status: 404 })
    }
    if (!userDoc) return NextResponse.json({ error: 'User not found' }, { status: 404 })

    // ---------- Linked-record counts (single shared counter, fail-closed) ----------
    const linked = await countLinkedRecords(payload, docId)
    if (linked.failed.length > 0) {
      return NextResponse.json({ error: 'Failed to load dependencies', failed: linked.failed }, { status: 500 })
    }
    const counts = linked.counts

    // ---------- Second-order previews (counts already verified by the shared counter) ----------
    const merchantsCount = linked.merchants
    const ordersCount = linked.orders
    const vendorIds = linked.vendorIds
    const customerIds = linked.customerIds
    let merchantsPreview: Array<{ id: number | string; outletName: string; outletCode: string }> = []
    let ordersPreview: Array<{ id: number | string; status: string; total: number | null }> = []

    if (merchantsCount > 0 && vendorIds.length > 0) {
      try {
        const mPrevRes: any = await payload.find({ collection: 'merchants', where: { vendor: { in: vendorIds } }, limit: 5, depth: 0, overrideAccess: true }).catch(() => ({ docs: [] }))
        merchantsPreview = (mPrevRes.docs || []).map((m: any) => ({ id: m.id, outletName: String(m.outletName ?? ''), outletCode: String(m.outletCode ?? '') }))
      } catch {
        merchantsPreview = []
      }
    }

    if (ordersCount > 0 && customerIds.length > 0) {
      try {
        const oPrevRes: any = await payload.find({ collection: 'orders', where: { customer: { in: customerIds } }, limit: 5, depth: 0, sort: '-placed_at', overrideAccess: true }).catch(() => ({ docs: [] }))
        ordersPreview = (oPrevRes.docs || []).map((o: any) => ({ id: o.id, status: String(o.status ?? ''), total: typeof o.total === 'number' ? o.total : null }))
      } catch {
        ordersPreview = []
      }
    }

    // ---------- Previews for high-signal collections (limit 5 each) ----------
    const previews: Record<string, any[]> = {}

    const previewFetchers: Array<Promise<void>> = []

    if (counts.vendors > 0) {
      previewFetchers.push(
        payload
          .find({ collection: 'vendors', where: { user: { equals: docId } }, limit: 5, depth: 0, overrideAccess: true })
          .then((r: any) => {
            previews.vendors = (r.docs || []).map((v: any) => ({ id: v.id, businessName: String(v.businessName ?? ''), verificationStatus: String(v.verificationStatus ?? ''), businessType: String(v.businessType ?? '') }))
          })
          .catch(() => {
            previews.vendors = []
          }),
      )
    }
    if (counts.addresses > 0) {
      previewFetchers.push(
        payload
          .find({ collection: 'addresses', where: { user: { equals: docId } }, limit: 5, depth: 0, overrideAccess: true })
          .then((r: any) => {
            previews.addresses = (r.docs || []).map((a: any) => ({ id: a.id, label: String(a.label ?? a.address_type ?? ''), formatted_address: String(a.formatted_address ?? '').slice(0, 120), locality: String(a.locality ?? ''), address_type: String(a.address_type ?? '') }))
          })
          .catch(() => {
            previews.addresses = []
          }),
      )
    }
    if (counts.wishlists > 0) {
      previewFetchers.push(
        payload
          .find({ collection: 'wishlists', where: { user: { equals: docId } }, limit: 5, depth: 0, overrideAccess: true })
          .then((r: any) => {
            previews.wishlists = (r.docs || []).map((w: any) => ({ id: w.id, merchant: w.merchant ?? null, merchantProduct: w.merchantProduct ?? null }))
          })
          .catch(() => {
            previews.wishlists = []
          }),
      )
    }
    if (counts.posts > 0) {
      previewFetchers.push(
        payload
          .find({ collection: 'posts', where: { author: { equals: docId } }, limit: 5, depth: 0, overrideAccess: true })
          .then((r: any) => {
            previews.posts = (r.docs || []).map((p: any) => ({ id: p.id, title: String(p.title ?? ''), status: String(p._status ?? p.status ?? '') }))
          })
          .catch(() => {
            previews.posts = []
          }),
      )
    }
    if (counts.userEvents > 0) {
      previewFetchers.push(
        payload
          .find({ collection: 'user-events', where: { user: { equals: docId } }, sort: '-timestamp', limit: 5, depth: 0, overrideAccess: true })
          .then((r: any) => {
            previews.userEvents = (r.docs || []).map((e: any) => ({ id: e.id, eventType: String(e.eventType ?? ''), timestamp: String(e.timestamp ?? e.createdAt ?? '') }))
          })
          .catch(() => {
            previews.userEvents = []
          }),
      )
    }
    if (counts.emergencyContacts > 0) {
      previewFetchers.push(
        payload
          .find({ collection: 'emergency-contacts', where: { user: { equals: docId } }, limit: 5, depth: 0, overrideAccess: true })
          .then((r: any) => {
            previews.emergencyContacts = (r.docs || []).map((e: any) => ({ id: e.id, name: String(e.name ?? e.contactName ?? ''), phone: String(e.phone ?? e.contactPhone ?? '') }))
          })
          .catch(() => {
            previews.emergencyContacts = []
          }),
      )
    }
    if (counts.recentSearches > 0) {
      previewFetchers.push(
        payload
          .find({ collection: 'recent-searches', where: { user: { equals: docId } }, limit: 5, depth: 0, overrideAccess: true })
          .then((r: any) => {
            previews.recentSearches = (r.docs || []).map((s: any) => ({ id: s.id, query: String(s.query ?? s.searchQuery ?? s.term ?? '').slice(0, 80) }))
          })
          .catch(() => {
            previews.recentSearches = []
          }),
      )
    }
    if (counts.recentViews > 0) {
      previewFetchers.push(
        payload
          .find({ collection: 'recent-views', where: { user: { equals: docId } }, limit: 5, depth: 0, overrideAccess: true })
          .then((r: any) => {
            previews.recentViews = (r.docs || []).map((v: any) => ({ id: v.id }))
          })
          .catch(() => {
            previews.recentViews = []
          }),
      )
    }
    if (counts.customers > 0) {
      previewFetchers.push(
        payload
          .find({ collection: 'customers', where: { user: { equals: docId } }, limit: 3, depth: 0, overrideAccess: true })
          .then((r: any) => {
            previews.customers = (r.docs || []).map((c: any) => ({ id: c.id }))
          })
          .catch(() => {
            previews.customers = []
          }),
      )
    }
    if (counts.admins > 0) {
      previewFetchers.push(
        payload
          .find({ collection: 'admins', where: { user: { equals: docId } }, limit: 3, depth: 0, overrideAccess: true })
          .then((r: any) => {
            previews.admins = (r.docs || []).map((a: any) => ({ id: a.id }))
          })
          .catch(() => {
            previews.admins = []
          }),
      )
    }
    if (counts.drivers > 0) {
      previewFetchers.push(
        payload
          .find({ collection: 'drivers', where: { user: { equals: docId } }, limit: 3, depth: 0, overrideAccess: true })
          .then((r: any) => {
            previews.drivers = (r.docs || []).map((d: any) => ({ id: d.id, licenseNumber: String(d.licenseNumber ?? '') }))
          })
          .catch(() => {
            previews.drivers = []
          }),
      )
    }

    if (previewFetchers.length > 0) await Promise.all(previewFetchers)

    if (merchantsPreview.length > 0) previews.merchants = merchantsPreview
    if (ordersPreview.length > 0) previews.orders = ordersPreview

    const totalDirect = linked.totalDirect
    const totalLinked = linked.totalLinked

    const responseBody = {
      user: {
        id: userDoc.id,
        email: str(userDoc.email, ''),
        firstName: str(userDoc.firstName, ''),
        lastName: str(userDoc.lastName, ''),
        role: str(userDoc.role, 'customer'),
        isActive: typeof userDoc.isActive === 'boolean' ? userDoc.isActive : true,
      },
      counts: { ...counts, merchants: merchantsCount, orders: ordersCount },
      totalDirect,
      totalLinked,
      previews,
      // hint for UI grouping
      groups: {
        profiles: ['vendors', 'customers', 'admins', 'drivers', 'emergencyContacts'],
        locations: ['addresses', 'merchants'],
        commerce: ['orders', 'wishlists'],
        content: ['posts'],
        activity: ['userEvents', 'userEventsTriggered', 'userNotifications', 'recentSearches', 'recentViews', 'notificationEventsTriggered', 'notificationTemplatesCreated', 'notificationTemplatesUpdated', 'orderTrackingActor'],
      },
    }
    await setCached(cacheKey, responseBody, 20)
    return NextResponse.json(responseBody, { headers: { 'X-UserDependencies-Cache': 'MISS' } })
  } catch (err: any) {
    console.error('[admin/users/[id]/dependencies] GET error:', err)
    return NextResponse.json({ error: err?.message || 'Failed to load dependencies' }, { status: 500 })
  }
}
