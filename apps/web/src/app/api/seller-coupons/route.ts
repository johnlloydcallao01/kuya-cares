import { NextRequest } from 'next/server'
import { proxySellerCoupons } from '@/lib/sellerCouponsProxy'

export const dynamic = 'force-dynamic'

export function GET(request: NextRequest) {
  return proxySellerCoupons(request)
}

export function POST(request: NextRequest) {
  return proxySellerCoupons(request)
}
