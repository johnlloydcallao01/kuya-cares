import type { Payload } from 'payload'

export async function findDashboardMerchants(
  payload: Payload,
  userId: string,
): Promise<Record<string, unknown>[] | null> {
  const vendorsRes = await payload.find({
    collection: 'vendors',
    where: { user: { equals: userId } },
    limit: 1000,
    depth: 0,
    overrideAccess: true,
  })
  const vendorIds = Array.from(new Set(
    vendorsRes.docs
      .map((vendor) => String((vendor as unknown as Record<string, unknown>).id))
      .filter(Boolean),
  ))
  if (vendorIds.length === 0) return null

  const merchantsRes = await payload.find({
    collection: 'merchants',
    where: { vendor: { in: vendorIds } },
    limit: 1000,
    depth: 0,
    overrideAccess: true,
  })
  return merchantsRes.docs as unknown as Record<string, unknown>[]
}
