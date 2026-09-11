const { Pool } = require('pg')
require('dotenv').config()

async function run() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URI })
  try {
    for (const tbl of [
      'prod_variations',
      'prod_variation_values',
      'modifier_options',
      'merchant_products',
      'modifier_groups',
      'prod_grouped_items',
      'products_media_images',
      'products_rels'
    ]) {
      const res = await pool.query(
        "SELECT conname, pg_catalog.pg_get_constraintdef(c.oid, true) as condef FROM pg_constraint c WHERE c.conrelid = $1::regclass AND c.contype = 'f' ORDER BY conname",
        [tbl]
      )
      console.log('Table:', tbl)
      for (const row of res.rows) {
        console.log(row.conname + ' => ' + row.condef)
      }
    }
  } catch (e) {
    console.error(e)
    process.exit(1)
  } finally {
    await pool.end()
  }
}

run()
