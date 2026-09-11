/**
 * Add products for GMK CAFE (batch 2) to the CMS.
 *
 * For each product in the list below this script:
 *  1. Creates a Product in the `products` collection:
 *     - createdByVendor = 20 (GMK CAFE)
 *     - productType = 'simple' (Simple Product)
 *     - name, slug (derived from name), categories (matched by name),
 *       basePrice (from the price column), sku (name + product id, uppercased)
 *  2. Creates a Merchant Product in the `merchant-products` collection:
 *     - merchant_id = 25 (GMK CAFE)
 *     - product_id = the product created above
 *     - added_by = 'vendor'
 *
 * Usage:
 *   node scripts/add-gmk-products-2.cjs            # perform the insertion
 *   node scripts/add-gmk-products-2.cjs --dry-run  # print plan only
 *
 * The script is idempotent: products already owned by vendor 20 with the same
 * name are skipped (and their merchant product is created if missing).
 */
const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const API_URL = process.env.PAYLOAD_API_URL || 'https://cms.kuyacares.com/api';
const API_KEY = process.env.PAYLOAD_API_KEY;

const VENDOR_ID = 20; // GMK CAFE
const MERCHANT_ID = 25; // GMK CAFE

const DRY_RUN = process.argv.includes('--dry-run');

// Product list: [name, category, price in PHP]
const PRODUCTS = [
  // --- Rice Meals ---
  ['Spam with rice with drink', 'Rice Meals', 110.0],
  // --- Pasta ---
  ['GMK Creamy Carbonara, Solo', 'Pasta', 114.0],
  ['GMK Creamy Carbonara', 'Pasta', 138.0],
  // --- Sides ---
  ['GMK French Fries, Solo 80 gram', 'Sides', 46.0],
  ['GMK French Fries, Solo 80 grams', 'Sides', 69.0],
  ['GMK French Fries, Regular 120 grams', 'Sides', 75.0],
  ['GMK French Fries, Regular 120 grams, With drinks', 'Sides', 98.0],
  ['GMK French Fries, Large 180 grams,', 'Sides', 121.0],
  ['GMK French Fries, Large 180 grams, with drinks', 'Sides', 144.0],
  ['GMK French Fries Barkada, 300 grams,', 'Sides', 173.0],
  ['GMK French Fries Barkada, 300 grams, with drinks', 'Sides', 202.0],
  // --- Dessert ---
  ['GMK Leche Plan, Solo', 'Dessert', 29.0],
  ['GMK Leche Plan Tub', 'Dessert', 115.0],
  ['GMK Mango Graham Bliss Tub, Solo', 'Dessert', 29.0],
  ['GMK Mango Graham Bliss Tub', 'Dessert', 115.0],
  ['Home Made Ice Cream (Solo Serving)', 'Dessert', 23.0],
  ['GMK Alcapone Supreme, Mini', 'Dessert', 69.0],
  ['GMK Alcapone Supreme, Regular', 'Dessert', 104.0],
  ['GMK Berry Bliss (Blueberry, Mini)', 'Dessert', 58.0],
  ['GMK Berry Bliss (Blueberry) Regular', 'Dessert', 92.0],
  ['GMK Berry Bliss (strawberry), Mini', 'Dessert', 58.0],
  ['GMK Berry Bliss (Strawberry) Regular', 'Dessert', 92.0],
  ['GMK Biscoff Crunch, Mini', 'Dessert', 69.0],
  ['GMK Biscoff Crunch, Regular', 'Dessert', 104.0],
  ['GMK Royale Plan, Mini', 'Dessert', 81.0],
  ['GMK Royale Plan, Regular', 'Dessert', 115.0],
  ['GMK Matcha Madness', 'Dessert', 58.0],
  ['GMK Matcha Madness, Regular', 'Dessert', 92.0],
  ['GMK Nutella Delight, Mni', 'Dessert', 58.0],
  ['GMK Nutella Delight, Classic', 'Dessert', 92.0],
  ['GMK Oreo Dream Mini', 'Dessert', 69.0],
  ['GMK Oreo Dream Regular', 'Dessert', 104.0],
  ['GMK Dubai Chewy Cookie (2 pcs)', 'Dessert', 207.0],
  ['GMK Dubai Chewy Cookie (Solo)', 'Dessert', 114.0],
  // --- Beverages ---
  ['Classic Chocolate (Small 12 oz)', 'Beverages', 41.0],
  ['Classic Chocolate (Medium 16 oz)', 'Beverages', 52.0],
  ['Classic Chocolate (Large 22 oz)', 'Beverages', 64.0],
  ['Classic Black Forest (Small 12 oz)', 'Beverages', 41.0],
  ['Classic Black Forest (Medium 16 oz)', 'Beverages', 52.0],
  ['Classic Black Forest (Large 22 oz)', 'Beverages', 64.0],
  ['Classic cookies & cream (Small 12 oz)', 'Beverages', 41.0],
  ['Classic cookies & cream (Medium 16 oz)', 'Beverages', 52.0],
  ['Classic cookies & cream (Large 22 oz)', 'Beverages', 64.0],
  ['Classic Matcha (Small 12 oz)', 'Beverages', 41.0],
  ['Classic Matcha (Medium 16 oz)', 'Beverages', 52.0],
  ['Classic Matcha (Large 22 oz)', 'Beverages', 64.0],
  ['Classic Okinawa (Small 12 oz)', 'Beverages', 41.0],
  ['Classic Okinawa (Medium 16 oz)', 'Beverages', 52.0],
  ['Classic Okinawa (Large 22 oz)', 'Beverages', 64.0],
  ['Classic Red Velvet (Small 12 oz)', 'Beverages', 41.0],
  ['Classic Red Velvet (Medium 16 oz)', 'Beverages', 52.0],
  ['Classic Red Velvet (Large 22 oz)', 'Beverages', 64.0],
  ['Classic Taro (Small 12oz)', 'Beverages', 41.0],
  ['Classic Taro (Medium 16 oz)', 'Beverages', 52.0],
  ['Classic Taro (Large 22 oz)', 'Beverages', 64.0],
  ['Classic Wintermelon (Small 12 oz)', 'Beverages', 41.0],
  ['Classic Wintermelon (Medium 16 oz)', 'Beverages', 52.0],
  ['Classic Wintermelon (Large 22 oz)', 'Beverages', 64.0],
  ['Green tea magic (Small 12 oz)', 'Beverages', 52.0],
  ['Green Tea Magic (Medium 16 oz)', 'Beverages', 64.0],
  ['Green tea magic (22 oz)', 'Beverages', 75.0],
  ['Okinawa Bliss (small 12 oz)', 'Beverages', 64.0],
  ['Okinawa Bliss (Medium 16 oz)', 'Beverages', 64.0],
  ['Okinawa Bliss (Large 22 oz)', 'Beverages', 75.0],
  ['Oreo Cheesecake (Small 12 oz)', 'Beverages', 52.0],
  ['Oreo Cheesecake (Medium 16 oz)', 'Beverages', 64.0],
  ['Oreo Cheesecake (Large 22 oz)', 'Beverages', 75.0],
  ['Taro Indulgence (Small 12 oz)', 'Beverages', 52.0],
  ['Taro Indulgence (Medium 16 oz)', 'Beverages', 64.0],
  ['Taro Indulgence (Large 22 oz)', 'Beverages', 75.0],
  ['Velvet Swirl (12 oz)', 'Beverages', 52.0],
  ['Velvet Swirl (Medium 16 oz)', 'Beverages', 64.0],
  ['Velvet swirl (Large 22 oz)', 'Beverages', 75.0],
  ['Winter melon de luxe (Small 12 oz)', 'Beverages', 52.0],
  ['Winter Melon de luxe (Medium 16 oz)', 'Beverages', 64.0],
  ['Winter Melon de luxe (Large 22 oz)', 'Beverages', 64.0],
  // --- Coffee ---
  ['White Mocha Latte (Small)', 'Coffee', 75.0],
  ['White Mocha Latte (Medium)', 'Coffee', 87.0],
  ['White Mocha Latte (Large)', 'Coffee', 98.0],
  ['Spanish Latte (Small)', 'Coffee', 75.0],
  ['Spanish Latte', 'Coffee', 87.0],
  ['Spanish Latte (Large)', 'Coffee', 98.0],
  ['Sea Salt Latte (Small)', 'Coffee', 75.0],
  ['Sea Salt Latte (Medium)', 'Coffee', 87.0],
  ['Sea Salt Latte', 'Coffee', 98.0],
  ['Biscoff Latte', 'Coffee', 75.0],
  ['Biscoff Latte (Medium)', 'Coffee', 87.0],
  ['Biscoff latte (small)', 'Coffee', 98.0],
];

function slugify(name) {
  return name
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
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
    console.error('PAYLOAD_API_KEY is not set. Cannot authenticate with the CMS.');
    process.exit(1);
  }
  if (DRY_RUN) {
    console.log('DRY RUN MODE - no changes will be written.\n');
  }

  // Load categories so we can resolve category ids by name.
  const catData = await api('GET', '/product-categories?limit=100&depth=0');
  const categories = catData?.docs || [];
  const catIdByName = new Map(categories.map((c) => [c.name, c.id]));
  console.log(`Loaded ${categories.length} product categories.\n`);

  let createdProducts = 0;
  let createdMerchantProducts = 0;

  for (const [name, categoryName, price] of PRODUCTS) {
    const slug = slugify(name);
    const categoryId = catIdByName.get(categoryName);

    console.log('========================================');
    console.log(`Product : ${name}`);
    console.log(`Price   : ₱ ${price.toFixed(2)}`);
    console.log(`Slug    : ${slug}`);
    console.log(`Category: ${categoryName} (id ${categoryId ?? 'NOT FOUND'})`);

    if (!categoryId) {
      console.error(`  !! Cannot find category "${categoryName}". Skipping product.\n`);
      continue;
    }

    // Check for an existing product owned by this vendor with the same name.
    let existing = null;
    try {
      const search = await api(
        'GET',
        `/products?where[createdByVendor][equals]=${VENDOR_ID}&where[name][equals]=${encodeURIComponent(name)}&limit=1&depth=0`
      );
      existing = search?.docs?.[0] || null;
    } catch (e) {
      console.error(`  !! Lookup failed: ${e.message}`);
    }

    let productId;

    if (existing) {
      productId = existing.id;
      console.log(`  -> Product already exists (id ${productId}). Skipping create.`);
    } else {
      if (DRY_RUN) {
        console.log('  [dry-run] Would create product (sku needs id after creation).');
        productId = null;
      } else {
        const createData = await api('POST', '/products', {
          createdByVendor: VENDOR_ID,
          productType: 'simple',
          name,
          slug,
          categories: [categoryId],
          basePrice: price,
          assign_to_all_vendor_merchants: false,
        });
        productId = createData?.doc?.id;
        console.log(`  -> Created product (id ${productId}).`);
        createdProducts++;

        // SKU is derived from name + product id (all uppercase).
        const sku = skuify(name, productId);
        await api('PATCH', `/products/${productId}`, { sku });
        console.log(`  -> Set SKU: ${sku}`);
      }
    }

    if (!productId) {
      continue;
    }

    // Create the Merchant Product link.
    if (DRY_RUN) {
      console.log(`  [dry-run] Would create merchant-product (merchant ${MERCHANT_ID} -> product ${productId}, added_by vendor).`);
      continue;
    }

    try {
      const mpSearch = await api(
        'GET',
        `/merchant-products?where[merchant_id][equals]=${MERCHANT_ID}&where[product_id][equals]=${productId}&limit=1&depth=0`
      );
      if (mpSearch?.docs?.length) {
        console.log(`  -> Merchant-product already exists (id ${mpSearch.docs[0].id}).`);
      } else {
        const mp = await api('POST', '/merchant-products', {
          merchant_id: MERCHANT_ID,
          product_id: productId,
          added_by: 'vendor',
        });
        console.log(`  -> Created merchant-product (id ${mp?.doc?.id}).`);
        createdMerchantProducts++;
      }
    } catch (e) {
      console.error(`  !! Merchant-product creation failed: ${e.message}`);
    }
  }

  console.log('\n========================================');
  if (DRY_RUN) {
    console.log(`DRY RUN complete. Would create ${PRODUCTS.length} products + merchant links.`);
  } else {
    console.log(`Done. Created ${createdProducts} products and ${createdMerchantProducts} merchant-products.`);
  }
}

main().catch((e) => {
  console.error('Fatal error:', e);
  process.exit(1);
});