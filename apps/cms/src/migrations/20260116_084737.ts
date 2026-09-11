import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_notification_templates_default_channels" AS ENUM('in_app', 'email', 'push', 'sms');
  CREATE TYPE "public"."enum_notification_templates_domain" AS ENUM('order', 'account', 'system', 'marketing', 'custom');
  CREATE TYPE "public"."enum_notification_templates_severity" AS ENUM('info', 'warning', 'critical');
  CREATE TYPE "public"."enum_notification_events_domain" AS ENUM('order', 'account', 'system', 'marketing', 'custom');
  CREATE TYPE "public"."enum_notification_events_origin" AS ENUM('automatic', 'manual');
  CREATE TYPE "public"."enum_notification_events_priority" AS ENUM('info', 'warning', 'critical');
  CREATE TYPE "public"."enum_user_notifications_channel" AS ENUM('in_app', 'email', 'push', 'sms');
  CREATE TYPE "public"."enum_user_notifications_status" AS ENUM('unread', 'read', 'dismissed', 'hidden');
  CREATE TABLE "notification_templates_default_channels" (
  	"order" integer NOT NULL,
  	"parent_id" integer NOT NULL,
  	"value" "enum_notification_templates_default_channels",
  	"id" serial PRIMARY KEY NOT NULL
  );
  
  CREATE TABLE "notification_templates" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"type_key" varchar NOT NULL,
  	"domain" "enum_notification_templates_domain" NOT NULL,
  	"title_template" varchar NOT NULL,
  	"body_template" varchar NOT NULL,
  	"severity" "enum_notification_templates_severity" DEFAULT 'info' NOT NULL,
  	"is_active" boolean DEFAULT true,
  	"created_by_id" integer,
  	"updated_by_id" integer,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "notification_events" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"type_key" varchar NOT NULL,
  	"domain" "enum_notification_events_domain" NOT NULL,
  	"source_entity_type" varchar,
  	"source_entity_id" varchar,
  	"template_id" integer,
  	"origin" "enum_notification_events_origin" DEFAULT 'automatic' NOT NULL,
  	"triggered_by_id" integer,
  	"title" varchar NOT NULL,
  	"body" varchar NOT NULL,
  	"metadata" jsonb,
  	"priority" "enum_notification_events_priority" DEFAULT 'info' NOT NULL,
  	"scheduled_at" timestamp(3) with time zone,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "user_notifications" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"user_id" integer NOT NULL,
  	"notification_event_id" integer NOT NULL,
  	"channel" "enum_user_notifications_channel" DEFAULT 'in_app' NOT NULL,
  	"status" "enum_user_notifications_status" DEFAULT 'unread' NOT NULL,
  	"delivered_at" timestamp(3) with time zone,
  	"read_at" timestamp(3) with time zone,
  	"archived_at" timestamp(3) with time zone,
  	"is_pinned" boolean DEFAULT false,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "notification_templates_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "notification_events_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "user_notifications_id" integer;
  ALTER TABLE "notification_templates_default_channels" ADD CONSTRAINT "notification_templates_default_channels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."notification_templates"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "notification_templates" ADD CONSTRAINT "notification_templates_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "notification_templates" ADD CONSTRAINT "notification_templates_updated_by_id_users_id_fk" FOREIGN KEY ("updated_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "notification_events" ADD CONSTRAINT "notification_events_template_id_notification_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."notification_templates"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "notification_events" ADD CONSTRAINT "notification_events_triggered_by_id_users_id_fk" FOREIGN KEY ("triggered_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "user_notifications" ADD CONSTRAINT "user_notifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "user_notifications" ADD CONSTRAINT "user_notifications_notification_event_id_notification_events_id_fk" FOREIGN KEY ("notification_event_id") REFERENCES "public"."notification_events"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "notification_templates_default_channels_order_idx" ON "notification_templates_default_channels" USING btree ("order");
  CREATE INDEX "notification_templates_default_channels_parent_idx" ON "notification_templates_default_channels" USING btree ("parent_id");
  CREATE UNIQUE INDEX "notification_templates_type_key_idx" ON "notification_templates" USING btree ("type_key");
  CREATE INDEX "notification_templates_created_by_idx" ON "notification_templates" USING btree ("created_by_id");
  CREATE INDEX "notification_templates_updated_by_idx" ON "notification_templates" USING btree ("updated_by_id");
  CREATE INDEX "notification_templates_updated_at_idx" ON "notification_templates" USING btree ("updated_at");
  CREATE INDEX "notification_templates_created_at_idx" ON "notification_templates" USING btree ("created_at");
  CREATE INDEX "notification_events_template_idx" ON "notification_events" USING btree ("template_id");
  CREATE INDEX "notification_events_triggered_by_idx" ON "notification_events" USING btree ("triggered_by_id");
  CREATE INDEX "notification_events_updated_at_idx" ON "notification_events" USING btree ("updated_at");
  CREATE INDEX "notification_events_created_at_idx" ON "notification_events" USING btree ("created_at");
  CREATE INDEX "user_notifications_user_idx" ON "user_notifications" USING btree ("user_id");
  CREATE INDEX "user_notifications_notification_event_idx" ON "user_notifications" USING btree ("notification_event_id");
  CREATE INDEX "user_notifications_updated_at_idx" ON "user_notifications" USING btree ("updated_at");
  CREATE INDEX "user_notifications_created_at_idx" ON "user_notifications" USING btree ("created_at");
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_notification_templates_fk" FOREIGN KEY ("notification_templates_id") REFERENCES "public"."notification_templates"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_notification_events_fk" FOREIGN KEY ("notification_events_id") REFERENCES "public"."notification_events"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_user_notifications_fk" FOREIGN KEY ("user_notifications_id") REFERENCES "public"."user_notifications"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "payload_locked_documents_rels_notification_templates_id_idx" ON "payload_locked_documents_rels" USING btree ("notification_templates_id");
  CREATE INDEX "payload_locked_documents_rels_notification_events_id_idx" ON "payload_locked_documents_rels" USING btree ("notification_events_id");
  CREATE INDEX "payload_locked_documents_rels_user_notifications_id_idx" ON "payload_locked_documents_rels" USING btree ("user_notifications_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "notification_templates_default_channels" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "notification_templates" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "notification_events" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "user_notifications" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "notification_templates_default_channels" CASCADE;
  DROP TABLE "notification_templates" CASCADE;
  DROP TABLE "notification_events" CASCADE;
  DROP TABLE "user_notifications" CASCADE;
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_notification_templates_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_notification_events_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_user_notifications_fk";
  
  DROP INDEX "payload_locked_documents_rels_notification_templates_id_idx";
  DROP INDEX "payload_locked_documents_rels_notification_events_id_idx";
  DROP INDEX "payload_locked_documents_rels_user_notifications_id_idx";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "notification_templates_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "notification_events_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "user_notifications_id";
  DROP TYPE "public"."enum_notification_templates_default_channels";
  DROP TYPE "public"."enum_notification_templates_domain";
  DROP TYPE "public"."enum_notification_templates_severity";
  DROP TYPE "public"."enum_notification_events_domain";
  DROP TYPE "public"."enum_notification_events_origin";
  DROP TYPE "public"."enum_notification_events_priority";
  DROP TYPE "public"."enum_user_notifications_channel";
  DROP TYPE "public"."enum_user_notifications_status";`)
}
