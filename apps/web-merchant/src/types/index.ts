/**
 * Shared TypeScript interfaces and types for the web-admin application
 */

export interface SidebarItemProps {
  icon: string;
  label: string;
  active?: boolean;
  collapsed?: boolean;
  onClick?: () => void;
  href?: string;
}

export interface HeaderProps {
  sidebarOpen: boolean;
  onToggleSidebar: () => void;
  onToggleMobileSidebar?: () => void;
  onSearch?: (query: string) => void;
}

export interface SidebarProps {
  isOpen: boolean;
  onToggle: () => void;
  mobileOpen?: boolean;
  onCloseMobile?: () => void;
  onScroll?: (e: React.UIEvent<HTMLElement>) => void;
}

export interface LayoutProps {
  children: React.ReactNode;
}

// Icon mapping type for admin icons
export type IconName =
  | 'dashboard'
  | 'posts'
  | 'settings'
  | 'users'
  | 'analytics'
  | 'reports'
  | 'content'
  | 'media'
  | 'pages'
  | 'categories'
  | 'tags'
  | 'comments'
  | 'orders'
  | 'products'
  | 'inventory'
  | 'customers'
  | 'payments'
  | 'shipping'
  | 'campaigns'
  | 'email'
  | 'social'
  | 'seo'
  | 'ads'
  | 'team'
  | 'roles'
  | 'permissions'
  | 'audit'
  | 'logs'
  | 'backup'
  | 'security'
  | 'api'
  | 'integrations'
  | 'notifications'
  | 'help'
  | 'support'
  | 'billing'
  | 'profile'
  | 'outlets'
  | 'business'
  | 'fulfillment'
  | 'reviews';
