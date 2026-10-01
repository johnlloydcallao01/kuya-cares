import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_vendors_kyc_docs_doc_type" AS ENUM('dti', 'sec', 'bir', 'id_front', 'id_back', 'selfie', 'other');
  CREATE TYPE "public"."enum_vendors_subscription_status" AS ENUM('none', 'pending', 'trialing', 'active', 'past_due', 'grace', 'suspended', 'cancelled', 'expired');
  CREATE TYPE "public"."enum_membership_plans_allowed_business_types" AS ENUM('restaurant', 'fast_food', 'grocery', 'pharmacy', 'convenience', 'bakery', 'coffee_shop', 'other');
  CREATE TYPE "public"."enum_membership_plans_billing_interval" AS ENUM('month', 'year', 'one_time');
  CREATE TYPE "public"."enum_membership_plans_capabilities_support_sla" AS ENUM('none', 'email', 'priority', 'dedicated');
  CREATE TYPE "public"."enum_membership_plans_status" AS ENUM('active', 'hidden', 'disabled', 'archived');
  CREATE TYPE "public"."enum_vendor_subscriptions_status" AS ENUM('pending', 'trialing', 'active', 'past_due', 'grace', 'suspended', 'cancelled', 'expired');
  CREATE TYPE "public"."enum_vendor_subscriptions_billing_interval" AS ENUM('month', 'year', 'one_time');
  CREATE TYPE "public"."enum_vendor_subscriptions_payment_provider" AS ENUM('paymongo', 'stripe', 'manual');
  CREATE TYPE "public"."enum_subscription_invoices_status" AS ENUM('pending', 'paid', 'failed', 'past_due', 'void', 'refunded');
  CREATE TYPE "public"."enum_subscription_invoices_billing_reason" AS ENUM('initial', 'upgrade', 'downgrade', 'renewal', 'proration', 'manual');
  CREATE TYPE "public"."enum_subscription_invoices_payment_provider" AS ENUM('paymongo', 'stripe', 'manual');
  CREATE TYPE "public"."enum_commission_rules_scope" AS ENUM('global', 'plan', 'category', 'vendor');
  CREATE TYPE "public"."enum_vendor_entitlements_capabilities_support_sla" AS ENUM('none', 'email', 'priority', 'dedicated');
  CREATE TYPE "public"."enum_membership_audit_log_action" AS ENUM('grant', 'deny', 'upgrade', 'downgrade', 'renew', 'cancel', 'grace', 'override', 'entitlement_check', 'sync', 'vendor_registered', 'admin_approve', 'admin_waive', 'webhook_paid', 'webhook_failed');
  CREATE TYPE "public"."enum_system_settings_membership_pay_provider_default" AS ENUM('paymongo', 'stripe', 'manual');
  ALTER TYPE "public"."enum_coupons_applies_to" ADD VALUE 'membership';
  CREATE TABLE "vendors_kyc_docs" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"doc_type" "enum_vendors_kyc_docs_doc_type" NOT NULL,
  	"media_id" integer NOT NULL
  );
  
  CREATE TABLE "membership_plans_allowed_business_types" (
  	"order" integer NOT NULL,
  	"parent_id" integer NOT NULL,
  	"value" "enum_membership_plans_allowed_business_types",
  	"id" serial PRIMARY KEY NOT NULL
  );
  
  CREATE TABLE "membership_plans" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar NOT NULL,
  	"slug" varchar NOT NULL,
  	"description" varchar,
  	"price" numeric NOT NULL,
  	"currency" varchar DEFAULT 'PHP' NOT NULL,
  	"billing_interval" "enum_membership_plans_billing_interval" DEFAULT 'month' NOT NULL,
  	"trial_days" numeric DEFAULT 0,
  	"grace_days" numeric DEFAULT 7,
  	"commission_percent" numeric DEFAULT 0,
  	"transaction_fee" numeric DEFAULT 0,
  	"limits_max_products" numeric DEFAULT -1,
  	"limits_max_merchants" numeric DEFAULT 1,
  	"limits_max_images" numeric DEFAULT -1,
  	"limits_storage_mb" numeric DEFAULT -1,
  	"limits_staff_seats" numeric DEFAULT 1,
  	"limits_monthly_gmv_cap" numeric DEFAULT -1,
  	"limits_order_cap" numeric DEFAULT -1,
  	"capabilities_microstore" boolean DEFAULT false,
  	"capabilities_ads" boolean DEFAULT false,
  	"capabilities_analytics" boolean DEFAULT false,
  	"capabilities_api_access" boolean DEFAULT false,
  	"capabilities_promos" boolean DEFAULT false,
  	"capabilities_custom_shipping" boolean DEFAULT false,
  	"capabilities_multi_user" boolean DEFAULT false,
  	"capabilities_visibility_boost" numeric DEFAULT 0,
  	"capabilities_support_sla" "enum_membership_plans_capabilities_support_sla" DEFAULT 'email',
  	"status" "enum_membership_plans_status" DEFAULT 'active' NOT NULL,
  	"display_order" numeric DEFAULT 0,
  	"is_fallback_basic" boolean DEFAULT false,
  	"stripe_product_id" varchar,
  	"stripe_price_id" varchar,
  	"paymongo_plan_ref" varchar,
  	"version" numeric DEFAULT 1 NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "membership_plans_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"prod_categories_id" integer
  );
  
  CREATE TABLE "vendor_subscriptions" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"vendor_id" integer NOT NULL,
  	"plan_id" integer NOT NULL,
  	"plan_version" numeric DEFAULT 1 NOT NULL,
  	"plan_snapshot" jsonb NOT NULL,
  	"status" "enum_vendor_subscriptions_status" DEFAULT 'pending' NOT NULL,
  	"billing_interval" "enum_vendor_subscriptions_billing_interval",
  	"current_period_start" timestamp(3) with time zone,
  	"current_period_end" timestamp(3) with time zone,
  	"trial_ends_at" timestamp(3) with time zone,
  	"grace_ends_at" timestamp(3) with time zone,
  	"cancel_at" timestamp(3) with time zone,
  	"cancelled_at" timestamp(3) with time zone,
  	"cancel_at_period_end" boolean DEFAULT false,
  	"scheduled_plan_id" integer,
  	"scheduled_effective_at" timestamp(3) with time zone,
  	"auto_renew" boolean DEFAULT true,
  	"payment_provider" "enum_vendor_subscriptions_payment_provider" DEFAULT 'paymongo',
  	"provider_customer_id" varchar,
  	"provider_subscription_id" varchar,
  	"idempotency_key" varchar NOT NULL,
  	"retry_count" numeric DEFAULT 0,
  	"last_retry_at" timestamp(3) with time zone,
  	"waived_until" timestamp(3) with time zone,
  	"waive_reason" varchar,
  	"suspend_reason" varchar,
  	"usage_products_used" numeric DEFAULT 0,
  	"usage_merchants_used" numeric DEFAULT 0,
  	"usage_storage_mb_used" numeric DEFAULT 0,
  	"usage_gmv_current_period" numeric DEFAULT 0,
  	"usage_orders_current_period" numeric DEFAULT 0,
  	"usage_last_reset_at" timestamp(3) with time zone,
  	"grandfathered" boolean DEFAULT false,
  	"grandfather_notes" varchar,
  	"meta" jsonb,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "subscription_invoices" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"subscription_id" integer NOT NULL,
  	"vendor_id" integer NOT NULL,
  	"plan_id" integer NOT NULL,
  	"invoice_number" varchar NOT NULL,
  	"amount" numeric NOT NULL,
  	"currency" varchar DEFAULT 'PHP',
  	"commission_due" numeric DEFAULT 0,
  	"status" "enum_subscription_invoices_status" DEFAULT 'pending',
  	"billing_reason" "enum_subscription_invoices_billing_reason",
  	"proration_delta" numeric DEFAULT 0,
  	"discount_amount" numeric DEFAULT 0,
  	"coupon_code" varchar,
  	"payment_provider" "enum_subscription_invoices_payment_provider",
  	"provider_payment_intent" varchar,
  	"payment_link_url" varchar,
  	"period_start" timestamp(3) with time zone,
  	"period_end" timestamp(3) with time zone,
  	"due_at" timestamp(3) with time zone NOT NULL,
  	"paid_at" timestamp(3) with time zone,
  	"receipt_id" integer,
  	"retry_count" numeric DEFAULT 0,
  	"failure_reason" varchar,
  	"idempotency_key" varchar NOT NULL,
  	"metadata" jsonb,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "commission_rules" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar NOT NULL,
  	"scope" "enum_commission_rules_scope" NOT NULL,
  	"priority" numeric DEFAULT 0 NOT NULL,
  	"plan_id" integer,
  	"category_id" integer,
  	"vendor_id" integer,
  	"commission_percent" numeric NOT NULL,
  	"transaction_fee" numeric DEFAULT 0,
  	"effective_from" timestamp(3) with time zone,
  	"effective_to" timestamp(3) with time zone,
  	"is_active" boolean DEFAULT true,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "vendor_entitlements" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"vendor_id" integer NOT NULL,
  	"subscription_id" integer,
  	"plan_id" integer,
  	"capabilities_microstore" boolean DEFAULT false,
  	"capabilities_ads" boolean DEFAULT false,
  	"capabilities_analytics" boolean DEFAULT false,
  	"capabilities_api_access" boolean DEFAULT false,
  	"capabilities_promos" boolean DEFAULT false,
  	"capabilities_custom_shipping" boolean DEFAULT false,
  	"capabilities_multi_user" boolean DEFAULT false,
  	"capabilities_visibility_boost" numeric DEFAULT 0,
  	"capabilities_support_sla" "enum_vendor_entitlements_capabilities_support_sla" DEFAULT 'email',
  	"limits_snapshot" jsonb,
  	"granted_at" timestamp(3) with time zone,
  	"expires_at" timestamp(3) with time zone,
  	"reason" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "membership_audit_log" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"vendor_id" integer,
  	"subscription_id" integer,
  	"invoice_id" integer,
  	"action" "enum_membership_audit_log_action",
  	"plan_version" numeric,
  	"previous_plan_id" integer,
  	"next_plan_id" integer,
  	"reason" varchar,
  	"actor_id" integer,
  	"metadata" jsonb,
  	"event_id" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  ALTER TABLE "vendors" ADD COLUMN "current_subscription_id" integer;
  ALTER TABLE "vendors" ADD COLUMN "subscription_status" "enum_vendors_subscription_status" DEFAULT 'none';
  ALTER TABLE "vendors" ADD COLUMN "subscription_expires_at" timestamp(3) with time zone;
  ALTER TABLE "vendors" ADD COLUMN "grace_ends_at" timestamp(3) with time zone;
  ALTER TABLE "vendors" ADD COLUMN "trial_ends_at" timestamp(3) with time zone;
  ALTER TABLE "vendors" ADD COLUMN "waived_until" timestamp(3) with time zone;
  ALTER TABLE "vendors" ADD COLUMN "waive_reason" varchar;
  ALTER TABLE "vendors" ADD COLUMN "suspended_reason" varchar;
  ALTER TABLE "vendors" ADD COLUMN "grandfathered_basic" boolean DEFAULT false;
  ALTER TABLE "vendors" ADD COLUMN "grandfathered_at" timestamp(3) with time zone;
  ALTER TABLE "vendors" ADD COLUMN "commission_override_commission_percent" numeric;
  ALTER TABLE "vendors" ADD COLUMN "commission_override_transaction_fee" numeric DEFAULT 0;
  ALTER TABLE "vendors" ADD COLUMN "commission_override_rule_id" integer;
  ALTER TABLE "vendors" ADD COLUMN "last_entitlement_sync" timestamp(3) with time zone;
  ALTER TABLE "merchants" ADD COLUMN "is_featured" boolean DEFAULT false;
  ALTER TABLE "merchants" ADD COLUMN "listing_boost" numeric DEFAULT 0;
  ALTER TABLE "merchant_categories" ADD COLUMN "commission_override_pct" numeric;
  ALTER TABLE "coupons_rels" ADD COLUMN "membership_plans_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "membership_plans_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "vendor_subscriptions_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "subscription_invoices_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "commission_rules_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "vendor_entitlements_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "membership_audit_log_id" integer;
  ALTER TABLE "system_settings" ADD COLUMN "membership_membership_enabled" boolean DEFAULT false;
  ALTER TABLE "system_settings" ADD COLUMN "membership_membership_enforced" boolean DEFAULT false;
  ALTER TABLE "system_settings" ADD COLUMN "membership_grandfather_basic_enabled" boolean DEFAULT true;
  ALTER TABLE "system_settings" ADD COLUMN "membership_trial_days_default" numeric DEFAULT 7;
  ALTER TABLE "system_settings" ADD COLUMN "membership_grace_days_default" numeric DEFAULT 7;
  ALTER TABLE "system_settings" ADD COLUMN "membership_dunning_max_retries" numeric DEFAULT 8;
  ALTER TABLE "system_settings" ADD COLUMN "membership_dunning_schedule" jsonb DEFAULT '["1h","4h","12h","1d","2d","3d","5d","7d"]'::jsonb;
  ALTER TABLE "system_settings" ADD COLUMN "membership_fallback_basic_plan_slug" varchar DEFAULT 'basic';
  ALTER TABLE "system_settings" ADD COLUMN "membership_commission_default_pct" numeric DEFAULT 8;
  ALTER TABLE "system_settings" ADD COLUMN "membership_pay_provider_default" "enum_system_settings_membership_pay_provider_default" DEFAULT 'paymongo';
  ALTER TABLE "system_settings" ADD COLUMN "membership_paymongo_membership_disabled" boolean DEFAULT false;
  ALTER TABLE "vendors_kyc_docs" ADD CONSTRAINT "vendors_kyc_docs_media_id_media_id_fk" FOREIGN KEY ("media_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "vendors_kyc_docs" ADD CONSTRAINT "vendors_kyc_docs_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."vendors"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "membership_plans_allowed_business_types" ADD CONSTRAINT "membership_plans_allowed_business_types_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."membership_plans"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "membership_plans_rels" ADD CONSTRAINT "membership_plans_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."membership_plans"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "membership_plans_rels" ADD CONSTRAINT "membership_plans_rels_product_categories_fk" FOREIGN KEY ("prod_categories_id") REFERENCES "public"."prod_categories"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "vendor_subscriptions" ADD CONSTRAINT "vendor_subscriptions_vendor_id_vendors_id_fk" FOREIGN KEY ("vendor_id") REFERENCES "public"."vendors"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "vendor_subscriptions" ADD CONSTRAINT "vendor_subscriptions_plan_id_membership_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."membership_plans"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "vendor_subscriptions" ADD CONSTRAINT "vendor_subscriptions_scheduled_plan_id_membership_plans_id_fk" FOREIGN KEY ("scheduled_plan_id") REFERENCES "public"."membership_plans"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "subscription_invoices" ADD CONSTRAINT "subscription_invoices_subscription_id_vendor_subscriptions_id_fk" FOREIGN KEY ("subscription_id") REFERENCES "public"."vendor_subscriptions"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "subscription_invoices" ADD CONSTRAINT "subscription_invoices_vendor_id_vendors_id_fk" FOREIGN KEY ("vendor_id") REFERENCES "public"."vendors"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "subscription_invoices" ADD CONSTRAINT "subscription_invoices_plan_id_membership_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."membership_plans"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "subscription_invoices" ADD CONSTRAINT "subscription_invoices_receipt_id_media_id_fk" FOREIGN KEY ("receipt_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "commission_rules" ADD CONSTRAINT "commission_rules_plan_id_membership_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."membership_plans"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "commission_rules" ADD CONSTRAINT "commission_rules_category_id_prod_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."prod_categories"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "commission_rules" ADD CONSTRAINT "commission_rules_vendor_id_vendors_id_fk" FOREIGN KEY ("vendor_id") REFERENCES "public"."vendors"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "vendor_entitlements" ADD CONSTRAINT "vendor_entitlements_vendor_id_vendors_id_fk" FOREIGN KEY ("vendor_id") REFERENCES "public"."vendors"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "vendor_entitlements" ADD CONSTRAINT "vendor_entitlements_subscription_id_vendor_subscriptions_id_fk" FOREIGN KEY ("subscription_id") REFERENCES "public"."vendor_subscriptions"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "vendor_entitlements" ADD CONSTRAINT "vendor_entitlements_plan_id_membership_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."membership_plans"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "membership_audit_log" ADD CONSTRAINT "membership_audit_log_vendor_id_vendors_id_fk" FOREIGN KEY ("vendor_id") REFERENCES "public"."vendors"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "membership_audit_log" ADD CONSTRAINT "membership_audit_log_subscription_id_vendor_subscriptions_id_fk" FOREIGN KEY ("subscription_id") REFERENCES "public"."vendor_subscriptions"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "membership_audit_log" ADD CONSTRAINT "membership_audit_log_invoice_id_subscription_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."subscription_invoices"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "membership_audit_log" ADD CONSTRAINT "membership_audit_log_previous_plan_id_membership_plans_id_fk" FOREIGN KEY ("previous_plan_id") REFERENCES "public"."membership_plans"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "membership_audit_log" ADD CONSTRAINT "membership_audit_log_next_plan_id_membership_plans_id_fk" FOREIGN KEY ("next_plan_id") REFERENCES "public"."membership_plans"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "membership_audit_log" ADD CONSTRAINT "membership_audit_log_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "vendors_kyc_docs_order_idx" ON "vendors_kyc_docs" USING btree ("_order");
  CREATE INDEX "vendors_kyc_docs_parent_id_idx" ON "vendors_kyc_docs" USING btree ("_parent_id");
  CREATE INDEX "vendors_kyc_docs_media_idx" ON "vendors_kyc_docs" USING btree ("media_id");
  CREATE INDEX "membership_plans_allowed_business_types_order_idx" ON "membership_plans_allowed_business_types" USING btree ("order");
  CREATE INDEX "membership_plans_allowed_business_types_parent_idx" ON "membership_plans_allowed_business_types" USING btree ("parent_id");
  CREATE UNIQUE INDEX "membership_plans_slug_idx" ON "membership_plans" USING btree ("slug");
  CREATE INDEX "membership_plans_updated_at_idx" ON "membership_plans" USING btree ("updated_at");
  CREATE INDEX "membership_plans_created_at_idx" ON "membership_plans" USING btree ("created_at");
  CREATE UNIQUE INDEX "slug_1_idx" ON "membership_plans" USING btree ("slug");
  CREATE INDEX "status_display_order_idx" ON "membership_plans" USING btree ("status","display_order");
  CREATE INDEX "membership_plans_rels_order_idx" ON "membership_plans_rels" USING btree ("order");
  CREATE INDEX "membership_plans_rels_parent_idx" ON "membership_plans_rels" USING btree ("parent_id");
  CREATE INDEX "membership_plans_rels_path_idx" ON "membership_plans_rels" USING btree ("path");
  CREATE INDEX "membership_plans_rels_prod_categories_id_idx" ON "membership_plans_rels" USING btree ("prod_categories_id");
  CREATE INDEX "vendor_subscriptions_vendor_idx" ON "vendor_subscriptions" USING btree ("vendor_id");
  CREATE INDEX "vendor_subscriptions_plan_idx" ON "vendor_subscriptions" USING btree ("plan_id");
  CREATE INDEX "vendor_subscriptions_scheduled_plan_idx" ON "vendor_subscriptions" USING btree ("scheduled_plan_id");
  CREATE INDEX "vendor_subscriptions_provider_subscription_id_idx" ON "vendor_subscriptions" USING btree ("provider_subscription_id");
  CREATE UNIQUE INDEX "vendor_subscriptions_idempotency_key_idx" ON "vendor_subscriptions" USING btree ("idempotency_key");
  CREATE INDEX "vendor_subscriptions_updated_at_idx" ON "vendor_subscriptions" USING btree ("updated_at");
  CREATE INDEX "vendor_subscriptions_created_at_idx" ON "vendor_subscriptions" USING btree ("created_at");
  CREATE INDEX "vendor_status_idx" ON "vendor_subscriptions" USING btree ("vendor_id","status");
  CREATE INDEX "plan_status_idx" ON "vendor_subscriptions" USING btree ("plan_id","status");
  CREATE UNIQUE INDEX "provider_subscription_id_idx" ON "vendor_subscriptions" USING btree ("provider_subscription_id");
  CREATE INDEX "current_period_end_idx" ON "vendor_subscriptions" USING btree ("current_period_end");
  CREATE UNIQUE INDEX "idempotencyKey_idx" ON "vendor_subscriptions" USING btree ("idempotency_key");
  CREATE INDEX "subscription_invoices_subscription_idx" ON "subscription_invoices" USING btree ("subscription_id");
  CREATE INDEX "subscription_invoices_vendor_idx" ON "subscription_invoices" USING btree ("vendor_id");
  CREATE INDEX "subscription_invoices_plan_idx" ON "subscription_invoices" USING btree ("plan_id");
  CREATE UNIQUE INDEX "subscription_invoices_invoice_number_idx" ON "subscription_invoices" USING btree ("invoice_number");
  CREATE INDEX "subscription_invoices_provider_payment_intent_idx" ON "subscription_invoices" USING btree ("provider_payment_intent");
  CREATE INDEX "subscription_invoices_receipt_idx" ON "subscription_invoices" USING btree ("receipt_id");
  CREATE UNIQUE INDEX "subscription_invoices_idempotency_key_idx" ON "subscription_invoices" USING btree ("idempotency_key");
  CREATE INDEX "subscription_invoices_updated_at_idx" ON "subscription_invoices" USING btree ("updated_at");
  CREATE INDEX "subscription_invoices_created_at_idx" ON "subscription_invoices" USING btree ("created_at");
  CREATE UNIQUE INDEX "invoice_number_idx" ON "subscription_invoices" USING btree ("invoice_number");
  CREATE INDEX "vendor_status_1_idx" ON "subscription_invoices" USING btree ("vendor_id","status");
  CREATE INDEX "subscription_status_idx" ON "subscription_invoices" USING btree ("subscription_id","status");
  CREATE INDEX "provider_payment_intent_idx" ON "subscription_invoices" USING btree ("provider_payment_intent");
  CREATE UNIQUE INDEX "idempotencyKey_1_idx" ON "subscription_invoices" USING btree ("idempotency_key");
  CREATE INDEX "commission_rules_plan_idx" ON "commission_rules" USING btree ("plan_id");
  CREATE INDEX "commission_rules_category_idx" ON "commission_rules" USING btree ("category_id");
  CREATE INDEX "commission_rules_vendor_idx" ON "commission_rules" USING btree ("vendor_id");
  CREATE INDEX "commission_rules_updated_at_idx" ON "commission_rules" USING btree ("updated_at");
  CREATE INDEX "commission_rules_created_at_idx" ON "commission_rules" USING btree ("created_at");
  CREATE INDEX "scope_is_active_idx" ON "commission_rules" USING btree ("scope","is_active");
  CREATE INDEX "priority_idx" ON "commission_rules" USING btree ("priority");
  CREATE UNIQUE INDEX "vendor_entitlements_vendor_idx" ON "vendor_entitlements" USING btree ("vendor_id");
  CREATE INDEX "vendor_entitlements_subscription_idx" ON "vendor_entitlements" USING btree ("subscription_id");
  CREATE INDEX "vendor_entitlements_plan_idx" ON "vendor_entitlements" USING btree ("plan_id");
  CREATE INDEX "vendor_entitlements_updated_at_idx" ON "vendor_entitlements" USING btree ("updated_at");
  CREATE INDEX "vendor_entitlements_created_at_idx" ON "vendor_entitlements" USING btree ("created_at");
  CREATE UNIQUE INDEX "vendor_2_idx" ON "vendor_entitlements" USING btree ("vendor_id");
  CREATE INDEX "membership_audit_log_vendor_idx" ON "membership_audit_log" USING btree ("vendor_id");
  CREATE INDEX "membership_audit_log_subscription_idx" ON "membership_audit_log" USING btree ("subscription_id");
  CREATE INDEX "membership_audit_log_invoice_idx" ON "membership_audit_log" USING btree ("invoice_id");
  CREATE INDEX "membership_audit_log_previous_plan_idx" ON "membership_audit_log" USING btree ("previous_plan_id");
  CREATE INDEX "membership_audit_log_next_plan_idx" ON "membership_audit_log" USING btree ("next_plan_id");
  CREATE INDEX "membership_audit_log_actor_idx" ON "membership_audit_log" USING btree ("actor_id");
  CREATE UNIQUE INDEX "membership_audit_log_event_id_idx" ON "membership_audit_log" USING btree ("event_id");
  CREATE INDEX "membership_audit_log_updated_at_idx" ON "membership_audit_log" USING btree ("updated_at");
  CREATE INDEX "membership_audit_log_created_at_idx" ON "membership_audit_log" USING btree ("created_at");
  CREATE INDEX "vendor_createdAt_idx" ON "membership_audit_log" USING btree ("vendor_id","created_at");
  CREATE INDEX "subscription_idx" ON "membership_audit_log" USING btree ("subscription_id");
  CREATE UNIQUE INDEX "eventId_idx" ON "membership_audit_log" USING btree ("event_id");
  ALTER TABLE "vendors" ADD CONSTRAINT "vendors_current_subscription_id_vendor_subscriptions_id_fk" FOREIGN KEY ("current_subscription_id") REFERENCES "public"."vendor_subscriptions"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "vendors" ADD CONSTRAINT "vendors_commission_override_rule_id_commission_rules_id_fk" FOREIGN KEY ("commission_override_rule_id") REFERENCES "public"."commission_rules"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "coupons_rels" ADD CONSTRAINT "coupons_rels_membership_plans_fk" FOREIGN KEY ("membership_plans_id") REFERENCES "public"."membership_plans"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_membership_plans_fk" FOREIGN KEY ("membership_plans_id") REFERENCES "public"."membership_plans"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_vendor_subscriptions_fk" FOREIGN KEY ("vendor_subscriptions_id") REFERENCES "public"."vendor_subscriptions"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_subscription_invoices_fk" FOREIGN KEY ("subscription_invoices_id") REFERENCES "public"."subscription_invoices"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_commission_rules_fk" FOREIGN KEY ("commission_rules_id") REFERENCES "public"."commission_rules"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_vendor_entitlements_fk" FOREIGN KEY ("vendor_entitlements_id") REFERENCES "public"."vendor_entitlements"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_membership_audit_log_fk" FOREIGN KEY ("membership_audit_log_id") REFERENCES "public"."membership_audit_log"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "vendors_current_subscription_idx" ON "vendors" USING btree ("current_subscription_id");
  CREATE INDEX "vendors_commission_override_commission_override_rule_idx" ON "vendors" USING btree ("commission_override_rule_id");
  CREATE INDEX "coupons_rels_membership_plans_id_idx" ON "coupons_rels" USING btree ("membership_plans_id");
  CREATE INDEX "payload_locked_documents_rels_membership_plans_id_idx" ON "payload_locked_documents_rels" USING btree ("membership_plans_id");
  CREATE INDEX "payload_locked_documents_rels_vendor_subscriptions_id_idx" ON "payload_locked_documents_rels" USING btree ("vendor_subscriptions_id");
  CREATE INDEX "payload_locked_documents_rels_subscription_invoices_id_idx" ON "payload_locked_documents_rels" USING btree ("subscription_invoices_id");
  CREATE INDEX "payload_locked_documents_rels_commission_rules_id_idx" ON "payload_locked_documents_rels" USING btree ("commission_rules_id");
  CREATE INDEX "payload_locked_documents_rels_vendor_entitlements_id_idx" ON "payload_locked_documents_rels" USING btree ("vendor_entitlements_id");
  CREATE INDEX "payload_locked_documents_rels_membership_audit_log_id_idx" ON "payload_locked_documents_rels" USING btree ("membership_audit_log_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "vendors_kyc_docs" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "membership_plans_allowed_business_types" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "membership_plans" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "membership_plans_rels" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "vendor_subscriptions" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "subscription_invoices" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "commission_rules" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "vendor_entitlements" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "membership_audit_log" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "vendors_kyc_docs" CASCADE;
  DROP TABLE "membership_plans_allowed_business_types" CASCADE;
  DROP TABLE "membership_plans" CASCADE;
  DROP TABLE "membership_plans_rels" CASCADE;
  DROP TABLE "vendor_subscriptions" CASCADE;
  DROP TABLE "subscription_invoices" CASCADE;
  DROP TABLE "commission_rules" CASCADE;
  DROP TABLE "vendor_entitlements" CASCADE;
  DROP TABLE "membership_audit_log" CASCADE;
  ALTER TABLE "vendors" DROP CONSTRAINT "vendors_current_subscription_id_vendor_subscriptions_id_fk";
  
  ALTER TABLE "vendors" DROP CONSTRAINT "vendors_commission_override_rule_id_commission_rules_id_fk";
  
  ALTER TABLE "coupons_rels" DROP CONSTRAINT "coupons_rels_membership_plans_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_membership_plans_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_vendor_subscriptions_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_subscription_invoices_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_commission_rules_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_vendor_entitlements_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_membership_audit_log_fk";
  
  ALTER TABLE "coupons" ALTER COLUMN "applies_to" SET DATA TYPE text;
  ALTER TABLE "coupons" ALTER COLUMN "applies_to" SET DEFAULT 'food_subtotal'::text;
  DROP TYPE "public"."enum_coupons_applies_to";
  CREATE TYPE "public"."enum_coupons_applies_to" AS ENUM('food_subtotal', 'delivery_fee', 'both');
  ALTER TABLE "coupons" ALTER COLUMN "applies_to" SET DEFAULT 'food_subtotal'::"public"."enum_coupons_applies_to";
  ALTER TABLE "coupons" ALTER COLUMN "applies_to" SET DATA TYPE "public"."enum_coupons_applies_to" USING "applies_to"::"public"."enum_coupons_applies_to";
  DROP INDEX "vendors_current_subscription_idx";
  DROP INDEX "vendors_commission_override_commission_override_rule_idx";
  DROP INDEX "coupons_rels_membership_plans_id_idx";
  DROP INDEX "payload_locked_documents_rels_membership_plans_id_idx";
  DROP INDEX "payload_locked_documents_rels_vendor_subscriptions_id_idx";
  DROP INDEX "payload_locked_documents_rels_subscription_invoices_id_idx";
  DROP INDEX "payload_locked_documents_rels_commission_rules_id_idx";
  DROP INDEX "payload_locked_documents_rels_vendor_entitlements_id_idx";
  DROP INDEX "payload_locked_documents_rels_membership_audit_log_id_idx";
  ALTER TABLE "vendors" DROP COLUMN "current_subscription_id";
  ALTER TABLE "vendors" DROP COLUMN "subscription_status";
  ALTER TABLE "vendors" DROP COLUMN "subscription_expires_at";
  ALTER TABLE "vendors" DROP COLUMN "grace_ends_at";
  ALTER TABLE "vendors" DROP COLUMN "trial_ends_at";
  ALTER TABLE "vendors" DROP COLUMN "waived_until";
  ALTER TABLE "vendors" DROP COLUMN "waive_reason";
  ALTER TABLE "vendors" DROP COLUMN "suspended_reason";
  ALTER TABLE "vendors" DROP COLUMN "grandfathered_basic";
  ALTER TABLE "vendors" DROP COLUMN "grandfathered_at";
  ALTER TABLE "vendors" DROP COLUMN "commission_override_commission_percent";
  ALTER TABLE "vendors" DROP COLUMN "commission_override_transaction_fee";
  ALTER TABLE "vendors" DROP COLUMN "commission_override_rule_id";
  ALTER TABLE "vendors" DROP COLUMN "last_entitlement_sync";
  ALTER TABLE "merchants" DROP COLUMN "is_featured";
  ALTER TABLE "merchants" DROP COLUMN "listing_boost";
  ALTER TABLE "merchant_categories" DROP COLUMN "commission_override_pct";
  ALTER TABLE "coupons_rels" DROP COLUMN "membership_plans_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "membership_plans_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "vendor_subscriptions_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "subscription_invoices_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "commission_rules_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "vendor_entitlements_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "membership_audit_log_id";
  ALTER TABLE "system_settings" DROP COLUMN "membership_membership_enabled";
  ALTER TABLE "system_settings" DROP COLUMN "membership_membership_enforced";
  ALTER TABLE "system_settings" DROP COLUMN "membership_grandfather_basic_enabled";
  ALTER TABLE "system_settings" DROP COLUMN "membership_trial_days_default";
  ALTER TABLE "system_settings" DROP COLUMN "membership_grace_days_default";
  ALTER TABLE "system_settings" DROP COLUMN "membership_dunning_max_retries";
  ALTER TABLE "system_settings" DROP COLUMN "membership_dunning_schedule";
  ALTER TABLE "system_settings" DROP COLUMN "membership_fallback_basic_plan_slug";
  ALTER TABLE "system_settings" DROP COLUMN "membership_commission_default_pct";
  ALTER TABLE "system_settings" DROP COLUMN "membership_pay_provider_default";
  ALTER TABLE "system_settings" DROP COLUMN "membership_paymongo_membership_disabled";
  DROP TYPE "public"."enum_vendors_kyc_docs_doc_type";
  DROP TYPE "public"."enum_vendors_subscription_status";
  DROP TYPE "public"."enum_membership_plans_allowed_business_types";
  DROP TYPE "public"."enum_membership_plans_billing_interval";
  DROP TYPE "public"."enum_membership_plans_capabilities_support_sla";
  DROP TYPE "public"."enum_membership_plans_status";
  DROP TYPE "public"."enum_vendor_subscriptions_status";
  DROP TYPE "public"."enum_vendor_subscriptions_billing_interval";
  DROP TYPE "public"."enum_vendor_subscriptions_payment_provider";
  DROP TYPE "public"."enum_subscription_invoices_status";
  DROP TYPE "public"."enum_subscription_invoices_billing_reason";
  DROP TYPE "public"."enum_subscription_invoices_payment_provider";
  DROP TYPE "public"."enum_commission_rules_scope";
  DROP TYPE "public"."enum_vendor_entitlements_capabilities_support_sla";
  DROP TYPE "public"."enum_membership_audit_log_action";
  DROP TYPE "public"."enum_system_settings_membership_pay_provider_default";`)
}
