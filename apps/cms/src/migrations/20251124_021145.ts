import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload: _payload, req: _req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "prod_categories" DROP COLUMN "styling_color_theme";
  ALTER TABLE "prod_categories" DROP COLUMN "styling_background_color";
  ALTER TABLE "prod_categories" DROP COLUMN "styling_text_color";
  ALTER TABLE "prod_categories" DROP COLUMN "styling_gradient_colors";
  ALTER TABLE "prod_categories" DROP COLUMN "metrics_total_products";
  ALTER TABLE "prod_categories" DROP COLUMN "metrics_total_orders";
  ALTER TABLE "prod_categories" DROP COLUMN "metrics_average_rating";
  ALTER TABLE "prod_categories" DROP COLUMN "metrics_popularity_score";
  ALTER TABLE "prod_categories" DROP COLUMN "metrics_view_count";
  ALTER TABLE "prod_categories" DROP COLUMN "promotions_is_promotional";
  ALTER TABLE "prod_categories" DROP COLUMN "promotions_promotional_text";
  ALTER TABLE "prod_categories" DROP COLUMN "promotions_discount_percentage";
  ALTER TABLE "prod_categories" DROP COLUMN "promotions_promotion_start_date";
  ALTER TABLE "prod_categories" DROP COLUMN "promotions_promotion_end_date";
  ALTER TABLE "prod_categories" DROP COLUMN "availability_available_hours";
  ALTER TABLE "prod_categories" DROP COLUMN "availability_seasonal_availability";
  ALTER TABLE "prod_categories" DROP COLUMN "availability_region_restrictions";`)
}

export async function down({ db, payload: _payload, req: _req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "prod_categories" ADD COLUMN "styling_color_theme" varchar;
  ALTER TABLE "prod_categories" ADD COLUMN "styling_background_color" varchar;
  ALTER TABLE "prod_categories" ADD COLUMN "styling_text_color" varchar;
  ALTER TABLE "prod_categories" ADD COLUMN "styling_gradient_colors" jsonb;
  ALTER TABLE "prod_categories" ADD COLUMN "metrics_total_products" numeric DEFAULT 0;
  ALTER TABLE "prod_categories" ADD COLUMN "metrics_total_orders" numeric DEFAULT 0;
  ALTER TABLE "prod_categories" ADD COLUMN "metrics_average_rating" numeric DEFAULT 0;
  ALTER TABLE "prod_categories" ADD COLUMN "metrics_popularity_score" numeric DEFAULT 0;
  ALTER TABLE "prod_categories" ADD COLUMN "metrics_view_count" numeric DEFAULT 0;
  ALTER TABLE "prod_categories" ADD COLUMN "promotions_is_promotional" boolean DEFAULT false;
  ALTER TABLE "prod_categories" ADD COLUMN "promotions_promotional_text" varchar;
  ALTER TABLE "prod_categories" ADD COLUMN "promotions_discount_percentage" numeric;
  ALTER TABLE "prod_categories" ADD COLUMN "promotions_promotion_start_date" timestamp(3) with time zone;
  ALTER TABLE "prod_categories" ADD COLUMN "promotions_promotion_end_date" timestamp(3) with time zone;
  ALTER TABLE "prod_categories" ADD COLUMN "availability_available_hours" jsonb;
  ALTER TABLE "prod_categories" ADD COLUMN "availability_seasonal_availability" jsonb;
  ALTER TABLE "prod_categories" ADD COLUMN "availability_region_restrictions" jsonb;`)
}
