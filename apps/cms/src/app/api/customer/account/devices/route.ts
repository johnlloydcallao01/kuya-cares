/**
 * POST /api/customer/account/devices { pushToken, platform?, appVersion? }
 *   — upsert token for self.
 * DELETE /api/customer/account/devices { pushToken } — unregister own token.
 * Auth: customer JWT (self only).
 */
import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import configPromise from '@payload-config'
import { authenticateCustomer } from '@/utils/mediaLibrary'

const PLATFORMS = ['ios', 'android', 'web']

export async function POST(request: NextRequest) {
  try {
    const payload = await getPayload({ config: configPromise })
    const authUser = await authenticateCustomer(payload, request)
    if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    let body: Record<string, any>
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
    }

    const pushToken = String(body.pushToken || '').trim()
    if (!pushToken) return NextResponse.json({ error: 'pushToken is required' }, { status: 400 })
    const platform = (String(body.platform || 'android') as 'ios' | 'android' | 'web')
    if (!PLATFORMS.includes(platform)) {
      return NextResponse.json({ error: `platform must be one of ${PLATFORMS.join(',')}` }, { status: 400 })
    }

    const { docs } = await payload.find({
      collection: 'devices',
      where: { pushToken: { equals: pushToken } },
      limit: 1,
      depth: 0,
      overrideAccess: true,
    })
    const existing = docs[0] as any
    if (existing) {
      if (String(existing.user?.id ?? existing.user) !== String(authUser.id)) {
        return NextResponse.json({ error: 'Token belongs to another user', code: 'FORBIDDEN' }, { status: 403 })
      }
      const updated = await payload.update({
        collection: 'devices',
        id: existing.id,
        data: { platform, appVersion: body.appVersion || undefined } as any,
        overrideAccess: true,
      })
      return NextResponse.json({ data: { id: (updated as any).id, created: false } })
    }

    const created = await payload.create({
      collection: 'devices',
      data: {
        user: Number(authUser.id),
        pushToken,
        platform,
        appVersion: body.appVersion || undefined,
      },
      overrideAccess: true,
    })
    return NextResponse.json({ data: { id: (created as any).id, created: true } }, { status: 201 })
  } catch (err: any) {
    console.error('[customer/account/devices] POST error:', err)
    return NextResponse.json({ error: err?.message || 'Internal Server Error' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const payload = await getPayload({ config: configPromise })
    const authUser = await authenticateCustomer(payload, request)
    if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    let body: Record<string, any>
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
    }
    const pushToken = String(body.pushToken || '').trim()
    if (!pushToken) return NextResponse.json({ error: 'pushToken is required' }, { status: 400 })

    const { docs } = await payload.find({
      collection: 'devices',
      where: { pushToken: { equals: pushToken } },
      limit: 1,
      depth: 0,
      overrideAccess: true,
    })
    const existing = docs[0] as any
    if (!existing) return NextResponse.json({ data: { deleted: false } })
    if (String(existing.user?.id ?? existing.user) !== String(authUser.id)) {
      return NextResponse.json({ error: 'Token belongs to another user', code: 'FORBIDDEN' }, { status: 403 })
    }
    await payload.delete({ collection: 'devices', id: existing.id, overrideAccess: true })
    return NextResponse.json({ data: { deleted: true } })
  } catch (err: any) {
    console.error('[customer/account/devices] DELETE error:', err)
    return NextResponse.json({ error: err?.message || 'Internal Server Error' }, { status: 500 })
  }
}
