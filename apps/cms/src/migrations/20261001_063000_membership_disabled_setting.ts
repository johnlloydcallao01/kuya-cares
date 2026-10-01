import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * Catch-up for the membership baseline (20261001_061959).
 *
 * The rest of the membership schema reached the database via dev-mode push
 * before the baseline file was generated, so the baseline can never execute
 * (its CREATE statements target objects that already exist). This file
 * carries the single statement that was still missing:
 * System Settings -> membership.paymongoMembershipDisabled.
 */
export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "system_settings" ADD COLUMN "membership_paymongo_membership_disabled" boolean DEFAULT false;
  `)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "system_settings" DROP COLUMN "membership_paymongo_membership_disabled";
  `)
}
