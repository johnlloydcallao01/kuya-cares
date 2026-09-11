# Implementation Plan: Cart Soft Clearing via Webhook

This document outlines the step-by-step plan to transition the `apps/mobile-customer` and `apps/cms` from hard-deleting cart items to "soft clearing" them using the newly added schema fields (`status`, `order_id`, `ordered_at`, `deleted_at`).

## 1. Backend: Link and Clear via Webhook (`apps/cms`)

**File:** `apps/cms/src/endpoints/paymongoWebhook.ts`

*   **Objective:** When a payment is successfully processed, the webhook must find all cart items associated with the order and soft-clear them.
*   **Action:** Inside the `payment.paid` event handler, right after updating the `Order` to `accepted`, execute a bulk update on the `cart-items` collection.
*   **Logic:**
    ```typescript
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
    ```

## 2. Mobile App: Filter Active Cart Items (`apps/mobile-customer`)

**File:** `apps/mobile-customer/src/contexts/CartContext.tsx`

*   **Objective:** The frontend must only display cart items that are currently `active`. Once the webhook changes their status to `ordered`, they should naturally disappear from the UI.
*   **Action 1 (Fetch Logic):** Update the `loadCart` API URL to filter by `status=active`.
    *   *Current:* `.../cart-items?where[customer][equals]=${customerId}&depth=3&limit=200`
    *   *New:* `.../cart-items?where[customer][equals]=${customerId}&where[status][equals]=active&depth=3&limit=200`
*   **Action 2 (Manual Removal):** Update the `removeFromCart` function. Instead of sending a `DELETE` request, it should send a `PATCH` request to soft-delete the item.
    *   *Payload:* `{ status: 'removed', deleted_at: new Date().toISOString() }`

## 3. Mobile App: Link Cart Items to Order at Checkout

**File:** `apps/mobile-customer/src/screens/CheckoutScreen.tsx`

*   **Objective:** The webhook needs to know *which* cart items belong to the order being paid for. We establish this link during the checkout process.
*   **Action:** In the `handlePay` function, immediately after the pending `Order` is created (Step 3), we iterate over the cart items.
*   **Logic:** Along with creating `order-items` (Step 5), add a `PATCH` request to update each `cart-item` with the new `order_id`.
    ```typescript
    await fetch(`${apiConfig.baseUrl}/cart-items/${item.id}`, {
        method: 'PATCH',
        headers: cmsHeaders,
        body: JSON.stringify({
            order_id: createdOrderId
        }),
    });
    ```
*   **Cleanup:** Remove the client-side `clearMerchantCart(String(merchantId))` call that runs on successful payment. Instead, just call `reload()` from `useCart()` (or let the subsequent navigation trigger a re-fetch), which will fetch only `active` items, effectively showing an empty cart because the webhook already updated their status to `ordered`.

## Summary of Data Flow

1.  **User Adds Item:** Cart item is created with `status: 'active'`.
2.  **User Clicks Pay:** Order is created. Frontend `PATCH`es the cart items to set `order_id = <new_order_id>`. Cart items remain `status: 'active'` while payment is pending.
3.  **Payment Succeeds:** PayMongo triggers the webhook.
4.  **Webhook Processes:** Webhook updates the Order to `accepted`, then finds `cart-items` by `order_id` and `PATCH`es them to `status: 'ordered'` and sets `ordered_at`.
5.  **User Returns to App:** Cart context reloads, queries only `status=active`, and the paid items are gone. Database retains full history.