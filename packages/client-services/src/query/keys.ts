/**
 * Shared query keys — single source of truth so web-admin, web-merchant,
 * web-driver etc. never diverge and never double-cache the same resource.
 */
export const QUERY_KEYS = {
  adminDashboard: ['admin', 'dashboard', 'overview'] as const,
  adminAnalytics: (params?: string) =>
    ['admin', 'dashboard', 'analytics', params ?? 'default'] as const,
  adminReports: (range?: string) =>
    ['admin', 'dashboard', 'reports', range ?? 'default'] as const,
  adminVendors: (params?: string) =>
    ['admin', 'vendors', params ?? 'default'] as const,
  adminVendorPayouts: (params?: string) =>
    ['admin', 'vendors', 'payouts', params ?? 'default'] as const,
  adminMerchants: (params?: string) =>
    ['admin', 'merchants', params ?? 'default'] as const,
  adminMerchantCategories: (params?: string) =>
    ['admin', 'merchant-categories', params ?? 'default'] as const,
  adminProductCategories: (params?: string) =>
    ['admin', 'product-categories', params ?? 'default'] as const,
  adminBusinessZones: (params?: string) =>
    ['admin', 'business-zones', params ?? 'default'] as const,
  adminBusinessZoneOverview: (params?: string) =>
    ['admin', 'business-zones', 'overview', params ?? 'default'] as const,
  adminMerchantProducts: (params?: string) =>
    ['admin', 'merchant-products', params ?? 'default'] as const,
  adminOrders: (params?: string) =>
    ['admin', 'orders', params ?? 'default'] as const,
  adminOrderItems: (params?: string) =>
    ['admin', 'order-items', params ?? 'default'] as const,
  adminTransactions: (params?: string) =>
    ['admin', 'transactions', params ?? 'default'] as const,
  adminCoupons: (params?: string) =>
    ['admin', 'coupons', params ?? 'default'] as const,
  adminCouponRedemptions: (params?: string) =>
    ['admin', 'coupons', 'redemptions', params ?? 'default'] as const,
  adminCustomers: (params?: string) =>
    ['admin', 'customers', params ?? 'default'] as const,
  adminCustomerAddresses: (params?: string) =>
    ['admin', 'customers', 'addresses', params ?? 'default'] as const,
  adminEmergencyContacts: (params?: string) =>
    ['admin', 'customers', 'emergency-contacts', params ?? 'default'] as const,
  adminActivity: (activity: string, params?: string) =>
    ['admin', 'activity', activity, params ?? 'default'] as const,
  adminMediaLibrary: (params?: string) =>
    ['admin', 'media-library', params ?? 'default'] as const,
  adminPosts: (params?: string) =>
    ['admin', 'posts', params ?? 'default'] as const,
  adminProfile: (params?: string) =>
    ['admin', 'profile', params ?? 'default'] as const,
  adminUsers: (params?: string) =>
    ['admin', 'users', params ?? 'default'] as const,
  adminUserDependencies: (userId: string | number) =>
    ['admin', 'users', 'dependencies', String(userId)] as const,
  adminConfiguration: (params?: string) =>
    ['admin', 'configuration', params ?? 'default'] as const,
  adminSecurity: (params?: string) =>
    ['admin', 'security', params ?? 'default'] as const,
  adminAudit: (params?: string) =>
    ['admin', 'audit', params ?? 'default'] as const,
  adminCatalogAttributes: (params?: string) =>
    ['admin', 'catalog', 'attributes', params ?? 'default'] as const,
  adminCatalogAttributeTerms: (params?: string) =>
    ['admin', 'catalog', 'attribute-terms', params ?? 'default'] as const,
  adminCatalogVariations: (params?: string) =>
    ['admin', 'catalog', 'variations', params ?? 'default'] as const,
  adminCatalogVariationValues: (params?: string) =>
    ['admin', 'catalog', 'variation-values', params ?? 'default'] as const,
  adminCatalogModifierGroups: (params?: string) =>
    ['admin', 'catalog', 'modifier-groups', params ?? 'default'] as const,
  adminCatalogModifierOptions: (params?: string) =>
    ['admin', 'catalog', 'modifier-options', params ?? 'default'] as const,
  adminCatalogVariationModifierGroups: (params?: string) =>
    ['admin', 'catalog', 'variation-modifier-groups', params ?? 'default'] as const,
  adminCatalogVariationModifierOptions: (params?: string) =>
    ['admin', 'catalog', 'variation-modifier-options', params ?? 'default'] as const,
  adminCatalogVariationModifierOptionOverrides: (params?: string) =>
    ['admin', 'catalog', 'variation-modifier-option-overrides', params ?? 'default'] as const,
  adminCatalogTags: (params?: string) =>
    ['admin', 'catalog', 'tags', params ?? 'default'] as const,
  adminCatalogTagGroups: (params?: string) =>
    ['admin', 'catalog', 'tag-groups', params ?? 'default'] as const,
  adminCatalogGroupedItems: (params?: string) =>
    ['admin', 'catalog', 'grouped-items', params ?? 'default'] as const,
  adminCatalogMerchantProductModifierGroupOverrides: (params?: string) =>
    ['admin', 'catalog', 'merchant-product-modifier-group-overrides', params ?? 'default'] as const,
  adminCatalogMerchantProductModifierOptionOverrides: (params?: string) =>
    ['admin', 'catalog', 'merchant-product-modifier-option-overrides', params ?? 'default'] as const,
  adminCatalogVariationModifierGroupOverrides: (params?: string) =>
    ['admin', 'catalog', 'variation-modifier-group-overrides', params ?? 'default'] as const,
  adminCatalogMerchantVariationModifierGroupOverrides: (params?: string) =>
    ['admin', 'catalog', 'merchant-variation-modifier-group-overrides', params ?? 'default'] as const,
  adminCatalogMerchantVariationModifierOptionOverrides: (params?: string) =>
    ['admin', 'catalog', 'merchant-variation-modifier-option-overrides', params ?? 'default'] as const,
  adminProducts: (params?: string) =>
    ['admin', 'products', params ?? 'default'] as const,
  merchantDashboard: (merchantId?: string) =>
    ['merchant', 'dashboard', merchantId ?? 'me'] as const,
  merchantAnalytics: (params?: string) =>
    ['merchant', 'analytics', params ?? 'default'] as const,
  merchantReports: (params?: string) =>
    ['merchant', 'reports', params ?? 'default'] as const,
} as const;
