/**
 * Give outlet addresses to merchants that lack one (6-9), so they become
 * location-ready (activeAddress -> lat/lng -> merchant_coordinates).
 *
 * NOTE: these businesses have no real-world OSM entries, so the script
 * assigns spread-out DEMO locations across Metro Manila. Replace with the
 * real outlet addresses (Payload admin -> Merchants -> activeAddress).
 *
 * Idempotent: merchants that already have an activeAddress are skipped.
 * Usage: node scripts/seed-merchant-outlet-addresses-sql.cjs
 */
const path = require('path');
const dotenv = require('dotenv');
dotenv.config({ path: path.resolve(__dirname, '../.env') });
const { Client } = require('pg');

const PLAN = [
  {
    merchantId: 6, vendorUserId: 10,
    formatted: 'Poblacion, Makati City, Metro Manila, Philippines',
    locality: 'Makati', lat: 14.5547, lng: 121.0244,
  },
  {
    merchantId: 7, vendorUserId: 11,
    formatted: 'Ortigas Center, Pasig City, Metro Manila, Philippines',
    locality: 'Pasig', lat: 14.5853, lng: 121.0612,
  },
  {
    merchantId: 8, vendorUserId: 12,
    formatted: 'Bonifacio Global City, Taguig City, Metro Manila, Philippines',
    locality: 'Taguig', lat: 14.5507, lng: 121.0469,
  },
  {
    merchantId: 9, vendorUserId: 13,
    formatted: 'Cubao, Quezon City, Metro Manila, Philippines',
    locality: 'Quezon City', lat: 14.6215, lng: 121.0539,
  },
];

(async () => {
  const client = new Client({ connectionString: process.env.DATABASE_URI });
  await client.connect();

  for (const p of PLAN) {
    const m = await client.query('SELECT id, outlet_name, active_address_id FROM merchants WHERE id=$1', [p.merchantId]);
    if (m.rows.length === 0) {
      console.log(`Merchant ${p.merchantId} MISSING — skipped`);
      continue;
    }
    if (m.rows[0].active_address_id != null) {
      console.log(`Merchant ${p.merchantId} (${m.rows[0].outlet_name}) already has address ${m.rows[0].active_address_id} — skipped`);
      continue;
    }
    const a = await client.query(
      `INSERT INTO addresses (user_id, formatted_address, locality, administrative_area_level_1,
          country, latitude, longitude, coordinates, address_type, notes, created_at, updated_at)
       VALUES ($1,$2,$3,'Metro Manila','Philippines',$4,$5,$6,'home','DEMO outlet location — replace with real address',now(),now())
       RETURNING id`,
      [
        p.vendorUserId, p.formatted, p.locality, p.lat, p.lng,
        JSON.stringify({ type: 'Point', coordinates: [p.lng, p.lat] }),
      ],
    );
    const addressId = a.rows[0].id;
    await client.query(
      `UPDATE merchants SET active_address_id=$1, merchant_latitude=$2, merchant_longitude=$3,
         merchant_coordinates=$4, updated_at=now() WHERE id=$5`,
      [addressId, p.lat, p.lng, JSON.stringify({ type: 'Point', coordinates: [p.lng, p.lat] }), p.merchantId],
    );
    console.log(`Merchant ${p.merchantId} (${m.rows[0].outlet_name}) -> address ${addressId} @ ${p.lat},${p.lng}`);
  }

  await client.end();
  console.log('Done. Re-run check-merchant-locations.cjs to confirm 9/9.');
})().catch((e) => {
  console.error(`FAILED: ${e.message.split('\n')[0]}`);
  process.exit(1);
});
