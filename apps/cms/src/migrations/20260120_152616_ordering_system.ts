import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_orders_status" AS ENUM('pending', 'accepted', 'preparing', 'ready_for_pickup', 'on_delivery', 'delivered', 'cancelled');
  CREATE TYPE "public"."enum_orders_fulfillment_type" AS ENUM('delivery', 'pickup');
  CREATE TYPE "public"."enum_delivery_locations_label" AS ENUM('home', 'office', 'other');
  CREATE TYPE "public"."enum_transactions_status" AS ENUM('pending', 'paid', 'failed', 'refunded');
  CREATE TYPE "public"."enum_order_tracking_status" AS ENUM('pending', 'accepted', 'preparing', 'ready_for_pickup', 'on_delivery', 'delivered', 'cancelled');
  CREATE TYPE "public"."enum_rider_assignments_status" AS ENUM('offered', 'accepted', 'rejected', 'completed');
  CREATE TYPE "public"."enum_order_discounts_type" AS ENUM('percentage', 'fixed');
  CREATE TABLE "orders" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"customer_id" integer NOT NULL,
  	"merchant_id" integer NOT NULL,
  	"status" "enum_orders_status" DEFAULT 'pending' NOT NULL,
  	"fulfillment_type" "enum_orders_fulfillment_type" NOT NULL,
  	"total" numeric NOT NULL,
  	"subtotal" numeric NOT NULL,
  	"delivery_fee" numeric DEFAULT 0 NOT NULL,
  	"platform_fee" numeric DEFAULT 0 NOT NULL,
  	"notes" varchar,
  	"placed_at" timestamp(3) with time zone NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "order_items" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order_id" integer NOT NULL,
  	"product_id" integer NOT NULL,
  	"merchant_product_id" integer NOT NULL,
  	"product_name_snapshot" varchar NOT NULL,
  	"price_at_purchase" numeric NOT NULL,
  	"quantity" numeric NOT NULL,
  	"options_snapshot" jsonb,
  	"total_price" numeric NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "delivery_locations" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order_id" integer NOT NULL,
  	"formatted_address" varchar NOT NULL,
  	"coordinates" jsonb,
  	"notes" varchar,
  	"contact_name" varchar,
  	"contact_phone" varchar,
  	"label" "enum_delivery_locations_label",
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "transactions" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order_id" integer NOT NULL,
  	"payment_intent_id" varchar,
  	"payment_method" varchar,
  	"amount" numeric NOT NULL,
  	"currency" varchar DEFAULT 'PHP',
  	"status" "enum_transactions_status" DEFAULT 'pending' NOT NULL,
  	"paid_at" timestamp(3) with time zone,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "order_tracking" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order_id" integer NOT NULL,
  	"status" "enum_order_tracking_status" NOT NULL,
  	"timestamp" timestamp(3) with time zone NOT NULL,
  	"actor_id" integer,
  	"description" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "rider_assignments" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order_id" integer NOT NULL,
  	"driver_id" integer NOT NULL,
  	"status" "enum_rider_assignments_status" DEFAULT 'offered' NOT NULL,
  	"assigned_at" timestamp(3) with time zone NOT NULL,
  	"accepted_at" timestamp(3) with time zone,
  	"completed_at" timestamp(3) with time zone,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "order_discounts" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order_id" integer NOT NULL,
  	"code" varchar NOT NULL,
  	"amount_off" numeric NOT NULL,
  	"type" "enum_order_discounts_type" NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "reviews" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order_id" integer NOT NULL,
  	"customer_id" integer NOT NULL,
  	"merchant_id" integer NOT NULL,
  	"driver_id" integer,
  	"merchant_rating" numeric NOT NULL,
  	"driver_rating" numeric,
  	"comment" varchar,
  	"is_public" boolean DEFAULT false,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  ALTER TABLE "wishlists" ALTER COLUMN "item_type" SET DEFAULT 'merchant';
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "orders_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "order_items_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "delivery_locations_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "transactions_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "order_tracking_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "rider_assignments_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "order_discounts_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "reviews_id" integer;
  ALTER TABLE "orders" ADD CONSTRAINT "orders_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "orders" ADD CONSTRAINT "orders_merchant_id_merchants_id_fk" FOREIGN KEY ("merchant_id") REFERENCES "public"."merchants"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "order_items" ADD CONSTRAINT "order_items_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "order_items" ADD CONSTRAINT "order_items_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "order_items" ADD CONSTRAINT "order_items_merchant_product_id_merchant_products_id_fk" FOREIGN KEY ("merchant_product_id") REFERENCES "public"."merchant_products"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "delivery_locations" ADD CONSTRAINT "delivery_locations_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "transactions" ADD CONSTRAINT "transactions_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "order_tracking" ADD CONSTRAINT "order_tracking_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "order_tracking" ADD CONSTRAINT "order_tracking_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "rider_assignments" ADD CONSTRAINT "rider_assignments_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "rider_assignments" ADD CONSTRAINT "rider_assignments_driver_id_drivers_id_fk" FOREIGN KEY ("driver_id") REFERENCES "public"."drivers"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "order_discounts" ADD CONSTRAINT "order_discounts_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "reviews" ADD CONSTRAINT "reviews_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "reviews" ADD CONSTRAINT "reviews_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "reviews" ADD CONSTRAINT "reviews_merchant_id_merchants_id_fk" FOREIGN KEY ("merchant_id") REFERENCES "public"."merchants"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "reviews" ADD CONSTRAINT "reviews_driver_id_drivers_id_fk" FOREIGN KEY ("driver_id") REFERENCES "public"."drivers"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "orders_customer_idx" ON "orders" USING btree ("customer_id");
  CREATE INDEX "orders_merchant_idx" ON "orders" USING btree ("merchant_id");
  CREATE INDEX "orders_updated_at_idx" ON "orders" USING btree ("updated_at");
  CREATE INDEX "orders_created_at_idx" ON "orders" USING btree ("created_at");
  CREATE INDEX "order_items_order_idx" ON "order_items" USING btree ("order_id");
  CREATE INDEX "order_items_product_idx" ON "order_items" USING btree ("product_id");
  CREATE INDEX "order_items_merchant_product_idx" ON "order_items" USING btree ("merchant_product_id");
  CREATE INDEX "order_items_updated_at_idx" ON "order_items" USING btree ("updated_at");
  CREATE INDEX "order_items_created_at_idx" ON "order_items" USING btree ("created_at");
  CREATE UNIQUE INDEX "delivery_locations_order_idx" ON "delivery_locations" USING btree ("order_id");
  CREATE INDEX "delivery_locations_updated_at_idx" ON "delivery_locations" USING btree ("updated_at");
  CREATE INDEX "delivery_locations_created_at_idx" ON "delivery_locations" USING btree ("created_at");
  CREATE INDEX "transactions_order_idx" ON "transactions" USING btree ("order_id");
  CREATE INDEX "transactions_updated_at_idx" ON "transactions" USING btree ("updated_at");
  CREATE INDEX "transactions_created_at_idx" ON "transactions" USING btree ("created_at");
  CREATE INDEX "order_tracking_order_idx" ON "order_tracking" USING btree ("order_id");
  CREATE INDEX "order_tracking_actor_idx" ON "order_tracking" USING btree ("actor_id");
  CREATE INDEX "order_tracking_updated_at_idx" ON "order_tracking" USING btree ("updated_at");
  CREATE INDEX "order_tracking_created_at_idx" ON "order_tracking" USING btree ("created_at");
  CREATE INDEX "rider_assignments_order_idx" ON "rider_assignments" USING btree ("order_id");
  CREATE INDEX "rider_assignments_driver_idx" ON "rider_assignments" USING btree ("driver_id");
  CREATE INDEX "rider_assignments_updated_at_idx" ON "rider_assignments" USING btree ("updated_at");
  CREATE INDEX "rider_assignments_created_at_idx" ON "rider_assignments" USING btree ("created_at");
  CREATE INDEX "order_discounts_order_idx" ON "order_discounts" USING btree ("order_id");
  CREATE INDEX "order_discounts_updated_at_idx" ON "order_discounts" USING btree ("updated_at");
  CREATE INDEX "order_discounts_created_at_idx" ON "order_discounts" USING btree ("created_at");
  CREATE INDEX "reviews_order_idx" ON "reviews" USING btree ("order_id");
  CREATE INDEX "reviews_customer_idx" ON "reviews" USING btree ("customer_id");
  CREATE INDEX "reviews_merchant_idx" ON "reviews" USING btree ("merchant_id");
  CREATE INDEX "reviews_driver_idx" ON "reviews" USING btree ("driver_id");
  CREATE INDEX "reviews_updated_at_idx" ON "reviews" USING btree ("updated_at");
  CREATE INDEX "reviews_created_at_idx" ON "reviews" USING btree ("created_at");
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_orders_fk" FOREIGN KEY ("orders_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_order_items_fk" FOREIGN KEY ("order_items_id") REFERENCES "public"."order_items"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_delivery_locations_fk" FOREIGN KEY ("delivery_locations_id") REFERENCES "public"."delivery_locations"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_transactions_fk" FOREIGN KEY ("transactions_id") REFERENCES "public"."transactions"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_order_tracking_fk" FOREIGN KEY ("order_tracking_id") REFERENCES "public"."order_tracking"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_rider_assignments_fk" FOREIGN KEY ("rider_assignments_id") REFERENCES "public"."rider_assignments"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_order_discounts_fk" FOREIGN KEY ("order_discounts_id") REFERENCES "public"."order_discounts"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_reviews_fk" FOREIGN KEY ("reviews_id") REFERENCES "public"."reviews"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "payload_locked_documents_rels_orders_id_idx" ON "payload_locked_documents_rels" USING btree ("orders_id");
  CREATE INDEX "payload_locked_documents_rels_order_items_id_idx" ON "payload_locked_documents_rels" USING btree ("order_items_id");
  CREATE INDEX "payload_locked_documents_rels_delivery_locations_id_idx" ON "payload_locked_documents_rels" USING btree ("delivery_locations_id");
  CREATE INDEX "payload_locked_documents_rels_transactions_id_idx" ON "payload_locked_documents_rels" USING btree ("transactions_id");
  CREATE INDEX "payload_locked_documents_rels_order_tracking_id_idx" ON "payload_locked_documents_rels" USING btree ("order_tracking_id");
  CREATE INDEX "payload_locked_documents_rels_rider_assignments_id_idx" ON "payload_locked_documents_rels" USING btree ("rider_assignments_id");
  CREATE INDEX "payload_locked_documents_rels_order_discounts_id_idx" ON "payload_locked_documents_rels" USING btree ("order_discounts_id");
  CREATE INDEX "payload_locked_documents_rels_reviews_id_idx" ON "payload_locked_documents_rels" USING btree ("reviews_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "orders" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "order_items" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "delivery_locations" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "transactions" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "order_tracking" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "rider_assignments" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "order_discounts" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "reviews" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "orders" CASCADE;
  DROP TABLE "order_items" CASCADE;
  DROP TABLE "delivery_locations" CASCADE;
  DROP TABLE "transactions" CASCADE;
  DROP TABLE "order_tracking" CASCADE;
  DROP TABLE "rider_assignments" CASCADE;
  DROP TABLE "order_discounts" CASCADE;
  DROP TABLE "reviews" CASCADE;
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_orders_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_order_items_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_delivery_locations_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_transactions_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_order_tracking_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_rider_assignments_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_order_discounts_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_reviews_fk";
  
  DROP INDEX "payload_locked_documents_rels_orders_id_idx";
  DROP INDEX "payload_locked_documents_rels_order_items_id_idx";
  DROP INDEX "payload_locked_documents_rels_delivery_locations_id_idx";
  DROP INDEX "payload_locked_documents_rels_transactions_id_idx";
  DROP INDEX "payload_locked_documents_rels_order_tracking_id_idx";
  DROP INDEX "payload_locked_documents_rels_rider_assignments_id_idx";
  DROP INDEX "payload_locked_documents_rels_order_discounts_id_idx";
  DROP INDEX "payload_locked_documents_rels_reviews_id_idx";
  ALTER TABLE "wishlists" ALTER COLUMN "item_type" DROP DEFAULT;
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "orders_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "order_items_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "delivery_locations_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "transactions_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "order_tracking_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "rider_assignments_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "order_discounts_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "reviews_id";
  DROP TYPE "public"."enum_orders_status";
  DROP TYPE "public"."enum_orders_fulfillment_type";
  DROP TYPE "public"."enum_delivery_locations_label";
  DROP TYPE "public"."enum_transactions_status";
  DROP TYPE "public"."enum_order_tracking_status";
  DROP TYPE "public"."enum_rider_assignments_status";
  DROP TYPE "public"."enum_order_discounts_type";`)
}
