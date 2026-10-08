import { NextRequest } from 'next/server'
import { proxySellerCoupon } from '@/lib/sellerCouponsProxy'

export const dynamic = 'force-dynamic'

export function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return params.then(({ id }) => proxySellerCoupon(request, id))
}

export function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return params.then(({ id }) => proxySellerCoupon(request, id))
}

export function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return params.then(({ id }) => proxySellerCoupon(request, id))
}
