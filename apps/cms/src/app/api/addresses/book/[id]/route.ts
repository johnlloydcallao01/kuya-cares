import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import configPromise from '@payload-config'

function relId(v: unknown): string | null {
  if (v == null) return null
  if (typeof v === 'string' || typeof v === 'number') return String(v)
  if (typeof v === 'object' && v !== null && 'id' in (v as any)) return String((v as any).id)
  return null
}

const PATCH_FIELDS = [
  'formatted_address',
  'google_place_id',
  'latitude',
  'longitude',
  'street',
  'floor_unit_room',
  'delivery_instructions',
  'label',
  'barangay',
  'locality',
  'administrative_area_level_2',
  'administrative_area_level_1',
  'country',
  'postal_code',
  'address_type',
  'is_default',
] as const

async function resolveCustomer(payload: any, userId: string) {
  const numericUser = Number(userId)
  const { docs } = await payload.find({
    collection: 'customers',
    where: { user: { equals: Number.isFinite(numericUser) ? numericUser : userId } },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })
  return docs[0] ?? null
}

async function ownedAddress(payload: any, id: string, userId: string) {
  const customer = await resolveCustomer(payload, userId)
  if (!customer) return { error: 'Customer not found for user', code: 'NO_CUSTOMER', status: 404 } as const
  let doc: any = null
  try {
    doc = await payload.findByID({ collection: 'addresses', id: Number(id) || id, depth: 0, overrideAccess: true })
  } catch {
    return { error: 'Address not found', code: 'NOT_FOUND', status: 404 } as const
  }
  if (relId(doc.user) !== relId((customer as any).user)) {
    return { error: 'Address does not belong to user', code: 'FORBIDDEN', status: 403 } as const
  }
  return { customer, doc } as const
}

/**
 * PATCH /api/addresses/book/:id { userId, ...fields }
 * Ownership-verified update. Whitelisted fields only.
 */
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await request.json().catch(() => ({}))
    const { userId, ...input } = body as Record<string, any>
    if (!userId) {
      return NextResponse.json({ error: 'userId is required' }, { status: 400 })
    }

    const payload = await getPayload({ config: configPromise })
    const owned = await ownedAddress(payload, id, String(userId))
    if ('error' in owned) {
      return NextResponse.json({ error: owned.error, code: owned.code }, { status: owned.status })
    }

    const data: Record<string, any> = {}
    for (const f of PATCH_FIELDS) {
      if (input[f] !== undefined) data[f] = input[f]
    }
    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: 'No updatable fields provided' }, { status: 400 })
    }

    if (data.is_default) {
      await payload.update({
        collection: 'addresses',
        where: {
          and: [{ user: { equals: relId(owned.doc.user) } }, { is_default: { equals: true } }],
        },
        data: { is_default: false },
        overrideAccess: true,
      })
    }

    const updated = await payload.update({
      collection: 'addresses',
      id: owned.doc.id,
      data,
      overrideAccess: true,
    })
    return NextResponse.json({ data: { address: updated } })
  } catch (err: any) {
    console.error('[addresses/book PATCH] Error:', err)
    return NextResponse.json({ error: err?.message || 'Failed to update address' }, { status: 500 })
  }
}

/**
 * DELETE /api/addresses/book/:id?userId=
 * Ownership-verified delete. If it was the active address, clears
 * customers.activeAddress first (Foodpanda-style graceful fallback).
 */
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const userId = new URL(request.url).searchParams.get('userId')
    if (!userId) {
      return NextResponse.json({ error: 'userId is required' }, { status: 400 })
    }

    const payload = await getPayload({ config: configPromise })
    const owned = await ownedAddress(payload, id, userId)
    if ('error' in owned) {
      return NextResponse.json({ error: owned.error, code: owned.code }, { status: owned.status })
    }

    let clearedActive = false
    if (relId((owned.customer as any).activeAddress) === String(owned.doc.id)) {
      await payload.update({
        collection: 'customers',
        id: owned.customer.id,
        data: { activeAddress: null },
        overrideAccess: true,
      })
      clearedActive = true
    }

    await payload.delete({ collection: 'addresses', id: owned.doc.id, overrideAccess: true })
    return NextResponse.json({ data: { deleted: true, clearedActive } })
  } catch (err: any) {
    console.error('[addresses/book DELETE] Error:', err)
    return NextResponse.json({ error: err?.message || 'Failed to delete address' }, { status: 500 })
  }
}
