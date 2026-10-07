import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_member_invites_status" AS ENUM('pending', 'claimed', 'revoked', 'expired');
  CREATE TYPE "public"."enum_member_listings_condition" AS ENUM('new', 'like_new', 'good', 'fair', 'for_parts');
  CREATE TYPE "public"."enum_member_listings_status" AS ENUM('draft', 'active', 'reserved', 'sold', 'removed');
  CREATE TYPE "public"."enum_member_orders_status" AS ENUM('pending', 'confirmed', 'handed_over', 'completed', 'cancelled');
  ALTER TYPE "public"."enum_users_role" ADD VALUE 'member' BEFORE 'customer';
  CREATE TABLE "member_invites" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"code" varchar NOT NULL,
  	"email" varchar,
  	"status" "enum_member_invites_status" DEFAULT 'pending' NOT NULL,
  	"invited_by_id" integer NOT NULL,
  	"claimed_by_id" integer,
  	"expires_at" timestamp(3) with time zone,
  	"claimed_at" timestamp(3) with time zone,
  	"notes" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "member_listings_images" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"image_id" integer NOT NULL
  );
  
  CREATE TABLE "member_listings" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"seller_id" integer NOT NULL,
  	"title" varchar NOT NULL,
  	"description" varchar,
  	"price" numeric NOT NULL,
  	"currency" varchar DEFAULT 'PHP',
  	"condition" "enum_member_listings_condition" DEFAULT 'good',
  	"category" varchar,
  	"quantity" numeric DEFAULT 1,
  	"status" "enum_member_listings_status" DEFAULT 'active' NOT NULL,
  	"meetup_notes" varchar,
  	"is_active" boolean DEFAULT true,
  	"sold_at" timestamp(3) with time zone,
  	"buyer_id" integer,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "member_orders" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"listing_id" integer NOT NULL,
  	"buyer_id" integer NOT NULL,
  	"seller_id" integer NOT NULL,
  	"price" numeric NOT NULL,
  	"quantity" numeric DEFAULT 1,
  	"status" "enum_member_orders_status" DEFAULT 'pending' NOT NULL,
  	"meetup_notes" varchar,
  	"cancelled_reason" varchar,
  	"completed_at" timestamp(3) with time zone,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "member_invites_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "member_listings_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "member_orders_id" integer;
  ALTER TABLE "member_invites" ADD CONSTRAINT "member_invites_invited_by_id_users_id_fk" FOREIGN KEY ("invited_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "member_invites" ADD CONSTRAINT "member_invites_claimed_by_id_users_id_fk" FOREIGN KEY ("claimed_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "member_listings_images" ADD CONSTRAINT "member_listings_images_image_id_media_id_fk" FOREIGN KEY ("image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "member_listings_images" ADD CONSTRAINT "member_listings_images_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."member_listings"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "member_listings" ADD CONSTRAINT "member_listings_seller_id_users_id_fk" FOREIGN KEY ("seller_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "member_listings" ADD CONSTRAINT "member_listings_buyer_id_users_id_fk" FOREIGN KEY ("buyer_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "member_orders" ADD CONSTRAINT "member_orders_listing_id_member_listings_id_fk" FOREIGN KEY ("listing_id") REFERENCES "public"."member_listings"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "member_orders" ADD CONSTRAINT "member_orders_buyer_id_users_id_fk" FOREIGN KEY ("buyer_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "member_orders" ADD CONSTRAINT "member_orders_seller_id_users_id_fk" FOREIGN KEY ("seller_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  CREATE UNIQUE INDEX "member_invites_code_idx" ON "member_invites" USING btree ("code");
  CREATE INDEX "member_invites_invited_by_idx" ON "member_invites" USING btree ("invited_by_id");
  CREATE INDEX "member_invites_claimed_by_idx" ON "member_invites" USING btree ("claimed_by_id");
  CREATE INDEX "member_invites_updated_at_idx" ON "member_invites" USING btree ("updated_at");
  CREATE INDEX "member_invites_created_at_idx" ON "member_invites" USING btree ("created_at");
  CREATE UNIQUE INDEX "code_1_idx" ON "member_invites" USING btree ("code");
  CREATE INDEX "status_6_idx" ON "member_invites" USING btree ("status");
  CREATE INDEX "invitedBy_idx" ON "member_invites" USING btree ("invited_by_id");
  CREATE INDEX "claimedBy_idx" ON "member_invites" USING btree ("claimed_by_id");
  CREATE INDEX "expiresAt_1_idx" ON "member_invites" USING btree ("expires_at");
  CREATE INDEX "member_listings_images_order_idx" ON "member_listings_images" USING btree ("_order");
  CREATE INDEX "member_listings_images_parent_id_idx" ON "member_listings_images" USING btree ("_parent_id");
  CREATE INDEX "member_listings_images_image_idx" ON "member_listings_images" USING btree ("image_id");
  CREATE INDEX "member_listings_seller_idx" ON "member_listings" USING btree ("seller_id");
  CREATE INDEX "member_listings_buyer_idx" ON "member_listings" USING btree ("buyer_id");
  CREATE INDEX "member_listings_updated_at_idx" ON "member_listings" USING btree ("updated_at");
  CREATE INDEX "member_listings_created_at_idx" ON "member_listings" USING btree ("created_at");
  CREATE INDEX "seller_idx" ON "member_listings" USING btree ("seller_id");
  CREATE INDEX "status_7_idx" ON "member_listings" USING btree ("status");
  CREATE INDEX "seller_status_idx" ON "member_listings" USING btree ("seller_id","status");
  CREATE INDEX "isActive_2_idx" ON "member_listings" USING btree ("is_active");
  CREATE INDEX "createdAt_idx" ON "member_listings" USING btree ("created_at");
  CREATE INDEX "member_orders_listing_idx" ON "member_orders" USING btree ("listing_id");
  CREATE INDEX "member_orders_buyer_idx" ON "member_orders" USING btree ("buyer_id");
  CREATE INDEX "member_orders_seller_idx" ON "member_orders" USING btree ("seller_id");
  CREATE INDEX "member_orders_updated_at_idx" ON "member_orders" USING btree ("updated_at");
  CREATE INDEX "member_orders_created_at_idx" ON "member_orders" USING btree ("created_at");
  CREATE INDEX "buyer_idx" ON "member_orders" USING btree ("buyer_id");
  CREATE INDEX "seller_1_idx" ON "member_orders" USING btree ("seller_id");
  CREATE INDEX "listing_idx" ON "member_orders" USING btree ("listing_id");
  CREATE INDEX "status_8_idx" ON "member_orders" USING btree ("status");
  CREATE INDEX "buyer_status_idx" ON "member_orders" USING btree ("buyer_id","status");
  CREATE INDEX "seller_status_1_idx" ON "member_orders" USING btree ("seller_id","status");
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_member_invites_fk" FOREIGN KEY ("member_invites_id") REFERENCES "public"."member_invites"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_member_listings_fk" FOREIGN KEY ("member_listings_id") REFERENCES "public"."member_listings"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_member_orders_fk" FOREIGN KEY ("member_orders_id") REFERENCES "public"."member_orders"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "payload_locked_documents_rels_member_invites_id_idx" ON "payload_locked_documents_rels" USING btree ("member_invites_id");
  CREATE INDEX "payload_locked_documents_rels_member_listings_id_idx" ON "payload_locked_documents_rels" USING btree ("member_listings_id");
  CREATE INDEX "payload_locked_documents_rels_member_orders_id_idx" ON "payload_locked_documents_rels" USING btree ("member_orders_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "member_invites" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "member_listings_images" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "member_listings" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "member_orders" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "member_invites" CASCADE;
  DROP TABLE "member_listings_images" CASCADE;
  DROP TABLE "member_listings" CASCADE;
  DROP TABLE "member_orders" CASCADE;
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_member_invites_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_member_listings_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_member_orders_fk";
  
  ALTER TABLE "users" ALTER COLUMN "role" SET DATA TYPE text;
  ALTER TABLE "users" ALTER COLUMN "role" SET DEFAULT 'customer'::text;
  DROP TYPE "public"."enum_users_role";
  CREATE TYPE "public"."enum_users_role" AS ENUM('admin', 'customer', 'service', 'vendor', 'driver');
  ALTER TABLE "users" ALTER COLUMN "role" SET DEFAULT 'customer'::"public"."enum_users_role";
  ALTER TABLE "users" ALTER COLUMN "role" SET DATA TYPE "public"."enum_users_role" USING "role"::"public"."enum_users_role";
  DROP INDEX "payload_locked_documents_rels_member_invites_id_idx";
  DROP INDEX "payload_locked_documents_rels_member_listings_id_idx";
  DROP INDEX "payload_locked_documents_rels_member_orders_id_idx";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "member_invites_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "member_listings_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "member_orders_id";
  DROP TYPE "public"."enum_member_invites_status";
  DROP TYPE "public"."enum_member_listings_condition";
  DROP TYPE "public"."enum_member_listings_status";
  DROP TYPE "public"."enum_member_orders_status";`)
}
