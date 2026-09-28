import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_coupon_claims_status" AS ENUM('claimed', 'used', 'cancelled');
  CREATE TABLE "coupon_claims" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"coupon_id" integer NOT NULL,
  	"customer_id" integer NOT NULL,
  	"status" "enum_coupon_claims_status" DEFAULT 'claimed' NOT NULL,
  	"claimed_at" timestamp(3) with time zone,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  DROP INDEX "coupon_customer_idx";
  ALTER TABLE "coupons" ADD COLUMN "title" varchar;
  ALTER TABLE "coupons" ADD COLUMN "short_copy" varchar;
  ALTER TABLE "coupons" ADD COLUMN "image_id" integer;
  ALTER TABLE "coupons" ADD COLUMN "priority" numeric DEFAULT 0;
  ALTER TABLE "coupons" ADD COLUMN "featured" boolean DEFAULT false;
  ALTER TABLE "coupons" ADD COLUMN "claimable" boolean DEFAULT true;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "coupon_claims_id" integer;
  ALTER TABLE "coupon_claims" ADD CONSTRAINT "coupon_claims_coupon_id_coupons_id_fk" FOREIGN KEY ("coupon_id") REFERENCES "public"."coupons"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "coupon_claims" ADD CONSTRAINT "coupon_claims_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "coupon_claims_coupon_idx" ON "coupon_claims" USING btree ("coupon_id");
  CREATE INDEX "coupon_claims_customer_idx" ON "coupon_claims" USING btree ("customer_id");
  CREATE INDEX "coupon_claims_updated_at_idx" ON "coupon_claims" USING btree ("updated_at");
  CREATE INDEX "coupon_claims_created_at_idx" ON "coupon_claims" USING btree ("created_at");
  CREATE UNIQUE INDEX "coupon_customer_idx" ON "coupon_claims" USING btree ("coupon_id","customer_id");
  CREATE INDEX "customer_status_idx" ON "coupon_claims" USING btree ("customer_id","status");
  CREATE INDEX "coupon_1_idx" ON "coupon_claims" USING btree ("coupon_id");
  CREATE INDEX "status_4_idx" ON "coupon_claims" USING btree ("status");
  ALTER TABLE "coupons" ADD CONSTRAINT "coupons_image_id_media_id_fk" FOREIGN KEY ("image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_coupon_claims_fk" FOREIGN KEY ("coupon_claims_id") REFERENCES "public"."coupon_claims"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "coupons_image_idx" ON "coupons" USING btree ("image_id");
  CREATE INDEX "coupon_customer_1_idx" ON "coupon_redemptions" USING btree ("coupon_id","customer_id");
  CREATE INDEX "payload_locked_documents_rels_coupon_claims_id_idx" ON "payload_locked_documents_rels" USING btree ("coupon_claims_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "coupon_claims" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "coupon_claims" CASCADE;
  ALTER TABLE "coupons" DROP CONSTRAINT "coupons_image_id_media_id_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_coupon_claims_fk";
  
  DROP INDEX "coupons_image_idx";
  DROP INDEX "coupon_customer_1_idx";
  DROP INDEX "payload_locked_documents_rels_coupon_claims_id_idx";
  CREATE INDEX "coupon_customer_idx" ON "coupon_redemptions" USING btree ("coupon_id","customer_id");
  ALTER TABLE "coupons" DROP COLUMN "title";
  ALTER TABLE "coupons" DROP COLUMN "short_copy";
  ALTER TABLE "coupons" DROP COLUMN "image_id";
  ALTER TABLE "coupons" DROP COLUMN "priority";
  ALTER TABLE "coupons" DROP COLUMN "featured";
  ALTER TABLE "coupons" DROP COLUMN "claimable";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "coupon_claims_id";
  DROP TYPE "public"."enum_coupon_claims_status";`)
}
