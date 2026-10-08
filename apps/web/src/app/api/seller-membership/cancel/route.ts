import { NextRequest } from 'next/server'
import { proxySellerMembership } from '@/lib/sellerMembershipProxy'

export const dynamic = 'force-dynamic'

export function POST(request: NextRequest) {
  return proxySellerMembership(request, 'cancel')
}
