import type { MigrateUpArgs } from '@payloadcms/db-postgres'
import { sql } from '@payloadcms/db-postgres'

type MigrationDB = MigrateUpArgs['db']
type SchemaCheck = () => Promise<{ complete: boolean; partial: boolean }>

async function ensureReconciliationTable(db: MigrationDB): Promise<void> {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "_payload_migration_reconciliation" (
      "migration_name" varchar PRIMARY KEY NOT NULL,
      "schema_preexisted" boolean NOT NULL
    )
  `)
}

export async function reconcileMigrationSchema(
  db: MigrationDB,
  migrationName: string,
  checkSchema: SchemaCheck,
): Promise<boolean> {
  await ensureReconciliationTable(db)
  const state = await checkSchema()

  if (state.partial && !state.complete) {
    throw new Error(
      `Cannot apply ${migrationName}: the database contains only part of the schema expected by this migration.`,
    )
  }

  if (!state.complete) return false

  await db.execute(sql`
    INSERT INTO "_payload_migration_reconciliation" ("migration_name", "schema_preexisted")
    VALUES (${migrationName}, true)
    ON CONFLICT ("migration_name")
    DO UPDATE SET "schema_preexisted" = EXCLUDED."schema_preexisted"
  `)
  return true
}

export async function recordMigrationSchemaApplied(
  db: MigrationDB,
  migrationName: string,
): Promise<void> {
  await ensureReconciliationTable(db)
  await db.execute(sql`
    INSERT INTO "_payload_migration_reconciliation" ("migration_name", "schema_preexisted")
    VALUES (${migrationName}, false)
    ON CONFLICT ("migration_name")
    DO UPDATE SET "schema_preexisted" = EXCLUDED."schema_preexisted"
  `)
}

export async function migrationSchemaPreexisted(
  db: MigrationDB,
  migrationName: string,
): Promise<boolean> {
  const { rows: tableRows } = await db.execute(sql`
    SELECT to_regclass('public._payload_migration_reconciliation') IS NOT NULL AS "exists"
  `)
  if (tableRows[0]?.exists !== true) return false

  const { rows } = await db.execute(sql`
    SELECT "schema_preexisted"
    FROM "_payload_migration_reconciliation"
    WHERE "migration_name" = ${migrationName}
  `)
  return rows[0]?.schema_preexisted === true
}

export async function clearMigrationSchemaState(
  db: MigrationDB,
  migrationName: string,
): Promise<void> {
  const { rows: tableRows } = await db.execute(sql`
    SELECT to_regclass('public._payload_migration_reconciliation') IS NOT NULL AS "exists"
  `)
  if (tableRows[0]?.exists !== true) return

  await db.execute(sql`
    DELETE FROM "_payload_migration_reconciliation"
    WHERE "migration_name" = ${migrationName}
  `)
  const { rows } = await db.execute(sql`
    SELECT NOT EXISTS (SELECT 1 FROM "_payload_migration_reconciliation") AS "empty"
  `)
  if (rows[0]?.empty === true) {
    await db.execute(sql`DROP TABLE "_payload_migration_reconciliation"`)
  }
}
