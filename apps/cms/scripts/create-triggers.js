import { Pool } from 'pg'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import dotenv from 'dotenv'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../.env') })

// Database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URI
})

async function createTriggers() {
  try {
    console.log('🚀 Creating database triggers for automatic role record creation...')
    
    // Read the SQL file
    const sqlFilePath = path.join(__dirname, '../src/migrations/20250826_create_role_triggers.sql')
    const sqlContent = fs.readFileSync(sqlFilePath, 'utf8')
    
    // Execute the SQL
    await pool.query(sqlContent)
    
    console.log('✅ Database triggers created successfully!')
    
    // Verify triggers were created
    const result = await pool.query(`
      SELECT trigger_name, event_manipulation, event_object_table 
      FROM information_schema.triggers 
      WHERE event_object_table = 'users'
    `)
    
    console.log('📋 Triggers found:')
    result.rows.forEach(row => {
      console.log(`  - ${row.trigger_name} (${row.event_manipulation} on ${row.event_object_table})`)
    })
    
  } catch (error) {
    console.error('❌ Error creating triggers:', error)
  } finally {
    await pool.end()
  }
}

createTriggers()
