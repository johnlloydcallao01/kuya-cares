import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE prod_variation_values
    ADD COLUMN IF NOT EXISTS variation_id INTEGER;
  `)

  await db.execute(sql`
    DO $$ BEGIN
      ALTER TABLE prod_variation_values
      ADD CONSTRAINT prod_variation_values_variation_id_prod_variations_id_fk
      FOREIGN KEY (variation_id) REFERENCES prod_variations(id) ON DELETE CASCADE;
    EXCEPTION
      WHEN duplicate_object THEN NULL;
    END $$;
  `)

  await db.execute(sql`
    DO $$ BEGIN
      ALTER TABLE prod_variation_values
      DROP CONSTRAINT IF EXISTS prod_variation_values_unique;
    EXCEPTION
      WHEN undefined_object THEN NULL;
    END $$;
  `)

  await db.execute(sql`
    DO $$ BEGIN
      ALTER TABLE prod_variation_values
      DROP CONSTRAINT IF EXISTS prod_variation_values_variation_product_id_id_products_id_fk;
    EXCEPTION
      WHEN undefined_object THEN NULL;
    END $$;
  `)

  await db.execute(sql`
    ALTER TABLE prod_variation_values
    DROP COLUMN IF EXISTS variation_product_id_id;
  `)

  await db.execute(sql`
    DO $$ BEGIN
      ALTER TABLE prod_variation_values
      ADD CONSTRAINT prod_variation_values_unique UNIQUE (variation_id, term_id_id);
    EXCEPTION
      WHEN duplicate_object THEN NULL;
    END $$;
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE prod_variation_values
    ADD COLUMN IF NOT EXISTS variation_product_id_id INTEGER;
  `)

  await db.execute(sql`
    DO $$ BEGIN
      ALTER TABLE prod_variation_values
      ADD CONSTRAINT prod_variation_values_variation_product_id_id_products_id_fk
      FOREIGN KEY (variation_product_id_id) REFERENCES products(id) ON DELETE CASCADE ON UPDATE NO ACTION;
    EXCEPTION
      WHEN duplicate_object THEN NULL;
    END $$;
  `)

  await db.execute(sql`
    DO $$ BEGIN
      ALTER TABLE prod_variation_values
      DROP CONSTRAINT IF EXISTS prod_variation_values_unique;
    EXCEPTION
      WHEN undefined_object THEN NULL;
    END $$;
  `)

  await db.execute(sql`
    DO $$ BEGIN
      ALTER TABLE prod_variation_values
      ADD CONSTRAINT prod_variation_values_unique UNIQUE (variation_product_id_id, attribute_id_id);
    EXCEPTION
      WHEN duplicate_object THEN NULL;
    END $$;
  `)
}
