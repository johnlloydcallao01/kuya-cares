# Ordering System Schemas

This document defines the schema architecture for the Ordering System. It is designed to work with the existing `apps/cms` collections (`Customers`, `Merchants`, `Products`, `Addresses`, `Drivers`) and ensures data integrity through snapshotting.

## 1. Orders
**Purpose:** The central entity for all transactions.
**Collection Slug:** `orders`

| Field Name | Type | Relationship | Notes |
| :--- | :--- | :--- | :--- |
| `customer` | Relationship | `customers` | The customer placing the order. |
| `merchant` | Relationship | `merchants` | The merchant fulfilling the order. |
| `status` | Select | - | Options: `pending`, `accepted`, `preparing`, `ready_for_pickup`, `on_delivery`, `delivered`, `cancelled`. |
| `fulfillment_type` | Select | - | Options: `delivery`, `pickup`. Critical for logistics logic. |
| `total` | Number | - | Grand total (Subtotal + Fees - Discounts). |
| `subtotal` | Number | - | Sum of item prices. |
| `delivery_fee` | Number | - | Calculated delivery fee (0 for Pickup). |
| `platform_fee` | Number | - | Service charge/App fee. |
| `notes` | Textarea | - | Special instructions for the merchant. |
| `placed_at` | Date | - | Timestamp when order was confirmed. |

## 2. Order Items
**Purpose:** Links products to an order with **Snapshot Pricing**.
**Collection Slug:** `order-items`

| Field Name | Type | Relationship | Notes |
| :--- | :--- | :--- | :--- |
| `order` | Relationship | `orders` | Parent order. |
| `product` | Relationship | `products` | Reference to the base product (for analytics). |
| `merchant_product` | Relationship | `merchant-products` | Reference to the specific merchant listing. |
| `product_name_snapshot` | Text | - | **SNAPSHOT**: Name of product at time of purchase (prevents renaming issues). |
| `price_at_purchase` | Number | - | **SNAPSHOT**: The price/unit paid (overrides current catalog price). |
| `quantity` | Number | - | Count of items. |
| `options_snapshot` | JSON | - | **SNAPSHOT**: Selected modifiers (e.g., `{ "Size": "Large", "Add-on": "Cheese" }`) and their specific prices. |
| `total_price` | Number | - | `price_at_purchase * quantity` + modifiers. |

## 3. Delivery Locations
**Purpose:** Immutable snapshot of where the order must go.
**Collection Slug:** `delivery-locations`
**Source:** Derived from `Customers.activeAddress` -> `Addresses`.

| Field Name | Type | Relationship | Notes |
| :--- | :--- | :--- | :--- |
| `order` | Relationship | `orders` | One-to-one relationship. |
| `formatted_address` | Textarea | - | **SNAPSHOT**: Full text address from Google Maps at time of order. |
| `coordinates` | JSON/Point | - | **SNAPSHOT**: Lat/Lng for driver navigation. |
| `notes` | Text | - | Delivery instructions (e.g., "Gate code 1234"). |
| `contact_name` | Text | - | Receiver's name. |
| `contact_phone` | Text | - | Receiver's phone. |
| `label` | Select | - | e.g., Home, Office. |

## 4. Transactions (Payments)
**Purpose:** Records the financial exchange.
**Collection Slug:** `transactions`

| Field Name | Type | Relationship | Notes |
| :--- | :--- | :--- | :--- |
| `order` | Relationship | `orders` | Link to order. |
| `payment_intent_id` | Text | - | External ID (e.g., PayMongo `pi_...`). |
| `payment_method` | Text | - | e.g., `card`, `gcash`, `grab_pay`. |
| `amount` | Number | - | Amount charged. |
| `currency` | Text | - | Default `PHP`. |
| `status` | Select | - | `pending`, `paid`, `failed`, `refunded`. |
| `paid_at` | Date | - | Timestamp of successful payment. |

## 5. Order Tracking (History)
**Purpose:** Audit trail for status changes.
**Collection Slug:** `order-tracking`

| Field Name | Type | Relationship | Notes |
| :--- | :--- | :--- | :--- |
| `order` | Relationship | `orders` | Link to order. |
| `status` | Select | - | The status moved TO (e.g., `preparing`). |
| `timestamp` | Date | - | When the change happened. |
| `actor` | Relationship | `users` | Who triggered it? (Driver, Merchant Staff, System). |
| `description` | Text | - | e.g., "Kitchen marked order as ready". |

## 6. Driver Assignments
**Purpose:** Manages the logistics of "Who is bringing this?".
**Collection Slug:** `driver-assignments`

| Field Name | Type | Relationship | Notes |
| :--- | :--- | :--- | :--- |
| `order` | Relationship | `orders` | Link to order. |
| `driver` | Relationship | `drivers` | The assigned driver. |
| `status` | Select | - | `offered`, `accepted`, `rejected`, `completed`. |
| `assigned_at` | Date | - | When the driver was pinged. |
| `accepted_at` | Date | - | When the driver said "Yes". |
| `completed_at` | Date | - | When delivery finished. |

## 7. Discounts / Vouchers (Usage)
**Purpose:** Records which promo was used.
**Collection Slug:** `order-discounts`

| Field Name | Type | Relationship | Notes |
| :--- | :--- | :--- | :--- |
| `order` | Relationship | `orders` | Link to order. |
| `code` | Text | - | The code used (e.g., `WELCOME100`). |
| `amount_off` | Number | - | Total value deducted. |
| `type` | Select | - | `percentage`, `fixed`. |
| `source_voucher` | Relationship | `vouchers` | (Future) Link to master voucher table. |

## 8. Reviews
**Purpose:** Post-order feedback.
**Collection Slug:** `reviews`

| Field Name | Type | Relationship | Notes |
| :--- | :--- | :--- | :--- |
| `order` | Relationship | `orders` | Verified purchase link. |
| `customer` | Relationship | `customers` | Reviewer. |
| `merchant` | Relationship | `merchants` | Reviewed entity. |
| `driver` | Relationship | `drivers` | Reviewed entity (optional). |
| `merchant_rating` | Number | - | 1-5 stars. |
| `driver_rating` | Number | - | 1-5 stars. |
| `comment` | Textarea | - | User feedback. |
| `is_public` | Checkbox | - | Moderation flag. |
