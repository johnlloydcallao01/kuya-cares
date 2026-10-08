import { NextRequest } from 'next/server';
import { proxySellerProducts } from '@/lib/sellerProductsProxy';

export const dynamic = 'force-dynamic';

export function GET(request: NextRequest) {
  return proxySellerProducts(request);
}
