import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TABLE "business_zones" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar NOT NULL,
  	"slug" varchar NOT NULL,
  	"description" varchar,
  	"boundary" jsonb,
  	"boundary_geometry" jsonb,
  	"is_active" boolean DEFAULT true,
  	"disabled_reason" varchar,
  	"display_order" numeric DEFAULT 0,
  	"timezone" varchar DEFAULT 'Asia/Manila',
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  DROP INDEX "isActive_idx";
  DROP INDEX "displayOrder_idx";
  DROP INDEX "variation_id_base_modifier_group_id_idx";
  DROP INDEX "variation_id_base_modifier_option_id_idx";
  DROP INDEX "merchant_product_id_base_modifier_group_id_idx";
  DROP INDEX "merchant_product_id_base_modifier_option_id_idx";
  DROP INDEX "merchant_product_id_variation_id_base_modifier_group_id_idx";
  DROP INDEX "merchant_product_id_variation_id_variation_modifier_group_id_idx";
  DROP INDEX "merchant_product_id_variation_id_base_modifier_option_id_idx";
  DROP INDEX "merchant_product_id_variation_id_variation_modifier_option_id_idx";
  ALTER TABLE "merchants" ADD COLUMN "business_zone_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "business_zones_id" integer;
  CREATE UNIQUE INDEX "business_zones_slug_idx" ON "business_zones" USING btree ("slug");
  CREATE INDEX "business_zones_updated_at_idx" ON "business_zones" USING btree ("updated_at");
  CREATE INDEX "business_zones_created_at_idx" ON "business_zones" USING btree ("created_at");
  CREATE INDEX "isActive_idx" ON "business_zones" USING btree ("is_active");
  CREATE INDEX "displayOrder_idx" ON "business_zones" USING btree ("display_order");
  ALTER TABLE "merchants" ADD CONSTRAINT "merchants_business_zone_id_business_zones_id_fk" FOREIGN KEY ("business_zone_id") REFERENCES "public"."business_zones"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_business_zones_fk" FOREIGN KEY ("business_zones_id") REFERENCES "public"."business_zones"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "merchants_business_zone_idx" ON "merchants" USING btree ("business_zone_id");
  CREATE INDEX "isActive_1_idx" ON "drivers" USING btree ("is_active");
  CREATE INDEX "displayOrder_1_idx" ON "merchant_categories" USING btree ("display_order");
  CREATE INDEX "payload_locked_documents_rels_business_zones_id_idx" ON "payload_locked_documents_rels" USING btree ("business_zones_id");
  CREATE UNIQUE INDEX "variation_id_base_modifier_group_id_idx" ON "variation_modifier_group_overrides" USING btree ("variation_id_id","base_modifier_group_id_id");
  CREATE UNIQUE INDEX "variation_id_base_modifier_option_id_idx" ON "variation_modifier_option_overrides" USING btree ("variation_id_id","base_modifier_option_id_id");
  CREATE UNIQUE INDEX "merchant_product_id_base_modifier_group_id_idx" ON "merchant_product_modifier_group_overrides" USING btree ("merchant_product_id_id","base_modifier_group_id_id");
  CREATE UNIQUE INDEX "merchant_product_id_base_modifier_option_id_idx" ON "merchant_product_modifier_option_overrides" USING btree ("merchant_product_id_id","base_modifier_option_id_id");
  CREATE UNIQUE INDEX "merchant_product_id_variation_id_base_modifier_group_id_idx" ON "merchant_variation_modifier_group_overrides" USING btree ("merchant_product_id_id","variation_id_id","base_modifier_group_id_id");
  CREATE UNIQUE INDEX "merchant_product_id_variation_id_variation_modifier_group_id_idx" ON "merchant_variation_modifier_group_overrides" USING btree ("merchant_product_id_id","variation_id_id","variation_modifier_group_id_id");
  CREATE UNIQUE INDEX "merchant_product_id_variation_id_base_modifier_option_id_idx" ON "merchant_variation_modifier_option_overrides" USING btree ("merchant_product_id_id","variation_id_id","base_modifier_option_id_id");
  CREATE UNIQUE INDEX "merchant_product_id_variation_id_variation_modifier_option_id_idx" ON "merchant_variation_modifier_option_overrides" USING btree ("merchant_product_id_id","variation_id_id","variation_modifier_option_id_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "business_zones" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "business_zones" CASCADE;
  ALTER TABLE "merchants" DROP CONSTRAINT "merchants_business_zone_id_business_zones_id_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_business_zones_fk";
  
  DROP INDEX "merchants_business_zone_idx";
  DROP INDEX "isActive_1_idx";
  DROP INDEX "displayOrder_1_idx";
  DROP INDEX "payload_locked_documents_rels_business_zones_id_idx";
  DROP INDEX "variation_id_base_modifier_group_id_idx";
  DROP INDEX "variation_id_base_modifier_option_id_idx";
  DROP INDEX "merchant_product_id_base_modifier_group_id_idx";
  DROP INDEX "merchant_product_id_base_modifier_option_id_idx";
  DROP INDEX "merchant_product_id_variation_id_base_modifier_group_id_idx";
  DROP INDEX "merchant_product_id_variation_id_variation_modifier_group_id_idx";
  DROP INDEX "merchant_product_id_variation_id_base_modifier_option_id_idx";
  DROP INDEX "merchant_product_id_variation_id_variation_modifier_option_id_idx";
  CREATE INDEX "isActive_idx" ON "drivers" USING btree ("is_active");
  CREATE INDEX "displayOrder_idx" ON "merchant_categories" USING btree ("display_order");
  CREATE INDEX "variation_id_base_modifier_group_id_idx" ON "variation_modifier_group_overrides" USING btree ("variation_id_id","base_modifier_group_id_id");
  CREATE INDEX "variation_id_base_modifier_option_id_idx" ON "variation_modifier_option_overrides" USING btree ("variation_id_id","base_modifier_option_id_id");
  CREATE INDEX "merchant_product_id_base_modifier_group_id_idx" ON "merchant_product_modifier_group_overrides" USING btree ("merchant_product_id_id","base_modifier_group_id_id");
  CREATE INDEX "merchant_product_id_base_modifier_option_id_idx" ON "merchant_product_modifier_option_overrides" USING btree ("merchant_product_id_id","base_modifier_option_id_id");
  CREATE INDEX "merchant_product_id_variation_id_base_modifier_group_id_idx" ON "merchant_variation_modifier_group_overrides" USING btree ("merchant_product_id_id","variation_id_id","base_modifier_group_id_id");
  CREATE INDEX "merchant_product_id_variation_id_variation_modifier_group_id_idx" ON "merchant_variation_modifier_group_overrides" USING btree ("merchant_product_id_id","variation_id_id","variation_modifier_group_id_id");
  CREATE INDEX "merchant_product_id_variation_id_base_modifier_option_id_idx" ON "merchant_variation_modifier_option_overrides" USING btree ("merchant_product_id_id","variation_id_id","base_modifier_option_id_id");
  CREATE INDEX "merchant_product_id_variation_id_variation_modifier_option_id_idx" ON "merchant_variation_modifier_option_overrides" USING btree ("merchant_product_id_id","variation_id_id","variation_modifier_option_id_id");
  ALTER TABLE "merchants" DROP COLUMN "business_zone_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "business_zones_id";`)
}
