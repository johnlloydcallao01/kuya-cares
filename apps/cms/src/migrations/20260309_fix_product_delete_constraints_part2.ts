import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  // 1. Modifier Groups: Cascade delete
  await db.execute(sql`
    DO $$ BEGIN
      ALTER TABLE "modifier_groups" DROP CONSTRAINT IF EXISTS "modifier_groups_product_id_id_products_id_fk";
    EXCEPTION
      WHEN undefined_object THEN NULL;
    END $$;

    ALTER TABLE "modifier_groups" ADD CONSTRAINT "modifier_groups_product_id_id_products_id_fk" 
      FOREIGN KEY ("product_id_id") REFERENCES "products"("id") ON DELETE CASCADE;
  `)

  // 2. Prod Variations: Cascade delete
  // This was supposedly fixed in a previous migration, but we reinforce it here just in case.
  await db.execute(sql`
    DO $$ BEGIN
      ALTER TABLE "prod_variations" DROP CONSTRAINT IF EXISTS "prod_variations_product_id_id_products_id_fk";
    EXCEPTION
      WHEN undefined_object THEN NULL;
    END $$;

    ALTER TABLE "prod_variations" ADD CONSTRAINT "prod_variations_product_id_id_products_id_fk" 
      FOREIGN KEY ("product_id_id") REFERENCES "products"("id") ON DELETE CASCADE;
  `)

  // 3. Products Media Images: Cascade delete
  await db.execute(sql`
    DO $$ BEGIN
      ALTER TABLE "products_media_images" DROP CONSTRAINT IF EXISTS "products_media_images_parent_id_fk";
    EXCEPTION
      WHEN undefined_object THEN NULL;
    END $$;

    ALTER TABLE "products_media_images" ADD CONSTRAINT "products_media_images_parent_id_fk" 
      FOREIGN KEY ("_parent_id") REFERENCES "products"("id") ON DELETE CASCADE;
  `)

  // 4. Products Rels: Cascade delete
  await db.execute(sql`
    DO $$ BEGIN
      ALTER TABLE "products_rels" DROP CONSTRAINT IF EXISTS "products_rels_parent_fk";
    EXCEPTION
      WHEN undefined_object THEN NULL;
    END $$;

    ALTER TABLE "products_rels" ADD CONSTRAINT "products_rels_parent_fk" 
      FOREIGN KEY ("parent_id") REFERENCES "products"("id") ON DELETE CASCADE;
  `)

  // 5. Payload Locked Documents Rels: Set Null on delete (for product references)
  // These are polymorphic relations, usually Payload manages them, but let's be safe.
  await db.execute(sql`
    DO $$ BEGIN
      ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_products_fk";
    EXCEPTION
      WHEN undefined_object THEN NULL;
    END $$;

    ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_products_fk" 
      FOREIGN KEY ("products_id") REFERENCES "products"("id") ON DELETE SET NULL;
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  // Revert changes
  await db.execute(sql`
    ALTER TABLE "modifier_groups" DROP CONSTRAINT IF EXISTS "modifier_groups_product_id_id_products_id_fk";
    ALTER TABLE "modifier_groups" ADD CONSTRAINT "modifier_groups_product_id_id_products_id_fk" 
      FOREIGN KEY ("product_id_id") REFERENCES "products"("id") ON DELETE SET NULL;

    ALTER TABLE "prod_variations" DROP CONSTRAINT IF EXISTS "prod_variations_product_id_id_products_id_fk";
    ALTER TABLE "prod_variations" ADD CONSTRAINT "prod_variations_product_id_id_products_id_fk" 
      FOREIGN KEY ("product_id_id") REFERENCES "products"("id") ON DELETE SET NULL;

    ALTER TABLE "products_media_images" DROP CONSTRAINT IF EXISTS "products_media_images_parent_id_fk";
    ALTER TABLE "products_media_images" ADD CONSTRAINT "products_media_images_parent_id_fk" 
      FOREIGN KEY ("_parent_id") REFERENCES "products"("id") ON DELETE CASCADE; 
      -- Note: usually Payload creates CASCADE for arrays, but reverting to default behavior which is usually CASCADE for array tables. 
      -- If it was SET NULL before, we should set it to SET NULL. But for array tables it's typically CASCADE.
      -- The issue is if it was RESTRICT or something else.
      -- Assuming it was CASCADE before (as per generated schema usually), but let's just leave it as CASCADE in down too or try to restore 'original' if we knew it.
      -- Since we don't know the exact previous state for sure (schema file said 'onDelete: cascade' in generated file?), 
      -- if the generated schema said cascade, then we didn't need to change it? 
      -- Wait, the generated schema for products_media_images says: .onDelete('cascade').
      -- So that one might have been fine.
      
      -- Let's check modifier_groups in generated schema:
      -- product_id: ... references(..., { onDelete: 'set null' })
      -- So modifier_groups was definitely SET NULL.
  `)
}
