#!/usr/bin/env node

/**
 * Supabase Database Backup Script
 * 
 * This script creates a complete backup of your Supabase database using pg_dump.
 * It includes both schema and data, with timestamp naming and compression.
 * 
 * Requirements:
 * - PostgreSQL client tools (pg_dump) must be installed
 * - Node.js environment with access to environment variables
 * 
 * Usage: node backup-supabase.js
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

// Configuration
const BACKUP_DIR = path.join(__dirname, 'backups');
const MAX_BACKUPS = 10; // Keep only the last 10 backups

// Parse DATABASE_URI to extract connection details
function parseDatabaseUri(uri) {
    const url = new URL(uri);
    return {
        host: url.hostname,
        port: url.port || 5432,
        database: url.pathname.slice(1), // Remove leading slash
        username: url.username,
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
        .split('.')[0]; // Remove milliseconds
}

// Clean up old backups (keep only MAX_BACKUPS)
function cleanupOldBackups() {
    try {
        const files = fs.readdirSync(BACKUP_DIR)
            .filter(file => file.startsWith('supabase_backup_') && file.endsWith('.sql.gz'))
            .map(file => ({
                name: file,
                path: path.join(BACKUP_DIR, file),
                stats: fs.statSync(path.join(BACKUP_DIR, file))
            }))
            .sort((a, b) => b.stats.mtime - a.stats.mtime); // Sort by modification time (newest first)

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

// Create database backup
function createBackup() {
    console.log('🚀 Starting Supabase database backup...');
    
    // Parse database connection details
    const dbConfig = parseDatabaseUri(process.env.DATABASE_URI);
    const timestamp = getTimestamp();
    const backupFileName = `supabase_backup_${timestamp}.sql`;
    const compressedFileName = `${backupFileName}.gz`;
    const backupPath = path.join(BACKUP_DIR, backupFileName);
    const compressedPath = path.join(BACKUP_DIR, compressedFileName);

    console.log(`📊 Database: ${dbConfig.database}@${dbConfig.host}:${dbConfig.port}`);
    console.log(`📁 Backup file: ${compressedFileName}`);

    try {
        // Set PGPASSWORD environment variable for pg_dump
        const env = { ...process.env, PGPASSWORD: dbConfig.password };

        // Create pg_dump command
        const pgDumpCommand = [
            'pg_dump',
            `--host=${dbConfig.host}`,
            `--port=${dbConfig.port}`,
            `--username=${dbConfig.username}`,
            `--dbname=${dbConfig.database}`,
            '--verbose',
            '--clean',
            '--if-exists',
            '--create',
            '--format=plain',
            `--file=${backupPath}`
        ].join(' ');

        console.log('⏳ Running pg_dump...');
        execSync(pgDumpCommand, { 
            env,
            stdio: ['inherit', 'pipe', 'inherit'],
            maxBuffer: 1024 * 1024 * 100 // 100MB buffer
        });

        // Compress the backup file
        console.log('🗜️  Compressing backup...');
        execSync(`gzip "${backupPath}"`, { stdio: 'inherit' });

        // Get file size
        const stats = fs.statSync(compressedPath);
        const fileSizeMB = (stats.size / (1024 * 1024)).toFixed(2);

        console.log(`✅ Backup completed successfully!`);
        console.log(`📦 File: ${compressedFileName}`);
        console.log(`📏 Size: ${fileSizeMB} MB`);
        console.log(`📍 Location: ${compressedPath}`);

        // Clean up old backups
        cleanupOldBackups();

        return compressedPath;

    } catch (error) {
        console.error('❌ Backup failed:', error.message);
        
        // Clean up partial backup file if it exists
        if (fs.existsSync(backupPath)) {
            fs.unlinkSync(backupPath);
        }
        if (fs.existsSync(compressedPath)) {
            fs.unlinkSync(compressedPath);
        }
        
        throw error;
    }
}

// Verify backup file
function verifyBackup(backupPath) {
    try {
        const stats = fs.statSync(backupPath);
        if (stats.size === 0) {
            throw new Error('Backup file is empty');
        }
        
        // Basic verification - check if it's a valid gzip file
        execSync(`gzip -t "${backupPath}"`, { stdio: 'pipe' });
        
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
        console.log('🔄 Supabase Database Backup Tool');
        console.log('================================');
        
        // Check if DATABASE_URI is available
        if (!process.env.DATABASE_URI) {
            throw new Error('DATABASE_URI environment variable is not set');
        }

        // Ensure backup directory exists
        ensureBackupDirectory();

        // Create backup
        const backupPath = createBackup();

        // Verify backup
        if (verifyBackup(backupPath)) {
            console.log('🎉 Backup process completed successfully!');
            console.log(`\n📋 Summary:`);
            console.log(`   • Backup file: ${path.basename(backupPath)}`);
            console.log(`   • Location: ${backupPath}`);
            console.log(`   • Timestamp: ${new Date().toISOString()}`);
        } else {
            throw new Error('Backup verification failed');
        }

    } catch (error) {
        console.error('\n💥 Backup process failed:');
        console.error(`   Error: ${error.message}`);
        console.error('\n🔧 Troubleshooting:');
        console.error('   • Ensure PostgreSQL client tools (pg_dump) are installed');
        console.error('   • Check DATABASE_URI in .env file');
        console.error('   • Verify network connectivity to Supabase');
        console.error('   • Ensure sufficient disk space for backup');
        process.exit(1);
    }
}

// Run the backup
if (require.main === module) {
    main();
}

module.exports = { main, createBackup, verifyBackup };