import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "addresses" ADD COLUMN "street" varchar;
  ALTER TABLE "addresses" ADD COLUMN "floor_unit_room" varchar;
  ALTER TABLE "addresses" ADD COLUMN "delivery_instructions" varchar;
  ALTER TABLE "addresses" ADD COLUMN "label" varchar;`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "addresses" DROP COLUMN "street";
  ALTER TABLE "addresses" DROP COLUMN "floor_unit_room";
  ALTER TABLE "addresses" DROP COLUMN "delivery_instructions";
  ALTER TABLE "addresses" DROP COLUMN "label";`)
}
