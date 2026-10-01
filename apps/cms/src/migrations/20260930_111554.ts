import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_support_tickets_status" AS ENUM('open', 'in_progress', 'waiting_for_user', 'resolved', 'closed');
  CREATE TYPE "public"."enum_support_tickets_priority" AS ENUM('low', 'medium', 'high', 'critical');
  CREATE TYPE "public"."enum_support_tickets_category" AS ENUM('order_issue', 'delivery', 'payment_refund', 'product', 'account', 'technical', 'general');
  CREATE TABLE "support_tickets" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"subject" varchar NOT NULL,
  	"status" "enum_support_tickets_status" DEFAULT 'open' NOT NULL,
  	"priority" "enum_support_tickets_priority" DEFAULT 'medium' NOT NULL,
  	"category" "enum_support_tickets_category" NOT NULL,
  	"user_id" integer NOT NULL,
  	"order_id" integer,
  	"merchant_id" integer,
  	"product_id" integer,
  	"assigned_to_id" integer,
  	"last_message_at" timestamp(3) with time zone,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "support_tickets_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"media_id" integer
  );
  
  CREATE TABLE "support_ticket_messages" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"ticket_id" integer NOT NULL,
  	"sender_id" integer NOT NULL,
  	"message" jsonb NOT NULL,
  	"is_internal" boolean DEFAULT false,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "support_ticket_messages_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"media_id" integer
  );
  
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "support_tickets_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "support_ticket_messages_id" integer;
  ALTER TABLE "support_tickets" ADD CONSTRAINT "support_tickets_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "support_tickets" ADD CONSTRAINT "support_tickets_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "support_tickets" ADD CONSTRAINT "support_tickets_merchant_id_merchants_id_fk" FOREIGN KEY ("merchant_id") REFERENCES "public"."merchants"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "support_tickets" ADD CONSTRAINT "support_tickets_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "support_tickets" ADD CONSTRAINT "support_tickets_assigned_to_id_users_id_fk" FOREIGN KEY ("assigned_to_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "support_tickets_rels" ADD CONSTRAINT "support_tickets_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."support_tickets"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "support_tickets_rels" ADD CONSTRAINT "support_tickets_rels_media_fk" FOREIGN KEY ("media_id") REFERENCES "public"."media"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "support_ticket_messages" ADD CONSTRAINT "support_ticket_messages_ticket_id_support_tickets_id_fk" FOREIGN KEY ("ticket_id") REFERENCES "public"."support_tickets"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "support_ticket_messages" ADD CONSTRAINT "support_ticket_messages_sender_id_users_id_fk" FOREIGN KEY ("sender_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "support_ticket_messages_rels" ADD CONSTRAINT "support_ticket_messages_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."support_ticket_messages"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "support_ticket_messages_rels" ADD CONSTRAINT "support_ticket_messages_rels_media_fk" FOREIGN KEY ("media_id") REFERENCES "public"."media"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "support_tickets_user_idx" ON "support_tickets" USING btree ("user_id");
  CREATE INDEX "support_tickets_order_idx" ON "support_tickets" USING btree ("order_id");
  CREATE INDEX "support_tickets_merchant_idx" ON "support_tickets" USING btree ("merchant_id");
  CREATE INDEX "support_tickets_product_idx" ON "support_tickets" USING btree ("product_id");
  CREATE INDEX "support_tickets_assigned_to_idx" ON "support_tickets" USING btree ("assigned_to_id");
  CREATE INDEX "support_tickets_updated_at_idx" ON "support_tickets" USING btree ("updated_at");
  CREATE INDEX "support_tickets_created_at_idx" ON "support_tickets" USING btree ("created_at");
  CREATE INDEX "user_7_idx" ON "support_tickets" USING btree ("user_id");
  CREATE INDEX "assignedTo_idx" ON "support_tickets" USING btree ("assigned_to_id");
  CREATE INDEX "status_5_idx" ON "support_tickets" USING btree ("status");
  CREATE INDEX "updatedAt_1_idx" ON "support_tickets" USING btree ("updated_at");
  CREATE INDEX "support_tickets_rels_order_idx" ON "support_tickets_rels" USING btree ("order");
  CREATE INDEX "support_tickets_rels_parent_idx" ON "support_tickets_rels" USING btree ("parent_id");
  CREATE INDEX "support_tickets_rels_path_idx" ON "support_tickets_rels" USING btree ("path");
  CREATE INDEX "support_tickets_rels_media_id_idx" ON "support_tickets_rels" USING btree ("media_id");
  CREATE INDEX "support_ticket_messages_ticket_idx" ON "support_ticket_messages" USING btree ("ticket_id");
  CREATE INDEX "support_ticket_messages_sender_idx" ON "support_ticket_messages" USING btree ("sender_id");
  CREATE INDEX "support_ticket_messages_updated_at_idx" ON "support_ticket_messages" USING btree ("updated_at");
  CREATE INDEX "support_ticket_messages_created_at_idx" ON "support_ticket_messages" USING btree ("created_at");
  CREATE INDEX "support_ticket_messages_rels_order_idx" ON "support_ticket_messages_rels" USING btree ("order");
  CREATE INDEX "support_ticket_messages_rels_parent_idx" ON "support_ticket_messages_rels" USING btree ("parent_id");
  CREATE INDEX "support_ticket_messages_rels_path_idx" ON "support_ticket_messages_rels" USING btree ("path");
  CREATE INDEX "support_ticket_messages_rels_media_id_idx" ON "support_ticket_messages_rels" USING btree ("media_id");
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_support_tickets_fk" FOREIGN KEY ("support_tickets_id") REFERENCES "public"."support_tickets"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_support_ticket_messages_fk" FOREIGN KEY ("support_ticket_messages_id") REFERENCES "public"."support_ticket_messages"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "payload_locked_documents_rels_support_tickets_id_idx" ON "payload_locked_documents_rels" USING btree ("support_tickets_id");
  CREATE INDEX "payload_locked_documents_rels_support_ticket_messages_id_idx" ON "payload_locked_documents_rels" USING btree ("support_ticket_messages_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "support_tickets" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "support_tickets_rels" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "support_ticket_messages" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "support_ticket_messages_rels" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "support_tickets" CASCADE;
  DROP TABLE "support_tickets_rels" CASCADE;
  DROP TABLE "support_ticket_messages" CASCADE;
  DROP TABLE "support_ticket_messages_rels" CASCADE;
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_support_tickets_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_support_ticket_messages_fk";
  
  DROP INDEX "payload_locked_documents_rels_support_tickets_id_idx";
  DROP INDEX "payload_locked_documents_rels_support_ticket_messages_id_idx";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "support_tickets_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "support_ticket_messages_id";
  DROP TYPE "public"."enum_support_tickets_status";
  DROP TYPE "public"."enum_support_tickets_priority";
  DROP TYPE "public"."enum_support_tickets_category";`)
}
