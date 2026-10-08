import { NextRequest } from 'next/server';
import { proxySellerProductCategories } from '@/lib/sellerProductCategoriesProxy';

export const dynamic = 'force-dynamic';

export function GET(request: NextRequest) {
  return proxySellerProductCategories(request);
}
