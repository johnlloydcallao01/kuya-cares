import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  // 1) Add variation_id column (nullable first)
  await db.execute(sql`
    ALTER TABLE prod_variation_values
    ADD COLUMN IF NOT EXISTS variation_id INTEGER;
  `)

  // 2) Populate variation_id by joining parent variable product and attribute
  await db.execute(sql`
    UPDATE prod_variation_values AS pvv
    SET variation_id = pv.id
    FROM products AS child
    JOIN products AS parent ON parent.id = child.parent_product_id
    JOIN prod_variations AS pv ON pv.product_id_id = parent.id
    WHERE child.id = pvv.variation_product_id_id
      AND pv.attribute_id_id = pvv.attribute_id_id
      AND pvv.variation_id IS NULL;
  `)

  // 3) Add FK and index
  await db.execute(sql`
    DO $$ BEGIN
      ALTER TABLE prod_variation_values
      ADD CONSTRAINT prod_variation_values_variation_id_prod_variations_id_fk
      FOREIGN KEY (variation_id) REFERENCES prod_variations(id) ON DELETE CASCADE;
    EXCEPTION
      WHEN duplicate_object THEN NULL;
    END $$;
  `)

  await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_prod_variation_values_variation ON prod_variation_values(variation_id);`)

  // 4) Replace uniqueness to ensure one term per variation per SKU
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
      ADD CONSTRAINT prod_variation_values_unique UNIQUE (variation_product_id_id, variation_id);
    EXCEPTION
      WHEN duplicate_object THEN NULL;
    END $$;
  `)
  

  // 5) Make variation_id NOT NULL (after data backfill)
  await db.execute(sql`ALTER TABLE prod_variation_values ALTER COLUMN variation_id SET NOT NULL;`)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  // Revert uniqueness to attribute-based mapping
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

  // Drop FK and column
  await db.execute(sql`
    DO $$ BEGIN
      ALTER TABLE prod_variation_values
      DROP CONSTRAINT IF EXISTS prod_variation_values_variation_id_prod_variations_id_fk;
    EXCEPTION
      WHEN undefined_object THEN NULL;
    END $$;
  `)

  await db.execute(sql`
    ALTER TABLE prod_variation_values
    DROP COLUMN IF EXISTS variation_id;
  `)
}
