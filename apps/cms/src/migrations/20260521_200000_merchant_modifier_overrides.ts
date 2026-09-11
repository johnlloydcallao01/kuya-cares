import { MigrateDownArgs, MigrateUpArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    DO $$ BEGIN
      CREATE TYPE "public"."enum_merchant_modifier_selection_type" AS ENUM('single', 'multiple');
    EXCEPTION
      WHEN duplicate_object THEN null;
    END $$;

    DO $$ BEGIN
      CREATE TYPE "public"."enum_merchant_modifier_group_override_mode" AS ENUM('inherit', 'hide', 'override');
    EXCEPTION
      WHEN duplicate_object THEN null;
    END $$;

    DO $$ BEGIN
      CREATE TYPE "public"."enum_merchant_modifier_group_required_behavior" AS ENUM('inherit', 'required', 'optional');
    EXCEPTION
      WHEN duplicate_object THEN null;
    END $$;

    DO $$ BEGIN
      CREATE TYPE "public"."enum_merchant_modifier_option_override_mode" AS ENUM('inherit', 'hide', 'override');
    EXCEPTION
      WHEN duplicate_object THEN null;
    END $$;

    DO $$ BEGIN
      CREATE TYPE "public"."enum_merchant_modifier_option_default_behavior" AS ENUM('inherit', 'default', 'not_default');
    EXCEPTION
      WHEN duplicate_object THEN null;
    END $$;

    DO $$ BEGIN
      CREATE TYPE "public"."enum_merchant_modifier_option_availability_behavior" AS ENUM('inherit', 'available', 'unavailable');
    EXCEPTION
      WHEN duplicate_object THEN null;
    END $$;

    DO $$ BEGIN
      CREATE TYPE "public"."enum_merchant_variation_modifier_group_target_source" AS ENUM('product_base', 'variation_added');
    EXCEPTION
      WHEN duplicate_object THEN null;
    END $$;

    DO $$ BEGIN
      CREATE TYPE "public"."enum_merchant_variation_modifier_option_target_source" AS ENUM('product_base', 'variation_added');
    EXCEPTION
      WHEN duplicate_object THEN null;
    END $$;

    CREATE TABLE "merchant_product_modifier_group_overrides" (
      "id" serial PRIMARY KEY NOT NULL,
      "merchant_product_id" integer NOT NULL,
      "base_modifier_group_id" integer NOT NULL,
      "mode" "public"."enum_merchant_modifier_group_override_mode" DEFAULT 'inherit' NOT NULL,
      "name_override" varchar,
      "selection_type_override" "public"."enum_merchant_modifier_selection_type",
      "required_behavior" "public"."enum_merchant_modifier_group_required_behavior" DEFAULT 'inherit',
      "min_selections_override" numeric,
      "max_selections_override" numeric,
      "sort_order_override" numeric,
      "is_active" boolean DEFAULT true,
      "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
      "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
    );

    CREATE TABLE "merchant_product_modifier_option_overrides" (
      "id" serial PRIMARY KEY NOT NULL,
      "merchant_product_id" integer NOT NULL,
      "base_modifier_option_id" integer NOT NULL,
      "mode" "public"."enum_merchant_modifier_option_override_mode" DEFAULT 'inherit' NOT NULL,
      "name_override" varchar,
      "price_adjustment_override" numeric,
      "default_behavior" "public"."enum_merchant_modifier_option_default_behavior" DEFAULT 'inherit',
      "availability_behavior" "public"."enum_merchant_modifier_option_availability_behavior" DEFAULT 'inherit',
      "sort_order_override" numeric,
      "is_active" boolean DEFAULT true,
      "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
      "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
    );

    CREATE TABLE "merchant_variation_modifier_group_overrides" (
      "id" serial PRIMARY KEY NOT NULL,
      "merchant_product_id" integer NOT NULL,
      "variation_id" integer NOT NULL,
      "target_group_source" "public"."enum_merchant_variation_modifier_group_target_source" DEFAULT 'product_base' NOT NULL,
      "base_modifier_group_id" integer,
      "variation_modifier_group_id" integer,
      "mode" "public"."enum_merchant_modifier_group_override_mode" DEFAULT 'inherit' NOT NULL,
      "name_override" varchar,
      "selection_type_override" "public"."enum_merchant_modifier_selection_type",
      "required_behavior" "public"."enum_merchant_modifier_group_required_behavior" DEFAULT 'inherit',
      "min_selections_override" numeric,
      "max_selections_override" numeric,
      "sort_order_override" numeric,
      "is_active" boolean DEFAULT true,
      "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
      "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
    );

    CREATE TABLE "merchant_variation_modifier_option_overrides" (
      "id" serial PRIMARY KEY NOT NULL,
      "merchant_product_id" integer NOT NULL,
      "variation_id" integer NOT NULL,
      "target_option_source" "public"."enum_merchant_variation_modifier_option_target_source" DEFAULT 'product_base' NOT NULL,
      "base_modifier_option_id" integer,
      "variation_modifier_option_id" integer,
      "mode" "public"."enum_merchant_modifier_option_override_mode" DEFAULT 'inherit' NOT NULL,
      "name_override" varchar,
      "price_adjustment_override" numeric,
      "default_behavior" "public"."enum_merchant_modifier_option_default_behavior" DEFAULT 'inherit',
      "availability_behavior" "public"."enum_merchant_modifier_option_availability_behavior" DEFAULT 'inherit',
      "sort_order_override" numeric,
      "is_active" boolean DEFAULT true,
      "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
      "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
    );

    ALTER TABLE "merchant_product_modifier_group_overrides"
      ADD CONSTRAINT "merchant_product_modifier_group_overrides_merchant_product_id_fk"
      FOREIGN KEY ("merchant_product_id") REFERENCES "public"."merchant_products"("id") ON DELETE cascade ON UPDATE no action;

    ALTER TABLE "merchant_product_modifier_group_overrides"
      ADD CONSTRAINT "merchant_product_modifier_group_overrides_base_modifier_group_id_fk"
      FOREIGN KEY ("base_modifier_group_id") REFERENCES "public"."modifier_groups"("id") ON DELETE cascade ON UPDATE no action;

    ALTER TABLE "merchant_product_modifier_option_overrides"
      ADD CONSTRAINT "merchant_product_modifier_option_overrides_merchant_product_id_fk"
      FOREIGN KEY ("merchant_product_id") REFERENCES "public"."merchant_products"("id") ON DELETE cascade ON UPDATE no action;

    ALTER TABLE "merchant_product_modifier_option_overrides"
      ADD CONSTRAINT "merchant_product_modifier_option_overrides_base_modifier_option_id_fk"
      FOREIGN KEY ("base_modifier_option_id") REFERENCES "public"."modifier_options"("id") ON DELETE cascade ON UPDATE no action;

    ALTER TABLE "merchant_variation_modifier_group_overrides"
      ADD CONSTRAINT "merchant_variation_modifier_group_overrides_merchant_product_id_fk"
      FOREIGN KEY ("merchant_product_id") REFERENCES "public"."merchant_products"("id") ON DELETE cascade ON UPDATE no action;

    ALTER TABLE "merchant_variation_modifier_group_overrides"
      ADD CONSTRAINT "merchant_variation_modifier_group_overrides_variation_id_fk"
      FOREIGN KEY ("variation_id") REFERENCES "public"."prod_variations"("id") ON DELETE cascade ON UPDATE no action;

    ALTER TABLE "merchant_variation_modifier_group_overrides"
      ADD CONSTRAINT "merchant_variation_modifier_group_overrides_base_modifier_group_id_fk"
      FOREIGN KEY ("base_modifier_group_id") REFERENCES "public"."modifier_groups"("id") ON DELETE cascade ON UPDATE no action;

    ALTER TABLE "merchant_variation_modifier_group_overrides"
      ADD CONSTRAINT "merchant_variation_modifier_group_overrides_variation_modifier_group_id_fk"
      FOREIGN KEY ("variation_modifier_group_id") REFERENCES "public"."variation_modifier_groups"("id") ON DELETE cascade ON UPDATE no action;

    ALTER TABLE "merchant_variation_modifier_option_overrides"
      ADD CONSTRAINT "merchant_variation_modifier_option_overrides_merchant_product_id_fk"
      FOREIGN KEY ("merchant_product_id") REFERENCES "public"."merchant_products"("id") ON DELETE cascade ON UPDATE no action;

    ALTER TABLE "merchant_variation_modifier_option_overrides"
      ADD CONSTRAINT "merchant_variation_modifier_option_overrides_variation_id_fk"
      FOREIGN KEY ("variation_id") REFERENCES "public"."prod_variations"("id") ON DELETE cascade ON UPDATE no action;

    ALTER TABLE "merchant_variation_modifier_option_overrides"
      ADD CONSTRAINT "merchant_variation_modifier_option_overrides_base_modifier_option_id_fk"
      FOREIGN KEY ("base_modifier_option_id") REFERENCES "public"."modifier_options"("id") ON DELETE cascade ON UPDATE no action;

    ALTER TABLE "merchant_variation_modifier_option_overrides"
      ADD CONSTRAINT "merchant_variation_modifier_option_overrides_variation_modifier_option_id_fk"
      FOREIGN KEY ("variation_modifier_option_id") REFERENCES "public"."variation_modifier_options"("id") ON DELETE cascade ON UPDATE no action;

    ALTER TABLE "merchant_variation_modifier_group_overrides"
      ADD CONSTRAINT "merchant_variation_modifier_group_overrides_target_check"
      CHECK (
        (
          "target_group_source" = 'product_base'
          AND "base_modifier_group_id" IS NOT NULL
          AND "variation_modifier_group_id" IS NULL
        )
        OR (
          "target_group_source" = 'variation_added'
          AND "variation_modifier_group_id" IS NOT NULL
          AND "base_modifier_group_id" IS NULL
        )
      );

    ALTER TABLE "merchant_variation_modifier_option_overrides"
      ADD CONSTRAINT "merchant_variation_modifier_option_overrides_target_check"
      CHECK (
        (
          "target_option_source" = 'product_base'
          AND "base_modifier_option_id" IS NOT NULL
          AND "variation_modifier_option_id" IS NULL
        )
        OR (
          "target_option_source" = 'variation_added'
          AND "variation_modifier_option_id" IS NOT NULL
          AND "base_modifier_option_id" IS NULL
        )
      );

    ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "merchant_product_modifier_group_overrides_id" integer;
    ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "merchant_product_modifier_option_overrides_id" integer;
    ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "merchant_variation_modifier_group_overrides_id" integer;
    ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "merchant_variation_modifier_option_overrides_id" integer;

    ALTER TABLE "payload_locked_documents_rels"
      ADD CONSTRAINT "payload_locked_documents_rels_merchant_product_modifier_group_overrides_fk"
      FOREIGN KEY ("merchant_product_modifier_group_overrides_id") REFERENCES "public"."merchant_product_modifier_group_overrides"("id") ON DELETE cascade ON UPDATE no action;

    ALTER TABLE "payload_locked_documents_rels"
      ADD CONSTRAINT "payload_locked_documents_rels_merchant_product_modifier_option_overrides_fk"
      FOREIGN KEY ("merchant_product_modifier_option_overrides_id") REFERENCES "public"."merchant_product_modifier_option_overrides"("id") ON DELETE cascade ON UPDATE no action;

    ALTER TABLE "payload_locked_documents_rels"
      ADD CONSTRAINT "payload_locked_documents_rels_merchant_variation_modifier_group_overrides_fk"
      FOREIGN KEY ("merchant_variation_modifier_group_overrides_id") REFERENCES "public"."merchant_variation_modifier_group_overrides"("id") ON DELETE cascade ON UPDATE no action;

    ALTER TABLE "payload_locked_documents_rels"
      ADD CONSTRAINT "payload_locked_documents_rels_merchant_variation_modifier_option_overrides_fk"
      FOREIGN KEY ("merchant_variation_modifier_option_overrides_id") REFERENCES "public"."merchant_variation_modifier_option_overrides"("id") ON DELETE cascade ON UPDATE no action;

    CREATE INDEX "merchant_product_modifier_group_overrides_lookup_idx" ON "merchant_product_modifier_group_overrides" USING btree ("merchant_product_id", "base_modifier_group_id");
    CREATE INDEX "merchant_product_modifier_group_overrides_updated_at_idx" ON "merchant_product_modifier_group_overrides" USING btree ("updated_at");
    CREATE INDEX "merchant_product_modifier_group_overrides_created_at_idx" ON "merchant_product_modifier_group_overrides" USING btree ("created_at");

    CREATE INDEX "merchant_product_modifier_option_overrides_lookup_idx" ON "merchant_product_modifier_option_overrides" USING btree ("merchant_product_id", "base_modifier_option_id");
    CREATE INDEX "merchant_product_modifier_option_overrides_updated_at_idx" ON "merchant_product_modifier_option_overrides" USING btree ("updated_at");
    CREATE INDEX "merchant_product_modifier_option_overrides_created_at_idx" ON "merchant_product_modifier_option_overrides" USING btree ("created_at");

    CREATE INDEX "merchant_variation_modifier_group_overrides_base_idx" ON "merchant_variation_modifier_group_overrides" USING btree ("merchant_product_id", "variation_id", "base_modifier_group_id");
    CREATE INDEX "merchant_variation_modifier_group_overrides_variation_added_idx" ON "merchant_variation_modifier_group_overrides" USING btree ("merchant_product_id", "variation_id", "variation_modifier_group_id");
    CREATE INDEX "merchant_variation_modifier_group_overrides_updated_at_idx" ON "merchant_variation_modifier_group_overrides" USING btree ("updated_at");
    CREATE INDEX "merchant_variation_modifier_group_overrides_created_at_idx" ON "merchant_variation_modifier_group_overrides" USING btree ("created_at");

    CREATE INDEX "merchant_variation_modifier_option_overrides_base_idx" ON "merchant_variation_modifier_option_overrides" USING btree ("merchant_product_id", "variation_id", "base_modifier_option_id");
    CREATE INDEX "merchant_variation_modifier_option_overrides_variation_added_idx" ON "merchant_variation_modifier_option_overrides" USING btree ("merchant_product_id", "variation_id", "variation_modifier_option_id");
    CREATE INDEX "merchant_variation_modifier_option_overrides_updated_at_idx" ON "merchant_variation_modifier_option_overrides" USING btree ("updated_at");
    CREATE INDEX "merchant_variation_modifier_option_overrides_created_at_idx" ON "merchant_variation_modifier_option_overrides" USING btree ("created_at");

    CREATE INDEX "payload_locked_documents_rels_merchant_product_modifier_group_overrides_id_idx" ON "payload_locked_documents_rels" USING btree ("merchant_product_modifier_group_overrides_id");
    CREATE INDEX "payload_locked_documents_rels_merchant_product_modifier_option_overrides_id_idx" ON "payload_locked_documents_rels" USING btree ("merchant_product_modifier_option_overrides_id");
    CREATE INDEX "payload_locked_documents_rels_merchant_variation_modifier_group_overrides_id_idx" ON "payload_locked_documents_rels" USING btree ("merchant_variation_modifier_group_overrides_id");
    CREATE INDEX "payload_locked_documents_rels_merchant_variation_modifier_option_overrides_id_idx" ON "payload_locked_documents_rels" USING btree ("merchant_variation_modifier_option_overrides_id");
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "merchant_product_modifier_group_overrides" DISABLE ROW LEVEL SECURITY;
    ALTER TABLE "merchant_product_modifier_option_overrides" DISABLE ROW LEVEL SECURITY;
    ALTER TABLE "merchant_variation_modifier_group_overrides" DISABLE ROW LEVEL SECURITY;
    ALTER TABLE "merchant_variation_modifier_option_overrides" DISABLE ROW LEVEL SECURITY;

    ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_merchant_product_modifier_group_overrides_fk";
    ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_merchant_product_modifier_option_overrides_fk";
    ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_merchant_variation_modifier_group_overrides_fk";
    ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_merchant_variation_modifier_option_overrides_fk";

    DROP INDEX IF EXISTS "payload_locked_documents_rels_merchant_product_modifier_group_overrides_id_idx";
    DROP INDEX IF EXISTS "payload_locked_documents_rels_merchant_product_modifier_option_overrides_id_idx";
    DROP INDEX IF EXISTS "payload_locked_documents_rels_merchant_variation_modifier_group_overrides_id_idx";
    DROP INDEX IF EXISTS "payload_locked_documents_rels_merchant_variation_modifier_option_overrides_id_idx";

    ALTER TABLE "payload_locked_documents_rels" DROP COLUMN IF EXISTS "merchant_product_modifier_group_overrides_id";
    ALTER TABLE "payload_locked_documents_rels" DROP COLUMN IF EXISTS "merchant_product_modifier_option_overrides_id";
    ALTER TABLE "payload_locked_documents_rels" DROP COLUMN IF EXISTS "merchant_variation_modifier_group_overrides_id";
    ALTER TABLE "payload_locked_documents_rels" DROP COLUMN IF EXISTS "merchant_variation_modifier_option_overrides_id";

    DROP TABLE IF EXISTS "merchant_variation_modifier_option_overrides" CASCADE;
    DROP TABLE IF EXISTS "merchant_variation_modifier_group_overrides" CASCADE;
    DROP TABLE IF EXISTS "merchant_product_modifier_option_overrides" CASCADE;
    DROP TABLE IF EXISTS "merchant_product_modifier_group_overrides" CASCADE;

    DROP TYPE IF EXISTS "public"."enum_merchant_variation_modifier_option_target_source";
    DROP TYPE IF EXISTS "public"."enum_merchant_variation_modifier_group_target_source";
    DROP TYPE IF EXISTS "public"."enum_merchant_modifier_option_availability_behavior";
    DROP TYPE IF EXISTS "public"."enum_merchant_modifier_option_default_behavior";
    DROP TYPE IF EXISTS "public"."enum_merchant_modifier_option_override_mode";
    DROP TYPE IF EXISTS "public"."enum_merchant_modifier_group_required_behavior";
    DROP TYPE IF EXISTS "public"."enum_merchant_modifier_group_override_mode";
    DROP TYPE IF EXISTS "public"."enum_merchant_modifier_selection_type";
  `)
}
