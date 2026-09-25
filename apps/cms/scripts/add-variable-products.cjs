/**
 * Add 27 variable products (3 per merchant 1-9) + variations + attributes.
 *
 * Schema (verified via subagents):
 * - products: productType=variable, basePrice=null/omit, createdByVendor XOR, slug, catalogVisibility=visible
 * - prod-attributes: {name, slug unique, type:select} - one per parent (slug var-XX-opt) to avoid collisions
 * - prod-attribute-terms: {attribute_id, name, slug} scoped by attribute_id
 * - prod-variations: {product_id->variable parent, modifier_behavior_mode=inherit_product, name, base_price, stock_quantity}
 * - prod-variation-values: {variation_id, attribute_id, term_id}
 * - merchant-products: ONE per (merchant, parent) {merchant_id, product_id, added_by:vendor}
 *
 * Usage:
 *   node scripts/add-variable-products.cjs --dry-run
 *   node scripts/add-variable-products.cjs
 */
const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const API_URL = process.env.PAYLOAD_API_URL || 'https://cms.kuyacares.com/api';
const API_KEY = process.env.PAYLOAD_API_KEY;
const DRY_RUN = process.argv.includes('--dry-run');

function slugify(s) {
  return String(s).normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase()
    .replace(/[/]+/g, '-').replace(/[^a-z0-9\s-]/g, '').trim().replace(/[\s-]+/g, '-');
}

// [parentName, parentSlug, attrName, variations: [variationName, termName, price, stock]]
const PLAN = [
  { m: 1, v: 2, items: [
    ['Purified Water Order (Variable)', 'purevida-water-order', 'Container', [['Refill', 'Refill', 40, 100], ['New Jug', 'New Jug', 350, 20], ['2x Refill Bundle', '2x Refill Bundle', 75, 50]]],
    ['Dispenser Plan (Variable)', 'purevida-dispenser-plan', 'Plan', [['Rental Monthly', 'Rental Monthly', 300, 10], ['Deposit plus Install', 'Deposit plus Install', 1500, 10], ['Buy Unit', 'Buy Unit', 4500, 10]]],
    ['Delivery Size (Variable)', 'purevida-delivery-size', 'Size', [['5-Gal Slim', '5-Gal Slim', 40, 100], ['5-Gal Round', '5-Gal Round', 45, 80], ['350ml Case 24', '350ml Case 24', 280, 30]]],
  ]},
  { m: 2, v: 3, items: [
    ['Panic Alarm Kit (Variable)', 'panic-alarm-kit', 'Kit', [['Basic Wired', 'Basic Wired', 1500, 15], ['Wireless Set', 'Wireless Set', 2800, 15], ['Wireless plus Siren Pro', 'Wireless plus Siren Pro', 4200, 15]]],
    ['Installation Package (Variable)', 'panic-install-package', 'Service', [['DIY Kit Only', 'DIY Kit Only', 1500, 15], ['With Install', 'With Install', 2800, 15], ['Install plus 1yr Warranty', 'Install plus 1yr Warranty', 3500, 15]]],
    ['Maintenance Plan (Variable)', 'panic-maintenance-plan', 'Term', [['Single Visit', 'Single Visit', 800, 20], ['Annual 2x', 'Annual 2x', 1400, 20], ['Annual 4x', 'Annual 4x', 2400, 20]]],
  ]},
  { m: 3, v: 4, items: [
    ['Palm Cooking Oil (Variable)', 'queen-palm-oil', 'Size', [['1.5L PET', '1.5L PET', 145, 60], ['5L Jerry', '5L Jerry', 420, 40], ['16kg Tin', '16kg Tin', 1250, 15]]],
    ['Vegetable Oil Value Pack (Variable)', 'queen-veg-oil-pack', 'Pack', [['1.5L x1', '1.5L x1', 145, 60], ['1.5L x2 Bundle', '1.5L x2 Bundle', 280, 40], ['5L plus 1.5L Combo', '5L plus 1.5L Combo', 540, 30]]],
    ['Bulk Carinderia Pack (Variable)', 'queen-bulk-pack', 'Bulk', [['5L x2', '5L x2', 800, 20], ['16kg Tin x1', '16kg Tin x1', 1250, 15], ['16kg x2', '16kg x2', 2400, 10]]],
  ]},
  { m: 4, v: 5, items: [
    ['AT Tire (Variable)', 'terrain-tire', 'Size', [['265/65 R17', '265/65 R17', 7500, 8], ['285/70 R17', '285/70 R17', 8900, 8], ['265/60 R18', '265/60 R18', 9200, 8]]],
    ['Tire Service (Variable)', 'terrain-tire-service', 'Service', [['Mounting Only', 'Mounting Only', 200, 50], ['Mount plus Balance', 'Mount plus Balance', 350, 50], ['Mount Balance Align', 'Mount Balance Align', 1200, 20]]],
    ['Wheel Kit (Variable)', 'terrain-wheel-kit', 'Kit', [['Valve Set', 'Valve Set', 150, 40], ['Weights Set', 'Weights Set', 180, 40], ['Valve plus Weights', 'Valve plus Weights', 300, 40]]],
  ]},
  { m: 5, v: 6, items: [
    ['Pest Visit (Variable)', 'asia-pest-visit', 'Area', [['Up to 100sqm', 'Up to 100sqm', 1800, 20], ['101-200sqm', '101-200sqm', 2800, 20], ['Whole House', 'Whole House', 4500, 20]]],
    ['Termite Job (Variable)', 'asia-termite-job', 'Scope', [['Inspection Only', 'Inspection Only', 800, 30], ['Spot Treatment', 'Spot Treatment', 2500, 20], ['Full Treatment', 'Full Treatment', 6500, 10]]],
    ['Disinfection (Variable)', 'asia-disinfection', 'Size', [['Studio', 'Studio', 1500, 20], ['2BR', '2BR', 2000, 20], ['House', 'House', 3200, 15]]],
  ]},
  { m: 6, v: 7, items: [
    ['Haircut (Variable)', 'beauty-haircut', 'Type', [['Classic Cut', 'Classic Cut', 200, 50], ['Cut plus Wash', 'Cut plus Wash', 250, 50], ['Cut Wash Blowout', 'Cut Wash Blowout', 400, 50]]],
    ['Massage (Variable)', 'beauty-massage', 'Duration', [['60min', '60min', 500, 30], ['90min', '90min', 750, 30], ['120min', '120min', 1000, 20]]],
    ['Nails (Variable)', 'beauty-nails', 'Service', [['Manicure', 'Manicure', 350, 30], ['Pedicure', 'Pedicure', 400, 30], ['Mani Pedi Gel', 'Mani Pedi Gel', 600, 30]]],
  ]},
  { m: 7, v: 8, items: [
    ['Fried Chicken (Variable)', 'savor-fried-chicken', 'Meal', [['Solo', 'Solo', 99, 60], ['Meal Rice Drink', 'Meal Rice Drink', 129, 60], ['Buddy 2pc', 'Buddy 2pc', 249, 40]]],
    ['Sisig (Variable)', 'savor-sisig', 'Serve', [['Solo Plate', 'Solo Plate', 129, 50], ['Meal Rice Egg', 'Meal Rice Egg', 149, 50], ['Family Platter', 'Family Platter', 399, 20]]],
    ['Pancit Bilao (Variable)', 'savor-pancit-bilao', 'Size', [['Small 5-6pax', 'Small 5-6pax', 550, 15], ['Medium 8-10pax', 'Medium 8-10pax', 850, 12], ['Large 12-15pax', 'Large 12-15pax', 1250, 10]]],
  ]},
  { m: 8, v: 9, items: [
    ['Change Oil (Variable)', 'prime-change-oil', 'Oil', [['Mineral', 'Mineral', 1400, 20], ['Semi-Synthetic', 'Semi-Synthetic', 1800, 20], ['Fully Synthetic', 'Fully Synthetic', 2200, 20]]],
    ['Wash (Variable)', 'prime-wash', 'Tier', [['Exterior Only', 'Exterior Only', 200, 50], ['Wash plus Vacuum', 'Wash plus Vacuum', 350, 50], ['Full Detailing Wash', 'Full Detailing Wash', 1200, 15]]],
    ['Brakes (Variable)', 'prime-brakes', 'Axle', [['Front Set', 'Front Set', 2500, 12], ['Rear Set', 'Rear Set', 2500, 12], ['Front plus Rear', 'Front plus Rear', 4800, 10]]],
  ]},
  { m: 9, v: 10, items: [
    ['Dining Chair (Variable)', 'homeline-dining-chair', 'Finish', [['Natural', 'Natural', 1500, 20], ['Mahogany', 'Mahogany', 1800, 20], ['Walnut plus Cushion', 'Walnut plus Cushion', 2400, 15]]],
    ['Center Table (Variable)', 'homeline-center-table', 'Size', [['80cm', '80cm', 2800, 10], ['90x50cm', '90x50cm', 3500, 10], ['120cm', '120cm', 4800, 8]]],
    ['Repair Call (Variable)', 'homeline-repair-call', 'Scope', [['Touch-up', 'Touch-up', 500, 20], ['Minor Repair', 'Minor Repair', 900, 20], ['Major plus Varnish', 'Major plus Varnish', 1800, 10]]],
  ]},
];

async function api(method, endpoint, body) {
  const res = await fetch(`${API_URL}${endpoint}`, {
    method,
    headers: { 'Content-Type': 'application/json', Authorization: `users API-Key ${API_KEY}` },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = null; }
  if (!res.ok) throw new Error(`${method} ${endpoint} -> ${res.status}: ${text.slice(0, 400)}`);
  return data;
}

async function ensureAttribute(slug, name) {
  const s = await api('GET', `/prod-attributes?where[slug][equals]=${encodeURIComponent(slug)}&limit=1&depth=0`);
  if (s?.docs?.[0]) return s.docs[0];
  return (await api('POST', '/prod-attributes', { name, slug, type: 'select' })).doc;
}

async function ensureTerm(attrId, slug, name) {
  const s = await api('GET', `/prod-attribute-terms?where[attribute_id][equals]=${attrId}&where[slug][equals]=${encodeURIComponent(slug)}&limit=1&depth=0`);
  if (s?.docs?.[0]) return s.docs[0];
  return (await api('POST', '/prod-attribute-terms', { attribute_id: attrId, name, slug })).doc;
}

async function ensureProduct(vendorId, name, slug) {
  const s = await api('GET', `/products?where[createdByVendor][equals]=${vendorId}&where[name][equals]=${encodeURIComponent(name)}&limit=1&depth=0`);
  if (s?.docs?.[0]) return s.docs[0];
  return (await api('POST', '/products', {
    createdByVendor: vendorId, productType: 'variable', name, slug,
    catalogVisibility: 'visible', isActive: true, assign_to_all_vendor_merchants: false,
  })).doc;
}

async function ensureVariation(productId, name, price, stock) {
  const s = await api('GET', `/prod-variations?where[product_id][equals]=${productId}&limit=100&depth=0`);
  const found = (s?.docs || []).find((d) => d.name === name);
  if (found) return found;
  return (await api('POST', '/prod-variations', {
    product_id: productId, modifier_behavior_mode: 'inherit_product',
    name, base_price: price, stock_quantity: stock, is_visible: true,
  })).doc;
}

async function ensureValue(variationId, attrId, termId) {
  const s = await api('GET', `/prod-variation-values?where[variation_id][equals]=${variationId}&where[attribute_id][equals]=${attrId}&limit=1&depth=0`);
  if (s?.docs?.[0]) return s.docs[0];
  return (await api('POST', '/prod-variation-values', { variation_id: variationId, attribute_id: attrId, term_id: termId })).doc;
}

async function ensureLink(merchantId, productId) {
  const s = await api('GET', `/merchant-products?where[merchant_id][equals]=${merchantId}&where[product_id][equals]=${productId}&limit=1&depth=0`);
  if (s?.docs?.[0]) return { doc: s.docs[0], created: false };
  const doc = (await api('POST', '/merchant-products', { merchant_id: merchantId, product_id: productId, added_by: 'vendor' })).doc;
  return { doc, created: true };
}

async function main() {
  if (!API_KEY) { console.error('PAYLOAD_API_KEY missing'); process.exit(1); }
  if (DRY_RUN) console.log('DRY RUN - no writes.\n');
  let cP = 0, cV = 0, cL = 0;
  for (const group of PLAN) {
    for (const [pName, pSlugBase, attrName, vars] of group.items) {
      const pSlug = pSlugBase;
      const attrSlug = `${pSlugBase}-opt`;
      console.log('========================================');
      console.log(`M${group.m}/V${group.v} | ${pName} | ${vars.length} vars`);
      if (DRY_RUN) { console.log(`  [dry-run] Would create ${pName} + attr ${attrSlug} + ${vars.length} variations+values + link.`); continue; }
      const product = await ensureProduct(group.v, pName, pSlug);
      console.log(`  product id ${product.id}`);
      const attr = await ensureAttribute(attrSlug, `${pName} ${attrName}`);
      const termIds = {};
      for (const [vName, termName, price, stock] of vars) {
        const tSlug = slugify(termName);
        termIds[vName] = await ensureTerm(attr.id, tSlug, termName);
      }
      for (const [vName, termName, price, stock] of vars) {
        const variation = await ensureVariation(product.id, vName, price, stock);
        await ensureValue(variation.id, attr.id, termIds[vName].id);
        cV++;
        console.log(`  var ${variation.id} ${vName} P${price} s${stock}`);
      }
      cP++;
      const link = await ensureLink(group.m, product.id);
      if (link.created) cL++;
      console.log(`  link m${group.m}->p${product.id} ${link.created ? 'created ' + link.doc.id : 'exists'}`);
    }
  }
  console.log(`\n${DRY_RUN ? 'DRY RUN complete.' : `Done. ${cP} parents touched, ${cV} variations touched, ${cL} new links.`}`);
}

main().catch((e) => { console.error('Fatal:', e); process.exit(1); });
