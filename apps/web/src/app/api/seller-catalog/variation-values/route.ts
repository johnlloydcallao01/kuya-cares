import { NextRequest } from 'next/server';
import { proxySellerCatalogVariationValues } from '@/lib/sellerCatalogVariationValuesProxy';

export const dynamic = 'force-dynamic';

export function GET(request: NextRequest) {
  return proxySellerCatalogVariationValues(request);
}
