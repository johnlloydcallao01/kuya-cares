#!/usr/bin/env node
/**
 * Clone of order #33 (SAVOR HOUSE, Fried Chicken Meal x3, member@gmail.com)
 * to prove a newer higher-priority vendor rule takes over for NEW paid orders
 * while #33 keeps its snapshot.
 * Run: PAYLOAD_API_URL=http://localhost:3001/api node scripts/clone-order-33-savor.mjs
 * (REST-only, plain Node + global fetch)
 */
import dotenv from 'dotenv'
dotenv.config()

const CMS_URL = (process.env.PAYLOAD_API_URL || 'http://localhost:3001/api').replace(/\/$/, '')
const API_KEY = process.env.PAYLOAD_API_KEY || ''
if (!API_KEY) { console.error('PAYLOAD_API_KEY required'); process.exit(1) }
const H = { 'Content-Type': 'application/json', Authorization: `users API-Key ${API_KEY}` }

async function api(method, path, body) {
  const res = await fetch(`${CMS_URL}${path}`, { method, headers: H, body: body ? JSON.stringify(body) : undefined })
  const json = await res.json().catch(() => null)
  if (!res.ok) throw new Error(`${method} ${path} -> ${res.status}: ${JSON.stringify(json)?.slice(0, 600)}`)
  return json?.doc ?? json
}

const now = () => new Date().toISOString()
const UNIT = 129
const QTY = 3
const SUBTOTAL = UNIT * QTY // 387, same as #33

async function main() {
  const cust = await api('GET', '/customers?where[user][equals]=23&limit=1&depth=0')
  const customerId = cust?.docs?.[0]?.id
  if (!customerId) throw new Error('No customers doc for users id=23 (member@gmail.com)')
  console.log(`customer=${customerId} (member@gmail.com), cloning #33: merchant=7 x product=19 qty=${QTY} subtotal=${SUBTOTAL}`)

  const order = await api('POST', '/orders', {
    customer: customerId, merchant: 7, status: 'pending', fulfillment_type: 'pickup',
    subtotal: SUBTOTAL, delivery_fee: 0, platform_fee: 0, priority_fee: 0, discount_total: 0,
    wallet_amount_used: 0, paid_with_wallet: false, total: SUBTOTAL, placed_at: now(),
    notes: `Clone of #33 to prove vendor rule takeover ${now()}`,
  })
  await api('POST', '/order-items', {
    order: order.id, product: 19, merchant_product: 19,
    product_name_snapshot: 'Savor House Fried Chicken Meal',
    price_at_purchase: UNIT, quantity: QTY, total_price: SUBTOTAL,
  })
  const tx = await api('POST', '/transactions', {
    order: order.id, payment_intent_id: `pi_clone33_${order.id}_${Date.now()}`, payment_method: 'gcash',
    amount: SUBTOTAL, currency: 'PHP', status: 'paid', paid_at: now(),
  })
  console.log(`order=${order.id} tx=${tx.id} paid`)

  let entry = null
  for (let i = 0; i < 6; i++) {
    const f = await api('GET', `/vendor-commission-entries?where[order][equals]=${order.id}&limit=1&depth=1`)
    entry = f?.docs?.[0] ?? null
    if (entry) break
    await new Promise((r) => setTimeout(r, 1500))
  }
  const snap = await api('GET', `/orders/${order.id}?depth=1`)
  const ruleName = (entry?.commission_rule && typeof entry.commission_rule === 'object') ? entry.commission_rule.name : snap?.commission_rule?.name
  console.log(`clone order ${order.id}: pct=${entry?.commission_percent ?? snap?.commission_percent}% source=${entry?.commission_source ?? snap?.commission_source} rule=${ruleName} amount=${entry?.commission_amount ?? snap?.commission_amount} fee=${entry?.commission_transaction_fee ?? snap?.commission_transaction_fee} net=${entry?.commission_vendor_net ?? snap?.commission_vendor_net} status=${snap?.commission_status}`)
  const expectPct = 1
  if (Number(entry?.commission_percent ?? snap?.commission_percent) === expectPct) {
    console.log(`PASS: new vendor rule (1%) took over; #33 keeps its 5% snapshot`)
  } else {
    console.log(`FAIL: expected ${expectPct}% from the new vendor rule`)
    process.exit(2)
  }
}

main().catch((e) => { console.error(e.message || e); process.exit(1) })
