import { NextRequest } from 'next/server'
import { proxySellerCustomerAddresses } from '@/lib/sellerCustomersProxy'

export const dynamic = 'force-dynamic'

export function GET(request: NextRequest) {
  return proxySellerCustomerAddresses(request)
}
