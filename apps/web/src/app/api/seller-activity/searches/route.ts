import { NextRequest } from 'next/server'
import { proxySellerSearches } from '@/lib/sellerSearchesProxy'

export const dynamic = 'force-dynamic'

export function GET(request: NextRequest) {
  return proxySellerSearches(request)
}
