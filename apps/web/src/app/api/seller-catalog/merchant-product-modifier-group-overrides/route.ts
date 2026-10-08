import { NextRequest } from 'next/server';
import { proxySellerCatalogMerchantProductModifierGroupOverrides } from '@/lib/sellerCatalogMerchantProductModifierGroupOverridesProxy';

export const dynamic = 'force-dynamic';

export function GET(request: NextRequest) {
  return proxySellerCatalogMerchantProductModifierGroupOverrides(request);
}
