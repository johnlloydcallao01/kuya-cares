/**
 * @file apps/cms/src/app/api/admin/membership-plans/route.ts
 * @description Admin plan catalog. GET (list, withAdminRequestSlot) / POST (create).
 */

import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import configPromise from '@payload-config'
import { authenticateAdmin } from '@/utils/mediaLibrary'
import { withAdminRequestSlot } from '@/utils/adminRequestGate'
import { sanitizePlan, clampLimit, badRequest } from '@/utils/membershipApi'

export async function GET(request: NextRequest) {
  return withAdminRequestSlot(async () => {
    try {
      const payload = await getPayload({ config: configPromise })
      const admin = await authenticateAdmin(payload, request)
      if (!admin) return NextResponse.json({ error: 'Unauthorized: admin authentication required' }, { status: 401 })

      const { searchParams } = new URL(request.url)
      const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10) || 1)
      const limit = clampLimit(searchParams.get('limit'))
      const search = searchParams.get('search')?.trim() || ''
      const status = searchParams.get('status')?.trim() || ''
      const sort = searchParams.get('sort') || 'display_order'

      const and: any[] = []
      if (search) {
        and.push({ or: [{ name: { contains: search } }, { slug: { contains: search } }] })
      }
      if (status) and.push({ status: { equals: status } })
      const where = and.length ? { and } : undefined

      const res = await payload.find({
        collection: 'membership-plans' as any,
        where: where as any,
        page, limit, sort, depth: 0, overrideAccess: true,
      })

      return NextResponse.json(
        {
          docs: (res.docs as any[]).map(sanitizePlan),
          pagination: {
            page: (res as any).page, limit: (res as any).limit,
            totalDocs: (res as any).totalDocs, totalPages: (res as any).totalPages,
            hasNextPage: (res as any).hasNextPage, hasPrevPage: (res as any).hasPrevPage,
          },
        },
        { status: 200 },
      )
    } catch (err: any) {
      console.error('[admin/membership-plans] GET error:', err)
      return NextResponse.json({ error: err?.message || 'Internal Server Error' }, { status: 500 })
    }
  })
}

export async function POST(request: NextRequest) {
  try {
    const payload = await getPayload({ config: configPromise })
    const admin = await authenticateAdmin(payload, request)
    if (!admin) return NextResponse.json({ error: 'Unauthorized: admin authentication required' }, { status: 401 })

    let body: Record<string, any>
    try {
      body = await request.json()
    } catch {
      return badRequest('Invalid JSON body')
    }
    const name = typeof body.name === 'string' ? body.name.trim() : ''
    const price = Number(body.price)
    if (!name) return badRequest('name is required')
    if (!Number.isFinite(price) || price < 0) return badRequest('price must be >= 0')

    const slug =
      typeof body.slug === 'string' && body.slug.trim()
        ? body.slug.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-')
        : name.toLowerCase().replace(/[^a-z0-9]+/g, '-')

    // Slug uniqueness guard
    const dup = await payload.find({
      collection: 'membership-plans' as any,
      where: { slug: { equals: slug } },
      limit: 1, depth: 0, overrideAccess: true,
    })
    if ((dup?.docs?.length ?? 0) > 0) {
      return NextResponse.json({ error: 'Plan slug already exists', code: 'DUPLICATE_SLUG' }, { status: 409 })
    }

    const doc = await payload.create({
      collection: 'membership-plans' as any,
      data: {
        name,
        slug,
        description: body.description ?? null,
        price,
        currency: 'PHP',
        billing_interval: body.billing_interval ?? body.billingInterval ?? 'month',
        trial_days: body.trial_days ?? body.trialDays ?? 0,
        grace_days: body.grace_days ?? body.graceDays ?? 7,
        commission_percent: body.commission_percent ?? body.commissionPercent ?? 0,
        transaction_fee: body.transaction_fee ?? body.transactionFee ?? 0,
        limits: body.limits ?? null,
        capabilities: body.capabilities ?? null,
        status: body.status ?? 'active',
        display_order: body.display_order ?? body.displayOrder ?? 0,
        is_fallback_basic: body.is_fallback_basic ?? false,
        version: 1,
      } as any,
      overrideAccess: true,
    })

    return NextResponse.json({ doc: sanitizePlan(doc as any) }, { status: 201 })
  } catch (err: any) {
    console.error('[admin/membership-plans] POST error:', err)
    return NextResponse.json({ error: err?.message || 'Internal Server Error' }, { status: 500 })
  }
}
