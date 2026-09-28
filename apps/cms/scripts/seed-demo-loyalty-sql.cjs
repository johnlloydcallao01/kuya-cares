/**
 * Seed demo loyalty data DIRECTLY via SQL (bypasses Payload access rules).
 *
 * Why SQL: point-rules/rewards/achievements create is admin-only and no
 * admin JWT is at hand (same situation as seed-demo-vouchers-sql.cjs).
 * Schema verified migrated. Idempotent — safe to re-run.
 *
 * Seeds: 3 earn rules, 5 rewards, 4 achievements, +500 demo earn lot for
 * customer id 1 (user id 3, customer@kuyacares.com) so /points has data.
 *
 * Usage: node scripts/seed-demo-loyalty-sql.cjs
 */
const path = require('path');
const dotenv = require('dotenv');
dotenv.config({ path: path.resolve(__dirname, '../.env') });
const { Client } = require('pg');

const now = Date.now();
const DAY = 24 * 60 * 60 * 1000;
const iso = (ms) => new Date(ms).toISOString();

(async () => {
  const client = new Client({ connectionString: process.env.DATABASE_URI });
  await client.connect();

  const u = await client.query('SELECT id, email FROM users WHERE id=3');
  const c = await client.query('SELECT id, user_id FROM customers WHERE id=1');
  if (u.rows[0]?.email !== 'customer@kuyacares.com' || String(c.rows[0]?.user_id) !== '3') {
    throw new Error('Expected customer 1 <-> user 3 (customer@kuyacares.com)');
  }
  console.log('Connection OK: customer 1 <-> user 3');

  // 1. Earn rules.
  const rules = [
    { event: 'order_delivered', points: 0, rate_per_peso: 0.1, min_order_total: 100, cap_points: 500 },
    { event: 'review', points: 25, rate_per_peso: 0, min_order_total: 0, cap_points: 0 },
    { event: 'first_order', points: 100, rate_per_peso: 0, min_order_total: 0, cap_points: 0 },
  ];
  for (const r of rules) {
    const f = await client.query('SELECT id FROM point_rules WHERE event=$1', [r.event]);
    if (f.rows.length > 0) {
      console.log(`Rule ${r.event} exists — skipped`);
      continue;
    }
    const ins = await client.query(
      `INSERT INTO point_rules (event, points, rate_per_peso, min_order_total, cap_points, is_active, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,true,now(),now()) RETURNING id`,
      [r.event, r.points, r.rate_per_peso, r.min_order_total, r.cap_points],
    );
    console.log(`INSERT rule ${r.event} (id=${ins.rows[0].id})`);
  }

  // 2. A coupon backing the ₱100 reward (voucher auto-claim demo).
  let flat100Id = null;
  {
    const f = await client.query('SELECT id FROM coupons WHERE code=$1', ['FLAT100']);
    if (f.rows.length > 0) {
      flat100Id = f.rows[0].id;
      console.log(`Coupon FLAT100 exists (id=${flat100Id}) — skipped`);
    } else {
      const ins = await client.query(
        `INSERT INTO coupons (code, title, short_copy, status, discount_type, amount,
          applies_to, minimum_basket, merchant_scope, individual_use, max_coupons_per_order,
          funded_by, vendor_share_pct, claimable, featured, priority, free_delivery,
          usage_limit, usage_limit_per_user, usage_count, expires_at, created_at, updated_at)
         VALUES ('FLAT100','₱100 off food','Reward redemption voucher.', 'published','fixed_cart',100,
          'food_subtotal',500,'all_vendor_branches',true,1,
          'platform',0,true,false,6,false,0,0,0,$1,now(),now()) RETURNING id`,
        [iso(now + 90 * DAY)],
      );
      flat100Id = ins.rows[0].id;
      console.log(`INSERT coupon FLAT100 (id=${flat100Id})`);
    }
  }

  // 3. Rewards catalog.
  const rewards = [
    { title: 'Free Delivery', description: 'Free delivery on your next order.', points_cost: 200, category: 'delivery', stock: null, priority: 10, terms: ['Valid for 30 days', 'One delivery per redemption'] },
    { title: '₱100 Food Voucher', description: 'Auto-claimed to your voucher wallet on redeem.', points_cost: 500, category: 'discount', stock: null, priority: 9, coupon_id: flat100Id, terms: ['Minimum order ₱500', 'Valid for 90 days'] },
    { title: 'Free Dessert', description: 'A sweet treat on us.', points_cost: 300, category: 'food', stock: 50, priority: 5, terms: ['Subject to availability'] },
    { title: '₱250 Credit', description: 'Big saver for big cravings.', points_cost: 1200, category: 'discount', stock: 20, priority: 4, terms: ['Minimum order ₱800'] },
    { title: 'Premium Treat', description: 'Members-only exclusive.', points_cost: 1000, category: 'exclusive', stock: 10, priority: 8, terms: ['Exclusive reward', 'Limited stock'] },
  ];
  for (const r of rewards) {
    const f = await client.query('SELECT id FROM rewards WHERE title=$1', [r.title]);
    let rid;
    if (f.rows.length > 0) {
      rid = f.rows[0].id;
      console.log(`Reward "${r.title}" exists — skipped`);
    } else {
      const ins = await client.query(
        `INSERT INTO rewards (title, description, points_cost, category, stock, coupon_id, priority, is_active, created_at, updated_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,true,now(),now()) RETURNING id`,
        [r.title, r.description, r.points_cost, r.category, r.stock, r.coupon_id ?? null, r.priority],
      );
      rid = ins.rows[0].id;
      console.log(`INSERT reward "${r.title}" (id=${rid})`);
      let order = 0;
      for (const term of r.terms) {
        await client.query(
          `INSERT INTO rewards_terms (_order, _parent_id, id, term) VALUES ($1,$2,md5(random()::text), $3)`,
          [order++, rid, term],
        );
      }
    }
  }

  // 4. Achievements.
  const achievements = [
    { title: 'First Order', description: 'Complete your first order', points_reward: 100, metric: 'orders_count', target: 1, icon: 'target' },
    { title: 'Frequent Diner', description: 'Complete 10 orders', points_reward: 250, metric: 'orders_count', target: 10, icon: 'utensils' },
    { title: 'Review Master', description: 'Write 5 reviews', points_reward: 150, metric: 'reviews_count', target: 5, icon: 'star' },
    { title: 'Big Spender', description: 'Spend ₱5,000 lifetime', points_reward: 500, metric: 'total_spent', target: 5000, icon: 'crown' },
  ];
  for (const a of achievements) {
    const f = await client.query('SELECT id FROM achievements WHERE title=$1', [a.title]);
    if (f.rows.length > 0) {
      console.log(`Achievement "${a.title}" exists — skipped`);
      continue;
    }
    const ins = await client.query(
      `INSERT INTO achievements (title, description, points_reward, metric, target, icon, is_active, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,true,now(),now()) RETURNING id`,
      [a.title, a.description, a.points_reward, a.metric, a.target, a.icon],
    );
    console.log(`INSERT achievement "${a.title}" (id=${ins.rows[0].id})`);
  }

  // 5. Demo earn lot: +500 pts for customer 1 (clearly marked demo seed).
  {
    const w = await client.query('SELECT id, balance, points_balance FROM wallets WHERE customer_id=1');
    if (w.rows.length === 0) throw new Error('No wallet for customer 1');
    const wallet = w.rows[0];
    const dup = await client.query(`SELECT id FROM wallet_transactions WHERE idempotency_key='seed-welcome-500'`);
    if (dup.rows.length > 0) {
      console.log('Demo earn lot exists — skipped');
    } else {
      const pts = 500;
      const after = Number(wallet.points_balance) + pts;
      await client.query(
        `INSERT INTO wallet_transactions (wallet_id, customer_id, type, amount, balance_after, points,
          points_balance_after, gateway, idempotency_key, status, expires_at, meta, created_at, updated_at)
         VALUES ($1,1,'earn',0,$2,$3,$4,'loyalty','seed-welcome-500','posted',$5,'{"seed":"demo-welcome"}',now(),now())`,
        [wallet.id, wallet.balance, pts, after, iso(now + 365 * DAY)],
      );
      await client.query(
        `UPDATE wallets SET points_balance=$1, points_earned=points_earned+$2, updated_at=now() WHERE id=$3`,
        [after, pts, wallet.id],
      );
      console.log(`INSERT demo earn lot +500 pts (wallet balance now ${after})`);
    }
  }

  await client.end();
  console.log('Done. Verify: /api/customer/loyalty/summary?userId=3 and /catalog?userId=3 (local CMS).');
})().catch((e) => {
  console.error(`FAILED: ${e.message}`);
  process.exit(1);
});
