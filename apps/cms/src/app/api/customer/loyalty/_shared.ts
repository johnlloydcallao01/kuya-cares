/**
 * Shared helpers for customer loyalty BFF routes (not a route).
 */

export function relId(v: unknown): string | null {
  if (v == null) return null
  if (typeof v === 'string' || typeof v === 'number') return String(v)
  if (typeof v === 'object' && v !== null && 'id' in (v as any)) return String((v as any).id)
  return null
}

export async function resolveCustomer(payload: any, userId: string) {
  const numericUser = Number(userId)
  const { docs } = await payload.find({
    collection: 'customers',
    where: { user: { equals: Number.isFinite(numericUser) ? numericUser : userId } },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })
  if (docs[0]) return docs[0]
  try {
    return await payload.create({
      collection: 'customers',
      data: { user: Number.isFinite(numericUser) ? numericUser : (userId as any) },
      overrideAccess: true,
    })
  } catch {
    return null
  }
}

export function imageUrlOf(image: any): string | null {
  if (!image || typeof image !== 'object') return null
  return image.cloudinaryURL || image.url || image.thumbnailURL || null
}
