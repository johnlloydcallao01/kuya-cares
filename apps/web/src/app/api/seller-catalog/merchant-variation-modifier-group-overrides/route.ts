import { NextRequest } from 'next/server';
import { proxySellerCatalogMerchantVariationModifierGroupOverrides } from '@/lib/sellerCatalogMerchantVariationModifierGroupOverridesProxy';

export const dynamic = 'force-dynamic';

export function GET(request: NextRequest) {
  return proxySellerCatalogMerchantVariationModifierGroupOverrides(request);
}
