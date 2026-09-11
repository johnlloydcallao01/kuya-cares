import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "delivery_locations" ADD COLUMN "merchant_formatted_address" varchar;
  ALTER TABLE "delivery_locations" ADD COLUMN "merchant_coordinates" jsonb;
  ALTER TABLE "delivery_locations" ADD COLUMN "merchant_street" varchar;
  ALTER TABLE "delivery_locations" ADD COLUMN "merchant_floor_unit_room" varchar;
  ALTER TABLE "delivery_locations" ADD COLUMN "merchant_delivery_instructions" varchar;
  ALTER TABLE "delivery_locations" ADD COLUMN "merchant_label" varchar;`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "delivery_locations" DROP COLUMN "merchant_formatted_address";
  ALTER TABLE "delivery_locations" DROP COLUMN "merchant_coordinates";
  ALTER TABLE "delivery_locations" DROP COLUMN "merchant_street";
  ALTER TABLE "delivery_locations" DROP COLUMN "merchant_floor_unit_room";
  ALTER TABLE "delivery_locations" DROP COLUMN "merchant_delivery_instructions";
  ALTER TABLE "delivery_locations" DROP COLUMN "merchant_label";`)
}
