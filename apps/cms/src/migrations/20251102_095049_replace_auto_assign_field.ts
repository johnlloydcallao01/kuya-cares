import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    -- Remove the old auto_assign_to_new_merchants column
    ALTER TABLE "products" DROP COLUMN IF EXISTS "auto_assign_to_new_merchants";
    
    -- Add the new assign_to_all_vendor_merchants column
    ALTER TABLE "products" ADD COLUMN "assign_to_all_vendor_merchants" boolean DEFAULT false;
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    -- Remove the new assign_to_all_vendor_merchants column
    ALTER TABLE "products" DROP COLUMN IF EXISTS "assign_to_all_vendor_merchants";
    
    -- Restore the old auto_assign_to_new_merchants column
    ALTER TABLE "products" ADD COLUMN "auto_assign_to_new_merchants" boolean DEFAULT false;
  `)
}
