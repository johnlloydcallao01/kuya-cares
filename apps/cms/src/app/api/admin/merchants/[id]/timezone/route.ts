import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import configPromise from '@payload-config'
import { authenticateAdmin } from '@/utils/mediaLibrary'
import { validateTimezone } from '@/utils/storeHours'

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const payload = await getPayload({ config: configPromise })
  if (!await authenticateAdmin(payload, request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params
  const merchant = await payload.findByID({ collection: 'merchants', id: Number(id), depth: 0, overrideAccess: true }) as any
  const latitude = Number(merchant.merchant_latitude)
  const longitude = Number(merchant.merchant_longitude)
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return NextResponse.json({ error: 'Merchant coordinates are required for timezone detection' }, { status: 400 })
  const key = process.env.GOOGLE_MAPS_API_KEY || process.env.GOOGLE_MAPS_SERVER_API_KEY
  if (!key) return NextResponse.json({ error: 'Google Maps API key is not configured' }, { status: 503 })
  const timestamp = Math.floor(Date.now() / 1000)
  const response = await fetch(`https://maps.googleapis.com/maps/api/timezone/json?location=${latitude},${longitude}&timestamp=${timestamp}&key=${encodeURIComponent(key)}`)
  if (!response.ok) return NextResponse.json({ error: 'Timezone provider request failed' }, { status: 502 })
  const result = await response.json() as { status?: string; timeZoneId?: string; timeZoneName?: string }
  if (result.status !== 'OK' || !result.timeZoneId) return NextResponse.json({ error: result.status || 'Unable to detect timezone' }, { status: 502 })
  const timezone = validateTimezone(result.timeZoneId)
  const updated = await payload.update({ collection: 'merchants', id: Number(id), data: { timezone }, overrideAccess: true })
  return NextResponse.json({ timezone, timeZoneName: result.timeZoneName || null, merchant: updated })
}
