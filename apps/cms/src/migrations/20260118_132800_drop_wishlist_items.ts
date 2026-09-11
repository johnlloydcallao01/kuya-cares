import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload: _payload, req: _req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "payload_locked_documents_rels" DROP COLUMN IF EXISTS "wishlist_items_id";
  DROP TABLE IF EXISTS "wishlist_items" CASCADE;
  DROP TYPE IF EXISTS "public"."enum_wishlist_items_item_type";
  DROP TYPE IF EXISTS "public"."enum_wishlist_items_source";`)
}

export async function down({ db, payload: _payload, req: _req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   SELECT 1;`)
}

