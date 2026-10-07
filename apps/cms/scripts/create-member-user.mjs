#!/usr/bin/env node
/**
 * Idempotent create/verify of a unified member user for apps/web login testing.
 * Run with: node scripts/create-member-user.mjs
 * Uses the CMS REST API only (no TS imports, plain Node 20+ with global fetch).
 *
 * Target: email member@gmail.com, role member (buys+sells, admin supervises).
 * Password: MEMBER_PASSWORD env when set, else the email value (throwaway
 * local testing only, matching your request). Never logs the password.
 *
 * Flow:
 *  1. Try public POST /customer-register {role:'member'} (creates users row +
 *     companion customers row via the Users afterChange hook).
 *  2. If duplicate (user exists), try POST /users/login to verify credentials.
 *  3. If login fails and PAYLOAD_API_KEY is set, reset role/password via the
 *     service-key REST API, then re-verify login + ensure companion doc.
 */
import dotenv from 'dotenv'

dotenv.config()

const EMAIL = 'member@gmail.com'
const PASSWORD = process.env.MEMBER_PASSWORD || EMAIL
const CMS_URL = (process.env.PAYLOAD_API_URL || 'http://localhost:3001/api').replace(/\/$/, '')
const API_KEY = process.env.PAYLOAD_API_KEY || ''

const svcHeaders = () => ({
  'Content-Type': 'application/json',
  ...(API_KEY ? { Authorization: `users API-Key ${API_KEY}` } : {}),
})

async function readJson(res) {
  try {
    return await res.json()
  } catch {
    return null
  }
}

async function tryLogin() {
  const res = await fetch(`${CMS_URL}/users/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
  })
  const json = await readJson(res)
  if (res.ok && json?.user) return json
  return null
}

async function main() {
  // 1. Public member registration (idempotent attempt).
  console.log(`registering member ${EMAIL} via ${CMS_URL}/customer-register ...`)
  const reg = await fetch(`${CMS_URL}/customer-register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      firstName: 'Member',
      lastName: 'Test',
      email: EMAIL,
      password: PASSWORD,
      role: 'member',
    }),
  })
  const regJson = await readJson(reg)
  if (reg.ok) {
    console.log(`registered users id=${regJson?.userId ?? '?'} role=member`)
  } else {
    console.log(`register responded ${reg.status} (${regJson?.error ?? regJson?.message ?? 'no body'}) — continuing`)
  }

  // 2. Verify credentials work.
  let session = await tryLogin()
  if (session) {
    console.log(`login OK users id=${session.user?.id} role=${session.user?.role}`)
  } else if (!API_KEY) {
    console.error(
      'login failed and no PAYLOAD_API_KEY is set, so the password cannot be reset. ' +
        'Set PAYLOAD_API_KEY (server-to-server key) in apps/cms/.env and re-run, ' +
        'or reset the password from the Payload admin panel.'
    )
    process.exit(1)
  } else {
    // 3. Reset role/password via service key, then re-verify.
    console.log('login failed — resetting role/password via service key ...')
    const foundRes = await fetch(
      `${CMS_URL}/users?where[email][equals]=${encodeURIComponent(EMAIL)}&limit=1&depth=0`,
      { headers: svcHeaders() }
    )
    const found = await readJson(foundRes)
    const doc = found?.docs?.[0]
    if (!foundRes.ok || !doc) {
      console.error(`service-key lookup failed (${foundRes.status}). Check PAYLOAD_API_KEY/PAYLOAD_API_URL.`)
      process.exit(1)
    }
    const patchRes = await fetch(`${CMS_URL}/users/${doc.id}`, {
      method: 'PATCH',
      headers: svcHeaders(),
      body: JSON.stringify({ role: 'member', isActive: true, password: PASSWORD }),
    })
    if (!patchRes.ok) {
      const body = await readJson(patchRes)
      console.error(`password reset failed (${patchRes.status}): ${body?.message ?? body?.error ?? 'unknown'}`)
      process.exit(1)
    }
    console.log(`updated users id=${doc.id} role=member (password reset)`)
    session = await tryLogin()
    if (!session) {
      console.error('login still fails after reset — aborting.')
      process.exit(1)
    }
    console.log(`login OK after reset users id=${session.user?.id} role=${session.user?.role}`)
  }

  // 4. Ensure companion customers doc (food commerce) via new ensure endpoint.
  const token = session.token
  if (token) {
    const ensure = await fetch(`${CMS_URL}/customers/ensure`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `JWT ${token}` },
    })
    const ej = await readJson(ensure)
    if (ensure.ok) {
      console.log(`companion customers id=${ej?.customerId} (created=${ej?.created})`)
    } else {
      console.log(`customers/ensure responded ${ensure.status} — commerce may still work via hook-created doc`)
    }
  }

  console.log('done: sign in at apps/web with the email above')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
