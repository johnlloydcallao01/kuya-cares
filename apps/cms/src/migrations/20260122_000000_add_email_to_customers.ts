import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "customers" ADD COLUMN "email" varchar;
    UPDATE "customers"
    SET "email" = "users"."email"
    FROM "users"
    WHERE "customers"."user_id" = "users"."id";
  `)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "customers" DROP COLUMN "email";
  `)
}
