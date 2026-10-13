import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    UPDATE "orders" AS o
    SET "commission_status" = 'legacy'
    WHERE o."commission_status" = 'pending'
      AND EXISTS (
        SELECT 1
        FROM "transactions" AS t
        WHERE t."order_id" = o."id"
          AND t."status"::text IN ('paid', 'partially_refunded', 'refunded')
      );
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    UPDATE "orders"
    SET "commission_status" = 'pending'
    WHERE "commission_status" = 'legacy';
  `)
}
