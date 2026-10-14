import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import configPromise from '@payload-config'
import { authenticateAdmin } from '@/utils/mediaLibrary'

function parsePositiveInt(value: string | null, fallback: number, max: number): number {
  const parsed = Number(value)
  return Number.isSafeInteger(parsed) && parsed > 0 ? Math.min(parsed, max) : fallback
}

export async function GET(request: NextRequest) {
  try {
    const payload = await getPayload({ config: configPromise })
    const admin = await authenticateAdmin(payload, request)
    if (!admin) return NextResponse.json({ error: 'Unauthorized: admin authentication required' }, { status: 401 })

    const params = request.nextUrl.searchParams
    const page = parsePositiveInt(params.get('page'), 1, 100000)
    const limit = parsePositiveInt(params.get('limit'), 20, 100)
    const status = params.get('status')
    const search = (params.get('search') ?? '').trim()
    const and: Record<string, unknown>[] = []
    if (status && ['pending', 'paid', 'failed'].includes(status)) and.push({ status: { equals: status } })
    if (search) and.push({ paymentReference: { contains: search } })

    const result = await payload.find({
      collection: 'member-membership-payments',
      where: and.length ? { and } as never : undefined,
      page,
      limit,
      sort: '-createdAt',
      depth: 1,
      overrideAccess: true,
    })
    const docs = result.docs.map((payment) => {
      const user = payment.user && typeof payment.user === 'object'
        ? payment.user as unknown as Record<string, unknown>
        : null
      return {
        id: payment.id,
        amount: Number(payment.amount ?? 0),
        currency: String(payment.currency ?? 'PHP'),
        status: String(payment.status ?? 'pending'),
        paymentProvider: String(payment.paymentProvider ?? ''),
        paymentReference: String(payment.paymentReference ?? ''),
        paidAt: payment.paidAt ?? null,
        createdAt: payment.createdAt,
        member: user ? {
          id: user.id,
          email: String(user.email ?? ''),
          firstName: String(user.firstName ?? ''),
          lastName: String(user.lastName ?? ''),
        } : null,
      }
    })
    return NextResponse.json({
      docs,
      pagination: {
        page: result.page,
        limit: result.limit,
        totalDocs: result.totalDocs,
        totalPages: result.totalPages,
        hasNextPage: result.hasNextPage,
        hasPrevPage: result.hasPrevPage,
      },
    }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    console.error('[admin/members/payments] GET error:', error)
    return NextResponse.json({ error: 'Failed to load membership payments' }, { status: 500 })
  }
}
