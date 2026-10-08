import { NextRequest } from 'next/server';
import { proxySellerOrders } from '@/lib/sellerOrdersProxy';

export const dynamic = 'force-dynamic';

export function GET(request: NextRequest) {
  return proxySellerOrders(request);
}
