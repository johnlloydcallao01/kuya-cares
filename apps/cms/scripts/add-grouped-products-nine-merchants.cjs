/**
 * Add 3 grouped products for each of merchants 1-9 (vendors 2-10).
 *
 * Deep-analysis findings (agents):
 * - products: productType 'grouped' parent; requires name + exactly one of
 *   createdByVendor/createdByMerchant (we use createdByVendor = merchant.vendor),
 *   slug auto-filled, sku unique-nullable (set post-create as SLUG-ID),
 *   basePrice NOT required for grouped, catalogVisibility default visible,
 *   isActive default true.
 * - prod-grouped-items: requires parent_product_id (grouped) + child_product_id
 *   (NOT grouped, no nested grouping), optional default_quantity=1, sort_order=0,
 *   UNIQUE(parent,child). Children used here are the existing SIMPLE products.
 * - merchant-products: requires merchant_id + product_id, added_by='vendor'.
 *   Only the grouped PARENT gets a merchant-products row; children already have theirs.
 * - Via service/admin API key there is NO auto fan-out, so links are created manually.
 * - Idempotent: look up product by (vendor,name), links by (parent,child) and
 *   (merchant,product) before creating.
 *
 * Usage:
 *   node scripts/add-grouped-products-nine-merchants.cjs --dry-run
 *   node scripts/add-grouped-products-nine-merchants.cjs
 */
const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const API_URL = process.env.PAYLOAD_API_URL || 'https://cms.kuyacares.com/api';
const API_KEY = process.env.PAYLOAD_API_KEY;

const DRY_RUN = process.argv.includes('--dry-run');

// merchant -> vendor -> 3 bundle names + child indexes into that vendor's simple products
const PLAN = [
  { merchantId: 1, vendorId: 2, label: "Andrew's PUREVIDA WATER PURIFIER", bundles: [
    { name: 'Purevida New Home Starter Bundle', children: [0, 1] },
    { name: 'Purevida Family Water Bundle', children: [0, 1, 2] },
    { name: 'Purevida Dispenser Rental Combo', children: [1, 2] },
  ] },
  { merchantId: 2, vendorId: 3, label: 'PANIC CORP.', bundles: [
    { name: 'Panic Home Protection Bundle', children: [0, 1] },
    { name: 'Panic Complete Security Bundle', children: [0, 1, 2] },
    { name: 'Panic Install and Maintenance Combo', children: [1, 2] },
  ] },
  { merchantId: 3, vendorId: 4, label: 'QUEEN PEARL OIL CORP.', bundles: [
    { name: 'Queen Pearl Kitchen Starter Bundle', children: [0, 1] },
    { name: 'Queen Pearl Family Cooking Bundle', children: [0, 1, 2] },
    { name: 'Queen Pearl Bulk Value Combo', children: [1, 2] },
  ] },
  { merchantId: 4, vendorId: 5, label: 'ALL TERRAIN TIRES SUPPLY', bundles: [
    { name: 'All Terrain New Wheel Bundle', children: [0, 1] },
    { name: 'All Terrain Complete Tire Bundle', children: [0, 1, 2] },
    { name: 'All Terrain Service Combo', children: [1, 2] },
  ] },
  { merchantId: 5, vendorId: 6, label: 'ALL ASIA TERMITE & PEST CONTROL SERVICES', bundles: [
    { name: 'All Asia Home Shield Bundle', children: [0, 1] },
    { name: 'All Asia Total Care Bundle', children: [0, 1, 2] },
    { name: 'All Asia Termite and Disinfection Combo', children: [1, 2] },
  ] },
  { merchantId: 6, vendorId: 7, label: 'BEAUTY REPUBLIC SALON & SPA', bundles: [
    { name: 'Beauty Republic Glow Starter Bundle', children: [0, 1] },
    { name: 'Beauty Republic Pamper Bundle', children: [0, 1, 2] },
    { name: 'Beauty Republic Spa and Nails Combo', children: [1, 2] },
  ] },
  { merchantId: 7, vendorId: 8, label: 'SAVOR HOUSE FOOD SERVICES', bundles: [
    { name: 'Savor House Barkada Bundle', children: [0, 1] },
    { name: 'Savor House Fiesta Bundle', children: [0, 1, 2] },
    { name: 'Savor House Sisig and Bilao Combo', children: [1, 2] },
  ] },
  { merchantId: 8, vendorId: 9, label: 'PRIME AUTOCARE CENTER', bundles: [
    { name: 'Prime Autocare Fresh Drive Bundle', children: [0, 1] },
    { name: 'Prime Autocare Total Care Bundle', children: [0, 1, 2] },
    { name: 'Prime Autocare Wash and Brakes Combo', children: [1, 2] },
  ] },
  { merchantId: 9, vendorId: 10, label: 'HOMELINE FURNITURE & INTERIORS', bundles: [
    { name: 'Homeline Dining Starter Bundle', children: [0, 1] },
    { name: 'Homeline Home Complete Bundle', children: [0, 1, 2] },
    { name: 'Homeline Table and Repair Combo', children: [1, 2] },
  ] },
];

function slugify(name) {
  return name
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[/]+/g, '-')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/[\s-]+/g, '-');
}

function skuify(name, id) {
  const base = name
    .toUpperCase()
    .replace(/[/]+/g, '-')
    .replace(/[^A-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return `${base}-${id}`;
}

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

async function createGroupedProduct(group, name, slug) {
  try {
    const created = await api('POST', '/products', {
      createdByVendor: group.vendorId,
      productType: 'grouped',
      name,
      slug,
      assign_to_all_vendor_merchants: false,
    });
    return created?.doc;
  } catch (e) {
    // Membership publish guard fallback: stage as hidden/inactive, caller flips later.
    if (e.message.includes('402') || e.message.includes('MEMBERSHIP')) {
      console.log('  !! Membership guard hit, retrying as hidden/inactive.');
      const created = await api('POST', '/products', {
        createdByVendor: group.vendorId,
        productType: 'grouped',
        name,
        slug,
        isActive: false,
        catalogVisibility: 'hidden',
        assign_to_all_vendor_merchants: false,
      });
      return created?.doc;
    }
    throw e;
  }
}

async function main() {
  if (!API_KEY) {
    console.error('PAYLOAD_API_KEY is not set.');
    process.exit(1);
  }
  if (DRY_RUN) console.log('DRY RUN MODE - no changes will be written.\n');

  let createdParents = 0;
  let createdItems = 0;
  let createdLinks = 0;
  let skippedParents = 0;

  for (const group of PLAN) {
    // Resolve this vendor's simple (child-candidate) products dynamically.
    const simples = await api(
      'GET',
      `/products?where[createdByVendor][equals]=${group.vendorId}&where[productType][equals]=simple&limit=10&depth=0&sort=id`
    );
    const simpleDocs = simples?.docs || [];
    console.log('========================================');
    console.log(`Merchant ${group.merchantId} (${group.label}) vendor ${group.vendorId}: found ${simpleDocs.length} simple products.`);
    if (simpleDocs.length < 3) {
      console.error(`  !! Expected >=3 simple products for vendor ${group.vendorId}, skipping merchant.`);
      continue;
    }

    for (const bundle of group.bundles) {
      const slug = slugify(bundle.name);
      console.log(`-- Bundle: ${bundle.name} (children idx ${bundle.children.join(',')})`);
      const childIds = bundle.children.map((i) => simpleDocs[i].id);

      let parentId = null;
      try {
        const search = await api(
          'GET',
          `/products?where[createdByVendor][equals]=${group.vendorId}&where[name][equals]=${encodeURIComponent(bundle.name)}&limit=1&depth=0`
        );
        if (search?.docs?.[0]) {
          parentId = search.docs[0].id;
          if (search.docs[0].productType !== 'grouped') {
            console.error(`  !! Name collision with non-grouped product id ${parentId}, skipping.`);
            continue;
          }
          console.log(`  -> Grouped product exists (id ${parentId}).`);
          skippedParents++;
        }
      } catch (e) {
        console.error(`  !! Lookup failed: ${e.message}`);
      }

      if (!parentId) {
        if (DRY_RUN) {
          console.log('  [dry-run] Would create grouped parent + items + merchant link.');
          continue;
        }
        const doc = await createGroupedProduct(group, bundle.name, slug);
        parentId = doc?.id;
        console.log(`  -> Created grouped product id ${parentId}.`);
        createdParents++;
        const sku = skuify(bundle.name, parentId);
        await api('PATCH', `/products/${parentId}`, { sku });
        console.log(`  -> SKU: ${sku}`);
      }

      if (DRY_RUN || !parentId) continue;

      // Ensure prod-grouped-items links (parent must be grouped, child must NOT be grouped).
      let sort = 0;
      for (const childId of childIds) {
        if (childId === parentId) {
          console.error(`  !! Child ${childId} == parent, skipping (self-link forbidden).`);
          sort++;
          continue;
        }
        try {
          const existing = await api(
            'GET',
            `/prod-grouped-items?where[parent_product_id][equals]=${parentId}&where[child_product_id][equals]=${childId}&limit=1&depth=0`
          );
          if (existing?.docs?.length) {
            console.log(`  -> Item link parent ${parentId} -> child ${childId} exists.`);
          } else {
            const item = await api('POST', '/prod-grouped-items', {
              parent_product_id: parentId,
              child_product_id: childId,
              default_quantity: 1,
              sort_order: sort,
            });
            console.log(`  -> Created grouped-item id ${item?.doc?.id} (child ${childId}).`);
            createdItems++;
          }
        } catch (e) {
          console.error(`  !! Grouped-item failed (parent ${parentId} child ${childId}): ${e.message}`);
        }
        sort++;
      }

      // Ensure merchant-products link for the PARENT only.
      try {
        const mpSearch = await api(
          'GET',
          `/merchant-products?where[merchant_id][equals]=${group.merchantId}&where[product_id][equals]=${parentId}&limit=1&depth=0`
        );
        if (mpSearch?.docs?.length) {
          console.log(`  -> Merchant link exists (id ${mpSearch.docs[0].id}).`);
        } else {
          const mp = await api('POST', '/merchant-products', {
            merchant_id: group.merchantId,
            product_id: parentId,
            added_by: 'vendor',
          });
          console.log(`  -> Created merchant-product id ${mp?.doc?.id}.`);
          createdLinks++;
        }
      } catch (e) {
        console.error(`  !! Merchant link failed: ${e.message}`);
      }
    }
  }

  console.log('\n========================================');
  console.log(
    DRY_RUN
      ? 'DRY RUN complete.'
      : `Done. Created ${createdParents} grouped parents, ${createdItems} grouped-items, ${createdLinks} merchant links, skipped ${skippedParents} existing parents.`
  );
}

main().catch((e) => {
  console.error('Fatal:', e);
  process.exit(1);
});
