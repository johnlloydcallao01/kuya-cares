/**
 * Audit: do merchants have the location data required for location-based display?
 *
 * Checks per merchant: isActive/isAcceptingOrders, vendor active, zone active,
 * activeAddress linkage, address lat/lng, merchant_coordinates GeoJSON validity,
 * delivery_radius_meters. Then live-tests the CMS endpoint at 2 sample points.
 *
 * Usage: node scripts/check-merchant-locations.cjs
 */
const path = require('path');
const dotenv = require('dotenv');
dotenv.config({ path: path.resolve(__dirname, '../.env') });
const { Client } = require('pg');

const API_URL = (process.env.PAYLOAD_API_URL || 'https://cms.kuyacares.com/api').replace(/\/+$/, '');
const API_KEY = process.env.PAYLOAD_API_KEY;
const LOCAL_API = 'http://localhost:3001/api';

function validPoint(coords) {
  try {
    if (!coords || typeof coords !== 'object') return { ok: false, why: 'missing' };
    if (coords.type !== 'Point') return { ok: false, why: `type=${coords.type}` };
    const c = coords.coordinates;
    if (!Array.isArray(c) || c.length !== 2) return { ok: false, why: 'bad coordinates array' };
    const [lng, lat] = c.map(Number);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return { ok: false, why: 'non-numeric' };
    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return { ok: false, why: 'out of range' };
    return { ok: true, lat, lng };
  } catch (e) {
    return { ok: false, why: 'parse error' };
  }
}

async function apiGet(base, urlPath) {
  const headers = {};
  if (API_KEY) headers['Authorization'] = `users API-Key ${API_KEY}`;
  const res = await fetch(`${base}${urlPath}`, { headers });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data };
}

(async () => {
  const client = new Client({ connectionString: process.env.DATABASE_URI });
  await client.connect();

  const r = await client.query(`
    SELECT m.id, m.outlet_name, m.is_active, m.is_accepting_orders,
           m.merchant_latitude, m.merchant_longitude, m.merchant_coordinates,
           m.delivery_radius_meters, m.active_address_id,
           v.is_active AS vendor_active, v.business_name,
           bz.is_active AS zone_active, bz.name AS zone_name,
           a.formatted_address, a.latitude AS addr_lat, a.longitude AS addr_lng
    FROM merchants m
    LEFT JOIN vendors v ON v.id = m.vendor_id
    LEFT JOIN business_zones bz ON bz.id = m.business_zone_id
    LEFT JOIN addresses a ON a.id = m.active_address_id
    ORDER BY m.id`);

  console.log(`Total merchants: ${r.rows.length}\n`);
  let ready = 0;
  for (const m of r.rows) {
    const flags = [];
    if (!m.is_active) flags.push('OUTLET_INACTIVE');
    if (!m.is_accepting_orders) flags.push('NOT_ACCEPTING');
    if (m.vendor_active === false) flags.push('VENDOR_INACTIVE');
    if (m.zone_active === false) flags.push('ZONE_INACTIVE');
    if (!m.active_address_id) flags.push('NO_ACTIVE_ADDRESS');
    if (m.addr_lat == null || m.addr_lng == null) flags.push('ADDRESS_NO_LATLNG');
    const pt = validPoint(m.merchant_coordinates);
    if (!pt.ok) flags.push(`BAD_COORDS(${pt.why})`);

    const status = flags.length === 0 ? 'READY' : 'BLOCKED';
    if (flags.length === 0) ready += 1;
    console.log(
      `#${m.id} ${m.outlet_name || '(unnamed)'}\n` +
      `   outlet=${m.is_active} accepting=${m.is_accepting_orders} vendor=${m.vendor_active}(${m.business_name || '?'}) zone=${m.zone_active ?? 'none'}(${m.zone_name || '-'})\n` +
      `   activeAddress=${m.active_address_id ?? 'NONE'} addrLatLng=${m.addr_lat ?? '?'},${m.addr_lng ?? '?'} merchLatLng=${m.merchant_latitude ?? '?'},${m.merchant_longitude ?? '?'} radius=${m.delivery_radius_meters}m\n` +
      `   coords=${pt.ok ? `Point(${pt.lng},${pt.lat})` : 'INVALID'} => ${status}${flags.length ? ' [' + flags.join(', ') + ']' : ''}`,
    );
  }
  console.log(`\nLocation-ready: ${ready}/${r.rows.length}`);

  // Live endpoint test at 2 sample points (Manila + Cebu).
  const points = [
    { name: 'Manila', lat: 14.5995, lng: 120.9842 },
    { name: 'Cebu', lat: 10.3157, lng: 123.8854 },
  ];
  for (const p of points) {
    try {
      const res = await apiGet(LOCAL_API, `/merchants-in-delivery-radius?latitude=${p.lat}&longitude=${p.lng}&limit=50`);
      const docs = res.data?.docs ?? res.data?.data?.merchants ?? [];
      const names = (Array.isArray(docs) ? docs : []).map((d) => d.outletName || d.outlet_name || `#${d.id}`);
      console.log(`\nLive @ ${p.name} (HTTP ${res.status}): ${names.length} merchant(s) -> ${names.slice(0, 10).join(' | ') || '(none)'}`);
    } catch (e) {
      console.log(`\nLive @ ${p.name}: REQUEST FAILED (${e.message})`);
    }
  }

  await client.end();
})().catch((e) => {
  console.error(`FAILED: ${e.message}`);
  process.exit(1);
});
