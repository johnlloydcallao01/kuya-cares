import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_orders_commission_source" AS ENUM('vendor', 'category', 'plan', 'global');
  CREATE TYPE "public"."enum_orders_commission_status" AS ENUM('pending', 'accrued', 'reversed');
  CREATE TYPE "public"."enum_vendor_commission_entries_entry_type" AS ENUM('accrual', 'reversal');
  CREATE TYPE "public"."enum_vendor_commission_entries_commission_source" AS ENUM('vendor', 'category', 'plan', 'global');
  CREATE TABLE "vendor_commission_entries" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"vendor_id" integer NOT NULL,
  	"order_id" integer NOT NULL,
  	"transaction_id" integer NOT NULL,
  	"entry_type" "enum_vendor_commission_entries_entry_type" NOT NULL,
  	"idempotency_key" varchar NOT NULL,
  	"currency" varchar DEFAULT 'PHP' NOT NULL,
  	"commission_percent" numeric NOT NULL,
  	"commission_base_amount" numeric NOT NULL,
  	"commission_vendor_discount" numeric NOT NULL,
  	"commission_amount" numeric NOT NULL,
  	"commission_transaction_fee" numeric NOT NULL,
  	"commission_vendor_net" numeric NOT NULL,
  	"commission_source" "enum_vendor_commission_entries_commission_source" NOT NULL,
  	"commission_rule_id" integer,
  	"effective_at" timestamp(3) with time zone NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  ALTER TABLE "commission_rules" DROP CONSTRAINT "commission_rules_category_id_prod_categories_id_fk";
  
  ALTER TABLE "orders" ADD COLUMN "commission_percent" numeric;
  ALTER TABLE "orders" ADD COLUMN "commission_base_amount" numeric;
  ALTER TABLE "orders" ADD COLUMN "commission_vendor_discount" numeric;
  ALTER TABLE "orders" ADD COLUMN "commission_amount" numeric;
  ALTER TABLE "orders" ADD COLUMN "commission_transaction_fee" numeric;
  ALTER TABLE "orders" ADD COLUMN "commission_vendor_net" numeric;
  ALTER TABLE "orders" ADD COLUMN "commission_source" "enum_orders_commission_source";
  ALTER TABLE "orders" ADD COLUMN "commission_rule_id" integer;
  ALTER TABLE "orders" ADD COLUMN "commission_status" "enum_orders_commission_status" DEFAULT 'pending';
  ALTER TABLE "orders" ADD COLUMN "commission_calculated_at" timestamp(3) with time zone;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "vendor_commission_entries_id" integer;
  ALTER TABLE "vendor_commission_entries" ADD CONSTRAINT "vendor_commission_entries_vendor_id_vendors_id_fk" FOREIGN KEY ("vendor_id") REFERENCES "public"."vendors"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "vendor_commission_entries" ADD CONSTRAINT "vendor_commission_entries_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "vendor_commission_entries" ADD CONSTRAINT "vendor_commission_entries_transaction_id_transactions_id_fk" FOREIGN KEY ("transaction_id") REFERENCES "public"."transactions"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "vendor_commission_entries" ADD CONSTRAINT "vendor_commission_entries_commission_rule_id_commission_rules_id_fk" FOREIGN KEY ("commission_rule_id") REFERENCES "public"."commission_rules"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "vendor_commission_entries_vendor_idx" ON "vendor_commission_entries" USING btree ("vendor_id");
  CREATE INDEX "vendor_commission_entries_order_idx" ON "vendor_commission_entries" USING btree ("order_id");
  CREATE INDEX "vendor_commission_entries_transaction_idx" ON "vendor_commission_entries" USING btree ("transaction_id");
  CREATE UNIQUE INDEX "vendor_commission_entries_idempotency_key_idx" ON "vendor_commission_entries" USING btree ("idempotency_key");
  CREATE INDEX "vendor_commission_entries_commission_rule_idx" ON "vendor_commission_entries" USING btree ("commission_rule_id");
  CREATE INDEX "vendor_commission_entries_updated_at_idx" ON "vendor_commission_entries" USING btree ("updated_at");
  CREATE INDEX "vendor_commission_entries_created_at_idx" ON "vendor_commission_entries" USING btree ("created_at");
  CREATE INDEX "vendor_effective_at_idx" ON "vendor_commission_entries" USING btree ("vendor_id","effective_at");
  CREATE INDEX "order_entry_type_idx" ON "vendor_commission_entries" USING btree ("order_id","entry_type");
  CREATE UNIQUE INDEX "idempotency_key_1_idx" ON "vendor_commission_entries" USING btree ("idempotency_key");
  ALTER TABLE "orders" ADD CONSTRAINT "orders_commission_rule_id_commission_rules_id_fk" FOREIGN KEY ("commission_rule_id") REFERENCES "public"."commission_rules"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "commission_rules" ADD CONSTRAINT "commission_rules_category_id_merchant_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."merchant_categories"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_vendor_commission_entries_fk" FOREIGN KEY ("vendor_commission_entries_id") REFERENCES "public"."vendor_commission_entries"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "orders_commission_rule_idx" ON "orders" USING btree ("commission_rule_id");
  CREATE INDEX "payload_locked_documents_rels_vendor_commission_entries_id_idx" ON "payload_locked_documents_rels" USING btree ("vendor_commission_entries_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM "vendor_commission_entries") THEN
      RAISE EXCEPTION 'Refusing to drop vendor commission ledger entries during rollback';
    END IF;
    IF EXISTS (
      SELECT 1 FROM "orders"
      WHERE "commission_calculated_at" IS NOT NULL
        OR "commission_amount" IS NOT NULL
        OR "commission_vendor_net" IS NOT NULL
    ) THEN
      RAISE EXCEPTION 'Refusing to drop commission snapshots during rollback';
    END IF;
    IF EXISTS (SELECT 1 FROM "commission_rules" WHERE "category_id" IS NOT NULL) THEN
      RAISE EXCEPTION 'Refusing to restore the old category relation while commission rules use categories';
    END IF;
   END $$;
   ALTER TABLE "vendor_commission_entries" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "vendor_commission_entries" CASCADE;
  ALTER TABLE "orders" DROP CONSTRAINT "orders_commission_rule_id_commission_rules_id_fk";
  
  ALTER TABLE "commission_rules" DROP CONSTRAINT "commission_rules_category_id_merchant_categories_id_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_vendor_commission_entries_fk";
  
  DROP INDEX "orders_commission_rule_idx";
  DROP INDEX "payload_locked_documents_rels_vendor_commission_entries_id_idx";
  ALTER TABLE "commission_rules" ADD CONSTRAINT "commission_rules_category_id_prod_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."prod_categories"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "orders" DROP COLUMN "commission_percent";
  ALTER TABLE "orders" DROP COLUMN "commission_base_amount";
  ALTER TABLE "orders" DROP COLUMN "commission_vendor_discount";
  ALTER TABLE "orders" DROP COLUMN "commission_amount";
  ALTER TABLE "orders" DROP COLUMN "commission_transaction_fee";
  ALTER TABLE "orders" DROP COLUMN "commission_vendor_net";
  ALTER TABLE "orders" DROP COLUMN "commission_source";
  ALTER TABLE "orders" DROP COLUMN "commission_rule_id";
  ALTER TABLE "orders" DROP COLUMN "commission_status";
  ALTER TABLE "orders" DROP COLUMN "commission_calculated_at";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "vendor_commission_entries_id";
  DROP TYPE "public"."enum_orders_commission_source";
  DROP TYPE "public"."enum_orders_commission_status";
  DROP TYPE "public"."enum_vendor_commission_entries_entry_type";
  DROP TYPE "public"."enum_vendor_commission_entries_commission_source";`)
}
