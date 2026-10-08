import { NextRequest } from 'next/server';
import { proxySellerCatalogAttributeTerms } from '@/lib/sellerCatalogAttributeTermsProxy';

export const dynamic = 'force-dynamic';

export function GET(request: NextRequest) {
  return proxySellerCatalogAttributeTerms(request);
}
