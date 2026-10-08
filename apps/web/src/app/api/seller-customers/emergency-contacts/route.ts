import { NextRequest } from 'next/server'
import { proxySellerEmergencyContacts } from '@/lib/sellerCustomersProxy'

export const dynamic = 'force-dynamic'

export function GET(request: NextRequest) {
  return proxySellerEmergencyContacts(request)
}
