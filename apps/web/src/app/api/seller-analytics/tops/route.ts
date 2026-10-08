import { NextRequest } from 'next/server';
import { proxySellerAnalytics } from '@/lib/sellerAnalyticsProxy';

export const dynamic = 'force-dynamic';

export function GET(request: NextRequest) {
  return proxySellerAnalytics(request, 'tops');
}
