import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload: _payload, req: _req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_recent_searches_scope" AS ENUM('restaurants', 'merchant_menu', 'global');
  CREATE TYPE "public"."enum_recent_searches_source" AS ENUM('web', 'mobile', 'unknown');
  CREATE TABLE "recent_searches" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"user_id" integer NOT NULL,
  	"query" varchar NOT NULL,
  	"normalized_query" varchar NOT NULL,
  	"scope" "enum_recent_searches_scope" DEFAULT 'restaurants' NOT NULL,
  	"composite_key" varchar,
  	"frequency" numeric DEFAULT 1 NOT NULL,
  	"source" "enum_recent_searches_source" DEFAULT 'unknown',
  	"device_id" varchar,
  	"address_text" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "recent_searches_id" integer;
  ALTER TABLE "recent_searches" ADD CONSTRAINT "recent_searches_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "recent_searches_user_idx" ON "recent_searches" USING btree ("user_id");
  CREATE UNIQUE INDEX "recent_searches_composite_key_idx" ON "recent_searches" USING btree ("composite_key");
  CREATE INDEX "recent_searches_updated_at_idx" ON "recent_searches" USING btree ("updated_at");
  CREATE INDEX "recent_searches_created_at_idx" ON "recent_searches" USING btree ("created_at");
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_recent_searches_fk" FOREIGN KEY ("recent_searches_id") REFERENCES "public"."recent_searches"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "payload_locked_documents_rels_recent_searches_id_idx" ON "payload_locked_documents_rels" USING btree ("recent_searches_id");`)
}

export async function down({ db, payload: _payload, req: _req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "recent_searches" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "recent_searches" CASCADE;
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_recent_searches_fk";
  
  DROP INDEX "payload_locked_documents_rels_recent_searches_id_idx";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "recent_searches_id";
  DROP TYPE "public"."enum_recent_searches_scope";
  DROP TYPE "public"."enum_recent_searches_source";
  `)
}
