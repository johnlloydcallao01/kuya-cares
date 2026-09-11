import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`ALTER TABLE products ALTER COLUMN base_price DROP NOT NULL;`)
  await db.execute(sql`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'chk_base_price_required_simple'
      ) THEN
        ALTER TABLE products
        ADD CONSTRAINT chk_base_price_required_simple
        CHECK ((product_type <> 'simple') OR (base_price IS NOT NULL));
      END IF;
    END
    $$;
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`ALTER TABLE products DROP CONSTRAINT IF EXISTS chk_base_price_required_simple;`)
  await db.execute(sql`UPDATE products SET base_price = 0 WHERE base_price IS NULL;`)
  await db.execute(sql`ALTER TABLE products ALTER COLUMN base_price SET NOT NULL;`)
}

