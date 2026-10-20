import type { MigrateDownArgs, MigrateUpArgs } from '@payloadcms/db-postgres'
import { sql } from '@payloadcms/db-postgres'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "payload_locked_documents_rels"
      ADD COLUMN "seller_shipping_zones_id" integer;
    ALTER TABLE "payload_locked_documents_rels"
      ADD CONSTRAINT "payload_locked_documents_rels_seller_shipping_zones_fk"
      FOREIGN KEY ("seller_shipping_zones_id")
      REFERENCES "public"."seller_shipping_zones"("id")
      ON DELETE cascade ON UPDATE no action;
    CREATE INDEX "payload_locked_documents_rels_seller_shipping_zones_id_idx"
      ON "payload_locked_documents_rels" USING btree ("seller_shipping_zones_id");
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "payload_locked_documents_rels"
      DROP CONSTRAINT "payload_locked_documents_rels_seller_shipping_zones_fk";
    DROP INDEX "payload_locked_documents_rels_seller_shipping_zones_id_idx";
    ALTER TABLE "payload_locked_documents_rels"
      DROP COLUMN "seller_shipping_zones_id";
  `)
}
