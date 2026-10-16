# Vendor withdrawal requests

Vendor withdrawals are request and review records only. The application does not connect to a bank, e-wallet, or transfer provider. An authorized administrator must complete payment outside the system and then mark the request as paid with its payment reference.

## Balance calculation

Balances are calculated in PHP from the existing commission and payout records:

- **Lifetime payable** is the sum of non-negative `orders.commission_vendor_net` values for orders belonging to the vendor that have a `paid` or `partially_refunded` transaction, plus all PHP `adjustment` entries in `vendor_commission_entries`.
- **Reserved** is the sum of requests in `pending` and `approved` states.
- **Paid** is the sum of requests in `paid` state.
- **Available** is `max(0, lifetime payable - reserved - paid)`.

Rejected and cancelled requests are not reserved, so their amount becomes available again. On creation, the CMS locks the vendor row, recalculates the balance in the same database transaction, and inserts the reservation only if the amount does not exceed available balance. A per-vendor idempotency key prevents retrying the same submission from reserving funds twice.

## Review lifecycle

`pending` requests may be approved, rejected, or cancelled. `approved` requests may be marked paid or cancelled. `paid`, `rejected`, and `cancelled` are terminal. Rejections and cancellations require a reason; marking paid requires a manual payment reference. The request retains the submitting user and timestamp, decision user and timestamp, payment user and timestamp, cancellation user and timestamp, and appended reviewer notes.

The vendor API accepts only active vendor records owned by the authenticated vendor/member account. Admin queue and state-change endpoints independently verify the authenticated admin. Payload collection reads and writes are disabled for direct requests; API routes enforce authorization and use transactional updates. State changes lock the request row so concurrent actions cannot mark one request paid more than once.

## Migration

The collection is created by `apps/cms/src/migrations/20261016_120000_vendor_withdrawal_requests.ts`. The migration registry entry is in `apps/cms/src/migrations/index.ts` (import around line 91; migration registration around line 545).
