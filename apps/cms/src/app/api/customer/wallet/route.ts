import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import configPromise from '@payload-config'
import { WalletService } from '@/services/WalletService'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')
    const customerIdParam = searchParams.get('customerId')

    if (!userId && !customerIdParam) {
      return NextResponse.json({ error: 'userId or customerId is required' }, { status: 400 })
    }

    const payload = await getPayload({ config: configPromise })

    let customerId: number | string | undefined = customerIdParam
      ? Number(customerIdParam) || customerIdParam
      : undefined
    if (!customerId && userId) {
      const { docs: customers } = await payload.find({
        collection: 'customers',
        where: { user: { equals: Number(userId) } },
        limit: 1,
        overrideAccess: true,
      })
      if (!customers[0]) {
        return NextResponse.json({ data: { balance: 0, currency: 'PHP', status: 'active', walletId: null } })
      }
      customerId = customers[0].id
    }

    const service = new WalletService(payload)
    const data = await service.getBalance(customerId!)

    const recent = await payload.find({
      collection: 'wallet-transactions',
      where: { customer: { equals: Number(customerId) || customerId } },
      sort: '-createdAt',
      limit: 10,
      depth: 0,
      overrideAccess: true,
    })

    return NextResponse.json({
      data: {
        ...data,
        recent: (recent.docs || []).map((d: any) => ({
          id: d.id,
          type: d.type,
          amount: d.amount,
          balanceAfter: d.balance_after,
          createdAt: d.createdAt,
        })),
      },
    })
  } catch (err: any) {
    console.error('[customer/wallet] Error:', err)
    return NextResponse.json({ error: err?.message || 'Internal Server Error' }, { status: 500 })
  }
}
