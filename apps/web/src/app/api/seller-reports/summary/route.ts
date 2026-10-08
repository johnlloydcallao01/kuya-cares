import { NextRequest } from 'next/server';
import { proxySellerReports } from '@/lib/sellerReportsProxy';

export const dynamic = 'force-dynamic';

export function GET(request: NextRequest) {
  return proxySellerReports(request, 'summary');
}
