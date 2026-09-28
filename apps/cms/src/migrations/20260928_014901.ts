import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   DROP INDEX "user_3_idx";
  DROP INDEX "user_4_idx";
  DROP INDEX "user_createdAt_idx";
  CREATE INDEX "user_3_idx" ON "user_events" USING btree ("user_id");
  CREATE INDEX "user_createdAt_idx" ON "user_events" USING btree ("user_id","created_at");
  CREATE INDEX "user_4_idx" ON "addresses" USING btree ("user_id");
  CREATE INDEX "user_5_idx" ON "drivers" USING btree ("user_id");
  CREATE INDEX "user_createdAt_1_idx" ON "wishlists" USING btree ("user_id","created_at");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DROP INDEX "user_3_idx";
  DROP INDEX "user_createdAt_idx";
  DROP INDEX "user_4_idx";
  DROP INDEX "user_5_idx";
  DROP INDEX "user_createdAt_1_idx";
  CREATE INDEX "user_3_idx" ON "addresses" USING btree ("user_id");
  CREATE INDEX "user_4_idx" ON "drivers" USING btree ("user_id");
  CREATE INDEX "user_createdAt_idx" ON "wishlists" USING btree ("user_id","created_at");`)
}
