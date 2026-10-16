/**
 * @file apps/cms/src/app/api/admin/finance/payments/send/route.ts
 * @description Send funds from the PayMongo wallet (disbursement) via batch transfer.
 * POST /api/admin/finance/payments/send {destination_number, destination_name,
 *   destination_bic, amount, provider?, description?, purpose?, reference_number?, wallet_id?}
 * Docs: POST /v2/batch_transfers (single transfer wrapped in array), amounts in centavos.
 * Real money moves. Fee is ~PHP 10.00 per transaction per PayMongo pricing.
 */

import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import configPromise from '@payload-config'
import { authenticateAdmin } from '@/utils/mediaLibrary'
import { deleteCachedByPrefix } from '@encreasl/cache'
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

    const destNumber = str(body.destination_number)
    const destName = str(body.destination_name)
    const destBic = str(body.destination_bic)
    const amount = num(body.amount)
    const provider = str(body.provider || 'instapay').toLowerCase()
    const description = str(body.description || 'Disbursement').slice(0, 500) || 'Disbursement'
    const purpose = str(body.purpose || 'Disbursement').slice(0, 500)
    const referenceNumber = str(body.reference_number).slice(0, 100) || `disb-${Date.now()}`
    const walletId = str(body.wallet_id)

    if (!destNumber) return NextResponse.json({ error: 'destination_number is required' }, { status: 400 })
    if (!destName) return NextResponse.json({ error: 'destination_name is required (must match bank records)' }, { status: 400 })
    if (!destBic) return NextResponse.json({ error: 'destination_bic is required (pick from receiving institutions)' }, { status: 400 })
    if (!(amount > 0)) return NextResponse.json({ error: 'amount must be a positive number (PHP)' }, { status: 400 })
    if (!['instapay', 'pesonet'].includes(provider)) {
      return NextResponse.json({ error: 'provider must be instapay or pesonet' }, { status: 400 })
    }
    if (provider === 'instapay' && amount > 50000) {
      return NextResponse.json({ error: 'InstaPay limit is PHP 50,000 per transaction — use pesonet for larger amounts' }, { status: 400 })
    }

    let secretKey: string
    try {
      ;({ secretKey } = paymongoConfig())
    } catch {
      return NextResponse.json({ error: 'Server configuration error: Missing PayMongo Secret Key' }, { status: 500 })
    }

    // Resolve source wallet account (default wallet unless wallet_id given).
    const wq = `/v2/wallets?fields=balance&fields=account`
    const wres = await paymongoFetch(secretKey, walletId ? `/v2/wallets/${encodeURIComponent(walletId)}?fields=balance&fields=account` : wq, { timeoutMs: 20000 })
    if (!wres.ok) {
      return NextResponse.json({ error: paymongoErrorMessage(wres.data, wres.status) }, { status: wres.status })
    }
    const wlist = walletId ? [wres.data?.data].filter(Boolean) : Array.isArray(wres.data?.data) ? wres.data.data : []
    const wallet = (walletId ? wlist[0] : wlist.find((w: any) => w?.is_default) ?? wlist[0]) as any
    if (!wallet?.account?.account_number) {
      return NextResponse.json({ error: 'No PayMongo wallet account available as transfer source' }, { status: 409 })
    }
    const available = num(wallet?.balance?.available) / 100
    if (available < amount) {
      return NextResponse.json({ error: `Insufficient wallet balance (${available.toFixed(2)} PHP available)` }, { status: 409 })
    }

    const transferBody = {
      transfers: [
        {
          provider,
          amount: Math.round(amount * 100),
          currency: 'PHP',
          purpose,
          description,
          reference_number: referenceNumber,
          source_account: {
            number: String(wallet.account.account_number),
            name: String(wallet.account.account_name ?? ''),
            bic: 'PAEYPHM2XXX',
          },
          destination_account: { number: destNumber, name: destName, bic: destBic },
        },
      ],
    }

    const gw = await paymongoFetch(secretKey, '/v2/batch_transfers', {
      method: 'POST',
      body: transferBody,
      idempotencyKey: `send-${referenceNumber}`,
      timeoutMs: 20000,
    })
    if (!gw.ok) {
      return NextResponse.json({ error: paymongoErrorMessage(gw.data, gw.status), details: gw.data }, { status: gw.status })
    }

    await deleteCachedByPrefix('admin:finance:')
    const batch = gw.data?.data ?? null
    const first = Array.isArray(batch?.transfers) ? batch.transfers[0] : batch?.attributes?.transfers?.[0] ?? null
    return NextResponse.json(
      {
        batch_id: batch?.id ?? null,
        transfer: first
          ? { id: first.id ?? null, status: first.status ?? first.attributes?.status ?? 'pending', amount, currency: 'PHP' }
          : null,
        message: 'Transfer submitted. Track status via Retrieve a Transfer or the transfer webhook.',
      },
      { status: 201 },
    )
  } catch (err: unknown) {
    console.error('[admin/finance/payments/send] POST error:', err)
    return NextResponse.json({ error: 'Failed to send funds' }, { status: 500 })
  }
}
