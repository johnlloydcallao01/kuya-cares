import type { CollectionConfig } from 'payload'
import { validateStoreHoursFields } from '@/utils/storeHours'
import { createAdminNotificationFanout } from '../utils/notificationFanout'

export const Vendors: CollectionConfig = {
  slug: 'vendors',
  admin: {
    useAsTitle: 'businessName',
    defaultColumns: ['businessName', 'businessType', 'verificationStatus', 'isActive', 'totalMerchants'],
    group: 'Food Delivery',
    description: 'Manage business entities and vendor organizations',
  },
  access: {
    // PayloadCMS automatically authenticates API keys and populates req.user
    read: ({ req: { user } }) => {
      // If user exists, they've been authenticated (either via API key or login)
      if (user) {
        // Allow service accounts (for website display) and admins
        if (user.role === 'service' || user.role === 'admin') {
          return true
        }
      }
      
      // Block all unauthenticated requests and other roles
      return false
    },
    create: ({ req: { user } }) => {
      // Allow both service accounts and admins to create vendors
      return user?.role === 'service' || user?.role === 'admin' || false
    },
    update: ({ req: { user } }) => {
      // Allow both service accounts and admins to update vendors
      return user?.role === 'service' || user?.role === 'admin' || false
    },
    delete: ({ req: { user } }) => {
      // Allow both service accounts and admins to delete vendors
      return user?.role === 'service' || user?.role === 'admin' || false
    },
  },
  fields: [
    // === USER RELATIONSHIP ===
    {
      name: 'user',
      type: 'relationship',
      relationTo: 'users',
      required: true,
      filterOptions: ({ relationTo: _relationTo, data: _data }) => {
        // Show users with 'vendor' or 'member' role in the dropdown (both may own a vendor record)
        return {
          role: {
            in: ['vendor', 'member'],
          },
        }
      },
      admin: {
        description: 'User account associated with this vendor (required)',
        position: 'sidebar',
      },
    },
    
    // === CORE BUSINESS INFORMATION ===
    {
      name: 'businessName',
      type: 'text',
      required: true,
      admin: {
        description: 'Business name (e.g., "Jollibee Corporation", "McDonald\'s Philippines")',
      },
    },
    {
      name: 'legalName',
      type: 'text',
      required: true,
      admin: {
        description: 'Legal business name as registered with government',
      },
    },
    {
      name: 'businessRegistrationNumber',
      type: 'text',
      required: true,
      unique: true,
      admin: {
        description: 'Government business registration number (DTI/SEC)',
      },
    },
    {
      name: 'taxIdentificationNumber',
      type: 'text',
      unique: true,
      admin: {
        description: 'Tax Identification Number (TIN)',
      },
    },

    // === CONTACT INFORMATION ===
    {
      name: 'primaryContactEmail',
      type: 'email',
      required: true,
      admin: {
        description: 'Primary business contact email',
      },
    },
    {
      name: 'primaryContactPhone',
      type: 'text',
      required: true,
      admin: {
        description: 'Primary business contact phone number',
      },
    },
    {
      name: 'websiteUrl',
      type: 'text',
      admin: {
        description: 'Official business website URL',
      },
    },

    // === BUSINESS CLASSIFICATION ===
    {
      name: 'businessType',
      type: 'select',
      required: true,
      options: [
        { label: 'Restaurant', value: 'restaurant' },
        { label: 'Fast Food', value: 'fast_food' },
        { label: 'Grocery Store', value: 'grocery' },
        { label: 'Pharmacy', value: 'pharmacy' },
        { label: 'Convenience Store', value: 'convenience' },
        { label: 'Bakery', value: 'bakery' },
        { label: 'Coffee Shop', value: 'coffee_shop' },
        { label: 'Other', value: 'other' },
      ],
      admin: {
        description: 'Type of business operation',
      },
    },
    {
      name: 'cuisineTypes',
      type: 'json',
      admin: {
        description: 'Types of cuisine offered (JSON array of strings)',
      },
    },

    // === OPERATIONAL STATUS ===
    {
      name: 'isActive',
      type: 'checkbox',
      defaultValue: true,
      admin: {
        description: 'Whether the vendor is currently active',
      },
    },
    {
      name: 'verificationStatus',
      type: 'select',
      required: true,
      defaultValue: 'pending',
      options: [
        { label: 'Pending Verification', value: 'pending' },
        { label: 'Verified', value: 'verified' },
        { label: 'Rejected', value: 'rejected' },
        { label: 'Suspended', value: 'suspended' },
      ],
      admin: {
        description: 'Business verification status',
      },
    },
    {
      name: 'onboardingDate',
      type: 'date',
      admin: {
        description: 'Date when vendor was onboarded to the platform',
        date: {
          pickerAppearance: 'dayAndTime',
        },
      },
    },

    // === BUSINESS METRICS ===
    {
      name: 'averageRating',
      type: 'number',
      min: 0,
      max: 5,
      defaultValue: 0,
      admin: {
        description: 'Average rating across all merchant locations',
        step: 0.1,
      },
    },
    {
      name: 'totalReviews',
      type: 'number',
      min: 0,
      defaultValue: 0,
      admin: {
        description: 'Total number of reviews across all locations',
      },
    },
    {
      name: 'totalOrders',
      type: 'number',
      min: 0,
      defaultValue: 0,
      admin: {
        description: 'Total orders processed across all locations',
      },
    },
    {
      name: 'totalMerchants',
      type: 'number',
      min: 0,
      defaultValue: 0,
      admin: {
        description: 'Number of merchant locations under this vendor',
      },
    },

    // === BUSINESS DOCUMENTS ===
    {
      name: 'businessLicense',
      type: 'upload',
      relationTo: 'media',
      admin: {
        description: 'Business license document',
      },
    },
    {
      name: 'taxCertificate',
      type: 'upload',
      relationTo: 'media',
      admin: {
        description: 'Tax certificate document',
      },
    },
    {
      name: 'logo',
      type: 'upload',
      relationTo: 'media',
      admin: {
        description: 'Business logo',
      },
    },

    

    // === ADDITIONAL METADATA ===
    {
      name: 'description',
      type: 'textarea',
      admin: {
        description: 'Business description and overview',
      },
    },
    {
      name: 'operatingHours',
      type: 'json',
      admin: {
        description: 'Default operating hours (can be overridden by individual merchants)',
      },
    },
    {
      name: 'socialMediaLinks',
      type: 'group',
      fields: [
        {
          name: 'facebook',
          type: 'text',
        },
        {
          name: 'instagram',
          type: 'text',
        },
        {
          name: 'twitter',
          type: 'text',
        },
        {
          name: 'website',
          type: 'text',
        },
      ],
      admin: {
        description: 'Social media and web presence',
      },
    },


    // === MEMBERSHIP EXTENSION (Phase 0, §2.7 — appended, existing hooks untouched) ===
    {
      name: 'currentSubscription',
      type: 'relationship',
      relationTo: 'vendor-subscriptions',
      admin: {
        position: 'sidebar',
        description: 'Denormalized by subscription afterChange',
      },
    },
    {
      name: 'subscriptionStatus',
      type: 'select',
      defaultValue: 'none',
      options: [
        { label: 'none', value: 'none' },
        { label: 'pending', value: 'pending' },
        { label: 'trialing', value: 'trialing' },
        { label: 'active', value: 'active' },
        { label: 'past_due', value: 'past_due' },
        { label: 'grace', value: 'grace' },
        { label: 'suspended', value: 'suspended' },
        { label: 'cancelled', value: 'cancelled' },
        { label: 'expired', value: 'expired' },
      ],
      admin: { position: 'sidebar' },
    },
    {
      name: 'subscriptionExpiresAt',
      type: 'date',
      admin: { position: 'sidebar' },
    },
    {
      name: 'graceEndsAt',
      type: 'date',
      admin: { position: 'sidebar' },
    },
    {
      name: 'trialEndsAt',
      type: 'date',
      admin: { position: 'sidebar' },
    },
    {
      name: 'waivedUntil',
      type: 'date',
      admin: { position: 'sidebar' },
    },
    {
      name: 'waiveReason',
      type: 'textarea',
      admin: { position: 'sidebar' },
    },
    {
      name: 'suspendedReason',
      type: 'text',
      admin: { position: 'sidebar' },
    },
    {
      name: 'grandfatheredBasic',
      type: 'checkbox',
      defaultValue: false,
      admin: { position: 'sidebar' },
    },
    {
      name: 'grandfatheredAt',
      type: 'date',
      admin: { position: 'sidebar', readOnly: true },
    },
    {
      name: 'commissionOverride',
      type: 'group',
      fields: [
        { name: 'commission_percent', type: 'number', min: 0, max: 100 },
        { name: 'transaction_fee', type: 'number', min: 0, defaultValue: 0 },
        { name: 'rule', type: 'relationship', relationTo: 'commission-rules' },
      ],
      admin: { description: 'Vendor-level override (highest priority)' },
    },
    {
      name: 'kycDocs',
      type: 'array',
      fields: [
        {
          name: 'docType',
          type: 'select',
          required: true,
          options: [
            { label: 'dti', value: 'dti' },
            { label: 'sec', value: 'sec' },
            { label: 'bir', value: 'bir' },
            { label: 'id_front', value: 'id_front' },
            { label: 'id_back', value: 'id_back' },
            { label: 'selfie', value: 'selfie' },
            { label: 'other', value: 'other' },
          ],
        },
        { name: 'media', type: 'upload', relationTo: 'media', required: true },
      ],
      admin: { description: 'KYB documents (verification is manual for now)' },
    },
    {
      name: 'lastEntitlementSync',
      type: 'date',
      admin: { position: 'sidebar', readOnly: true },
    },
  ],
  hooks: {
    afterChange: [
      async ({ doc, operation, req }) => {
        if (operation === 'create') {
          await createAdminNotificationFanout(req.payload, {
            typeKey: 'vendor.created',
            domain: 'system',
            title: 'New vendor registered',
            body: `${doc.businessName || 'A vendor'} was registered and may require verification.`,
            sourceEntityType: 'vendor',
            sourceEntityId: doc.id,
            priority: 'warning',
            metadata: { vendorId: doc.id, verificationStatus: doc.verificationStatus },
          })
        }
        return doc
      },
    ],
    beforeValidate: [
      ({ data }) => data ? validateStoreHoursFields(data as Record<string, unknown>) : data,
    ],
    beforeChange: [
      ({ data }) => {
        // Auto-generate onboarding date if not provided
        if (!data.onboardingDate) {
          data.onboardingDate = new Date().toISOString()
        }
        return data
      },
    ],
  },
}
