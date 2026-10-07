import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * Adds the unified private-marketplace `member` role to the users enum.
 *
 * Additive-only: existing roles (admin/customer/service/vendor/driver) are
 * untouched. Follows the database-modification-guide Example 2 (enum
 * additions need a manual migration) and the DO-block idempotency pattern
 * from 20251124_120500_add_driver_role_and_drivers_table.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    DO $$ BEGIN
      ALTER TYPE "public"."enum_users_role" ADD VALUE 'member';
    EXCEPTION
      WHEN duplicate_object THEN NULL;
    END $$;
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  // Note: PostgreSQL doesn't support removing enum values.
  // This migration is not reversible.
  void db
}
