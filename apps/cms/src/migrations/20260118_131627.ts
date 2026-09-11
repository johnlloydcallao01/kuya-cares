import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   SELECT 1;`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "recent_views" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "recent_views" CASCADE;
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_recent_views_fk";
  
  DROP INDEX "payload_locked_documents_rels_recent_views_id_idx";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "recent_views_id";
  DROP TYPE "public"."enum_recent_views_item_type";
  DROP TYPE "public"."enum_recent_views_source";`)
}
