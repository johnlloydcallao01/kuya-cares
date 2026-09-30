'use client';

import type { ReactNode } from 'react';
import { AuthProvider } from '@/contexts/AuthContext';
import { CartProvider } from '@/contexts/CartContext';
import { NotificationsProvider } from '@/contexts/NotificationsContext';
import { AuthErrorBoundary } from '@/components/auth';
import { LoadingScreenWrapper } from '@/components/loading/LoadingScreenWrapper';
import { ToasterProvider } from '@/components/toast/ToasterProvider';

interface ProvidersProps {
  children: ReactNode;
  initialUser: Parameters<typeof AuthProvider>[0]['initialUser'];
  initialToken: Parameters<typeof AuthProvider>[0]['initialToken'];
}

export function Providers({ children, initialUser, initialToken }: ProvidersProps) {
  return (
    <AuthErrorBoundary>
      <AuthProvider initialUser={initialUser} initialToken={initialToken}>
        <CartProvider>
          <NotificationsProvider>
            <LoadingScreenWrapper>{children}</LoadingScreenWrapper>
          </NotificationsProvider>
        </CartProvider>
      </AuthProvider>
      <ToasterProvider />
    </AuthErrorBoundary>
  );
}