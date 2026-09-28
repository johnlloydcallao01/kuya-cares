/**
 * Attach icon images to the 9 product-categories.
 *
 * Same pipeline as attach-primary-images.cjs:
 * - product-categories.media.icon is upload->media (NOT a URL string)
 * - download Pexels CDN bytes -> multipart POST /api/media {file, alt}
 * - attach = PATCH /api/product-categories/:id { media: { icon: mediaId } }
 * - Pexels direct CDN images.pexels.com (page URLs are HTML and won't work)
 * - Filenames must be unique (adapter unique_filename:false, overwrite:false)
 *
 * Usage (local CMS):
 *   $env:PAYLOAD_API_URL='http://localhost:3001/api'; $env:PAYLOAD_API_KEY='<key>'; node scripts/attach-product-category-icons.cjs --dry-run
 *   $env:PAYLOAD_API_URL='http://localhost:3001/api'; $env:PAYLOAD_API_KEY='<key>'; node scripts/attach-product-category-icons.cjs
 */
const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const API_URL = process.env.PAYLOAD_API_URL || 'https://cms.kuyacares.com/api';
const API_KEY = process.env.PAYLOAD_API_KEY;
const DRY_RUN = process.argv.includes('--dry-run');

// slug -> verified Pexels CDN url (w=800) + label
const PLAN = [
  { slug: 'water-refilling',    label: 'Water & Refilling',              url: 'https://images.pexels.com/photos/15524063/pexels-photo-15524063.jpeg?auto=compress&cs=tinysrgb&w=800' },
  { slug: 'food-meals',         label: 'Food & Meals',                   url: 'https://images.pexels.com/photos/60616/fried-chicken-chicken-fried-crunchy-60616.jpeg?auto=compress&cs=tinysrgb&w=800' },
  { slug: 'groceries-cooking',  label: 'Groceries & Cooking Essentials', url: 'https://images.pexels.com/photos/264636/pexels-photo-264636.jpeg?auto=compress&cs=tinysrgb&w=800' },
  { slug: 'beauty-wellness',    label: 'Beauty & Wellness',              url: 'https://images.pexels.com/photos/7755680/pexels-photo-7755680.jpeg?auto=compress&cs=tinysrgb&w=800' },
  { slug: 'automotive',         label: 'Automotive',                     url: 'https://images.pexels.com/photos/21694/pexels-photo.jpg?auto=compress&cs=tinysrgb&w=800' },
  { slug: 'home-furniture',     label: 'Home & Furniture',               url: 'https://images.pexels.com/photos/36718705/pexels-photo-36718705.jpeg?auto=compress&cs=tinysrgb&w=800' },
  { slug: 'home-services',      label: 'Home Services',                  url: 'https://images.pexels.com/photos/6195277/pexels-photo-6195277.jpeg?auto=compress&cs=tinysrgb&w=800' },
  { slug: 'security-safety',    label: 'Security & Safety',              url: 'https://images.pexels.com/photos/5589597/pexels-photo-5589597.jpeg?auto=compress&cs=tinysrgb&w=800' },
  { slug: 'services',           label: 'Services',                       url: 'https://images.pexels.com/photos/32588548/pexels-photo-32588548.jpeg?auto=compress&cs=tinysrgb&w=800' },
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

async function main() {
  if (!API_KEY) { console.error('PAYLOAD_API_KEY missing'); process.exit(1); }
  console.log(`API: ${API_URL}`);
  if (DRY_RUN) console.log('DRY RUN - no uploads.\n');
  let done = 0, skipped = 0;
  for (const item of PLAN) {
    console.log('========================================');
    console.log(`Category '${item.slug}' | ${item.label}`);
    console.log(`  src: ${item.url}`);
    let catId = null;
    try {
      const found = await apiJson('GET', `/product-categories?where[slug][equals]=${item.slug}&limit=1&depth=1`);
      const doc = found?.docs?.[0];
      if (!doc) { console.error('  !! category not found, skipping.'); continue; }
      catId = doc.id;
      const existing = doc?.media?.icon;
      if (existing) {
        console.log(`  -> Already has icon ${typeof existing === 'object' ? existing.id : existing}. Skipping.`);
        skipped++;
        continue;
      }
    } catch (e) { console.error(`  !! read failed: ${e.message}`); }
    if (DRY_RUN) { console.log('  [dry-run] Would download+upload+patch.'); continue; }
    try {
      const { buf, ct } = await downloadImage(item.url);
      console.log(`  -> Downloaded ${buf.length} bytes (${ct}).`);
      const filename = `product-category-${item.slug}.jpg`;
      const media = await uploadMedia(buf, filename, ct, `${item.label} category icon`);
      console.log(`  -> Media id ${media.id} cloudinary: ${media.cloudinaryURL || media.url || ''}`);
      await apiJson('PATCH', `/product-categories/${catId}`, { media: { icon: media.id } });
      console.log(`  -> Patched category ${catId} icon=${media.id}.`);
      done++;
    } catch (e) { console.error(`  !! FAILED: ${e.message}`); }
  }
  console.log(`\nDone. Attached ${done}, skipped ${skipped}.`);
}

main().catch((e) => { console.error('Fatal:', e); process.exit(1); });
