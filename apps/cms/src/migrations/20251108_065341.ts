import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload: _payload, req: _req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "vendors" DROP COLUMN "bank_account_name";
  ALTER TABLE "vendors" DROP COLUMN "bank_account_number";
  ALTER TABLE "vendors" DROP COLUMN "bank_name";`)
}

export async function down({ db, payload: _payload, req: _req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "vendors" ADD COLUMN "bank_account_name" varchar;
  ALTER TABLE "vendors" ADD COLUMN "bank_account_number" varchar;
  ALTER TABLE "vendors" ADD COLUMN "bank_name" varchar;`)
}
