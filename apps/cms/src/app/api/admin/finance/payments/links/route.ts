/**
 * @file apps/cms/src/app/api/admin/finance/payments/links/route.ts
 * @description Create a PayMongo payment link (collect money via shareable URL).
 * POST /api/admin/finance/payments/links {amount, description, remarks?, metadata?}
 * Docs: POST /v1/payment_links (flat body, amount in centavos). Same shape the
 * membership checkout already uses (membershipProviders.ts).
 */

import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import configPromise from '@payload-config'
import { authenticateAdmin } from '@/utils/mediaLibrary'
import { paymongoConfig, paymongoFetch, paymongoErrorMessage } from '../gateway'

const num = (v: unknown): number => {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}
const str = (v: unknown): string => (typeof v === 'string' ? v.trim() : '')

export async function POST(request: NextRequest) {
  try {
    const payload = await getPayload({ config: configPromise })
    const admin = await authenticateAdmin(payload, request)
    if (!admin) return NextResponse.json({ error: 'Unauthorized: admin authentication required' }, { status: 401 })

    let body: Record<string, any>
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
    }

    const amount = num(body.amount)
    const description = str(body.description || 'Payment').slice(0, 1000) || 'Payment'
    const remarks = str(body.remarks).slice(0, 1000)
    if (!(amount >= 1)) return NextResponse.json({ error: 'amount must be at least 1 PHP' }, { status: 400 })

    let secretKey: string
    try {
      ;({ secretKey } = paymongoConfig())
    } catch {
      return NextResponse.json({ error: 'Server configuration error: Missing PayMongo Secret Key' }, { status: 500 })
    }

    const linkBody: Record<string, any> = {
      amount: Math.round(amount * 100),
      currency: 'PHP',
      description,
      remarks: remarks || description,
      metadata: body.metadata && typeof body.metadata === 'object' ? body.metadata : { created_by: `admin:${admin.id}` },
      restriction: { completed_sessions: { limit: 1 } },
    }

    const gw = await paymongoFetch(secretKey, '/v1/payment_links', {
      method: 'POST',
      body: linkBody,
      idempotencyKey: `link-${Date.now()}-${Math.round(amount * 100)}`,
      timeoutMs: 20000,
    })
    if (!gw.ok) {
      return NextResponse.json({ error: paymongoErrorMessage(gw.data, gw.status), details: gw.data }, { status: gw.status })
    }
    const node = gw.data?.data ?? {}
    const checkoutUrl: string | undefined = node?.url ?? node?.attributes?.checkout_url
    const referenceNumber: string | undefined = node?.reference_number ?? node?.attributes?.reference_number
    if (!checkoutUrl || !referenceNumber) {
      return NextResponse.json({ error: 'PayMongo did not return a payment link', details: gw.data }, { status: 502 })
    }
    return NextResponse.json(
      { link: { id: node?.id ?? null, checkout_url: checkoutUrl, reference_number: referenceNumber, amount, currency: 'PHP' } },
      { status: 201 },
    )
  } catch (err: unknown) {
    console.error('[admin/finance/payments/links] POST error:', err)
    return NextResponse.json({ error: 'Failed to create payment link' }, { status: 500 })
  }
}
