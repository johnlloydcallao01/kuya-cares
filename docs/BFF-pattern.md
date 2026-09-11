# Fetching Solution Guide
 
## Summary

The fix applied in this repository uses a **backend-mediated aggregation pattern**.

Instead of letting the frontend fetch several raw backend collections/resources directly and then stitch everything together in the browser, we move that logic into a dedicated backend endpoint inside `apps/cms` (or your equivalent backend/API app), then let `apps/web` (or your equivalent frontend app) consume that single endpoint.

This pattern applies to any user-scoped feature that depends on multiple related resources — not just one domain. Examples across different app types:

- **LMS**: `/announcements`, `/portal/ask-instructor`, `/portal/discussion-board`
- **Food delivery**: `/orders/active`, `/restaurant/menu-with-availability`, `/support/chat`
- **E-commerce**: `/cart/summary`, `/account/order-history`, `/product/recommendations`
- **Any app**: any page that needs to resolve "who is this user" and then join several related entities before rendering

---

## What This Pattern Is Called

You can think of it as:

- **Backend-mediated fetching**
- **Server-side aggregation**
- **BFF-style fetching** (Backend For Frontend)
- **Domain aggregation endpoint pattern**

In this codebase, the most practical name is:

**Backend aggregation endpoint**

Because the solution is:

1. create a dedicated endpoint in `apps/cms/src/app/api/<domain>/...`
2. let that endpoint resolve the user's context and relationships safely
3. let `apps/web` fetch only that prepared result

---

## Why The Old Approach Was Fragile

The previous fetching style had these characteristics:

1. the frontend or server action made multiple separate requests
2. it directly queried collections/resources like `users`, `related-entity`, `records`, or `messages`
3. it depended on the caller using the correct auth header format
4. it depended on collection access rules behaving the same way everywhere
5. it rebuilt relationship logic repeatedly in different places
6. it often depended on client-only state like `localStorage`

That is fragile because even if each individual request is "correct," the chain as a whole can fail for many reasons:

- wrong auth header for a custom route
- collection access restrictions
- missing user/context lookup
- bad relationship filtering
- inconsistent status assumptions
- browser-only auth state not available in the correct render path
- duplicated mapping logic drifting across pages

### Example Of The Fragile Pattern

The old flow often looked like this:

1. get token from `localStorage` or cookies
2. fetch `/users/me`
3. fetch `/<related-record>` (e.g. `trainees`, `customers`, `drivers`)
4. fetch `/<relationship-records>` (e.g. `course-enrollments`, `orders`, `subscriptions`)
5. extract the relevant IDs
6. fetch `/<final-resource>` (e.g. `announcements`, `menu-items`, `chat`)
7. filter/map in the page

This means the page is responsible for both:

- data access
- business logic

That is exactly what makes it easy to break — and it applies equally whether the "page" is a course dashboard, a restaurant menu, or an order tracker.

---

## What The New Pattern Does

The new pattern moves the business logic into a backend endpoint.

### New Flow

1. `apps/web` gets the signed-in user on the server
2. `apps/web` calls one dedicated endpoint such as:
   - `/api/<domain>/<feature>?userId=...`
3. `apps/cms` resolves the user's context internally (e.g. their profile/role record)
4. `apps/cms` loads relationships, related records, and any secondary entities
5. `apps/cms` applies the access strategy internally, including `overrideAccess: true` where appropriate
6. `apps/cms` returns a frontend-ready shape
7. `apps/web` renders that shape with minimal extra logic

So the frontend becomes a consumer, not a data orchestrator — regardless of what the underlying domain is.

---

## Core Principle

### Rule

If a page needs user-scoped data that depends on multiple collections or special access behavior, **do not fetch raw collections directly from the page**.

Instead:

- create one backend endpoint that owns the query logic
- centralize relationship resolution there
- return a clean response shaped for the page

### Why This Is Better

- fewer moving parts in the frontend
- consistent auth behavior
- centralized business logic
- less duplication
- easier debugging
- safer handling of restricted collections
- easier future changes

---

## Architecture Principle

### Fragile Architecture

`apps/web page -> many raw backend collection requests -> page merges data`

Problems:

- duplicated logic
- repeated context/user resolution
- repeated auth/header mistakes
- different pages can behave differently for the same domain data

### Stable Architecture

`apps/web page -> one aggregation endpoint -> backend aggregates domain data`

Benefits:

- one source of truth
- backend controls domain rules
- page gets ready-to-render data
- easier to test and maintain

---

## Generic Examples Of This Pattern

### 1. A "Feed" Or "Summary" Page

Applies to: announcements, order updates, notifications, activity feeds — any app.

#### Old style

`apps/web` tried to:

- resolve the user
- resolve their related profile/role record
- fetch relationships (enrollments, orders, subscriptions, memberships)
- derive relevant IDs
- fetch the feed collection directly

Why that broke:

- direct collection access path was weaker than the backend's already-working aggregation path
- relationship filtering and access behavior could diverge between pages
- the standalone page wasn't using the same source of truth as a working backend summary elsewhere

#### New style

A dedicated endpoint was added:

- `apps/cms/src/app/api/<domain>/<feed-name>/route.ts`

Now:

- CMS resolves the user's context from `userId`
- CMS loads relationships with backend access
- CMS fetches the feed with backend aggregation logic
- `apps/web` only calls that endpoint

### 2. A "Contact / Chat / Ask Someone" Feature

Applies to: ask-an-instructor, contact-a-driver, chat-with-support — any messaging feature tied to a relationship.

#### Old style

The page directly used:

- `localStorage`
- client-side calls to `/api/chat`
- separate client logic for building the list of contacts and messages

Why that broke:

- client-only auth path is fragile
- custom chat endpoints are sensitive to auth header format
- the contact list and message/question list were assembled in separate, inconsistent ways

#### New style

A dedicated endpoint was added:

- `apps/cms/src/app/api/<domain>/<contact-feature>/route.ts`

Now the endpoint returns:

- the relevant list of contacts (instructors, drivers, agents, support reps)
- message/question summaries
- single-thread detail when needed

And `apps/web` now reads through server actions instead of direct client orchestration.

### 3. Any Custom Real-Time Or Messaging Route

This is slightly different — it's not about aggregation, but about **custom route auth mismatch**.

Custom routes like `/api/chat` often expect a different auth header path (e.g. a standard `JWT` header) than what the page logic assumes (e.g. a collection-style auth format).

So the principle here is related but distinct:

- custom domain routes should be treated as backend APIs with their own contract
- do not assume raw collection auth format works everywhere

---

## Design Rules To Follow Going Forward

When adding or fixing data fetching in this repo, use these rules — they apply to any feature, in any domain.

### Use A Dedicated Aggregation Endpoint When

Create a backend endpoint if the page needs any of the following:

- context resolution from `userId` (looking up the user's role-specific record)
- multiple collections joined together
- filtering by a relationship (enrollment, order, subscription, membership, assignment, etc.)
- special access handling
- domain-level mapping or normalization
- reusable data for more than one page

### Keep The Frontend Thin

The page or server action should mostly do only this:

1. get the signed-in user
2. call one endpoint
3. render the result

Avoid putting domain stitching logic in the page.

### Put Domain Logic In The Backend

The backend endpoint should own:

- user/context lookup
- relationship lookup
- joining related collections
- status normalization
- sorting and filtering
- access-sensitive querying

### Use `overrideAccess: true` Carefully

This should be used in backend endpoints when the endpoint itself is the safe boundary and must read data that the frontend should not query directly via raw collection access.

Important:

- use it in backend code, not in the browser
- use it only where the endpoint is intentionally acting as the controlled access layer

### Treat Custom Routes As Contracts

For routes like `/api/chat/...`, do not guess the auth behavior.

Always confirm:

- expected auth header format
- expected request body shape
- response shape

Do not assume collection REST behavior and custom route behavior are identical.

---

## Recommended Fetching Template

### In `apps/cms` (or your backend/API app)

Create a route like:

```ts
// apps/cms/src/app/api/<domain>/<feature>/route.ts
export async function GET(request: NextRequest) {
  const payload = await getPayload({ config: configPromise })
  const { searchParams } = new URL(request.url)
  const userId = searchParams.get('userId')

  // 1. Resolve the user's context (profile, role record, etc.)
  // 2. Load related domain data (relationships, joins, secondary entities)
  // 3. Apply backend access strategy
  // 4. Return page-shaped JSON
}
```

### In `apps/web` (or your frontend app)

Use a server action or server component:

```ts
const user = await getServerUser()

if (!user) return []

const res = await fetch(`${API_BASE_URL}/<domain>/<feature>?userId=${user.id}`, {
  cache: 'no-store',
})

const data = await res.json()
return data
```

### In The Page

The page should only:

- call the server action
- manage UI state
- render the returned data

---

## Anti-Patterns To Avoid

Avoid this in pages and client components, regardless of domain:

- reading auth state from `localStorage` to build critical data queries
- chaining many collection fetches directly from the page
- duplicating context/user resolution logic in multiple features
- mixing raw collection access and custom route access for the same feature
- assuming different auth header formats (e.g. `users JWT` vs `JWT`) are interchangeable everywhere
- filtering business-critical data only in the page when the backend should own that rule

---

## Debugging Checklist

If a page suddenly becomes blank again, check in this order:

1. Is the page using a dedicated aggregation endpoint, or is it stitching raw collections itself?
2. Is the endpoint resolving user context from `userId` correctly?
3. Is the backend query using the correct access strategy?
4. Is the page calling a custom route with the correct auth header format?
5. Is the response shape stable and already mapped for the UI?
6. Is the page depending on browser-only auth state that may be unavailable?

---

## Short Version

The fix is basically:

**Move complex user-scoped fetching out of the frontend and into a dedicated backend aggregation endpoint, then let the frontend consume one prepared response.**

That is more stable than:

**Frontend -> many direct collection fetches -> manual stitching -> fragile auth and access behavior**

This holds regardless of whether the "domain" is courses and trainees, orders and restaurants, or any other set of related resources.

---

## Recommended Standard For Any App In This Repo

For user-facing features in this repository, prefer this standard:

1. `apps/cms/src/app/api/<domain>/...` owns the domain query
2. `apps/web` server actions call that endpoint
3. pages render the returned data
4. custom real-time/chat routes use their documented auth contract
5. raw collection fetching from pages should be avoided when the feature depends on multiple related entities or restricted access

This is the general principle behind the fixes that were applied — apply it the same way whether you're building an LMS, a food delivery app, an e-commerce storefront, or anything else that follows this "user + related entities" shape.