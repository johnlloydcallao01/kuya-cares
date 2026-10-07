/**
 * GET /api/customer/account/payment-methods — own vaulted methods.
 * POST /api/customer/account/payment-methods
 *   { providerMethodId, brand?, last4?, expMonth?, expYear?, nickname?, isDefault? }
 *   — vault a gateway reference (never PAN; enforced by collection hook).
 * Auth: customer JWT (self only).
 */
import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import configPromise from '@payload-config'
import { authenticateCustomerOrMember } from '@/utils/mediaLibrary'

function shape(m: any) {
  return {
    id: m.id,
    provider: m.provider,
    brand: m.brand,
    last4: m.last4,
    expMonth: m.expMonth,
    expYear: m.expYear,
    nickname: m.nickname,
    isDefault: !!m.isDefault,
    createdAt: m.createdAt,
  }
}

export async function GET(request: NextRequest) {
  try {
    const payload = await getPayload({ config: configPromise })
    const authUser = await authenticateCustomerOrMember(payload, request)
    if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const res = await payload.find({
      collection: 'payment-methods',
      where: { user: { equals: Number(authUser.id) } },
      sort: '-createdAt',
      limit: 20,
      depth: 0,
      overrideAccess: true,
    })
    return NextResponse.json({ data: (res.docs || []).map(shape) })
  } catch (err: any) {
    console.error('[customer/account/payment-methods] GET error:', err)
    return NextResponse.json({ error: err?.message || 'Internal Server Error' }, { status: 500 })
  }
}

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

    const providerMethodId = String(body.providerMethodId || '').trim()
    if (!providerMethodId) {
      return NextResponse.json({ error: 'providerMethodId is required' }, { status: 400 })
    }

    const { docs: dup } = await payload.find({
      collection: 'payment-methods',
      where: {
        and: [{ user: { equals: Number(authUser.id) } }, { providerMethodId: { equals: providerMethodId } }],
      },
      limit: 1,
      depth: 0,
      overrideAccess: true,
    })
    if (dup[0]) {
      return NextResponse.json({ error: 'Payment method already saved', code: 'ALREADY_SAVED' }, { status: 409 })
    }

    if (body.isDefault) {
      await payload.update({
        collection: 'payment-methods',
        where: { user: { equals: Number(authUser.id) } },
        data: { isDefault: false },
        overrideAccess: true,
      })
    }

    const created = (await payload.create({
      collection: 'payment-methods',
      data: {
        user: Number(authUser.id),
        provider: body.provider || 'paymongo',
        providerMethodId,
        brand: body.brand || undefined,
        last4: body.last4 || undefined,
        expMonth: body.expMonth ?? undefined,
        expYear: body.expYear ?? undefined,
        nickname: body.nickname || undefined,
        isDefault: !!body.isDefault,
      },
      overrideAccess: true,
    })) as any

    return NextResponse.json({ data: shape(created) }, { status: 201 })
  } catch (err: any) {
    console.error('[customer/account/payment-methods] POST error:', err)
    return NextResponse.json({ error: err?.message || 'Internal Server Error' }, { status: 500 })
  }
}
