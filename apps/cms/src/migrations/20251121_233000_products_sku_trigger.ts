import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    CREATE OR REPLACE FUNCTION set_products_sku() RETURNS trigger AS $$
    BEGIN
      NEW.sku := (COALESCE(NEW.slug, '')) || '-' || NEW.id;
      RETURN NEW;
    END; $$ LANGUAGE plpgsql;
  `)

  await db.execute(sql`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1
        FROM pg_trigger
        WHERE tgname = 'trg_products_set_sku_before_insert'
      ) THEN
        CREATE TRIGGER trg_products_set_sku_before_insert
        BEFORE INSERT ON products
        FOR EACH ROW EXECUTE FUNCTION set_products_sku();
      END IF;
    END $$;
  `)

  await db.execute(sql`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1
        FROM pg_trigger
        WHERE tgname = 'trg_products_set_sku_before_update'
      ) THEN
        CREATE TRIGGER trg_products_set_sku_before_update
        BEFORE UPDATE OF slug ON products
        FOR EACH ROW EXECUTE FUNCTION set_products_sku();
      END IF;
    END $$;
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`DROP TRIGGER IF EXISTS trg_products_set_sku_before_insert ON products;`)
  await db.execute(sql`DROP TRIGGER IF EXISTS trg_products_set_sku_before_update ON products;`)
  await db.execute(sql`DROP FUNCTION IF EXISTS set_products_sku;`)
}

