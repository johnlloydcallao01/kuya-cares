import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_wallets_status" AS ENUM('active', 'frozen', 'closed');
  CREATE TYPE "public"."enum_wallet_transactions_type" AS ENUM('topup', 'payment', 'refund', 'cashback', 'withdrawal', 'adjustment', 'expiry');
  CREATE TYPE "public"."enum_wallet_transactions_status" AS ENUM('pending', 'posted', 'failed', 'reversed');
  CREATE TYPE "public"."enum_wallet_topups_status" AS ENUM('pending', 'paid', 'failed', 'cancelled');
  CREATE TABLE "wallets" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"customer_id" integer NOT NULL,
  	"balance" numeric DEFAULT 0 NOT NULL,
  	"currency" varchar DEFAULT 'PHP',
  	"status" "enum_wallets_status" DEFAULT 'active' NOT NULL,
  	"total_topped_up" numeric DEFAULT 0 NOT NULL,
  	"total_spent" numeric DEFAULT 0 NOT NULL,
  	"total_cashback" numeric DEFAULT 0 NOT NULL,
  	"total_refunded" numeric DEFAULT 0 NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "wallet_transactions" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"wallet_id" integer NOT NULL,
  	"customer_id" integer NOT NULL,
  	"type" "enum_wallet_transactions_type" NOT NULL,
  	"amount" numeric NOT NULL,
  	"balance_after" numeric NOT NULL,
  	"order_id" integer,
  	"payment_intent_id" varchar,
  	"gateway" varchar DEFAULT 'paymongo',
  	"idempotency_key" varchar NOT NULL,
  	"status" "enum_wallet_transactions_status" DEFAULT 'posted' NOT NULL,
  	"expires_at" timestamp(3) with time zone,
  	"meta" jsonb,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "wallet_topups" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"wallet_id" integer NOT NULL,
  	"customer_id" integer NOT NULL,
  	"amount" numeric NOT NULL,
  	"currency" varchar DEFAULT 'PHP',
  	"gateway" varchar DEFAULT 'paymongo',
  	"payment_intent_id" varchar,
  	"status" "enum_wallet_topups_status" DEFAULT 'pending' NOT NULL,
  	"paid_at" timestamp(3) with time zone,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  DROP INDEX "order_idx";
  DROP INDEX "customer_idx";
  ALTER TABLE "orders" ADD COLUMN "wallet_amount_used" numeric DEFAULT 0 NOT NULL;
  ALTER TABLE "orders" ADD COLUMN "paid_with_wallet" boolean DEFAULT false;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "wallets_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "wallet_transactions_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "wallet_topups_id" integer;
  ALTER TABLE "wallets" ADD CONSTRAINT "wallets_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "wallet_transactions" ADD CONSTRAINT "wallet_transactions_wallet_id_wallets_id_fk" FOREIGN KEY ("wallet_id") REFERENCES "public"."wallets"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "wallet_transactions" ADD CONSTRAINT "wallet_transactions_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "wallet_transactions" ADD CONSTRAINT "wallet_transactions_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "wallet_topups" ADD CONSTRAINT "wallet_topups_wallet_id_wallets_id_fk" FOREIGN KEY ("wallet_id") REFERENCES "public"."wallets"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "wallet_topups" ADD CONSTRAINT "wallet_topups_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE set null ON UPDATE no action;
  CREATE UNIQUE INDEX "wallets_customer_idx" ON "wallets" USING btree ("customer_id");
  CREATE INDEX "wallets_updated_at_idx" ON "wallets" USING btree ("updated_at");
  CREATE INDEX "wallets_created_at_idx" ON "wallets" USING btree ("created_at");
  CREATE UNIQUE INDEX "customer_idx" ON "wallets" USING btree ("customer_id");
  CREATE INDEX "status_1_idx" ON "wallets" USING btree ("status");
  CREATE INDEX "wallet_transactions_wallet_idx" ON "wallet_transactions" USING btree ("wallet_id");
  CREATE INDEX "wallet_transactions_customer_idx" ON "wallet_transactions" USING btree ("customer_id");
  CREATE INDEX "wallet_transactions_order_idx" ON "wallet_transactions" USING btree ("order_id");
  CREATE INDEX "wallet_transactions_updated_at_idx" ON "wallet_transactions" USING btree ("updated_at");
  CREATE INDEX "wallet_transactions_created_at_idx" ON "wallet_transactions" USING btree ("created_at");
  CREATE UNIQUE INDEX "idempotency_key_idx" ON "wallet_transactions" USING btree ("idempotency_key");
  CREATE INDEX "wallet_idx" ON "wallet_transactions" USING btree ("wallet_id");
  CREATE INDEX "customer_1_idx" ON "wallet_transactions" USING btree ("customer_id");
  CREATE INDEX "customer_type_idx" ON "wallet_transactions" USING btree ("customer_id","type");
  CREATE INDEX "order_idx" ON "wallet_transactions" USING btree ("order_id");
  CREATE INDEX "status_2_idx" ON "wallet_transactions" USING btree ("status");
  CREATE INDEX "expires_at_idx" ON "wallet_transactions" USING btree ("expires_at");
  CREATE INDEX "wallet_topups_wallet_idx" ON "wallet_topups" USING btree ("wallet_id");
  CREATE INDEX "wallet_topups_customer_idx" ON "wallet_topups" USING btree ("customer_id");
  CREATE INDEX "wallet_topups_updated_at_idx" ON "wallet_topups" USING btree ("updated_at");
  CREATE INDEX "wallet_topups_created_at_idx" ON "wallet_topups" USING btree ("created_at");
  CREATE UNIQUE INDEX "payment_intent_id_idx" ON "wallet_topups" USING btree ("payment_intent_id");
  CREATE INDEX "customer_2_idx" ON "wallet_topups" USING btree ("customer_id");
  CREATE INDEX "wallet_1_idx" ON "wallet_topups" USING btree ("wallet_id");
  CREATE INDEX "status_3_idx" ON "wallet_topups" USING btree ("status");
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_wallets_fk" FOREIGN KEY ("wallets_id") REFERENCES "public"."wallets"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_wallet_transactions_fk" FOREIGN KEY ("wallet_transactions_id") REFERENCES "public"."wallet_transactions"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_wallet_topups_fk" FOREIGN KEY ("wallet_topups_id") REFERENCES "public"."wallet_topups"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "order_1_idx" ON "coupon_redemptions" USING btree ("order_id");
  CREATE INDEX "customer_3_idx" ON "coupon_redemptions" USING btree ("customer_id");
  CREATE INDEX "payload_locked_documents_rels_wallets_id_idx" ON "payload_locked_documents_rels" USING btree ("wallets_id");
  CREATE INDEX "payload_locked_documents_rels_wallet_transactions_id_idx" ON "payload_locked_documents_rels" USING btree ("wallet_transactions_id");
  CREATE INDEX "payload_locked_documents_rels_wallet_topups_id_idx" ON "payload_locked_documents_rels" USING btree ("wallet_topups_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "wallets" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "wallet_transactions" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "wallet_topups" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "wallets" CASCADE;
  DROP TABLE "wallet_transactions" CASCADE;
  DROP TABLE "wallet_topups" CASCADE;
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_wallets_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_wallet_transactions_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_wallet_topups_fk";
  
  DROP INDEX "order_1_idx";
  DROP INDEX "customer_3_idx";
  DROP INDEX "payload_locked_documents_rels_wallets_id_idx";
  DROP INDEX "payload_locked_documents_rels_wallet_transactions_id_idx";
  DROP INDEX "payload_locked_documents_rels_wallet_topups_id_idx";
  CREATE INDEX "order_idx" ON "coupon_redemptions" USING btree ("order_id");
  CREATE INDEX "customer_idx" ON "coupon_redemptions" USING btree ("customer_id");
  ALTER TABLE "orders" DROP COLUMN "wallet_amount_used";
  ALTER TABLE "orders" DROP COLUMN "paid_with_wallet";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "wallets_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "wallet_transactions_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "wallet_topups_id";
  DROP TYPE "public"."enum_wallets_status";
  DROP TYPE "public"."enum_wallet_transactions_type";
  DROP TYPE "public"."enum_wallet_transactions_status";
  DROP TYPE "public"."enum_wallet_topups_status";`)
}
