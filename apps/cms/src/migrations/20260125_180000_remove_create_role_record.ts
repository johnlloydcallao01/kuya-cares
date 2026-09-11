import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  // Drop the obsolete function and its dependent triggers which are causing "case not found" errors
  await db.execute(sql`
    DROP FUNCTION IF EXISTS create_role_record() CASCADE;
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  // We cannot easily restore the obsolete function as its source is lost/unknown
  // and it was buggy anyway.
}
