import payload from 'payload';
import path from 'path';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';

// Setup dirname equivalent for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables BEFORE importing config
// Script is in apps/cms/scripts, .env is in apps/cms
dotenv.config({ path: path.resolve(__dirname, '../.env') });

async function addTimezoneToMerchants() {
    console.log('🔄 Starting migration: Add timezone field to merchants...');

    try {
        // Dynamic import of config to ensure env vars are loaded first
        const { default: config } = await import('../src/payload.config');

        // Initialize Payload
        await payload.init({
            config,
            onInit: () => {
                console.log('✅ Payload initialized successfully');
            },
        });

        // Find all merchants without a timezone
        const query: any = {
            or: [
                {
                    timezone: {
                        exists: false,
                    },
                },
                {
                    timezone: {
                        equals: null,
                    },
                },
                {
                    timezone: {
                        equals: '',
                    },
                },
            ],
        };

        const merchants = await payload.find({
            collection: 'merchants',
            limit: 1000,
            where: query,
        });

        console.log(`📋 Found ${merchants.docs.length} merchants needing timezone update`);

        if (merchants.docs.length === 0) {
            console.log('✅ No merchants to update. Migration complete.');
            process.exit(0);
        }

        let updatedCount = 0;
        let errorCount = 0;

        // Update each merchant
        for (const merchant of merchants.docs) {
            try {
                console.log(`🔄 Updating merchant: ${merchant.outletName} (${merchant.id})...`);

                await payload.update({
                    collection: 'merchants',
                    id: merchant.id,
                    data: {
                        timezone: 'Asia/Manila', // Default to Philippines timezone
                    } as any,
                });

                updatedCount++;
                console.log(`✅ Updated merchant: ${merchant.outletName}`);
            } catch (error) {
                console.error(`❌ Failed to update merchant ${merchant.id}:`, error);
                errorCount++;
            }
        }

        console.log('--- Migration Summary ---');
        console.log(`✅ Successfully updated: ${updatedCount}`);
        console.log(`❌ Failed updates: ${errorCount}`);
        console.log('-------------------------');

    } catch (error) {
        console.error('❌ Migration failed:', error);
        process.exit(1);
    }

    process.exit(0);
}

addTimezoneToMerchants();
