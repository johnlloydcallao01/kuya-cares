import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload: _payload, req: _req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_cart_items_product_size" AS ENUM('small', 'medium', 'large', 'extra_large');
  CREATE TABLE IF NOT EXISTS "cart_items" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"customer_id" integer NOT NULL,
  	"merchant_id" integer NOT NULL,
  	"product_id" integer NOT NULL,
  	"merchant_product_id" integer NOT NULL,
  	"quantity" integer DEFAULT 1 NOT NULL,
  	"price_at_add" numeric(10, 2) NOT NULL,
  	"compare_at_price" numeric(10, 2),
  	"subtotal" numeric(10, 2) NOT NULL,
  	"product_size" "public"."enum_cart_items_product_size",
  	"selected_variation_id" integer,
  	"selected_modifiers" jsonb,
  	"selected_addons" jsonb,
  	"special_instructions" text,
  	"notes_for_rider" text,
  	"item_hash" varchar(32),
  	"is_available" boolean DEFAULT true,
  	"unavailable_reason" varchar,
  	"expires_at" timestamp(3) with time zone NOT NULL,
  	"session_id" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  ALTER TABLE "cart_items" ADD CONSTRAINT "cart_items_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "cart_items" ADD CONSTRAINT "cart_items_merchant_id_merchants_id_fk" FOREIGN KEY ("merchant_id") REFERENCES "public"."merchants"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "cart_items" ADD CONSTRAINT "cart_items_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "cart_items" ADD CONSTRAINT "cart_items_merchant_product_id_merchant_products_id_fk" FOREIGN KEY ("merchant_product_id") REFERENCES "public"."merchant_products"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "cart_items" ADD CONSTRAINT "cart_items_selected_variation_id_products_id_fk" FOREIGN KEY ("selected_variation_id") REFERENCES "public"."products"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "payload_locked_documents_rels_cart_items_id_idx" ON "payload_locked_documents_rels" USING btree ("cart_items_id");`)
}

export async function down({ db, payload: _payload, req: _req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "cart_items" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "cart_items" CASCADE;
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_cart_items_fk";
  
  DROP INDEX "payload_locked_documents_rels_cart_items_id_idx";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "cart_items_id";
  DROP TYPE "public"."enum_cart_items_product_size";`)
}
