import { MigrateDownArgs, MigrateUpArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    CREATE TYPE "public"."enum_products_approval_status" AS ENUM ('pending', 'approved', 'disapproved');

    ALTER TABLE "products"
      ADD COLUMN "approval_status" "public"."enum_products_approval_status";

    UPDATE "products"
      SET "approval_status" = 'approved';

    ALTER TABLE "products"
      ALTER COLUMN "approval_status" SET DEFAULT 'pending',
      ALTER COLUMN "approval_status" SET NOT NULL;
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "products" DROP COLUMN "approval_status";
    DROP TYPE "public"."enum_products_approval_status";
  `)
}
