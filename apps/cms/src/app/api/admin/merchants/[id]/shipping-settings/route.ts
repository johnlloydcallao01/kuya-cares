import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import configPromise from '@payload-config'
import { authenticateAdmin } from '@/utils/mediaLibrary'
import {
  loadSellerShippingSettings,
  parseSellerShippingSettings,
  replaceSellerShippingZones,
} from '@/services/SellerShippingService'

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>
    return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`).join(',')}}`
  }
  return JSON.stringify(value)
}

async function getAdminMerchant(payload: Awaited<ReturnType<typeof getPayload>>, id: string) {
  if (!/^[1-9]\d*$/.test(id)) return null
  const numericId = Number(id)
  if (!Number.isSafeInteger(numericId)) return null
  const result = await payload.find({
    collection: 'merchants',
    where: { id: { equals: numericId } },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })
  return (result.docs[0] as unknown as Record<string, unknown> | undefined) ?? null
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const payload = await getPayload({ config: configPromise })
    const admin = await authenticateAdmin(payload, request)
    if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await params
    const merchant = await getAdminMerchant(payload, id)
    if (!merchant) return NextResponse.json({ error: 'Outlet not found' }, { status: 404 })
    const settings = await loadSellerShippingSettings(payload, merchant)
    return NextResponse.json({
      outlet: {
        id: merchant.id,
        outletName: merchant.outletName,
        sellerShippingSettings: settings,
      },
    })
  } catch (error) {
    console.error('[admin/merchants/[id]/shipping-settings] GET failed:', error)
    return NextResponse.json({ error: 'Failed to load outlet shipping settings' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const payload = await getPayload({ config: configPromise })
    const admin = await authenticateAdmin(payload, request)
    if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await params
    const merchant = await getAdminMerchant(payload, id)
    if (!merchant) return NextResponse.json({ error: 'Outlet not found' }, { status: 404 })

    let body: unknown
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
    }
    if (!body || typeof body !== 'object' || !('sellerShippingSettings' in body)) {
      return NextResponse.json({ error: 'sellerShippingSettings is required' }, { status: 400 })
    }

    let settings: ReturnType<typeof parseSellerShippingSettings>
    try {
      settings = parseSellerShippingSettings((body as { sellerShippingSettings: unknown }).sellerShippingSettings)
    } catch (error) {
      return NextResponse.json({
        error: error instanceof Error ? error.message : 'Invalid seller shipping settings',
      }, { status: 400 })
    }

    const merchantId = Number(merchant.id)
    await replaceSellerShippingZones(payload, merchantId, settings)
    await payload.update({
      collection: 'merchants',
      id: merchantId,
      data: {
        seller_pickup_enabled: settings.pickup.enabled,
        seller_pickup_instructions: settings.pickup.instructions,
      },
      overrideAccess: true,
    })

    const persisted = await loadSellerShippingSettings(payload, { ...merchant, id: merchantId })
    if (stableStringify(persisted) !== stableStringify(settings)) {
      return NextResponse.json({ error: 'Shipping settings save verification failed' }, { status: 500 })
    }
    return NextResponse.json({
      outlet: {
        id: merchant.id,
        outletName: merchant.outletName,
        sellerShippingSettings: persisted,
      },
    })
  } catch (error) {
    console.error('[admin/merchants/[id]/shipping-settings] PUT failed:', error)
    return NextResponse.json({ error: 'Failed to save outlet shipping settings' }, { status: 500 })
  }
}
