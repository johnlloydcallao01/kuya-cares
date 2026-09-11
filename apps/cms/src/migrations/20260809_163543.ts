import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TYPE "public"."enum_addresses_address_type" ADD VALUE 'partner' BEFORE 'billing';`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "addresses" ALTER COLUMN "address_type" SET DATA TYPE text;
  ALTER TABLE "addresses" ALTER COLUMN "address_type" SET DEFAULT 'home'::text;
  DROP TYPE "public"."enum_addresses_address_type";
  CREATE TYPE "public"."enum_addresses_address_type" AS ENUM('home', 'work', 'billing', 'shipping', 'pickup', 'delivery');
  ALTER TABLE "addresses" ALTER COLUMN "address_type" SET DEFAULT 'home'::"public"."enum_addresses_address_type";
  ALTER TABLE "addresses" ALTER COLUMN "address_type" SET DATA TYPE "public"."enum_addresses_address_type" USING "address_type"::"public"."enum_addresses_address_type";`)
}
