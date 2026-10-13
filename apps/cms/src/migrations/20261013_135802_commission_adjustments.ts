import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TYPE "public"."enum_vendor_commission_entries_entry_type" ADD VALUE 'adjustment';
  ALTER TABLE "vendor_commission_entries" ALTER COLUMN "order_id" DROP NOT NULL;
  ALTER TABLE "vendor_commission_entries" ALTER COLUMN "transaction_id" DROP NOT NULL;
  ALTER TABLE "vendor_commission_entries" ADD COLUMN "adjustment_reason" varchar;
  ALTER TABLE "vendor_commission_entries" ADD COLUMN "adjustment_actor_id" integer;
  ALTER TABLE "vendor_commission_entries" ADD CONSTRAINT "vendor_commission_entries_adjustment_actor_id_users_id_fk" FOREIGN KEY ("adjustment_actor_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "vendor_commission_entries_adjustment_actor_idx" ON "vendor_commission_entries" USING btree ("adjustment_actor_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DO $$
   BEGIN
     IF EXISTS (SELECT 1 FROM "vendor_commission_entries" WHERE "entry_type" = 'adjustment') THEN
       RAISE EXCEPTION 'Cannot roll back commission adjustments after immutable adjustment entries have been recorded.';
     END IF;
   END
   $$;

   ALTER TABLE "vendor_commission_entries" DROP CONSTRAINT "vendor_commission_entries_adjustment_actor_id_users_id_fk";
  
  ALTER TABLE "vendor_commission_entries" ALTER COLUMN "entry_type" SET DATA TYPE text;
  DROP TYPE "public"."enum_vendor_commission_entries_entry_type";
  CREATE TYPE "public"."enum_vendor_commission_entries_entry_type" AS ENUM('accrual', 'reversal');
  ALTER TABLE "vendor_commission_entries" ALTER COLUMN "entry_type" SET DATA TYPE "public"."enum_vendor_commission_entries_entry_type" USING "entry_type"::"public"."enum_vendor_commission_entries_entry_type";
  DROP INDEX "vendor_commission_entries_adjustment_actor_idx";
  ALTER TABLE "vendor_commission_entries" ALTER COLUMN "order_id" SET NOT NULL;
  ALTER TABLE "vendor_commission_entries" ALTER COLUMN "transaction_id" SET NOT NULL;
  ALTER TABLE "vendor_commission_entries" DROP COLUMN "adjustment_reason";
  ALTER TABLE "vendor_commission_entries" DROP COLUMN "adjustment_actor_id";`)
}
