import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  console.log('🔄 Starting VendorProducts table removal migration...')

  try {
    // Add auto_assign_to_new_merchants column to products table
    await db.execute(sql`
      ALTER TABLE products 
      ADD COLUMN IF NOT EXISTS auto_assign_to_new_merchants BOOLEAN DEFAULT false;
    `)
    console.log('✅ Added auto_assign_to_new_merchants column to products table')

    // Drop the vendor_products table entirely
    await db.execute(sql`
      DROP TABLE IF EXISTS vendor_products CASCADE;
    `)
    console.log('✅ Dropped vendor_products table')

    // Also drop the merchant_products foreign key constraint that referenced vendor_products
    // (This was already fixed in previous migrations, but ensuring cleanup)
    
    console.log('✅ VendorProducts table removal migration completed successfully')
  } catch (error) {
    console.error('❌ Error in VendorProducts removal migration:', error)
    throw error
  }
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  console.log('🔄 Starting VendorProducts table restoration migration...')

  try {
    // Recreate vendor_products table
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS vendor_products (
        id SERIAL PRIMARY KEY,
        vendor_id_id INTEGER REFERENCES vendors(id) ON DELETE CASCADE,
        product_id_id INTEGER REFERENCES products(id) ON DELETE CASCADE,
        auto_assign_to_new_merchants BOOLEAN DEFAULT false,
        is_active BOOLEAN DEFAULT true,
        updated_at TIMESTAMP(3) WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
        created_at TIMESTAMP(3) WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
      );
    `)
    console.log('✅ Recreated vendor_products table')

    // Remove auto_assign_to_new_merchants column from products table
    await db.execute(sql`
      ALTER TABLE products 
      DROP COLUMN IF EXISTS auto_assign_to_new_merchants;
    `)
    console.log('✅ Removed auto_assign_to_new_merchants column from products table')

    console.log('✅ VendorProducts table restoration migration completed successfully')
  } catch (error) {
    console.error('❌ Error in VendorProducts restoration migration:', error)
    throw error
  }
}