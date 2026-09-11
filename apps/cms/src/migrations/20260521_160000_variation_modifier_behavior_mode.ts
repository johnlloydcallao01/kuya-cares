import { MigrateDownArgs, MigrateUpArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    DO $$ BEGIN
      CREATE TYPE "public"."enum_prod_variations_modifier_behavior_mode" AS ENUM('inherit_product', 'variation_specific', 'hybrid');
    EXCEPTION
      WHEN duplicate_object THEN null;
    END $$;

    ALTER TABLE "prod_variations"
      ADD COLUMN IF NOT EXISTS "modifier_behavior_mode" "public"."enum_prod_variations_modifier_behavior_mode" DEFAULT 'inherit_product' NOT NULL;

    ALTER TABLE "prod_variations"
      ADD COLUMN IF NOT EXISTS "modifier_configuration_hint" varchar DEFAULT 'Choose a Modifier Behavior Mode first. Then manage the related records in Variation Modifier Groups / Options and Variation Modifier Overrides.';

    ALTER TABLE "prod_variations"
      ADD COLUMN IF NOT EXISTS "effective_modifier_preview" jsonb;
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "prod_variations" DROP COLUMN IF EXISTS "effective_modifier_preview";
    ALTER TABLE "prod_variations" DROP COLUMN IF EXISTS "modifier_configuration_hint";
    ALTER TABLE "prod_variations" DROP COLUMN IF EXISTS "modifier_behavior_mode";

    DROP TYPE IF EXISTS "public"."enum_prod_variations_modifier_behavior_mode";
  `)
}
