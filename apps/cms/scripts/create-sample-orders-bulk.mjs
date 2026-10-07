#!/usr/bin/env node
/**
 * Bulk sample orders across ALL merchants for member@gmail.com
 * (users id=23, customers id=7). Re-runnable: each run adds another round.
 * Run with: node scripts/create-sample-orders-bulk.mjs
 * REST-only (plain Node + global fetch).
 *
 * Per merchant: up to 2 distinct priced items -> 1 order each, statuses
 * cycled pending/accepted/preparing/delivered (stepped transitions),
 * each with order-item + transaction + tracking. Pickup fulfillment.
 */
import dotenv from 'dotenv'

dotenv.config()

const CMS_URL = (process.env.PAYLOAD_API_URL || 'http://localhost:3001/api').replace(/\/$/, '')
const API_KEY = process.env.PAYLOAD_API_KEY || ''
const USER_ID = 23
const PER_MERCHANT = 2

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
    throw new Error(`${method} ${path} -> ${res.status}: ${JSON.stringify(json)?.slice(0, 300)}`)
  }
  return json?.doc ?? json
}

const priceOf = (mp) => {
  const p = mp?.product_id && typeof mp.product_id === 'object' ? mp.product_id : {}
  const v = Number(mp?.price_override ?? p?.basePrice)
  return Number.isFinite(v) && v > 0 ? v : null
}
const nameOf = (mp) => {
  const p = mp?.product_id && typeof mp?.product_id === 'object' ? mp.product_id : {}
  return p?.name || mp?.display_title || 'Sample item'
}
const prodIdOf = (mp) => (mp?.product_id && typeof mp.product_id === 'object' ? mp.product_id.id : mp?.product_id)

async function main() {
  const cust = await api('GET', `/customers?where[user][equals]=${USER_ID}&limit=1&depth=0`)
  const customerId = cust?.docs?.[0]?.id
  if (!customerId) {
    console.error('No customers doc for users id=23 — run create-member-user.mjs first.')
    process.exit(1)
  }
  const merchants = await api('GET', '/merchants?limit=50&depth=0')
  const mids = (merchants?.docs || []).map((m) => m.id)
  console.log(`merchants: ${mids.length}, customer=${customerId}`)

  const steps = ['accepted', 'preparing', 'delivered'] // stepped from pending
  let made = 0
  let skipped = []

  for (const mid of mids) {
    const list = await api(
      'GET',
      `/merchant-products?limit=20&depth=1&where[merchant_id][equals]=${mid}&where[is_active][equals]=true&where[is_available][equals]=true`
    )
    const priced = (list?.docs || []).filter((d) => priceOf(d) != null).slice(0, PER_MERCHANT)
    if (priced.length === 0) {
      skipped.push(mid)
      continue
    }
    for (const mp of priced) {
      const unit = priceOf(mp)
      const qty = 1 + (made % 3) // 1..3
      const subtotal = unit * qty
      const depth = made % 4 // 0 pending, 1 accepted, 2 preparing, 3 delivered
      const placed = new Date(Date.now() - made * 36e5).toISOString()

      const order = await api('POST', '/orders', {
        customer: customerId,
        merchant: mid,
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
        placed_at: placed,
        notes: `Bulk sample order for member@gmail.com (merchant ${mid})`,
      })
      await api('POST', '/order-items', {
        order: order.id,
        product: prodIdOf(mp),
        merchant_product: mp.id,
        product_name_snapshot: nameOf(mp),
        price_at_purchase: unit,
        quantity: qty,
        total_price: subtotal,
      })
      let status = 'pending'
      for (let s = 0; s < depth; s++) {
        try {
          await api('PATCH', `/orders/${order.id}`, { status: steps[s] })
          status = steps[s]
        } catch (e) {
          console.log(`order ${order.id}: stop at ${status} (${String(e.message).slice(0, 120)})`)
          break
        }
      }
      const paid = status !== 'pending'
      await api('POST', '/transactions', {
        order: order.id,
        payment_intent_id: `pi_sample_${order.id}`,
        payment_method: 'gcash',
        amount: subtotal,
        currency: 'PHP',
        status: paid ? 'paid' : 'pending',
        ...(paid ? { paid_at: new Date().toISOString() } : {}),
      })
      await api('POST', '/order-tracking', {
        order: order.id,
        status,
        timestamp: new Date().toISOString(),
        description: `Bulk sample order ${status} (scripted)`,
      })
      made++
      console.log(`order ${order.id}: merchant=${mid} ${qty}x${unit}=${subtotal} status=${status}`)
    }
  }
  console.log(`done: ${made} orders across ${mids.length - skipped.length} merchants` + (skipped.length ? ` (no priced items: ${skipped.join(',')})` : ''))
}

main().catch((e) => {
  console.error(e.message || e)
  process.exit(1)
})
