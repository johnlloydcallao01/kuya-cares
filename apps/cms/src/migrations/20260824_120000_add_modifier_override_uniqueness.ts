import { MigrateDownArgs, MigrateUpArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    DO $$
    DECLARE
      variation_column text;
      base_group_column text;
      base_option_column text;
      merchant_product_column text;
      merchant_variation_column text;
      variation_group_column text;
      variation_option_column text;
      duplicate_exists boolean;
    BEGIN
      SELECT CASE
        WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'variation_modifier_group_overrides' AND column_name = 'variation_id') THEN 'variation_id'
        ELSE 'variation_id_id'
      END INTO variation_column;

      SELECT CASE
        WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'variation_modifier_group_overrides' AND column_name = 'base_modifier_group_id') THEN 'base_modifier_group_id'
        ELSE 'base_modifier_group_id_id'
      END INTO base_group_column;

      SELECT CASE
        WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'variation_modifier_option_overrides' AND column_name = 'base_modifier_option_id') THEN 'base_modifier_option_id'
        ELSE 'base_modifier_option_id_id'
      END INTO base_option_column;

      SELECT CASE
        WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'merchant_product_modifier_group_overrides' AND column_name = 'merchant_product_id') THEN 'merchant_product_id'
        ELSE 'merchant_product_id_id'
      END INTO merchant_product_column;

      SELECT CASE
        WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'merchant_variation_modifier_group_overrides' AND column_name = 'variation_id') THEN 'variation_id'
        ELSE 'variation_id_id'
      END INTO merchant_variation_column;

      SELECT CASE
        WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'merchant_variation_modifier_group_overrides' AND column_name = 'variation_modifier_group_id') THEN 'variation_modifier_group_id'
        ELSE 'variation_modifier_group_id_id'
      END INTO variation_group_column;

      SELECT CASE
        WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'merchant_variation_modifier_option_overrides' AND column_name = 'variation_modifier_option_id') THEN 'variation_modifier_option_id'
        ELSE 'variation_modifier_option_id_id'
      END INTO variation_option_column;

      EXECUTE format('SELECT EXISTS (SELECT 1 FROM "variation_modifier_group_overrides" GROUP BY %I, %I HAVING COUNT(*) > 1)', variation_column, base_group_column) INTO duplicate_exists;
      IF duplicate_exists THEN
        RAISE EXCEPTION 'Cannot add variation modifier group unique index: duplicate override records exist';
      END IF;

      EXECUTE format('SELECT EXISTS (SELECT 1 FROM "variation_modifier_option_overrides" GROUP BY %I, %I HAVING COUNT(*) > 1)', variation_column, base_option_column) INTO duplicate_exists;
      IF duplicate_exists THEN
        RAISE EXCEPTION 'Cannot add variation modifier option unique index: duplicate override records exist';
      END IF;

      EXECUTE format('SELECT EXISTS (SELECT 1 FROM "merchant_product_modifier_group_overrides" GROUP BY %I, %I HAVING COUNT(*) > 1)', merchant_product_column, base_group_column) INTO duplicate_exists;
      IF duplicate_exists THEN
        RAISE EXCEPTION 'Cannot add merchant product modifier group unique index: duplicate override records exist';
      END IF;

      EXECUTE format('SELECT EXISTS (SELECT 1 FROM "merchant_product_modifier_option_overrides" GROUP BY %I, %I HAVING COUNT(*) > 1)', merchant_product_column, base_option_column) INTO duplicate_exists;
      IF duplicate_exists THEN
        RAISE EXCEPTION 'Cannot add merchant product modifier option unique index: duplicate override records exist';
      END IF;

      EXECUTE format('SELECT EXISTS (SELECT 1 FROM "merchant_variation_modifier_group_overrides" GROUP BY %I, %I, %I HAVING COUNT(*) > 1)', merchant_product_column, merchant_variation_column, base_group_column) INTO duplicate_exists;
      IF duplicate_exists THEN
        RAISE EXCEPTION 'Cannot add merchant variation base group unique index: duplicate override records exist';
      END IF;

      EXECUTE format('SELECT EXISTS (SELECT 1 FROM "merchant_variation_modifier_group_overrides" GROUP BY %I, %I, %I HAVING COUNT(*) > 1)', merchant_product_column, merchant_variation_column, variation_group_column) INTO duplicate_exists;
      IF duplicate_exists THEN
        RAISE EXCEPTION 'Cannot add merchant variation added group unique index: duplicate override records exist';
      END IF;

      EXECUTE format('SELECT EXISTS (SELECT 1 FROM "merchant_variation_modifier_option_overrides" GROUP BY %I, %I, %I HAVING COUNT(*) > 1)', merchant_product_column, merchant_variation_column, base_option_column) INTO duplicate_exists;
      IF duplicate_exists THEN
        RAISE EXCEPTION 'Cannot add merchant variation base option unique index: duplicate override records exist';
      END IF;

      EXECUTE format('SELECT EXISTS (SELECT 1 FROM "merchant_variation_modifier_option_overrides" GROUP BY %I, %I, %I HAVING COUNT(*) > 1)', merchant_product_column, merchant_variation_column, variation_option_column) INTO duplicate_exists;
      IF duplicate_exists THEN
        RAISE EXCEPTION 'Cannot add merchant variation added option unique index: duplicate override records exist';
      END IF;

      EXECUTE format('CREATE UNIQUE INDEX "variation_modifier_group_overrides_unique_target_idx" ON "variation_modifier_group_overrides" USING btree (%I, %I)', variation_column, base_group_column);

      EXECUTE format('CREATE UNIQUE INDEX "variation_modifier_option_overrides_unique_target_idx" ON "variation_modifier_option_overrides" USING btree (%I, %I)', variation_column, base_option_column);

      EXECUTE format('CREATE UNIQUE INDEX "merchant_product_modifier_group_overrides_unique_target_idx" ON "merchant_product_modifier_group_overrides" USING btree (%I, %I)', merchant_product_column, base_group_column);

      EXECUTE format('CREATE UNIQUE INDEX "merchant_product_modifier_option_overrides_unique_target_idx" ON "merchant_product_modifier_option_overrides" USING btree (%I, %I)', merchant_product_column, base_option_column);

      EXECUTE format('CREATE UNIQUE INDEX "merchant_variation_modifier_group_overrides_unique_base_target_idx" ON "merchant_variation_modifier_group_overrides" USING btree (%I, %I, %I)', merchant_product_column, merchant_variation_column, base_group_column);

      EXECUTE format('CREATE UNIQUE INDEX "merchant_variation_modifier_group_overrides_unique_added_target_idx" ON "merchant_variation_modifier_group_overrides" USING btree (%I, %I, %I)', merchant_product_column, merchant_variation_column, variation_group_column);

      EXECUTE format('CREATE UNIQUE INDEX "merchant_variation_modifier_option_overrides_unique_base_target_idx" ON "merchant_variation_modifier_option_overrides" USING btree (%I, %I, %I)', merchant_product_column, merchant_variation_column, base_option_column);

      EXECUTE format('CREATE UNIQUE INDEX "merchant_variation_modifier_option_overrides_unique_added_target_idx" ON "merchant_variation_modifier_option_overrides" USING btree (%I, %I, %I)', merchant_product_column, merchant_variation_column, variation_option_column);
    END $$;
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    DROP INDEX IF EXISTS "merchant_variation_modifier_option_overrides_unique_added_target_idx";
    DROP INDEX IF EXISTS "merchant_variation_modifier_option_overrides_unique_base_target_idx";
    DROP INDEX IF EXISTS "merchant_variation_modifier_group_overrides_unique_added_target_idx";
    DROP INDEX IF EXISTS "merchant_variation_modifier_group_overrides_unique_base_target_idx";
    DROP INDEX IF EXISTS "merchant_product_modifier_option_overrides_unique_target_idx";
    DROP INDEX IF EXISTS "merchant_product_modifier_group_overrides_unique_target_idx";
    DROP INDEX IF EXISTS "variation_modifier_option_overrides_unique_target_idx";
    DROP INDEX IF EXISTS "variation_modifier_group_overrides_unique_target_idx";
  `)
}
