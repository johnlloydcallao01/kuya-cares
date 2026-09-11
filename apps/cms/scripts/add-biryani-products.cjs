/**
 * Add products for AUTHENTIC BIRYANI & ME to the CMS.
 *
 * For each product in the list below this script:
 *  1. Creates a Product in the `products` collection:
 *     - createdByVendor = 9 (AUTHENTIC BIRYANI & ME)
 *     - productType = 'simple' (Simple Product)
 *     - name, slug (derived from name), categories (matched by name),
 *       basePrice (from the price column), sku (name + product id, uppercased)
 *  2. Creates a Merchant Product in the `merchant-products` collection:
 *     - merchant_id = 15 (AUTHENTIC BIRYANI & ME)
 *     - product_id = the product created above
 *     - added_by = 'vendor'
 *
 * Usage:
 *   node scripts/add-biryani-products.cjs            # perform the insertion
 *   node scripts/add-biryani-products.cjs --dry-run  # print plan only
 *
 * The script is idempotent: products already owned by vendor 9 with the same
 * name are skipped (and their merchant product is created if missing).
 */
const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const API_URL = process.env.PAYLOAD_API_URL || 'https://cms.kuyacares.com/api';
const API_KEY = process.env.PAYLOAD_API_KEY;

const VENDOR_ID = 9; // AUTHENTIC BIRYANI & ME
const MERCHANT_ID = 15; // AUTHENTIC BIRYANI & ME

const DRY_RUN = process.argv.includes('--dry-run');

// Product list: [name, price in PHP]
const PRODUCTS = [
  ['Kebab Biryani, Beef', 274.0],
  ['Kebab Wrap, Chicken', 109.0],
  ['Kebab Wrap, Beef', 142.0],
  ['Kebab Burger (Chicken)', 109.0],
  ['Kebab Burger (Beef)', 142.0],
  ['Tikka on Stick (88)', 88.0],
  ['Tikka on Stick, Chicken (165)', 165.0],
  ['Chi-Chili Chicken', 252.0],
  ['Chicken Fry', 219.0],
  ['Pani Puri Set', 362.0],
  ['Chole Bhature', 164.0],
  ['Chicken Samosa', 72.0],
  ['Vegetable Samosa', 39.0],
  ['Lumpiang Sisig', 110.0],
  ['Potato Fries/Chips (54)', 54.0],
  ['Potato Fries/Chips (98)', 98.0],
  ['Potato Fries/Chips (120)', 120.0],
  ['Potato Fries/Chips', 219.0],
  ['Cheesy Mushroom', 197.0],
  ['Palak Paneer', 164.0],
  ['Shai Paneer', 164.0],
  ['Buttered Chix', 219.0],
  ['Buttered Beef', 274.0],
  ['Curry chix', 219.0],
  ['Curry beef', 307.0],
  ['Curry Mutton', 362.0],
  ['Masala chix', 219.0],
  ['Masala beef', 307.0],
  ['Masala Mutton', 362.0],
  ['Karahi chix', 219.0],
  ['Karahi beef', 307.0],
  ['Karahi Mutton', 362.0],
  ['Combo biryani (small)', 329.0],
  ['Combo biryani (medium', 879.0],
  ['Combo biryani (Large)', 1210.0],
  ['Chicken Biryani (small)', 164.0],
  ['Chicken biryani (Medium)', 549.0],
  ['Chicken biryani (Large)', 989.0],
  ['Beef biryani (Large)', 1044.0],
  ['Beef biryani (Medium)', 659.0],
  ['Beef biryani (small)', 241.0],
  ['Shrimp biryani (Large)', 1044.0],
  ['Shrimp biryani (Medium)', 659.0],
  ['Shrimp biryani (small)', 219.0],
  ['Chicken curry', 207.0],
  ['Butter chicken', 207.0],
  ['Chicken tikka', 339.0],
  ['Sunday special chole bhature', 164.0],
  ['Beef chicken roll (chicken)', 104.0],
  ['Beef / chicken roll (Beef)', 130.0],
  ['Naan with humus (garlic)', 131.0],
  ['Naan with humus (cheese)', 142.0],
  ['Naan with humus', 119.0],
  ['Paratha (Aloo)', 104.0],
  ['Paratha (cheese)', 115.0],
  ['Bicol express (chicken)', 207.0],
  ['Bicol express (Beef)', 229.0],
  ['Binagoongan (Beef)', 229.0],
  ['Sizzling Sisig (chicken)', 206.0],
  ['Sizzling sisig (Beef)', 229.0],
  ['Chicken Beef Pansit', 207.0],
  ['Shrimp Biryani', 1419.0],
  ['Mutton Biryani (Small)', 383.0],
  ['Mutton Biryani (Medium)', 1133.0],
  ['Mutton Biryani (Large)', 411.0],
];

// Products that already exist for this vendor and should be UPDATED instead of
// duplicated. The existing product keeps its current name/slug/sku; only the
// base price is updated to the listed value (and the merchant link is ensured).
const UPDATE_EXISTING_PRICE = {
  'Binagoongan (Beef)': 229.0, // existing product is "Binagoongan (beef)" @ 219
};

// Category assignment by product name (matched against the product-categories
// collection so the category id is always resolved at runtime).
const CATEGORY_BY_PRODUCT = {
  'Kebab Biryani, Beef': 'Main Courses',
  'Kebab Wrap, Chicken': 'Sandwich',
  'Kebab Wrap, Beef': 'Sandwich',
  'Kebab Burger (Chicken)': 'Burger',
  'Kebab Burger (Beef)': 'Burger',
  'Tikka on Stick (88)': 'Appetizer',
  'Tikka on Stick, Chicken (165)': 'Appetizer',
  'Chi-Chili Chicken': 'Main Courses',
  'Chicken Fry': 'Main Courses',
  'Pani Puri Set': 'Appetizer',
  'Chole Bhature': 'Main Courses',
  'Chicken Samosa': 'Appetizer',
  'Vegetable Samosa': 'Appetizer',
  'Lumpiang Sisig': 'Appetizer',
  'Potato Fries/Chips (54)': 'Addons',
  'Potato Fries/Chips (98)': 'Addons',
  'Potato Fries/Chips (120)': 'Addons',
  'Potato Fries/Chips': 'Addons',
  'Cheesy Mushroom': 'Main Courses',
  'Palak Paneer': 'Main Courses',
  'Shai Paneer': 'Main Courses',
  'Buttered Chix': 'Main Courses',
  'Buttered Beef': 'Main Courses',
  'Curry chix': 'Main Courses',
  'Curry beef': 'Main Courses',
  'Curry Mutton': 'Main Courses',
  'Masala chix': 'Main Courses',
  'Masala beef': 'Main Courses',
  'Masala Mutton': 'Main Courses',
  'Karahi chix': 'Main Courses',
  'Karahi beef': 'Main Courses',
  'Karahi Mutton': 'Main Courses',
  'Combo biryani (small)': 'Main Courses',
  'Combo biryani (medium': 'Main Courses',
  'Combo biryani (Large)': 'Main Courses',
  'Chicken Biryani (small)': 'Main Courses',
  'Chicken biryani (Medium)': 'Main Courses',
  'Chicken biryani (Large)': 'Main Courses',
  'Beef biryani (Large)': 'Main Courses',
  'Beef biryani (Medium)': 'Main Courses',
  'Beef biryani (small)': 'Main Courses',
  'Shrimp biryani (Large)': 'Main Courses',
  'Shrimp biryani (Medium)': 'Main Courses',
  'Shrimp biryani (small)': 'Main Courses',
  'Chicken curry': 'Main Courses',
  'Butter chicken': 'Main Courses',
  'Chicken tikka': 'Main Courses',
  'Sunday special chole bhature': 'Main Courses',
  'Beef chicken roll (chicken)': 'Sandwich',
  'Beef / chicken roll (Beef)': 'Sandwich',
  'Naan with humus (garlic)': 'Addons',
  'Naan with humus (cheese)': 'Addons',
  'Naan with humus': 'Addons',
  'Paratha (Aloo)': 'Addons',
  'Paratha (cheese)': 'Addons',
  'Bicol express (chicken)': 'Main Courses',
  'Bicol express (Beef)': 'Main Courses',
  'Binagoongan (Beef)': 'Main Courses',
  'Sizzling Sisig (chicken)': 'Main Courses',
  'Sizzling sisig (Beef)': 'Main Courses',
  'Chicken Beef Pansit': 'Main Courses',
  'Shrimp Biryani': 'Main Courses',
  'Mutton Biryani (Small)': 'Main Courses',
  'Mutton Biryani (Medium)': 'Main Courses',
  'Mutton Biryani (Large)': 'Main Courses',
};

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

  for (const [name, price] of PRODUCTS) {
    const slug = slugify(name);
    const categoryName = CATEGORY_BY_PRODUCT[name];
    const categoryId = categoryName ? catIdByName.get(categoryName) : undefined;

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
    // Some entries (see UPDATE_EXISTING_PRICE) intentionally reuse an existing
    // product with a slightly different spelling and only update its price.
    let existing = null;
    try {
      const search = await api(
        'GET',
        `/products?where[createdByVendor][equals]=${VENDOR_ID}&where[name][equals]=${encodeURIComponent(name)}&limit=1&depth=0`
      );
      existing = search?.docs?.[0] || null;

      // Fallback: if not found by exact name and this is an update-existing
      // entry, search case-insensitively among this vendor's products.
      if (!existing && UPDATE_EXISTING_PRICE[name] !== undefined) {
        const all = await api(
          'GET',
          `/products?where[createdByVendor][equals]=${VENDOR_ID}&limit=500&depth=0`
        );
        existing =
          all?.docs?.find(
            (p) => String(p.name).toLowerCase() === String(name).toLowerCase()
          ) || null;
      }
    } catch (e) {
      console.error(`  !! Lookup failed: ${e.message}`);
    }

    let productId;

    if (existing) {
      productId = existing.id;
      console.log(`  -> Product already exists (id ${productId}). Skipping create.`);

      // Update base price if this entry maps to an existing product.
      const updatePrice = UPDATE_EXISTING_PRICE[name];
      if (updatePrice !== undefined) {
        if (DRY_RUN) {
          console.log(`  [dry-run] Would update base price to ₱ ${updatePrice.toFixed(2)}.`);
        } else {
          await api('PATCH', `/products/${productId}`, { basePrice: updatePrice });
          console.log(`  -> Updated base price to ₱ ${updatePrice.toFixed(2)}.`);
          createdProducts++;
        }
      }
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