import { PayloadRequest } from 'payload'
import crypto from 'crypto'
import { CouponService } from '../services/CouponService'
import { WalletService } from '../services/WalletService'

export const paymongoWebhook = async (req: PayloadRequest) => {
  try {
    const signature = req.headers.get('paymongo-signature');
    
    // Get raw body for signature verification
    const rawBody = await (req as unknown as Request).text();
    let body;
    try {
        body = JSON.parse(rawBody);
    } catch (e) {
        return Response.json({ error: 'Invalid JSON' }, { status: 400 });
    }

    const secret = process.env.PAYMONGO_SANDBOX === 'true'
      ? process.env.PAYMONGO_SANDBOX_WEBHOOK_SECRET
      : process.env.PAYMONGO_WEBHOOK_SECRET;

    // 1. Verify Signature
    if (secret) {
        if (!verifySignature(rawBody, signature, secret)) {
             console.error('PayMongo Webhook Signature Verification Failed');
             return Response.json({ error: 'Invalid signature' }, { status: 401 });
        }
    } else {
        console.warn('PAYMONGO_WEBHOOK_SECRET not set. Skipping signature verification.');
    }

    const event = body.data.attributes;
    const type = event.type;
    const resource = event.data;

    console.log(`Received PayMongo Webhook: ${type}`, resource.id);

    // 2. Handle Events
    if (type === 'payment.paid') {
      const paymentIntentId = resource.attributes.payment_intent_id;
      
      // Find Transaction by payment_intent_id
      const transactions = await req.payload.find({
          collection: 'transactions',
          where: {
              payment_intent_id: {
                  equals: paymentIntentId
              }
          }
      });

      if (transactions.docs.length > 0) {
          const transaction = transactions.docs[0];
          
          // Update Transaction
          await req.payload.update({
              collection: 'transactions',
              id: transaction.id,
              data: {
                  status: 'paid',
                  paid_at: new Date(resource.attributes.paid_at * 1000).toISOString(),
              }
          });
          
          console.log(`Transaction ${transaction.id} updated to paid.`);

          // Update Order
          if (transaction.order) {
              const orderId = typeof transaction.order === 'object' ? transaction.order.id : transaction.order;
              // Check current order status to avoid overwriting advanced states (e.g. if it's already 'delivered')
              // But usually 'pending' -> 'accepted' is safe.
              
              await req.payload.update({
                  collection: 'orders',
                  id: orderId,
                  data: {
                      status: 'accepted',
                  }
              });
              console.log(`Order ${orderId} updated to accepted.`);

              // Update all CartItems linked to this order to 'ordered'
              await req.payload.update({
                  collection: 'cart-items',
                  where: {
                      order_id: {
                          equals: orderId
                      }
                  },
                  data: {
                      status: 'ordered',
                      ordered_at: new Date(resource.attributes.paid_at * 1000).toISOString(),
                  }
              });
              console.log(`Cart items for order ${orderId} soft-cleared (status: ordered).`);

              // Promote held coupon redemptions to applied + bump usage counters.
              // Best-effort: never blocks the payment acknowledgement.
              try {
                await new CouponService(req.payload).finalizeForOrder(orderId, true);
              } catch (couponErr) {
                console.error(`[paymongo/webhook] coupon finalize error for order ${orderId}:`, couponErr);
              }

              // Mark matching voucher claims as used (best-effort).
              try {
                const applied = await req.payload.find({
                  collection: 'coupon-redemptions',
                  where: {
                    and: [{ order: { equals: orderId } }, { status: { equals: 'applied' } }],
                  },
                  pagination: false,
                  limit: 20,
                  depth: 0,
                });
                const couponIds = new Set<string>();
                for (const r of ((applied as any).docs || []) as any[]) {
                  const cid = typeof r.coupon === 'object' ? r.coupon?.id : r.coupon;
                  if (cid != null) couponIds.add(String(cid));
                }
                const fullOrder = (await req.payload.findByID({ collection: 'orders', id: orderId, depth: 0 })) as any;
                const orderCustomer = fullOrder?.customer;
                const customerId = typeof orderCustomer === 'object' ? orderCustomer?.id : orderCustomer;
                for (const cid of couponIds) {
                  const claims = await req.payload.find({
                    collection: 'coupon-claims',
                    where: {
                      and: [
                        { coupon: { equals: Number(cid) || cid } },
                        { customer: { equals: Number(customerId) || customerId } },
                        { status: { equals: 'claimed' } },
                      ],
                    },
                    pagination: false,
                    limit: 5,
                    depth: 0,
                  });
                  for (const claim of ((claims as any).docs || []) as any[]) {
                    await req.payload.update({
                      collection: 'coupon-claims',
                      id: claim.id,
                      data: { status: 'used' },
                    });
                  }
                }
              } catch (claimErr) {
                console.error(`[paymongo/webhook] claim-used error for order ${orderId}:`, claimErr);
              }
          }
      } else {
          // Gateway-agnostic wallet top-up credit: same webhook, no new provider code.
          try {
            const topups = await req.payload.find({
              collection: 'wallet-topups',
              where: { payment_intent_id: { equals: paymentIntentId } },
              limit: 1,
            });
            const topup = (topups as any)?.docs?.[0];
            if (topup && topup.status === 'pending') {
              await req.payload.update({
                collection: 'wallet-topups',
                id: topup.id,
                data: {
                  status: 'paid',
                  paid_at: new Date(resource.attributes.paid_at * 1000).toISOString(),
                },
              });
              const customerId = typeof topup.customer === 'object' ? topup.customer.id : topup.customer;
              await new WalletService(req.payload).postEntry({
                customerId,
                type: 'topup',
                amount: Number(topup.amount),
                paymentIntentId,
                gateway: topup.gateway || 'paymongo',
                idempotencyKey: `wallet-topup:${String(topup.id)}:${paymentIntentId}`,
                meta: { topupId: topup.id },
              });
              console.log(`Wallet top-up ${topup.id} credited.`);
            } else {
              console.warn(`No transaction found for payment_intent_id: ${paymentIntentId}`);
            }
          } catch (walletErr) {
            console.error('[paymongo/webhook] wallet top-up credit error:', walletErr);
          }
      }

    } else if (type === 'payment.failed') {
       const paymentIntentId = resource.attributes.payment_intent_id;
       
       const transactions = await req.payload.find({
           collection: 'transactions',
           where: {
               payment_intent_id: {
                   equals: paymentIntentId
               }
           }
       });

       if (transactions.docs.length > 0) {
           const transaction = transactions.docs[0];
           
           await req.payload.update({
               collection: 'transactions',
               id: transaction.id,
               data: {
                   status: 'failed',
               }
           });
           console.log(`Transaction ${transaction.id} updated to failed.`);

           // Release held coupon redemptions so limited coupons are not burned.
           try {
             const failedOrder = (transaction as any).order;
             if (failedOrder) {
               const failedOrderId = typeof failedOrder === 'object' ? failedOrder.id : failedOrder;
               await new CouponService(req.payload).finalizeForOrder(failedOrderId, false);
             }
           } catch (couponErr) {
             console.error('[paymongo/webhook] coupon release error:', couponErr);
           }
       }
     } else if (typeof type === 'string' && type.includes('refund')) {
       // Reverse applied coupon redemptions on refunds (WooCommerce decrease_usage_count parity).
       try {
         const refundIntentId = resource.attributes?.payment_intent_id;
         if (refundIntentId) {
           const refundTx = await req.payload.find({
               collection: 'transactions',
               where: { payment_intent_id: { equals: refundIntentId } },
           });
           const refundOrder = (refundTx.docs[0] as any)?.order;
            if (refundOrder) {
              const refundOrderId = typeof refundOrder === 'object' ? refundOrder.id : refundOrder;
              await new CouponService(req.payload).reverseForOrder(refundOrderId, 'refunded');
              // Best-effort refund-to-wallet (idempotent ledger post).
              await new WalletService(req.payload).refundToWallet(refundOrderId);
            }
         }
       } catch (couponErr) {
         console.error('[paymongo/webhook] coupon refund-reverse error:', couponErr);
       }
     }

     // 3. Acknowledge Receipt
    return Response.json({ status: 'received' });
  } catch (error) {
    console.error('Webhook Error:', error);
    return Response.json({ error: 'Internal Server Error' }, { status: 500 });
  }
};

// Helper function to verify signature
function verifySignature(payload: string, signatureHeader: string | null, secret: string): boolean {
  if (!signatureHeader || !secret) return false;
  const parts = signatureHeader.split(',');
  const timestamp = parts.find(p => p.startsWith('t='))?.split('=')[1];
  const testSig = parts.find(p => p.startsWith('te='))?.split('=')[1];
  const liveSig = parts.find(p => p.startsWith('li='))?.split('=')[1];
  
  const sigToVerify = liveSig || testSig; // Use live or test signature
  if (!timestamp || !sigToVerify) return false;

  const stringToSign = `${timestamp}.${payload}`;
  const computedSignature = crypto
    .createHmac('sha256', secret)
    .update(stringToSign)
    .digest('hex');

  return computedSignature === sigToVerify;
}
