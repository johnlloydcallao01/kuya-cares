import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  console.log('🔧 Creating indexes for category filtering performance optimization...')

  try {
    // Index on merchant_products for fast merchant-product lookups
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_merchant_products_merchant_id 
      ON merchant_products(merchant_id_id) 
      WHERE is_active = true AND is_available = true;
    `)
    console.log('✅ Created index: idx_merchant_products_merchant_id')

    // Index on products_rels for CATEGORY ID lookups (most important for this approach)
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_products_rels_category 
      ON products_rels(prod_categories_id) 
      WHERE path = 'categories';
    `)
    console.log('✅ Created index: idx_products_rels_category')

    // Composite index for the exact query pattern on products_rels
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_products_rels_parent_category
      ON products_rels(parent_id, prod_categories_id, path);
    `)
    console.log('✅ Created index: idx_products_rels_parent_category')

    // Composite index for merchant_products query pattern
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_mp_active_available
      ON merchant_products(merchant_id_id, product_id_id, is_active, is_available);
    `)
    console.log('✅ Created index: idx_mp_active_available')

    console.log('🎉 All category filtering indexes created successfully!')

  } catch (error) {
    console.error('❌ Error creating category filtering indexes:', error)
    throw error
  }
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  console.log('🔧 Removing category filtering indexes...')

  try {
    // Remove indexes in reverse order
    await db.execute(sql`DROP INDEX IF EXISTS idx_mp_active_available;`)
    console.log('✅ Removed index: idx_mp_active_available')

    await db.execute(sql`DROP INDEX IF EXISTS idx_products_rels_parent_category;`)
    console.log('✅ Removed index: idx_products_rels_parent_category')

    await db.execute(sql`DROP INDEX IF EXISTS idx_products_rels_category;`)
    console.log('✅ Removed index: idx_products_rels_category')

    await db.execute(sql`DROP INDEX IF EXISTS idx_merchant_products_merchant_id;`)
    console.log('✅ Removed index: idx_merchant_products_merchant_id')

    console.log('🎉 All category filtering indexes removed successfully!')

  } catch (error) {
    console.error('❌ Error removing category filtering indexes:', error)
    throw error
  }
}