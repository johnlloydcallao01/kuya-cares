#!/usr/bin/env node
/**
 * Seeds 4 SAMPLE paid member-membership-payments (manual provider, realistic shape)
 * so the Member fees card on /finance/commission-earnings has data.
 * Clearly tagged SAMPLE in references. Does NOT flip any user's membership status.
 * Run: node scripts/seed-sample-member-fees.mjs
 * (REST-only, plain Node + global fetch)
 */
import dotenv from 'dotenv'
import { randomUUID } from 'node:crypto'
dotenv.config()

const CMS_URL = (process.env.PAYLOAD_API_URL || 'http://localhost:3001/api').replace(/\/$/, '')
const API_KEY = process.env.PAYLOAD_API_KEY || ''
if (!API_KEY) { console.error('PAYLOAD_API_KEY required'); process.exit(1) }
const H = { 'Content-Type': 'application/json', Authorization: `users API-Key ${API_KEY}` }

async function api(method, path, body) {
  const res = await fetch(`${CMS_URL}${path}`, { method, headers: H, body: body ? JSON.stringify(body) : undefined })
  const json = await res.json().catch(() => null)
  if (!res.ok) throw new Error(`${method} ${path} -> ${res.status}: ${JSON.stringify(json)?.slice(0, 500)}`)
  return json?.doc ?? json
}

const daysAgo = (n) => new Date(Date.now() - n * 24 * 60 * 60 * 1000).toISOString()
const FEE = 50

async function main() {
  // resolve 4 member users to attach sample payments to (test accounts)
  const found = await api('GET', '/users?where[role][equals]=member&limit=20&depth=0')
  const ids = (found?.docs || []).map((d) => d.id)
  if (!ids.length) throw new Error('No member users found')
  console.log(`member users: ${ids.join(',')}`)
  const picks = [0, 1, 2, 3].map((i) => ids[i % ids.length])
  const paidAts = [daysAgo(2), daysAgo(9), daysAgo(16), daysAgo(25)]

  for (let i = 0; i < 4; i++) {
    const uid = picks[i]
    const doc = await api('POST', '/member-membership-payments', {
      user: uid,
      amount: FEE,
      currency: 'PHP',
      status: 'paid',
      paymentProvider: 'manual',
      paymentReference: `MAN-MEM-SAMPLE-${uid}-${Date.now()}-${i}`,
      providerReference: `sample_manual_${Date.now()}_${i}_${randomUUID().slice(0, 8)}`,
      memberMembershipIdempotencyKey: randomUUID(),
      paidAt: paidAts[i],
    })
    console.log(`sample paid #${doc.id}: user=${uid} amount=${FEE} paidAt=${paidAts[i]}`)
  }
  console.log('done: 4 sample paid member fees (SAMPLE-tagged, no user status changed)')
}

main().catch((e) => { console.error(e.message || e); process.exit(1) })
