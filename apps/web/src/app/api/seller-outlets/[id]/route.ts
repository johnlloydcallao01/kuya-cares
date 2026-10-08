import { NextRequest } from 'next/server';
import { proxySellerOutlets } from '@/lib/sellerOutletsProxy';

export const dynamic = 'force-dynamic';

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, { params }: RouteContext) {
  const { id } = await params;
  return proxySellerOutlets(request, { path: 'outlets', id });
}

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  const { id } = await params;
  return proxySellerOutlets(request, { path: 'outlets', id });
}

export async function DELETE(request: NextRequest, { params }: RouteContext) {
  const { id } = await params;
  return proxySellerOutlets(request, { path: 'outlets', id });
}
