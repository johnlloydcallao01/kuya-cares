import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    CREATE OR REPLACE FUNCTION set_products_sku() RETURNS trigger AS $$
    BEGIN
      NEW.sku := upper(coalesce(NEW.slug, '') || '-' || NEW.id);
      RETURN NEW;
    END; $$ LANGUAGE plpgsql;
  `)

  await db.execute(sql`
    UPDATE "products"
    SET "sku" = upper("slug" || '-' || "id");
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    CREATE OR REPLACE FUNCTION set_products_sku() RETURNS trigger AS $$
    BEGIN
      NEW.sku := coalesce(NEW.slug, '') || '-' || NEW.id;
      RETURN NEW;
    END; $$ LANGUAGE plpgsql;
  `)
}

