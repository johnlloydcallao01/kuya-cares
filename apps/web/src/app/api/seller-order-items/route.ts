import { NextRequest } from 'next/server';
import { proxySellerOrderItems } from '@/lib/sellerOrderItemsProxy';

export const dynamic = 'force-dynamic';

export function GET(request: NextRequest) {
  return proxySellerOrderItems(request);
}
