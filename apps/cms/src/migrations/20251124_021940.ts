import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload: _payload, req: _req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "prod_categories" DROP COLUMN "business_rules_allows_customization";
  ALTER TABLE "prod_categories" DROP COLUMN "business_rules_requires_special_handling";
  ALTER TABLE "prod_categories" DROP COLUMN "business_rules_has_expiration_dates";
  ALTER TABLE "prod_categories" DROP COLUMN "business_rules_requires_refrigeration";
  ALTER TABLE "prod_categories" DROP COLUMN "business_rules_max_delivery_time_hours";`)
}

export async function down({ db, payload: _payload, req: _req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "prod_categories" ADD COLUMN "business_rules_allows_customization" boolean DEFAULT true;
  ALTER TABLE "prod_categories" ADD COLUMN "business_rules_requires_special_handling" boolean DEFAULT false;
  ALTER TABLE "prod_categories" ADD COLUMN "business_rules_has_expiration_dates" boolean DEFAULT false;
  ALTER TABLE "prod_categories" ADD COLUMN "business_rules_requires_refrigeration" boolean DEFAULT false;
  ALTER TABLE "prod_categories" ADD COLUMN "business_rules_max_delivery_time_hours" numeric;`)
}
