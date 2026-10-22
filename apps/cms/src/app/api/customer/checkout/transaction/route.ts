import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import configPromise from '@payload-config'
import { authenticateCustomerOrMember } from '@/utils/mediaLibrary'
import { resolveAuthenticatedCustomer } from '@/services/sellerShippingCheckout'

export const dynamic = 'force-dynamic'
type JsonRecord = Record<string, unknown>
const validPaymentMethods = new Set([
  'card',
  'gcash',
  'grab_pay',
  'paymaya',
  'billease',
  'dob',
  'brankas',
  'qrph',
])

function relationId(value: unknown): string | null {
  if (value == null) return null
  if (typeof value === 'string' || typeof value === 'number') return String(value)
  if (typeof value === 'object' && 'id' in value) {
    const id = (value as { id?: unknown }).id
    if (typeof id === 'string' || typeof id === 'number') return String(id)
  }
  return null
}
function isRecord(value: unknown): value is JsonRecord {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}

export async function POST(request: NextRequest) {
  try {
    const payload = await getPayload({ config: configPromise })
    const user = await authenticateCustomerOrMember(payload, request)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    let body: JsonRecord
    try {
      const parsed: unknown = await request.json()
      if (!isRecord(parsed)) return NextResponse.json({ error: 'A JSON request body is required.' }, { status: 400 })
      body = parsed
    } catch {
      return NextResponse.json({ error: 'The request body is not valid JSON.' }, { status: 400 })
    }
    const orderId = typeof body.orderId === 'string' || typeof body.orderId === 'number' ? String(body.orderId) : ''
    const paymentIntentId = typeof body.paymentIntentId === 'string' ? body.paymentIntentId.trim() : ''
    const amount = Number(body.amount)
    const currency = typeof body.currency === 'string' ? body.currency.trim().toUpperCase() : ''
    const paymentMethod = typeof body.paymentMethod === 'string' ? body.paymentMethod.trim() : ''
    if (!/^\d+$/.test(orderId) || !/^pi_[A-Za-z0-9_-]{1,120}$/.test(paymentIntentId) ||
      !Number.isFinite(amount) || amount <= 0 || currency !== 'PHP' || !validPaymentMethods.has(paymentMethod)) {
      return NextResponse.json({ error: 'A valid order, payment intent, amount, currency, and payment method are required.' }, { status: 400 })
    }

    const customer = await resolveAuthenticatedCustomer(payload, user.id)
    if (!customer) return NextResponse.json({ error: 'Customer account not found.' }, { status: 404 })
    const order = await payload.findByID({
      collection: 'orders', id: Number(orderId) as never, depth: 0, overrideAccess: true,
    }) as unknown as JsonRecord
    if (relationId(order.customer) !== String(customer.id)) {
      return NextResponse.json({ error: 'This order does not belong to your account.' }, { status: 403 })
    }
    const expectedAmount = Math.round(Number(order.total) * 100)
    if (!Number.isSafeInteger(expectedAmount) || expectedAmount !== Math.round(amount * 100)) {
      return NextResponse.json({ error: 'Amount does not match the order total.', code: 'AMOUNT_MISMATCH' }, { status: 400 })
    }

    const existingByIntent = await payload.find({
      collection: 'transactions', where: { payment_intent_id: { equals: paymentIntentId } },
      limit: 1, depth: 0, overrideAccess: true,
    })
    const existing = existingByIntent.docs[0] as unknown as JsonRecord | undefined
    if (existing) {
      if (relationId(existing.order) !== orderId || Math.round(Number(existing.amount) * 100) !== expectedAmount ||
        String(existing.currency || 'PHP').toUpperCase() !== currency || existing.payment_method !== paymentMethod) {
        return NextResponse.json({ error: 'This payment intent is already linked to another payment.', code: 'PAYMENT_INTENT_IN_USE' }, { status: 409 })
      }
      return NextResponse.json({ transactionId: String(existing.id), status: existing.status, reused: true })
    }
    if (order.status !== 'pending') {
      return NextResponse.json({ error: 'Only pending orders can start a payment.' }, { status: 409 })
    }
    const pendingForOrder = await payload.find({
      collection: 'transactions',
      where: { and: [{ order: { equals: Number(orderId) } }, { status: { equals: 'pending' } }] },
      limit: 1, depth: 0, overrideAccess: true,
    })
    if (pendingForOrder.docs[0]) {
      return NextResponse.json({ error: 'This order already has a pending transaction.', code: 'ORDER_PAYMENT_IN_PROGRESS' }, { status: 409 })
    }

    const sandbox = process.env.PAYMONGO_SANDBOX === 'true'
    const secretKey = (sandbox ? process.env.PAYMONGO_SANDBOX_API_KEY : process.env.PAYMONGO_SECRET_KEY_LIVE)?.trim()
    if (!secretKey) return NextResponse.json({ error: 'PayMongo is not configured.' }, { status: 503 })
    const providerResponse = await fetch(`https://api.paymongo.com/v1/payment_intents/${encodeURIComponent(paymentIntentId)}`, {
      headers: { Authorization: `Basic ${Buffer.from(`${secretKey}:`).toString('base64')}` },
      signal: AbortSignal.timeout(20000),
    })
    const providerData = await providerResponse.json().catch(() => ({}))
    if (!providerResponse.ok || !isRecord(providerData?.data) || !isRecord(providerData.data.attributes)) {
      return NextResponse.json({ error: 'Unable to verify the PayMongo payment intent.' }, { status: 422 })
    }
    const intent = providerData.data
    const attributes = intent.attributes
    const metadata = isRecord(attributes.metadata) ? attributes.metadata : {}
    const intentStatus = String(attributes.status || '').toLowerCase()
    if (intent.id !== paymentIntentId || Number(attributes.amount) !== expectedAmount ||
      String(attributes.currency || '').toUpperCase() !== currency ||
      String(metadata.order_id ?? '') !== orderId ||
      String(metadata.user_id ?? '') !== String(user.id) ||
      !['awaiting_payment_method', 'awaiting_next_action', 'processing', 'succeeded'].includes(intentStatus)) {
      return NextResponse.json({ error: 'The payment intent does not match this order or is no longer payable.', code: 'PAYMENT_INTENT_MISMATCH' }, { status: 422 })
    }

    const transaction = await payload.create({
      collection: 'transactions',
      data: {
        order: Number(orderId), payment_intent_id: paymentIntentId, payment_method: paymentMethod,
        amount: expectedAmount / 100, currency, status: 'pending',
      } as never,
      overrideAccess: true,
    })
    return NextResponse.json({ transactionId: String(transaction.id), status: transaction.status, reused: false }, { status: 201 })
  } catch (error) {
    console.error('[customer/checkout/transaction] POST error:', error)
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unable to record the pending transaction.' }, { status: 500 })
  }
}
