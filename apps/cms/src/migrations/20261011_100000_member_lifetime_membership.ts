import { MigrateDownArgs, MigrateUpArgs, sql } from '@payloadcms/db-postgres'

/**
 * Adds the one-time lifetime fee flow for unified marketplace members.
 * Existing members are backfilled active to preserve access; new user rows
 * default to pending_payment until their one-time fee is confirmed.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "users"
      ADD COLUMN "member_membership_status" varchar DEFAULT 'pending_payment' NOT NULL,
      ADD COLUMN "member_membership_paid_at" timestamp(3) with time zone;
    UPDATE "users"
      SET "member_membership_status" = 'active'
      WHERE "role" = 'member';

    ALTER TABLE "system_settings"
      ADD COLUMN "membership_member_membership_fee_php" numeric DEFAULT 0;

    CREATE TABLE "member_membership_payments" (
      "id" serial PRIMARY KEY NOT NULL,
      "user_id" integer,
      "amount" numeric NOT NULL,
      "currency" varchar DEFAULT 'PHP' NOT NULL,
      "status" varchar DEFAULT 'pending' NOT NULL,
      "payment_provider" varchar DEFAULT 'paymongo' NOT NULL,
      "payment_reference" varchar NOT NULL,
      "provider_reference" varchar,
      "provider_client_key" varchar,
      "payment_link_id" varchar,
      "checkout_url" varchar,
      "member_membership_idempotency_key" varchar NOT NULL,
      "paid_at" timestamp(3) with time zone,
      "failure_reason" varchar,
      "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
      "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
      CONSTRAINT "member_membership_payments_user_id_users_id_fk"
        FOREIGN KEY ("user_id") REFERENCES "public"."users"("id")
        ON DELETE set null ON UPDATE no action
    );

    ALTER TABLE "payload_locked_documents_rels"
      ADD COLUMN "member_membership_payments_id" integer;
    ALTER TABLE "payload_locked_documents_rels"
      ADD CONSTRAINT "payload_locked_documents_rels_member_membership_payments_fk"
      FOREIGN KEY ("member_membership_payments_id")
      REFERENCES "public"."member_membership_payments"("id")
      ON DELETE cascade ON UPDATE no action;

    CREATE INDEX "member_membership_payments_user_idx"
      ON "member_membership_payments" USING btree ("user_id");
    CREATE INDEX "user_status_idx"
      ON "member_membership_payments" USING btree ("user_id", "status");
    CREATE UNIQUE INDEX "paymentReference_idx"
      ON "member_membership_payments" USING btree ("payment_reference");
    CREATE UNIQUE INDEX "providerReference_idx"
      ON "member_membership_payments" USING btree ("provider_reference");
    CREATE UNIQUE INDEX "memberMembershipIdempotencyKey_idx"
      ON "member_membership_payments" USING btree ("member_membership_idempotency_key");
    CREATE INDEX "member_membership_payments_updated_at_idx"
      ON "member_membership_payments" USING btree ("updated_at");
    CREATE INDEX "member_membership_payments_created_at_idx"
      ON "member_membership_payments" USING btree ("created_at");
    CREATE INDEX "payload_locked_documents_rels_member_membership_payments_id_idx"
      ON "payload_locked_documents_rels" USING btree ("member_membership_payments_id");
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "payload_locked_documents_rels"
      DROP CONSTRAINT "payload_locked_documents_rels_member_membership_payments_fk";
    DROP INDEX "payload_locked_documents_rels_member_membership_payments_id_idx";
    ALTER TABLE "payload_locked_documents_rels"
      DROP COLUMN "member_membership_payments_id";

    DROP INDEX "member_membership_payments_user_idx";
    DROP INDEX "user_status_idx";
    DROP INDEX "paymentReference_idx";
    DROP INDEX "providerReference_idx";
    DROP INDEX "memberMembershipIdempotencyKey_idx";
    DROP INDEX "member_membership_payments_updated_at_idx";
    DROP INDEX "member_membership_payments_created_at_idx";
    DROP TABLE "member_membership_payments";

    ALTER TABLE "system_settings"
      DROP COLUMN "membership_member_membership_fee_php";
    ALTER TABLE "users"
      DROP COLUMN "member_membership_paid_at",
      DROP COLUMN "member_membership_status";
  `)
}
