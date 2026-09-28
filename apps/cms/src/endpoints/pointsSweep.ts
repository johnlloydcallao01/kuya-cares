import type { PayloadRequest } from 'payload'
import { PointsService } from '../services/PointsService'

/**
 * POST /api/points/sweep
 * FIFO expiry sweep for loyalty earn lots (wire to cron).
 * Auth: service or admin only. Bounded, best-effort per lot.
 */
export const pointsSweepHandler = async (req: PayloadRequest) => {
  try {
    if (!req.user || (req.user.role !== 'service' && req.user.role !== 'admin')) {
      return Response.json({ error: 'Forbidden' }, { status: 403 })
    }

    const result = await new PointsService(req.payload).sweepExpiring(200)
    return Response.json({ data: { ...result, at: new Date().toISOString() } })
  } catch (error: any) {
    console.error('[points/sweep] Error:', error)
    return Response.json({ error: error?.message || 'Internal Server Error' }, { status: 500 })
  }
}
