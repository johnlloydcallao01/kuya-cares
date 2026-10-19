import { NextRequest } from 'next/server'
import { proxySellerOrderFulfillment } from '@/lib/sellerOrdersProxy'

export const dynamic = 'force-dynamic'

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params
  return proxySellerOrderFulfillment(request, id)
}
