import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE prod_variations
    ADD COLUMN IF NOT EXISTS product_attribute_combo VARCHAR(400);
  `)

  await db.execute(sql`
    UPDATE prod_variations
    SET product_attribute_combo = COALESCE(prod.name, '') || ' - ' || COALESCE(attr.name, '')
    FROM products AS prod, prod_attributes AS attr
    WHERE prod.id = prod_variations.product_id_id
      AND attr.id = prod_variations.attribute_id_id
      AND (prod_variations.product_attribute_combo IS NULL OR prod_variations.product_attribute_combo = '');
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE prod_variations
    DROP COLUMN IF EXISTS product_attribute_combo;
  `)
}

