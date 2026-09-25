/**
 * Attach primary images to VARIABLE products 28-54 (1 per parent).
 * Reuses pipeline from attach-primary-images.cjs:
 *  download images.pexels.com -> POST /api/media multipart -> PATCH /api/products/:id {media:{primaryImage}}
 * Filenames prefixed product-var- to avoid colliding with simple batch.
 */
const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const API_URL = process.env.PAYLOAD_API_URL || 'https://cms.kuyacares.com/api';
const API_KEY = process.env.PAYLOAD_API_KEY;
const DRY_RUN = process.argv.includes('--dry-run');

const cdn = (id) => `https://images.pexels.com/photos/${id}/pexels-photo-${id}.jpeg?auto=compress&cs=tinysrgb&w=800`;

const PLAN = [
  { pid: 28, pex: 20571710, label: 'Purified Water Order Variable' },
  { pid: 29, pex: 6407529, label: 'Dispenser Plan Variable' },
  { pid: 30, pex: 15524063, label: 'Delivery Size Variable' },
  { pid: 31, pex: 31470430, label: 'Panic Alarm Kit Variable' },
  { pid: 32, pex: 33335255, label: 'Installation Package Variable' },
  { pid: 33, pex: 31470430, label: 'Maintenance Plan Variable' },
  { pid: 34, pex: 5737246, label: 'Palm Cooking Oil Variable' },
  { pid: 35, pex: 5737579, label: 'Veg Oil Pack Variable' },
  { pid: 36, pex: 4910221, label: 'Bulk Pack Variable' },
  { pid: 37, pex: 17600886, label: 'AT Tire Variable' },
  { pid: 38, pex: 32208774, label: 'Tire Service Variable' },
  { pid: 39, pex: 13746768, label: 'Wheel Kit Variable' },
  { pid: 40, pex: 4099091, label: 'Pest Visit Variable' },
  { pid: 41, pex: 4099264, label: 'Termite Job Variable' },
  { pid: 42, pex: 9462206, label: 'Disinfection Variable' },
  { pid: 43, pex: 7518742, label: 'Haircut Variable' },
  { pid: 44, pex: 6560304, label: 'Massage Variable' },
  { pid: 45, pex: 14267564, label: 'Nails Variable' },
  { pid: 46, pex: 34628053, label: 'Fried Chicken Variable' },
  { pid: 47, pex: 30355484, label: 'Sisig Variable' },
  { pid: 48, pex: 35838671, label: 'Pancit Bilao Variable' },
  { pid: 49, pex: 10490621, label: 'Change Oil Variable' },
  { pid: 50, pex: 6873119, label: 'Wash Variable' },
  { pid: 51, pex: 6870319, label: 'Brakes Variable' },
  { pid: 52, pex: 29222397, label: 'Dining Chair Variable' },
  { pid: 53, pex: 19733502, label: 'Center Table Variable' },
  { pid: 54, pex: 9598174, label: 'Repair Call Variable' },
];

async function apiJson(method, endpoint, body) {
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

async function downloadImage(url) {
  const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)', Referer: 'https://www.pexels.com/', Accept: 'image/*' } });
  if (!res.ok) throw new Error(`download ${res.status}`);
  const ct = res.headers.get('content-type') || '';
  if (!ct.startsWith('image/')) throw new Error(`not image (${ct})`);
  return { buf: Buffer.from(await res.arrayBuffer()), ct };
}

async function uploadMedia(buf, filename, mime, alt) {
  const blob = new Blob([buf], { type: mime.split(';')[0] || 'image/jpeg' });
  const fd = new FormData();
  fd.append('file', blob, filename);
  fd.append('alt', alt);
  const res = await fetch(`${API_URL}/media`, { method: 'POST', headers: { Authorization: `users API-Key ${API_KEY}` }, body: fd });
  const text = await res.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = null; }
  if (!res.ok) throw new Error(`POST /media -> ${res.status}: ${text.slice(0, 400)}`);
  return data?.doc;
}

function slugify(s) { return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, ''); }

async function main() {
  if (!API_KEY) { console.error('PAYLOAD_API_KEY missing'); process.exit(1); }
  if (DRY_RUN) console.log('DRY RUN - no uploads.\n');
  let done = 0, skipped = 0;
  for (const item of PLAN) {
    console.log(`Product ${item.pid} | ${item.label} | pexels ${item.pex}`);
    try {
      const cur = await apiJson('GET', `/products/${item.pid}?depth=0`);
      if (cur?.media?.primaryImage) { console.log(`  skip, has ${typeof cur.media.primaryImage === 'object' ? cur.media.primaryImage.id : cur.media.primaryImage}`); skipped++; continue; }
    } catch (e) { console.error(`  read failed: ${e.message}`); }
    if (DRY_RUN) { console.log('  [dry-run] would upload+patch'); continue; }
    try {
      const { buf, ct } = await downloadImage(cdn(item.pex));
      console.log(`  downloaded ${buf.length} (${ct})`);
      const filename = `product-var-${item.pid}-${slugify(item.label)}-${item.pex}.jpg`;
      const doc = await uploadMedia(buf, filename, ct, item.label);
      console.log(`  media ${doc.id} ${doc.cloudinaryURL || doc.url || ''}`);
      await apiJson('PATCH', `/products/${item.pid}`, { media: { primaryImage: doc.id } });
      console.log(`  patched product ${item.pid}`);
      done++;
    } catch (e) { console.error(`  FAILED: ${e.message}`); }
  }
  console.log(`\nDone. Attached ${done}, skipped ${skipped}.`);
}

main().catch((e) => { console.error('Fatal:', e); process.exit(1); });
