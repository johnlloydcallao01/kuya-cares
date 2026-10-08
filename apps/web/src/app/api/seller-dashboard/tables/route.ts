import { proxySellerDashboard } from '@/lib/sellerDashboardProxy';
import { NextRequest } from 'next/server';

export const dynamic = 'force-dynamic';

export function GET(request: NextRequest) {
  return proxySellerDashboard(request, 'tables');
}
