import pkg from 'pg';
const { Pool } = pkg;
import dotenv from 'dotenv';
dotenv.config();

async function testDatabaseConnection() {
  console.log('🔍 Testing database connection...');
  
  const pool = new Pool({
    connectionString: process.env.DATABASE_URI,
  });

  try {
    // Test basic connection
    const client = await pool.connect();
    console.log('✅ Database connection successful');
    
    // Test PostGIS extension
    const postgisResult = await client.query('SELECT PostGIS_Version();');
    console.log('✅ PostGIS extension available:', postgisResult.rows[0]);
    
    // Check if merchants table exists
    const tableResult = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'merchants'
      );
    `);
    console.log('✅ Merchants table exists:', tableResult.rows[0].exists);
    
    // Check merchant_coordinates column
    const columnResult = await client.query(`
      SELECT column_name, data_type, udt_name 
      FROM information_schema.columns 
      WHERE table_name = 'merchants' 
      AND column_name = 'merchant_coordinates';
    `);
    
    if (columnResult.rows.length > 0) {
      console.log('✅ merchant_coordinates column exists:', columnResult.rows[0]);
    } else {
      console.log('❌ merchant_coordinates column does not exist');
    }
    
    // Check for merchants with coordinates
    const merchantsResult = await client.query(`
      SELECT 
        COUNT(*) as total_merchants,
        COUNT(CASE WHEN merchant_latitude IS NOT NULL AND merchant_longitude IS NOT NULL THEN 1 END) as merchants_with_lat_lng,
        COUNT(CASE WHEN merchant_coordinates IS NOT NULL THEN 1 END) as merchants_with_coordinates
      FROM merchants;
    `);
    console.log('📊 Merchants data:', merchantsResult.rows[0]);
    
    // Check sample merchant data
    const sampleResult = await client.query(`
      SELECT id, outlet_name, merchant_latitude, merchant_longitude, merchant_coordinates
      FROM merchants 
      LIMIT 3;
    `);
    console.log('📋 Sample merchant data:', sampleResult.rows);
    
    client.release();
    
  } catch (error) {
    console.error('❌ Database connection failed:', error.message);
    console.error('🔍 Error details:', error);
  } finally {
    await pool.end();
  }
}

testDatabaseConnection();