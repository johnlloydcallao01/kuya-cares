import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import configPromise from '@payload-config'
import { authenticateAdmin } from '@/utils/mediaLibrary'
import { withAdminRequestSlot } from '@/utils/adminRequestGate'

type MemberRecord = Record<string, any>

function parsePositiveInt(value: string | null, fallback: number, max: number): number {
  const parsed = Number(value)
  return Number.isSafeInteger(parsed) && parsed > 0 ? Math.min(parsed, max) : fallback
}

function memberBrief(user: MemberRecord) {
  return {
    id: user.id,
    email: String(user.email ?? ''),
    firstName: String(user.firstName ?? ''),
    lastName: String(user.lastName ?? ''),
    username: user.username ?? null,
    phone: user.phone ?? null,
    isActive: user.isActive !== false,
    membershipStatus: user.memberMembershipStatus ?? 'pending_payment',
    membershipPaidAt: user.memberMembershipPaidAt ? String(user.memberMembershipPaidAt) : null,
    createdAt: String(user.createdAt ?? ''),
    lastLogin: user.lastLogin ? String(user.lastLogin) : null,
  }
}

function paymentBrief(payment: MemberRecord | undefined) {
  if (!payment) return null
  return {
    id: payment.id,
    amount: Number(payment.amount ?? 0),
    currency: String(payment.currency ?? 'PHP'),
    status: String(payment.status ?? 'pending'),
    paymentProvider: String(payment.paymentProvider ?? ''),
    paymentReference: String(payment.paymentReference ?? ''),
    paidAt: payment.paidAt ? String(payment.paidAt) : null,
    createdAt: String(payment.createdAt ?? ''),
  }
}

async function count(payload: Awaited<ReturnType<typeof getPayload>>, where: Record<string, unknown>) {
  const result = await payload.find({
    collection: 'users',
    where: where as never,
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })
  return result.totalDocs
}

export async function GET(request: NextRequest) {
  return withAdminRequestSlot(async () => {
    try {
      const payload = await getPayload({ config: configPromise })
      const admin = await authenticateAdmin(payload, request)
      if (!admin) return NextResponse.json({ error: 'Unauthorized: admin authentication required' }, { status: 401 })

      const params = request.nextUrl.searchParams
      const page = parsePositiveInt(params.get('page'), 1, 100000)
      const limit = parsePositiveInt(params.get('limit'), 20, 50)
      const search = (params.get('search') ?? '').trim()
      const membershipStatus = params.get('membershipStatus')
      const accountStatus = params.get('accountStatus')
      const allowedSorts = new Set(['createdAt', '-createdAt', 'firstName', '-firstName', 'lastName', '-lastName', 'email', '-email'])
      const sort = allowedSorts.has(params.get('sort') ?? '') ? params.get('sort')! : '-createdAt'
      const and: Record<string, unknown>[] = [{ role: { equals: 'member' } }]

      if (search) {
        and.push({
          or: [
            { email: { contains: search } },
            { firstName: { contains: search } },
            { lastName: { contains: search } },
            { username: { contains: search } },
            { phone: { contains: search } },
          ],
        })
      }
      if (membershipStatus === 'active' || membershipStatus === 'pending_payment') {
        and.push({ memberMembershipStatus: { equals: membershipStatus } })
      }
      if (accountStatus === 'active') and.push({ isActive: { equals: true } })
      if (accountStatus === 'inactive') and.push({ isActive: { equals: false } })

      const memberWhere = { and }
      const [members, totalMembers, activeMemberships, pendingMemberships, inactiveAccounts, pendingInvites, settings] = await Promise.all([
        payload.find({
          collection: 'users',
          where: memberWhere as never,
          page,
          limit,
          sort,
          depth: 0,
          overrideAccess: true,
        }),
        count(payload, { role: { equals: 'member' } }),
        count(payload, { and: [{ role: { equals: 'member' } }, { memberMembershipStatus: { equals: 'active' } }] }),
        count(payload, { and: [{ role: { equals: 'member' } }, { memberMembershipStatus: { equals: 'pending_payment' } }] }),
        count(payload, { and: [{ role: { equals: 'member' } }, { isActive: { equals: false } }] }),
        payload.find({
          collection: 'member-invites',
          where: {
            and: [
              { status: { equals: 'pending' } },
              { or: [{ expiresAt: { greater_than: new Date().toISOString() } }, { expiresAt: { exists: false } }] },
            ],
          },
          limit: 1,
          depth: 0,
          overrideAccess: true,
        }),
        payload.findGlobal({ slug: 'system-settings' }),
      ])
      const memberMembershipFeePhp = Number((settings as Record<string, any>)?.membership?.memberMembershipFeePhp)

      const rows = await Promise.all((members.docs as unknown as MemberRecord[]).map(async (user) => {
        const latestPayment = await payload.find({
          collection: 'member-membership-payments',
          where: { user: { equals: user.id } },
          sort: '-createdAt',
          limit: 1,
          depth: 0,
          overrideAccess: true,
        })
        return {
          ...memberBrief(user),
          latestPayment: paymentBrief(latestPayment.docs[0] as unknown as MemberRecord | undefined),
        }
      }))

      return NextResponse.json({
        docs: rows,
        pagination: {
          page: members.page,
          limit: members.limit,
          totalDocs: members.totalDocs,
          totalPages: members.totalPages,
          hasNextPage: members.hasNextPage,
          hasPrevPage: members.hasPrevPage,
        },
        stats: {
          totalMembers,
          activeMemberships,
          pendingMemberships,
          inactiveAccounts,
          pendingInvites: pendingInvites.totalDocs,
          memberMembershipFeePhp: Number.isFinite(memberMembershipFeePhp) ? memberMembershipFeePhp : null,
        },
        meta: { generatedAt: new Date().toISOString(), search },
      }, { headers: { 'Cache-Control': 'no-store' } })
    } catch (error) {
      console.error('[admin/members] GET error:', error)
      return NextResponse.json({ error: 'Failed to load members' }, { status: 500 })
    }
  })
}
