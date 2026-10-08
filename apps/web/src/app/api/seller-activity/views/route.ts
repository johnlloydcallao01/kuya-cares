import { NextRequest } from 'next/server'
import { proxySellerViews } from '@/lib/sellerViewsProxy'

export const dynamic = 'force-dynamic'

export function GET(request: NextRequest) {
  return proxySellerViews(request)
}
