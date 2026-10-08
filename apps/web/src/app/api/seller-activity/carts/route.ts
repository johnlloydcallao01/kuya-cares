import { NextRequest } from 'next/server'
import { proxySellerCarts } from '@/lib/sellerCartsProxy'

export const dynamic = 'force-dynamic'

export function GET(request: NextRequest) {
  return proxySellerCarts(request)
}
