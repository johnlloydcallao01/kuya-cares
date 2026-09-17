// Comprehensive setup verification script
import { Client } from 'pg'
import { v2 as cloudinary } from 'cloudinary'
import dotenv from 'dotenv'

// Load environment variables
dotenv.config()

console.log('🔍 Verifying CMS Setup...\n')

// 1. Check Environment Variables
console.log('📋 Environment Variables Check:')
const requiredEnvVars = [
  'DATABASE_URI',
  'PAYLOAD_SECRET',
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
  'CLOUDINARY_CLOUD_NAME',
  'CLOUDINARY_API_KEY',
  'CLOUDINARY_API_SECRET',
  'RESEND_API_KEY',
  'RESEND_FROM_EMAIL',
  'ENABLE_EMAIL_NOTIFICATIONS',
  'EMAIL_FROM_NAME',
  'EMAIL_REPLY_TO'
]

let envVarsOk = true
requiredEnvVars.forEach(varName => {
  const value = process.env[varName]
  if (value) {
    console.log(`✅ ${varName}: ${varName.includes('SECRET') || varName.includes('KEY') ? '****' : value}`)
  } else {
    console.log(`❌ ${varName}: Missing`)
    envVarsOk = false
  }
})

if (!envVarsOk) {
  console.log('\n❌ Some environment variables are missing!')
  process.exit(1)
}

// 2. Test Database Connection
console.log('\n🗄️  Database Connection Test:')
async function testDatabase() {
  const client = new Client({
    connectionString: process.env.DATABASE_URI,
  })

  try {
    await client.connect()
    console.log('✅ Database connection successful')
    
    // Test query
    const result = await client.query('SELECT version()')
    console.log(`✅ PostgreSQL version: ${result.rows[0].version.split(',')[0]}`)
    
    await client.end()
  } catch (error) {
    console.log(`❌ Database connection failed: ${error.message}`)
    return false
  }
  return true
}

// 3. Test Cloudinary Connection
console.log('\n☁️  Cloudinary Connection Test:')
async function testCloudinary() {
  try {
    cloudinary.config({
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
      api_key: process.env.CLOUDINARY_API_KEY,
      api_secret: process.env.CLOUDINARY_API_SECRET,
    })

    // Test API connection
    const result = await cloudinary.api.ping()
    console.log('✅ Cloudinary connection successful')
    console.log(`✅ Cloud name: ${process.env.CLOUDINARY_CLOUD_NAME}`)
    return true
  } catch (error) {
    console.log(`❌ Cloudinary connection failed: ${error.message}`)
    return false
  }
}

// 4. Test Supabase URLs
console.log('\n🚀 Supabase Configuration Test:')
function testSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (url && url.includes('supabase.co')) {
    console.log('✅ Supabase URL format is correct')
  } else {
    console.log('❌ Supabase URL format is incorrect')
    return false
  }

  if (anonKey && anonKey.startsWith('eyJ')) {
    console.log('✅ Supabase anon key format is correct')
  } else {
    console.log('❌ Supabase anon key format is incorrect')
    return false
  }

  if (serviceKey && serviceKey.startsWith('eyJ')) {
    console.log('✅ Supabase service role key format is correct')
  } else {
    console.log('❌ Supabase service role key format is incorrect')
    return false
  }

  return true
}

// Run all tests
async function runAllTests() {
  console.log('=' .repeat(50))
  
  const dbTest = await testDatabase()
  const cloudinaryTest = await testCloudinary()
  const supabaseTest = testSupabase()

  console.log('\n' + '=' .repeat(50))
  console.log('📊 VERIFICATION SUMMARY:')
  console.log('=' .repeat(50))
  console.log(`Environment Variables: ${envVarsOk ? '✅ PASS' : '❌ FAIL'}`)
  console.log(`Database Connection: ${dbTest ? '✅ PASS' : '❌ FAIL'}`)
  console.log(`Cloudinary Connection: ${cloudinaryTest ? '✅ PASS' : '❌ FAIL'}`)
  console.log(`Supabase Configuration: ${supabaseTest ? '✅ PASS' : '❌ FAIL'}`)

  const allPassed = envVarsOk && dbTest && cloudinaryTest && supabaseTest
  
  if (allPassed) {
    console.log('\n🎉 ALL TESTS PASSED! Your CMS is ready to use!')
    console.log('🌐 Access your CMS at: http://localhost:3001/admin')
  } else {
    console.log('\n❌ Some tests failed. Please check the errors above.')
  }
  
  return allPassed
}

runAllTests().catch(console.error)
