import payload from 'payload';
import path from 'path';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../.env') });

async function backfillCancelledDeliveries() {
    console.log('🔄 Starting backfill: map canceled/expired Lalamove deliveries → order status "cancelled"...');

    try {
        const { default: config } = await import('../src/payload.config');

        await payload.init({
            config,
            onInit: () => {
                console.log('✅ Payload initialized successfully');
            },
        });

        const orderIds = new Set<number>();
        const TERMINAL_FLIP_STATUSES = ['cancelled', 'delivered'];

        // 1. Orders whose denormalized delivery_status says canceled/expired.
        for (const deliveryStatus of ['canceled', 'expired']) {
            let page = 1;
            while (true) {
                const res = await payload.find({
                    collection: 'orders',
                    limit: 100,
                    page,
                    depth: 0,
                    where: { delivery_status: { equals: deliveryStatus } },
                });
                for (const o of res.docs as any[]) orderIds.add(Number(o.id));
                if (page >= (res.totalPages || 1)) break;
                page += 1;
            }
        }

        // 2. Orders pointing at a delivery-booking whose status is canceled/expired,
        //    even if order.delivery_status was never synced.
        for (const bkStatus of ['canceled', 'expired']) {
            let page = 1;
            while (true) {
                const res = await payload.find({
                    collection: 'delivery-bookings',
                    limit: 100,
                    page,
                    depth: 1,
                    where: { status: { equals: bkStatus } },
                });
                for (const bk of res.docs as any[]) {
                    const orderId =
                        typeof bk.order === 'object' ? bk.order?.id : bk.order;
                    if (orderId) orderIds.add(Number(orderId));
                }
                if (page >= (res.totalPages || 1)) break;
                page += 1;
            }
        }

        console.log(`📋 Found ${orderIds.size} candidate order(s) needing status sync`);

        let updatedCount = 0;
        let skippedCount = 0;

        for (const id of Array.from(orderIds)) {
            const order = await payload.findByID({
                collection: 'orders',
                id,
                depth: 0,
            }) as any;
            if (!order || TERMINAL_FLIP_STATUSES.includes(order.status)) {
                skippedCount += 1;
                continue;
            }

            const deliveryStatus =
                order.delivery_status === 'expired' ? 'expired' : 'canceled';

            try {
                await payload.update({
                    collection: 'orders',
                    id,
                    data: {
                        status: 'cancelled',
                        delivery_status: deliveryStatus as any,
                    },
                });
                updatedCount += 1;
                console.log(`✅ Order ${id}: status ${order.status} → cancelled`);
            } catch (error: any) {
                console.error(`❌ Failed to update order ${id}:`, error?.message || error);
            }
        }

        console.log('--- Backfill Summary ---');
        console.log(`✅ Successfully updated: ${updatedCount}`);
        console.log(`⏭️  Skipped (already terminal): ${skippedCount}`);
        console.log('-------------------------');
    } catch (error: any) {
        console.error('❌ Backfill failed:', error);
        process.exit(1);
    }

    process.exit(0);
}

backfillCancelledDeliveries();