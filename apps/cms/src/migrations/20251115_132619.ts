import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload: _payload, req: _req }: MigrateUpArgs): Promise<void> {
    await db.execute(sql`
      ALTER TABLE "users" DROP COLUMN IF EXISTS "reset_password_token";
      ALTER TABLE "users" DROP COLUMN IF EXISTS "reset_password_expiration";
    `)
}

export async function down({ db, payload: _payload, req: _req }: MigrateDownArgs): Promise<void> {
    await db.execute(sql`
      ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "reset_password_token" varchar;
      ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "reset_password_expiration" timestamp(3) with time zone;
    `)
}
