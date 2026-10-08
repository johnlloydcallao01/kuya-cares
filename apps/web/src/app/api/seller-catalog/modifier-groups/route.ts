import { NextRequest } from 'next/server';
import { proxySellerCatalogModifierGroups } from '@/lib/sellerCatalogModifierGroupsProxy';

export const dynamic = 'force-dynamic';

export function GET(request: NextRequest) {
  return proxySellerCatalogModifierGroups(request);
}
