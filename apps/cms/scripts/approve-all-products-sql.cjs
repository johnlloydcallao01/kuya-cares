/**
 * Approve all existing products DIRECTLY via SQL (bypasses Payload hooks).
 *
 * Why SQL: product update is admin/service-only AND the products
 * `beforeChange` hook reverts `approvalStatus` to its previous value for
 * any non-admin role — the service API key in .env PATCHes 200 but changes
 * nothing (verified: 81/81 unchanged). No admin key is at hand. This mirrors
 * scripts/seed-demo-vouchers-sql.cjs precedent.
 *
 * Statement (data-only, no schema change):
 *   UPDATE products
 *   SET approval_status = 'approved', updated_at = NOW()
 *   WHERE approval_status IS DISTINCT FROM 'approved';
 *
 * Safe properties:
 * - No versions/drafts on products (no versions: in Products.ts), so no
 *   _versions rows to touch.
 * - Does not alter isActive/catalogVisibility, so membership publish
 *   guards are unaffected (they only run on Payload create/update paths).
 * - Idempotent — safe to re-run.
 *
 * Usage:
 *   node scripts/approve-all-products-sql.cjs            # approve all
 *   node scripts/approve-all-products-sql.cjs --dry-run  # report only
 */
const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const { Client } = require('pg');

const DRY_RUN = process.argv.includes('--dry-run');

async function main() {
  const uri = process.env.DATABASE_URI;
  if (!uri) {
    console.error('DATABASE_URI is not set in apps/cms/.env.');
    process.exit(1);
  }
  const client = new Client({
    connectionString: uri,
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();
  try {
    const before = await client.query(
      `SELECT approval_status AS status, COUNT(*)::int AS n FROM products GROUP BY approval_status ORDER BY n DESC`,
    );
    const total = before.rows.reduce((s, r) => s + r.n, 0);
    console.log(`Total products: ${total}`);
    console.log(`Breakdown     : ${JSON.stringify(before.rows)}\n`);

    const toApprove = before.rows
      .filter((r) => r.status !== 'approved')
      .reduce((s, r) => s + r.n, 0);
    if (toApprove === 0) {
      console.log('Nothing to do — every product is already approved.');
      return;
    }
    if (DRY_RUN) {
      console.log(`DRY RUN — would approve ${toApprove} product(s). No changes written.`);
      return;
    }

    const res = await client.query(
      `UPDATE products SET approval_status = 'approved', updated_at = NOW()
       WHERE approval_status IS DISTINCT FROM 'approved'`,
    );
    console.log(`Updated rows: ${res.rowCount}`);

    const after = await client.query(
      `SELECT approval_status AS status, COUNT(*)::int AS n FROM products GROUP BY approval_status ORDER BY n DESC`,
    );
    console.log(`After       : ${JSON.stringify(after.rows)}`);
    const remaining = after.rows
      .filter((r) => r.status !== 'approved')
      .reduce((s, r) => s + r.n, 0);
    if (remaining > 0) {
      console.error(`WARNING: ${remaining} product(s) still not approved.`);
      process.exitCode = 1;
    } else {
      console.log('Done — all products are approved.');
    }
  } finally {
    await client.end();
  }
}

main().catch((e) => {
  console.error(`Fatal: ${e.message}`);
  process.exit(1);
});
