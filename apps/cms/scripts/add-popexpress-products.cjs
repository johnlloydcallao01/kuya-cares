/**
 * Add products for POP EXPRESS PIZZERIA to the CMS.
 *
 * For each product in the list below this script:
 *  1. Creates a Product in the `products` collection:
 *     - createdByVendor = 18 (POP EXPRESS PIZZERIA)
 *     - productType = 'simple' (Simple Product)
 *     - name, slug (derived from name), categories (matched by name),
 *       basePrice (from the price column), sku (name + product id, uppercased)
 *  2. Creates a Merchant Product in the `merchant-products` collection:
 *     - merchant_id = 23 (POP EXPRESS PIZZERIA)
 *     - product_id = the product created above
 *     - added_by = 'vendor'
 *
 * Usage:
 *   node scripts/add-popexpress-products.cjs            # perform the insertion
 *   node scripts/add-popexpress-products.cjs --dry-run  # print plan only
 *
 * The script is idempotent: products already owned by vendor 18 with the same
 * name are skipped (and their merchant product is created if missing).
 */
const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const API_URL = process.env.PAYLOAD_API_URL || 'https://cms.kuyacares.com/api';
const API_KEY = process.env.PAYLOAD_API_KEY;

const VENDOR_ID = 18; // POP EXPRESS PIZZERIA
const MERCHANT_ID = 23; // POP EXPRESS PIZZERIA

const DRY_RUN = process.argv.includes('--dry-run');

// Product list: [name, category, price in PHP]
const PRODUCTS = [
  ['Pop Express Special (BEST SELLER)', 'Pizza', 448.0],
  ['Cheese Burger with Mozzarella (BEST SELLER)', 'Burger', 402.0],
  ['Lala Holulu (BEST SELLER)', 'Pizza', 229.0],
  ['Pinoy Pepperoni (BEST SELLER)', 'Pizza', 229.0],
  ['Cheese and Garlic', 'Pizza', 206.0],
  ['Ham and Cheese', 'Pizza', 229.0],
  ['Bacon Cheese', 'Pizza', 229.0],
  ['Gourmet Corner Stone', 'Pizza', 448.0],
  ['Veggie Hawaiian', 'Pizza', 448.0],
  ['Caesar Salad Pizza', 'Pizza', 459.0],
  ['Butchers Choice Chessy Loads', 'Pizza', 344.0],
  ['Cheese Overload', 'Pizza', 333.0],
  ['Ernest Choice with Mozzarella', 'Pizza', 344.0],
  ['Everything on Cheese Loads', 'Pizza', 344.0],
  ['Sweet Bacon with Mozzarella', 'Pizza', 344.0],
  ['Chicken Tenders and Fries', 'Fried Chicken', 172.0],
  ['Chicken Tenders', 'Fried Chicken', 218.0],
  ['Ceremonial Cookies and Cream 16 ounce', 'Beverages', 183.0],
  ['Ceremonial Matcha Cookies and Cream 12 ounce', 'Beverages', 149.0],
  ['Ceremonial Matcha Latte 22 ounce', 'Beverages', 160.0],
  ['Ceremonial Matcha Latte 12 ounce', 'Beverages', 114.0],
  ['Just lemon 22 ounce', 'Beverages', 109.0],
  ['Just Lemon 16 ounce', 'Beverages', 91.0],
  ['Iced Cafe Americano 22 ounce', 'Beverages', 80.0],
  ['Iced Cafe Americano', 'Beverages', 68.0],
  ['Iced Coffee latte 22 ounce', 'Beverages', 137.0],
  ['Iced Coffee Latte 16 ounce', 'Beverages', 103.0],
  ['Iced Coffee Mocha 22 ounce', 'Beverages', 149.0],
  ['Iced Coffee Mocha 16 ounce', 'Beverages', 114.0],
  ['Iced Spanish Latte 22 ounce', 'Beverages', 149.0],
  ['Iced Spanish Latte 16 ounce', 'Beverages', 114.0],
  ['Biscoff Milk Tea 22 ounce', 'Beverages', 91.0],
  ['Biscoff Milk Tea 16 Ounce', 'Beverages', 68.0],
  ['Biscoff Frappe 22 ounce', 'Beverages', 160.0],
  ['Biscoff Frappe 16 ounce', 'Beverages', 114.0],
  ['Caramel Macchiatto Frappe 22 ounce', 'Beverages', 160.0],
  ['Caramel Macchiatto Frappe 16 ounce', 'Beverages', 114.0],
  ['Java Chips Frappe 22 ounce', 'Beverages', 160.0],
  ['Java Chip Frappe 16 ounce', 'Beverages', 114.0],
  ['Matcha Frappe 22 ounce', 'Beverages', 160.0],
  ['Matcha Frappe 12 ounce', 'Beverages', 114.0],
  ['Strawberry and cream Frappe 22 ounce', 'Beverages', 160.0],
  ['Strawberry and cream Frappe 16 ounce', 'Beverages', 114.0],
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