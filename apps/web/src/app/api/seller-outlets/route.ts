import { NextRequest } from 'next/server';
import { proxySellerOutlets } from '@/lib/sellerOutletsProxy';

export const dynamic = 'force-dynamic';

export function GET(request: NextRequest) {
  return proxySellerOutlets(request, { path: 'outlets' });
}

export function POST(request: NextRequest) {
  return proxySellerOutlets(request, { path: 'outlets' });
}
