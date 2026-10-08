import { NextRequest, NextResponse } from 'next/server'
import { authenticateVendorOrMember } from '@/utils/mediaLibrary'
import { resolveOwnedVendorId, resolveOwnVendorId } from '@/utils/membershipApi'

export async function resolveSellerVendorScope(
  payload: any,
  request: NextRequest,
  requestedVendorId: string | null,
) {
  const user = await authenticateVendorOrMember(payload, request)
  if (!user) {
    return {
      user: null,
      vendor: null,
      vendorId: null,
      merchantIds: [] as number[],
      error: NextResponse.json({ error: 'Unauthorized: seller authentication required' }, { status: 401 }),
    }
  }

  if (user.role === 'member' && !requestedVendorId) {
    return {
      user,
      vendor: null,
      vendorId: null,
      merchantIds: [] as number[],
      error: NextResponse.json({ error: 'vendorId is required' }, { status: 400 }),
    }
  }

  const vendorId = user.role === 'member' && requestedVendorId
    ? await resolveOwnedVendorId(payload, user.id, requestedVendorId)
    : await resolveOwnVendorId(payload, user.id)
  if (!vendorId) {
    return {
      user,
      vendor: null,
      vendorId: null,
      merchantIds: [] as number[],
      error: NextResponse.json(
        { error: 'Vendor profile not found or not owned by account' },
        { status: requestedVendorId ? 403 : 404 },
      ),
    }
  }

  const vendor = await payload.findByID({
    collection: 'vendors',
    id: vendorId,
    depth: 0,
    overrideAccess: true,
  })
  const merchants = await payload.find({
    collection: 'merchants',
    where: { vendor: { equals: vendorId } },
    limit: 1000,
    depth: 0,
    overrideAccess: true,
  })
  return {
    user,
    vendor: vendor as Record<string, any>,
    vendorId: Number(vendorId),
    merchantIds: (merchants.docs as Record<string, any>[])
      .map((merchant) => Number(merchant.id))
      .filter(Number.isFinite),
    error: null,
  }
}
