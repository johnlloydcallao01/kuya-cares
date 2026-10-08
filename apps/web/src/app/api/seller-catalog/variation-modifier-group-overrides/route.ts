import { NextRequest } from 'next/server';
import { proxySellerCatalogVariationModifierGroupOverrides } from '@/lib/sellerCatalogVariationModifierGroupOverridesProxy';

export const dynamic = 'force-dynamic';

export function GET(request: NextRequest) {
  return proxySellerCatalogVariationModifierGroupOverrides(request);
}
