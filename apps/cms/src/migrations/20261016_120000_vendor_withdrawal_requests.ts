import { MigrateDownArgs, MigrateUpArgs, sql } from '@payloadcms/db-postgres'
import {
  clearMigrationSchemaState,
  migrationSchemaPreexisted,
  reconcileMigrationSchema,
  recordMigrationSchemaApplied,
} from '../utils/migrationReconciliation'

const migrationName = '20261016_120000_vendor_withdrawal_requests'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  const schemaPreexisted = await reconcileMigrationSchema(db, migrationName, async () => {
    const { rows } = await db.execute(sql`
      SELECT
        bool_and("present") AS "complete",
        bool_or("present") AS "partial"
      FROM (VALUES
        (EXISTS (
          SELECT 1 FROM pg_type WHERE typname = 'enum_vendor_withdrawal_requests_status'
        )),
        (EXISTS (
          SELECT 1 FROM information_schema.tables
          WHERE table_schema = 'public' AND table_name = 'vendor_withdrawal_requests'
        )),
        (EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_schema = 'public' AND table_name = 'vendor_withdrawal_requests'
            AND column_name = 'vendor_id'
        )),
        (EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_schema = 'public' AND table_name = 'vendor_withdrawal_requests'
            AND column_name = 'requested_by_id'
        )),
        (EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_schema = 'public' AND table_name = 'payload_locked_documents_rels'
            AND column_name = 'vendor_withdrawal_requests_id'
        )),
        (EXISTS (
          SELECT 1 FROM pg_constraint
          WHERE conname = 'payload_locked_documents_rels_vendor_withdrawal_requests_fk'
        )),
        (EXISTS (
          SELECT 1 FROM pg_indexes WHERE schemaname = 'public'
            AND indexname = 'vendor_createdAt_idx' AND tablename = 'vendor_withdrawal_requests'
        )),
        (EXISTS (
          SELECT 1 FROM pg_indexes WHERE schemaname = 'public'
            AND indexname = 'vendor_createdAt_1_idx' AND tablename = 'membership_audit_log'
        )),
        (EXISTS (
          SELECT 1 FROM pg_indexes WHERE schemaname = 'public'
            AND indexname = 'vendor_idempotency_key_idx' AND tablename = 'vendor_withdrawal_requests'
        )),
        (EXISTS (
          SELECT 1 FROM pg_indexes WHERE schemaname = 'public'
            AND indexname = 'status_createdAt_idx' AND tablename = 'vendor_withdrawal_requests'
        )),
        (EXISTS (
          SELECT 1 FROM pg_indexes WHERE schemaname = 'public'
            AND indexname = 'payload_locked_documents_rels_vendor_withdrawal_requests_id_idx'
        ))
      ) AS expected("present")
    `)
    return {
      complete: rows[0]?.complete === true,
      partial: rows[0]?.partial === true,
    }
  })
  if (schemaPreexisted) return

  await db.execute(sql`
    CREATE TYPE "public"."enum_vendor_withdrawal_requests_status"
      AS ENUM ('pending', 'approved', 'paid', 'rejected', 'cancelled');
    CREATE TABLE "vendor_withdrawal_requests" (
      "id" serial PRIMARY KEY NOT NULL,
      "vendor_id" integer NOT NULL,
      "amount" numeric NOT NULL,
      "currency" varchar DEFAULT 'PHP' NOT NULL,
      "status" "enum_vendor_withdrawal_requests_status" DEFAULT 'pending' NOT NULL,
      "payout_destination" varchar NOT NULL,
      "payment_reference" varchar,
      "reason" varchar,
      "idempotency_key" varchar,
      "requested_by_id" integer NOT NULL,
      "requested_at" timestamp(3) with time zone NOT NULL,
      "decided_by_id" integer,
      "decided_at" timestamp(3) with time zone,
      "paid_by_id" integer,
      "paid_at" timestamp(3) with time zone,
      "cancelled_by_id" integer,
      "cancelled_at" timestamp(3) with time zone,
      "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
      "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
      CONSTRAINT "vendor_withdrawal_requests_amount_min_check" CHECK ("amount" >= 1),
      CONSTRAINT "vendor_withdrawal_requests_currency_check" CHECK ("currency" = 'PHP')
    );
    ALTER TABLE "vendor_withdrawal_requests"
      ADD CONSTRAINT "vendor_withdrawal_requests_vendor_id_vendors_id_fk"
      FOREIGN KEY ("vendor_id") REFERENCES "public"."vendors"("id") ON DELETE restrict ON UPDATE no action,
      ADD CONSTRAINT "vendor_withdrawal_requests_requested_by_id_users_id_fk"
      FOREIGN KEY ("requested_by_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action,
      ADD CONSTRAINT "vendor_withdrawal_requests_decided_by_id_users_id_fk"
      FOREIGN KEY ("decided_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action,
      ADD CONSTRAINT "vendor_withdrawal_requests_paid_by_id_users_id_fk"
      FOREIGN KEY ("paid_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action,
      ADD CONSTRAINT "vendor_withdrawal_requests_cancelled_by_id_users_id_fk"
      FOREIGN KEY ("cancelled_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
    CREATE INDEX "vendor_withdrawal_requests_vendor_idx" ON "vendor_withdrawal_requests" USING btree ("vendor_id");
    CREATE UNIQUE INDEX "vendor_withdrawal_requests_vendor_idempotency_idx"
      ON "vendor_withdrawal_requests" USING btree ("vendor_id", "idempotency_key");
    CREATE INDEX "vendor_withdrawal_requests_status_idx"
      ON "vendor_withdrawal_requests" USING btree ("status");
    CREATE INDEX "vendor_withdrawal_requests_requested_by_idx"
      ON "vendor_withdrawal_requests" USING btree ("requested_by_id");
    CREATE INDEX "vendor_withdrawal_requests_decided_by_idx"
      ON "vendor_withdrawal_requests" USING btree ("decided_by_id");
    CREATE INDEX "vendor_withdrawal_requests_paid_by_idx"
      ON "vendor_withdrawal_requests" USING btree ("paid_by_id");
    CREATE INDEX "vendor_withdrawal_requests_cancelled_by_idx"
      ON "vendor_withdrawal_requests" USING btree ("cancelled_by_id");
    CREATE INDEX "vendor_withdrawal_requests_updated_at_idx"
      ON "vendor_withdrawal_requests" USING btree ("updated_at");
    CREATE INDEX "vendor_withdrawal_requests_created_at_idx"
      ON "vendor_withdrawal_requests" USING btree ("created_at");
    DO $$
    BEGIN
      IF to_regclass('public.vendor_createdAt_1_idx') IS NULL
        AND to_regclass('public.vendor_createdAt_idx') IS NOT NULL THEN
        ALTER INDEX "vendor_createdAt_idx" RENAME TO "vendor_createdAt_1_idx";
      END IF;
    END
    $$;
    CREATE INDEX "vendor_createdAt_idx"
      ON "vendor_withdrawal_requests" USING btree ("vendor_id", "created_at");
    CREATE INDEX "status_createdAt_idx"
      ON "vendor_withdrawal_requests" USING btree ("status", "created_at");
    CREATE UNIQUE INDEX "vendor_idempotency_key_idx"
      ON "vendor_withdrawal_requests" USING btree ("vendor_id", "idempotency_key");
    ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "vendor_withdrawal_requests_id" integer;
    ALTER TABLE "payload_locked_documents_rels"
      ADD CONSTRAINT "payload_locked_documents_rels_vendor_withdrawal_requests_fk"
      FOREIGN KEY ("vendor_withdrawal_requests_id") REFERENCES "public"."vendor_withdrawal_requests"("id")
      ON DELETE cascade ON UPDATE no action;
    CREATE INDEX "payload_locked_documents_rels_vendor_withdrawal_requests_id_idx"
      ON "payload_locked_documents_rels" USING btree ("vendor_withdrawal_requests_id");
  `)
  await recordMigrationSchemaApplied(db, migrationName)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  if (await migrationSchemaPreexisted(db, migrationName)) {
    await clearMigrationSchemaState(db, migrationName)
    return
  }

  await db.execute(sql`
    DO $$
    BEGIN
      IF EXISTS (SELECT 1 FROM "vendor_withdrawal_requests" WHERE "status" = 'paid') THEN
        RAISE EXCEPTION 'Cannot roll back vendor withdrawal requests after a payment has been recorded.';
      END IF;
    END
    $$;
    ALTER TABLE "payload_locked_documents_rels"
      DROP CONSTRAINT "payload_locked_documents_rels_vendor_withdrawal_requests_fk";
    DROP INDEX "payload_locked_documents_rels_vendor_withdrawal_requests_id_idx";
    ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "vendor_withdrawal_requests_id";
    DROP TABLE "vendor_withdrawal_requests";
    DROP TYPE "public"."enum_vendor_withdrawal_requests_status";
    DROP INDEX IF EXISTS "vendor_createdAt_1_idx";
    CREATE INDEX "vendor_createdAt_idx"
      ON "membership_audit_log" USING btree ("vendor_id", "created_at");
  `)
  await clearMigrationSchemaState(db, migrationName)
}
