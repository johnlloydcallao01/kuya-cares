import { NextRequest } from 'next/server';
import { proxySellerBusinessProfile } from '@/lib/sellerBusinessProfileProxy';

export const dynamic = 'force-dynamic';

export function GET(request: NextRequest) {
  return proxySellerBusinessProfile(request);
}
