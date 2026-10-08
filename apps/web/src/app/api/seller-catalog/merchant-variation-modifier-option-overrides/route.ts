import { NextRequest } from 'next/server';
import { proxySellerCatalogMerchantVariationModifierOptionOverrides } from '@/lib/sellerCatalogMerchantVariationModifierOptionOverridesProxy';

export const dynamic = 'force-dynamic';

export function GET(request: NextRequest) {
  return proxySellerCatalogMerchantVariationModifierOptionOverrides(request);
}
