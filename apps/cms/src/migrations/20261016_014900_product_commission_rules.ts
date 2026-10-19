import { MigrateDownArgs, MigrateUpArgs, sql } from '@payloadcms/db-postgres'
import {
  clearMigrationSchemaState,
  migrationSchemaPreexisted,
  reconcileMigrationSchema,
  recordMigrationSchemaApplied,
} from '../utils/migrationReconciliation'

const migrationName = '20261016_014900_product_commission_rules'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  const schemaPreexisted = await reconcileMigrationSchema(db, migrationName, async () => {
    const { rows } = await db.execute(sql`
      SELECT
        bool_and("present") AS "complete",
        bool_or("present") AS "partial"
      FROM (VALUES
        (EXISTS (SELECT 1 FROM pg_type WHERE typname = 'enum_commission_rules_commission_method')),
        (EXISTS (
          SELECT 1 FROM pg_enum e
          JOIN pg_type t ON t.oid = e.enumtypid
          WHERE t.typname = 'enum_commission_rules_scope' AND e.enumlabel = 'product'
        )),
        (EXISTS (
          SELECT 1 FROM pg_enum e
          JOIN pg_type t ON t.oid = e.enumtypid
          WHERE t.typname = 'enum_commission_rules_scope' AND e.enumlabel = 'product_category'
        )),
        (EXISTS (
          SELECT 1 FROM pg_enum e
          JOIN pg_type t ON t.oid = e.enumtypid
          WHERE t.typname = 'enum_orders_commission_source' AND e.enumlabel = 'product'
        )),
        (EXISTS (
          SELECT 1 FROM pg_enum e
          JOIN pg_type t ON t.oid = e.enumtypid
          WHERE t.typname = 'enum_orders_commission_source' AND e.enumlabel = 'product_category'
        )),
        (EXISTS (
          SELECT 1 FROM pg_enum e
          JOIN pg_type t ON t.oid = e.enumtypid
          WHERE t.typname = 'enum_orders_commission_source' AND e.enumlabel = 'volume_tier'
        )),
        (EXISTS (
          SELECT 1 FROM pg_enum e
          JOIN pg_type t ON t.oid = e.enumtypid
          WHERE t.typname = 'enum_vendor_commission_entries_commission_source'
            AND e.enumlabel = 'product'
        )),
        (EXISTS (
          SELECT 1 FROM pg_enum e
          JOIN pg_type t ON t.oid = e.enumtypid
          WHERE t.typname = 'enum_vendor_commission_entries_commission_source'
            AND e.enumlabel = 'product_category'
        )),
        (EXISTS (
          SELECT 1 FROM pg_enum e
          JOIN pg_type t ON t.oid = e.enumtypid
          WHERE t.typname = 'enum_vendor_commission_entries_commission_source'
            AND e.enumlabel = 'volume_tier'
        )),
        (EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_schema = 'public' AND table_name = 'products' AND column_name = 'vendor_cost'
        )),
        (EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_schema = 'public' AND table_name = 'order_items' AND column_name = 'vendor_cost_at_purchase'
        )),
        (EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_schema = 'public' AND table_name = 'commission_rules' AND column_name = 'commission_method'
        )),
        (EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_schema = 'public' AND table_name = 'commission_rules' AND column_name = 'commission_value'
        )),
        (EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_schema = 'public' AND table_name = 'commission_rules' AND column_name = 'product_id'
        )),
        (EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'commission_rules_product_id_products_id_fk'
        )),
        (EXISTS (
          SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'commission_rules_product_idx'
        )),
        (EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_schema = 'public' AND table_name = 'commission_rules' AND column_name = 'product_category_id'
        )),
        (EXISTS (
          SELECT 1 FROM pg_constraint
          WHERE conname = 'commission_rules_product_category_id_prod_categories_id_fk'
        )),
        (EXISTS (
          SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'commission_rules_product_category_idx'
        )),
        (EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_schema = 'public' AND table_name = 'orders' AND column_name = 'commission_product_breakdown'
        )),
        (EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_schema = 'public' AND table_name = 'vendor_commission_entries'
            AND column_name = 'commission_product_breakdown'
        )),
        (EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_schema = 'public' AND table_name = 'orders' AND column_name = 'commission_volume_tier_snapshot'
        )),
        (EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_schema = 'public' AND table_name = 'vendor_commission_entries'
            AND column_name = 'commission_volume_tier_snapshot'
        )),
        (EXISTS (
          SELECT 1 FROM information_schema.tables
          WHERE table_schema = 'public' AND table_name = 'system_settings_commission_volume_tiers'
        )),
        (EXISTS (
          SELECT 1 FROM pg_constraint
          WHERE conname = 'system_settings_commission_volume_tiers_parent_id_fk'
        )),
        (EXISTS (
          SELECT 1 FROM pg_indexes
          WHERE schemaname = 'public' AND indexname = 'system_settings_commission_volume_tiers_order_idx'
        )),
        (EXISTS (
          SELECT 1 FROM pg_indexes
          WHERE schemaname = 'public' AND indexname = 'system_settings_commission_volume_tiers_parent_id_idx'
        ))
      ) AS expected("present")
    `)
    return {
      complete: rows[0]?.complete === true,
      partial: rows[0]?.partial === true,
    }
  })
  if (schemaPreexisted) return

  await db.execute(sql`
    ALTER TYPE "public"."enum_commission_rules_scope" ADD VALUE 'product';
    ALTER TYPE "public"."enum_commission_rules_scope" ADD VALUE 'product_category';
    ALTER TYPE "public"."enum_orders_commission_source" ADD VALUE 'product';
    ALTER TYPE "public"."enum_orders_commission_source" ADD VALUE 'product_category';
    ALTER TYPE "public"."enum_orders_commission_source" ADD VALUE 'volume_tier';
    ALTER TYPE "public"."enum_vendor_commission_entries_commission_source" ADD VALUE 'product';
    ALTER TYPE "public"."enum_vendor_commission_entries_commission_source" ADD VALUE 'product_category';
    ALTER TYPE "public"."enum_vendor_commission_entries_commission_source" ADD VALUE 'volume_tier';

    CREATE TYPE "public"."enum_commission_rules_commission_method" AS ENUM (
      'percentage_of_discounted_subtotal',
      'percentage_of_pre_discount_subtotal',
      'fixed_amount_per_unit',
      'percentage_of_vendor_cost'
    );
    ALTER TABLE "products" ADD COLUMN "vendor_cost" numeric;
    ALTER TABLE "order_items" ADD COLUMN "vendor_cost_at_purchase" numeric;
    ALTER TABLE "commission_rules"
      ADD COLUMN "commission_method" "public"."enum_commission_rules_commission_method" NOT NULL DEFAULT 'percentage_of_discounted_subtotal',
      ADD COLUMN "commission_value" numeric;

    ALTER TABLE "commission_rules" ADD COLUMN "product_id" integer;
    ALTER TABLE "commission_rules"
      ADD CONSTRAINT "commission_rules_product_id_products_id_fk"
      FOREIGN KEY ("product_id") REFERENCES "public"."products"("id")
      ON DELETE set null ON UPDATE no action;
    CREATE INDEX "commission_rules_product_idx"
      ON "commission_rules" USING btree ("product_id");

    ALTER TABLE "commission_rules" ADD COLUMN "product_category_id" integer;
    ALTER TABLE "commission_rules"
      ADD CONSTRAINT "commission_rules_product_category_id_prod_categories_id_fk"
      FOREIGN KEY ("product_category_id") REFERENCES "public"."prod_categories"("id")
      ON DELETE set null ON UPDATE no action;
    CREATE INDEX "commission_rules_product_category_idx"
      ON "commission_rules" USING btree ("product_category_id");

    ALTER TABLE "orders" ADD COLUMN "commission_product_breakdown" jsonb;
    ALTER TABLE "vendor_commission_entries" ADD COLUMN "commission_product_breakdown" jsonb;
    ALTER TABLE "orders" ADD COLUMN "commission_volume_tier_snapshot" jsonb;
    ALTER TABLE "vendor_commission_entries" ADD COLUMN "commission_volume_tier_snapshot" jsonb;

    CREATE TABLE "system_settings_commission_volume_tiers" (
      "_order" integer NOT NULL,
      "_parent_id" integer NOT NULL,
      "id" varchar PRIMARY KEY NOT NULL,
      "name" varchar NOT NULL,
      "minimum_net_sales" numeric NOT NULL,
      "commission_percent" numeric NOT NULL
    );
    ALTER TABLE "system_settings_commission_volume_tiers"
      ADD CONSTRAINT "system_settings_commission_volume_tiers_parent_id_fk"
      FOREIGN KEY ("_parent_id") REFERENCES "public"."system_settings"("id")
      ON DELETE cascade ON UPDATE no action;
    CREATE INDEX "system_settings_commission_volume_tiers_order_idx"
      ON "system_settings_commission_volume_tiers" USING btree ("_order");
    CREATE INDEX "system_settings_commission_volume_tiers_parent_id_idx"
      ON "system_settings_commission_volume_tiers" USING btree ("_parent_id");
  `)
  await recordMigrationSchemaApplied(db, migrationName)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  if (await migrationSchemaPreexisted(db, migrationName)) {
    await clearMigrationSchemaState(db, migrationName)
    return
  }

  await db.execute(sql`
    DO $$
    BEGIN
      IF EXISTS (SELECT 1 FROM "commission_rules" WHERE "scope" = 'product')
        OR EXISTS (SELECT 1 FROM "commission_rules" WHERE "scope" = 'product_category')
        OR EXISTS (SELECT 1 FROM "orders" WHERE "commission_source" = 'product')
        OR EXISTS (SELECT 1 FROM "orders" WHERE "commission_source" = 'product_category')
        OR EXISTS (SELECT 1 FROM "vendor_commission_entries" WHERE "commission_source" = 'product')
        OR EXISTS (SELECT 1 FROM "vendor_commission_entries" WHERE "commission_source" = 'product_category') THEN
        RAISE EXCEPTION 'Cannot roll back product commission rules after product or product-category commission data has been recorded.';
      END IF;
      IF EXISTS (SELECT 1 FROM "commission_rules" WHERE "commission_method" <> 'percentage_of_discounted_subtotal' OR "commission_value" IS NOT NULL)
        OR EXISTS (SELECT 1 FROM "products" WHERE "vendor_cost" IS NOT NULL)
        OR EXISTS (SELECT 1 FROM "order_items" WHERE "vendor_cost_at_purchase" IS NOT NULL)
        OR EXISTS (SELECT 1 FROM "system_settings_commission_volume_tiers") THEN
        RAISE EXCEPTION 'Cannot roll back commission methods, vendor cost snapshots, or volume tiers after configuration or cost data has been recorded.';
      END IF;
      IF EXISTS (SELECT 1 FROM "orders" WHERE "commission_source" = 'volume_tier')
        OR EXISTS (SELECT 1 FROM "vendor_commission_entries" WHERE "commission_source" = 'volume_tier') THEN
        RAISE EXCEPTION 'Cannot roll back a recorded vendor volume-tier commission.';
      END IF;
    END
    $$;
    DROP TABLE "system_settings_commission_volume_tiers";

    ALTER TABLE "commission_rules" DROP CONSTRAINT "commission_rules_product_id_products_id_fk";
    DROP INDEX "commission_rules_product_idx";
    ALTER TABLE "commission_rules" DROP COLUMN "product_id";
    ALTER TABLE "commission_rules" DROP CONSTRAINT "commission_rules_product_category_id_prod_categories_id_fk";
    DROP INDEX "commission_rules_product_category_idx";
    ALTER TABLE "commission_rules" DROP COLUMN "product_category_id";
    ALTER TABLE "orders" DROP COLUMN "commission_product_breakdown";
    ALTER TABLE "vendor_commission_entries" DROP COLUMN "commission_product_breakdown";
    ALTER TABLE "orders" DROP COLUMN "commission_volume_tier_snapshot";
    ALTER TABLE "vendor_commission_entries" DROP COLUMN "commission_volume_tier_snapshot";
    ALTER TABLE "commission_rules" DROP COLUMN "commission_method";
    ALTER TABLE "commission_rules" DROP COLUMN "commission_value";
    DROP TYPE "public"."enum_commission_rules_commission_method";
    ALTER TABLE "order_items" DROP COLUMN "vendor_cost_at_purchase";
    ALTER TABLE "products" DROP COLUMN "vendor_cost";

    ALTER TABLE "commission_rules" ALTER COLUMN "scope" TYPE text USING "scope"::text;
    DROP TYPE "public"."enum_commission_rules_scope";
    CREATE TYPE "public"."enum_commission_rules_scope" AS ENUM('global', 'plan', 'category', 'vendor');
    ALTER TABLE "commission_rules" ALTER COLUMN "scope"
      TYPE "public"."enum_commission_rules_scope"
      USING "scope"::"public"."enum_commission_rules_scope";

    ALTER TABLE "orders" ALTER COLUMN "commission_source" TYPE text USING "commission_source"::text;
    DROP TYPE "public"."enum_orders_commission_source";
    CREATE TYPE "public"."enum_orders_commission_source" AS ENUM('vendor', 'category', 'plan', 'global');
    ALTER TABLE "orders" ALTER COLUMN "commission_source"
      TYPE "public"."enum_orders_commission_source"
      USING "commission_source"::"public"."enum_orders_commission_source";

    ALTER TABLE "vendor_commission_entries" ALTER COLUMN "commission_source" TYPE text USING "commission_source"::text;
    DROP TYPE "public"."enum_vendor_commission_entries_commission_source";
    CREATE TYPE "public"."enum_vendor_commission_entries_commission_source" AS ENUM('vendor', 'category', 'plan', 'global');
    ALTER TABLE "vendor_commission_entries" ALTER COLUMN "commission_source"
      TYPE "public"."enum_vendor_commission_entries_commission_source"
      USING "commission_source"::"public"."enum_vendor_commission_entries_commission_source";
  `)
  await clearMigrationSchemaState(db, migrationName)
}
