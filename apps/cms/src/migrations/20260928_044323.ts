import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_point_rules_event" AS ENUM('order_delivered', 'review', 'first_order');
  CREATE TYPE "public"."enum_rewards_category" AS ENUM('food', 'delivery', 'discount', 'exclusive');
  CREATE TYPE "public"."enum_achievements_metric" AS ENUM('orders_count', 'reviews_count', 'total_spent');
  ALTER TYPE "public"."enum_wallet_transactions_type" ADD VALUE 'earn';
  ALTER TYPE "public"."enum_wallet_transactions_type" ADD VALUE 'redeem';
  CREATE TABLE "point_rules" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"event" "enum_point_rules_event" NOT NULL,
  	"points" numeric DEFAULT 0,
  	"rate_per_peso" numeric DEFAULT 0,
  	"min_order_total" numeric DEFAULT 0,
  	"cap_points" numeric DEFAULT 0,
  	"is_active" boolean DEFAULT true,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "rewards_terms" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"term" varchar NOT NULL
  );
  
  CREATE TABLE "rewards" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"title" varchar NOT NULL,
  	"description" varchar,
  	"points_cost" numeric NOT NULL,
  	"category" "enum_rewards_category" DEFAULT 'discount' NOT NULL,
  	"image_id" integer,
  	"stock" numeric,
  	"coupon_id" integer,
  	"priority" numeric DEFAULT 0,
  	"is_active" boolean DEFAULT true,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "achievements" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"title" varchar NOT NULL,
  	"description" varchar,
  	"points_reward" numeric NOT NULL,
  	"metric" "enum_achievements_metric" NOT NULL,
  	"target" numeric NOT NULL,
  	"icon" varchar,
  	"is_active" boolean DEFAULT true,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "user_achievements" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"user_id" integer NOT NULL,
  	"achievement_id" integer NOT NULL,
  	"progress" numeric DEFAULT 0 NOT NULL,
  	"target" numeric NOT NULL,
  	"completed" boolean DEFAULT false,
  	"claimed" boolean DEFAULT false,
  	"completed_at" timestamp(3) with time zone,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  ALTER TABLE "wallet_transactions" ALTER COLUMN "amount" SET DEFAULT 0;
  ALTER TABLE "wallets" ADD COLUMN "points_balance" numeric DEFAULT 0 NOT NULL;
  ALTER TABLE "wallets" ADD COLUMN "points_earned" numeric DEFAULT 0 NOT NULL;
  ALTER TABLE "wallets" ADD COLUMN "points_redeemed" numeric DEFAULT 0 NOT NULL;
  ALTER TABLE "wallet_transactions" ADD COLUMN "points" numeric DEFAULT 0 NOT NULL;
  ALTER TABLE "wallet_transactions" ADD COLUMN "points_balance_after" numeric DEFAULT 0 NOT NULL;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "point_rules_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "rewards_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "achievements_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "user_achievements_id" integer;
  ALTER TABLE "system_settings" ADD COLUMN "points_enabled" boolean DEFAULT true;
  ALTER TABLE "system_settings" ADD COLUMN "points_expiry_days" numeric DEFAULT 365;
  ALTER TABLE "rewards_terms" ADD CONSTRAINT "rewards_terms_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."rewards"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "rewards" ADD CONSTRAINT "rewards_image_id_media_id_fk" FOREIGN KEY ("image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "rewards" ADD CONSTRAINT "rewards_coupon_id_coupons_id_fk" FOREIGN KEY ("coupon_id") REFERENCES "public"."coupons"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "user_achievements" ADD CONSTRAINT "user_achievements_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "user_achievements" ADD CONSTRAINT "user_achievements_achievement_id_achievements_id_fk" FOREIGN KEY ("achievement_id") REFERENCES "public"."achievements"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "point_rules_updated_at_idx" ON "point_rules" USING btree ("updated_at");
  CREATE INDEX "point_rules_created_at_idx" ON "point_rules" USING btree ("created_at");
  CREATE INDEX "event_is_active_idx" ON "point_rules" USING btree ("event","is_active");
  CREATE INDEX "rewards_terms_order_idx" ON "rewards_terms" USING btree ("_order");
  CREATE INDEX "rewards_terms_parent_id_idx" ON "rewards_terms" USING btree ("_parent_id");
  CREATE INDEX "rewards_image_idx" ON "rewards" USING btree ("image_id");
  CREATE INDEX "rewards_coupon_idx" ON "rewards" USING btree ("coupon_id");
  CREATE INDEX "rewards_updated_at_idx" ON "rewards" USING btree ("updated_at");
  CREATE INDEX "rewards_created_at_idx" ON "rewards" USING btree ("created_at");
  CREATE INDEX "is_active_category_idx" ON "rewards" USING btree ("is_active","category");
  CREATE INDEX "achievements_updated_at_idx" ON "achievements" USING btree ("updated_at");
  CREATE INDEX "achievements_created_at_idx" ON "achievements" USING btree ("created_at");
  CREATE INDEX "is_active_idx" ON "achievements" USING btree ("is_active");
  CREATE INDEX "user_achievements_user_idx" ON "user_achievements" USING btree ("user_id");
  CREATE INDEX "user_achievements_achievement_idx" ON "user_achievements" USING btree ("achievement_id");
  CREATE INDEX "user_achievements_updated_at_idx" ON "user_achievements" USING btree ("updated_at");
  CREATE INDEX "user_achievements_created_at_idx" ON "user_achievements" USING btree ("created_at");
  CREATE UNIQUE INDEX "user_achievement_idx" ON "user_achievements" USING btree ("user_id","achievement_id");
  CREATE INDEX "user_6_idx" ON "user_achievements" USING btree ("user_id");
  CREATE INDEX "achievement_idx" ON "user_achievements" USING btree ("achievement_id");
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_point_rules_fk" FOREIGN KEY ("point_rules_id") REFERENCES "public"."point_rules"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_rewards_fk" FOREIGN KEY ("rewards_id") REFERENCES "public"."rewards"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_achievements_fk" FOREIGN KEY ("achievements_id") REFERENCES "public"."achievements"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_user_achievements_fk" FOREIGN KEY ("user_achievements_id") REFERENCES "public"."user_achievements"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "payload_locked_documents_rels_point_rules_id_idx" ON "payload_locked_documents_rels" USING btree ("point_rules_id");
  CREATE INDEX "payload_locked_documents_rels_rewards_id_idx" ON "payload_locked_documents_rels" USING btree ("rewards_id");
  CREATE INDEX "payload_locked_documents_rels_achievements_id_idx" ON "payload_locked_documents_rels" USING btree ("achievements_id");
  CREATE INDEX "payload_locked_documents_rels_user_achievements_id_idx" ON "payload_locked_documents_rels" USING btree ("user_achievements_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "point_rules" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "rewards_terms" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "rewards" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "achievements" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "user_achievements" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "point_rules" CASCADE;
  DROP TABLE "rewards_terms" CASCADE;
  DROP TABLE "rewards" CASCADE;
  DROP TABLE "achievements" CASCADE;
  DROP TABLE "user_achievements" CASCADE;
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_point_rules_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_rewards_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_achievements_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_user_achievements_fk";
  
  ALTER TABLE "wallet_transactions" ALTER COLUMN "type" SET DATA TYPE text;
  DROP TYPE "public"."enum_wallet_transactions_type";
  CREATE TYPE "public"."enum_wallet_transactions_type" AS ENUM('topup', 'payment', 'refund', 'cashback', 'withdrawal', 'adjustment', 'expiry');
  ALTER TABLE "wallet_transactions" ALTER COLUMN "type" SET DATA TYPE "public"."enum_wallet_transactions_type" USING "type"::"public"."enum_wallet_transactions_type";
  DROP INDEX "payload_locked_documents_rels_point_rules_id_idx";
  DROP INDEX "payload_locked_documents_rels_rewards_id_idx";
  DROP INDEX "payload_locked_documents_rels_achievements_id_idx";
  DROP INDEX "payload_locked_documents_rels_user_achievements_id_idx";
  ALTER TABLE "wallet_transactions" ALTER COLUMN "amount" DROP DEFAULT;
  ALTER TABLE "wallets" DROP COLUMN "points_balance";
  ALTER TABLE "wallets" DROP COLUMN "points_earned";
  ALTER TABLE "wallets" DROP COLUMN "points_redeemed";
  ALTER TABLE "wallet_transactions" DROP COLUMN "points";
  ALTER TABLE "wallet_transactions" DROP COLUMN "points_balance_after";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "point_rules_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "rewards_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "achievements_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "user_achievements_id";
  ALTER TABLE "system_settings" DROP COLUMN "points_enabled";
  ALTER TABLE "system_settings" DROP COLUMN "points_expiry_days";
  DROP TYPE "public"."enum_point_rules_event";
  DROP TYPE "public"."enum_rewards_category";
  DROP TYPE "public"."enum_achievements_metric";`)
}
