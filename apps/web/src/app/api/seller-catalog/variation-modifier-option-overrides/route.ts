import { NextRequest } from 'next/server';
import { proxySellerCatalogVariationModifierOptionOverrides } from '@/lib/sellerCatalogVariationModifierOptionOverridesProxy';

export const dynamic = 'force-dynamic';

export function GET(request: NextRequest) {
  return proxySellerCatalogVariationModifierOptionOverrides(request);
}
