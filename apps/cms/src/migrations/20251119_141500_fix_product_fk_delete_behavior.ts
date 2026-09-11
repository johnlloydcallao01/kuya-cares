import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    DO $$ BEGIN
      ALTER TABLE "merchant_products" DROP CONSTRAINT IF EXISTS "merchant_products_product_id_id_products_id_fk";
    EXCEPTION
      WHEN undefined_object THEN NULL;
    END $$;

    ALTER TABLE "merchant_products"
      ADD CONSTRAINT "merchant_products_product_id_id_products_id_fk"
      FOREIGN KEY ("product_id_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

    DO $$ BEGIN
      ALTER TABLE "merchant_products" DROP CONSTRAINT IF EXISTS "merchant_products_merchant_id_id_merchants_id_fk";
    EXCEPTION
      WHEN undefined_object THEN NULL;
    END $$;

    ALTER TABLE "merchant_products"
      ADD CONSTRAINT "merchant_products_merchant_id_id_merchants_id_fk"
      FOREIGN KEY ("merchant_id_id") REFERENCES "merchants"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

    DO $$ BEGIN
      ALTER TABLE "modifier_groups" DROP CONSTRAINT IF EXISTS "modifier_groups_product_id_id_products_id_fk";
    EXCEPTION
      WHEN undefined_object THEN NULL;
    END $$;

    ALTER TABLE "modifier_groups"
      ADD CONSTRAINT "modifier_groups_product_id_id_products_id_fk"
      FOREIGN KEY ("product_id_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

    DO $$ BEGIN
      ALTER TABLE "prod_grouped_items" DROP CONSTRAINT IF EXISTS "prod_grouped_items_parent_product_id_id_products_id_fk";
    EXCEPTION
      WHEN undefined_object THEN NULL;
    END $$;

    ALTER TABLE "prod_grouped_items"
      ADD CONSTRAINT "prod_grouped_items_parent_product_id_id_products_id_fk"
      FOREIGN KEY ("parent_product_id_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

    DO $$ BEGIN
      ALTER TABLE "prod_grouped_items" DROP CONSTRAINT IF EXISTS "prod_grouped_items_child_product_id_id_products_id_fk";
    EXCEPTION
      WHEN undefined_object THEN NULL;
    END $$;

    ALTER TABLE "prod_grouped_items"
      ADD CONSTRAINT "prod_grouped_items_child_product_id_id_products_id_fk"
      FOREIGN KEY ("child_product_id_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    DO $$ BEGIN
      ALTER TABLE "merchant_products" DROP CONSTRAINT IF EXISTS "merchant_products_product_id_id_products_id_fk";
    EXCEPTION
      WHEN undefined_object THEN NULL;
    END $$;

    ALTER TABLE "merchant_products"
      ADD CONSTRAINT "merchant_products_product_id_id_products_id_fk"
      FOREIGN KEY ("product_id_id") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

    DO $$ BEGIN
      ALTER TABLE "merchant_products" DROP CONSTRAINT IF EXISTS "merchant_products_merchant_id_id_merchants_id_fk";
    EXCEPTION
      WHEN undefined_object THEN NULL;
    END $$;

    ALTER TABLE "merchant_products"
      ADD CONSTRAINT "merchant_products_merchant_id_id_merchants_id_fk"
      FOREIGN KEY ("merchant_id_id") REFERENCES "merchants"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

    DO $$ BEGIN
      ALTER TABLE "modifier_groups" DROP CONSTRAINT IF EXISTS "modifier_groups_product_id_id_products_id_fk";
    EXCEPTION
      WHEN undefined_object THEN NULL;
    END $$;

    ALTER TABLE "modifier_groups"
      ADD CONSTRAINT "modifier_groups_product_id_id_products_id_fk"
      FOREIGN KEY ("product_id_id") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

    DO $$ BEGIN
      ALTER TABLE "prod_grouped_items" DROP CONSTRAINT IF EXISTS "prod_grouped_items_parent_product_id_id_products_id_fk";
    EXCEPTION
      WHEN undefined_object THEN NULL;
    END $$;

    ALTER TABLE "prod_grouped_items"
      ADD CONSTRAINT "prod_grouped_items_parent_product_id_id_products_id_fk"
      FOREIGN KEY ("parent_product_id_id") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

    DO $$ BEGIN
      ALTER TABLE "prod_grouped_items" DROP CONSTRAINT IF EXISTS "prod_grouped_items_child_product_id_id_products_id_fk";
    EXCEPTION
      WHEN undefined_object THEN NULL;
    END $$;

    ALTER TABLE "prod_grouped_items"
      ADD CONSTRAINT "prod_grouped_items_child_product_id_id_products_id_fk"
      FOREIGN KEY ("child_product_id_id") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE NO ACTION;
  `)
}
