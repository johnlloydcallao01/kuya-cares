import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_system_settings_delivery_provider" AS ENUM('lalamove', 'native');
  ALTER TABLE "system_settings" ADD COLUMN "delivery_provider" "enum_system_settings_delivery_provider" DEFAULT 'lalamove' NOT NULL;
  ALTER TABLE "system_settings" ADD COLUMN "lalamove_api_key" varchar;
  ALTER TABLE "system_settings" ADD COLUMN "lalamove_api_secret" varchar;
  ALTER TABLE "system_settings" ADD COLUMN "lalamove_market" varchar DEFAULT 'PH';
  ALTER TABLE "system_settings" ADD COLUMN "lalamove_sandbox" boolean DEFAULT true;
  ALTER TABLE "system_settings" ADD COLUMN "native_rider_app_url" varchar;`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "system_settings" DROP COLUMN "delivery_provider";
  ALTER TABLE "system_settings" DROP COLUMN "lalamove_api_key";
  ALTER TABLE "system_settings" DROP COLUMN "lalamove_api_secret";
  ALTER TABLE "system_settings" DROP COLUMN "lalamove_market";
  ALTER TABLE "system_settings" DROP COLUMN "lalamove_sandbox";
  ALTER TABLE "system_settings" DROP COLUMN "native_rider_app_url";
  DROP TYPE "public"."enum_system_settings_delivery_provider";`)
}
