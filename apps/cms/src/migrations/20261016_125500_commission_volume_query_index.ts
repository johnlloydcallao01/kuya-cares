import { MigrateDownArgs, MigrateUpArgs, sql } from '@payloadcms/db-postgres'
import {
  clearMigrationSchemaState,
  migrationSchemaPreexisted,
  reconcileMigrationSchema,
  recordMigrationSchemaApplied,
} from '../utils/migrationReconciliation'

const migrationName = '20261016_125500_commission_volume_query_index'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  const schemaPreexisted = await reconcileMigrationSchema(db, migrationName, async () => {
    const { rows } = await db.execute(sql`
      SELECT
        EXISTS (
          SELECT 1 FROM pg_indexes
          WHERE schemaname = 'public' AND indexname = 'transactions_status_paid_at_idx'
        ) AS "complete",
        EXISTS (
          SELECT 1 FROM pg_indexes
          WHERE schemaname = 'public' AND indexname = 'transactions_status_paid_at_idx'
        ) AS "partial"
    `)
    return {
      complete: rows[0]?.complete === true,
      partial: rows[0]?.partial === true,
    }
  })
  if (schemaPreexisted) return

  await db.execute(sql`
    CREATE INDEX "transactions_status_paid_at_idx"
      ON "transactions" USING btree ("status", "paid_at");
  `)
  await recordMigrationSchemaApplied(db, migrationName)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  if (await migrationSchemaPreexisted(db, migrationName)) {
    await clearMigrationSchemaState(db, migrationName)
    return
  }

  await db.execute(sql`
    DROP INDEX "transactions_status_paid_at_idx";
  `)
  await clearMigrationSchemaState(db, migrationName)
}
