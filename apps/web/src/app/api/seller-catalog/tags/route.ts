import { NextRequest } from 'next/server';
import { proxySellerCatalogTags } from '@/lib/sellerCatalogTagsProxy';

export const dynamic = 'force-dynamic';

export function GET(request: NextRequest) {
  return proxySellerCatalogTags(request);
}
