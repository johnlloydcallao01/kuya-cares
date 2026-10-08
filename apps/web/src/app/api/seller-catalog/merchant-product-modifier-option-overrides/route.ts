import { NextRequest } from 'next/server';
import { proxySellerCatalogMerchantProductModifierOptionOverrides } from '@/lib/sellerCatalogMerchantProductModifierOptionOverridesProxy';

export const dynamic = 'force-dynamic';

export function GET(request: NextRequest) {
  return proxySellerCatalogMerchantProductModifierOptionOverrides(request);
}
