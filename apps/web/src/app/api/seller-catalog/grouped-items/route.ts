import { NextRequest } from 'next/server';
import { proxySellerCatalogGroupedItems } from '@/lib/sellerCatalogGroupedItemsProxy';

export const dynamic = 'force-dynamic';

export function GET(request: NextRequest) {
  return proxySellerCatalogGroupedItems(request);
}
