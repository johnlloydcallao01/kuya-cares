import { NextRequest } from 'next/server'
import { proxySellerMembership } from '@/lib/sellerMembershipProxy'

export const dynamic = 'force-dynamic'

export function GET(request: NextRequest) {
  return proxySellerMembership(request, 'subscription')
}
