import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ payload, req: _req }: MigrateUpArgs): Promise<void> {
  await payload.db.drizzle.execute(sql`
    -- Product Variation Values (specific attribute values for each variation)
    CREATE TABLE "prod_variation_values" (
      "id" serial PRIMARY KEY NOT NULL,
      "variation_product_id" integer NOT NULL REFERENCES "products"("id") ON DELETE CASCADE,
      "attribute_id" integer NOT NULL REFERENCES "prod_attributes"("id") ON DELETE CASCADE,
      "term_id" integer NOT NULL REFERENCES "prod_attribute_terms"("id") ON DELETE CASCADE,
      "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
      CONSTRAINT "prod_variation_values_unique" UNIQUE("variation_product_id", "attribute_id")
    );

    -- Grouped Products (for product bundles)
    CREATE TABLE "prod_grouped_items" (
      "id" serial PRIMARY KEY NOT NULL,
      "parent_product_id" integer NOT NULL REFERENCES "products"("id") ON DELETE CASCADE,
      "child_product_id" integer NOT NULL REFERENCES "products"("id") ON DELETE CASCADE,
      "default_quantity" integer DEFAULT 1,
      "sort_order" integer DEFAULT 0,
      "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
      CONSTRAINT "prod_grouped_items_unique" UNIQUE("parent_product_id", "child_product_id")
    );

    -- Vendor Products (Products owned/managed by vendors)
    CREATE TABLE "vendor_products" (
      "id" serial PRIMARY KEY NOT NULL,
      "vendor_id" integer NOT NULL REFERENCES "vendors"("id") ON DELETE CASCADE,
      "product_id" integer NOT NULL REFERENCES "products"("id") ON DELETE CASCADE,
      "auto_assign_to_new_merchants" boolean DEFAULT false,
      "is_active" boolean DEFAULT true,
      "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
      "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
      CONSTRAINT "vendor_products_unique" UNIQUE("vendor_id", "product_id")
    );

    -- Product Modifiers/Add-ons Groups
    CREATE TABLE "modifier_groups" (
      "id" serial PRIMARY KEY NOT NULL,
      "product_id" integer NOT NULL REFERENCES "products"("id") ON DELETE CASCADE,
      "name" varchar(255) NOT NULL,
      "selection_type" varchar(20) NOT NULL CHECK ("selection_type" IN ('single', 'multiple')),
      "is_required" boolean DEFAULT false,
      "min_selections" integer DEFAULT 0,
      "max_selections" integer,
      "sort_order" integer DEFAULT 0,
      "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
    );

    -- Product Modifiers/Add-ons Options
    CREATE TABLE "modifier_options" (
      "id" serial PRIMARY KEY NOT NULL,
      "modifier_group_id" integer NOT NULL REFERENCES "modifier_groups"("id") ON DELETE CASCADE,
      "name" varchar(255) NOT NULL,
      "price_adjustment" numeric(10, 2) DEFAULT 0.00,
      "is_default" boolean DEFAULT false,
      "is_available" boolean DEFAULT true,
      "sort_order" integer DEFAULT 0,
      "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
    );

    -- Product Tags (rename existing product_tags to prod_tags and update schema)
    ALTER TABLE "product_tags" RENAME TO "prod_tags";
    
    -- Add missing columns to prod_tags
    ALTER TABLE "prod_tags" ADD COLUMN IF NOT EXISTS "color" varchar(7);
    ALTER TABLE "prod_tags" ADD COLUMN IF NOT EXISTS "tag_type" varchar(50) DEFAULT 'general' CHECK ("tag_type" IN ('general', 'dietary', 'cuisine', 'promotion', 'feature', 'allergen', 'spice_level', 'temperature', 'size_category'));
    ALTER TABLE "prod_tags" ADD COLUMN IF NOT EXISTS "parent_tag_id" integer REFERENCES "prod_tags"("id") ON DELETE SET NULL;
    ALTER TABLE "prod_tags" ADD COLUMN IF NOT EXISTS "usage_count" integer DEFAULT 0;
    ALTER TABLE "prod_tags" ADD COLUMN IF NOT EXISTS "is_featured" boolean DEFAULT false;

    -- Product Tags Junction Table (rename existing product_tag_relations to prod_tags_junction and update schema)
    ALTER TABLE "product_tag_relations" RENAME TO "prod_tags_junction";
    
    -- Add missing columns to prod_tags_junction
    ALTER TABLE "prod_tags_junction" ADD COLUMN IF NOT EXISTS "added_by_type" varchar(20) NOT NULL DEFAULT 'system' CHECK ("added_by_type" IN ('vendor', 'merchant', 'system'));
    ALTER TABLE "prod_tags_junction" ADD COLUMN IF NOT EXISTS "added_by_vendor_id" integer REFERENCES "vendors"("id") ON DELETE SET NULL;
    ALTER TABLE "prod_tags_junction" ADD COLUMN IF NOT EXISTS "added_by_merchant_id" integer REFERENCES "merchants"("id") ON DELETE SET NULL;
    ALTER TABLE "prod_tags_junction" ADD COLUMN IF NOT EXISTS "priority" integer DEFAULT 0;
    ALTER TABLE "prod_tags_junction" ADD COLUMN IF NOT EXISTS "is_active" boolean DEFAULT true;

    -- Tag Groups (for organizing related tags)
    CREATE TABLE "tag_groups" (
      "id" serial PRIMARY KEY NOT NULL,
      "name" varchar(100) NOT NULL,
      "slug" varchar(100) NOT NULL,
      "description" text,
      "color" varchar(7),
      "icon" varchar(50),
      "is_filterable" boolean DEFAULT true,
      "is_searchable" boolean DEFAULT true,
      "display_order" integer DEFAULT 0,
      "is_active" boolean DEFAULT true,
      "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
      "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
      CONSTRAINT "tag_groups_slug_unique" UNIQUE("slug")
    );

    -- Tag Group Memberships
    CREATE TABLE "tag_group_memberships" (
      "id" serial PRIMARY KEY NOT NULL,
      "tag_group_id" integer NOT NULL REFERENCES "tag_groups"("id") ON DELETE CASCADE,
      "tag_id" integer NOT NULL REFERENCES "prod_tags"("id") ON DELETE CASCADE,
      "sort_order" integer DEFAULT 0,
      "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
      CONSTRAINT "tag_group_memberships_unique" UNIQUE("tag_group_id", "tag_id")
    );

    -- Create Indexes
    CREATE INDEX "idx_prod_variation_values_variation" ON "prod_variation_values"("variation_product_id");
    CREATE INDEX "idx_prod_variation_values_attribute" ON "prod_variation_values"("attribute_id");
    CREATE INDEX "idx_prod_variation_values_term" ON "prod_variation_values"("term_id");

    CREATE INDEX "idx_prod_grouped_items_parent" ON "prod_grouped_items"("parent_product_id");
    CREATE INDEX "idx_prod_grouped_items_child" ON "prod_grouped_items"("child_product_id");

    CREATE INDEX "idx_vendor_products_vendor" ON "vendor_products"("vendor_id");
    CREATE INDEX "idx_vendor_products_product" ON "vendor_products"("product_id");
    CREATE INDEX "idx_vendor_products_created_at" ON "vendor_products"("created_at");

    CREATE INDEX "idx_modifier_groups_product" ON "modifier_groups"("product_id");
    CREATE INDEX "idx_modifier_options_group" ON "modifier_options"("modifier_group_id");

    CREATE INDEX "idx_prod_tags_tag_type" ON "prod_tags"("tag_type");
    CREATE INDEX "idx_prod_tags_parent" ON "prod_tags"("parent_tag_id");
    CREATE INDEX "idx_prod_tags_is_featured" ON "prod_tags"("is_featured");
    CREATE INDEX "idx_prod_tags_usage_count" ON "prod_tags"("usage_count" DESC);

    CREATE INDEX "idx_prod_tags_junction_added_by_vendor" ON "prod_tags_junction"("added_by_vendor_id");
    CREATE INDEX "idx_prod_tags_junction_added_by_merchant" ON "prod_tags_junction"("added_by_merchant_id");
    CREATE INDEX "idx_prod_tags_junction_priority" ON "prod_tags_junction"("priority" DESC);
    CREATE INDEX "idx_prod_tags_junction_is_active" ON "prod_tags_junction"("is_active");

    CREATE INDEX "idx_tag_groups_slug" ON "tag_groups"("slug");
    CREATE INDEX "idx_tag_groups_is_active" ON "tag_groups"("is_active");
    CREATE INDEX "idx_tag_groups_display_order" ON "tag_groups"("display_order");

    CREATE INDEX "idx_tag_group_memberships_group" ON "tag_group_memberships"("tag_group_id");
    CREATE INDEX "idx_tag_group_memberships_tag" ON "tag_group_memberships"("tag_id");
    CREATE INDEX "idx_tag_group_memberships_sort" ON "tag_group_memberships"("sort_order");

    -- Create updated_at triggers
    CREATE TRIGGER "update_vendor_products_updated_at" 
      BEFORE UPDATE ON "vendor_products" 
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

    CREATE TRIGGER "update_prod_tags_updated_at" 
      BEFORE UPDATE ON "prod_tags" 
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

    CREATE TRIGGER "update_tag_groups_updated_at" 
      BEFORE UPDATE ON "tag_groups" 
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

    -- Tag Usage Count Trigger
    CREATE OR REPLACE FUNCTION update_tag_usage_count()
    RETURNS TRIGGER AS $$
    BEGIN
      IF TG_OP = 'INSERT' THEN
        UPDATE "prod_tags" 
        SET "usage_count" = "usage_count" + 1 
        WHERE "id" = NEW."tag_id";
        RETURN NEW;
      ELSIF TG_OP = 'DELETE' THEN
        UPDATE "prod_tags" 
        SET "usage_count" = GREATEST("usage_count" - 1, 0) 
        WHERE "id" = OLD."tag_id";
        RETURN OLD;
      END IF;
      RETURN NULL;
    END;
    $$ LANGUAGE plpgsql;

    CREATE TRIGGER "update_tag_usage_on_insert"
      AFTER INSERT ON "prod_tags_junction"
      FOR EACH ROW EXECUTE FUNCTION update_tag_usage_count();

    CREATE TRIGGER "update_tag_usage_on_delete"
      AFTER DELETE ON "prod_tags_junction"
      FOR EACH ROW EXECUTE FUNCTION update_tag_usage_count();
  `)
}

export async function down({ payload, req: _req }: MigrateDownArgs): Promise<void> {
  await payload.db.drizzle.execute(sql`
    -- Drop triggers
    DROP TRIGGER IF EXISTS "update_tag_usage_on_delete" ON "prod_tags_junction";
    DROP TRIGGER IF EXISTS "update_tag_usage_on_insert" ON "prod_tags_junction";
    DROP FUNCTION IF EXISTS update_tag_usage_count();
    DROP TRIGGER IF EXISTS "update_tag_groups_updated_at" ON "tag_groups";
    DROP TRIGGER IF EXISTS "update_prod_tags_updated_at" ON "prod_tags";
    DROP TRIGGER IF EXISTS "update_vendor_products_updated_at" ON "vendor_products";

    -- Drop tables
    DROP TABLE IF EXISTS "tag_group_memberships";
    DROP TABLE IF EXISTS "tag_groups";
    DROP TABLE IF EXISTS "modifier_options";
    DROP TABLE IF EXISTS "modifier_groups";
    DROP TABLE IF EXISTS "vendor_products";
    DROP TABLE IF EXISTS "prod_grouped_items";
    DROP TABLE IF EXISTS "prod_variation_values";

    -- Revert table renames and column additions
    ALTER TABLE "prod_tags_junction" RENAME TO "product_tag_relations";
    ALTER TABLE "prod_tags" RENAME TO "product_tags";
  `)
}