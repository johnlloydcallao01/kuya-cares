# Pull-to-Refresh Implementation Guide

Blueprint for adding pull-to-refresh to any screen in `apps/mobile-customer`.

---

## Architecture Overview

We have two patterns depending on data source:

| Data Source | Refresh Method | Used By |
|---|---|---|
| **TanStack Query** | `queryClient.resetQueries()` + `dataCache.clear()` | HomeScreen, MerchantScreen, WishlistScreen, NearbyRestaurantsScreen, NewlyUpdatedScreen, ProductScreen |
| **React Context** (e.g. CartContext) | `reload()` from context | CartScreen, MerchantCartScreen |

Both patterns use `PullToRefreshLayout` as the scroll wrapper and a local `refreshing` state.

---

## Pattern A: TanStack Query Screen (Most Common)

### Step 1 — Imports

```tsx
import { useState, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { dataCache } from '@encreasl/client-services';
import { PullToRefreshLayout } from '../components/PullToRefreshLayout';
```

### Step 2 — Setup State & Refresh Handler

```tsx
const queryClient = useQueryClient();
const [refreshing, setRefreshing] = useState(false);

// Destructure isLoading and isRefetching from your query hooks
const { data, isLoading, isRefetching } = useQuery({ ... });

const handleRefresh = useCallback(async () => {
  setRefreshing(true);
  try {
    dataCache.clear();
    await Promise.all([
      queryClient.resetQueries({ queryKey: ['your-query-key', id] }),
      // Add more query keys as needed
    ]);
  } catch (error) {
    console.error('Pull-to-refresh error:', error);
  } finally {
    setRefreshing(false);
  }
}, [queryClient, id]);

const showSkeleton = isLoading || refreshing || isRefetching;
```

> **Why `resetQueries` instead of `refetch`?**
> `refetch()` serves cached data first — the skeleton never visibly renders.
> `resetQueries()` clears the cache, sets `isLoading = true`, and forces a real network fetch.

### Step 3 — JSX Structure

```tsx
<PullToRefreshLayout
  isRefreshing={refreshing || isRefetching}
  onRefresh={handleRefresh}
  contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
>
  {showSkeleton ? (
    <YourSkeletonComponent />
  ) : data ? (
    <YourActualContent data={data} />
  ) : (
    <YourEmptyState />
  )}
</PullToRefreshLayout>
```

**Key rule:** `PullToRefreshLayout` must wrap **both** skeleton and content — never conditionally render it only around content. Otherwise pull-to-refresh won't work during loading state.

---

## Pattern B: Context-Based Screen (Cart)

For screens where data comes from React Context (e.g. `CartContext`):

```tsx
const { reload, isLoading } = useCart();
const [refreshing, setRefreshing] = useState(false);

const handleRefresh = useCallback(async () => {
  setRefreshing(true);
  try {
    await reload();
  } finally {
    setRefreshing(false);
  }
}, [reload]);

const showSkeleton = isLoading || refreshing;
```

JSX structure is identical to Pattern A.

---

## Skeleton Screen Guidelines

Every screen with pull-to-refresh **must** have a skeleton that mirrors its content layout:

- Use `backgroundColor: '#F3F4F6'` for containers
- Use `backgroundColor: '#E5E7EB'` for placeholder blocks
- Use `borderRadius` matching the real content's rounded corners
- **3 items** is the standard skeleton count

Example:

```tsx
const Skeleton = () => (
  <View style={{ padding: 16 }}>
    {[1, 2, 3].map(key => (
      <View key={key} style={{ marginBottom: 16, borderRadius: 16, backgroundColor: '#F3F4F6', padding: 16 }}>
        <View style={{ width: '100%', height: 140, borderRadius: 12, backgroundColor: '#E5E7EB', marginBottom: 12 }} />
        <View style={{ width: '60%', height: 16, borderRadius: 8, backgroundColor: '#E5E7EB', marginBottom: 8 }} />
        <View style={{ width: '40%', height: 16, borderRadius: 8, backgroundColor: '#E5E7EB' }} />
      </View>
    ))}
  </View>
);
```

---

## Checklist for New Screens

- [ ] Import `PullToRefreshLayout`, `useQueryClient`, `dataCache`
- [ ] Add `[refreshing, setRefreshing]` state
- [ ] Write `handleRefresh` with `resetQueries` for each query key used
- [ ] Derive `showSkeleton = isLoading || refreshing || isRefetching`
- [ ] Wrap content in `PullToRefreshLayout` (around both skeleton and content)
- [ ] Create a skeleton component that mirrors the screen layout
- [ ] Remove `refetch` from query destructuring (not needed with `resetQueries`)

---

## Screens That Don't Need Pull-to-Refresh

- **Auth screens** (LoginScreen, SignupScreen, ForgotPasswordScreen) — forms, not data lists
- **AccountScreen** — profile/settings form
- **SearchScreen** — user-driven, not a data listing
