import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    UPDATE "prod_variations" AS pv
    SET "sku" = upper(p."slug" || '-' || pv."id")
    FROM "products" AS p
    WHERE p."id" = pv."product_id_id"
      AND (pv."sku" IS NULL OR pv."sku" = '');
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    UPDATE "prod_variations" SET "sku" = NULL WHERE "sku" ~ '^[A-Z0-9\-]+$';
  `)
}