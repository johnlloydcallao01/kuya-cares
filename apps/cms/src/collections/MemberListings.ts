import type { CollectionConfig } from 'payload'
import { APIError } from 'payload'
import { memberOrStaff } from '../access/roles'

/**
 * Private members-only marketplace listings.
 *
 * Unified model: `admin` supervises all; `member` is a single account that
 * buys AND sells (no separate vendor onboarding). Only the private circle
 * (admin | service | member) can read or trade here.
 */

const STAFF_ROLES = ['admin', 'service']
const SELLER_ROLES = ['admin', 'service', 'member']

const isStaffRole = (role: unknown): boolean =>
  typeof role === 'string' && STAFF_ROLES.includes(role)

const canSell = (role: unknown): boolean =>
  typeof role === 'string' && SELLER_ROLES.includes(role)

const resolveId = (value: unknown): string | null => {
  if (value == null) return null
  if (typeof value === 'string' || typeof value === 'number') return String(value)
  if (typeof value === 'object' && 'id' in (value as Record<string, unknown>)) {
    const id = (value as Record<string, unknown>).id
    return id == null ? null : String(id)
  }
  return null
}

export const MemberListings: CollectionConfig = {
  slug: 'member-listings',
  dbName: 'member_listings',
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['title', 'price', 'status', 'seller', 'condition'],
    group: 'Members',
    description: 'Private-circle listings. Members buy+sell with one account; admin supervises.',
  },
  access: {
    // Private catalog: only authenticated circle members (admin|service|member).
    read: memberOrStaff,
    create: ({ req: { user } }) => {
      if (!user) return false
      return canSell(user.role)
    },
    update: ({ req: { user } }) => {
      if (!user) return false
      if (isStaffRole(user.role)) return true
      if (user.role === 'member') return { seller: { equals: user.id } }
      return false
    },
    delete: ({ req: { user } }) => {
      if (!user) return false
      if (isStaffRole(user.role)) return true
      if (user.role === 'member') return { seller: { equals: user.id } }
      return false
    },
  },
  fields: [
    {
      name: 'seller',
      type: 'relationship',
      relationTo: 'users',
      required: true,
      index: true,
      admin: {
        description: 'Listing owner (auto-set from the signed-in member)',
      },
    },
    {
      name: 'title',
      type: 'text',
      required: true,
      minLength: 3,
      maxLength: 120,
      admin: {
        description: 'Listing title (3-120 chars)',
      },
    },
    {
      name: 'description',
      type: 'textarea',
      maxLength: 2000,
      admin: {
        description: 'Optional details (max 2000 chars)',
      },
    },
    {
      name: 'price',
      type: 'number',
      required: true,
      min: 0,
      admin: {
        description: 'Price in listing currency (>= 0)',
        step: 0.01,
      },
    },
    {
      name: 'currency',
      type: 'text',
      defaultValue: 'PHP',
      admin: {
        description: 'ISO currency code',
      },
    },
    {
      name: 'condition',
      type: 'select',
      defaultValue: 'good',
      options: [
        { label: 'New', value: 'new' },
        { label: 'Like New', value: 'like_new' },
        { label: 'Good', value: 'good' },
        { label: 'Fair', value: 'fair' },
        { label: 'For Parts', value: 'for_parts' },
      ],
    },
    {
      name: 'category',
      type: 'text',
      admin: {
        description: 'Optional free-form category',
      },
    },
    {
      name: 'quantity',
      type: 'number',
      defaultValue: 1,
      min: 1,
      admin: {
        description: 'Available quantity (>= 1)',
        step: 1,
      },
    },
    {
      name: 'status',
      type: 'select',
      required: true,
      defaultValue: 'active',
      options: [
        { label: 'Draft', value: 'draft' },
        { label: 'Active', value: 'active' },
        { label: 'Reserved', value: 'reserved' },
        { label: 'Sold', value: 'sold' },
        { label: 'Removed', value: 'removed' },
      ],
    },
    {
      name: 'images',
      type: 'array',
      maxRows: 5,
      admin: {
        description: 'Up to 5 photos',
      },
      fields: [
        {
          name: 'image',
          type: 'upload',
          relationTo: 'media',
          required: true,
        },
      ],
    },
    {
      name: 'meetupNotes',
      type: 'textarea',
      admin: {
        description: 'Optional meetup / handover notes',
      },
    },
    {
      name: 'isActive',
      type: 'checkbox',
      defaultValue: true,
      admin: {
        description: 'Visible in the private catalog',
      },
    },
    {
      name: 'soldAt',
      type: 'date',
      admin: {
        readOnly: true,
        description: 'When the listing was sold',
        date: { pickerAppearance: 'dayAndTime' },
      },
    },
    {
      name: 'buyer',
      type: 'relationship',
      relationTo: 'users',
      admin: {
        readOnly: true,
        description: 'Buyer recorded when the listing is sold',
      },
    },
  ],
  indexes: [
    { fields: ['seller'] },
    { fields: ['status'] },
    { fields: ['seller', 'status'] },
    { fields: ['isActive'] },
    { fields: ['createdAt'] },
  ],
  hooks: {
    beforeChange: [
      ({ data, originalDoc, operation, req }) => {
        const d = (data ?? {}) as Record<string, unknown>
        const role = req.user?.role as string | undefined

        if (operation === 'create') {
          if (!req.user || !canSell(role)) {
            throw new APIError('Only members, service accounts, or admins can sell', 403, null, true)
          }
          // Sellers cannot list on behalf of someone else.
          if (!d.seller && req.user.id) {
            d.seller = req.user.id
          }
        }

        if (operation === 'update') {
          // Prevent seller reassignment unless admin.
          const incomingSeller = resolveId(d.seller)
          const originalSeller = resolveId(
            (originalDoc as Record<string, unknown> | undefined)?.seller,
          )
          if (
            incomingSeller &&
            originalSeller &&
            incomingSeller !== originalSeller &&
            role !== 'admin'
          ) {
            throw new APIError('Listing ownership cannot be transferred', 400, null, true)
          }

          // Stamp soldAt when moving to sold.
          const prevStatus = (originalDoc as Record<string, unknown> | undefined)?.status
          if (d.status === 'sold' && prevStatus !== 'sold' && !d.soldAt) {
            d.soldAt = new Date().toISOString()
          }
        }

        // Field-level validation (defense in depth alongside min/max).
        if (d.price !== undefined && d.price !== null && Number(d.price) < 0) {
          throw new APIError('Price must be >= 0', 400, null, true)
        }
        if (d.quantity !== undefined && d.quantity !== null && Number(d.quantity) < 1) {
          throw new APIError('Quantity must be >= 1', 400, null, true)
        }

        return d
      },
    ],
  },
  timestamps: true,
}
