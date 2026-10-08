import { NextRequest } from 'next/server';
import { proxySellerOutlets } from '@/lib/sellerOutletsProxy';

export const dynamic = 'force-dynamic';

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return proxySellerOutlets(request, { path: 'outlets', id, status: true });
}
