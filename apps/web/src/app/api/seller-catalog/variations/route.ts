import { NextRequest } from 'next/server';
import { proxySellerCatalogVariations } from '@/lib/sellerCatalogVariationsProxy';

export const dynamic = 'force-dynamic';

export function GET(request: NextRequest) {
  return proxySellerCatalogVariations(request);
}
