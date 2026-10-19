import type { MigrateDownArgs, MigrateUpArgs } from '@payloadcms/db-postgres'
import { sql } from '@payloadcms/db-postgres'
import {
  clearMigrationSchemaState,
  migrationSchemaPreexisted,
  reconcileMigrationSchema,
  recordMigrationSchemaApplied,
} from '../utils/migrationReconciliation'

const migrationName = '20261019_032834'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  const schemaPreexisted = await reconcileMigrationSchema(db, migrationName, async () => {
    const { rows } = await db.execute(sql`
      SELECT
        bool_and("present") AS "complete",
        bool_or("present") AS "partial"
      FROM (VALUES
        (EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_schema = 'public' AND table_name = 'merchants'
            AND column_name = 'seller_shipping_settings'
        )),
        (EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_schema = 'public' AND table_name = 'orders'
            AND column_name = 'seller_shipping_snapshot'
        )),
        (EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_schema = 'public' AND table_name = 'orders'
            AND column_name = 'checkout_idempotency_key'
        )),
        (EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_schema = 'public' AND table_name = 'orders'
            AND column_name = 'seller_shipping_proceeds'
        )),
        (EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_schema = 'public' AND table_name = 'orders'
            AND column_name = 'seller_carrier_name'
        )),
        (EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_schema = 'public' AND table_name = 'orders'
            AND column_name = 'seller_tracking_reference'
        )),
        (EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_schema = 'public' AND table_name = 'orders'
            AND column_name = 'seller_tracking_url'
        )),
        (EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_schema = 'public' AND table_name = 'vendor_commission_entries'
            AND column_name = 'seller_shipping_proceeds'
        )),
        (EXISTS (
          SELECT 1 FROM pg_indexes
          WHERE schemaname = 'public' AND indexname = 'orders_checkout_idempotency_key_idx'
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
    ALTER TABLE "merchants"
      ADD COLUMN "seller_shipping_settings" jsonb
      DEFAULT '{"version":1,"pickup":{"enabled":false,"instructions":null},"zones":[]}'::jsonb;
    ALTER TABLE "orders" ADD COLUMN "seller_shipping_snapshot" jsonb;
    ALTER TABLE "orders" ADD COLUMN "checkout_idempotency_key" varchar;
    ALTER TABLE "orders" ADD COLUMN "seller_shipping_proceeds" numeric;
    ALTER TABLE "orders" ADD COLUMN "seller_carrier_name" varchar;
    ALTER TABLE "orders" ADD COLUMN "seller_tracking_reference" varchar;
    ALTER TABLE "orders" ADD COLUMN "seller_tracking_url" varchar;
    ALTER TABLE "vendor_commission_entries"
      ADD COLUMN "seller_shipping_proceeds" numeric DEFAULT 0 NOT NULL;
    CREATE UNIQUE INDEX "orders_checkout_idempotency_key_idx"
      ON "orders" USING btree ("checkout_idempotency_key");
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
      IF EXISTS (
        SELECT 1 FROM "orders"
        WHERE "seller_shipping_snapshot" IS NOT NULL
          OR "seller_shipping_proceeds" IS NOT NULL
          OR "seller_carrier_name" IS NOT NULL
          OR "seller_tracking_reference" IS NOT NULL
          OR "seller_tracking_url" IS NOT NULL
      ) OR EXISTS (
        SELECT 1 FROM "vendor_commission_entries"
        WHERE "seller_shipping_proceeds" <> 0
      ) OR EXISTS (
        SELECT 1 FROM "merchants"
        WHERE "seller_shipping_settings" IS DISTINCT FROM
          '{"version":1,"pickup":{"enabled":false,"instructions":null},"zones":[]}'::jsonb
      ) THEN
        RAISE EXCEPTION 'Cannot roll back seller-managed shipping after shipping settings, orders, tracking, or proceeds have been recorded.';
      END IF;
    END
    $$;
    DROP INDEX "orders_checkout_idempotency_key_idx";
    ALTER TABLE "merchants" DROP COLUMN "seller_shipping_settings";
    ALTER TABLE "orders" DROP COLUMN "seller_shipping_snapshot";
    ALTER TABLE "orders" DROP COLUMN "checkout_idempotency_key";
    ALTER TABLE "orders" DROP COLUMN "seller_shipping_proceeds";
    ALTER TABLE "orders" DROP COLUMN "seller_carrier_name";
    ALTER TABLE "orders" DROP COLUMN "seller_tracking_reference";
    ALTER TABLE "orders" DROP COLUMN "seller_tracking_url";
    ALTER TABLE "vendor_commission_entries" DROP COLUMN "seller_shipping_proceeds";
  `)
  await clearMigrationSchemaState(db, migrationName)
}
