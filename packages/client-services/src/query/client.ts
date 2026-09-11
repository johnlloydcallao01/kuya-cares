import { QueryClient } from '@tanstack/react-query';

/**
 * Shared QueryClient defaults for all Tap2Go apps.
 * 3-min instant-back philosophy: cached data renders instantly on back-nav,
 * background refetch only when stale.
 */
export const SHARED_QUERY_DEFAULTS = {
  staleTime: 3 * 60 * 1000, // 3 minutes fresh
  gcTime: 10 * 60 * 1000, // 10 minutes in garbage collector
  retry: 1,
  refetchOnWindowFocus: false, // reduce server stress (explicit refresh instead)
  refetchOnReconnect: true,
} as const;

let browserQueryClient: QueryClient | undefined;

/**
 * Factory — must create a new client per SSR request.
 * Browser reuses a singleton via getQueryClient().
 */
export function makeQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: SHARED_QUERY_DEFAULTS.staleTime,
        gcTime: SHARED_QUERY_DEFAULTS.gcTime,
        retry: SHARED_QUERY_DEFAULTS.retry,
        refetchOnWindowFocus: SHARED_QUERY_DEFAULTS.refetchOnWindowFocus,
        refetchOnReconnect: SHARED_QUERY_DEFAULTS.refetchOnReconnect,
      },
    },
  });
}

/**
 * Per-app singleton on the client, fresh instance on the server.
 * Import this in providers — never import a shared `queryClient` instance.
 */
export function getQueryClient(): QueryClient {
  if (typeof window === 'undefined') {
    return makeQueryClient();
  }
  if (!browserQueryClient) {
    browserQueryClient = makeQueryClient();
  }
  return browserQueryClient;
}
