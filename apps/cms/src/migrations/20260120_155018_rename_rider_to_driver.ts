import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_driver_assignments_status" AS ENUM('offered', 'accepted', 'rejected', 'completed');
  CREATE TABLE "driver_assignments" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order_id" integer NOT NULL,
  	"driver_id" integer NOT NULL,
  	"status" "enum_driver_assignments_status" DEFAULT 'offered' NOT NULL,
  	"assigned_at" timestamp(3) with time zone NOT NULL,
  	"accepted_at" timestamp(3) with time zone,
  	"completed_at" timestamp(3) with time zone,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  ALTER TABLE "rider_assignments" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "rider_assignments" CASCADE;
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_rider_assignments_fk";
  
  DROP INDEX IF EXISTS "payload_locked_documents_rels_rider_assignments_id_idx";
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "driver_assignments_id" integer;
  ALTER TABLE "driver_assignments" ADD CONSTRAINT "driver_assignments_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "driver_assignments" ADD CONSTRAINT "driver_assignments_driver_id_drivers_id_fk" FOREIGN KEY ("driver_id") REFERENCES "public"."drivers"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "driver_assignments_order_idx" ON "driver_assignments" USING btree ("order_id");
  CREATE INDEX "driver_assignments_driver_idx" ON "driver_assignments" USING btree ("driver_id");
  CREATE INDEX "driver_assignments_updated_at_idx" ON "driver_assignments" USING btree ("updated_at");
  CREATE INDEX "driver_assignments_created_at_idx" ON "driver_assignments" USING btree ("created_at");
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_driver_assignments_fk" FOREIGN KEY ("driver_assignments_id") REFERENCES "public"."driver_assignments"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "payload_locked_documents_rels_driver_assignments_id_idx" ON "payload_locked_documents_rels" USING btree ("driver_assignments_id");
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "rider_assignments_id";
  DROP TYPE "public"."enum_rider_assignments_status";`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_rider_assignments_status" AS ENUM('offered', 'accepted', 'rejected', 'completed');
  CREATE TABLE "rider_assignments" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order_id" integer NOT NULL,
  	"driver_id" integer NOT NULL,
  	"status" "enum_rider_assignments_status" DEFAULT 'offered' NOT NULL,
  	"assigned_at" timestamp(3) with time zone NOT NULL,
  	"accepted_at" timestamp(3) with time zone,
  	"completed_at" timestamp(3) with time zone,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  ALTER TABLE "driver_assignments" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "driver_assignments" CASCADE;
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_driver_assignments_fk";
  
  DROP INDEX "payload_locked_documents_rels_driver_assignments_id_idx";
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "rider_assignments_id" integer;
  ALTER TABLE "rider_assignments" ADD CONSTRAINT "rider_assignments_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "rider_assignments" ADD CONSTRAINT "rider_assignments_driver_id_drivers_id_fk" FOREIGN KEY ("driver_id") REFERENCES "public"."drivers"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "rider_assignments_order_idx" ON "rider_assignments" USING btree ("order_id");
  CREATE INDEX "rider_assignments_driver_idx" ON "rider_assignments" USING btree ("driver_id");
  CREATE INDEX "rider_assignments_updated_at_idx" ON "rider_assignments" USING btree ("updated_at");
  CREATE INDEX "rider_assignments_created_at_idx" ON "rider_assignments" USING btree ("created_at");
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_rider_assignments_fk" FOREIGN KEY ("rider_assignments_id") REFERENCES "public"."rider_assignments"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "payload_locked_documents_rels_rider_assignments_id_idx" ON "payload_locked_documents_rels" USING btree ("rider_assignments_id");
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "driver_assignments_id";
  DROP TYPE "public"."enum_driver_assignments_status";`)
}
