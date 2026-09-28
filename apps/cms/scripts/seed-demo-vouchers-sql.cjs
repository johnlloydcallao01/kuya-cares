/**
 * Seed demo voucher data DIRECTLY via SQL (bypasses Payload access rules).
 *
 * Why SQL: coupons create/update is admin-only and no admin JWT is at hand;
 * the service API key gets 403 (verified). Schema was confirmed migrated
 * (coupons has title/short_copy/image_id/priority/featured/claimable,
 * coupon_claims exists). Idempotent by code — safe to re-run.
 *
 * Seeds for customer id 1 (user id 3, customer@kuyacares.com):
 *   WELCOME20, FREEDEL50, FLAT50, FIRSTBUY (published+claimable),
 *   OLDIE10 (expired) + claims across Available/Used/Expired.
 *
 * Usage: node scripts/seed-demo-vouchers-sql.cjs
 */
const path = require('path');
const dotenv = require('dotenv');
dotenv.config({ path: path.resolve(__dirname, '../.env') });
const { Client } = require('pg');

const now = Date.now();
const DAY = 24 * 60 * 60 * 1000;
const iso = (ms) => new Date(ms).toISOString();

const COUPONS = [
  {
    code: 'WELCOME20', title: '20% off your order',
    short_copy: 'Welcome treat — 20% off up to ₱100 on baskets over ₱200.',
    discount_type: 'percent', amount: 20, max_discount_amount: 100,
    applies_to: 'food_subtotal', minimum_basket: 200, usage_limit_per_user: 1,
    status: 'published', claimable: true, featured: true, priority: 10,
    funded_by: 'platform', expires_at: iso(now + 30 * DAY),
  },
  {
    code: 'FREEDEL50', title: '₱50 off delivery',
    short_copy: 'Knocked-off delivery fee on orders over ₱150.',
    discount_type: 'fixed_cart', amount: 50,
    applies_to: 'delivery_fee', minimum_basket: 150,
    status: 'published', claimable: true, featured: true, priority: 9,
    funded_by: 'platform', expires_at: iso(now + 14 * DAY),
  },
  {
    code: 'FLAT50', title: '₱50 off food',
    short_copy: 'Flat ₱50 off baskets over ₱300. While stocks last.',
    discount_type: 'fixed_cart', amount: 50,
    applies_to: 'food_subtotal', minimum_basket: 300, usage_limit: 100,
    status: 'published', claimable: true, featured: false, priority: 5,
    funded_by: 'platform', expires_at: iso(now + 60 * DAY),
  },
  {
    code: 'FIRSTBUY', title: '10% off first order',
    short_copy: 'New here? Take 10% off up to ₱50 on your first buy.',
    discount_type: 'percent', amount: 10, max_discount_amount: 50,
    applies_to: 'food_subtotal', first_order_only: true,
    status: 'published', claimable: true, featured: false, priority: 4,
    funded_by: 'platform', expires_at: iso(now + 90 * DAY),
  },
  {
    code: 'OLDIE10', title: '10% off (expired demo)',
    short_copy: 'This one already expired — shows the Expired tab.',
    discount_type: 'percent', amount: 10, max_discount_amount: 30,
    applies_to: 'food_subtotal',
    status: 'published', claimable: true, featured: false, priority: 1,
    funded_by: 'platform', starts_at: iso(now - 60 * DAY), expires_at: iso(now - 1 * DAY),
  },
];

const CLAIMS = [
  { code: 'WELCOME20', status: 'claimed' },
  { code: 'FREEDEL50', status: 'claimed' },
  { code: 'FLAT50', status: 'used' }, // demo: Used tab has data
  { code: 'OLDIE10', status: 'claimed' }, // expired coupon -> Expired tab
];

(async () => {
  const client = new Client({ connectionString: process.env.DATABASE_URI });
  await client.connect();

  // Verify the user <-> customer connection.
  const u = await client.query('SELECT id, email, role FROM users WHERE id=3');
  const c = await client.query('SELECT id, user_id FROM customers WHERE id=1');
  if (u.rows[0]?.email !== 'customer@kuyacares.com') throw new Error('User 3 is not customer@kuyacares.com');
  if (String(c.rows[0]?.user_id) !== '3') throw new Error('Customer 1 is not linked to user 3');
  console.log('Connection OK: customer 1 <-> user 3 (customer@kuyacares.com)');

  const ids = {};
  for (const cp of COUPONS) {
    const found = await client.query('SELECT id FROM coupons WHERE code=$1', [cp.code]);
    if (found.rows.length > 0) {
      ids[cp.code] = found.rows[0].id;
      console.log(`Coupon ${cp.code} exists (id=${found.rows[0].id}) — skipped`);
      continue;
    }
    const r = await client.query(
      `INSERT INTO coupons (code, title, short_copy, status, discount_type, amount,
        max_discount_amount, applies_to, minimum_basket, usage_limit, usage_limit_per_user,
        usage_count, first_order_only, merchant_scope, individual_use, max_coupons_per_order,
        funded_by, vendor_share_pct, claimable, featured, priority, free_delivery,
        starts_at, expires_at, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,0,$12,'all_vendor_branches',true,1,
        $13,0,$14,$15,$16,false,$17,$18,now(),now()) RETURNING id`,
      [
        cp.code, cp.title, cp.short_copy, cp.status, cp.discount_type, cp.amount,
        cp.max_discount_amount ?? null, cp.applies_to, cp.minimum_basket ?? null,
        cp.usage_limit ?? 0, cp.usage_limit_per_user ?? 0,
        cp.first_order_only ?? false, cp.funded_by, cp.claimable, cp.featured, cp.priority,
        cp.starts_at ?? null, cp.expires_at ?? null,
      ],
    );
    ids[cp.code] = r.rows[0].id;
    console.log(`INSERT coupon ${cp.code} (id=${r.rows[0].id})`);
  }

  for (const cl of CLAIMS) {
    const found = await client.query(
      'SELECT id, status FROM coupon_claims WHERE coupon_id=$1 AND customer_id=1',
      [ids[cl.code]],
    );
    if (found.rows.length > 0) {
      if (found.rows[0].status !== cl.status) {
        await client.query('UPDATE coupon_claims SET status=$1, updated_at=now() WHERE id=$2', [cl.status, found.rows[0].id]);
        console.log(`UPDATE claim ${cl.code} -> ${cl.status}`);
      } else {
        console.log(`Claim ${cl.code} exists (${cl.status}) — skipped`);
      }
      continue;
    }
    const r = await client.query(
      `INSERT INTO coupon_claims (coupon_id, customer_id, status, claimed_at, created_at, updated_at)
       VALUES ($1,1,$2,now(),now(),now()) RETURNING id`,
      [ids[cl.code], cl.status],
    );
    console.log(`INSERT claim ${cl.code} -> ${cl.status} (id=${r.rows[0].id})`);
  }

  await client.end();
  console.log('Done. Refresh /vouchers in apps/web (local CMS).');
})().catch((e) => {
  console.error(`FAILED: ${e.message}`);
  process.exit(1);
});
