import type { PayloadRequest } from 'payload'

/**
 * POST /api/coupons/maintain
 * Scheduled hygiene (wire to cron): flips scheduled→published when the
 * window opens, and cancels stale held redemptions past held_until.
 * Auth: service or admin only. Bounded batches, best-effort per row.
 */
export const couponsMaintainHandler = async (req: PayloadRequest) => {
  try {
    if (!req.user || (req.user.role !== 'service' && req.user.role !== 'admin')) {
      return Response.json({ error: 'Forbidden' }, { status: 403 })
    }

    const now = new Date()
    const nowIso = now.toISOString()
    let published = 0
    let holdsCancelled = 0

    try {
      const scheduled = await req.payload.find({
        collection: 'coupons',
        where: {
          and: [{ status: { equals: 'scheduled' } }, { starts_at: { less_than_equal: nowIso } }],
        },
        pagination: false,
        limit: 100,
        depth: 0,
      })
      for (const c of ((scheduled as any).docs || []) as any[]) {
        try {
          await req.payload.update({
            collection: 'coupons',
            id: c.id,
            data: { status: 'published' },
          })
          published += 1
        } catch {
          continue
        }
      }
    } catch (e) {
      console.error('[coupons/maintain] scheduled flip error:', e)
    }

    try {
      const stale = await req.payload.find({
        collection: 'coupon-redemptions',
        where: {
          and: [{ status: { equals: 'held' } }, { held_until: { less_than: nowIso } }],
        },
        pagination: false,
        limit: 200,
        depth: 0,
      })
      for (const h of ((stale as any).docs || []) as any[]) {
        try {
          await req.payload.update({
            collection: 'coupon-redemptions',
            id: h.id,
            data: { status: 'cancelled' },
          })
          holdsCancelled += 1
        } catch {
          continue
        }
      }
    } catch (e) {
      console.error('[coupons/maintain] hold GC error:', e)
    }

    return Response.json({ data: { published, holdsCancelled, at: nowIso } })
  } catch (error: any) {
    console.error('[coupons/maintain] Error:', error)
    return Response.json({ error: error?.message || 'Internal Server Error' }, { status: 500 })
  }
}
