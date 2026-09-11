import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload: _payload, req: _req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TABLE "products_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"prod_categories_id" integer
  );
  
  ALTER TABLE "products" DROP CONSTRAINT "products_category_id_prod_categories_id_fk";
  
  DROP INDEX "products_category_idx";
  ALTER TABLE "products_rels" ADD CONSTRAINT "products_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "products_rels" ADD CONSTRAINT "products_rels_product_categories_fk" FOREIGN KEY ("prod_categories_id") REFERENCES "public"."prod_categories"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "products_rels_order_idx" ON "products_rels" USING btree ("order");
  CREATE INDEX "products_rels_parent_idx" ON "products_rels" USING btree ("parent_id");
  CREATE INDEX "products_rels_path_idx" ON "products_rels" USING btree ("path");
  CREATE INDEX "products_rels_prod_categories_id_idx" ON "products_rels" USING btree ("prod_categories_id");
  ALTER TABLE "products" DROP COLUMN "category_id";`)
}

export async function down({ db, payload: _payload, req: _req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "products_rels" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "products_rels" CASCADE;
  ALTER TABLE "products" ADD COLUMN "category_id" integer;
  ALTER TABLE "products" ADD CONSTRAINT "products_category_id_prod_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."prod_categories"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "products_category_idx" ON "products" USING btree ("category_id");`)
}
