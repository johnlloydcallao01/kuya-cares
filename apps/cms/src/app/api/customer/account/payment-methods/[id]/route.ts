/**
 * DELETE /api/customer/account/payment-methods/:id — remove own method.
 * If it was default, promotes the most recent remaining method.
 * Auth: customer JWT (self only).
 */
import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import configPromise from '@payload-config'
import { authenticateCustomer } from '@/utils/mediaLibrary'

function relId(v: unknown): string | null {
  if (v == null) return null
  if (typeof v === 'string' || typeof v === 'number') return String(v)
  if (typeof v === 'object' && v !== null && 'id' in (v as any)) return String((v as any).id)
  return null
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const payload = await getPayload({ config: configPromise })
    const authUser = await authenticateCustomer(payload, request)
    if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await params
    let doc: any = null
    try {
      doc = await payload.findByID({
        collection: 'payment-methods',
        id: Number(id) || id,
        depth: 0,
        overrideAccess: true,
      })
    } catch {
      return NextResponse.json({ error: 'Payment method not found', code: 'NOT_FOUND' }, { status: 404 })
    }
    if (relId(doc.user) !== String(authUser.id)) {
      return NextResponse.json({ error: 'Forbidden', code: 'FORBIDDEN' }, { status: 403 })
    }

    await payload.delete({ collection: 'payment-methods', id: doc.id, overrideAccess: true })

    let promotedId: string | null = null
    if (doc.isDefault) {
      const { docs } = await payload.find({
        collection: 'payment-methods',
        where: { user: { equals: Number(authUser.id) } },
        sort: '-createdAt',
        limit: 1,
        depth: 0,
        overrideAccess: true,
      })
      if (docs[0]) {
        await payload.update({
          collection: 'payment-methods',
          id: docs[0].id,
          data: { isDefault: true },
          overrideAccess: true,
        })
        promotedId = String(docs[0].id)
      }
    }

    return NextResponse.json({ data: { deleted: true, promotedId } })
  } catch (err: any) {
    console.error('[customer/account/payment-methods] DELETE error:', err)
    return NextResponse.json({ error: err?.message || 'Internal Server Error' }, { status: 500 })
  }
}
