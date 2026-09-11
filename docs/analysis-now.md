# Research: Notifications Database Design for apps/cms

## 1. Goals and Requirements

For apps/cms we want a notification model that:
- Supports multiple notification domains: orders, account, system updates, marketing/announcements, and custom/anonymous messages.
- Handles both **automatic** (system-generated) and **manual** (admin-authored) notifications.
- Scales to millions of rows while staying simple to query from the CMS and client apps.
- Fits our existing enterprise database guidelines (three-layer architecture: base, specific, association tables).
- Keeps the door open for multi-channel delivery (in-app, email, push, SMS) and user preferences later.

Key business use‑cases:
- Order events: “Order delivered”, “Order cancelled”, “Rider is nearby”.
- Account events: “Password changed”, “New device login”.
- System / platform events: “Scheduled maintenance”, “New feature rollout”.
- Admin broadcast: “Promo in Manila this weekend”, “Policy changes”, etc.
- Potential future: per-tenant or per-role targeting (drivers, merchants, customers, admins).

These requirements are very close to what large SaaS and consumer apps implement for notifications.

## 2. Industry and Reference Designs (External Research)

### 2.1 Notification event + per-recipient copy

MagicBell’s “Building a Notification System in Ruby on Rails: DB Design” describes a core pattern built around:
- A **Notification** entity that represents one logical notification (title, text, URL, etc.).
- A **NotificationRecipientCopy** table that stores a copy of that notification per recipient, with per-user state like `seen_at` and `read_at`.[^1]

This aligns with a common enterprise approach:
- Store the *definition* of the message once.
- Store a per-user record that tracks delivery and read state.

### 2.2 Actor / notifier / entity model

Another detailed design from Tan Nguyen breaks notifications down into four key concepts: **Actor**, **Notifier**, **Entity**, and **EntityType**, and backs this with three tables: `notification_object`, `notification`, and `notification_change`.[^2]

Important ideas for us:
- Separate the “thing that happened” (notification object/event) from:
  - Who triggered it (actor).
  - Who receives it (notifier/recipient).
  - What domain object it is about (entity + entity type: order, post, group, etc.).
- This naturally supports adding new entities and notification types without schema changes (new `entity_type` and `event_type` values rather than new columns).

### 2.3 Template + notification tables

Tutorials24x7’s “Guide To Design Database For Notifications In MySQL” proposes:
- A **notification_template** table (title, description, type, source_type, content).
- A **notification** table with: `user_id`, `source_id`, `source_type`, `type`, `read`, `trash`, timestamps, etc.[^3]

Key takeaways:
- Templates should carry stable metadata like `type` and `source_type` so that concrete notifications inherit consistent classification.
- Concrete notification rows should be lightweight and focused on per-recipient state and linking back to templates and source entities.

### 2.4 System-level lessons

System design resources (e.g. Grokking System Design’s “Designing a Notification System”) treat notifications as a **shared service** used by many internal products.[^4] Common points:
- A central notification service with its own schema.
- Ability to send notifications to **one user**, **many users**, or **segments**.
- Multi-channel delivery with user-level preferences.

These patterns confirm that:
- Separating events, templates, and per-recipient copies is standard.
- Supporting manual (“send announcement to all drivers”) and automatic (“order shipped”) notifications in the same system is normal in large platforms.

## 3. Internal Context: apps/cms Existing Patterns

### 3.1 user_events table

In apps/cms we already have a `user_events` table in the Postgres schema:
- Fields include: `user_id`, `event_type` (enum), `event_data` (JSONB), `triggered_by_id`, `timestamp`, `ip_address`, `user_agent`, and audit timestamps.
- Indexed on `user`, `triggeredBy`, `updatedAt`, `createdAt`.

This table is essentially an **audit/activity log**:
- Records “something happened for a user” with structured `event_type` and flexible `event_data`.
- Tracks who triggered it (`triggeredBy`), and when (`timestamp`/`createdAt`).

Implications for notifications:
- Conceptually, many notifications are *derived from* user events (“order status changed”, “password updated”).
- However, user_events store **activity**, not per-recipient notification state (read/unread, dismissed), and they don’t support arbitrary admin-authored announcements.
- Reusing user_events directly as “notifications” would violate our own database guidelines by mixing concerns (activity log vs user-facing notification UX).

### 3.2 Enterprise database guidelines

apps/cms docs (enterprise-database-architecture.md, business-database-design.md) push a clear architecture:
- **Base tables** for shared, universal concepts.
- **Specific tables** for specialized information per type.
- **Association tables** for many-to-many relationships and optional attributes.

Applied to notifications, this suggests:
- A **base “notification event” table** for any logical notification-worthy event.
- A **specific “user notification” table** that represents a copy of that event for a particular user with UI state (read/dismissed/pinned, etc.).
- Optional **association tables** for channels, templates, and targeting segments.

This is also consistent with the external designs above.

## 4. Proposed Notification Data Model for apps/cms

### 4.1 High-level structure

Core tables:
1. **notification_events** – one row per logical event (e.g. “Order #123 delivered”, “Global maintenance notice”).
2. **user_notifications** – one row per user per event (delivery and read status).
3. **notification_templates** – reusable templates (for automatic system/flow-based notifications and also for predefined admin broadcast types).

Optional extensions (future-friendly):
4. **notification_audiences** – how we represent “who should receive this event” at a business level (segments, roles, filters).
5. **user_notification_preferences** – per-user preferences per type/channel.

This structure gives us:
- Support for multiple notification types and domains.
- A clean distinction between **automatic** and **manual** origins.
- A single source of truth for each logical event plus scalable per-recipient rows.

### 4.2 notification_events (base logical events)

Purpose:
- Represent any notification-worthy event in the system, regardless of how many users receive it.
- Capture classification (domain, type, severity) and linkage to a source entity (e.g. order).

Key fields (conceptual, not exact SQL):
- `id` – PK.
- `type_key` – stable string key; e.g. `order.delivered`, `account.password_changed`, `system.maintenance`, `marketing.promo`.
- `domain` – enum/text: `order`, `account`, `system`, `marketing`, `custom`.
- `source_entity_type` – e.g. `orders`, `users`, `system`, `none` for anonymous.
- `source_entity_id` – FK or generic UUID/ID to link to the underlying record.
- `template_id` – FK to `notification_templates` (nullable for custom/anonymous messages).
- `origin` – enum: `automatic`, `manual`.
- `triggered_by_user_id` – FK to `users.id` (nullable, especially for automatic/system events).
- `title` – resolved title at time of creation (even if a template exists we may want to snapshot).
- `body` – resolved body; may be rendered from template + variables.
- `metadata` – JSONB with extra payload (e.g. order amount, deep-link params, AB test tags).
- `priority` – smallint/enum if we want `info`, `warning`, `critical`.
- `scheduled_at` – for delayed send.
- `created_at`, `updated_at`.

Behavior:
- Automatic flows (e.g. order status change) create one `notification_events` row with `origin = automatic`.
- Admin broadcast in CMS:
  - Admin chooses a template or writes a custom message.
  - System creates one `notification_events` row with `origin = manual`, `triggered_by_user_id = admin_id`, and possibly a `notification_audiences` record.
- For small audiences we might write `user_notifications` rows synchronously; for large broadcasts we queue a background job that fans out `user_notifications`.

### 4.3 user_notifications (per-recipient copies)

Purpose:
- Track that a given user should see a particular event, and record per-user state required by the app UI.

Key fields:
- `id` – PK.
- `user_id` – FK to `users.id`.
- `notification_event_id` – FK to `notification_events.id`.
- `channel` – enum: `in_app`, `email`, `push`, `sms`, etc. (or nullable if this row is channel-agnostic and channels are tracked elsewhere).
- `status` – enum: `unread`, `read`, `dismissed`, `hidden`, etc.
- `delivered_at` – when we believe it reached the client or channel.
- `read_at` – when user opened it.
- `archived_at` – when moved out of inbox.
- `is_pinned` – bool.
- `created_at`, `updated_at`.

Indexes:
- `(user_id, status, created_at DESC)` for fast “inbox” and “unread count” queries.
- `(notification_event_id)` for fan-out / debugging.

How this satisfies requirements:
- Multiple notification types:
  - Determined via the linked `notification_events.type_key` and `domain`, not columns on `user_notifications`.
  - Adding new types is just adding new `type_key` and possibly new templates.
- Manual vs automatic:
  - Both create `notification_events` rows; differentiation is via `origin`.
  - Fan-out to `user_notifications` is the same regardless of origin.
- Anonymous/custom notifications:
  - `notification_events` with `source_entity_type = 'none'` and no `source_entity_id`.
  - Admin can write arbitrary `title`/`body`, still emitting user_notifications for their chosen audience.

### 4.4 notification_templates (reusable definitions)

Purpose:
- Provide reusable templates for automatic flows (order events, account events, system events) and also for reusable admin broadcast types.

Key fields:
- `id` – PK.
- `type_key` – same key used in `notification_events.type_key` (e.g. `order.delivered`).
- `domain` – `order`, `account`, `system`, `marketing`, etc.
- `title_template` – templated string (e.g. “Your order {{order_number}} was delivered”).
- `body_template` – templated text or JSON structure for rich notifications.
- `default_channel_set` – JSONB or enum array: default channels for this template.
- `severity` – enum: `info`, `warning`, `critical`.
- `is_active` – bool.
- `created_at`, `updated_at`, `created_by`, `updated_by`.

Benefits:
- Adding a new notification type usually means:
  - Add a new template row.
  - Emit `notification_events` with that `type_key`.
- For manual admin campaigns:
  - We can have “pre-approved” templates (e.g. maintenance notices) that admins parametrize.

### 4.5 notification_audiences (targeting)

This is optional at the database level but becomes important as we scale manual broadcasts.

Possible fields:
- `id` – PK.
- `notification_event_id` – FK to `notification_events.id`.
- `audience_type` – enum: `all_users`, `role`, `segment`, `user_list`.
- `role` – nullable; e.g. `driver`, `merchant`, `customer`.
- `segment_expression` – JSON or text representing filters (region, city, activity level).
- `user_ids` – nullable JSON array for explicit lists (small campaigns).

In practice:
- For small audiences, we may not need to persist this. The app logic can just create user_notifications directly.
- For large campaigns and auditing (“who was supposed to get this?”), persisting the audience definition is very useful.

### 4.6 user_notification_preferences (future extension)

While not required immediately, industry systems almost always support per-user preferences.

Example structure:
- `id` – PK.
- `user_id` – FK.
- `type_key` – which notification type the preference applies to (e.g. `order.delivered`, `system.maintenance`, `marketing.*`).
- `channel` – enum.
- `is_enabled` – bool.
- `created_at`, `updated_at`.

Logic:
- When fanning out `user_notifications`, we check effective preferences (global + per-user) to decide whether to create a row per channel.

## 5. Mapping Requirements to the Design

### 5.1 Multiple notification types (orders, account, system updates, custom)

How supported:
- `notification_events.domain` and `type_key` classify each notification.
- No schema change is required to add a new type:
  - Register a new `type_key` and template.
  - Emit events using that key.
- Orders:
  - `domain = 'order'`, `source_entity_type = 'orders'`, `source_entity_id = order.id`.
- Account:
  - `domain = 'account'`, `source_entity_type = 'users'`.
- System updates:
  - `domain = 'system'` or `marketing`, `source_entity_type = 'system'` or `none`.
- Custom/anonymous:
  - `domain = 'custom'`, `source_entity_type = 'none'`, no source ID needed.

This aligns with external practice where “notification types” are driven by identifiers (strings/enums) rather than adding database columns per type.[^1][^2][^3]

### 5.2 Manual and automatic notifications

Automatic notifications:
- Triggered by application events (order created, status changed, account security event, etc.).
- Implementation pattern:
  - Business logic (e.g. order service) calls a notification service.
  - The service creates a `notification_events` row with `origin = 'automatic'`, referencing the relevant template and source entity.
  - The service fans out `user_notifications` rows to the relevant recipients (usually one user for this type).

Manual notifications:
- Admin uses CMS to create an announcement or campaign.
- Implementation pattern:
  - Admin selects template or writes custom message.
  - Admin selects audience (all customers, all drivers in city X, specific merchants, etc.).
  - CMS creates a single `notification_events` row with `origin = 'manual'`, `triggered_by_user_id = admin_user.id`, and optionally a `notification_audiences` record.
  - Background job resolves the audience into concrete user IDs and inserts `user_notifications` rows in batches.

Is this a common pattern?
- Yes. Large platforms typically use the same notification infrastructure for:
  - System-generated events (e.g. “your order shipped”).
  - Staff/admin-originated messages (e.g. “new policy updates”, “planned downtime”).
- Examples:
  - Productivity tools and collaboration platforms send admin-created workspace announcements through the same notification system used for comment mentions and task updates.
  - E-commerce platforms use the same pipeline for transactional events and campaign notifications, with different templates and targeting rules.
  - MagicBell’s design explicitly supports sending one notification to many recipients, both for product events and campaign-style messages.[^1]
- Using **one unified schema** with an `origin` field and templates is standard practice in enterprise apps because it:
  - Simplifies analytics (one place to see “all notifications sent”).
  - Avoids duplicate systems (one for system events, one for announcements).
  - Leverages the same user_preferences and delivery pipeline.

## 6. How This Fits apps/cms and Next Steps

### 6.1 Consistency with existing patterns

This design:
- Mirrors `user_events` by treating `notification_events` as an event log, but focused on user-facing messaging instead of raw activity.
- Respects our three-layer architecture:
  - Base: `notification_events` and `notification_templates`.
  - Specific: `user_notifications` (per-recipient state).
  - Association: `notification_audiences`, `user_notification_preferences`.
- Keeps schemas normalized:
  - No duplicated “title/body/type/source” fields in multiple tables.
  - One logical definition per event, many per-user copies.

### 6.2 Single vs Multiple Notification Tables for 4 Apps/Roles

In our platform we effectively have four “apps” or roles:
- Customer
- Admin
- Merchant/Restaurant
- Driver

All of them need notifications. The key architectural question is:
- **Do we create separate tables per app (customer_notifications, merchant_notifications, driver_notifications, admin_notifications)?**
- Or **one shared notifications system** where app/role is just another dimension?

#### 6.2.1 Shared database, shared schema (recommended)

Industry guidance for multi-tenant systems consistently recommends **shared database, shared schema** with tenant or scope columns instead of duplicating tables per tenant/app.[^5][^6]

Applied to notifications, this means:
- One set of core tables:
  - `notification_events`
  - `user_notifications`
  - `notification_templates`
- Per-row scoping via:
  - `user_id` (linked to `users.role` or equivalent).
  - Optional additional scope columns if needed, such as:
    - `recipient_role` enum: `customer`, `merchant`, `driver`, `admin`.
    - `app_id` or `client_type` if apps diverge more in the future.

Querying per app:
- Customer app:
  - `SELECT ... FROM user_notifications WHERE user_id = ? AND channel = 'in_app' ORDER BY created_at DESC LIMIT ...`
  - The user’s role is “customer”, so we don’t even need a separate table.
- Driver app:
  - Same table, but the logged-in user has role “driver”; queries filter by `user_id` and possibly `domain` or `type_key` optimized for driver-related notifications.
- Admin app:
  - Same table; admins will usually query `notification_events` for analytics, and their own `user_notifications` for inbox.

Why this is preferable:
- **Single source of truth**:
  - One notifications system for all roles.
  - Easier to build cross-role analytics (e.g. “how many notifications did we send to drivers vs customers?”).
- **Lower operational cost**:
  - One schema to migrate, index, and monitor.
  - No need to maintain four nearly identical notification schemas.
- **Better evolution**:
  - Adding a new domain or app does not require new tables, only new `type_key` values, templates, and perhaps a new `recipient_role` enum value.
- **Performance and scalability**:
  - With proper indexes on `(user_id, created_at DESC)` and optionally `(recipient_role, created_at DESC)` or `(domain, created_at DESC)`, this design supports very large volumes.
  - If tables grow extremely large, we can **partition** by time or domain while still keeping a unified logical schema.

This is similar to how multi-tenant SaaS products store tenant-scoped data: one shared table with a `tenant_id` or equivalent scope column.[^5][^6]

#### 6.2.2 Per-app tables (when it might be justified)

Having separate tables like `customer_notifications`, `driver_notifications`, etc. can be justified only when:
- The apps are backed by **completely separate services and databases** (not just separate frontends).
- You require **hard isolation** for compliance reasons (each environment must be technically isolated).
- The notification requirements differ so radically that schema sharing would introduce complex conditionals and a lot of nulls.

Drawbacks in our context:
- Duplicated schema and migrations for every notification change.
- Harder to implement unified notification preferences and analytics.
- More boilerplate in application code for creating and querying notifications.

Given our monorepo and shared platform, plus the role-based design already in `users` (with role enums), we **do not** gain meaningful benefits from per-app tables, but we do inherit extra complexity.

#### 6.2.3 Recommended pattern for our four apps

For an enterprise, multi-role food delivery platform like ours, the most scalable pattern is:
- **Single shared notification system**, implemented as:
  - `notification_events` (logical events)
  - `user_notifications` (per-user copies)
  - `notification_templates` (reusable type definitions)
- Scoped by:
  - `user_id` (primary dimension; each app authenticates users and queries by their ID).
  - The existing `users.role` enum (`customer`, `merchant`, `driver`, `admin`) for app-specific behavior.
  - Optional `recipient_role` or `client_type` columns if we want denormalized, query-optimized scoping.

Practically:
- We **do not** create separate `customer_notifications`, `merchant_notifications`, etc.
- We use **one** `user_notifications` table for all roles, with:
  - Proper indexes tuned for per-role query patterns.
  - Optional partitioning and partial indexes if some roles generate much more traffic (e.g. drivers).

This matches both:
- Our internal enterprise database guidelines (base/specific/association, no duplication).
- External SaaS/multi-tenant recommendations that prefer “shared database, shared schema” with tenant/scope keys as long as we don’t have extreme compliance needs.[^5][^6]

### 6.3 Concrete schema sketch (apps/cms flavor)

Because apps/cms uses Postgres with enums and JSONB, a first iteration could look like:

- `notification_events`
  - `id` BIGSERIAL PK
  - `type_key` VARCHAR(100) NOT NULL
  - `domain` notification_domain_enum NOT NULL
  - `source_entity_type` VARCHAR(50) NOT NULL
  - `source_entity_id` INTEGER/UUID NULL
  - `template_id` INTEGER NULL REFERENCES notification_templates(id)
  - `origin` notification_origin_enum NOT NULL DEFAULT 'automatic'
  - `triggered_by_user_id` INTEGER NULL REFERENCES users(id)
  - `title` VARCHAR(255) NOT NULL
  - `body` TEXT NOT NULL
  - `metadata` JSONB NULL
  - `priority` notification_priority_enum NOT NULL DEFAULT 'normal'
  - `scheduled_at` TIMESTAMP WITH TIME ZONE NULL
  - `created_at` TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
  - `updated_at` TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()

- `user_notifications`
  - `id` BIGSERIAL PK
  - `user_id` INTEGER NOT NULL REFERENCES users(id)
  - `notification_event_id` BIGINT NOT NULL REFERENCES notification_events(id)
  - `channel` notification_channel_enum NOT NULL DEFAULT 'in_app'
  - `status` notification_status_enum NOT NULL DEFAULT 'unread'
  - `delivered_at` TIMESTAMPTZ NULL
  - `read_at` TIMESTAMPTZ NULL
  - `archived_at` TIMESTAMPTZ NULL
  - `is_pinned` BOOLEAN NOT NULL DEFAULT false
  - `created_at` TIMESTAMPTZ NOT NULL DEFAULT now()
  - `updated_at` TIMESTAMPTZ NOT NULL DEFAULT now()

- `notification_templates`
  - `id` SERIAL PK
  - `type_key` VARCHAR(100) UNIQUE NOT NULL
  - `domain` notification_domain_enum NOT NULL
  - `title_template` TEXT NOT NULL
  - `body_template` TEXT NOT NULL
  - `default_channel_set` JSONB NULL
  - `severity` notification_severity_enum NOT NULL DEFAULT 'info'
  - `is_active` BOOLEAN NOT NULL DEFAULT true
  - `created_at` TIMESTAMPTZ NOT NULL DEFAULT now()
  - `updated_at` TIMESTAMPTZ NOT NULL DEFAULT now()
  - `created_by` INTEGER REFERENCES users(id)
  - `updated_by` INTEGER REFERENCES users(id)

These are **sketches**, meant to align with our docs and external references, not final migrations. The key idea is the separation of concerns and extensibility.

### 6.4 Summary

- A scalable notification model for apps/cms should:
  - Distinguish between **notification events** and **per-user notification rows**.
  - Use **type keys** and **domains** instead of adding columns for every new notification type.
  - Support both **automatic** and **manual** notifications via an `origin` field and shared pipeline.
  - Use templates to centralize message structure and classification.
- The admin “create a notification in the backend and broadcast it to users” pattern is absolutely standard in modern app development, and it naturally fits into this design by:
  - Creating one `notification_events` row.
  - Fanning out `user_notifications` rows to the appropriate audience.

This gives apps/cms an enterprise-grade foundation for notifications that can grow from simple in-app alerts to a full multi-channel, preference-aware notification service without needing a major redesign.

---

[^1]: MagicBell, “Building a Notification System in Ruby on Rails: DB Design”, https://www.magicbell.com/blog/building-notification-system-ruby-on-rails-database-design
[^2]: Tan Nguyen, “Designing a notification system | Notification database design”, https://tannguyenit95.medium.com/designing-a-notification-system-1da83ca971bc
[^3]: Tutorials24x7, “Guide To Design Database For Notifications In MySQL”, https://mysql.tutorials24x7.com/blog/guide-to-design-database-for-notifications-in-mysql
[^4]: DesignGurus, “Designing a Notification System”, https://www.designgurus.io/course-play/grokking-system-design-interview-ii/doc/designing-a-notification-system
[^5]: Bytebase, “Multi-Tenant Database Architecture Patterns Explained”, https://www.bytebase.com/blog/multi-tenant-database-architecture-patterns-explained
[^6]: Microsoft, “Multitenant SaaS Patterns - Azure SQL Database”, https://learn.microsoft.com/en-us/azure/azure-sql/database/saas-tenancy-app-design-patterns
