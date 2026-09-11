import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "delivery_locations" ADD COLUMN "street" varchar;
  ALTER TABLE "delivery_locations" ADD COLUMN "floor_unit_room" varchar;
  ALTER TABLE "delivery_locations" ADD COLUMN "delivery_instructions" varchar;`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "delivery_locations" DROP COLUMN "street";
  ALTER TABLE "delivery_locations" DROP COLUMN "floor_unit_room";
  ALTER TABLE "delivery_locations" DROP COLUMN "delivery_instructions";`)
}
