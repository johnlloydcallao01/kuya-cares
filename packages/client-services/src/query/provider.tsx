'use client';

import { useState, type ReactNode } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { getQueryClient } from './client';

interface AppQueryProviderProps {
  children: ReactNode;
}

/**
 * Shared TanStack provider for all Tap2Go Next.js / RN apps.
 * Uses useState singleton so back-nav within the SPA reuses the same cache
 * (3-min staleTime from makeQueryClient), while SSR gets a fresh client.
 */
export function AppQueryProvider({ children }: AppQueryProviderProps) {
  const [queryClient] = useState(() => getQueryClient());

  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
