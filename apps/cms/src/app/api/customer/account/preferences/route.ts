/**
 * GET /api/customer/account/preferences — get-or-create (defaults)
 * PUT /api/customer/account/preferences { ...toggles } — update + mirror
 * marketingOptIn onto users. Auth: customer JWT (self only).
 */
import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import configPromise from '@payload-config'
import { authenticateCustomerOrMember } from '@/utils/mediaLibrary'

const TOGGLES = [
  'orderEmail',
  'orderPush',
  'orderSms',
  'promoEmail',
  'promoPush',
  'promoSms',
  'accountEmail',
  'marketingOptIn',
] as const

function shape(d: any) {
  return {
    orderEmail: d.orderEmail !== false,
    orderPush: d.orderPush !== false,
    orderSms: d.orderSms !== false,
    promoEmail: d.promoEmail !== false,
    promoPush: d.promoPush !== false,
    promoSms: d.promoSms !== false,
    accountEmail: d.accountEmail !== false,
    marketingOptIn: !!d.marketingOptIn,
  }
}

async function getOrCreate(payload: any, userId: number) {
  const { docs } = await payload.find({
    collection: 'notification-preferences',
    where: { user: { equals: userId } },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })
  if (docs[0]) return docs[0]
  const user = await payload.findByID({ collection: 'users', id: userId, depth: 0, overrideAccess: true })
  return payload.create({
    collection: 'notification-preferences',
    data: { user: userId, marketingOptIn: (user as any).marketingOptIn !== false },
    overrideAccess: true,
  })
}

export async function GET(request: NextRequest) {
  try {
    const payload = await getPayload({ config: configPromise })
    const authUser = await authenticateCustomerOrMember(payload, request)
    if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const prefs = await getOrCreate(payload, Number(authUser.id))
    return NextResponse.json({ data: shape(prefs) })
  } catch (err: any) {
    console.error('[customer/account/preferences] GET error:', err)
    return NextResponse.json({ error: err?.message || 'Internal Server Error' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
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

    const data: Record<string, boolean> = {}
    for (const key of TOGGLES) {
      if (body[key] !== undefined) {
        if (typeof body[key] !== 'boolean') {
          return NextResponse.json({ error: `${key} must be boolean` }, { status: 400 })
        }
        data[key] = body[key]
      }
    }
    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: 'No preferences provided' }, { status: 400 })
    }

    const prefs = await getOrCreate(payload, Number(authUser.id))
    const updated = await payload.update({
      collection: 'notification-preferences',
      id: prefs.id,
      data,
      overrideAccess: true,
    })

    if (data.marketingOptIn !== undefined) {
      await payload
        .update({
          collection: 'users',
          id: Number(authUser.id),
          data: { marketingOptIn: data.marketingOptIn },
          overrideAccess: true,
          depth: 0,
        })
        .catch(() => {})
    }

    return NextResponse.json({ data: shape(updated) })
  } catch (err: any) {
    console.error('[customer/account/preferences] PUT error:', err)
    return NextResponse.json({ error: err?.message || 'Internal Server Error' }, { status: 500 })
  }
}
