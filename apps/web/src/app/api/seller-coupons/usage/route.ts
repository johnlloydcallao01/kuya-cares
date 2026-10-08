import { NextRequest } from 'next/server'
import { proxySellerCouponUsage } from '@/lib/sellerCouponsProxy'

export const dynamic = 'force-dynamic'

export function GET(request: NextRequest) {
  return proxySellerCouponUsage(request)
}
