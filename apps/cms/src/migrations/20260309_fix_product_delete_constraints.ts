import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  // 1. Order Items: Allow NULL for product references to preserve history
  await db.execute(sql`
    ALTER TABLE "order_items" ALTER COLUMN "product_id" DROP NOT NULL;
    ALTER TABLE "order_items" ALTER COLUMN "merchant_product_id" DROP NOT NULL;
  `)

  // 2. Cart Items: Cascade delete
  // Drop existing constraints (using IF EXISTS to be safe)
  await db.execute(sql`
    DO $$ BEGIN
      ALTER TABLE "cart_items" DROP CONSTRAINT IF EXISTS "cart_items_product_id_products_id_fk";
    EXCEPTION
      WHEN undefined_object THEN NULL;
    END $$;
    
    ALTER TABLE "cart_items" ADD CONSTRAINT "cart_items_product_id_products_id_fk" 
      FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE;
      
    DO $$ BEGIN
      ALTER TABLE "cart_items" DROP CONSTRAINT IF EXISTS "cart_items_merchant_product_id_merchant_products_id_fk";
    EXCEPTION
      WHEN undefined_object THEN NULL;
    END $$;

    ALTER TABLE "cart_items" ADD CONSTRAINT "cart_items_merchant_product_id_merchant_products_id_fk" 
      FOREIGN KEY ("merchant_product_id") REFERENCES "merchant_products"("id") ON DELETE CASCADE;
  `)

  // 3. Merchant Products: Cascade delete
  await db.execute(sql`
    DO $$ BEGIN
      ALTER TABLE "merchant_products" DROP CONSTRAINT IF EXISTS "merchant_products_product_id_id_products_id_fk";
    EXCEPTION
      WHEN undefined_object THEN NULL;
    END $$;

    ALTER TABLE "merchant_products" ADD CONSTRAINT "merchant_products_product_id_id_products_id_fk" 
      FOREIGN KEY ("product_id_id") REFERENCES "products"("id") ON DELETE CASCADE;
  `)

  // 4. Prod Grouped Items: Cascade delete
  await db.execute(sql`
    DO $$ BEGIN
      ALTER TABLE "prod_grouped_items" DROP CONSTRAINT IF EXISTS "prod_grouped_items_parent_product_id_id_products_id_fk";
    EXCEPTION
      WHEN undefined_object THEN NULL;
    END $$;

    ALTER TABLE "prod_grouped_items" ADD CONSTRAINT "prod_grouped_items_parent_product_id_id_products_id_fk" 
      FOREIGN KEY ("parent_product_id_id") REFERENCES "products"("id") ON DELETE CASCADE;

    DO $$ BEGIN
      ALTER TABLE "prod_grouped_items" DROP CONSTRAINT IF EXISTS "prod_grouped_items_child_product_id_id_products_id_fk";
    EXCEPTION
      WHEN undefined_object THEN NULL;
    END $$;

    ALTER TABLE "prod_grouped_items" ADD CONSTRAINT "prod_grouped_items_child_product_id_id_products_id_fk" 
      FOREIGN KEY ("child_product_id_id") REFERENCES "products"("id") ON DELETE CASCADE;
  `)

  // 5. Prod Tags Junction: Cascade delete
  await db.execute(sql`
    DO $$ BEGIN
      ALTER TABLE "prod_tags_junction" DROP CONSTRAINT IF EXISTS "prod_tags_junction_product_id_id_products_id_fk";
    EXCEPTION
      WHEN undefined_object THEN NULL;
    END $$;

    ALTER TABLE "prod_tags_junction" ADD CONSTRAINT "prod_tags_junction_product_id_id_products_id_fk" 
      FOREIGN KEY ("product_id_id") REFERENCES "products"("id") ON DELETE CASCADE;
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  // Revert changes
  
  // 1. Order Items (Cannot easily revert DROP NOT NULL if data exists, so skipping)

  // 2. Cart Items
  await db.execute(sql`
    ALTER TABLE "cart_items" DROP CONSTRAINT IF EXISTS "cart_items_product_id_products_id_fk";
    ALTER TABLE "cart_items" ADD CONSTRAINT "cart_items_product_id_products_id_fk" 
      FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE SET NULL;

    ALTER TABLE "cart_items" DROP CONSTRAINT IF EXISTS "cart_items_merchant_product_id_merchant_products_id_fk";
    ALTER TABLE "cart_items" ADD CONSTRAINT "cart_items_merchant_product_id_merchant_products_id_fk" 
      FOREIGN KEY ("merchant_product_id") REFERENCES "merchant_products"("id") ON DELETE SET NULL;
  `)

  // 3. Merchant Products
  await db.execute(sql`
    ALTER TABLE "merchant_products" DROP CONSTRAINT IF EXISTS "merchant_products_product_id_id_products_id_fk";
    ALTER TABLE "merchant_products" ADD CONSTRAINT "merchant_products_product_id_id_products_id_fk" 
      FOREIGN KEY ("product_id_id") REFERENCES "products"("id") ON DELETE SET NULL;
  `)

  // 4. Prod Grouped Items
  await db.execute(sql`
    ALTER TABLE "prod_grouped_items" DROP CONSTRAINT IF EXISTS "prod_grouped_items_parent_product_id_id_products_id_fk";
    ALTER TABLE "prod_grouped_items" ADD CONSTRAINT "prod_grouped_items_parent_product_id_id_products_id_fk" 
      FOREIGN KEY ("parent_product_id_id") REFERENCES "products"("id") ON DELETE SET NULL;

    ALTER TABLE "prod_grouped_items" DROP CONSTRAINT IF EXISTS "prod_grouped_items_child_product_id_id_products_id_fk";
    ALTER TABLE "prod_grouped_items" ADD CONSTRAINT "prod_grouped_items_child_product_id_id_products_id_fk" 
      FOREIGN KEY ("child_product_id_id") REFERENCES "products"("id") ON DELETE SET NULL;
  `)

  // 5. Prod Tags Junction
  await db.execute(sql`
    ALTER TABLE "prod_tags_junction" DROP CONSTRAINT IF EXISTS "prod_tags_junction_product_id_id_products_id_fk";
    ALTER TABLE "prod_tags_junction" ADD CONSTRAINT "prod_tags_junction_product_id_id_products_id_fk" 
      FOREIGN KEY ("product_id_id") REFERENCES "products"("id") ON DELETE SET NULL;
  `)
}
