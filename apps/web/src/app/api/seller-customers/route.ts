import { NextRequest } from 'next/server'
import { proxySellerCustomers } from '@/lib/sellerCustomersProxy'

export const dynamic = 'force-dynamic'

export function GET(request: NextRequest) {
  return proxySellerCustomers(request)
}
