import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "products"
    ADD COLUMN IF NOT EXISTS "slug" varchar;
  `)

  await db.execute(sql`
    UPDATE "products"
    SET "slug" = lower(
      regexp_replace(
        regexp_replace(
          regexp_replace(name, '[^a-zA-Z0-9\s-]+', '', 'g'),
          '\s+', '-', 'g'
        ),
        '-+', '-', 'g'
      )
    )
    WHERE slug IS NULL OR slug = '';
  `)

  await db.execute(sql`
    ALTER TABLE "products"
    ALTER COLUMN "slug" SET NOT NULL;
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "products"
    ALTER COLUMN "slug" DROP NOT NULL;
  `)
}

