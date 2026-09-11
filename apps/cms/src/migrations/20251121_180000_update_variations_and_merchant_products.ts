import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "merchant_products"
    ADD COLUMN IF NOT EXISTS "stock_quantity" integer DEFAULT 0;
  `)

  await db.execute(sql`
    ALTER TABLE "prod_variations"
    ADD COLUMN IF NOT EXISTS "sku" varchar,
    ADD COLUMN IF NOT EXISTS "base_price" numeric(10, 2),
    ADD COLUMN IF NOT EXISTS "compare_at_price" numeric(10, 2),
    ADD COLUMN IF NOT EXISTS "stock_quantity" integer DEFAULT 0;
  `)

  await db.execute(sql`
    ALTER TABLE "prod_variations"
    DROP CONSTRAINT IF EXISTS "prod_variations_attribute_id_id_prod_attributes_id_fk";
  `)

  await db.execute(sql`
    ALTER TABLE "prod_variations"
    DROP CONSTRAINT IF EXISTS "prod_variations_unique";
  `)

  await db.execute(sql`
    DROP INDEX IF EXISTS "idx_prod_variations_attribute";
  `)

  await db.execute(sql`
    ALTER TABLE "prod_variations"
    DROP COLUMN IF EXISTS "attribute_id_id";
  `)

  await db.execute(sql`
    ALTER TABLE "prod_variations"
    DROP COLUMN IF EXISTS "product_attribute_combo";
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "merchant_products"
    DROP COLUMN IF EXISTS "stock_quantity";
  `)

  await db.execute(sql`
    ALTER TABLE "prod_variations"
    ADD COLUMN IF NOT EXISTS "attribute_id_id" integer;
  `)

  await db.execute(sql`
    ALTER TABLE "prod_variations"
    ADD CONSTRAINT IF NOT EXISTS "prod_variations_attribute_id_id_prod_attributes_id_fk"
      FOREIGN KEY ("attribute_id_id") REFERENCES "prod_attributes"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
  `)

  await db.execute(sql`
    ALTER TABLE "prod_variations"
    ADD CONSTRAINT IF NOT EXISTS "prod_variations_unique" UNIQUE ("product_id_id", "attribute_id_id");
  `)

  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS "idx_prod_variations_attribute" ON "prod_variations"("attribute_id_id");
  `)

  await db.execute(sql`
    ALTER TABLE "prod_variations"
    ADD COLUMN IF NOT EXISTS "product_attribute_combo" varchar(400);
  `)

  await db.execute(sql`
    ALTER TABLE "prod_variations"
    DROP COLUMN IF EXISTS "sku";
  `)

  await db.execute(sql`
    ALTER TABLE "prod_variations"
    DROP COLUMN IF EXISTS "base_price";
  `)

  await db.execute(sql`
    ALTER TABLE "prod_variations"
    DROP COLUMN IF EXISTS "compare_at_price";
  `)

  await db.execute(sql`
    ALTER TABLE "prod_variations"
    DROP COLUMN IF EXISTS "stock_quantity";
  `)
}

