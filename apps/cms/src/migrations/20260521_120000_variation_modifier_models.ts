import { MigrateDownArgs, MigrateUpArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    DO $$ BEGIN
      CREATE TYPE "public"."enum_variation_modifier_groups_selection_type" AS ENUM('single', 'multiple');
    EXCEPTION
      WHEN duplicate_object THEN null;
    END $$;

    DO $$ BEGIN
      CREATE TYPE "public"."enum_variation_modifier_group_overrides_mode" AS ENUM('inherit', 'hide', 'override');
    EXCEPTION
      WHEN duplicate_object THEN null;
    END $$;

    DO $$ BEGIN
      CREATE TYPE "public"."enum_variation_modifier_group_overrides_required_behavior" AS ENUM('inherit', 'required', 'optional');
    EXCEPTION
      WHEN duplicate_object THEN null;
    END $$;

    DO $$ BEGIN
      CREATE TYPE "public"."enum_variation_modifier_option_overrides_mode" AS ENUM('inherit', 'hide', 'override');
    EXCEPTION
      WHEN duplicate_object THEN null;
    END $$;

    DO $$ BEGIN
      CREATE TYPE "public"."enum_variation_modifier_option_overrides_default_behavior" AS ENUM('inherit', 'default', 'not_default');
    EXCEPTION
      WHEN duplicate_object THEN null;
    END $$;

    DO $$ BEGIN
      CREATE TYPE "public"."enum_variation_modifier_option_overrides_availability_behavior" AS ENUM('inherit', 'available', 'unavailable');
    EXCEPTION
      WHEN duplicate_object THEN null;
    END $$;

    CREATE TABLE "variation_modifier_groups" (
      "id" serial PRIMARY KEY NOT NULL,
      "variation_id" integer NOT NULL,
      "name" varchar NOT NULL,
      "selection_type" "public"."enum_variation_modifier_groups_selection_type" DEFAULT 'single' NOT NULL,
      "is_required" boolean DEFAULT false,
      "min_selections" numeric DEFAULT 0,
      "max_selections" numeric,
      "sort_order" numeric DEFAULT 0,
      "is_active" boolean DEFAULT true,
      "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
      "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
    );

    CREATE TABLE "variation_modifier_options" (
      "id" serial PRIMARY KEY NOT NULL,
      "variation_modifier_group_id" integer NOT NULL,
      "name" varchar NOT NULL,
      "price_adjustment" numeric DEFAULT 0,
      "is_default" boolean DEFAULT false,
      "is_available" boolean DEFAULT true,
      "sort_order" numeric DEFAULT 0,
      "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
      "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
    );

    CREATE TABLE "variation_modifier_group_overrides" (
      "id" serial PRIMARY KEY NOT NULL,
      "variation_id" integer NOT NULL,
      "base_modifier_group_id" integer NOT NULL,
      "mode" "public"."enum_variation_modifier_group_overrides_mode" DEFAULT 'inherit' NOT NULL,
      "name_override" varchar,
      "selection_type_override" "public"."enum_variation_modifier_groups_selection_type",
      "required_behavior" "public"."enum_variation_modifier_group_overrides_required_behavior" DEFAULT 'inherit',
      "min_selections_override" numeric,
      "max_selections_override" numeric,
      "sort_order_override" numeric,
      "is_active" boolean DEFAULT true,
      "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
      "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
    );

    CREATE TABLE "variation_modifier_option_overrides" (
      "id" serial PRIMARY KEY NOT NULL,
      "variation_id" integer NOT NULL,
      "base_modifier_option_id" integer NOT NULL,
      "mode" "public"."enum_variation_modifier_option_overrides_mode" DEFAULT 'inherit' NOT NULL,
      "name_override" varchar,
      "price_adjustment_override" numeric,
      "default_behavior" "public"."enum_variation_modifier_option_overrides_default_behavior" DEFAULT 'inherit',
      "availability_behavior" "public"."enum_variation_modifier_option_overrides_availability_behavior" DEFAULT 'inherit',
      "sort_order_override" numeric,
      "is_active" boolean DEFAULT true,
      "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
      "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
    );

    ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "variation_modifier_groups_id" integer;
    ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "variation_modifier_options_id" integer;
    ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "variation_modifier_group_overrides_id" integer;
    ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "variation_modifier_option_overrides_id" integer;

    ALTER TABLE "variation_modifier_groups"
      ADD CONSTRAINT "variation_modifier_groups_variation_id_prod_variations_id_fk"
      FOREIGN KEY ("variation_id") REFERENCES "public"."prod_variations"("id") ON DELETE cascade ON UPDATE no action;

    ALTER TABLE "variation_modifier_options"
      ADD CONSTRAINT "variation_modifier_options_variation_modifier_group_id_variation_modifier_groups_id_fk"
      FOREIGN KEY ("variation_modifier_group_id") REFERENCES "public"."variation_modifier_groups"("id") ON DELETE cascade ON UPDATE no action;

    ALTER TABLE "variation_modifier_group_overrides"
      ADD CONSTRAINT "variation_modifier_group_overrides_variation_id_prod_variations_id_fk"
      FOREIGN KEY ("variation_id") REFERENCES "public"."prod_variations"("id") ON DELETE cascade ON UPDATE no action;

    ALTER TABLE "variation_modifier_group_overrides"
      ADD CONSTRAINT "variation_modifier_group_overrides_base_modifier_group_id_modifier_groups_id_fk"
      FOREIGN KEY ("base_modifier_group_id") REFERENCES "public"."modifier_groups"("id") ON DELETE cascade ON UPDATE no action;

    ALTER TABLE "variation_modifier_option_overrides"
      ADD CONSTRAINT "variation_modifier_option_overrides_variation_id_prod_variations_id_fk"
      FOREIGN KEY ("variation_id") REFERENCES "public"."prod_variations"("id") ON DELETE cascade ON UPDATE no action;

    ALTER TABLE "variation_modifier_option_overrides"
      ADD CONSTRAINT "variation_modifier_option_overrides_base_modifier_option_id_modifier_options_id_fk"
      FOREIGN KEY ("base_modifier_option_id") REFERENCES "public"."modifier_options"("id") ON DELETE cascade ON UPDATE no action;

    ALTER TABLE "cart_items" DROP CONSTRAINT IF EXISTS "cart_items_selected_variation_id_products_id_fk";
    ALTER TABLE "cart_items"
      ADD CONSTRAINT "cart_items_selected_variation_id_prod_variations_id_fk"
      FOREIGN KEY ("selected_variation_id") REFERENCES "public"."prod_variations"("id") ON DELETE set null ON UPDATE no action;

    CREATE INDEX "variation_modifier_groups_variation_sort_idx" ON "variation_modifier_groups" USING btree ("variation_id", "sort_order");
    CREATE INDEX "variation_modifier_groups_updated_at_idx" ON "variation_modifier_groups" USING btree ("updated_at");
    CREATE INDEX "variation_modifier_groups_created_at_idx" ON "variation_modifier_groups" USING btree ("created_at");

    CREATE INDEX "variation_modifier_options_group_sort_idx" ON "variation_modifier_options" USING btree ("variation_modifier_group_id", "sort_order");
    CREATE INDEX "variation_modifier_options_updated_at_idx" ON "variation_modifier_options" USING btree ("updated_at");
    CREATE INDEX "variation_modifier_options_created_at_idx" ON "variation_modifier_options" USING btree ("created_at");

    CREATE INDEX "variation_modifier_group_overrides_variation_group_idx" ON "variation_modifier_group_overrides" USING btree ("variation_id", "base_modifier_group_id");
    CREATE INDEX "variation_modifier_group_overrides_updated_at_idx" ON "variation_modifier_group_overrides" USING btree ("updated_at");
    CREATE INDEX "variation_modifier_group_overrides_created_at_idx" ON "variation_modifier_group_overrides" USING btree ("created_at");

    CREATE INDEX "variation_modifier_option_overrides_variation_option_idx" ON "variation_modifier_option_overrides" USING btree ("variation_id", "base_modifier_option_id");
    CREATE INDEX "variation_modifier_option_overrides_updated_at_idx" ON "variation_modifier_option_overrides" USING btree ("updated_at");
    CREATE INDEX "variation_modifier_option_overrides_created_at_idx" ON "variation_modifier_option_overrides" USING btree ("created_at");

    ALTER TABLE "payload_locked_documents_rels"
      ADD CONSTRAINT "payload_locked_documents_rels_variation_modifier_groups_fk"
      FOREIGN KEY ("variation_modifier_groups_id") REFERENCES "public"."variation_modifier_groups"("id") ON DELETE cascade ON UPDATE no action;

    ALTER TABLE "payload_locked_documents_rels"
      ADD CONSTRAINT "payload_locked_documents_rels_variation_modifier_options_fk"
      FOREIGN KEY ("variation_modifier_options_id") REFERENCES "public"."variation_modifier_options"("id") ON DELETE cascade ON UPDATE no action;

    ALTER TABLE "payload_locked_documents_rels"
      ADD CONSTRAINT "payload_locked_documents_rels_variation_modifier_group_overrides_fk"
      FOREIGN KEY ("variation_modifier_group_overrides_id") REFERENCES "public"."variation_modifier_group_overrides"("id") ON DELETE cascade ON UPDATE no action;

    ALTER TABLE "payload_locked_documents_rels"
      ADD CONSTRAINT "payload_locked_documents_rels_variation_modifier_option_overrides_fk"
      FOREIGN KEY ("variation_modifier_option_overrides_id") REFERENCES "public"."variation_modifier_option_overrides"("id") ON DELETE cascade ON UPDATE no action;

    CREATE INDEX "payload_locked_documents_rels_variation_modifier_groups_id_idx" ON "payload_locked_documents_rels" USING btree ("variation_modifier_groups_id");
    CREATE INDEX "payload_locked_documents_rels_variation_modifier_options_id_idx" ON "payload_locked_documents_rels" USING btree ("variation_modifier_options_id");
    CREATE INDEX "payload_locked_documents_rels_variation_modifier_group_overrides_id_idx" ON "payload_locked_documents_rels" USING btree ("variation_modifier_group_overrides_id");
    CREATE INDEX "payload_locked_documents_rels_variation_modifier_option_overrides_id_idx" ON "payload_locked_documents_rels" USING btree ("variation_modifier_option_overrides_id");
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "variation_modifier_groups" DISABLE ROW LEVEL SECURITY;
    ALTER TABLE "variation_modifier_options" DISABLE ROW LEVEL SECURITY;
    ALTER TABLE "variation_modifier_group_overrides" DISABLE ROW LEVEL SECURITY;
    ALTER TABLE "variation_modifier_option_overrides" DISABLE ROW LEVEL SECURITY;

    ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_variation_modifier_groups_fk";
    ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_variation_modifier_options_fk";
    ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_variation_modifier_group_overrides_fk";
    ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_variation_modifier_option_overrides_fk";

    DROP INDEX IF EXISTS "payload_locked_documents_rels_variation_modifier_groups_id_idx";
    DROP INDEX IF EXISTS "payload_locked_documents_rels_variation_modifier_options_id_idx";
    DROP INDEX IF EXISTS "payload_locked_documents_rels_variation_modifier_group_overrides_id_idx";
    DROP INDEX IF EXISTS "payload_locked_documents_rels_variation_modifier_option_overrides_id_idx";

    ALTER TABLE "payload_locked_documents_rels" DROP COLUMN IF EXISTS "variation_modifier_groups_id";
    ALTER TABLE "payload_locked_documents_rels" DROP COLUMN IF EXISTS "variation_modifier_options_id";
    ALTER TABLE "payload_locked_documents_rels" DROP COLUMN IF EXISTS "variation_modifier_group_overrides_id";
    ALTER TABLE "payload_locked_documents_rels" DROP COLUMN IF EXISTS "variation_modifier_option_overrides_id";

    ALTER TABLE "cart_items" DROP CONSTRAINT IF EXISTS "cart_items_selected_variation_id_prod_variations_id_fk";
    ALTER TABLE "cart_items"
      ADD CONSTRAINT "cart_items_selected_variation_id_products_id_fk"
      FOREIGN KEY ("selected_variation_id") REFERENCES "public"."products"("id") ON DELETE set null ON UPDATE no action;

    DROP TABLE IF EXISTS "variation_modifier_option_overrides" CASCADE;
    DROP TABLE IF EXISTS "variation_modifier_group_overrides" CASCADE;
    DROP TABLE IF EXISTS "variation_modifier_options" CASCADE;
    DROP TABLE IF EXISTS "variation_modifier_groups" CASCADE;

    DROP TYPE IF EXISTS "public"."enum_variation_modifier_option_overrides_availability_behavior";
    DROP TYPE IF EXISTS "public"."enum_variation_modifier_option_overrides_default_behavior";
    DROP TYPE IF EXISTS "public"."enum_variation_modifier_option_overrides_mode";
    DROP TYPE IF EXISTS "public"."enum_variation_modifier_group_overrides_required_behavior";
    DROP TYPE IF EXISTS "public"."enum_variation_modifier_group_overrides_mode";
    DROP TYPE IF EXISTS "public"."enum_variation_modifier_groups_selection_type";
  `)
}
