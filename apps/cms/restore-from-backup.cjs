const fs = require('fs');
const zlib = require('zlib');
const { Client } = require('pg');
const path = require('path');

// Load environment variables
require('dotenv').config();

// Database connection configuration
const client = new Client({
    connectionString: process.env.DATABASE_URI
});

async function restoreFromBackup() {
    console.log('🔄 Starting database restoration from backup...\n');
    
    try {
        // Find the most recent backup file
        const backupsDir = path.join(__dirname, 'backups');
        const backupFiles = fs.readdirSync(backupsDir)
            .filter(file => file.startsWith('supabase_backup_') && file.endsWith('.json.gz'))
            .sort()
            .reverse();
        
        if (backupFiles.length === 0) {
            throw new Error('No backup files found in backups directory');
        }
        
        const latestBackup = backupFiles[0];
        const backupPath = path.join(backupsDir, latestBackup);
        
        console.log(`📦 Using backup file: ${latestBackup}`);
        console.log(`📍 Location: ${backupPath}\n`);
        
        // Read and decompress backup file
        console.log('📖 Reading backup file...');
        const compressedData = fs.readFileSync(backupPath);
        const decompressedData = zlib.gunzipSync(compressedData);
        const backupData = JSON.parse(decompressedData.toString());
        
        console.log(`✅ Backup loaded successfully`);
        console.log(`📊 Backup contains ${Object.keys(backupData.tables).length} tables\n`);
        
        // Connect to database
        console.log('🔌 Connecting to database...');
        await client.connect();
        console.log('✅ Connected to database\n');
        
        // Product management tables to restore
        const productTables = [
            'prod_attributes',
            'prod_attribute_terms', 
            'prod_variations',
            'prod_variation_values',
            'prod_grouped_items',
            'vendor_products',
            'merchant_products',
            'modifier_groups',
            'modifier_options',
            'prod_tags',
            'prod_tags_junction',
            'tag_groups',
            'tag_group_memberships'
        ];
        
        // Instead of creating tables from backup schema, use the original migration
        console.log('🔄 Using original migration to restore tables...\n');
        
        // Run the original migration to recreate all tables properly
        const { execSync } = require('child_process');
        
        try {
            console.log('📋 Running Payload migration to recreate tables...');
            execSync('pnpm exec payload migrate', { 
                cwd: __dirname, 
                stdio: 'inherit',
                env: { ...process.env, NODE_ENV: 'production' }
            });
            console.log('✅ Migration completed successfully\n');
        } catch (error) {
            console.error('❌ Migration failed:', error.message);
            throw error;
        }
        
        // Now restore data for tables that had data in the backup
        console.log('📥 Restoring data from backup...\n');
        
        for (const tableName of productTables) {
            if (backupData.tables[tableName] && backupData.tables[tableName].data && backupData.tables[tableName].data.length > 0) {
                console.log(`📦 Restoring data for table: ${tableName}`);
                
                const { data } = backupData.tables[tableName];
                console.log(`   📥 Inserting ${data.length} rows...`);
                
                const columns = Object.keys(data[0]);
                const placeholders = columns.map((_, i) => `$${i + 1}`).join(', ');
                const insertSQL = `INSERT INTO ${tableName} (${columns.join(', ')}) VALUES (${placeholders}) ON CONFLICT DO NOTHING`;
                
                for (const row of data) {
                    const values = columns.map(col => row[col]);
                    try {
                        await client.query(insertSQL, values);
                    } catch (error) {
                        console.log(`   ⚠️  Skipping row due to constraint: ${error.message}`);
                    }
                }
                
                console.log(`   ✅ Data restored for ${tableName}\n`);
            } else {
                console.log(`ℹ️  No data to restore for ${tableName}`);
            }
        }
        
        console.log('🎉 Database restoration completed successfully!');
        console.log(`📊 Restored ${productTables.length} product management tables`);
        
    } catch (error) {
        console.error('❌ Restoration failed:', error.message);
        console.error('Stack trace:', error.stack);
        process.exit(1);
    } finally {
        await client.end();
        console.log('🔌 Database connection closed');
    }
}

function generateCreateTableSQL(tableName, schema) {
    const columns = schema.map(col => {
        let columnDef = `${col.column_name} ${col.data_type}`;
        
        // Add length for character types
        if (col.character_maximum_length) {
            columnDef += `(${col.character_maximum_length})`;
        }
        
        // Add NOT NULL constraint
        if (col.is_nullable === 'NO') {
            columnDef += ' NOT NULL';
        }
        
        // Add default value
        if (col.column_default) {
            columnDef += ` DEFAULT ${col.column_default}`;
        }
        
        return columnDef;
    });
    
    return `CREATE TABLE IF NOT EXISTS ${tableName} (${columns.join(', ')})`;
}

// Run the restoration
if (require.main === module) {
    restoreFromBackup();
}

module.exports = { restoreFromBackup };