import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_cart_items_status" AS ENUM('active', 'checked_out', 'ordered', 'abandoned', 'removed');
  ALTER TABLE "products" ALTER COLUMN "assign_to_all_vendor_merchants" SET DEFAULT true;
  ALTER TABLE "order_items" ALTER COLUMN "product_id" DROP NOT NULL;
  ALTER TABLE "order_items" ALTER COLUMN "merchant_product_id" DROP NOT NULL;
  ALTER TABLE "cart_items" ADD COLUMN "status" "enum_cart_items_status" DEFAULT 'active' NOT NULL;
  ALTER TABLE "cart_items" ADD COLUMN "order_id_id" integer;
  ALTER TABLE "cart_items" ADD COLUMN "ordered_at" timestamp(3) with time zone;
  ALTER TABLE "cart_items" ADD COLUMN "deleted_at" timestamp(3) with time zone;
  ALTER TABLE "cart_items" ADD CONSTRAINT "cart_items_order_id_id_orders_id_fk" FOREIGN KEY ("order_id_id") REFERENCES "public"."orders"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "cart_items_order_id_idx" ON "cart_items" USING btree ("order_id_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "cart_items" DROP CONSTRAINT "cart_items_order_id_id_orders_id_fk";
  
  DROP INDEX "cart_items_order_id_idx";
  ALTER TABLE "products" ALTER COLUMN "assign_to_all_vendor_merchants" SET DEFAULT false;
  ALTER TABLE "order_items" ALTER COLUMN "product_id" SET NOT NULL;
  ALTER TABLE "order_items" ALTER COLUMN "merchant_product_id" SET NOT NULL;
  ALTER TABLE "cart_items" DROP COLUMN "status";
  ALTER TABLE "cart_items" DROP COLUMN "order_id_id";
  ALTER TABLE "cart_items" DROP COLUMN "ordered_at";
  ALTER TABLE "cart_items" DROP COLUMN "deleted_at";
  DROP TYPE "public"."enum_cart_items_status";`)
}
