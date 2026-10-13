/**
 * Approve all existing products in the `products` collection.
 *
 * For every product whose `approvalStatus` is not already 'approved',
 * this script PATCHes `{ approvalStatus: 'approved' }` and then re-reads
 * the doc to verify the change stuck.
 *
 * IMPORTANT: the API key must belong to an `admin` user. The products
 * `beforeChange` hook resets `approvalStatus` to its previous value for
 * any non-admin role (including `service`), so a service key would report
 * success without changing anything — the post-PATCH verification below
 * catches that and reports it as UNCHANGED.
 *
 * Usage:
 *   node scripts/approve-all-products.cjs            # approve everything pending/disapproved
 *   node scripts/approve-all-products.cjs --dry-run  # print plan only
 *
 * Env (from apps/cms/.env):
 *   PAYLOAD_API_URL / PAYLOAD_API_KEY (admin key), or pass
 *   ADMIN_API_KEY=<admin-key> node scripts/approve-all-products.cjs
 */
const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const API_URL = process.env.PAYLOAD_API_URL || 'https://cms.kuyacares.com/api';
const API_KEY = process.env.ADMIN_API_KEY || process.env.PAYLOAD_API_KEY;

const DRY_RUN = process.argv.includes('--dry-run');
const PAGE_LIMIT = 100;

async function api(method, endpoint, body) {
  const res = await fetch(`${API_URL}${endpoint}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `users API-Key ${API_KEY}`,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = null;
  }
  if (!res.ok) {
    throw new Error(`API ${method} ${endpoint} -> ${res.status}: ${text.slice(0, 500)}`);
  }
  return data;
}

async function main() {
  if (!API_KEY) {
    console.error('No API key set. Put an ADMIN key in PAYLOAD_API_KEY (or ADMIN_API_KEY) in apps/cms/.env.');
    process.exit(1);
  }
  if (DRY_RUN) {
    console.log('DRY RUN MODE - no changes will be written.\n');
  }

  // Pull every product (bounded pages), then filter client-side so no
  // server-side operator quirks can silently skip rows.
  const all = [];
  let page = 1;
  let totalPages = 1;
  do {
    const data = await api('GET', `/products?limit=${PAGE_LIMIT}&page=${page}&depth=0`);
    const docs = Array.isArray(data?.docs) ? data.docs : [];
    all.push(...docs);
    totalPages = Number(data?.totalPages || 1);
    page += 1;
  } while (page <= totalPages);

  const pending = all.filter((d) => d?.approvalStatus !== 'approved');
  const alreadyApproved = all.length - pending.length;

  console.log(`Total products        : ${all.length}`);
  console.log(`Already approved      : ${alreadyApproved}`);
  console.log(`To approve            : ${pending.length}`);
  const byStatus = {};
  for (const d of pending) {
    const s = String(d?.approvalStatus ?? '(missing)');
    byStatus[s] = (byStatus[s] || 0) + 1;
  }
  console.log(`Breakdown (to approve): ${JSON.stringify(byStatus)}\n`);

  if (DRY_RUN) {
    for (const d of pending.slice(0, 20)) {
      console.log(`  would approve #${d.id} "${d.name}" [${d.approvalStatus}]`);
    }
    if (pending.length > 20) console.log(`  ... and ${pending.length - 20} more`);
    console.log('\nDry run complete — no changes written.');
    return;
  }

  let approved = 0;
  let unchanged = 0;
  let failed = 0;
  for (const d of pending) {
    try {
      await api('PATCH', `/products/${d.id}`, { approvalStatus: 'approved' });
      const check = await api('GET', `/products/${d.id}?depth=0`);
      if (check?.approvalStatus === 'approved') {
        approved += 1;
      } else {
        unchanged += 1;
        console.error(
          `  !! #${d.id} "${d.name}" still [${check?.approvalStatus}] after PATCH — key is likely non-admin (hook reverts it).`,
        );
      }
    } catch (e) {
      failed += 1;
      console.error(`  !! #${d.id} "${d?.name}": ${e.message}`);
    }
    if ((approved + unchanged + failed) % 25 === 0) {
      console.log(`  ...progress: ${approved + unchanged + failed}/${pending.length}`);
    }
  }

  console.log('\n========================================');
  console.log(`Approved this run : ${approved}`);
  console.log(`Unchanged (blocked): ${unchanged}`);
  console.log(`Failed            : ${failed}`);
  if (unchanged > 0) {
    console.log('\nUnchanged rows mean the API key is NOT admin — re-run with an admin key via ADMIN_API_KEY.');
  }
}

main().catch((e) => {
  console.error(`Fatal: ${e.message}`);
  process.exit(1);
});
