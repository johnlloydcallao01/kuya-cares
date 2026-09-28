/**
 * Seed demo voucher data for customer id 1 (user id 3, customer@kuyacares.com)
 * so the apps/web /vouchers page can be verified end-to-end.
 *
 * Creates 5 published coupons (4 claimable + 1 expired) and claims for
 * customer 1 across Available / Used / Expired tabs. Idempotent — safe
 * to re-run (upserts by code, skips existing claims).
 *
 * Coupon create/update is admin-only in Payload access rules, so this
 * script needs an admin JWT: provide ADMIN_EMAIL + ADMIN_PASSWORD
 * (it logs in via /users/login). Claims use the service API key.
 *
 * Usage:
 *   node scripts/seed-demo-vouchers.cjs --dry-run
 *   ADMIN_EMAIL=admin@example.com ADMIN_PASSWORD=secret node scripts/seed-demo-vouchers.cjs
 */
const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const API_URL = (process.env.PAYLOAD_API_URL || 'https://cms.kuyacares.com/api').replace(/\/+$/, '');
const API_KEY = process.env.PAYLOAD_API_KEY;
const ADMIN_EMAIL = process.env.ADMIN_EMAIL;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;

const DRY_RUN = process.argv.includes('--dry-run');
const CUSTOMER_ID = 1;
const USER_ID = 3;

const now = Date.now();
const DAY = 24 * 60 * 60 * 1000;
const iso = (ms) => new Date(ms).toISOString();

const COUPONS = [
  {
    code: 'WELCOME20',
    title: '20% off your order',
    short_copy: 'Welcome treat — 20% off up to ₱100 on baskets over ₱200.',
    discount_type: 'percent',
    amount: 20,
    max_discount_amount: 100,
    minimum_basket: 200,
    usage_limit_per_user: 1,
    status: 'published',
    claimable: true,
    featured: true,
    priority: 10,
    funded_by: 'platform',
    expires_at: iso(now + 30 * DAY),
  },
  {
    code: 'FREEDEL50',
    title: '₱50 off delivery',
    short_copy: 'Knocked-off delivery fee on orders over ₱150.',
    discount_type: 'fixed_cart',
    amount: 50,
    applies_to: 'delivery_fee',
    minimum_basket: 150,
    status: 'published',
    claimable: true,
    featured: true,
    priority: 9,
    funded_by: 'platform',
    expires_at: iso(now + 14 * DAY),
  },
  {
    code: 'FLAT50',
    title: '₱50 off food',
    short_copy: 'Flat ₱50 off baskets over ₱300. While stocks last.',
    discount_type: 'fixed_cart',
    amount: 50,
    minimum_basket: 300,
    usage_limit: 100,
    status: 'published',
    claimable: true,
    featured: false,
    priority: 5,
    funded_by: 'platform',
    expires_at: iso(now + 60 * DAY),
  },
  {
    code: 'FIRSTBUY',
    title: '10% off first order',
    short_copy: 'New here? Take 10% off up to ₱50 on your first buy.',
    discount_type: 'percent',
    amount: 10,
    max_discount_amount: 50,
    first_order_only: true,
    status: 'published',
    claimable: true,
    featured: false,
    priority: 4,
    funded_by: 'platform',
    expires_at: iso(now + 90 * DAY),
  },
  {
    code: 'OLDIE10',
    title: '10% off (expired demo)',
    short_copy: 'This one already expired — shows the Expired tab.',
    discount_type: 'percent',
    amount: 10,
    max_discount_amount: 30,
    status: 'published',
    claimable: true,
    featured: false,
    priority: 1,
    funded_by: 'platform',
    starts_at: iso(now - 60 * DAY),
    expires_at: iso(now - 1 * DAY),
  },
];

// coupon code -> claim status to leave behind for customer 1
const CLAIMS = [
  { code: 'WELCOME20', status: 'claimed' },
  { code: 'FREEDEL50', status: 'claimed' },
  { code: 'FLAT50', status: 'used' }, // demo: marked used so Used tab has data
  { code: 'OLDIE10', status: 'claimed' }, // expired coupon -> Expired tab
];

const serviceHeaders = () => {
  const h = { 'Content-Type': 'application/json' };
  if (API_KEY) h['Authorization'] = `users API-Key ${API_KEY}`;
  return h;
};

async function api(method, path, { token, body } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  else if (API_KEY) headers['Authorization'] = `users API-Key ${API_KEY}`;
  const res = await fetch(`${API_URL}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, data };
}

async function main() {
  console.log(`Target: ${API_URL} (customer=${CUSTOMER_ID}, user=${USER_ID})${DRY_RUN ? ' [DRY RUN]' : ''}`);

  // 0. Verify the user <-> customer connection.
  const userRes = await api('GET', `/users/${USER_ID}`);
  if (!userRes.ok) throw new Error(`User ${USER_ID} lookup failed (${userRes.status}): ${JSON.stringify(userRes.data).slice(0, 200)}`);
  console.log(`User ${USER_ID}: ${userRes.data.email} (role=${userRes.data.role})`);

  const custRes = await api('GET', `/customers/${CUSTOMER_ID}`);
  if (!custRes.ok) throw new Error(`Customer ${CUSTOMER_ID} lookup failed (${custRes.status})`);
  const linkedUser = typeof custRes.data.user === 'object' ? custRes.data.user.id : custRes.data.user;
  if (String(linkedUser) !== String(USER_ID)) {
    throw new Error(`Customer ${CUSTOMER_ID} is linked to user ${linkedUser}, not user ${USER_ID}. Aborting.`);
  }
  console.log(`Customer ${CUSTOMER_ID} linked to user ${USER_ID}. Connection OK.`);

  // Coupon write is admin-only. Same principle as the product seed scripts:
  // try the service API key first; fall back to an admin JWT only if 403.
  let adminToken = null;
  const probe = DRY_RUN
    ? { ok: true }
    : await api('POST', '/coupons', {
        body: {
          code: '__PROBE__',
          discount_type: 'fixed_cart',
          amount: 1,
          status: 'draft',
          funded_by: 'platform',
        },
      });
  if (!DRY_RUN && probe.status === 403) {
    console.log('Service key got 403 on /coupons (admin-only) — trying admin login...');
    if (!(ADMIN_EMAIL && ADMIN_PASSWORD)) {
      throw new Error(
        'ADMIN_EMAIL + ADMIN_PASSWORD env required (coupon create/update is admin-only). ' +
          'Example: ADMIN_EMAIL=a@b.com ADMIN_PASSWORD=secret node scripts/seed-demo-vouchers.cjs',
      );
    }
    const login = await api('POST', '/users/login', { body: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD } });
    if (!login.ok || !login.data.token) {
      throw new Error(`Admin login failed (${login.status}): ${JSON.stringify(login.data).slice(0, 200)}`);
    }
    adminToken = login.data.token;
    console.log(`Admin login OK (${ADMIN_EMAIL}).`);
  } else if (!DRY_RUN && !probe.ok) {
    throw new Error(`Probe coupon create failed (${probe.status}): ${JSON.stringify(probe.data).slice(0, 200)}`);
  } else if (!DRY_RUN) {
    // Probe row actually got created (service key worked) — remove it.
    const probeId = probe.data?.doc?.id ?? probe.data?.id;
    if (probeId) await api('DELETE', `/coupons/${probeId}`, { token: adminToken });
    console.log('Service key can write coupons — no admin login needed.');
  }

  // 1. Upsert coupons by code.
  const couponIds = {};
  for (const c of COUPONS) {
    const found = await api('GET', `/coupons?where[code][equals]=${encodeURIComponent(c.code)}&limit=1`);
    const existing = found.data?.docs?.[0];
    if (DRY_RUN) {
      console.log(`[dry-run] would ${existing ? 'PATCH' : 'POST'} coupon ${c.code}`);
      if (existing) couponIds[c.code] = existing.id;
      continue;
    }
    if (existing) {
      const up = await api('PATCH', `/coupons/${existing.id}`, { token: adminToken, body: c });
      if (!up.ok) throw new Error(`PATCH coupon ${c.code} failed (${up.status}): ${JSON.stringify(up.data).slice(0, 300)}`);
      couponIds[c.code] = existing.id;
      console.log(`PATCH coupon ${c.code} (id=${existing.id})`);
    } else {
      const created = await api('POST', '/coupons', { token: adminToken, body: c });
      if (!created.ok) throw new Error(`POST coupon ${c.code} failed (${created.status}): ${JSON.stringify(created.data).slice(0, 300)}`);
      couponIds[c.code] = created.data.id;
      console.log(`POST coupon ${c.code} (id=${created.data.id})`);
    }
  }

  // 2. Claims for customer 1 (service key is allowed).
  for (const cl of CLAIMS) {
    const couponId = couponIds[cl.code];
    if (!couponId && !DRY_RUN) throw new Error(`Missing coupon id for ${cl.code}`);
    if (DRY_RUN) {
      console.log(`[dry-run] would ensure claim ${cl.code} -> ${cl.status} for customer ${CUSTOMER_ID}`);
      continue;
    }
    const found = await api(
      'GET',
      `/coupon-claims?where[coupon][equals]=${couponId}&where[customer][equals]=${CUSTOMER_ID}&limit=1`,
    );
    let claim = found.data?.docs?.[0];
    if (!claim) {
      const created = await api('POST', '/coupon-claims', {
        body: { coupon: couponId, customer: CUSTOMER_ID, status: 'claimed' },
      });
      if (!created.ok) throw new Error(`POST claim ${cl.code} failed (${created.status}): ${JSON.stringify(created.data).slice(0, 300)}`);
      claim = created.data;
      console.log(`POST claim ${cl.code} (id=${claim.id})`);
    } else {
      console.log(`Claim ${cl.code} exists (id=${claim.id}, status=${claim.status})`);
    }
    if (claim.status !== cl.status) {
      const up = await api('PATCH', `/coupon-claims/${claim.id}`, { body: { status: cl.status } });
      if (!up.ok) throw new Error(`PATCH claim ${cl.code} failed (${up.status})`);
      console.log(`PATCH claim ${cl.code} status -> ${cl.status}`);
    }
  }

  // 3. Verify through the customer BFF (what /vouchers actually calls).
  if (!DRY_RUN) {
    const q = `userId=${USER_ID}`;
    const claimable = await api('GET', `/customer/vouchers/claimable?${q}&limit=50`);
    const avail = await api('GET', `/customer/vouchers/mine?${q}&filter=available`);
    const used = await api('GET', `/customer/vouchers/mine?${q}&filter=used`);
    const expired = await api('GET', `/customer/vouchers/mine?${q}&filter=expired`);
    console.log('--- BFF verification ---');
    console.log(`claimable: ${(claimable.data?.data || []).map((v) => v.code).join(', ') || '(none)'}`);
    console.log(`mine/available: ${(avail.data?.data || []).map((v) => v.code).join(', ') || '(none)'}`);
    console.log(`mine/used: ${(used.data?.data || []).map((v) => v.code).join(', ') || '(none)'}`);
    console.log(`mine/expired: ${(expired.data?.data || []).map((v) => v.code).join(', ') || '(none)'}`);
  }

  console.log('Done.');
}

main().catch((e) => {
  console.error(`FAILED: ${e.message}`);
  process.exit(1);
});
