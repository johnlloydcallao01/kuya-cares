import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    UPDATE "products"
    SET "sku" = ("slug" || '-' || "id")
    WHERE "sku" IS NULL OR "sku" = '';
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    UPDATE "products" SET "sku" = NULL WHERE "sku" ~ '^[a-z0-9\-]+$';
  `)
}

