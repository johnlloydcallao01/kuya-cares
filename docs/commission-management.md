# Commission management

## Calculation and rule matching

Commission applies to the product subtotal after all product discounts, including vendor-funded and platform-funded discounts. Delivery charges, delivery discounts, and other non-product charges are excluded from the commission base. Vendor payout calculations separately account for vendor-funded discounts.

The fixed transaction fee is charged once per paid order. Refund reversals are recorded as separate ledger entries and prorated cumulatively; they cannot reverse more than the original accrual.

An enabled rule must also be within its effective date window. When both dates are set, the end must be later than the start. The matching rule is resolved by:

1. Highest priority.
2. Most specific scope: vendor, merchant category, membership plan, then global.
3. Latest effective start date.
4. Lowest stable rule ID.

Overlapping rules are allowed and resolved by this deterministic order. Existing paid orders retain their commission snapshots when rules change.

## Ledger and manual adjustments

Commission entries are immutable. Accruals, refund reversals, and administrator-posted adjustments are stored as distinct entry types. Rule changes and vendor commission overrides are recorded in the commission audit history with the acting administrator and before/after values.

Manual adjustments require an administrator, a vendor, a non-zero financial change, and a reason. The commission and fixed-fee amounts affect platform income; the vendor balance amount affects the payable balance:

- Positive commission or fee amount: increases platform income.
- Negative commission or fee amount: decreases platform income.
- Positive vendor balance amount: increases the amount payable to the vendor.
- Negative vendor balance amount: decreases the amount payable to the vendor.

All amounts are PHP and must have no more than two decimal places. Adjustments are included in vendor payout summaries, daily payout totals, and exports. Use the admin UI rather than editing ledger records directly.

## Schema rollout

Adjustment support adds a ledger entry type, nullable order and transaction relationships for standalone entries, and reason/administrator fields. Review and apply the registered Payload migration using the CMS database migration guide before enabling manual adjustments in an environment.
