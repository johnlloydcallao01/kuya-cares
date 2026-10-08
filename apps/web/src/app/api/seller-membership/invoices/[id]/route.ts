import { NextRequest } from 'next/server'
import { proxySellerMembership } from '@/lib/sellerMembershipProxy'

export const dynamic = 'force-dynamic'

export function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return params.then(({ id }) => proxySellerMembership(request, 'invoiceDetail', id))
}
