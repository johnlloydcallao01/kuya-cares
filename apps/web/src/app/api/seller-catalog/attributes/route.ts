import { NextRequest } from 'next/server';
import { proxySellerCatalogAttributes } from '@/lib/sellerCatalogAttributesProxy';

export const dynamic = 'force-dynamic';

export function GET(request: NextRequest) {
  return proxySellerCatalogAttributes(request);
}
