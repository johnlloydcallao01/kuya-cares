/**
 * Add products for GMK CAFE to the CMS.
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
 *   node scripts/add-gmk-products.cjs            # perform the insertion
 *   node scripts/add-gmk-products.cjs --dry-run  # print plan only
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
// Note: duplicates/typos resolved per user:
//  - Food rows kept at ₱110 only (dropped the ₱87 variants).
//  - "Water melom, fruit soda, Medium" -> "Water melon fruit soda, Small".
//  - "Mango fruit soda, Smll" -> "Mango fruit soda, Small".
const PRODUCTS = [
  // --- Iced coffees ---
  ['GMK Okinawa Buddy ice Coffee Small', 'Beverages', 75.0],
  ['GMK Okinawa Buddy ice Coffee Medium', 'Beverages', 87.0],
  ['GMK Okinawa Buddy ice Coffee Large', 'Beverages', 87.0],
  ['Ice Classic coffee Small', 'Beverages', 64.0],
  ['Ice Classic coffee Medium', 'Beverages', 75.0],
  ['Ice Classic coffee Large', 'Beverages', 87.0],
  ['Ice Caramel Small', 'Beverages', 64.0],
  ['Ice Caramel medium', 'Beverages', 75.0],
  ['Ice caramel Large', 'Beverages', 87.0],
  ['Ice Hazel nut small', 'Beverages', 64.0],
  ['Ice Hazel nut medium', 'Beverages', 75.0],
  ['Ice Hazel nut Large', 'Beverages', 87.0],
  ['Ice Vanilla small', 'Beverages', 64.0],
  ['Ice Vanilla Medium', 'Beverages', 75.0],
  ['Ice Vanilla Large', 'Beverages', 87.0],
  ['Ice caramel macchiato Small', 'Beverages', 64.0],
  ['Ice caramel macchiato Medium', 'Beverages', 75.0],
  ['Ice caramel macchiato Large', 'Beverages', 87.0],
  ['Ice Mocha small', 'Beverages', 64.0],
  ['Ice Mocha Medium', 'Beverages', 75.0],
  ['Ice Mocha Large', 'Beverages', 87.0],
  ['Ice Salted Caramel Small', 'Beverages', 64.0],
  ['Ice Salted Caramel Medium', 'Beverages', 75.0],
  ['Ice salted caramel Large', 'Beverages', 87.0],
  ['Ice Coffee Jelly Small', 'Beverages', 64.0],
  ['Ice Coffee Jelly Medium', 'Beverages', 75.0],
  ['Ice Coffee Jelly large', 'Beverages', 87.0],
  ['GMK Tiger Barkada Milk tea Small', 'Beverages', 64.0],
  ['GMK Tiger Barkada Milk Tea medium', 'Beverages', 75.0],
  ['GMK Tiger Barkada Milk tea Large', 'Beverages', 87.0],
  // --- Milk teas ---
  ['Okinawa Milk Tea Small', 'Beverages', 41.0],
  ['Okinawa Milk Tea Medium', 'Beverages', 52.0],
  ['Okinawa Milk Tea Large', 'Beverages', 64.0],
  ['Winter melon Milk Tea small', 'Beverages', 41.0],
  ['Winter melon Milk Tea Medium', 'Beverages', 52.0],
  ['Winter melon Milk Tea Large', 'Beverages', 64.0],
  ['Cookies & Cream Milk Tea Small', 'Beverages', 41.0],
  ['Cookies & Cream Milk Tea Medium', 'Beverages', 52.0],
  ['Cookies & Cream Milk Tea Large', 'Beverages', 64.0],
  ['Chocolate Milk Tea Small', 'Beverages', 41.0],
  ['Chocolate Milk Tea Medium', 'Beverages', 52.0],
  ['Chocolate Milk Tea Large', 'Beverages', 64.0],
  ['Black Forest Milk Tea, Small', 'Beverages', 41.0],
  ['Black Forest Milk Tea Medium', 'Beverages', 52.0],
  ['Black Forest Milk Tea, Large', 'Beverages', 64.0],
  ['Red Velvet Milk Tea, small', 'Beverages', 41.0],
  ['Red Velvet Milk Tea,Medium', 'Beverages', 52.0],
  ['Red Velvet Milk Tea, Large', 'Beverages', 64.0],
  ['Matcha Milk Tea, Small', 'Beverages', 41.0],
  ['Matcha Milk Tea, Medium', 'Beverages', 52.0],
  ['Matcha Milk Tea, Large', 'Beverages', 64.0],
  ['Taro Milk Tea, Small', 'Beverages', 41.0],
  ['Taro Milk Tea, Medium', 'Beverages', 52.0],
  ['Taro Milk Tea, large', 'Beverages', 64.0],
  // --- Fruit sodas ---
  ['Green Apple Fruit Yakult, Small', 'Beverages', 64.0],
  ['Blue Lemonade Soda, Small', 'Beverages', 41.0],
  ['Blue Lemonade Soda, Medium', 'Beverages', 52.0],
  ['Blue Lemonade Soda, Large', 'Beverages', 64.0],
  ['Blue berry Fruit soda, Small', 'Beverages', 41.0],
  ['Blue berry Fruit soda, Medium', 'Beverages', 52.0],
  ['Blue berry Fruit soda, Large', 'Beverages', 64.0],
  ['Four seasons fruit soda, Small', 'Beverages', 41.0],
  ['Four seasons fruit soda, medium', 'Beverages', 52.0],
  ['Four seasons fruit soda, Large', 'Beverages', 64.0],
  ['Green Apple Soda, Small', 'Beverages', 41.0],
  ['Green Apple Soda, Medium', 'Beverages', 52.0],
  ['Green Apple Soda, Large', 'Beverages', 64.0],
  ['Lychee Fruit soda, Small', 'Beverages', 41.0],
  ['Lychee Fruit soda, Medium', 'Beverages', 52.0],
  ['Lychee Fruit soda, Large', 'Beverages', 64.0],
  ['Mango fruit soda, Small', 'Beverages', 41.0],
  ['Mango fruit soda, Medium', 'Beverages', 52.0],
  ['Mango fruit soda, Large', 'Beverages', 64.0],
  ['Strawberry fruit soda, Small', 'Beverages', 41.0],
  ['Strawberry fruit soda, Medium', 'Beverages', 52.0],
  ['Strawberry fruit soda, Large', 'Beverages', 64.0],
  ['Water melon fruit soda, Small', 'Beverages', 41.0],
  ['Water melon fruit soda, Medium', 'Beverages', 52.0],
  ['Water melon fruit soda, Large', 'Beverages', 64.0],
  // --- Fruit milks ---
  ['Blue lemonade Fruit milk, Small', 'Beverages', 52.0],
  ['Blue lemonade Fruit milk, Medium', 'Beverages', 64.0],
  ['Bluelemonade Fruit milk, Large', 'Beverages', 75.0],
  ['Blueberry Fruity milk, Small', 'Beverages', 52.0],
  ['Blueberry Fruity milk, Medium', 'Beverages', 64.0],
  ['Blueberry Fruity milk, large', 'Beverages', 75.0],
  ['Four seasons fruit milk, Small', 'Beverages', 52.0],
  ['Four seasons fruit milk, Medium', 'Beverages', 64.0],
  ['Four seasons fruit milk, Large', 'Beverages', 75.0],
  ['Green Apple fruit milk, small', 'Beverages', 52.0],
  ['Green Apple fruit milk, Medium', 'Beverages', 64.0],
  ['Green Apple fruit milk, Large', 'Beverages', 75.0],
  ['Mango Fruity milk, small', 'Beverages', 52.0],
  ['Mango Fruity milk, Medium', 'Beverages', 64.0],
  ['Mango Fruity milk, Large', 'Beverages', 75.0],
  ['Strawberry fruit milk, Small', 'Beverages', 52.0],
  ['Strawberry fruit milk, Medium', 'Beverages', 64.0],
  ['Strawberry fruity milk, Large', 'Beverages', 75.0],
  ['Water melon fruity milk, small', 'Beverages', 52.0],
  ['Water melon fruity milk, Medium', 'Beverages', 64.0],
  ['Water melon fruity milk, large', 'Beverages', 75.0],
  // --- Fruit yakults ---
  ['Blueberry Fruity yakult, small', 'Beverages', 64.0],
  ['Blueberry Fruity yakult, Medium', 'Beverages', 75.0],
  ['Four seasons fruity yakult, small', 'Beverages', 64.0],
  ['Four seasons Fruity yakult, Medium', 'Beverages', 75.0],
  ['Green Apple Fruit Yakult, Medium', 'Beverages', 75.0],
  ['Mango Fruity Yakult, Small', 'Beverages', 64.0],
  ['Mango Fruity Yakult, Medium', 'Beverages', 75.0],
  ['Strawberry Fruity Yakult, Small', 'Beverages', 64.0],
  ['Strawberry Fruity Yakult, Medium', 'Beverages', 75.0],
  ['Watermelon Fruity Yakult, Small', 'Beverages', 64.0],
  ['Watermelon Fruity Yakult, Medium', 'Beverages', 75.0],
  // --- Food ---
  ['Chicken Pastil with rice', 'Main Courses', 110.0],
  ['Pork Siomai with Rice', 'Main Courses', 110.0],
  ['Pork Sisig with Rice', 'Main Courses', 110.0],
  ['Skinless langgonisa', 'Main Courses', 75.0],
  ['Skinless langgonisa with rice', 'Main Courses', 98.0],
  ['Spam with rice', 'Main Courses', 87.0],
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