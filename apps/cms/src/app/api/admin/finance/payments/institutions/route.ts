/**
 * @file apps/cms/src/app/api/admin/finance/payments/institutions/route.ts
 * @description Receiving institutions (banks/e-wallets) for Send transfers.
 * GET /api/admin/finance/payments/institutions?provider=instapay|pesonet
 * Docs: GET /v1/wallets/receiving_institutions
 */

import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import configPromise from '@payload-config'
import { authenticateAdmin } from '@/utils/mediaLibrary'
import { getCached, setCached } from '@encreasl/cache'
import { paymongoConfig, paymongoFetch } from '../gateway'

export async function GET(request: NextRequest) {
  try {
    const payload = await getPayload({ config: configPromise })
    const admin = await authenticateAdmin(payload, request)
    if (!admin) return NextResponse.json({ error: 'Unauthorized: admin authentication required' }, { status: 401 })

    const { searchParams } = new URL(request.url)
    const provider = (searchParams.get('provider') || 'instapay').toLowerCase()
    if (!['instapay', 'pesonet'].includes(provider)) {
      return NextResponse.json({ error: 'provider must be instapay or pesonet' }, { status: 400 })
    }

    const cacheKey = `admin:finance:payments:institutions:${provider}`
    const cached = await getCached<Record<string, unknown>>(cacheKey)
    if (cached) return NextResponse.json(cached, { headers: { 'X-Payments-Cache': 'HIT' } })

    let secretKey: string
    try {
      ;({ secretKey } = paymongoConfig())
    } catch {
      return NextResponse.json({ error: 'Server configuration error: Missing PayMongo Secret Key' }, { status: 500 })
    }

    const gw = await paymongoFetch(secretKey, `/v1/wallets/receiving_institutions?provider=${encodeURIComponent(provider)}`, { timeoutMs: 20000 })
    if (!gw.ok) {
      const d = gw.data
      const msg = d?.errors?.[0]?.detail || 'Failed to load receiving institutions'
      return NextResponse.json({ error: typeof msg === 'string' ? msg : 'Failed to load receiving institutions', details: d }, { status: gw.status })
    }
    const list = Array.isArray(gw.data?.data) ? gw.data.data : []
    const response = {
      provider,
      institutions: list.map((x: any) => ({
        name: x?.attributes?.name ?? x?.name ?? '',
        bic: x?.attributes?.provider_code ?? x?.attributes?.bic ?? x?.provider_code ?? '',
        provider,
      })).filter((x: any) => x.name && x.bic),
    }
    await setCached(cacheKey, response, 3600)
    return NextResponse.json(response, { headers: { 'X-Payments-Cache': 'MISS' } })
  } catch (err: unknown) {
    console.error('[admin/finance/payments/institutions] GET error:', err)
    return NextResponse.json({ error: 'Failed to load receiving institutions' }, { status: 500 })
  }
}
