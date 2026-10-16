#!/usr/bin/env node
/**
 * Commission proof fixtures for member@gmail.com (users 23 / customers 7).
 * Creates 3 PAID pickup orders from different merchants to hit each rule:
 *  - merchant 6 BEAUTY REPUBLIC (vendor 7) -> vendor rule 3% (priority 10)
 *  - merchant 9 HOMELINE (cat Home & Living id 4) -> category rule 7% (priority 5)
 *  - merchant 7 SAVOR HOUSE (vendor 8, cat Food & Beverage) -> global 5% (priority 1)
 * Run: node scripts/create-paid-commission-fixtures.mjs
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
  if (!res.ok) throw new Error(`${method} ${path} -> ${res.status}: ${JSON.stringify(json)?.slice(0, 800)}`)
  return json?.doc ?? json
}

const now = () => new Date().toISOString()
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

const CASES = [
  { label: 'VENDOR_RULE_3PCT', merchant: 6, mpid: 16, qty: 2, expect: { pct: 3, source: 'vendor', rule: 2 } },
  { label: 'CATEGORY_RULE_7PCT', merchant: 9, mpid: 27, qty: 1, expect: { pct: 7, source: 'category', rule: 3 } },
  { label: 'GLOBAL_RULE_5PCT', merchant: 7, mpid: 19, qty: 3, expect: { pct: 5, source: 'global', rule: 1 } },
]

async function main() {
  const cust = await api('GET', '/customers?where[user][equals]=23&limit=1&depth=0')
  const customerId = cust?.docs?.[0]?.id
  if (!customerId) throw new Error('No customers doc for users id=23')
  console.log(`customer=${customerId} member@gmail.com`)

  const results = []
  for (const c of CASES) {
    const mp = await api('GET', `/merchant-products/${c.mpid}?depth=1`)
    const unit = priceOf(mp)
    if (!unit) throw new Error(`mpid ${c.mpid} has no price`)
    const subtotal = unit * c.qty
    const tag = `Commission fixture ${c.label} ${now()}`

    const order = await api('POST', '/orders', {
      customer: customerId, merchant: c.merchant, status: 'pending', fulfillment_type: 'pickup',
      subtotal, delivery_fee: 0, platform_fee: 0, priority_fee: 0, discount_total: 0,
      wallet_amount_used: 0, paid_with_wallet: false, total: subtotal, placed_at: now(), notes: tag,
    })
    await api('POST', '/order-items', {
      order: order.id, product: prodIdOf(mp), merchant_product: mp.id,
      product_name_snapshot: nameOf(mp), price_at_purchase: unit, quantity: c.qty, total_price: subtotal,
    })
    const tx = await api('POST', '/transactions', {
      order: order.id, payment_intent_id: `pi_commfix_${order.id}_${Date.now()}`, payment_method: 'gcash',
      amount: subtotal, currency: 'PHP', status: 'paid', paid_at: now(),
    })
    await api('POST', '/order-tracking', { order: order.id, status: 'pending', timestamp: now(), description: tag }).catch(() => null)

    // read-back (commission accrues in Transactions.afterChange; poll briefly)
    let entry = null
    for (let i = 0; i < 6; i++) {
      const found = await api('GET', `/vendor-commission-entries?where[order][equals]=${order.id}&limit=1&depth=0`)
      entry = found?.docs?.[0] ?? null
      if (entry) break
      await new Promise((r) => setTimeout(r, 1500))
    }
    const snap = await api('GET', `/orders/${order.id}?depth=0`)
    const gotPct = entry?.commission_percent ?? snap?.commission_percent
    const gotSrc = entry?.commission_source ?? snap?.commission_source
    const gotRule = (entry?.commission_rule && typeof entry.commission_rule === 'object' ? entry.commission_rule.id : entry?.commission_rule) ?? snap?.commission_rule
    const ok = Number(gotPct) === c.expect.pct
    results.push({ case: c.label, order: order.id, tx: tx.id, subtotal, expect: c.expect, got: { pct: gotPct, source: gotSrc, rule: gotRule, amount: entry?.commission_amount ?? snap?.commission_amount, net: entry?.commission_vendor_net ?? snap?.commission_vendor_net, status: snap?.commission_status }, pass: ok })
    console.log(`${c.label}: order=${order.id} subtotal=${subtotal} expect=${c.expect.pct}%/${c.expect.source}/rule${c.expect.rule} got=${gotPct}%/${gotSrc}/rule${JSON.stringify(gotRule)} amount=${entry?.commission_amount ?? snap?.commission_amount} net=${entry?.commission_vendor_net ?? snap?.commission_vendor_net} status=${snap?.commission_status} ${ok ? 'PASS' : 'FAIL'}`)
  }
  const failed = results.filter((r) => !r.pass)
  console.log(failed.length === 0 ? `DONE: all ${results.length} commission fixtures PASS` : `DONE: ${failed.length}/${results.length} FAILED`)
  if (failed.length) process.exit(2)
}

main().catch((e) => { console.error(e.message || e); process.exit(1) })
