import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TYPE "public"."enum_orders_commission_status" ADD VALUE 'partially_refunded' BEFORE 'reversed';
  ALTER TYPE "public"."enum_orders_commission_status" ADD VALUE 'legacy';
  ALTER TYPE "public"."enum_transactions_status" ADD VALUE 'partially_refunded' BEFORE 'refunded';
  DROP INDEX "idempotency_key_1_idx";
  ALTER TABLE "transactions" ADD COLUMN "payment_id" varchar;
  ALTER TABLE "transactions" ADD COLUMN "refunded_amount" numeric DEFAULT 0;
  ALTER TABLE "transactions" ADD COLUMN "last_refund_id" varchar;
  ALTER TABLE "transactions" ADD COLUMN "refund_event_amount" numeric;
  ALTER TABLE "vendor_commission_entries" ADD COLUMN "provider_refund_id" varchar;
  ALTER TABLE "vendor_commission_entries" ADD COLUMN "refund_amount" numeric;
  CREATE INDEX "transactions_payment_id_idx" ON "transactions" USING btree ("payment_id");
  CREATE INDEX "vendor_commission_entries_provider_refund_id_idx" ON "vendor_commission_entries" USING btree ("provider_refund_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DO $$ BEGIN
    IF EXISTS (
      SELECT 1 FROM "vendor_commission_entries"
      WHERE "provider_refund_id" IS NOT NULL
    ) THEN
      RAISE EXCEPTION 'Refusing to remove recorded provider refund details during rollback';
    END IF;
    IF EXISTS (SELECT 1 FROM "transactions" WHERE "status" = 'partially_refunded') THEN
      RAISE EXCEPTION 'Refusing to remove partially-refunded transaction statuses during rollback';
    END IF;
    IF EXISTS (SELECT 1 FROM "orders" WHERE "commission_status" = 'legacy') THEN
      RAISE EXCEPTION 'Refusing to remove legacy commission statuses during rollback';
    END IF;
   END $$;
   ALTER TABLE "orders" ALTER COLUMN "commission_status" SET DATA TYPE text;
  ALTER TABLE "orders" ALTER COLUMN "commission_status" SET DEFAULT 'pending'::text;
  DROP TYPE "public"."enum_orders_commission_status";
  CREATE TYPE "public"."enum_orders_commission_status" AS ENUM('pending', 'accrued', 'reversed');
  ALTER TABLE "orders" ALTER COLUMN "commission_status" SET DEFAULT 'pending'::"public"."enum_orders_commission_status";
  ALTER TABLE "orders" ALTER COLUMN "commission_status" SET DATA TYPE "public"."enum_orders_commission_status" USING "commission_status"::"public"."enum_orders_commission_status";
  ALTER TABLE "transactions" ALTER COLUMN "status" SET DATA TYPE text;
  ALTER TABLE "transactions" ALTER COLUMN "status" SET DEFAULT 'pending'::text;
  DROP TYPE "public"."enum_transactions_status";
  CREATE TYPE "public"."enum_transactions_status" AS ENUM('pending', 'paid', 'failed', 'refunded');
  ALTER TABLE "transactions" ALTER COLUMN "status" SET DEFAULT 'pending'::"public"."enum_transactions_status";
  ALTER TABLE "transactions" ALTER COLUMN "status" SET DATA TYPE "public"."enum_transactions_status" USING "status"::"public"."enum_transactions_status";
  DROP INDEX "transactions_payment_id_idx";
  DROP INDEX "vendor_commission_entries_provider_refund_id_idx";
  CREATE UNIQUE INDEX "idempotency_key_1_idx" ON "vendor_commission_entries" USING btree ("idempotency_key");
  ALTER TABLE "transactions" DROP COLUMN "payment_id";
  ALTER TABLE "transactions" DROP COLUMN "refunded_amount";
  ALTER TABLE "transactions" DROP COLUMN "last_refund_id";
  ALTER TABLE "transactions" DROP COLUMN "refund_event_amount";
  ALTER TABLE "vendor_commission_entries" DROP COLUMN "provider_refund_id";
  ALTER TABLE "vendor_commission_entries" DROP COLUMN "refund_amount";`)
}
