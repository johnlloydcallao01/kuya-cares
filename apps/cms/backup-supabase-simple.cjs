#!/usr/bin/env node

/**
 * Simple Supabase Database Backup Script (Node.js Native)
 * 
 * This script creates a backup of your Supabase database using Node.js and the pg library.
 * It doesn't require PostgreSQL client tools to be installed locally.
 * 
 * Requirements:
 * - Node.js environment
 * - pg library (npm install pg)
 * 
 * Usage: node backup-supabase-simple.cjs
 */

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
require('dotenv').config();

// Configuration
const BACKUP_DIR = path.join(__dirname, 'backups');
const MAX_BACKUPS = 10;

// Parse DATABASE_URI to extract connection details
function parseDatabaseUri(uri) {
    const url = new URL(uri);
    return {
        host: url.hostname,
        port: url.port || 5432,
        database: url.pathname.slice(1),
        user: url.username,
        password: decodeURIComponent(url.password)
    };
}

// Create backup directory if it doesn't exist
function ensureBackupDirectory() {
    if (!fs.existsSync(BACKUP_DIR)) {
        fs.mkdirSync(BACKUP_DIR, { recursive: true });
        console.log(`✅ Created backup directory: ${BACKUP_DIR}`);
    }
}

// Generate timestamp for backup filename
function getTimestamp() {
    const now = new Date();
    return now.toISOString()
        .replace(/[:.]/g, '-')
        .replace('T', '_')
        .split('.')[0];
}

// Clean up old backups
function cleanupOldBackups() {
    try {
        const files = fs.readdirSync(BACKUP_DIR)
            .filter(file => file.startsWith('supabase_backup_') && file.endsWith('.json.gz'))
            .map(file => ({
                name: file,
                path: path.join(BACKUP_DIR, file),
                stats: fs.statSync(path.join(BACKUP_DIR, file))
            }))
            .sort((a, b) => b.stats.mtime - a.stats.mtime);

        if (files.length > MAX_BACKUPS) {
            const filesToDelete = files.slice(MAX_BACKUPS);
            filesToDelete.forEach(file => {
                fs.unlinkSync(file.path);
                console.log(`🗑️  Deleted old backup: ${file.name}`);
            });
        }
    } catch (error) {
        console.warn(`⚠️  Warning: Could not clean up old backups: ${error.message}`);
    }
}

// Get all table names from the database
async function getAllTables(client) {
    const query = `
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_type = 'BASE TABLE'
        ORDER BY table_name;
    `;
    
    const result = await client.query(query);
    return result.rows.map(row => row.table_name);
}

// Get table schema information
async function getTableSchema(client, tableName) {
    const query = `
        SELECT 
            column_name,
            data_type,
            is_nullable,
            column_default,
            character_maximum_length
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = '${tableName}'
        ORDER BY ordinal_position;
    `;
    
    const result = await client.query(query);
    return result.rows;
}

// Get all data from a table
async function getTableData(client, tableName) {
    try {
        const result = await client.query(`SELECT * FROM "${tableName}"`);
        return result.rows;
    } catch (error) {
        console.warn(`⚠️  Warning: Could not backup data from table ${tableName}: ${error.message}`);
        return [];
    }
}

// Create database backup
async function createBackup() {
    console.log('🚀 Starting Supabase database backup...');
    
    // Dynamic import for pg
    const { Client } = await import('pg');
    
    const dbConfig = parseDatabaseUri(process.env.DATABASE_URI);
    const timestamp = getTimestamp();
    const backupFileName = `supabase_backup_${timestamp}.json`;
    const compressedFileName = `${backupFileName}.gz`;
    const backupPath = path.join(BACKUP_DIR, backupFileName);
    const compressedPath = path.join(BACKUP_DIR, compressedFileName);

    console.log(`📊 Database: ${dbConfig.database}@${dbConfig.host}:${dbConfig.port}`);
    console.log(`📁 Backup file: ${compressedFileName}`);

    const client = new Client(dbConfig);

    try {
        // Connect to database
        console.log('🔌 Connecting to database...');
        await client.connect();

        // Get all tables
        console.log('📋 Getting table list...');
        const tables = await getAllTables(client);
        console.log(`📊 Found ${tables.length} tables to backup`);

        const backup = {
            metadata: {
                timestamp: new Date().toISOString(),
                database: dbConfig.database,
                host: dbConfig.host,
                tables_count: tables.length,
                backup_type: 'full_data_export'
            },
            tables: {}
        };

        // Backup each table
        for (const tableName of tables) {
            console.log(`📦 Backing up table: ${tableName}`);
            
            const schema = await getTableSchema(client, tableName);
            const data = await getTableData(client, tableName);
            
            backup.tables[tableName] = {
                schema: schema,
                data: data,
                row_count: data.length
            };
            
            console.log(`   ✅ ${data.length} rows backed up`);
        }

        // Write backup to file
        console.log('💾 Writing backup file...');
        fs.writeFileSync(backupPath, JSON.stringify(backup, null, 2));

        // Compress the backup
        console.log('🗜️  Compressing backup...');
        const input = fs.createReadStream(backupPath);
        const output = fs.createWriteStream(compressedPath);
        const gzip = zlib.createGzip();

        await new Promise((resolve, reject) => {
            input.pipe(gzip).pipe(output);
            output.on('finish', resolve);
            output.on('error', reject);
        });

        // Remove uncompressed file
        fs.unlinkSync(backupPath);

        // Get file size
        const stats = fs.statSync(compressedPath);
        const fileSizeMB = (stats.size / (1024 * 1024)).toFixed(2);

        console.log(`✅ Backup completed successfully!`);
        console.log(`📦 File: ${compressedFileName}`);
        console.log(`📏 Size: ${fileSizeMB} MB`);
        console.log(`📊 Tables: ${tables.length}`);
        console.log(`📍 Location: ${compressedPath}`);

        // Clean up old backups
        cleanupOldBackups();

        return compressedPath;

    } catch (error) {
        console.error('❌ Backup failed:', error.message);
        
        // Clean up partial files
        if (fs.existsSync(backupPath)) {
            fs.unlinkSync(backupPath);
        }
        if (fs.existsSync(compressedPath)) {
            fs.unlinkSync(compressedPath);
        }
        
        throw error;
    } finally {
        await client.end();
    }
}

// Verify backup file
function verifyBackup(backupPath) {
    try {
        const stats = fs.statSync(backupPath);
        if (stats.size === 0) {
            throw new Error('Backup file is empty');
        }
        
        console.log('✅ Backup file verification passed');
        return true;
    } catch (error) {
        console.error('❌ Backup verification failed:', error.message);
        return false;
    }
}

// Main execution
async function main() {
    try {
        console.log('🔄 Supabase Database Backup Tool (Node.js Native)');
        console.log('================================================');
        
        if (!process.env.DATABASE_URI) {
            throw new Error('DATABASE_URI environment variable is not set');
        }

        ensureBackupDirectory();
        const backupPath = await createBackup();

        if (verifyBackup(backupPath)) {
            console.log('🎉 Backup process completed successfully!');
            console.log(`\n📋 Summary:`);
            console.log(`   • Backup file: ${path.basename(backupPath)}`);
            console.log(`   • Location: ${backupPath}`);
            console.log(`   • Format: Compressed JSON`);
            console.log(`   • Timestamp: ${new Date().toISOString()}`);
            console.log(`\n💡 Note: This is a JSON data export. For SQL format, use pg_dump.`);
        } else {
            throw new Error('Backup verification failed');
        }

    } catch (error) {
        console.error('\n💥 Backup process failed:');
        console.error(`   Error: ${error.message}`);
        console.error('\n🔧 Troubleshooting:');
        console.error('   • Check DATABASE_URI in .env file');
        console.error('   • Verify network connectivity to Supabase');
        console.error('   • Ensure sufficient disk space for backup');
        console.error('   • Install pg library: npm install pg');
        process.exit(1);
    }
}

// Run the backup
if (require.main === module) {
    main();
}

module.exports = { main, createBackup, verifyBackup };