/**
 * Shared helpers for customer loyalty BFF routes (not a route).
 */

export function relId(v: unknown): string | null {
  if (v == null) return null
  if (typeof v === 'string' || typeof v === 'number') return String(v)
  if (typeof v === 'object' && v !== null && 'id' in (v as any)) return String((v as any).id)
  return null
}

// In-process resolve memo (§4 singleflight): summary/catalog/history fan
// out in one tick and each resolves the same customer. 10s TTL is safe —
// customer identity is stable at this timescale. Only successes cached.
const RESOLVE_TTL_MS = 10_000
const resolveCache = new Map<string, { ts: number; customer: any }>()
const resolveInflight = new Map<string, Promise<any>>()

export async function resolveCustomer(payload: any, userId: string) {
  const key = `loyalty-resolve:${userId}`
  const hit = resolveCache.get(key)
  if (hit && Date.now() - hit.ts <= RESOLVE_TTL_MS) return hit.customer
  const running = resolveInflight.get(key)
  if (running) return running
  const p = (async () => {
    try {
      const numericUser = Number(userId)
      const { docs } = await payload.find({
        collection: 'customers',
        where: { user: { equals: Number.isFinite(numericUser) ? numericUser : userId } },
        limit: 1,
        depth: 0,
        overrideAccess: true,
      })
      if (docs[0]) {
        resolveCache.set(key, { ts: Date.now(), customer: docs[0] })
        return docs[0]
      }
      try {
        const created = await payload.create({
          collection: 'customers',
          data: { user: Number.isFinite(numericUser) ? numericUser : (userId as any) },
          overrideAccess: true,
        })
        resolveCache.set(key, { ts: Date.now(), customer: created })
        return created
      } catch {
        return null
      }
    } finally {
      resolveInflight.delete(key)
    }
  })()
  resolveInflight.set(key, p)
  return p
}

export function imageUrlOf(image: any): string | null {
  if (!image || typeof image !== 'object') return null
  return image.cloudinaryURL || image.url || image.thumbnailURL || null
}

/**
 * Incremental tier progress (0–100). Progress runs from the CURRENT tier's
 * threshold to the NEXT tier's — not from zero. E.g. Silver(10)→Gold(25)
 * at 15 orders is (15−10)/(25−10) = 33%, not 15/25 = 60%.
 */
export function tierProgressPct(deliveredOrders: number, curMinOrders: number, nextMinOrders: number): number {
  const span = Math.max(1, nextMinOrders - curMinOrders)
  return Math.min(100, Math.max(0, Math.round(((deliveredOrders - curMinOrders) / span) * 100)))
}
