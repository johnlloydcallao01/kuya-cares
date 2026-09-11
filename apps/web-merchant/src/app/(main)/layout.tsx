'use client';

import * as React from 'react';
import { Suspense } from 'react';
import { AdminDashboard } from '@/components/AdminDashboard';
import { ProtectedRoute } from '@/components/auth';
import { usePathname } from 'next/navigation';
import { NotificationsProvider } from '@/contexts/NotificationsContext';
import { useAuth } from '@/hooks/useAuth';

interface MerchantLayoutProps {
  children: React.ReactNode;
}

/**
 * Merchant layout - protected layout for vendor users.
 * Combines authentication protection with the copied dashboard shell.
 */
export default function MerchantLayout({ children }: MerchantLayoutProps) {
  const pathname = usePathname();
  const { user } = useAuth();

  // If it's the login page, don't wrap with AdminDashboard or ProtectedRoute
  if (pathname === '/signin') {
    return children;
  }

  // For all other admin pages, wrap with ProtectedRoute and AdminDashboard
  // Suspense is required because Sidebar uses useSearchParams() — without it
  // server prerender (null params) mismatches client hydration (real params) → React #441.
  return (
    <NotificationsProvider userId={user?.id}>
      <ProtectedRoute redirectTo="/signin">
        <Suspense fallback={null}>
          <AdminDashboard>
            {children}
          </AdminDashboard>
        </Suspense>
      </ProtectedRoute>
    </NotificationsProvider>
  );
}
