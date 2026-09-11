# Safe Database Changes Guide

## Purpose
This guide helps everyone on the team safely modify our database without losing data or breaking the system. Follow these steps whenever you need to change any database table, column, or relationship.

## 🚨 DANGER ZONE - NEVER DO THIS

**NEVER run the fresh migration command** - This destroys ALL data in the entire database! Every table, every record, everything gone forever.

## The Safe Way to Change Database

### Step 1: Update Your Collection File
Make your changes in the collection file first. This tells PayloadCMS what you want the database to look like.

**Examples of changes:**
- Adding new fields to store more information
- Removing fields you no longer need
- Changing field types or requirements
- Updating dropdown options or validation rules

### Step 2: Create a Migration
Run this command to generate a migration file:
`pnpm payload migrate:create`

**What this does:**
- Compares your collection changes with the current database
- Creates a migration file with the necessary database commands
- Gives you both forward and backward migration options

### Step 3: Review the Migration
**ALWAYS check the generated migration file before running it!**

Look for:
- Are the changes what you expected?
- Will any existing data be lost?
- Are there any dangerous operations?

### Step 4: Apply the Migration
Run this command to update the database:
`pnpm payload migrate`

**What happens:**
- Only your specific changes are applied
- All other data remains untouched
- Database structure matches your collection definitions

## Common Database Changes

### Adding New Information
When you need to store new data:
1. Add the field to your collection file
2. Set appropriate default values for existing records
3. Generate and run migration
4. Existing records get the default value automatically

### Removing Unused Information
When you no longer need certain data:
1. Remove the field from your collection file
2. Update any admin display columns that reference it
3. Generate and run migration
4. The column and its data are permanently removed

### Changing Information Types
When you need to change how data is stored:
1. Update the field type in your collection file
2. Generate migration and review data conversion
3. Test with sample data first
4. Run migration to convert existing data

### Updating Dropdown Options
When you need to change available choices:
1. Update the options in your collection file
2. Consider what happens to existing records with old values
3. Generate and run migration
4. May need custom migration for data conversion

## Team Safety Rules

### ✅ ALWAYS DO:
- Test changes on development database first
- Review every migration before running it
- Back up important data before major changes
- Ask for help if you're unsure about a migration
- Keep migration files in version control
- Use clear, descriptive names for migrations

### ❌ NEVER DO:
- Use the fresh migration command with existing data
- Edit the database directly without migrations
- Skip reviewing generated migration files
- Delete migration files after running them
- Make changes directly in production database
- Ignore migration warnings or errors

## Available Commands

**Create new migration:**
`pnpm payload migrate:create`

**Apply pending migrations:**
`pnpm payload migrate`

**Force apply migrations (when dev mode conflicts occur):**
`pnpm payload migrate --force`

**Check migration status:**
`pnpm payload migrate:status`

**Undo last migration (dangerous):**
`pnpm payload migrate:down`

**Reset all migrations (EXTREMELY DANGEROUS - destroys all data):**
`pnpm payload migrate:fresh` ⚠️ **NEVER USE WITH EXISTING DATA**

## When Things Go Wrong

### Migration Fails
- Check your database connection
- Look for syntax errors in the migration
- Ensure no data conflicts prevent the change
- Ask for help if you can't resolve it

### Database Out of Sync
- Check migration status first
- Generate new migration if needed
- Never try to fix by editing database directly

### Dev Mode Conflicts ("data loss will occur" warning)
**Problem:** PayloadCMS detects you've run in dev mode and warns about data loss

**Solution:**
1. First check what migrations are pending: `pnpm payload migrate:status`
2. If you're confident about the changes, use: `pnpm payload migrate --force`
3. When prompted "Would you like to proceed?", respond with 'y' or 'yes'
4. Verify the migration applied: `pnpm payload migrate:status`

**Why this happens:** PayloadCMS tracks when you've made schema changes in development mode and wants to ensure you don't accidentally lose data.

### Interactive Terminal Prompts
**Always respond to terminal prompts when they appear:**
- PayloadCMS may ask for confirmation before applying migrations
- Read the prompt carefully and respond appropriately
- Use 'y' or 'yes' to proceed, 'n' or 'no' to cancel
- Don't ignore prompts - the process will hang indefinitely

### Different Environments
- Always test in development first
- Use same migration process everywhere
- Keep all environments synchronized

## Real Examples

### Example 1: Removing Unused Fields

**Situation:** You have a table with fields you no longer need

**Step 1:** Remove the fields from your collection file
**Step 2:** Run `pnpm payload migrate:create`
**Step 3:** Review the generated migration - should show column removals
**Step 4:** Run `pnpm payload migrate`
**Result:** Unused columns removed, all other data preserved

### Example 2: Adding Enum Values (Manual Migration)

**Situation:** You need to add a new role like 'service' to an existing enum

**Step 1:** Create a manual migration file in `src/migrations/`
```typescript
import { MigrateUpArgs, MigrateDownArgs } from '@payloadcms/db-postgres'
import { sql } from 'drizzle-orm'

export async function up({ payload }: MigrateUpArgs): Promise<void> {
  await payload.db.execute(sql`
    ALTER TYPE "public"."enum_users_role" ADD VALUE 'service';
  `)
}

export async function down({ payload }: MigrateDownArgs): Promise<void> {
  // Note: PostgreSQL doesn't support removing enum values
  // This migration is not reversible
}
```
**Step 2:** Run `pnpm payload migrate --force` if dev mode conflicts occur
**Step 3:** Respond 'y' when prompted about data loss
**Step 4:** Verify with `pnpm payload migrate:status`
**Result:** New enum value added successfully

### Example 3: Handling Dev Mode Conflicts

**Situation:** You get "data loss will occur" warning

**Terminal Output:**
```
? It looks like you've run Payload in dev mode, meaning you've 
dynamically pushed changes to your database.

If you'd like to run migrations, data loss will occur. Would you 
like to proceed? » (y/N)
```

**Action:** Type 'y' and press Enter to proceed
**Result:** Migration applies successfully

## Key Principles

**Data Safety First:** Always prioritize keeping existing data safe over speed or convenience.

**Test Everything:** Never apply untested changes to production data.

**Ask for Help:** If you're unsure about a migration, ask a team member to review it.

**Document Changes:** Keep clear records of what changes were made and why.

---

**Remember: A few extra minutes reviewing migrations can save hours of data recovery work.**
