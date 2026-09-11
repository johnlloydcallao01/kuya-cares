# Supabase Database Backups

This directory contains automated backups of your Supabase database.

## 📁 Directory Structure

```
backups/
├── README.md                           # This file
├── supabase_backup_2025-01-17_14-30-00.sql.gz  # Compressed backup files
├── supabase_backup_2025-01-17_13-15-00.sql.gz
└── ...
```

## 🚀 Creating a Backup

To create a new backup, run:

```bash
node backup-supabase.js
```

## 📦 Backup File Format

- **Naming**: `supabase_backup_YYYY-MM-DD_HH-MM-SS.sql.gz`
- **Format**: Compressed PostgreSQL dump (gzip)
- **Contents**: Complete database schema + data
- **Retention**: Automatically keeps only the last 10 backups

## 🔄 Restoring from Backup

To restore a backup to your Supabase database:

1. **Decompress the backup file:**
   ```bash
   gunzip supabase_backup_2025-01-17_14-30-00.sql.gz
   ```

2. **Restore using psql:**
   ```bash
   psql "postgresql://postgres.awfqwaihngcrivdemkiw:%40Iamachessgrandmaster23@aws-1-ap-southeast-1.pooler.supabase.com:6543/postgres" < supabase_backup_2025-01-17_14-30-00.sql
   ```

   Or using environment variables:
   ```bash
   psql $DATABASE_URI < supabase_backup_2025-01-17_14-30-00.sql
   ```

## ⚠️ Important Notes

- **Production Safety**: Always test restores on a development database first
- **Data Loss**: Restoring will overwrite your current database
- **Permissions**: Ensure you have proper database permissions
- **Storage**: Monitor disk space as backups can be large

## 🛠️ Requirements

- PostgreSQL client tools (`pg_dump`, `psql`)
- Node.js environment
- Network access to Supabase
- Sufficient local disk space

## 📊 Backup Contents

Each backup includes:
- ✅ All database schemas
- ✅ All table data
- ✅ Indexes and constraints
- ✅ Functions and triggers
- ✅ User permissions
- ✅ Extensions (PostGIS, etc.)

## 🔐 Security

- Backup files contain sensitive data
- Store in secure locations
- Consider encryption for long-term storage
- Regularly test backup integrity

## 📈 Monitoring

The backup script provides:
- ✅ Success/failure status
- 📏 File size information
- 🕐 Timestamp tracking
- 🧹 Automatic cleanup of old backups