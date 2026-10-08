import { NextRequest } from 'next/server';
import { proxySellerCatalogVariationModifierGroups } from '@/lib/sellerCatalogVariationModifierGroupsProxy';

export const dynamic = 'force-dynamic';

export function GET(request: NextRequest) {
  return proxySellerCatalogVariationModifierGroups(request);
}
