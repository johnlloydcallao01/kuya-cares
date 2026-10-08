import { NextRequest } from 'next/server';
import { proxySellerCatalogVariationModifierOptions } from '@/lib/sellerCatalogVariationModifierOptionsProxy';

export const dynamic = 'force-dynamic';

export function GET(request: NextRequest) {
  return proxySellerCatalogVariationModifierOptions(request);
}
