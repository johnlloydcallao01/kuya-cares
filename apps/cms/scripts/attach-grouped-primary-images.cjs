/**
 * Attach primary images to GROUPED products 56-82 (1 per bundle).
 *
 * Same pipeline as attach-primary-images.cjs / attach-variable-primary-images.cjs:
 * - products.media.primaryImage is upload->media (NOT a URL string)
 * - download Pexels direct CDN bytes -> multipart POST /api/media {file, alt}
 * - attach = PATCH /api/products/:id { media: { primaryImage: mediaId } }
 * - Pexels page URLs are HTML and won't work; use direct CDN images.pexels.com
 *   which returns image/jpeg. All photo IDs below were already proven working
 *   in the simple/variable/category batches (same domain per bundle).
 * - Filenames prefixed product-grouped- for uniqueness
 *   (adapter unique_filename:false, overwrite:false, folder main-uploads).
 * - Idempotent: skips products that already have media.primaryImage.
 *
 * Usage:
 *   node scripts/attach-grouped-primary-images.cjs --dry-run
 *   node scripts/attach-grouped-primary-images.cjs
 */
const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const API_URL = process.env.PAYLOAD_API_URL || 'https://cms.kuyacares.com/api';
const API_KEY = process.env.PAYLOAD_API_KEY;
const DRY_RUN = process.argv.includes('--dry-run');

const cdn = (id) => `https://images.pexels.com/photos/${id}/pexels-photo-${id}.jpeg?auto=compress&cs=tinysrgb&w=800`;

// grouped productId -> proven pexels photo id (same business domain) + label
const PLAN = [
  { pid: 56, pex: 15524063, label: 'Purevida New Home Starter Bundle' },
  { pid: 57, pex: 20571710, label: 'Purevida Family Water Bundle' },
  { pid: 58, pex: 11860563, label: 'Purevida Dispenser Rental Combo' },
  { pid: 59, pex: 5589597, label: 'Panic Home Protection Bundle' },
  { pid: 60, pex: 31470430, label: 'Panic Complete Security Bundle' },
  { pid: 61, pex: 33335255, label: 'Panic Install and Maintenance Combo' },
  { pid: 62, pex: 264636, label: 'Queen Pearl Kitchen Starter Bundle' },
  { pid: 63, pex: 8490099, label: 'Queen Pearl Family Cooking Bundle' },
  { pid: 64, pex: 5737579, label: 'Queen Pearl Bulk Value Combo' },
  { pid: 65, pex: 7259831, label: 'All Terrain New Wheel Bundle' },
  { pid: 66, pex: 21694, label: 'All Terrain Complete Tire Bundle', url: 'https://images.pexels.com/photos/21694/pexels-photo.jpg?auto=compress&cs=tinysrgb&w=800' },
  { pid: 67, pex: 33395582, label: 'All Terrain Service Combo' },
  { pid: 68, pex: 6195277, label: 'All Asia Home Shield Bundle' },
  { pid: 69, pex: 4099091, label: 'All Asia Total Care Bundle' },
  { pid: 70, pex: 4098786, label: 'All Asia Termite and Disinfection Combo' },
  { pid: 71, pex: 7755680, label: 'Beauty Republic Glow Starter Bundle' },
  { pid: 72, pex: 7447130, label: 'Beauty Republic Pamper Bundle' },
  { pid: 73, pex: 5619449, label: 'Beauty Republic Spa and Nails Combo' },
  { pid: 74, pex: 60616, label: 'Savor House Barkada Bundle', url: 'https://images.pexels.com/photos/60616/fried-chicken-chicken-fried-crunchy-60616.jpeg?auto=compress&cs=tinysrgb&w=800' },
  { pid: 75, pex: 25440677, label: 'Savor House Fiesta Bundle' },
  { pid: 76, pex: 30355484, label: 'Savor House Sisig and Bilao Combo' },
  { pid: 77, pex: 10490621, label: 'Prime Autocare Fresh Drive Bundle' },
  { pid: 78, pex: 6873119, label: 'Prime Autocare Total Care Bundle' },
  { pid: 79, pex: 6870319, label: 'Prime Autocare Wash and Brakes Combo' },
  { pid: 80, pex: 36718705, label: 'Homeline Dining Starter Bundle' },
  { pid: 81, pex: 15602699, label: 'Homeline Home Complete Bundle' },
  { pid: 82, pex: 8199670, label: 'Homeline Table and Repair Combo' },
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
  if (DRY_RUN) console.log('DRY RUN - validating Pexels URLs, no uploads.\n');
  let done = 0, skipped = 0;
  for (const item of PLAN) {
    const url = item.url || cdn(item.pex);
    console.log('========================================');
    console.log(`Product ${item.pid} | ${item.label} | pexels ${item.pex}`);
    console.log(`  src: ${url}`);
    try {
      const cur = await apiJson('GET', `/products/${item.pid}?depth=0`);
      if (cur?.productType !== 'grouped') {
        console.error(`  !! Product ${item.pid} is type ${cur?.productType}, expected grouped. Skipping.`);
        skipped++;
        continue;
      }
      const existing = cur?.media?.primaryImage;
      if (existing) {
        console.log(`  -> Already has primaryImage ${typeof existing === 'object' ? existing.id : existing}. Skipping.`);
        skipped++;
        continue;
      }
    } catch (e) { console.error(`  !! read failed: ${e.message}`); }
    try {
      const { buf, ct } = await downloadImage(url);
      console.log(`  -> Downloaded ${buf.length} bytes (${ct}).`);
      if (DRY_RUN) { console.log('  [dry-run] URL valid. Would upload+patch.'); continue; }
      const filename = `product-grouped-${item.pid}-${slugify(item.label)}-${item.pex}.jpg`;
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
