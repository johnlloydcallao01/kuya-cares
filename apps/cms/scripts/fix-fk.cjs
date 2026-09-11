const { Pool } = require('pg')
require('dotenv').config()

async function exec(db, sql) {
  console.log(sql.replace(/\s+/g, ' ').trim())
  await db.query(sql)
}

async function run() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URI })
  const client = await pool.connect()
  try {
    await client.query('BEGIN')

    await exec(client, `ALTER TABLE "merchant_products" DROP CONSTRAINT IF EXISTS "merchant_products_product_id_id_products_id_fk"`)
    await exec(client, `ALTER TABLE "merchant_products" ADD CONSTRAINT "merchant_products_product_id_id_products_id_fk" FOREIGN KEY ("product_id_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE NO ACTION`)

    await exec(client, `ALTER TABLE "merchant_products" DROP CONSTRAINT IF EXISTS "merchant_products_merchant_id_id_merchants_id_fk"`)
    await exec(client, `ALTER TABLE "merchant_products" ADD CONSTRAINT "merchant_products_merchant_id_id_merchants_id_fk" FOREIGN KEY ("merchant_id_id") REFERENCES "merchants"("id") ON DELETE CASCADE ON UPDATE NO ACTION`)

    await exec(client, `ALTER TABLE "modifier_groups" DROP CONSTRAINT IF EXISTS "modifier_groups_product_id_id_products_id_fk"`)
    await exec(client, `ALTER TABLE "modifier_groups" ADD CONSTRAINT "modifier_groups_product_id_id_products_id_fk" FOREIGN KEY ("product_id_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE NO ACTION`)

    await exec(client, `ALTER TABLE "modifier_options" DROP CONSTRAINT IF EXISTS "modifier_options_modifier_group_id_id_modifier_groups_id_fk"`)
    await exec(client, `ALTER TABLE "modifier_options" ADD CONSTRAINT "modifier_options_modifier_group_id_id_modifier_groups_id_fk" FOREIGN KEY ("modifier_group_id_id") REFERENCES "modifier_groups"("id") ON DELETE CASCADE ON UPDATE NO ACTION`)

    await exec(client, `ALTER TABLE "prod_grouped_items" DROP CONSTRAINT IF EXISTS "prod_grouped_items_parent_product_id_id_products_id_fk"`)
    await exec(client, `ALTER TABLE "prod_grouped_items" ADD CONSTRAINT "prod_grouped_items_parent_product_id_id_products_id_fk" FOREIGN KEY ("parent_product_id_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE NO ACTION`)

    await exec(client, `ALTER TABLE "prod_grouped_items" DROP CONSTRAINT IF EXISTS "prod_grouped_items_child_product_id_id_products_id_fk"`)
    await exec(client, `ALTER TABLE "prod_grouped_items" ADD CONSTRAINT "prod_grouped_items_child_product_id_id_products_id_fk" FOREIGN KEY ("child_product_id_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE NO ACTION`)

    await exec(client, `ALTER TABLE "prod_variations" DROP CONSTRAINT IF EXISTS "prod_variations_product_id_id_products_id_fk"`)
    await exec(client, `ALTER TABLE "prod_variations" ADD CONSTRAINT "prod_variations_product_id_id_products_id_fk" FOREIGN KEY ("product_id_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE NO ACTION`)

    await exec(client, `ALTER TABLE "prod_variation_values" DROP CONSTRAINT IF EXISTS "prod_variation_values_variation_product_id_id_products_id_fk"`)
    await exec(client, `ALTER TABLE "prod_variation_values" ADD CONSTRAINT "prod_variation_values_variation_product_id_id_products_id_fk" FOREIGN KEY ("variation_product_id_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE NO ACTION`)

    await client.query('COMMIT')
    console.log('✅ FK constraints updated to CASCADE successfully')
  } catch (e) {
    await client.query('ROLLBACK')
    console.error('❌ Failed to update FK constraints:', e)
    process.exit(1)
  } finally {
    client.release()
    await pool.end()
  }
}

run()

