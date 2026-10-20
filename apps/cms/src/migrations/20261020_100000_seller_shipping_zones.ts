import type { MigrateDownArgs, MigrateUpArgs } from '@payloadcms/db-postgres'
import { sql } from '@payloadcms/db-postgres'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "merchants"
      ADD COLUMN "seller_pickup_enabled" boolean DEFAULT false NOT NULL,
      ADD COLUMN "seller_pickup_instructions" varchar;

    CREATE TABLE "seller_shipping_zones" (
      "id" serial PRIMARY KEY NOT NULL,
      "merchant_id" integer NOT NULL,
      "zone_id" varchar NOT NULL,
      "name" varchar DEFAULT '',
      "enabled" boolean DEFAULT true NOT NULL,
      "display_order" numeric NOT NULL,
      "areas" jsonb DEFAULT '[]'::jsonb NOT NULL,
      "geometry" jsonb,
      "delivery_fee" numeric NOT NULL,
      "minimum_order_amount" numeric DEFAULT 0 NOT NULL,
      "free_delivery_threshold" numeric,
      "estimated_delivery_min_minutes" numeric DEFAULT 0 NOT NULL,
      "estimated_delivery_max_minutes" numeric DEFAULT 0 NOT NULL,
      "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
      "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
      CONSTRAINT "seller_shipping_zones_merchant_id_merchants_id_fk"
        FOREIGN KEY ("merchant_id") REFERENCES "public"."merchants"("id")
        ON DELETE CASCADE ON UPDATE NO ACTION
    );

    CREATE INDEX "seller_shipping_zones_merchant_id_idx"
      ON "seller_shipping_zones" USING btree ("merchant_id");
    CREATE INDEX "seller_shipping_zones_merchant_display_order_idx"
      ON "seller_shipping_zones" USING btree ("merchant_id", "display_order");
    CREATE UNIQUE INDEX "seller_shipping_zones_merchant_zone_id_idx"
      ON "seller_shipping_zones" USING btree ("merchant_id", "zone_id");

    UPDATE "merchants"
    SET
      "seller_pickup_enabled" = COALESCE(
        ("seller_shipping_settings"->'pickup'->>'enabled')::boolean,
        false
      ),
      "seller_pickup_instructions" =
        "seller_shipping_settings"->'pickup'->>'instructions';

    INSERT INTO "seller_shipping_zones" (
      "merchant_id",
      "zone_id",
      "name",
      "enabled",
      "display_order",
      "areas",
      "geometry",
      "delivery_fee",
      "minimum_order_amount",
      "free_delivery_threshold",
      "estimated_delivery_min_minutes",
      "estimated_delivery_max_minutes"
    )
    SELECT
      merchants.id,
      zone.value->>'id',
      COALESCE(zone.value->>'name', ''),
      COALESCE((zone.value->>'enabled')::boolean, true),
      (zone.ordinality - 1)::numeric,
      COALESCE(zone.value->'areas', '[]'::jsonb),
      zone.value->'geometry',
      COALESCE((zone.value->>'deliveryFee')::numeric, 0),
      COALESCE((zone.value->>'minimumOrderAmount')::numeric, 0),
      (zone.value->>'freeDeliveryThreshold')::numeric,
      COALESCE((zone.value->>'estimatedDeliveryMinMinutes')::numeric, 0),
      COALESCE((zone.value->>'estimatedDeliveryMaxMinutes')::numeric, 0)
    FROM "merchants"
    CROSS JOIN LATERAL jsonb_array_elements(
      COALESCE("seller_shipping_settings"->'zones', '[]'::jsonb)
    ) WITH ORDINALITY AS zone(value, ordinality);

    ALTER TABLE "merchants" DROP COLUMN "seller_shipping_settings";
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "merchants"
      ADD COLUMN "seller_shipping_settings" jsonb
      DEFAULT '{"version":1,"pickup":{"enabled":false,"instructions":null},"zones":[]}'::jsonb;

    UPDATE "merchants" AS merchants
    SET "seller_shipping_settings" = jsonb_build_object(
      'version', 1,
      'pickup', jsonb_build_object(
        'enabled', merchants."seller_pickup_enabled",
        'instructions', merchants."seller_pickup_instructions"
      ),
      'zones', COALESCE((
        SELECT jsonb_agg(
          jsonb_build_object(
            'id', zones."zone_id",
            'name', COALESCE(zones."name", ''),
            'enabled', zones."enabled",
            'areas', zones."areas",
            'geometry', zones."geometry",
            'deliveryFee', zones."delivery_fee",
            'minimumOrderAmount', zones."minimum_order_amount",
            'freeDeliveryThreshold', zones."free_delivery_threshold",
            'estimatedDeliveryMinMinutes', zones."estimated_delivery_min_minutes",
            'estimatedDeliveryMaxMinutes', zones."estimated_delivery_max_minutes"
          )
          ORDER BY zones."display_order", zones."id"
        )
        FROM "seller_shipping_zones" AS zones
        WHERE zones."merchant_id" = merchants.id
      ), '[]'::jsonb)
    );

    DROP TABLE "seller_shipping_zones";
    ALTER TABLE "merchants"
      DROP COLUMN "seller_pickup_enabled",
      DROP COLUMN "seller_pickup_instructions";
  `)
}
