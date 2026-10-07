#!/usr/bin/env node
/**
 * Seeds wallet records for member@gmail.com (users id=23, customers id=7):
 * wallet + topups + ledger transactions with consistent counters/balances.
 * Run with: node scripts/create-sample-wallet.mjs
 * REST-only. Re-runnable: skips wallet create if one exists for customer 7
 * (one wallet per customer), but use --force to rebuild it fresh.
 * Final state: balance PHP 2500, points 420.
 */
import dotenv from 'dotenv'

dotenv.config()

const CMS_URL = (process.env.PAYLOAD_API_URL || 'http://localhost:3001/api').replace(/\/$/, '')
const API_KEY = process.env.PAYLOAD_API_KEY || ''
const CUSTOMER_ID = 7
const FORCE = process.argv.includes('--force')

if (!API_KEY) {
  console.error('PAYLOAD_API_KEY is required (service-key REST writes).')
  process.exit(1)
}
const H = { 'Content-Type': 'application/json', Authorization: `users API-Key ${API_KEY}` }
const now = () => new Date().toISOString()

async function api(method, path, body) {
  const res = await fetch(`${CMS_URL}${path}`, {
    method,
    headers: H,
    body: body ? JSON.stringify(body) : undefined,
  })
  const json = await res.json().catch(() => null)
  if (!res.ok) throw new Error(`${method} ${path} -> ${res.status}: ${JSON.stringify(json)?.slice(0, 300)}`)
  return json?.doc ?? json
}

async function main() {
  const existing = await api('GET', `/wallets?where[customer][equals]=${CUSTOMER_ID}&limit=1&depth=0`)
  let wallet = existing?.docs?.[0]
  if (wallet && !FORCE) {
    console.log(`wallet id=${wallet.id} already exists (balance=${wallet.balance}). Use --force to rebuild.`)
    return
  }
  if (wallet && FORCE) {
    await api('DELETE', `/wallets/${wallet.id}`)
    console.log(`deleted wallet id=${wallet.id} for rebuild`)
  }

  wallet = await api('POST', '/wallets', {
    customer: CUSTOMER_ID,
    balance: 2500,
    currency: 'PHP',
    status: 'active',
    total_topped_up: 5000,
    total_spent: 1800,
    total_cashback: 180,
    total_refunded: 350,
    points_balance: 420,
    points_earned: 500,
    points_redeemed: 80,
  })
  console.log(`wallet id=${wallet.id} balance=2500 points=420`)
  const W = wallet.id

  // Top-up intents (2 paid funding the ledger + 1 pending).
  for (const t of [
    { amount: 3000, gateway: 'paymongo', payment_intent_id: 'pi_sample_topup_3000', status: 'paid', paid_at: now() },
    { amount: 2000, gateway: 'paymongo', payment_intent_id: 'pi_sample_topup_2000', status: 'paid', paid_at: now() },
    { amount: 1500, gateway: 'paymongo', payment_intent_id: 'pi_sample_topup_1500', status: 'pending' },
  ]) {
    const d = await api('POST', '/wallet-topups', { wallet: W, customer: CUSTOMER_ID, currency: 'PHP', ...t })
    console.log(`topup id=${d.id} ${t.amount} ${t.status}`)
  }

  // Ledger, chronological. balance_after chains to final 2500.
  const legs = [
    { type: 'topup', amount: 3000, balance_after: 3000, points: 0, points_balance_after: 0, payment_intent_id: 'pi_sample_topup_3000', gateway: 'paymongo' },
    { type: 'earn', amount: 0, balance_after: 3000, points: 500, points_balance_after: 500 },
    { type: 'topup', amount: 2000, balance_after: 5000, points: 0, points_balance_after: 500, payment_intent_id: 'pi_sample_topup_2000', gateway: 'paymongo' },
    { type: 'payment', amount: -1800, balance_after: 3200, points: 0, points_balance_after: 500, order: 4 },
    { type: 'redeem', amount: 0, balance_after: 3200, points: -80, points_balance_after: 420 },
    { type: 'cashback', amount: 180, balance_after: 3380, points: 0, points_balance_after: 420, order: 4 },
    { type: 'refund', amount: 350, balance_after: 3730, points: 0, points_balance_after: 420 },
    { type: 'withdrawal', amount: -1230, balance_after: 2500, points: 0, points_balance_after: 420 },
  ]
  let n = 0
  for (const leg of legs) {
    n++
    const d = await api('POST', '/wallet-transactions', {
      wallet: W,
      customer: CUSTOMER_ID,
      status: 'posted',
      idempotency_key: `sample-w7-${n}`,
      ...leg,
    })
    console.log(`tx id=${d.id} ${leg.type} ${leg.amount} -> ${leg.balance_after}`)
  }
  console.log(`done: wallet ${W} + 3 topups + ${legs.length} ledger txns for member@gmail.com`)
}

main().catch((e) => {
  console.error(e.message || e)
  process.exit(1)
})
