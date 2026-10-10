'use client'

import React, { Suspense, useState, useEffect } from 'react'
import { RoleProtectedRoute } from '@/components/auth'
import { AppQueryProvider } from '@encreasl/client-services'
import { Header } from './_components/Header'
import { Sidebar } from './_components/layout/Sidebar'

/**
 * Seller Layout - Member selling side (/seller)
 *
 * Uses the exact identical Header and Sidebar designed in apps/web-merchant
 */
export default function SellerLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  useEffect(() => {
    setMobileSidebarOpen(false);
  }, []);

  useEffect(() => {
    if (mobileSidebarOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [mobileSidebarOpen]);

  const toggleSidebar = () => setSidebarOpen((prev) => !prev);
  const toggleMobileSidebar = () => setMobileSidebarOpen((prev) => !prev);
  const closeMobileSidebar = () => setMobileSidebarOpen(false);

  return (
    <AppQueryProvider>
      <RoleProtectedRoute allowedRoles={['member']}>
        <Suspense fallback={null}>
          <div className="min-h-screen bg-gray-50 dark:bg-[#0a0a0a]">
            <Header
              sidebarOpen={sidebarOpen}
              onToggleSidebar={toggleSidebar}
              onToggleMobileSidebar={toggleMobileSidebar}
            />
            <Sidebar
              isOpen={sidebarOpen}
              onToggle={toggleSidebar}
              mobileOpen={mobileSidebarOpen}
              onCloseMobile={closeMobileSidebar}
            />
            <main data-seller-layout="true" className={`transition-all duration-300 ${sidebarOpen ? 'lg:ml-60' : 'lg:ml-20'} bg-gray-50 dark:bg-[#0a0a0a]`}>
              {children}
            </main>
          </div>
        </Suspense>
      </RoleProtectedRoute>
    </AppQueryProvider>
  )
}
