import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_wishlists_item_type" AS ENUM('merchant', 'merchantProduct');
  ALTER TABLE "wishlists" ALTER COLUMN "merchant_id" DROP NOT NULL;
  ALTER TABLE "wishlists" ADD COLUMN "item_type" "enum_wishlists_item_type" NOT NULL DEFAULT 'merchant';
  ALTER TABLE "wishlists" ADD COLUMN "merchant_product_id" integer;
  UPDATE "wishlists" SET "item_type" = 'merchant' WHERE "item_type" IS NULL;
  ALTER TABLE "wishlists" ALTER COLUMN "item_type" DROP DEFAULT;
  ALTER TABLE "wishlists" ADD CONSTRAINT "wishlists_merchant_product_id_merchant_products_id_fk" FOREIGN KEY ("merchant_product_id") REFERENCES "public"."merchant_products"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "wishlists_merchant_product_idx" ON "wishlists" USING btree ("merchant_product_id");
  CREATE UNIQUE INDEX "user_merchantProduct_idx" ON "wishlists" USING btree ("user_id","merchant_product_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "wishlists" DROP CONSTRAINT "wishlists_merchant_product_id_merchant_products_id_fk";
  
  DROP INDEX "wishlists_merchant_product_idx";
  DROP INDEX "user_merchantProduct_idx";
  ALTER TABLE "wishlists" ALTER COLUMN "merchant_id" SET NOT NULL;
  ALTER TABLE "wishlists" DROP COLUMN "item_type";
  ALTER TABLE "wishlists" DROP COLUMN "merchant_product_id";
  DROP TYPE "public"."enum_wishlists_item_type";`)
}
