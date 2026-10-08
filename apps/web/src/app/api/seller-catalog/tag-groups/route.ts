import { NextRequest } from 'next/server';
import { proxySellerCatalogTagGroups } from '@/lib/sellerCatalogTagGroupsProxy';

export const dynamic = 'force-dynamic';

export function GET(request: NextRequest) {
  return proxySellerCatalogTagGroups(request);
}
