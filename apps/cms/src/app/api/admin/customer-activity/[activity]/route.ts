import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import configPromise from '@payload-config'
import { authenticateAdmin } from '@/utils/mediaLibrary'
import { getCached, setCached } from '@encreasl/cache'

type ActivityKey = 'wishlists' | 'carts' | 'searches' | 'views'

const CONFIG: Record<ActivityKey, { collection: string; title: string; searchFields: string[]; defaultSort: string }> = {
  wishlists: { collection: 'wishlists', title: 'Wishlists', searchFields: ['user.email', 'merchant.name', 'merchant.outletName', 'merchantProduct.name'], defaultSort: '-createdAt' },
  carts: { collection: 'cart-items', title: 'Abandoned carts', searchFields: ['customer.email', 'merchant.name', 'merchant.outletName', 'product.name', 'merchantProduct.name'], defaultSort: '-updatedAt' },
  searches: { collection: 'recent-searches', title: 'Recent searches', searchFields: ['query', 'normalizedQuery', 'user.email'], defaultSort: '-updatedAt' },
  views: { collection: 'recent-views', title: 'Recently viewed', searchFields: ['user.email', 'merchant.name', 'merchant.outletName', 'merchantProduct.name', 'product.name'], defaultSort: '-lastViewedAt' },
}

function relation(value: unknown): Record<string, any> | null {
  return value && typeof value === 'object' ? value as Record<string, any> : null
}
function text(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback
}
function number(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}
function media(value: unknown): { id: number; url: string | null; filename: string | null } | null {
  const item = relation(value)
  if (!item) return null
  const id = Number(item.id)
  if (Number.isNaN(id)) return null
  return {
    id,
    url: text(item.cloudinaryURL || item.url) || null,
    filename: text(item.filename) || null,
  }
}
function customerFrom(raw: Record<string, any>): Record<string, any> | null {
  const direct = relation(raw.customer) || relation(raw.user)
  const user = relation(direct?.user) || (raw.user && relation(raw.user))
  if (!direct && !user) return null
  return {
    id: direct?.id ?? user?.id ?? null,
    email: text(direct?.email || user?.email),
    firstName: text(direct?.firstName || user?.firstName),
    lastName: text(direct?.lastName || user?.lastName),
    profilePicture: media(user?.profilePicture || direct?.profilePicture),
  }
}
function label(value: unknown, fallback = 'Unknown'): string {
  const item = relation(value)
  if (!item) return typeof value === 'string' || typeof value === 'number' ? String(value) : fallback
  return text(item.name || item.outletName || item.businessName || item.title || item.email, fallback)
}
function sanitize(raw: Record<string, any>, activity: ActivityKey): Record<string, any> {
  const merchant = raw.merchant
  const product = raw.product || raw.merchantProduct
  return {
    id: raw.id,
    activity,
    customer: customerFrom(raw),
    merchant: label(merchant),
    product: label(product),
    itemType: text(raw.itemType, activity === 'views' ? 'merchant_product' : 'merchant'),
    query: text(raw.query),
    scope: text(raw.scope),
    source: text(raw.source, 'unknown'),
    status: text(raw.status, activity === 'carts' ? 'abandoned' : ''),
    quantity: number(raw.quantity, 0),
    subtotal: number(raw.subtotal, 0),
    priceAtAdd: number(raw.priceAtAdd, 0),
    frequency: number(raw.frequency, 0),
    viewCount: number(raw.viewCount, 0),
    lastViewedAt: raw.lastViewedAt ? String(raw.lastViewedAt) : null,
    updatedAt: raw.updatedAt ? String(raw.updatedAt) : null,
    createdAt: raw.createdAt ? String(raw.createdAt) : null,
  }
}
function parseActivity(value: string): ActivityKey | null {
  return Object.prototype.hasOwnProperty.call(CONFIG, value) ? value as ActivityKey : null
}

export async function GET(request: NextRequest, context: { params: Promise<{ activity: string }> }) {
  try {
    const payload = await getPayload({ config: configPromise })
    const admin = await authenticateAdmin(payload, request)
    if (!admin) return NextResponse.json({ error: 'Unauthorized: admin authentication required' }, { status: 401 })

    const { activity: rawActivity } = await context.params
    const activity = parseActivity(rawActivity)
    if (!activity) return NextResponse.json({ error: 'Unknown customer activity type' }, { status: 404 })
    const definition = CONFIG[activity]
    const { searchParams } = new URL(request.url)
    const cacheQuery = Array.from(searchParams.entries())
      .filter(([key]) => key !== '_t')
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
      .join('&') || 'page=1&limit=20'
    const cacheKey = `admin:customer-activity:${activity}:${admin.id}:${cacheQuery}`
    const cached = await getCached<Record<string, unknown>>(cacheKey)
    if (cached) return NextResponse.json(cached, { headers: { 'X-CustomerActivity-Cache': 'HIT' } })

    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10) || 1)
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '10', 10) || 10))
    const search = searchParams.get('search')?.trim() || ''
    const requestedSort = searchParams.get('sort') || definition.defaultSort
    const sort = /^-?(createdAt|updatedAt|lastViewedAt|frequency|viewCount|subtotal)$/.test(requestedSort) ? requestedSort : definition.defaultSort
    const and: Record<string, any>[] = []

    if (activity === 'carts') and.push({ status: { equals: 'abandoned' } })
    if (search) and.push({ or: definition.searchFields.map((field) => ({ [field]: { contains: search } })) })
    const result = await payload.find({
      collection: definition.collection as any,
      where: and.length ? { and } : undefined,
      page,
      limit,
      sort,
      depth: 3,
      overrideAccess: true,
    })
    const docs = (result.docs as unknown as Record<string, any>[]).map((doc) => sanitize(doc, activity))
    const responseBody = {
      docs,
      pagination: { page: result.page, limit: result.limit, totalDocs: result.totalDocs, totalPages: result.totalPages, hasNextPage: result.hasNextPage, hasPrevPage: result.hasPrevPage },
      stats: { total: result.totalDocs, returned: docs.length },
      meta: { activity, title: definition.title, search, sort, generatedAt: new Date().toISOString() },
    }
    await setCached(cacheKey, responseBody, 20)
    return NextResponse.json(responseBody, { headers: { 'X-CustomerActivity-Cache': 'MISS' } })
  } catch (error: any) {
    console.error('[admin/customer-activity] GET error:', error)
    return NextResponse.json({ error: error?.message || 'Failed to load customer activity' }, { status: 500 })
  }
}
