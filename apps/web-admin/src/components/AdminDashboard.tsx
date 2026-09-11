"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import { Header, Sidebar } from "@/components/layout";

interface AdminDashboardProps {
  children?: React.ReactNode;
}

// Dashboard context for managing layout state
interface DashboardContextType {
  sidebarOpen: boolean;
  toggleSidebar: () => void;
  mobileSidebarOpen: boolean;
  toggleMobileSidebar: () => void;
  closeMobileSidebar: () => void;
}

const DashboardContext = createContext<DashboardContextType | undefined>(undefined);

export function useDashboard() {
  const context = useContext(DashboardContext);
  if (!context) {
    throw new Error('useDashboard must be used within AdminDashboard');
  }
  return context;
}

/**
 * Admin Dashboard component - Main admin layout
 *
 * Responsive behavior (mirrors grandline):
 * - Desktop (lg+): sidebar collapsible w-60/w-20, always visible
 * - Mobile (<lg): sidebar as slide-in drawer with backdrop, hamburger in header left (lg:hidden)
 *
 * This component orchestrates the main admin layout with header, sidebar, and content areas.
 * It maintains layout state and provides a proper SPA experience.
 */
export function AdminDashboard({ children }: AdminDashboardProps) {
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  // Close the mobile drawer whenever the route changes
  useEffect(() => {
    setMobileSidebarOpen(false);
  }, [pathname]);

  // Prevent body scroll when the mobile drawer is open
  useEffect(() => {
    if (mobileSidebarOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [mobileSidebarOpen]);

  const toggleSidebar = () => {
    setSidebarOpen(prev => !prev);
  };

  const toggleMobileSidebar = () => {
    setMobileSidebarOpen(prev => !prev);
  };

  const closeMobileSidebar = () => {
    setMobileSidebarOpen(false);
  };

  const dashboardValue: DashboardContextType = {
    sidebarOpen,
    toggleSidebar,
    mobileSidebarOpen,
    toggleMobileSidebar,
    closeMobileSidebar,
  };

  return (
    <DashboardContext.Provider value={dashboardValue}>
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
        <main className={`transition-all duration-300 ${sidebarOpen ? 'lg:ml-60' : 'lg:ml-20'} bg-gray-50 dark:bg-[#0a0a0a]`}>
          {children || <DefaultDashboardContent />}
        </main>
      </div>
    </DashboardContext.Provider>
  );
}

/**
 * Default dashboard content when no children are provided
 */
function DefaultDashboardContent() {
  return (
    <div className="p-6">
      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-sm font-medium text-gray-500">Total Contacts</h3>
          <p className="text-2xl font-bold text-gray-900">42</p>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-sm font-medium text-gray-500">New Contacts</h3>
          <p className="text-2xl font-bold text-blue-600">7</p>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-sm font-medium text-gray-500">Total Subscribers</h3>
          <p className="text-2xl font-bold text-gray-900">156</p>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-sm font-medium text-gray-500">Active Subscribers</h3>
          <p className="text-2xl font-bold text-green-600">134</p>
        </div>
      </div>

      {/* Welcome Message */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-medium text-gray-900 mb-4">
          Welcome to Admin Dashboard
        </h2>
        <p className="text-gray-600">
          Access your admin control panel and manage your content.
        </p>
      </div>
    </div>
  );
}


