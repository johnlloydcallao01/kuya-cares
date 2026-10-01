import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "subscription_invoices" ADD COLUMN "paymongo_link_id" varchar;
  ALTER TABLE "subscription_invoices" ADD COLUMN "reference_number" varchar;
  CREATE INDEX "subscription_invoices_reference_number_idx" ON "subscription_invoices" USING btree ("reference_number");
  CREATE INDEX "reference_number_idx" ON "subscription_invoices" USING btree ("reference_number");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DROP INDEX "subscription_invoices_reference_number_idx";
  DROP INDEX "reference_number_idx";
  ALTER TABLE "subscription_invoices" DROP COLUMN "paymongo_link_id";
  ALTER TABLE "subscription_invoices" DROP COLUMN "reference_number";`)
}
