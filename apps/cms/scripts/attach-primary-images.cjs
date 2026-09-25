/**
 * Attach primary images to products 1-27.
 *
 * Pipeline (per subagent analysis):
 * - products.media.primaryImage is upload->media (NOT top-level)
 * - media create = multipart POST /api/media {file, alt}, auth `users API-Key`
 * - attach = PATCH /api/products/:id { media: { primaryImage: mediaId } }
 * - Pexels page URLs are HTML; use direct CDN images.pexels.com/photos/{id}/... which returns image/jpeg
 * - Filenames must be unique (adapter unique_filename:false, overwrite:false, folder main-uploads)
 *
 * Usage:
 *   node scripts/attach-primary-images.cjs --dry-run
 *   node scripts/attach-primary-images.cjs
 */
const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const API_URL = process.env.PAYLOAD_API_URL || 'https://cms.kuyacares.com/api';
const API_KEY = process.env.PAYLOAD_API_KEY;
const DRY_RUN = process.argv.includes('--dry-run');

const cdn = (id) => `https://images.pexels.com/photos/${id}/pexels-photo-${id}.jpeg?auto=compress&cs=tinysrgb&w=800`;

// productId -> pexels photo id + label
const PLAN = [
  { pid: 1, pex: 20571710, label: 'Purified 5-Gallon Refill' },
  { pid: 2, pex: 15524063, label: '5-Gallon New Container' },
  { pid: 3, pex: 11860563, label: 'Dispenser Rental' },
  { pid: 4, pex: 31470430, label: 'Panic Alarm Basic' },
  { pid: 5, pex: 33335255, label: 'Panic Wireless Set' },
  { pid: 6, pex: 31470430, label: 'Panic Maintenance' },
  { pid: 7, pex: 8490099, label: 'Palm Oil 1.5L' },
  { pid: 8, pex: 6937407, label: 'Vegetable Oil 5L' },
  { pid: 9, pex: 4910159, label: 'Oil 16kg Tin' },
  { pid: 10, pex: 7259831, label: 'Tire 265/65' },
  { pid: 11, pex: 33395582, label: 'Tire Mounting' },
  { pid: 12, pex: 32070258, label: 'Valve Set' },
  { pid: 13, pex: 4099091, label: 'Pest Control Visit' },
  { pid: 14, pex: 3951389, label: 'Termite Treatment' },
  { pid: 15, pex: 4098786, label: 'Disinfection' },
  { pid: 16, pex: 7447130, label: 'Haircut Wash' },
  { pid: 17, pex: 6560304, label: 'Massage 60min' },
  { pid: 18, pex: 5619449, label: 'Mani/Pedi' },
  { pid: 19, pex: 34628054, label: 'Fried Chicken Meal' },
  { pid: 20, pex: 30355484, label: 'Sisig Plate' },
  { pid: 21, pex: 25440677, label: 'Pancit Bilao (food-plate fallback)' },
  { pid: 22, pex: 10490621, label: 'Change Oil' },
  { pid: 23, pex: 6873119, label: 'Car Wash' },
  { pid: 24, pex: 6870319, label: 'Brake Pad' },
  { pid: 25, pex: 36718705, label: 'Dining Chair' },
  { pid: 26, pex: 15602699, label: 'Center Table' },
  { pid: 27, pex: 8199670, label: 'Furniture Repair (room fallback)' },
];

async function apiJson(method, endpoint, body) {
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
  try { data = text ? JSON.parse(text) : null; } catch { data = null; }
  if (!res.ok) throw new Error(`${method} ${endpoint} -> ${res.status}: ${text.slice(0, 400)}`);
  return data;
}

async function downloadImage(url) {
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
      Referer: 'https://www.pexels.com/',
      Accept: 'image/*',
    },
  });
  if (!res.ok) throw new Error(`download ${res.status} for ${url}`);
  const ct = res.headers.get('content-type') || '';
  if (!ct.startsWith('image/')) throw new Error(`not an image (${ct}) for ${url}`);
  const buf = Buffer.from(await res.arrayBuffer());
  return { buf, ct };
}

async function uploadMedia(buf, filename, mime, alt) {
  const blob = new Blob([buf], { type: mime.split(';')[0] || 'image/jpeg' });
  const fd = new FormData();
  fd.append('file', blob, filename);
  fd.append('alt', alt);
  const res = await fetch(`${API_URL}/media`, {
    method: 'POST',
    headers: { Authorization: `users API-Key ${API_KEY}` },
    body: fd,
  });
  const text = await res.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = null; }
  if (!res.ok) throw new Error(`POST /media -> ${res.status}: ${text.slice(0, 400)}`);
  return data?.doc;
}

function slugify(s) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

async function main() {
  if (!API_KEY) { console.error('PAYLOAD_API_KEY missing'); process.exit(1); }
  if (DRY_RUN) console.log('DRY RUN - no uploads.\n');
  let done = 0, skipped = 0;
  for (const item of PLAN) {
    const url = cdn(item.pex);
    console.log('========================================');
    console.log(`Product ${item.pid} | ${item.label} | pexels ${item.pex}`);
    console.log(`  src: ${url}`);
    try {
      const cur = await apiJson('GET', `/products/${item.pid}?depth=0`);
      const existing = cur?.media?.primaryImage;
      if (existing) {
        console.log(`  -> Already has primaryImage ${typeof existing === 'object' ? existing.id : existing}. Skipping.`);
        skipped++;
        continue;
      }
    } catch (e) { console.error(`  !! read failed: ${e.message}`); }
    if (DRY_RUN) { console.log('  [dry-run] Would download+upload+patch.'); continue; }
    try {
      const { buf, ct } = await downloadImage(url);
      console.log(`  -> Downloaded ${buf.length} bytes (${ct}).`);
      const filename = `product-${item.pid}-${slugify(item.label)}-${item.pex}.jpg`;
      const doc = await uploadMedia(buf, filename, ct, item.label);
      console.log(`  -> Media id ${doc.id} cloudinary: ${doc.cloudinaryURL || doc.url || ''}`);
      await apiJson('PATCH', `/products/${item.pid}`, { media: { primaryImage: doc.id } });
      console.log(`  -> Patched product ${item.pid} primaryImage=${doc.id}.`);
      done++;
    } catch (e) { console.error(`  !! FAILED: ${e.message}`); }
  }
  console.log(`\nDone. Attached ${done}, skipped ${skipped}.`);
}

main().catch((e) => { console.error('Fatal:', e); process.exit(1); });
