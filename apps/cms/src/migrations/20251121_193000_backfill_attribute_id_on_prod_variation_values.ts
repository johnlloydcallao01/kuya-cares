import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    UPDATE "prod_variation_values" AS pv
    SET "attribute_id_id" = pat."attribute_id_id"
    FROM "prod_attribute_terms" AS pat
    WHERE pv."term_id_id" = pat."id"
      AND (pv."attribute_id_id" IS NULL OR pv."attribute_id_id" <> pat."attribute_id_id");
  `)

  await db.execute(sql`
    DELETE FROM "prod_variation_values"
    WHERE "attribute_id_id" IS NULL;
  `)

  await db.execute(sql`
    ALTER TABLE "prod_variation_values"
    ALTER COLUMN "attribute_id_id" SET NOT NULL;
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "prod_variation_values"
    ALTER COLUMN "attribute_id_id" DROP NOT NULL;
  `)
}
