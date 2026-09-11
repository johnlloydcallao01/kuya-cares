'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Header, MobileFooter } from '@/components/layout'
import { ProtectedRoute } from '@/components/auth'

/**
 * Portal Layout - Custom layout for portal pages
 * 
 * This layout provides:
 * - Same Header as main app for consistency
 * - Custom Portal Sidebar instead of main sidebar
 * - Isolated portal functionality
 */
export default function PortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [isDesktop, setIsDesktop] = useState(false)

  // Hide instant loading screen when portal loads
  useEffect(() => {
    const hideInstantLoadingScreen = () => {
      const loadingScreen = document.getElementById('instant-loading-screen');
      if (loadingScreen) {
        loadingScreen.style.opacity = '0';
        loadingScreen.style.transition = 'opacity 0.5s ease-out';
        setTimeout(() => {
          loadingScreen.style.display = 'none';
        }, 500);
      }
    };

    const timer = setTimeout(hideInstantLoadingScreen, 100);
    return () => clearTimeout(timer);
  }, []);

  // Check if we're on desktop and update sidebar visibility accordingly
  useEffect(() => {
    const checkScreenSize = () => {
      const isLargeScreen = window.innerWidth >= 1024 // lg breakpoint
      setIsDesktop(isLargeScreen)

      // On mobile/tablet, always keep sidebar closed
      if (!isLargeScreen) {
        setSidebarOpen(false)
      }
    }

    checkScreenSize()
    window.addEventListener('resize', checkScreenSize)
    return () => window.removeEventListener('resize', checkScreenSize)
  }, [])

  const toggleSidebar = () => {
    // Only allow toggling on desktop
    if (isDesktop) {
      setSidebarOpen(prev => !prev)
    }
  }

  const handleSearch = (query: string) => {
    console.log('Portal search query:', query)
    // TODO: Implement portal-specific search functionality
  }

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-gray-50" style={{ backgroundColor: '#f9fafb' }}>
        {/* Header - Same as main app for consistency */}
        <Header
          sidebarOpen={sidebarOpen}
          onToggleSidebar={toggleSidebar}
          onSearch={handleSearch}
        />

        {/* Portal Sidebar - Custom sidebar for portal pages */}
        <PortalSidebar
          isOpen={sidebarOpen}
          onToggle={toggleSidebar}
        />

        {/* Main Content Area - Portal pages content */}
        <main
          className={`transition-all duration-300 bg-gray-50 ${
            sidebarOpen ? 'lg:ml-60' : 'lg:ml-20'
          }`}
          style={{ backgroundColor: '#f9fafb' }}
        >
          <div className="min-h-full bg-gray-50" style={{ backgroundColor: '#f9fafb' }}>
            {children}
          </div>
        </main>

        {/* Mobile Footer - Same as main app */}
        <MobileFooter />
      </div>
    </ProtectedRoute>
  )
}

/**
 * Portal Sidebar Component - Custom sidebar for portal functionality
 */
function PortalSidebar({ isOpen, onToggle }: { isOpen: boolean; onToggle: () => void }) {
  return (
    <aside
      data-sidebar="portal"
      className={`fixed left-0 bg-white border-r border-gray-200 transition-all duration-300 overflow-y-auto z-40 hidden lg:block ${
        isOpen
          ? 'w-60 translate-x-0'
          : 'w-20 translate-x-0'
      }`}
      style={{
        height: 'calc(100vh - 4rem)',
        scrollbarWidth: 'thin',
        scrollbarColor: '#cbd5e1 transparent'
      }}
    >
      <div className="p-3">
        <nav className="space-y-1">
          {/* Back Navigation */}
          <div className="space-y-1">
            <button 
              onClick={() => window.history.back()}
              className={`flex items-center px-3 py-2 text-sm font-medium rounded-md hover:bg-gray-100 transition-colors ${
                isOpen ? 'justify-start' : 'justify-center'
              }`}
            >
              <div className="w-5 h-5 flex items-center justify-center">
                <i className="fa fa-arrow-left text-gray-600"></i>
              </div>
              {isOpen && <span className="ml-3 text-gray-700">Back</span>}
            </button>
          </div>

          {/* Home Navigation */}
          <div className="space-y-1">
            {(Link as any)({
              href: "/",
              className: `flex items-center px-3 py-2 text-sm font-medium rounded-md hover:bg-gray-100 transition-colors ${
                isOpen ? 'justify-start' : 'justify-center'
              }`,
              children: (
                <>
                  <div className="w-5 h-5 flex items-center justify-center">
                    <i className="fa fa-home text-gray-600"></i>
                  </div>
                  {isOpen && <span className="ml-3 text-gray-700">Home</span>}
                </>
              )
            })}
          </div>

          {isOpen && <hr className="my-3 border-gray-200" />}

          {/* Portal Navigation */}
          <div className="space-y-1">
            {isOpen && <div className="px-3 py-2 text-sm font-medium text-gray-900">Portal</div>}
            
            {/* Portal Dashboard */}
            {(Link as any)({
              href: "/portal/dashboard",
              className: `flex items-center px-3 py-2 text-sm font-medium rounded-md hover:bg-gray-100 transition-colors ${
                isOpen ? 'justify-start' : 'justify-center'
              }`,
              children: (
                <>
                  <div className="w-5 h-5 flex items-center justify-center">
                    <i className="fa fa-tachometer-alt text-gray-600"></i>
                  </div>
                  {isOpen && <span className="ml-3 text-gray-700">Dashboard</span>}
                </>
              )
            })}

            {/* Portal Analytics */}
            {(Link as any)({
              href: "/portal/analytics",
              className: `flex items-center px-3 py-2 text-sm font-medium rounded-md hover:bg-gray-100 transition-colors ${
                isOpen ? 'justify-start' : 'justify-center'
              }`,
              children: (
                <>
                  <div className="w-5 h-5 flex items-center justify-center">
                    <i className="fa fa-chart-bar text-gray-600"></i>
                  </div>
                  {isOpen && <span className="ml-3 text-gray-700">Analytics</span>}
                </>
              )
            })}

            {/* Portal Settings */}
            {(Link as any)({
              href: "/portal/settings",
              className: `flex items-center px-3 py-2 text-sm font-medium rounded-md hover:bg-gray-100 transition-colors ${
                isOpen ? 'justify-start' : 'justify-center'
              }`,
              children: (
                <>
                  <div className="w-5 h-5 flex items-center justify-center">
                    <i className="fa fa-cog text-gray-600"></i>
                  </div>
                  {isOpen && <span className="ml-3 text-gray-700">Settings</span>}
                </>
              )
            })}
          </div>

          {isOpen && <hr className="my-3 border-gray-200" />}

          {/* Portal Tools */}
          <div className="space-y-1">
            {isOpen && <div className="px-3 py-2 text-sm font-medium text-gray-900">Tools</div>}
            
            <div className={`flex items-center px-3 py-2 text-sm font-medium rounded-md hover:bg-gray-100 transition-colors ${
              isOpen ? 'justify-start' : 'justify-center'
            }`}>
              <div className="w-5 h-5 flex items-center justify-center">
                <i className="fa fa-users text-gray-600"></i>
              </div>
              {isOpen && <span className="ml-3 text-gray-700">User Management</span>}
            </div>

            <div className={`flex items-center px-3 py-2 text-sm font-medium rounded-md hover:bg-gray-100 transition-colors ${
              isOpen ? 'justify-start' : 'justify-center'
            }`}>
              <div className="w-5 h-5 flex items-center justify-center">
                <i className="fa fa-file-alt text-gray-600"></i>
              </div>
              {isOpen && <span className="ml-3 text-gray-700">Reports</span>}
            </div>
          </div>
        </nav>
      </div>
    </aside>
  )
}