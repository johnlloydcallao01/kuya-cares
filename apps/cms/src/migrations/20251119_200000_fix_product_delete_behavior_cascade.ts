import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    DO $$ BEGIN
      ALTER TABLE "prod_variations" DROP CONSTRAINT IF EXISTS "prod_variations_product_id_id_products_id_fk";
    EXCEPTION
      WHEN undefined_object THEN NULL;
    END $$;

    ALTER TABLE "prod_variations"
      ADD CONSTRAINT "prod_variations_product_id_id_products_id_fk"
      FOREIGN KEY ("product_id_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

    DO $$ BEGIN
      ALTER TABLE "prod_variation_values" DROP CONSTRAINT IF EXISTS "prod_variation_values_variation_product_id_id_products_id_fk";
    EXCEPTION
      WHEN undefined_object THEN NULL;
    END $$;

    ALTER TABLE "prod_variation_values"
      ADD CONSTRAINT "prod_variation_values_variation_product_id_id_products_id_fk"
      FOREIGN KEY ("variation_product_id_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

    DO $$ BEGIN
      ALTER TABLE "modifier_options" DROP CONSTRAINT IF EXISTS "modifier_options_modifier_group_id_id_modifier_groups_id_fk";
    EXCEPTION
      WHEN undefined_object THEN NULL;
    END $$;

    ALTER TABLE "modifier_options"
      ADD CONSTRAINT "modifier_options_modifier_group_id_id_modifier_groups_id_fk"
      FOREIGN KEY ("modifier_group_id_id") REFERENCES "modifier_groups"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    DO $$ BEGIN
      ALTER TABLE "prod_variations" DROP CONSTRAINT IF EXISTS "prod_variations_product_id_id_products_id_fk";
    EXCEPTION
      WHEN undefined_object THEN NULL;
    END $$;

    ALTER TABLE "prod_variations"
      ADD CONSTRAINT "prod_variations_product_id_id_products_id_fk"
      FOREIGN KEY ("product_id_id") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

    DO $$ BEGIN
      ALTER TABLE "prod_variation_values" DROP CONSTRAINT IF EXISTS "prod_variation_values_variation_product_id_id_products_id_fk";
    EXCEPTION
      WHEN undefined_object THEN NULL;
    END $$;

    ALTER TABLE "prod_variation_values"
      ADD CONSTRAINT "prod_variation_values_variation_product_id_id_products_id_fk"
      FOREIGN KEY ("variation_product_id_id") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

    DO $$ BEGIN
      ALTER TABLE "modifier_options" DROP CONSTRAINT IF EXISTS "modifier_options_modifier_group_id_id_modifier_groups_id_fk";
    EXCEPTION
      WHEN undefined_object THEN NULL;
    END $$;

    ALTER TABLE "modifier_options"
      ADD CONSTRAINT "modifier_options_modifier_group_id_id_modifier_groups_id_fk"
      FOREIGN KEY ("modifier_group_id_id") REFERENCES "modifier_groups"("id") ON DELETE SET NULL ON UPDATE NO ACTION;
  `)
}

