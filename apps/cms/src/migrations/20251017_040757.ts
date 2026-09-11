import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload: _payload, req: _req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    -- ============================================
    -- PRODUCT MANAGEMENT SCHEMA
    -- Integrates with existing vendors and merchants tables
    -- ============================================

    -- Product Attributes (for variable products - e.g., Size, Color, Flavor)
    CREATE TABLE "prod_attributes" (
      "id" serial PRIMARY KEY NOT NULL,
      "name" varchar NOT NULL,
      "slug" varchar NOT NULL,
      "type" varchar NOT NULL,
      "description" text,
      "is_required" boolean DEFAULT false,
      "is_variation" boolean DEFAULT false,
      "is_visible" boolean DEFAULT true,
      "sort_order" integer DEFAULT 0,
      "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
      "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
    );

    -- Product Attribute Terms (values for attributes - e.g., Small, Medium, Large for Size)
    CREATE TABLE "prod_attribute_terms" (
      "id" serial PRIMARY KEY NOT NULL,
      "attribute_id" integer NOT NULL,
      "name" varchar NOT NULL,
      "slug" varchar NOT NULL,
      "description" text,
      "sort_order" integer DEFAULT 0,
      "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
      "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
    );

    -- Product Variations (for variable products)
    CREATE TABLE "prod_variations" (
      "id" serial PRIMARY KEY NOT NULL,
      "parent_product_id" integer NOT NULL,
      "sku" varchar,
      "price" numeric(10, 2),
      "sale_price" numeric(10, 2),
      "cost_price" numeric(10, 2),
      "stock_quantity" integer DEFAULT 0,
      "manage_stock" boolean DEFAULT true,
      "stock_status" varchar DEFAULT 'in_stock',
      "weight" numeric(8, 3),
      "dimensions" jsonb,
      "image_id" integer,
      "is_active" boolean DEFAULT true,
      "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
      "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
    );

    -- Product Variation Attributes (links variations to their attribute values)
    CREATE TABLE "prod_variation_attributes" (
      "id" serial PRIMARY KEY NOT NULL,
      "variation_id" integer NOT NULL,
      "attribute_id" integer NOT NULL,
      "attribute_term_id" integer NOT NULL,
      "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
      "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
    );

    -- Merchant Products (links products to merchants with merchant-specific data)
    CREATE TABLE "merchant_products" (
      "id" serial PRIMARY KEY NOT NULL,
      "merchant_id" integer NOT NULL,
      "product_id" integer NOT NULL,
      "merchant_sku" varchar,
      "merchant_price" numeric(10, 2),
      "merchant_sale_price" numeric(10, 2),
      "stock_quantity" integer DEFAULT 0,
      "manage_stock" boolean DEFAULT true,
      "stock_status" varchar DEFAULT 'in_stock',
      "low_stock_threshold" integer DEFAULT 5,
      "is_active" boolean DEFAULT true,
      "sort_order" integer DEFAULT 0,
      "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
      "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
    );

    -- Product Reviews
    CREATE TABLE "product_reviews" (
      "id" serial PRIMARY KEY NOT NULL,
      "product_id" integer NOT NULL,
      "customer_id" integer NOT NULL,
      "rating" integer NOT NULL,
      "title" varchar,
      "comment" text,
      "is_verified_purchase" boolean DEFAULT false,
      "is_approved" boolean DEFAULT false,
      "helpful_count" integer DEFAULT 0,
      "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
      "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
    );

    -- Product Tags (many-to-many relationship)
    CREATE TABLE "product_tags" (
      "id" serial PRIMARY KEY NOT NULL,
      "name" varchar NOT NULL,
      "slug" varchar NOT NULL,
      "description" text,
      "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
      "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
    );

    -- Product Tag Relations
    CREATE TABLE "product_tag_relations" (
      "id" serial PRIMARY KEY NOT NULL,
      "product_id" integer NOT NULL,
      "tag_id" integer NOT NULL,
      "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
      "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
    );

    -- Add Foreign Key Constraints
    DO $$ BEGIN
     ALTER TABLE "prod_attribute_terms" ADD CONSTRAINT "prod_attribute_terms_attribute_id_prod_attributes_id_fk" FOREIGN KEY ("attribute_id") REFERENCES "prod_attributes"("id") ON DELETE cascade ON UPDATE no action;
    EXCEPTION
     WHEN duplicate_object THEN null;
    END $$;

    DO $$ BEGIN
     ALTER TABLE "prod_variations" ADD CONSTRAINT "prod_variations_parent_product_id_products_id_fk" FOREIGN KEY ("parent_product_id") REFERENCES "products"("id") ON DELETE cascade ON UPDATE no action;
    EXCEPTION
     WHEN duplicate_object THEN null;
    END $$;

    DO $$ BEGIN
     ALTER TABLE "prod_variations" ADD CONSTRAINT "prod_variations_image_id_media_id_fk" FOREIGN KEY ("image_id") REFERENCES "media"("id") ON DELETE set null ON UPDATE no action;
    EXCEPTION
     WHEN duplicate_object THEN null;
    END $$;

    DO $$ BEGIN
     ALTER TABLE "prod_variation_attributes" ADD CONSTRAINT "prod_variation_attributes_variation_id_prod_variations_id_fk" FOREIGN KEY ("variation_id") REFERENCES "prod_variations"("id") ON DELETE cascade ON UPDATE no action;
    EXCEPTION
     WHEN duplicate_object THEN null;
    END $$;

    DO $$ BEGIN
     ALTER TABLE "prod_variation_attributes" ADD CONSTRAINT "prod_variation_attributes_attribute_id_prod_attributes_id_fk" FOREIGN KEY ("attribute_id") REFERENCES "prod_attributes"("id") ON DELETE cascade ON UPDATE no action;
    EXCEPTION
     WHEN duplicate_object THEN null;
    END $$;

    DO $$ BEGIN
     ALTER TABLE "prod_variation_attributes" ADD CONSTRAINT "prod_variation_attributes_attribute_term_id_prod_attribute_terms_id_fk" FOREIGN KEY ("attribute_term_id") REFERENCES "prod_attribute_terms"("id") ON DELETE cascade ON UPDATE no action;
    EXCEPTION
     WHEN duplicate_object THEN null;
    END $$;

    DO $$ BEGIN
     ALTER TABLE "merchant_products" ADD CONSTRAINT "merchant_products_merchant_id_merchants_id_fk" FOREIGN KEY ("merchant_id") REFERENCES "merchants"("id") ON DELETE cascade ON UPDATE no action;
    EXCEPTION
     WHEN duplicate_object THEN null;
    END $$;

    DO $$ BEGIN
     ALTER TABLE "merchant_products" ADD CONSTRAINT "merchant_products_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE cascade ON UPDATE no action;
    EXCEPTION
     WHEN duplicate_object THEN null;
    END $$;

    DO $$ BEGIN
     ALTER TABLE "product_reviews" ADD CONSTRAINT "product_reviews_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE cascade ON UPDATE no action;
    EXCEPTION
     WHEN duplicate_object THEN null;
    END $$;

    DO $$ BEGIN
     ALTER TABLE "product_reviews" ADD CONSTRAINT "product_reviews_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE cascade ON UPDATE no action;
    EXCEPTION
     WHEN duplicate_object THEN null;
    END $$;

    DO $$ BEGIN
     ALTER TABLE "product_tag_relations" ADD CONSTRAINT "product_tag_relations_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE cascade ON UPDATE no action;
    EXCEPTION
     WHEN duplicate_object THEN null;
    END $$;

    DO $$ BEGIN
     ALTER TABLE "product_tag_relations" ADD CONSTRAINT "product_tag_relations_tag_id_product_tags_id_fk" FOREIGN KEY ("tag_id") REFERENCES "product_tags"("id") ON DELETE cascade ON UPDATE no action;
    EXCEPTION
     WHEN duplicate_object THEN null;
    END $$;

    -- Create Indexes for Performance
    CREATE UNIQUE INDEX "prod_attributes_slug_idx" ON "prod_attributes" USING btree ("slug");
    CREATE INDEX "prod_attributes_type_idx" ON "prod_attributes" USING btree ("type");
    CREATE INDEX "prod_attributes_is_variation_idx" ON "prod_attributes" USING btree ("is_variation");
    CREATE INDEX "prod_attributes_created_at_idx" ON "prod_attributes" USING btree ("created_at");

    CREATE UNIQUE INDEX "prod_attribute_terms_attribute_slug_idx" ON "prod_attribute_terms" USING btree ("attribute_id", "slug");
    CREATE INDEX "prod_attribute_terms_attribute_id_idx" ON "prod_attribute_terms" USING btree ("attribute_id");
    CREATE INDEX "prod_attribute_terms_created_at_idx" ON "prod_attribute_terms" USING btree ("created_at");

    CREATE INDEX "prod_variations_parent_product_id_idx" ON "prod_variations" USING btree ("parent_product_id");
    CREATE INDEX "prod_variations_sku_idx" ON "prod_variations" USING btree ("sku");
    CREATE INDEX "prod_variations_is_active_idx" ON "prod_variations" USING btree ("is_active");
    CREATE INDEX "prod_variations_created_at_idx" ON "prod_variations" USING btree ("created_at");

    CREATE UNIQUE INDEX "prod_variation_attributes_variation_attribute_idx" ON "prod_variation_attributes" USING btree ("variation_id", "attribute_id");
    CREATE INDEX "prod_variation_attributes_variation_id_idx" ON "prod_variation_attributes" USING btree ("variation_id");
    CREATE INDEX "prod_variation_attributes_attribute_id_idx" ON "prod_variation_attributes" USING btree ("attribute_id");
    CREATE INDEX "prod_variation_attributes_created_at_idx" ON "prod_variation_attributes" USING btree ("created_at");

    CREATE UNIQUE INDEX "merchant_products_merchant_product_idx" ON "merchant_products" USING btree ("merchant_id", "product_id");
    CREATE INDEX "merchant_products_merchant_id_idx" ON "merchant_products" USING btree ("merchant_id");
    CREATE INDEX "merchant_products_product_id_idx" ON "merchant_products" USING btree ("product_id");
    CREATE INDEX "merchant_products_is_active_idx" ON "merchant_products" USING btree ("is_active");
    CREATE INDEX "merchant_products_created_at_idx" ON "merchant_products" USING btree ("created_at");

    CREATE INDEX "product_reviews_product_id_idx" ON "product_reviews" USING btree ("product_id");
    CREATE INDEX "product_reviews_customer_id_idx" ON "product_reviews" USING btree ("customer_id");
    CREATE INDEX "product_reviews_rating_idx" ON "product_reviews" USING btree ("rating");
    CREATE INDEX "product_reviews_is_approved_idx" ON "product_reviews" USING btree ("is_approved");
    CREATE INDEX "product_reviews_created_at_idx" ON "product_reviews" USING btree ("created_at");

    CREATE UNIQUE INDEX "product_tags_slug_idx" ON "product_tags" USING btree ("slug");
    CREATE INDEX "product_tags_created_at_idx" ON "product_tags" USING btree ("created_at");

    CREATE UNIQUE INDEX "product_tag_relations_product_tag_idx" ON "product_tag_relations" USING btree ("product_id", "tag_id");
    CREATE INDEX "product_tag_relations_product_id_idx" ON "product_tag_relations" USING btree ("product_id");
    CREATE INDEX "product_tag_relations_tag_id_idx" ON "product_tag_relations" USING btree ("tag_id");
    CREATE INDEX "product_tag_relations_created_at_idx" ON "product_tag_relations" USING btree ("created_at");

    -- Create triggers for updated_at timestamps
    CREATE OR REPLACE FUNCTION update_updated_at_column()
    RETURNS TRIGGER AS $$
    BEGIN
        NEW.updated_at = CURRENT_TIMESTAMP;
        RETURN NEW;
    END;
    $$ language 'plpgsql';

    CREATE TRIGGER update_prod_attributes_updated_at BEFORE UPDATE ON prod_attributes FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    CREATE TRIGGER update_prod_attribute_terms_updated_at BEFORE UPDATE ON prod_attribute_terms FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    CREATE TRIGGER update_prod_variations_updated_at BEFORE UPDATE ON prod_variations FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    CREATE TRIGGER update_prod_variation_attributes_updated_at BEFORE UPDATE ON prod_variation_attributes FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    CREATE TRIGGER update_merchant_products_updated_at BEFORE UPDATE ON merchant_products FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    CREATE TRIGGER update_product_reviews_updated_at BEFORE UPDATE ON product_reviews FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    CREATE TRIGGER update_product_tags_updated_at BEFORE UPDATE ON product_tags FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    CREATE TRIGGER update_product_tag_relations_updated_at BEFORE UPDATE ON product_tag_relations FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  `)
}

export async function down({ db, payload: _payload, req: _req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    -- Drop triggers
    DROP TRIGGER IF EXISTS update_prod_attributes_updated_at ON prod_attributes;
    DROP TRIGGER IF EXISTS update_prod_attribute_terms_updated_at ON prod_attribute_terms;
    DROP TRIGGER IF EXISTS update_prod_variations_updated_at ON prod_variations;
    DROP TRIGGER IF EXISTS update_prod_variation_attributes_updated_at ON prod_variation_attributes;
    DROP TRIGGER IF EXISTS update_merchant_products_updated_at ON merchant_products;
    DROP TRIGGER IF EXISTS update_product_reviews_updated_at ON product_reviews;
    DROP TRIGGER IF EXISTS update_product_tags_updated_at ON product_tags;
    DROP TRIGGER IF EXISTS update_product_tag_relations_updated_at ON product_tag_relations;

    -- Drop function
    DROP FUNCTION IF EXISTS update_updated_at_column();

    -- Drop tables in reverse order (to handle foreign key dependencies)
    DROP TABLE IF EXISTS "product_tag_relations";
    DROP TABLE IF EXISTS "product_tags";
    DROP TABLE IF EXISTS "product_reviews";
    DROP TABLE IF EXISTS "merchant_products";
    DROP TABLE IF EXISTS "prod_variation_attributes";
    DROP TABLE IF EXISTS "prod_variations";
    DROP TABLE IF EXISTS "prod_attribute_terms";
    DROP TABLE IF EXISTS "prod_attributes";
  `)
}
