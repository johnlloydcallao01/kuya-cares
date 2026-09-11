import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_order_discounts_funded_by" AS ENUM('platform', 'vendor', 'split');
  CREATE TYPE "public"."enum_order_discounts_source" AS ENUM('manual', 'coupon', 'auto_campaign');
  CREATE TYPE "public"."enum_coupons_allowed_payment_methods" AS ENUM('card', 'gcash', 'grab_pay', 'paymaya', 'billease', 'dob', 'brankas', 'qrph');
  CREATE TYPE "public"."enum_coupons_time_windows_days" AS ENUM('mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun');
  CREATE TYPE "public"."enum_coupons_status" AS ENUM('draft', 'scheduled', 'published', 'paused', 'archived');
  CREATE TYPE "public"."enum_coupons_discount_type" AS ENUM('percent', 'fixed_cart', 'fixed_product');
  CREATE TYPE "public"."enum_coupons_applies_to" AS ENUM('food_subtotal', 'delivery_fee', 'both');
  CREATE TYPE "public"."enum_coupons_merchant_scope" AS ENUM('all_vendor_branches', 'selected_branches');
  CREATE TYPE "public"."enum_coupons_funded_by" AS ENUM('platform', 'vendor', 'split');
  CREATE TYPE "public"."enum_coupon_redemptions_funded_by" AS ENUM('platform', 'vendor', 'split');
  CREATE TYPE "public"."enum_coupon_redemptions_status" AS ENUM('held', 'applied', 'refunded', 'cancelled');
  CREATE TABLE "coupons_allowed_payment_methods" (
  	"order" integer NOT NULL,
  	"parent_id" integer NOT NULL,
  	"value" "enum_coupons_allowed_payment_methods",
  	"id" serial PRIMARY KEY NOT NULL
  );
  
  CREATE TABLE "coupons_time_windows_days" (
  	"order" integer NOT NULL,
  	"parent_id" varchar NOT NULL,
  	"value" "enum_coupons_time_windows_days",
  	"id" serial PRIMARY KEY NOT NULL
  );
  
  CREATE TABLE "coupons_time_windows" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"start_time" varchar NOT NULL,
  	"end_time" varchar NOT NULL
  );
  
  CREATE TABLE "coupons" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"code" varchar NOT NULL,
  	"description" varchar,
  	"status" "enum_coupons_status" DEFAULT 'draft' NOT NULL,
  	"discount_type" "enum_coupons_discount_type" DEFAULT 'fixed_cart' NOT NULL,
  	"amount" numeric NOT NULL,
  	"max_discount_amount" numeric,
  	"applies_to" "enum_coupons_applies_to" DEFAULT 'food_subtotal' NOT NULL,
  	"free_delivery" boolean DEFAULT false,
  	"delivery_discount_cap" numeric,
  	"vendor_id" integer,
  	"merchant_scope" "enum_coupons_merchant_scope" DEFAULT 'all_vendor_branches' NOT NULL,
  	"exclude_promo_items" boolean DEFAULT false,
  	"minimum_basket" numeric,
  	"maximum_basket" numeric,
  	"limit_per_order_items" numeric,
  	"individual_use" boolean DEFAULT true,
  	"max_coupons_per_order" numeric DEFAULT 1,
  	"starts_at" timestamp(3) with time zone,
  	"expires_at" timestamp(3) with time zone,
  	"usage_limit" numeric DEFAULT 0,
  	"usage_limit_per_user" numeric DEFAULT 0,
  	"usage_count" numeric DEFAULT 0,
  	"first_order_only" boolean DEFAULT false,
  	"funded_by" "enum_coupons_funded_by" DEFAULT 'platform' NOT NULL,
  	"vendor_share_pct" numeric DEFAULT 0,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "coupons_texts" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer NOT NULL,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"text" varchar
  );
  
  CREATE TABLE "coupons_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"merchants_id" integer,
  	"products_id" integer,
  	"prod_categories_id" integer
  );
  
  CREATE TABLE "coupon_redemptions" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"coupon_id" integer NOT NULL,
  	"order_id" integer NOT NULL,
  	"customer_id" integer NOT NULL,
  	"customer_email" varchar,
  	"customer_phone" varchar,
  	"code_snapshot" varchar NOT NULL,
  	"coupon_snapshot" jsonb,
  	"food_discount" numeric DEFAULT 0 NOT NULL,
  	"delivery_discount" numeric DEFAULT 0 NOT NULL,
  	"total_discount" numeric NOT NULL,
  	"funded_by" "enum_coupon_redemptions_funded_by" DEFAULT 'platform' NOT NULL,
  	"vendor_share_pct" numeric DEFAULT 0,
  	"platform_share" numeric DEFAULT 0 NOT NULL,
  	"vendor_share" numeric DEFAULT 0 NOT NULL,
  	"status" "enum_coupon_redemptions_status" DEFAULT 'held' NOT NULL,
  	"held_until" timestamp(3) with time zone,
  	"hold_key" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  ALTER TABLE "orders" ADD COLUMN "priority_fee" numeric DEFAULT 0 NOT NULL;
  ALTER TABLE "orders" ADD COLUMN "discount_total" numeric DEFAULT 0 NOT NULL;
  ALTER TABLE "orders" ADD COLUMN "coupon_code" varchar;
  ALTER TABLE "orders" ADD COLUMN "free_delivery_applied" boolean DEFAULT false;
  ALTER TABLE "order_discounts" ADD COLUMN "coupon_id" integer;
  ALTER TABLE "order_discounts" ADD COLUMN "coupon_snapshot" jsonb;
  ALTER TABLE "order_discounts" ADD COLUMN "food_discount" numeric DEFAULT 0;
  ALTER TABLE "order_discounts" ADD COLUMN "delivery_discount" numeric DEFAULT 0;
  ALTER TABLE "order_discounts" ADD COLUMN "funded_by" "enum_order_discounts_funded_by" DEFAULT 'platform';
  ALTER TABLE "order_discounts" ADD COLUMN "vendor_share_pct" numeric DEFAULT 0;
  ALTER TABLE "order_discounts" ADD COLUMN "platform_share" numeric DEFAULT 0;
  ALTER TABLE "order_discounts" ADD COLUMN "vendor_share" numeric DEFAULT 0;
  ALTER TABLE "order_discounts" ADD COLUMN "source" "enum_order_discounts_source" DEFAULT 'coupon';
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "coupons_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "coupon_redemptions_id" integer;
  ALTER TABLE "system_settings" ADD COLUMN "coupons_enabled" boolean DEFAULT true;
  ALTER TABLE "coupons_allowed_payment_methods" ADD CONSTRAINT "coupons_allowed_payment_methods_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."coupons"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "coupons_time_windows_days" ADD CONSTRAINT "coupons_time_windows_days_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."coupons_time_windows"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "coupons_time_windows" ADD CONSTRAINT "coupons_time_windows_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."coupons"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "coupons" ADD CONSTRAINT "coupons_vendor_id_vendors_id_fk" FOREIGN KEY ("vendor_id") REFERENCES "public"."vendors"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "coupons_texts" ADD CONSTRAINT "coupons_texts_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."coupons"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "coupons_rels" ADD CONSTRAINT "coupons_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."coupons"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "coupons_rels" ADD CONSTRAINT "coupons_rels_merchants_fk" FOREIGN KEY ("merchants_id") REFERENCES "public"."merchants"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "coupons_rels" ADD CONSTRAINT "coupons_rels_products_fk" FOREIGN KEY ("products_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "coupons_rels" ADD CONSTRAINT "coupons_rels_product_categories_fk" FOREIGN KEY ("prod_categories_id") REFERENCES "public"."prod_categories"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "coupon_redemptions" ADD CONSTRAINT "coupon_redemptions_coupon_id_coupons_id_fk" FOREIGN KEY ("coupon_id") REFERENCES "public"."coupons"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "coupon_redemptions" ADD CONSTRAINT "coupon_redemptions_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "coupon_redemptions" ADD CONSTRAINT "coupon_redemptions_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "coupons_allowed_payment_methods_order_idx" ON "coupons_allowed_payment_methods" USING btree ("order");
  CREATE INDEX "coupons_allowed_payment_methods_parent_idx" ON "coupons_allowed_payment_methods" USING btree ("parent_id");
  CREATE INDEX "coupons_time_windows_days_order_idx" ON "coupons_time_windows_days" USING btree ("order");
  CREATE INDEX "coupons_time_windows_days_parent_idx" ON "coupons_time_windows_days" USING btree ("parent_id");
  CREATE INDEX "coupons_time_windows_order_idx" ON "coupons_time_windows" USING btree ("_order");
  CREATE INDEX "coupons_time_windows_parent_id_idx" ON "coupons_time_windows" USING btree ("_parent_id");
  CREATE INDEX "coupons_vendor_idx" ON "coupons" USING btree ("vendor_id");
  CREATE INDEX "coupons_updated_at_idx" ON "coupons" USING btree ("updated_at");
  CREATE INDEX "coupons_created_at_idx" ON "coupons" USING btree ("created_at");
  CREATE UNIQUE INDEX "code_vendor_idx" ON "coupons" USING btree ("code","vendor_id");
  CREATE UNIQUE INDEX "coupons_code_platform_unique" ON "coupons" USING btree ("code") WHERE "vendor_id" IS NULL;
  CREATE INDEX "status_expires_at_idx" ON "coupons" USING btree ("status","expires_at");
  CREATE INDEX "vendor_1_idx" ON "coupons" USING btree ("vendor_id");
  CREATE INDEX "code_idx" ON "coupons" USING btree ("code");
  CREATE INDEX "coupons_texts_order_parent_idx" ON "coupons_texts" USING btree ("order","parent_id");
  CREATE INDEX "coupons_rels_order_idx" ON "coupons_rels" USING btree ("order");
  CREATE INDEX "coupons_rels_parent_idx" ON "coupons_rels" USING btree ("parent_id");
  CREATE INDEX "coupons_rels_path_idx" ON "coupons_rels" USING btree ("path");
  CREATE INDEX "coupons_rels_merchants_id_idx" ON "coupons_rels" USING btree ("merchants_id");
  CREATE INDEX "coupons_rels_products_id_idx" ON "coupons_rels" USING btree ("products_id");
  CREATE INDEX "coupons_rels_prod_categories_id_idx" ON "coupons_rels" USING btree ("prod_categories_id");
  CREATE INDEX "coupon_redemptions_coupon_idx" ON "coupon_redemptions" USING btree ("coupon_id");
  CREATE INDEX "coupon_redemptions_order_idx" ON "coupon_redemptions" USING btree ("order_id");
  CREATE INDEX "coupon_redemptions_customer_idx" ON "coupon_redemptions" USING btree ("customer_id");
  CREATE INDEX "coupon_redemptions_updated_at_idx" ON "coupon_redemptions" USING btree ("updated_at");
  CREATE INDEX "coupon_redemptions_created_at_idx" ON "coupon_redemptions" USING btree ("created_at");
  CREATE UNIQUE INDEX "coupon_order_idx" ON "coupon_redemptions" USING btree ("coupon_id","order_id");
  CREATE INDEX "coupon_customer_idx" ON "coupon_redemptions" USING btree ("coupon_id","customer_id");
  CREATE INDEX "coupon_status_idx" ON "coupon_redemptions" USING btree ("coupon_id","status");
  CREATE INDEX "order_idx" ON "coupon_redemptions" USING btree ("order_id");
  CREATE INDEX "customer_idx" ON "coupon_redemptions" USING btree ("customer_id");
  CREATE INDEX "held_until_idx" ON "coupon_redemptions" USING btree ("held_until");
  ALTER TABLE "order_discounts" ADD CONSTRAINT "order_discounts_coupon_id_coupons_id_fk" FOREIGN KEY ("coupon_id") REFERENCES "public"."coupons"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_coupons_fk" FOREIGN KEY ("coupons_id") REFERENCES "public"."coupons"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_coupon_redemptions_fk" FOREIGN KEY ("coupon_redemptions_id") REFERENCES "public"."coupon_redemptions"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "order_discounts_coupon_idx" ON "order_discounts" USING btree ("coupon_id");
  CREATE INDEX "order_coupon_idx" ON "order_discounts" USING btree ("order_id","coupon_id");
  CREATE INDEX "coupon_idx" ON "order_discounts" USING btree ("coupon_id");
  CREATE INDEX "payload_locked_documents_rels_coupons_id_idx" ON "payload_locked_documents_rels" USING btree ("coupons_id");
  CREATE INDEX "payload_locked_documents_rels_coupon_redemptions_id_idx" ON "payload_locked_documents_rels" USING btree ("coupon_redemptions_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "coupons_allowed_payment_methods" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "coupons_time_windows_days" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "coupons_time_windows" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "coupons" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "coupons_texts" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "coupons_rels" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "coupon_redemptions" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "coupons_allowed_payment_methods" CASCADE;
  DROP TABLE "coupons_time_windows_days" CASCADE;
  DROP TABLE "coupons_time_windows" CASCADE;
  DROP TABLE "coupons" CASCADE;
  DROP TABLE "coupons_texts" CASCADE;
  DROP TABLE "coupons_rels" CASCADE;
  DROP TABLE "coupon_redemptions" CASCADE;
  ALTER TABLE "order_discounts" DROP CONSTRAINT "order_discounts_coupon_id_coupons_id_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_coupons_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_coupon_redemptions_fk";
  
  DROP INDEX "order_discounts_coupon_idx";
  DROP INDEX "order_coupon_idx";
  DROP INDEX "coupon_idx";
  DROP INDEX "coupons_code_platform_unique";
  DROP INDEX "payload_locked_documents_rels_coupons_id_idx";
  DROP INDEX "payload_locked_documents_rels_coupon_redemptions_id_idx";
  ALTER TABLE "orders" DROP COLUMN "priority_fee";
  ALTER TABLE "orders" DROP COLUMN "discount_total";
  ALTER TABLE "orders" DROP COLUMN "coupon_code";
  ALTER TABLE "orders" DROP COLUMN "free_delivery_applied";
  ALTER TABLE "order_discounts" DROP COLUMN "coupon_id";
  ALTER TABLE "order_discounts" DROP COLUMN "coupon_snapshot";
  ALTER TABLE "order_discounts" DROP COLUMN "food_discount";
  ALTER TABLE "order_discounts" DROP COLUMN "delivery_discount";
  ALTER TABLE "order_discounts" DROP COLUMN "funded_by";
  ALTER TABLE "order_discounts" DROP COLUMN "vendor_share_pct";
  ALTER TABLE "order_discounts" DROP COLUMN "platform_share";
  ALTER TABLE "order_discounts" DROP COLUMN "vendor_share";
  ALTER TABLE "order_discounts" DROP COLUMN "source";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "coupons_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "coupon_redemptions_id";
  ALTER TABLE "system_settings" DROP COLUMN "coupons_enabled";
  DROP TYPE "public"."enum_order_discounts_funded_by";
  DROP TYPE "public"."enum_order_discounts_source";
  DROP TYPE "public"."enum_coupons_allowed_payment_methods";
  DROP TYPE "public"."enum_coupons_time_windows_days";
  DROP TYPE "public"."enum_coupons_status";
  DROP TYPE "public"."enum_coupons_discount_type";
  DROP TYPE "public"."enum_coupons_applies_to";
  DROP TYPE "public"."enum_coupons_merchant_scope";
  DROP TYPE "public"."enum_coupons_funded_by";
  DROP TYPE "public"."enum_coupon_redemptions_funded_by";
  DROP TYPE "public"."enum_coupon_redemptions_status";`)
}
