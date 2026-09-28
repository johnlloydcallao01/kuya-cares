import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_users_preferred_language" AS ENUM('en', 'fil');
  CREATE TYPE "public"."enum_devices_platform" AS ENUM('ios', 'android', 'web');
  CREATE TABLE "users_email_change_tokens" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"token" varchar NOT NULL,
  	"expires_at" timestamp(3) with time zone NOT NULL,
  	"new_email" varchar NOT NULL
  );
  
  CREATE TABLE "notification_preferences" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"user_id" integer NOT NULL,
  	"order_email" boolean DEFAULT true,
  	"order_push" boolean DEFAULT true,
  	"order_sms" boolean DEFAULT true,
  	"promo_email" boolean DEFAULT true,
  	"promo_push" boolean DEFAULT true,
  	"promo_sms" boolean DEFAULT true,
  	"account_email" boolean DEFAULT true,
  	"marketing_opt_in" boolean DEFAULT true,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "devices" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"user_id" integer NOT NULL,
  	"push_token" varchar NOT NULL,
  	"platform" "enum_devices_platform" DEFAULT 'android' NOT NULL,
  	"app_version" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "payment_methods" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"user_id" integer NOT NULL,
  	"provider" varchar DEFAULT 'paymongo',
  	"provider_method_id" varchar NOT NULL,
  	"brand" varchar,
  	"last4" varchar,
  	"exp_month" numeric,
  	"exp_year" numeric,
  	"nickname" varchar,
  	"is_default" boolean DEFAULT false,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  DROP INDEX "user_idx";
  DROP INDEX "user_1_idx";
  ALTER TABLE "users" ADD COLUMN "email_verified_at" timestamp(3) with time zone;
  ALTER TABLE "users" ADD COLUMN "phone_verified_at" timestamp(3) with time zone;
  ALTER TABLE "users" ADD COLUMN "preferred_language" "enum_users_preferred_language" DEFAULT 'en';
  ALTER TABLE "users" ADD COLUMN "timezone" varchar DEFAULT 'Asia/Manila';
  ALTER TABLE "users" ADD COLUMN "currency" varchar DEFAULT 'PHP';
  ALTER TABLE "users" ADD COLUMN "marketing_opt_in" boolean DEFAULT true;
  ALTER TABLE "users" ADD COLUMN "data_consent_at" timestamp(3) with time zone;
  ALTER TABLE "users" ADD COLUMN "deactivated_at" timestamp(3) with time zone;
  ALTER TABLE "users" ADD COLUMN "delete_requested_at" timestamp(3) with time zone;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "notification_preferences_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "devices_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "payment_methods_id" integer;
  ALTER TABLE "users_email_change_tokens" ADD CONSTRAINT "users_email_change_tokens_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "notification_preferences" ADD CONSTRAINT "notification_preferences_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "devices" ADD CONSTRAINT "devices_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payment_methods" ADD CONSTRAINT "payment_methods_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "users_email_change_tokens_order_idx" ON "users_email_change_tokens" USING btree ("_order");
  CREATE INDEX "users_email_change_tokens_parent_id_idx" ON "users_email_change_tokens" USING btree ("_parent_id");
  CREATE UNIQUE INDEX "notification_preferences_user_idx" ON "notification_preferences" USING btree ("user_id");
  CREATE INDEX "notification_preferences_updated_at_idx" ON "notification_preferences" USING btree ("updated_at");
  CREATE INDEX "notification_preferences_created_at_idx" ON "notification_preferences" USING btree ("created_at");
  CREATE UNIQUE INDEX "user_idx" ON "notification_preferences" USING btree ("user_id");
  CREATE INDEX "devices_user_idx" ON "devices" USING btree ("user_id");
  CREATE UNIQUE INDEX "devices_push_token_idx" ON "devices" USING btree ("push_token");
  CREATE INDEX "devices_updated_at_idx" ON "devices" USING btree ("updated_at");
  CREATE INDEX "devices_created_at_idx" ON "devices" USING btree ("created_at");
  CREATE UNIQUE INDEX "pushToken_idx" ON "devices" USING btree ("push_token");
  CREATE INDEX "user_1_idx" ON "devices" USING btree ("user_id");
  CREATE INDEX "payment_methods_user_idx" ON "payment_methods" USING btree ("user_id");
  CREATE INDEX "payment_methods_updated_at_idx" ON "payment_methods" USING btree ("updated_at");
  CREATE INDEX "payment_methods_created_at_idx" ON "payment_methods" USING btree ("created_at");
  CREATE UNIQUE INDEX "user_providerMethodId_idx" ON "payment_methods" USING btree ("user_id","provider_method_id");
  CREATE INDEX "user_2_idx" ON "payment_methods" USING btree ("user_id");
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_notification_preferences_fk" FOREIGN KEY ("notification_preferences_id") REFERENCES "public"."notification_preferences"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_devices_fk" FOREIGN KEY ("devices_id") REFERENCES "public"."devices"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_payment_methods_fk" FOREIGN KEY ("payment_methods_id") REFERENCES "public"."payment_methods"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "user_3_idx" ON "addresses" USING btree ("user_id");
  CREATE INDEX "user_4_idx" ON "drivers" USING btree ("user_id");
  CREATE INDEX "payload_locked_documents_rels_notification_preferences_id_idx" ON "payload_locked_documents_rels" USING btree ("notification_preferences_id");
  CREATE INDEX "payload_locked_documents_rels_devices_id_idx" ON "payload_locked_documents_rels" USING btree ("devices_id");
  CREATE INDEX "payload_locked_documents_rels_payment_methods_id_idx" ON "payload_locked_documents_rels" USING btree ("payment_methods_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "users_email_change_tokens" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "notification_preferences" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "devices" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "payment_methods" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "users_email_change_tokens" CASCADE;
  DROP TABLE "notification_preferences" CASCADE;
  DROP TABLE "devices" CASCADE;
  DROP TABLE "payment_methods" CASCADE;
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_notification_preferences_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_devices_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_payment_methods_fk";
  
  DROP INDEX "user_3_idx";
  DROP INDEX "user_4_idx";
  DROP INDEX "payload_locked_documents_rels_notification_preferences_id_idx";
  DROP INDEX "payload_locked_documents_rels_devices_id_idx";
  DROP INDEX "payload_locked_documents_rels_payment_methods_id_idx";
  CREATE INDEX "user_idx" ON "addresses" USING btree ("user_id");
  CREATE INDEX "user_1_idx" ON "drivers" USING btree ("user_id");
  ALTER TABLE "users" DROP COLUMN "email_verified_at";
  ALTER TABLE "users" DROP COLUMN "phone_verified_at";
  ALTER TABLE "users" DROP COLUMN "preferred_language";
  ALTER TABLE "users" DROP COLUMN "timezone";
  ALTER TABLE "users" DROP COLUMN "currency";
  ALTER TABLE "users" DROP COLUMN "marketing_opt_in";
  ALTER TABLE "users" DROP COLUMN "data_consent_at";
  ALTER TABLE "users" DROP COLUMN "deactivated_at";
  ALTER TABLE "users" DROP COLUMN "delete_requested_at";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "notification_preferences_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "devices_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "payment_methods_id";
  DROP TYPE "public"."enum_users_preferred_language";
  DROP TYPE "public"."enum_devices_platform";`)
}
