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
  // On mobile the drawer should always render expanded (labels visible).
  // On desktop, honor the collapse state.
  const expanded = isDesktop ? isOpen : true;

  const [isVendorsExpanded, setIsVendorsExpanded] = React.useState(false);
  const [isMerchantsExpanded, setIsMerchantsExpanded] = React.useState(false);
  const [isBusinessZonesExpanded, setIsBusinessZonesExpanded] = React.useState(false);
  const [isAttributesExpanded, setIsAttributesExpanded] = React.useState(false);
  const [isModifiersExpanded, setIsModifiersExpanded] = React.useState(false);
  const [isTagsExpanded, setIsTagsExpanded] = React.useState(false);
  const [isPromotionsExpanded, setIsPromotionsExpanded] = React.useState(false);
  const [isCustomerActivityExpanded, setIsCustomerActivityExpanded] = React.useState(false);
  const hasActiveVendorsChild = dropdownActive(pathname, '/vendors');
  const hasActiveMerchantsChild = dropdownActive(pathname, '/merchants') || dropdownActive(pathname, '/merchant-categories');
  const hasActiveBusinessZonesChild = dropdownActive(pathname, '/business-zones');
  const hasActiveAttributesChild = dropdownActive(pathname, '/catalog/attributes') || dropdownActive(pathname, '/catalog/attribute-terms') || dropdownActive(pathname, '/catalog/variations') || dropdownActive(pathname, '/catalog/variation-values');
  const hasActiveModifiersChild =
    dropdownActive(pathname, '/catalog/modifier-groups') ||
    dropdownActive(pathname, '/catalog/modifier-options') ||
    dropdownActive(pathname, '/catalog/variation-modifier-groups') ||
    dropdownActive(pathname, '/catalog/variation-modifier-options') ||
    dropdownActive(pathname, '/catalog/variation-modifier-group-overrides') ||
    dropdownActive(pathname, '/catalog/variation-modifier-option-overrides') ||
    dropdownActive(pathname, '/catalog/merchant-product-modifier-group-overrides') ||
    dropdownActive(pathname, '/catalog/merchant-product-modifier-option-overrides') ||
    dropdownActive(pathname, '/catalog/merchant-variation-modifier-group-overrides') ||
    dropdownActive(pathname, '/catalog/merchant-variation-modifier-option-overrides');
  const hasActiveTagsChild = dropdownActive(pathname, '/catalog/tags') || dropdownActive(pathname, '/catalog/tag-groups');

  const hasActivePromotionsChild = dropdownActive(pathname, '/promotions') || dropdownActive(pathname, '/coupons');
  const hasActiveCustomerActivityChild = dropdownActive(pathname, '/activity');
  const hasActivePlatformConfigChild = dropdownActive(pathname, '/settings/configuration');

  React.useEffect(() => { if (hasActiveVendorsChild) setIsVendorsExpanded(true); }, [hasActiveVendorsChild]);
  React.useEffect(() => { if (hasActiveMerchantsChild) setIsMerchantsExpanded(true); }, [hasActiveMerchantsChild]);
  React.useEffect(() => { if (hasActiveBusinessZonesChild) setIsBusinessZonesExpanded(true); }, [hasActiveBusinessZonesChild]);
  React.useEffect(() => { if (hasActiveAttributesChild) setIsAttributesExpanded(true); }, [hasActiveAttributesChild]);
  React.useEffect(() => { if (hasActiveModifiersChild) setIsModifiersExpanded(true); }, [hasActiveModifiersChild]);
  React.useEffect(() => { if (hasActiveTagsChild) setIsTagsExpanded(true); }, [hasActiveTagsChild]);

  React.useEffect(() => { if (hasActivePromotionsChild) setIsPromotionsExpanded(true); }, [hasActivePromotionsChild]);
  React.useEffect(() => { if (hasActiveCustomerActivityChild) setIsCustomerActivityExpanded(true); }, [hasActiveCustomerActivityChild]);


  const productType = searchParams.get('type');
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
        data-sidebar="admin"
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

          {/* Vendors & Merchants */}
          <div className="space-y-1">
            <SidebarSectionLabel isOpen={expanded}>Vendors & Merchants</SidebarSectionLabel>

            <SidebarDropdownGroup
              icon="vendors"
              label="Vendors"
              isOpen={expanded}
              isExpanded={isVendorsExpanded}
              onToggle={() => setIsVendorsExpanded((c) => !c)}
              active={hasActiveVendorsChild}
            >
              {renderChildLink({ label: 'All Vendors', href: '/vendors', isActive: exactActive(pathname, '/vendors') })}
              {renderChildLink({ label: 'Verification & Compliance', href: '/vendors/verification', isActive: dropdownActive(pathname, '/vendors/verification') })}
              {renderChildLink({ label: 'Vendor Payouts Overview', href: '/vendors/payouts', isActive: dropdownActive(pathname, '/vendors/payouts') })}
            </SidebarDropdownGroup>

            <SidebarDropdownGroup
              icon="merchants"
              label="Merchants"
              isOpen={expanded}
              isExpanded={isMerchantsExpanded}
              onToggle={() => setIsMerchantsExpanded((c) => !c)}
              active={hasActiveMerchantsChild}
            >
              {renderChildLink({ label: 'All Merchants', href: '/merchants', isActive: exactActive(pathname, '/merchants') })}
              {renderChildLink({ label: 'Merchant Categories', href: '/merchant-categories', isActive: dropdownActive(pathname, '/merchant-categories') })}
            </SidebarDropdownGroup>

            <SidebarDropdownGroup
              icon="shipping"
              label="Business Zones"
              isOpen={expanded}
              isExpanded={isBusinessZonesExpanded}
              onToggle={() => setIsBusinessZonesExpanded((c) => !c)}
              active={hasActiveBusinessZonesChild}
            >
              {renderChildLink({ label: 'Admin', href: '/business-zones/admin', isActive: dropdownActive(pathname, '/business-zones/admin') })}
              {renderChildLink({ label: 'Merchants', href: '/business-zones/merchants', isActive: dropdownActive(pathname, '/business-zones/merchants') })}
            </SidebarDropdownGroup>
          </div>

          {expanded && <hr className="border-gray-200 dark:border-[#262626]" />}

          {/* Catalog */}
          <div className="space-y-1">
            <SidebarSectionLabel isOpen={expanded}>Catalog</SidebarSectionLabel>

            <SidebarItem icon="products" label="Products" active={dropdownActive(pathname, '/products')} collapsed={!expanded} href="/products" />

            <SidebarDropdownGroup
              icon="settings"
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

            <SidebarItem icon="payments" label="Transactions" active={dropdownActive(pathname, '/transactions')} collapsed={!expanded} href="/transactions" />

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

          {/* Content & Media */}
          <div className="space-y-1">
            <SidebarSectionLabel isOpen={expanded}>Content & Media</SidebarSectionLabel>
            <SidebarItem icon="media" label="Media Library" active={dropdownActive(pathname, '/media')} collapsed={!expanded} href="/media" />
            <SidebarItem icon="posts" label="Blog Posts" active={dropdownActive(pathname, '/posts')} collapsed={!expanded} href="/posts" />
          </div>

          {expanded && <hr className="border-gray-200 dark:border-[#262626]" />}

          {/* Account */}
          <div className="space-y-1">
            <SidebarSectionLabel isOpen={expanded}>Account</SidebarSectionLabel>
            <SidebarItem icon="profile" label="Your Profile" active={exactActive(pathname, '/profile') && accountTab !== 'settings'} collapsed={!expanded} href="/profile" />
            <SidebarItem icon="settings" label="Account Settings" active={exactActive(pathname, '/profile') && accountTab === 'settings'} collapsed={!expanded} href="/profile?tab=settings" />
          </div>

          {expanded && <hr className="border-gray-200 dark:border-[#262626]" />}

          {/* System Settings */}
          <div className="space-y-1">
            <SidebarSectionLabel isOpen={expanded}>System</SidebarSectionLabel>

            <SidebarItem icon="users" label="Users" active={dropdownActive(pathname, '/users')} collapsed={!expanded} href="/users" />

            <SidebarItem
              icon="integrations"
              label="Configurations"
              active={hasActivePlatformConfigChild}
              collapsed={!expanded}
              href="/settings/configuration"
            />

            <SidebarItem icon="security" label="Security" active={dropdownActive(pathname, '/settings/security')} collapsed={!expanded} href="/settings/security" />
            <SidebarItem icon="audit" label="User Events / Audit Logs" active={dropdownActive(pathname, '/settings/audit')} collapsed={!expanded} href="/settings/audit" />
          </div>

        </nav>
      </div>
    </aside>
    </>
  );
}
