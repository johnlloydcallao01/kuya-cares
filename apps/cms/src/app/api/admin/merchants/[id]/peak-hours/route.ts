import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import configPromise from '@payload-config'
import { authenticateAdmin } from '@/utils/mediaLibrary'
import { validateTimezone } from '@/utils/storeHours'

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const payload = await getPayload({ config: configPromise })
  if (!await authenticateAdmin(payload, request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params
  const { searchParams } = new URL(request.url)
  const days = Math.min(366, Math.max(1, Number(searchParams.get('days') || 30)))
  const merchant = await payload.findByID({ collection: 'merchants', id: Number(id), depth: 0, overrideAccess: true }) as any
  const timezone = validateTimezone(merchant.timezone)
  const orders = await payload.find({ collection: 'orders', where: { merchant: { equals: Number(id) } }, limit: 0, pagination: false, depth: 0, overrideAccess: true } as any)
  const cutoff = Date.now() - days * 86400000
  const buckets = Array.from({ length: 24 }, (_, hour) => ({ hour, orders: 0, completed: 0, cancelled: 0 }))
  for (const order of orders.docs as any[]) {
    const created = new Date(order.createdAt)
    if (Number.isNaN(created.getTime()) || created.getTime() < cutoff) continue
    const hour = Number(new Intl.DateTimeFormat('en-US', { timeZone: timezone, hour: '2-digit', hourCycle: 'h23' }).format(created))
    const bucket = buckets[hour]
    bucket.orders += 1
    if (order.status === 'delivered') bucket.completed += 1
    if (order.status === 'cancelled') bucket.cancelled += 1
  }
  return NextResponse.json({ merchantId: Number(id), timezone, days, buckets, peakHours: buckets.filter((bucket) => bucket.orders > 0).sort((a, b) => b.orders - a.orders).slice(0, 3) })
}
