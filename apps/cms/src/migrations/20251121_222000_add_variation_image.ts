import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "prod_variations"
    ADD COLUMN IF NOT EXISTS "image_id" integer;
  `)

  await db.execute(sql`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'prod_variations_image_id_media_id_fk'
      ) THEN
        ALTER TABLE "prod_variations"
        ADD CONSTRAINT "prod_variations_image_id_media_id_fk"
        FOREIGN KEY ("image_id") REFERENCES "media"("id") ON DELETE SET NULL ON UPDATE NO ACTION;
      END IF;
    END $$;
  `)

  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS "prod_variations_image_id_idx" ON "prod_variations"("image_id");
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    DO $$
    BEGIN
      IF EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'prod_variations_image_id_media_id_fk'
      ) THEN
        ALTER TABLE "prod_variations" DROP CONSTRAINT "prod_variations_image_id_media_id_fk";
      END IF;
    END $$;
  `)

  await db.execute(sql`
    DROP INDEX IF EXISTS "prod_variations_image_id_idx";
  `)

  await db.execute(sql`
    ALTER TABLE "prod_variations"
    DROP COLUMN IF EXISTS "image_id";
  `)
}

