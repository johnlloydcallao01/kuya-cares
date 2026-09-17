'use client';

import React from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import type { SidebarProps } from '@/types';
import { SidebarItem, SidebarDropdownGroup } from '@/components/ui';
import Link from '@/components/ui/LinkWrapper';
import { useMediaQuery } from '@/hooks/useMediaQuery';

const dropdownActive = (pathname: string | null, startsWith: string) =>
  pathname === startsWith || pathname?.startsWith(startsWith + '/') || false;

const exactActive = (pathname: string | null, href: string) =>
  pathname === href;

function SidebarSectionLabel({ children, isOpen }: { children: React.ReactNode; isOpen: boolean }) {
  if (!isOpen) return null;
  return (
    <div className="px-3 py-2 text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-[#a1a1aa]">
      {children}
    </div>
  );
}

function renderChildLink(
  item: { label: string; href: string; isActive: boolean },
) {
  return (
    <div key={item.href}>
      <Link
        href={item.href as any}
        className={`flex w-full items-center rounded-lg px-3 py-2 text-sm transition-colors ${
          item.isActive
            ? 'bg-gray-100 font-medium text-gray-900 dark:bg-gray-800 dark:text-gray-100'
            : 'text-gray-700 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-300 dark:hover:bg-gray-800 dark:hover:text-gray-100'
        }`}
      >
        <span className="truncate">{item.label}</span>
      </Link>
    </div>
  );
}

export function Sidebar({ isOpen, onToggle: _onToggle, mobileOpen = false, onCloseMobile, onScroll }: SidebarProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const isDesktop = useMediaQuery('(min-width: 1024px)');
  const expanded = isDesktop ? isOpen : true;

  const [isAttributesExpanded, setIsAttributesExpanded] = React.useState(false);
  const [isModifiersExpanded, setIsModifiersExpanded] = React.useState(false);
  const [isTagsExpanded, setIsTagsExpanded] = React.useState(false);
  const [isPromotionsExpanded, setIsPromotionsExpanded] = React.useState(false);
  const [isCustomerActivityExpanded, setIsCustomerActivityExpanded] = React.useState(false);

  const hasActiveAttributesChild = dropdownActive(pathname, '/catalog/attributes') || dropdownActive(pathname, '/catalog/attribute-terms') || dropdownActive(pathname, '/catalog/variations') || dropdownActive(pathname, '/catalog/variation-values');
  const hasActiveModifiersChild = dropdownActive(pathname, '/catalog/modifier-groups') || dropdownActive(pathname, '/catalog/modifier-options') || dropdownActive(pathname, '/catalog/variation-modifier-groups') || dropdownActive(pathname, '/catalog/variation-modifier-options') || dropdownActive(pathname, '/catalog/variation-modifier-group-overrides') || dropdownActive(pathname, '/catalog/variation-modifier-option-overrides') || dropdownActive(pathname, '/catalog/merchant-product-modifier-group-overrides') || dropdownActive(pathname, '/catalog/merchant-product-modifier-option-overrides') || dropdownActive(pathname, '/catalog/merchant-variation-modifier-group-overrides') || dropdownActive(pathname, '/catalog/merchant-variation-modifier-option-overrides');
  const hasActiveTagsChild = dropdownActive(pathname, '/catalog/tags') || dropdownActive(pathname, '/catalog/tag-groups');
  const hasActivePromotionsChild = dropdownActive(pathname, '/promotions') || dropdownActive(pathname, '/coupons');
  const hasActiveCustomerActivityChild = dropdownActive(pathname, '/activity');

  React.useEffect(() => { if (hasActiveAttributesChild) setIsAttributesExpanded(true); }, [hasActiveAttributesChild]);
  React.useEffect(() => { if (hasActiveModifiersChild) setIsModifiersExpanded(true); }, [hasActiveModifiersChild]);
  React.useEffect(() => { if (hasActiveTagsChild) setIsTagsExpanded(true); }, [hasActiveTagsChild]);
  React.useEffect(() => { if (hasActivePromotionsChild) setIsPromotionsExpanded(true); }, [hasActivePromotionsChild]);
  React.useEffect(() => { if (hasActiveCustomerActivityChild) setIsCustomerActivityExpanded(true); }, [hasActiveCustomerActivityChild]);

  const accountTab = searchParams.get('tab');

  return (
    <>
      {/* Mobile backdrop overlay - only visible on small screens when drawer is open */}
      {mobileOpen && (
        <div
          className="fixed inset-x-0 top-[57px] sm:top-[65px] bottom-0 bg-black/50 z-40 lg:hidden"
          onClick={onCloseMobile}
          aria-hidden="true"
        />
      )}
      <aside
        data-sidebar="merchant"
        className={`fixed left-0 top-[57px] sm:top-[65px] bg-white dark:bg-[#171717] border-r border-gray-200 dark:border-[#262626] transition-all duration-300 overflow-y-auto sidebar-scroll z-50 lg:z-40
          w-64 h-[calc(100vh-57px)] sm:h-[calc(100vh-65px)] ${mobileOpen ? 'translate-x-0' : '-translate-x-full'}
          lg:translate-x-0 ${isOpen ? 'lg:w-60' : 'lg:w-20'}`}
        onScroll={onScroll}
      >
      <div className="p-3 pb-20">
        <nav className="space-y-4">

          {/* Dashboard & Analytics */}
          <div className="space-y-1">
            <SidebarSectionLabel isOpen={expanded}>Dashboard & Analytics</SidebarSectionLabel>
 <SidebarItem icon="dashboard" label="Overview" active={exactActive(pathname, '/dashboard/overview') || exactActive(pathname, '/')} collapsed={!expanded} href="/dashboard/overview" />
 <SidebarItem icon="analytics" label="Analytics" active={dropdownActive(pathname, '/dashboard/analytics')} collapsed={!expanded} href="/dashboard/analytics" />
 <SidebarItem icon="reports" label="Reports" active={dropdownActive(pathname, '/dashboard/reports')} collapsed={!expanded} href="/dashboard/reports" />
          </div>

          {expanded && <hr className="border-gray-200 dark:border-[#262626]" />}

          {/* My Business */}
          <div className="space-y-1">
            <SidebarSectionLabel isOpen={expanded}>My Business</SidebarSectionLabel>

            <SidebarItem icon="outlets" label="Outlets" active={dropdownActive(pathname, '/outlets')} collapsed={!expanded} href="/outlets" />

            <SidebarItem icon="business" label="Company Information" active={dropdownActive(pathname, '/business/profile')} collapsed={!expanded} href="/business/profile" />
            <SidebarItem icon="audit" label="Registration & Verification" active={dropdownActive(pathname, '/business/verification')} collapsed={!expanded} href="/business/verification" />
          </div>

          {expanded && <hr className="border-gray-200 dark:border-[#262626]" />}

          {/* Menu & Products */}
          <div className="space-y-1">
            <SidebarSectionLabel isOpen={expanded}>Menu & Products</SidebarSectionLabel>

            <SidebarItem icon="products" label="Products" active={dropdownActive(pathname, '/products')} collapsed={!expanded} href="/products" />

            <SidebarDropdownGroup
              icon="tags"
              label="Attributes & Variations"
              isOpen={expanded}
              isExpanded={isAttributesExpanded}
              onToggle={() => setIsAttributesExpanded((c) => !c)}
              active={hasActiveAttributesChild}
            >
              {renderChildLink({ label: 'Attributes', href: '/catalog/attributes', isActive: dropdownActive(pathname, '/catalog/attributes') })}
              {renderChildLink({ label: 'Attribute Terms', href: '/catalog/attribute-terms', isActive: dropdownActive(pathname, '/catalog/attribute-terms') })}
              {renderChildLink({ label: 'Variations', href: '/catalog/variations', isActive: dropdownActive(pathname, '/catalog/variations') })}
              {renderChildLink({ label: 'Variation Values', href: '/catalog/variation-values', isActive: dropdownActive(pathname, '/catalog/variation-values') })}
            </SidebarDropdownGroup>

            <SidebarDropdownGroup
              icon="modifiers"
              label="Modifiers (Add-ons)"
              isOpen={expanded}
              isExpanded={isModifiersExpanded}
              onToggle={() => setIsModifiersExpanded((c) => !c)}
              active={hasActiveModifiersChild}
            >
              {renderChildLink({ label: 'Modifier Groups', href: '/catalog/modifier-groups', isActive: dropdownActive(pathname, '/catalog/modifier-groups') })}
              {renderChildLink({ label: 'Modifier Options', href: '/catalog/modifier-options', isActive: dropdownActive(pathname, '/catalog/modifier-options') })}
              {renderChildLink({ label: 'Variation Modifier Groups', href: '/catalog/variation-modifier-groups', isActive: dropdownActive(pathname, '/catalog/variation-modifier-groups') })}
              {renderChildLink({ label: 'Variation Modifier Options', href: '/catalog/variation-modifier-options', isActive: dropdownActive(pathname, '/catalog/variation-modifier-options') })}
              {renderChildLink({ label: 'Variation Modifier Group Overrides', href: '/catalog/variation-modifier-group-overrides', isActive: dropdownActive(pathname, '/catalog/variation-modifier-group-overrides') })}
              {renderChildLink({ label: 'Variation Modifier Option Overrides', href: '/catalog/variation-modifier-option-overrides', isActive: dropdownActive(pathname, '/catalog/variation-modifier-option-overrides') })}
              {renderChildLink({ label: 'Merchant Product Modifier Group Overrides', href: '/catalog/merchant-product-modifier-group-overrides', isActive: dropdownActive(pathname, '/catalog/merchant-product-modifier-group-overrides') })}
              {renderChildLink({ label: 'Merchant Product Modifier Option Overrides', href: '/catalog/merchant-product-modifier-option-overrides', isActive: dropdownActive(pathname, '/catalog/merchant-product-modifier-option-overrides') })}
              {renderChildLink({ label: 'Merchant Variation Modifier Group Overrides', href: '/catalog/merchant-variation-modifier-group-overrides', isActive: dropdownActive(pathname, '/catalog/merchant-variation-modifier-group-overrides') })}
              {renderChildLink({ label: 'Merchant Variation Modifier Option Overrides', href: '/catalog/merchant-variation-modifier-option-overrides', isActive: dropdownActive(pathname, '/catalog/merchant-variation-modifier-option-overrides') })}
            </SidebarDropdownGroup>

            <SidebarItem icon="products" label="Grouped Items" active={dropdownActive(pathname, '/catalog/grouped-items')} collapsed={!expanded} href="/catalog/grouped-items" />

            <SidebarItem icon="categories" label="Product Categories" active={dropdownActive(pathname, '/product-categories')} collapsed={!expanded} href="/product-categories" />

            <SidebarDropdownGroup
              icon="tags"
              label="Tags"
              isOpen={expanded}
              isExpanded={isTagsExpanded}
              onToggle={() => setIsTagsExpanded((c) => !c)}
              active={hasActiveTagsChild}
            >
              {renderChildLink({ label: 'Product Tags', href: '/catalog/tags', isActive: dropdownActive(pathname, '/catalog/tags') })}
              {renderChildLink({ label: 'Tag Groups', href: '/catalog/tag-groups', isActive: dropdownActive(pathname, '/catalog/tag-groups') })}
            </SidebarDropdownGroup>
          </div>

          {expanded && <hr className="border-gray-200 dark:border-[#262626]" />}

          {/* Orders */}
          <div className="space-y-1">
            <SidebarSectionLabel isOpen={expanded}>Orders</SidebarSectionLabel>

            <SidebarItem icon="orders" label="All Orders" active={exactActive(pathname, '/orders')} collapsed={!expanded} href="/orders" />

            <SidebarItem icon="pages" label="Order Items" active={dropdownActive(pathname, '/order-items')} collapsed={!expanded} href="/order-items" />
          </div>

          {expanded && <hr className="border-gray-200 dark:border-[#262626]" />}

          {/* Finance */}
          <div className="space-y-1">
            <SidebarSectionLabel isOpen={expanded}>Finance</SidebarSectionLabel>
            <SidebarItem icon="payments" label="Transactions" active={dropdownActive(pathname, '/payments/transactions')} collapsed={!expanded} href="/payments/transactions" />

            <SidebarDropdownGroup
              icon="campaigns"
              label="Promotions"
              isOpen={expanded}
              isExpanded={isPromotionsExpanded}
              onToggle={() => setIsPromotionsExpanded((c) => !c)}
              active={hasActivePromotionsChild}
            >
              {renderChildLink({ label: 'Coupons', href: '/coupons', isActive: dropdownActive(pathname, '/coupons') && !dropdownActive(pathname, '/coupons/usage') })}
              {renderChildLink({ label: 'Coupon Usage Report', href: '/coupons/usage', isActive: dropdownActive(pathname, '/coupons/usage') })}
            </SidebarDropdownGroup>
          </div>

          {expanded && <hr className="border-gray-200 dark:border-[#262626]" />}

          {/* Customers */}
          <div className="space-y-1">
            <SidebarSectionLabel isOpen={expanded}>Customers</SidebarSectionLabel>

            <SidebarItem icon="customers" label="All Customers" active={exactActive(pathname, '/customers')} collapsed={!expanded} href="/customers" />
            <SidebarItem icon="pages" label="Customer Addresses" active={dropdownActive(pathname, '/customers/addresses')} collapsed={!expanded} href="/customers/addresses" />
            <SidebarItem icon="support" label="Emergency Contacts" active={dropdownActive(pathname, '/customers/emergency-contacts')} collapsed={!expanded} href="/customers/emergency-contacts" />

            <SidebarDropdownGroup
              icon="activity"
              label="Customer Activity"
              isOpen={expanded}
              isExpanded={isCustomerActivityExpanded}
              onToggle={() => setIsCustomerActivityExpanded((c) => !c)}
              active={hasActiveCustomerActivityChild}
            >
              {renderChildLink({ label: 'Wishlists', href: '/activity/wishlists', isActive: dropdownActive(pathname, '/activity/wishlists') })}
              {renderChildLink({ label: 'Carts (Abandoned)', href: '/activity/carts', isActive: dropdownActive(pathname, '/activity/carts') })}
              {renderChildLink({ label: 'Recent Searches', href: '/activity/searches', isActive: dropdownActive(pathname, '/activity/searches') })}
              {renderChildLink({ label: 'Recently Viewed', href: '/activity/views', isActive: dropdownActive(pathname, '/activity/views') })}
            </SidebarDropdownGroup>
          </div>

          {expanded && <hr className="border-gray-200 dark:border-[#262626]" />}

          {/* Account */}
          <div className="space-y-1">
            <SidebarSectionLabel isOpen={expanded}>Account</SidebarSectionLabel>
            <SidebarItem icon="profile" label="Your Profile" active={exactActive(pathname, '/profile') && accountTab !== 'settings'} collapsed={!expanded} href="/profile" />
            <SidebarItem icon="settings" label="Account Settings" active={exactActive(pathname, '/profile') && accountTab === 'settings'} collapsed={!expanded} href="/profile?tab=settings" />
          </div>

        </nav>
      </div>
    </aside>
    </>
  );
}
