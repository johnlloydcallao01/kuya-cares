import { NextRequest } from 'next/server'
import { proxySellerWishlists } from '@/lib/sellerWishlistsProxy'

export const dynamic = 'force-dynamic'

export function GET(request: NextRequest) {
  return proxySellerWishlists(request)
}
