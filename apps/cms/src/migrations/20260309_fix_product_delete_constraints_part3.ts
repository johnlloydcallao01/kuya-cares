import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "order_items" ALTER COLUMN "product_id" DROP NOT NULL;
    ALTER TABLE "order_items" ALTER COLUMN "merchant_product_id" DROP NOT NULL;
  `)

  await db.execute(sql`
    DO $$ DECLARE constraint_name text; BEGIN
      FOR constraint_name IN
        SELECT c.conname
        FROM pg_constraint c
        JOIN pg_class t ON c.conrelid = t.oid
        JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = ANY (c.conkey)
        JOIN pg_class rt ON c.confrelid = rt.oid
        WHERE c.contype = 'f'
          AND t.relname = 'order_items'
          AND a.attname = 'product_id'
          AND rt.relname = 'products'
      LOOP
        EXECUTE format('ALTER TABLE "order_items" DROP CONSTRAINT IF EXISTS %I', constraint_name);
      END LOOP;
    END $$;

    ALTER TABLE "order_items" ADD CONSTRAINT "order_items_product_id_products_id_fk"
      FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE SET NULL;

    DO $$ DECLARE constraint_name text; BEGIN
      FOR constraint_name IN
        SELECT c.conname
        FROM pg_constraint c
        JOIN pg_class t ON c.conrelid = t.oid
        JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = ANY (c.conkey)
        JOIN pg_class rt ON c.confrelid = rt.oid
        WHERE c.contype = 'f'
          AND t.relname = 'order_items'
          AND a.attname = 'merchant_product_id'
          AND rt.relname = 'merchant_products'
      LOOP
        EXECUTE format('ALTER TABLE "order_items" DROP CONSTRAINT IF EXISTS %I', constraint_name);
      END LOOP;
    END $$;

    ALTER TABLE "order_items" ADD CONSTRAINT "order_items_merchant_product_id_merchant_products_id_fk"
      FOREIGN KEY ("merchant_product_id") REFERENCES "merchant_products"("id") ON DELETE SET NULL;
  `)

  await db.execute(sql`
    DO $$ DECLARE constraint_name text; BEGIN
      FOR constraint_name IN
        SELECT c.conname
        FROM pg_constraint c
        JOIN pg_class t ON c.conrelid = t.oid
        JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = ANY (c.conkey)
        JOIN pg_class rt ON c.confrelid = rt.oid
        WHERE c.contype = 'f'
          AND t.relname = 'cart_items'
          AND a.attname = 'product_id'
          AND rt.relname = 'products'
      LOOP
        EXECUTE format('ALTER TABLE "cart_items" DROP CONSTRAINT IF EXISTS %I', constraint_name);
      END LOOP;
    END $$;

    ALTER TABLE "cart_items" ADD CONSTRAINT "cart_items_product_id_products_id_fk"
      FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE;

    DO $$ DECLARE constraint_name text; BEGIN
      FOR constraint_name IN
        SELECT c.conname
        FROM pg_constraint c
        JOIN pg_class t ON c.conrelid = t.oid
        JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = ANY (c.conkey)
        JOIN pg_class rt ON c.confrelid = rt.oid
        WHERE c.contype = 'f'
          AND t.relname = 'cart_items'
          AND a.attname = 'merchant_product_id'
          AND rt.relname = 'merchant_products'
      LOOP
        EXECUTE format('ALTER TABLE "cart_items" DROP CONSTRAINT IF EXISTS %I', constraint_name);
      END LOOP;
    END $$;

    ALTER TABLE "cart_items" ADD CONSTRAINT "cart_items_merchant_product_id_merchant_products_id_fk"
      FOREIGN KEY ("merchant_product_id") REFERENCES "merchant_products"("id") ON DELETE CASCADE;
  `)

  await db.execute(sql`
    DO $$ DECLARE constraint_name text; BEGIN
      FOR constraint_name IN
        SELECT c.conname
        FROM pg_constraint c
        JOIN pg_class t ON c.conrelid = t.oid
        JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = ANY (c.conkey)
        JOIN pg_class rt ON c.confrelid = rt.oid
        WHERE c.contype = 'f'
          AND t.relname = 'merchant_products'
          AND a.attname = 'product_id_id'
          AND rt.relname = 'products'
      LOOP
        EXECUTE format('ALTER TABLE "merchant_products" DROP CONSTRAINT IF EXISTS %I', constraint_name);
      END LOOP;
    END $$;

    ALTER TABLE "merchant_products" ADD CONSTRAINT "merchant_products_product_id_id_products_id_fk"
      FOREIGN KEY ("product_id_id") REFERENCES "products"("id") ON DELETE CASCADE;
  `)

  await db.execute(sql`
    DO $$ DECLARE constraint_name text; BEGIN
      FOR constraint_name IN
        SELECT c.conname
        FROM pg_constraint c
        JOIN pg_class t ON c.conrelid = t.oid
        JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = ANY (c.conkey)
        JOIN pg_class rt ON c.confrelid = rt.oid
        WHERE c.contype = 'f'
          AND t.relname = 'modifier_groups'
          AND a.attname = 'product_id_id'
          AND rt.relname = 'products'
      LOOP
        EXECUTE format('ALTER TABLE "modifier_groups" DROP CONSTRAINT IF EXISTS %I', constraint_name);
      END LOOP;
    END $$;

    ALTER TABLE "modifier_groups" ADD CONSTRAINT "modifier_groups_product_id_id_products_id_fk"
      FOREIGN KEY ("product_id_id") REFERENCES "products"("id") ON DELETE CASCADE;
  `)

  await db.execute(sql`
    DO $$ DECLARE constraint_name text; BEGIN
      FOR constraint_name IN
        SELECT c.conname
        FROM pg_constraint c
        JOIN pg_class t ON c.conrelid = t.oid
        JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = ANY (c.conkey)
        JOIN pg_class rt ON c.confrelid = rt.oid
        WHERE c.contype = 'f'
          AND t.relname = 'modifier_options'
          AND a.attname = 'modifier_group_id_id'
          AND rt.relname = 'modifier_groups'
      LOOP
        EXECUTE format('ALTER TABLE "modifier_options" DROP CONSTRAINT IF EXISTS %I', constraint_name);
      END LOOP;
    END $$;

    ALTER TABLE "modifier_options" ADD CONSTRAINT "modifier_options_modifier_group_id_id_modifier_groups_id_fk"
      FOREIGN KEY ("modifier_group_id_id") REFERENCES "modifier_groups"("id") ON DELETE CASCADE;
  `)

  await db.execute(sql`
    DO $$ DECLARE constraint_name text; BEGIN
      FOR constraint_name IN
        SELECT c.conname
        FROM pg_constraint c
        JOIN pg_class t ON c.conrelid = t.oid
        JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = ANY (c.conkey)
        JOIN pg_class rt ON c.confrelid = rt.oid
        WHERE c.contype = 'f'
          AND t.relname = 'prod_variations'
          AND a.attname = 'product_id_id'
          AND rt.relname = 'products'
      LOOP
        EXECUTE format('ALTER TABLE "prod_variations" DROP CONSTRAINT IF EXISTS %I', constraint_name);
      END LOOP;
    END $$;

    ALTER TABLE "prod_variations" ADD CONSTRAINT "prod_variations_product_id_id_products_id_fk"
      FOREIGN KEY ("product_id_id") REFERENCES "products"("id") ON DELETE CASCADE;
  `)

  await db.execute(sql`
    DO $$ DECLARE constraint_name text; BEGIN
      FOR constraint_name IN
        SELECT c.conname
        FROM pg_constraint c
        JOIN pg_class t ON c.conrelid = t.oid
        JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = ANY (c.conkey)
        JOIN pg_class rt ON c.confrelid = rt.oid
        WHERE c.contype = 'f'
          AND t.relname = 'prod_variation_values'
          AND a.attname = 'variation_id_id'
          AND rt.relname = 'prod_variations'
      LOOP
        EXECUTE format('ALTER TABLE "prod_variation_values" DROP CONSTRAINT IF EXISTS %I', constraint_name);
      END LOOP;
    END $$;

    ALTER TABLE "prod_variation_values" ADD CONSTRAINT "prod_variation_values_variation_id_id_prod_variations_id_fk"
      FOREIGN KEY ("variation_id_id") REFERENCES "prod_variations"("id") ON DELETE CASCADE;
  `)

  await db.execute(sql`
    DO $$ DECLARE constraint_name text; BEGIN
      FOR constraint_name IN
        SELECT c.conname
        FROM pg_constraint c
        JOIN pg_class t ON c.conrelid = t.oid
        JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = ANY (c.conkey)
        JOIN pg_class rt ON c.confrelid = rt.oid
        WHERE c.contype = 'f'
          AND t.relname = 'prod_grouped_items'
          AND a.attname = 'parent_product_id_id'
          AND rt.relname = 'products'
      LOOP
        EXECUTE format('ALTER TABLE "prod_grouped_items" DROP CONSTRAINT IF EXISTS %I', constraint_name);
      END LOOP;
    END $$;

    ALTER TABLE "prod_grouped_items" ADD CONSTRAINT "prod_grouped_items_parent_product_id_id_products_id_fk"
      FOREIGN KEY ("parent_product_id_id") REFERENCES "products"("id") ON DELETE CASCADE;

    DO $$ DECLARE constraint_name text; BEGIN
      FOR constraint_name IN
        SELECT c.conname
        FROM pg_constraint c
        JOIN pg_class t ON c.conrelid = t.oid
        JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = ANY (c.conkey)
        JOIN pg_class rt ON c.confrelid = rt.oid
        WHERE c.contype = 'f'
          AND t.relname = 'prod_grouped_items'
          AND a.attname = 'child_product_id_id'
          AND rt.relname = 'products'
      LOOP
        EXECUTE format('ALTER TABLE "prod_grouped_items" DROP CONSTRAINT IF EXISTS %I', constraint_name);
      END LOOP;
    END $$;

    ALTER TABLE "prod_grouped_items" ADD CONSTRAINT "prod_grouped_items_child_product_id_id_products_id_fk"
      FOREIGN KEY ("child_product_id_id") REFERENCES "products"("id") ON DELETE CASCADE;
  `)

  await db.execute(sql`
    DO $$ DECLARE constraint_name text; BEGIN
      FOR constraint_name IN
        SELECT c.conname
        FROM pg_constraint c
        JOIN pg_class t ON c.conrelid = t.oid
        JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = ANY (c.conkey)
        JOIN pg_class rt ON c.confrelid = rt.oid
        WHERE c.contype = 'f'
          AND t.relname = 'prod_tags_junction'
          AND a.attname = 'product_id_id'
          AND rt.relname = 'products'
      LOOP
        EXECUTE format('ALTER TABLE "prod_tags_junction" DROP CONSTRAINT IF EXISTS %I', constraint_name);
      END LOOP;
    END $$;

    ALTER TABLE "prod_tags_junction" ADD CONSTRAINT "prod_tags_junction_product_id_id_products_id_fk"
      FOREIGN KEY ("product_id_id") REFERENCES "products"("id") ON DELETE CASCADE;
  `)

  await db.execute(sql`
    DO $$ DECLARE constraint_name text; BEGIN
      FOR constraint_name IN
        SELECT c.conname
        FROM pg_constraint c
        JOIN pg_class t ON c.conrelid = t.oid
        JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = ANY (c.conkey)
        JOIN pg_class rt ON c.confrelid = rt.oid
        WHERE c.contype = 'f'
          AND t.relname = 'products_media_images'
          AND a.attname = '_parent_id'
          AND rt.relname = 'products'
      LOOP
        EXECUTE format('ALTER TABLE "products_media_images" DROP CONSTRAINT IF EXISTS %I', constraint_name);
      END LOOP;
    END $$;

    ALTER TABLE "products_media_images" ADD CONSTRAINT "products_media_images_parent_id_fk"
      FOREIGN KEY ("_parent_id") REFERENCES "products"("id") ON DELETE CASCADE;
  `)

  await db.execute(sql`
    DO $$ DECLARE constraint_name text; BEGIN
      FOR constraint_name IN
        SELECT c.conname
        FROM pg_constraint c
        JOIN pg_class t ON c.conrelid = t.oid
        JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = ANY (c.conkey)
        JOIN pg_class rt ON c.confrelid = rt.oid
        WHERE c.contype = 'f'
          AND t.relname = 'products_rels'
          AND a.attname = 'parent_id'
          AND rt.relname = 'products'
      LOOP
        EXECUTE format('ALTER TABLE "products_rels" DROP CONSTRAINT IF EXISTS %I', constraint_name);
      END LOOP;
    END $$;

    ALTER TABLE "products_rels" ADD CONSTRAINT "products_rels_parent_fk"
      FOREIGN KEY ("parent_id") REFERENCES "products"("id") ON DELETE CASCADE;
  `)

  await db.execute(sql`
    DO $$ DECLARE constraint_name text; BEGIN
      FOR constraint_name IN
        SELECT c.conname
        FROM pg_constraint c
        JOIN pg_class t ON c.conrelid = t.oid
        JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = ANY (c.conkey)
        JOIN pg_class rt ON c.confrelid = rt.oid
        WHERE c.contype = 'f'
          AND t.relname = 'payload_locked_documents_rels'
          AND a.attname = 'products_id'
          AND rt.relname = 'products'
      LOOP
        EXECUTE format('ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS %I', constraint_name);
      END LOOP;
    END $$;

    ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_products_fk"
      FOREIGN KEY ("products_id") REFERENCES "products"("id") ON DELETE SET NULL;
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "order_items" DROP CONSTRAINT IF EXISTS "order_items_product_id_products_id_fk";
    ALTER TABLE "order_items" ADD CONSTRAINT "order_items_product_id_products_id_fk"
      FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE SET NULL;
    ALTER TABLE "order_items" DROP CONSTRAINT IF EXISTS "order_items_merchant_product_id_merchant_products_id_fk";
    ALTER TABLE "order_items" ADD CONSTRAINT "order_items_merchant_product_id_merchant_products_id_fk"
      FOREIGN KEY ("merchant_product_id") REFERENCES "merchant_products"("id") ON DELETE SET NULL;

    ALTER TABLE "cart_items" DROP CONSTRAINT IF EXISTS "cart_items_product_id_products_id_fk";
    ALTER TABLE "cart_items" ADD CONSTRAINT "cart_items_product_id_products_id_fk"
      FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE SET NULL;
    ALTER TABLE "cart_items" DROP CONSTRAINT IF EXISTS "cart_items_merchant_product_id_merchant_products_id_fk";
    ALTER TABLE "cart_items" ADD CONSTRAINT "cart_items_merchant_product_id_merchant_products_id_fk"
      FOREIGN KEY ("merchant_product_id") REFERENCES "merchant_products"("id") ON DELETE SET NULL;

    ALTER TABLE "merchant_products" DROP CONSTRAINT IF EXISTS "merchant_products_product_id_id_products_id_fk";
    ALTER TABLE "merchant_products" ADD CONSTRAINT "merchant_products_product_id_id_products_id_fk"
      FOREIGN KEY ("product_id_id") REFERENCES "products"("id") ON DELETE SET NULL;

    ALTER TABLE "modifier_groups" DROP CONSTRAINT IF EXISTS "modifier_groups_product_id_id_products_id_fk";
    ALTER TABLE "modifier_groups" ADD CONSTRAINT "modifier_groups_product_id_id_products_id_fk"
      FOREIGN KEY ("product_id_id") REFERENCES "products"("id") ON DELETE SET NULL;

    ALTER TABLE "modifier_options" DROP CONSTRAINT IF EXISTS "modifier_options_modifier_group_id_id_modifier_groups_id_fk";
    ALTER TABLE "modifier_options" ADD CONSTRAINT "modifier_options_modifier_group_id_id_modifier_groups_id_fk"
      FOREIGN KEY ("modifier_group_id_id") REFERENCES "modifier_groups"("id") ON DELETE SET NULL;

    ALTER TABLE "prod_variations" DROP CONSTRAINT IF EXISTS "prod_variations_product_id_id_products_id_fk";
    ALTER TABLE "prod_variations" ADD CONSTRAINT "prod_variations_product_id_id_products_id_fk"
      FOREIGN KEY ("product_id_id") REFERENCES "products"("id") ON DELETE SET NULL;

    ALTER TABLE "prod_variation_values" DROP CONSTRAINT IF EXISTS "prod_variation_values_variation_id_id_prod_variations_id_fk";
    ALTER TABLE "prod_variation_values" ADD CONSTRAINT "prod_variation_values_variation_id_id_prod_variations_id_fk"
      FOREIGN KEY ("variation_id_id") REFERENCES "prod_variations"("id") ON DELETE SET NULL;

    ALTER TABLE "prod_grouped_items" DROP CONSTRAINT IF EXISTS "prod_grouped_items_parent_product_id_id_products_id_fk";
    ALTER TABLE "prod_grouped_items" ADD CONSTRAINT "prod_grouped_items_parent_product_id_id_products_id_fk"
      FOREIGN KEY ("parent_product_id_id") REFERENCES "products"("id") ON DELETE SET NULL;
    ALTER TABLE "prod_grouped_items" DROP CONSTRAINT IF EXISTS "prod_grouped_items_child_product_id_id_products_id_fk";
    ALTER TABLE "prod_grouped_items" ADD CONSTRAINT "prod_grouped_items_child_product_id_id_products_id_fk"
      FOREIGN KEY ("child_product_id_id") REFERENCES "products"("id") ON DELETE SET NULL;

    ALTER TABLE "prod_tags_junction" DROP CONSTRAINT IF EXISTS "prod_tags_junction_product_id_id_products_id_fk";
    ALTER TABLE "prod_tags_junction" ADD CONSTRAINT "prod_tags_junction_product_id_id_products_id_fk"
      FOREIGN KEY ("product_id_id") REFERENCES "products"("id") ON DELETE SET NULL;

    ALTER TABLE "products_media_images" DROP CONSTRAINT IF EXISTS "products_media_images_parent_id_fk";
    ALTER TABLE "products_media_images" ADD CONSTRAINT "products_media_images_parent_id_fk"
      FOREIGN KEY ("_parent_id") REFERENCES "products"("id") ON DELETE CASCADE;

    ALTER TABLE "products_rels" DROP CONSTRAINT IF EXISTS "products_rels_parent_fk";
    ALTER TABLE "products_rels" ADD CONSTRAINT "products_rels_parent_fk"
      FOREIGN KEY ("parent_id") REFERENCES "products"("id") ON DELETE CASCADE;

    ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_products_fk";
    ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_products_fk"
      FOREIGN KEY ("products_id") REFERENCES "products"("id") ON DELETE SET NULL;
  `)
}
