import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TABLE "merchants_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"merchant_categories_id" integer
  );
  
  CREATE TABLE "merchant_categories" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar NOT NULL,
  	"slug" varchar NOT NULL,
  	"description" varchar,
  	"display_order" numeric DEFAULT 0,
  	"is_active" boolean DEFAULT true,
  	"is_featured" boolean DEFAULT false,
  	"icon_id" integer,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "merchant_categories_id" integer;
  ALTER TABLE "merchants_rels" ADD CONSTRAINT "merchants_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."merchants"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "merchants_rels" ADD CONSTRAINT "merchants_rels_merchant_categories_fk" FOREIGN KEY ("merchant_categories_id") REFERENCES "public"."merchant_categories"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "merchant_categories" ADD CONSTRAINT "merchant_categories_icon_id_media_id_fk" FOREIGN KEY ("icon_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "merchants_rels_order_idx" ON "merchants_rels" USING btree ("order");
  CREATE INDEX "merchants_rels_parent_idx" ON "merchants_rels" USING btree ("parent_id");
  CREATE INDEX "merchants_rels_path_idx" ON "merchants_rels" USING btree ("path");
  CREATE INDEX "merchants_rels_merchant_categories_id_idx" ON "merchants_rels" USING btree ("merchant_categories_id");
  CREATE UNIQUE INDEX "merchant_categories_slug_idx" ON "merchant_categories" USING btree ("slug");
  CREATE INDEX "merchant_categories_icon_idx" ON "merchant_categories" USING btree ("icon_id");
  CREATE INDEX "merchant_categories_updated_at_idx" ON "merchant_categories" USING btree ("updated_at");
  CREATE INDEX "merchant_categories_created_at_idx" ON "merchant_categories" USING btree ("created_at");
  CREATE INDEX "slug_idx" ON "merchant_categories" USING btree ("slug");
  CREATE INDEX "isActive_isFeatured_idx" ON "merchant_categories" USING btree ("is_active","is_featured");
  CREATE INDEX "displayOrder_idx" ON "merchant_categories" USING btree ("display_order");
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_merchant_categories_fk" FOREIGN KEY ("merchant_categories_id") REFERENCES "public"."merchant_categories"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "payload_locked_documents_rels_merchant_categories_id_idx" ON "payload_locked_documents_rels" USING btree ("merchant_categories_id");`)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "merchants_rels" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "merchant_categories" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "merchants_rels" CASCADE;
  DROP TABLE "merchant_categories" CASCADE;
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_merchant_categories_fk";
  
  DROP INDEX "payload_locked_documents_rels_merchant_categories_id_idx";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "merchant_categories_id";`)
}
