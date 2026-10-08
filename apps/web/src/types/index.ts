/**
 * Shared TypeScript interfaces and types for the web application
 */

// Re-export authentication types
export * from './auth';
export type { Merchant, Media, MerchantsResponse } from '@encreasl/client-services';
export * from './product-category';
export * from './product';

export interface SidebarItemProps {
  icon: string;
  label: string;
  active?: boolean;
  collapsed?: boolean;
  onClick?: () => void;
  href?: string;
}



export interface CategoryCircleProps {
  label: string;
  active?: boolean;
  onClick?: () => void;
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

// Icon mapping type
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
  | 'modifiers'
  | 'reviews'
  | 'activity'
  | 'home'
  | 'trending'
  | 'music'
  | 'gaming'
  | 'news'
  | 'sports'
  | 'growth'
  | 'strategy'
  | 'innovation'
  | 'leadership'
  | 'consulting'
  | 'feedback'
  | 'heart'
  | 'receipt'
  | 'history'
  | 'location'
  | 'subscription'
  | 'voucher'
  | 'coupon'
  | 'points'
  | 'invite'
  | 'terms'
  | 'privacy'
  | 'cookie'
  | 'logout';

// Category icon mapping type
export interface CategoryIconConfig {
  icon: any;
  bgColor: string;
}

export type CategoryName = 
  | 'All'
  | 'Business'
  | 'Technology'
  | 'Marketing'
  | 'Analytics'
  | 'E-commerce'
  | 'Growth'
  | 'Strategy'
  | 'Innovation'
  | 'Leadership';
