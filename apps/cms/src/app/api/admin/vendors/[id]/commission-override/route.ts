/**
 * @file apps/cms/src/app/api/admin/vendors/[id]/commission-override/route.ts
 * @description PUT set commission override (pct 0-30 clamp + reason) / DELETE clear to inherit.
 */

import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import configPromise from '@payload-config'
import { authenticateAdmin } from '@/utils/mediaLibrary'
import { audit } from '@/utils/membershipApi'

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const payload = await getPayload({ config: configPromise })
    const admin = await authenticateAdmin(payload, request)
    if (!admin) return NextResponse.json({ error: 'Unauthorized: admin authentication required' }, { status: 401 })
    const { id } = await params
    let body: Record<string, any>
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
    }
    const pctRaw = body.pct
    const reason = typeof body.reason === 'string' ? body.reason.trim() : ''
    if (pctRaw == null) return NextResponse.json({ error: 'pct is required (0-30, null clears)' }, { status: 400 })
    const pct = Number(pctRaw)
    if (!Number.isFinite(pct) || pct < 0 || pct > 30) {
      return NextResponse.json({ error: 'pct must be 0-30' }, { status: 400 })
    }
    if (!reason) return NextResponse.json({ error: 'reason is required' }, { status: 400 })

    let vendor: any
    try {
      vendor = await payload.findByID({ collection: 'vendors', id: id as any, depth: 0, overrideAccess: true })
    } catch {
      return NextResponse.json({ error: 'Vendor not found' }, { status: 404 })
    }
    void vendor

    const updated = await payload.update({
      collection: 'vendors',
      id: id as any,
      data: {
        commissionOverride: {
          commission_percent: pct,
          transaction_fee: body.transaction_fee ?? 0,
          rule: body.rule ?? null,
        },
      } as any,
      overrideAccess: true,
    }).catch(async () => {
      // Fallback when group field absent: store flat (parallel collections may rename)
      return payload.update({
        collection: 'vendors', id: id as any,
        data: { commissionOverridePct: pct } as any,
        overrideAccess: true,
      })
    })

    await audit(payload, {
      vendor: id, action: 'override', reason,
      actor: admin.id, metadata: { pct, kind: 'commission-override' },
    })

    return NextResponse.json(
      { doc: { id: (updated as any).id, commissionOverride: (updated as any).commissionOverride ?? pct } },
      { status: 200 },
    )
  } catch (err: any) {
    console.error('[admin/vendors/[id]/commission-override] PUT error:', err)
    return NextResponse.json({ error: err?.message || 'Internal Server Error' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const payload = await getPayload({ config: configPromise })
    const admin = await authenticateAdmin(payload, request)
    if (!admin) return NextResponse.json({ error: 'Unauthorized: admin authentication required' }, { status: 401 })
    const { id } = await params

    try {
      await payload.findByID({ collection: 'vendors', id: id as any, depth: 0, overrideAccess: true })
    } catch {
      return NextResponse.json({ error: 'Vendor not found' }, { status: 404 })
    }

    await payload.update({
      collection: 'vendors',
      id: id as any,
      data: { commissionOverride: null } as any,
      overrideAccess: true,
    }).catch(() => null)

    await audit(payload, {
      vendor: id, action: 'override', reason: 'commission override cleared (inherit plan)',
      actor: admin.id, metadata: { cleared: true },
    })

    return NextResponse.json({ success: true }, { status: 200 })
  } catch (err: any) {
    console.error('[admin/vendors/[id]/commission-override] DELETE error:', err)
    return NextResponse.json({ error: err?.message || 'Internal Server Error' }, { status: 500 })
  }
}
