import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  // 1. Add display_title column
  await db.execute(sql`
    ALTER TABLE "merchant_products" ADD COLUMN IF NOT EXISTS "display_title" varchar;
  `)

  // 2. Backfill display_title
  // We join with products and merchants to construct the title
  // Note: relationship columns are likely named field_name_id.
  // In MerchantProducts, fields are merchant_id and product_id, so columns are merchant_id_id and product_id_id.
  await db.execute(sql`
    UPDATE "merchant_products" mp
    SET "display_title" = p.name || ' (' || m.outlet_name || ')'
    FROM "products" p, "merchants" m
    WHERE mp.product_id_id = p.id AND mp.merchant_id_id = m.id;
  `)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "merchant_products" DROP COLUMN IF EXISTS "display_title";
  `)
}
