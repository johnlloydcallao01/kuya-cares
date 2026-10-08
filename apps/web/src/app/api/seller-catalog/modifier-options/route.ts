import { NextRequest } from 'next/server';
import { proxySellerCatalogModifierOptions } from '@/lib/sellerCatalogModifierOptionsProxy';

export const dynamic = 'force-dynamic';

export function GET(request: NextRequest) {
  return proxySellerCatalogModifierOptions(request);
}
