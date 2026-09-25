/**
 * Add 3 simple products for each of merchants 1-9 (vendors 2-10).
 *
 * Schema findings (from subagent deep-dives):
 * - products: requires exactly one of createdByVendor/createdByMerchant,
 *   productType='simple' requires basePrice, slug auto-filled, sku unique-nullable.
 * - merchant_products: requires merchant_id + product_id (DB cols merchant_id_id/product_id_id),
 *   added_by='vendor', is_active/is_available default true.
 * - Via service/admin API key there is NO auto fan-out (assign_to_all_vendor_merchants
 *   only fans out for vendor JWT sessions), so we create merchant_products rows ourselves.
 * - product-categories is currently EMPTY (0 docs), so we create products WITHOUT categories.
 *
 * Usage:
 *   node scripts/add-nine-merchants-products.cjs --dry-run
 *   node scripts/add-nine-merchants-products.cjs
 */
const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const API_URL = process.env.PAYLOAD_API_URL || 'https://cms.kuyacares.com/api';
const API_KEY = process.env.PAYLOAD_API_KEY;

const DRY_RUN = process.argv.includes('--dry-run');

// merchant_id -> vendor_id -> products [name, price]
const PLAN = [
  {
    merchantId: 1, vendorId: 2, label: "Andrew's PUREVIDA WATER PURIFIER",
    items: [
      ['Purified Drinking Water 5-Gallon Refill', 40.0],
      ['Purified Drinking Water 5-Gallon New Container', 350.0],
      ['Water Dispenser Monthly Rental', 300.0],
    ],
  },
  {
    merchantId: 2, vendorId: 3, label: 'PANIC CORP.',
    items: [
      ['Panic Alarm Basic Unit', 1500.0],
      ['Panic Alarm Wireless Set with Installation', 2800.0],
      ['Annual Panic System Maintenance', 800.0],
    ],
  },
  {
    merchantId: 3, vendorId: 4, label: 'QUEEN PEARL OIL CORP.',
    items: [
      ['Queen Pearl Palm Oil 1.5L', 145.0],
      ['Queen Pearl Vegetable Oil 5L', 420.0],
      ['Queen Pearl Oil 16kg Tin', 1250.0],
    ],
  },
  {
    merchantId: 4, vendorId: 5, label: 'ALL TERRAIN TIRES SUPPLY',
    items: [
      ['All-Terrain Tire 265/65 R17', 7500.0],
      ['Tire Mounting and Balancing Service', 350.0],
      ['Tire Valve and Wheel Weights Set', 150.0],
    ],
  },
  {
    merchantId: 5, vendorId: 6, label: 'ALL ASIA TERMITE & PEST CONTROL SERVICES',
    items: [
      ['General Pest Control Visit', 1800.0],
      ['Termite Inspection and Spot Treatment', 2500.0],
      ['Deep Disinfection Service', 2000.0],
    ],
  },
  {
    merchantId: 6, vendorId: 7, label: 'BEAUTY REPUBLIC SALON & SPA',
    items: [
      ['Classic Haircut with Wash', 250.0],
      ['Relaxing Body Massage 60min', 500.0],
      ['Gel Manicure and Pedicure', 600.0],
    ],
  },
  {
    merchantId: 7, vendorId: 8, label: 'SAVOR HOUSE FOOD SERVICES',
    items: [
      ['Savor House Fried Chicken Meal', 129.0],
      ['Pork Sisig Sizzling Plate', 149.0],
      ['Pancit Bilao Small', 550.0],
    ],
  },
  {
    merchantId: 8, vendorId: 9, label: 'PRIME AUTOCARE CENTER',
    items: [
      ['Change Oil Package Sedan', 2200.0],
      ['Car Wash with Vacuum', 350.0],
      ['Brake Pad Replacement Front Set', 2500.0],
    ],
  },
  {
    merchantId: 9, vendorId: 10, label: 'HOMELINE FURNITURE & INTERIORS',
    items: [
      ['Homeline Wooden Dining Chair', 1800.0],
      ['Homeline Center Table', 3500.0],
      ['Furniture Repair Service Call', 900.0],
    ],
  },
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

async function main() {
  if (!API_KEY) {
    console.error('PAYLOAD_API_KEY is not set.');
    process.exit(1);
  }
  if (DRY_RUN) console.log('DRY RUN MODE - no changes will be written.\n');

  let createdProducts = 0;
  let createdLinks = 0;
  let skippedProducts = 0;

  for (const group of PLAN) {
    for (const [name, price] of group.items) {
      const slug = slugify(name);
      console.log('========================================');
      console.log(`Merchant ${group.merchantId} (vendor ${group.vendorId}) | ${name} | P${price}`);

      let productId = null;
      try {
        const search = await api(
          'GET',
          `/products?where[createdByVendor][equals]=${group.vendorId}&where[name][equals]=${encodeURIComponent(name)}&limit=1&depth=0`
        );
        if (search?.docs?.[0]) {
          productId = search.docs[0].id;
          console.log(`  -> Product exists (id ${productId}).`);
          skippedProducts++;
        }
      } catch (e) {
        console.error(`  !! Lookup failed: ${e.message}`);
      }

      if (!productId) {
        if (DRY_RUN) {
          console.log('  [dry-run] Would create product.');
          continue;
        }
        const created = await api('POST', '/products', {
          createdByVendor: group.vendorId,
          productType: 'simple',
          name,
          slug,
          basePrice: price,
          assign_to_all_vendor_merchants: false,
        });
        productId = created?.doc?.id;
        console.log(`  -> Created product id ${productId}.`);
        createdProducts++;
        const sku = skuify(name, productId);
        await api('PATCH', `/products/${productId}`, { sku });
        console.log(`  -> SKU: ${sku}`);
      }

      if (DRY_RUN || !productId) continue;

      try {
        const mpSearch = await api(
          'GET',
          `/merchant-products?where[merchant_id][equals]=${group.merchantId}&where[product_id][equals]=${productId}&limit=1&depth=0`
        );
        if (mpSearch?.docs?.length) {
          console.log(`  -> Link exists (id ${mpSearch.docs[0].id}).`);
        } else {
          const mp = await api('POST', '/merchant-products', {
            merchant_id: group.merchantId,
            product_id: productId,
            added_by: 'vendor',
          });
          console.log(`  -> Created merchant-product id ${mp?.doc?.id}.`);
          createdLinks++;
        }
      } catch (e) {
        console.error(`  !! Link failed: ${e.message}`);
      }
    }
  }

  console.log('\n========================================');
  console.log(DRY_RUN ? 'DRY RUN complete.' : `Done. Created ${createdProducts} products, ${createdLinks} links, skipped ${skippedProducts} existing.`);
}

main().catch((e) => {
  console.error('Fatal:', e);
  process.exit(1);
});
