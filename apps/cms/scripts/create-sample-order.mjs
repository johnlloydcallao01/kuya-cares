#!/usr/bin/env node
/**
 * Creates a sample food order (+ items + transaction + tracking) for the
 * member test user member@gmail.com (users id=23, customers id=7).
 * Run with: node scripts/create-sample-order.mjs
 * REST-only (plain Node + global fetch). Idempotent-ish: every run creates
 * ONE new order set tagged in notes (re-running creates another sample).
 *
 * Sample: merchant 9 x merchant-product 27 (Furniture Repair Service Call,
 * doble-check price live) x2, pickup, paid via gcash.
 */
import dotenv from 'dotenv'

dotenv.config()

const CMS_URL = (process.env.PAYLOAD_API_URL || 'http://localhost:3001/api').replace(/\/$/, '')
const API_KEY = process.env.PAYLOAD_API_KEY || ''
const EMAIL = 'member@gmail.com'

const MERCHANT_ID = 9
const MERCHANT_PRODUCT_ID = 27
const PRODUCT_ID = 27
const QTY = 2

if (!API_KEY) {
  console.error('PAYLOAD_API_KEY is required (service-key REST writes).')
  process.exit(1)
}
const H = { 'Content-Type': 'application/json', Authorization: `users API-Key ${API_KEY}` }

async function api(method, path, body) {
  const res = await fetch(`${CMS_URL}${path}`, {
    method,
    headers: H,
    body: body ? JSON.stringify(body) : undefined,
  })
  const json = await res.json().catch(() => null)
  if (!res.ok) {
    console.error(`${method} ${path} -> ${res.status}: ${JSON.stringify(json)?.slice(0, 500)}`)
    process.exit(1)
  }
  return json?.doc ?? json
}

const now = () => new Date().toISOString()

async function main() {
  // 0. Resolve customer for the member user + live price check.
  const found = await api('GET', `/customers?where[user][equals]=23&limit=1&depth=0`)
  const customer = found?.docs?.[0]
  if (!customer) {
    console.error('No customers doc for users id=23 — run create-member-user.mjs first.')
    process.exit(1)
  }
  const mp = await api('GET', `/merchant-products/${MERCHANT_PRODUCT_ID}?depth=1`)
  const base = mp?.product_id && typeof mp.product_id === 'object' ? mp.product_id : {}
  const unit = Number(mp?.price_override ?? base?.basePrice)
  if (!Number.isFinite(unit) || unit <= 0) {
    console.error(`merchant-product ${MERCHANT_PRODUCT_ID} has no usable price.`)
    process.exit(1)
  }
  const name = base?.name || mp?.display_title || 'Sample item'
  const subtotal = unit * QTY
  console.log(`customer=${customer.id} merchant=${MERCHANT_ID} item="${name}" ${QTY}x${unit}=${subtotal}`)

  // 1. Order (pickup keeps it free of delivery-quote/Lalamove legs).
  const order = await api('POST', '/orders', {
    customer: customer.id,
    merchant: MERCHANT_ID,
    status: 'pending',
    fulfillment_type: 'pickup',
    subtotal,
    delivery_fee: 0,
    platform_fee: 0,
    priority_fee: 0,
    discount_total: 0,
    wallet_amount_used: 0,
    paid_with_wallet: false,
    total: subtotal,
    placed_at: now(),
    notes: `Sample order for ${EMAIL} (scripted, pickup)`,
  })
  console.log(`order id=${order.id}`)

  // 2. Order item with price snapshot.
  const item = await api('POST', '/order-items', {
    order: order.id,
    product: PRODUCT_ID,
    merchant_product: MERCHANT_PRODUCT_ID,
    product_name_snapshot: name,
    price_at_purchase: unit,
    quantity: QTY,
    total_price: subtotal,
  })
  console.log(`order-item id=${item.id}`)

  // 3. Transaction (paid).
  const tx = await api('POST', '/transactions', {
    order: order.id,
    payment_intent_id: `pi_sample_${order.id}`,
    payment_method: 'gcash',
    amount: subtotal,
    currency: 'PHP',
    status: 'paid',
    paid_at: now(),
  })
  console.log(`transaction id=${tx.id} status=${tx.status}`)

  // 4. Tracking entry.
  const track = await api('POST', '/order-tracking', {
    order: order.id,
    status: 'pending',
    timestamp: now(),
    description: 'Sample order placed (scripted)',
  })
  console.log(`order-tracking id=${track.id}`)

  console.log(`done: order ${order.id} + 1 item + paid transaction + tracking for ${EMAIL}`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
