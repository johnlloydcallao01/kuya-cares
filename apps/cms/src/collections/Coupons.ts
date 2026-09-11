import type { CollectionConfig } from 'payload'

export const COUPON_CODE_PATTERN = /^[A-Z0-9][A-Z0-9\-_&$@]*$/
export const COUPON_CODE_MIN = 3
export const COUPON_CODE_MAX = 32

export const PAYMENT_METHOD_OPTIONS = [
  { label: 'Card', value: 'card' },
  { label: 'GCash', value: 'gcash' },
  { label: 'GrabPay', value: 'grab_pay' },
  { label: 'PayMaya', value: 'paymaya' },
  { label: 'BillEase', value: 'billease' },
  { label: 'Cash on Delivery', value: 'dob' },
  { label: 'Brankas', value: 'brankas' },
  { label: 'QR Ph', value: 'qrph' },
]

export function normalizeCouponCode(raw: unknown): string {
  return String(raw ?? '')
    .trim()
    .toUpperCase()
}

/**
 * Cross-field validation shared by the collection hook and the admin BFF.
 * Returns an error message, or null when the doc is valid.
 * WooCommerce parity: percent 0-100, min<=max, limit sane, scope complete.
 */
export function validateCouponFields(doc: Record<string, any>): string | null {
  const code = typeof doc.code === 'string' ? doc.code : ''
  if (!code) return 'Coupon code is required'
  if (code.length < COUPON_CODE_MIN || code.length > COUPON_CODE_MAX) {
    return `Coupon code must be ${COUPON_CODE_MIN}-${COUPON_CODE_MAX} characters`
  }
  if (!COUPON_CODE_PATTERN.test(code)) {
    return 'Coupon code may only contain letters, numbers, and - _ & $ @'
  }

  const discountType = doc.discount_type
  if (discountType !== 'percent' && discountType !== 'fixed_cart' && discountType !== 'fixed_product') {
    return 'discount_type must be percent, fixed_cart, or fixed_product'
  }

  const amount = Number(doc.amount)
  if (!Number.isFinite(amount) || amount <= 0) return 'Coupon amount must be greater than 0'
  if (discountType === 'percent' && amount > 100) return 'Percentage coupons cannot exceed 100'

  if (doc.max_discount_amount !== undefined && doc.max_discount_amount !== null) {
    const cap = Number(doc.max_discount_amount)
    if (!Number.isFinite(cap) || cap <= 0) return 'max_discount_amount must be greater than 0'
  }
  if (doc.delivery_discount_cap !== undefined && doc.delivery_discount_cap !== null) {
    const cap = Number(doc.delivery_discount_cap)
    if (!Number.isFinite(cap) || cap <= 0) return 'delivery_discount_cap must be greater than 0'
  }

  const min = doc.minimum_basket
  const max = doc.maximum_basket
  if (min !== undefined && min !== null && max !== undefined && max !== null) {
    if (Number(min) > Number(max)) return 'minimum_basket cannot be greater than maximum_basket'
  }

  if (doc.merchant_scope === 'selected_branches') {
    const list = doc.merchants
    if (!Array.isArray(list) || list.length === 0) {
      return 'Select at least one branch when merchant scope is selected_branches'
    }
  }

  if (doc.limit_per_order_items !== undefined && doc.limit_per_order_items !== null) {
    const n = Number(doc.limit_per_order_items)
    if (!Number.isFinite(n) || n < 1) return 'limit_per_order_items must be at least 1'
    const hasAllowlist =
      (Array.isArray(doc.menu_items) && doc.menu_items.length > 0) ||
      (Array.isArray(doc.menu_categories) && doc.menu_categories.length > 0)
    if (!hasAllowlist) {
      return 'limit_per_order_items only works when menu items or categories are set'
    }
  }

  if (doc.funded_by === 'split') {
    const pct = Number(doc.vendor_share_pct)
    if (!Number.isFinite(pct) || pct <= 0 || pct >= 100) {
      return 'vendor_share_pct must be between 1 and 99 when funded_by is split'
    }
  }

  const usageLimit = Number(doc.usage_limit ?? 0)
  const perUser = Number(doc.usage_limit_per_user ?? 0)
  if (usageLimit < 0 || perUser < 0) return 'Usage limits cannot be negative'
  if (usageLimit > 0 && perUser > usageLimit) {
    return 'usage_limit_per_user cannot exceed usage_limit'
  }

  const startsAt = doc.starts_at ? new Date(doc.starts_at).getTime() : NaN
  const expiresAt = doc.expires_at ? new Date(doc.expires_at).getTime() : NaN
  if (!Number.isNaN(startsAt) && !Number.isNaN(expiresAt) && startsAt >= expiresAt) {
    return 'starts_at must be before expires_at'
  }

  return null
}

export const Coupons: CollectionConfig = {
  slug: 'coupons',
  admin: {
    useAsTitle: 'code',
    defaultColumns: ['code', 'discount_type', 'amount', 'status', 'vendor', 'usage_count', 'expires_at'],
    group: 'Marketing',
    description: 'Master coupon codes (WooCommerce-style). Vendor = brand, merchants = branches.',
  },
  access: {
    read: ({ req: { user } }) => {
      if (user) {
        if (user.role === 'service' || user.role === 'admin') {
          return true
        }
      }
      return false
    },
    create: ({ req: { user } }) => {
      return user?.role === 'admin' || false
    },
    update: ({ req: { user } }) => {
      return user?.role === 'admin' || false
    },
    delete: ({ req: { user } }) => {
      return user?.role === 'admin' || false
    },
  },
  timestamps: true,
  indexes: [
    { fields: ['code', 'vendor'], unique: true },
    { fields: ['status', 'expires_at'] },
    { fields: ['vendor'] },
    { fields: ['code'] },
  ],
  hooks: {
    beforeValidate: [
      ({ data }) => {
        if (!data || typeof data !== 'object') return data
        const d = data as Record<string, any>
        if (typeof d.code === 'string') {
          d.code = normalizeCouponCode(d.code)
        }
        // Lowercase contact allowlists for case-insensitive matching (WooCommerce parity)
        for (const key of ['email_restrictions', 'phone_restrictions'] as const) {
          if (Array.isArray(d[key])) {
            d[key] = (d[key] as unknown[])
              .map((v) => String(v ?? '').trim().toLowerCase())
              .filter(Boolean)
          }
        }
        const error = validateCouponFields(d)
        if (error) {
          throw new Error(error)
        }
        return d
      },
    ],
  },
  fields: [
    {
      name: 'code',
      type: 'text',
      required: true,
      admin: {
        description: 'Uppercase code, e.g. JOLLIBEE10. Case-insensitive at checkout.',
      },
    },
    {
      name: 'description',
      type: 'textarea',
      admin: {
        description: 'Internal notes only (never shown to customers).',
      },
    },
    {
      name: 'status',
      type: 'select',
      required: true,
      defaultValue: 'draft',
      options: [
        { label: 'Draft', value: 'draft' },
        { label: 'Scheduled', value: 'scheduled' },
        { label: 'Published', value: 'published' },
        { label: 'Paused', value: 'paused' },
        { label: 'Archived', value: 'archived' },
      ],
      admin: {
        description: 'Only published coupons within their date window can be used.',
      },
    },
    {
      name: 'discount_type',
      type: 'select',
      required: true,
      defaultValue: 'fixed_cart',
      options: [
        { label: 'Percentage off', value: 'percent' },
        { label: 'Fixed amount off basket', value: 'fixed_cart' },
        { label: 'Fixed amount off each item', value: 'fixed_product' },
      ],
    },
    {
      name: 'amount',
      type: 'number',
      required: true,
      min: 0,
      admin: {
        description: 'Percent (0-100) or peso amount, depending on discount type.',
      },
    },
    {
      name: 'max_discount_amount',
      type: 'number',
      min: 0,
      admin: {
        description: 'Cap for percentage coupons, e.g. 20% off up to ₱100.',
      },
    },
    {
      name: 'applies_to',
      type: 'select',
      required: true,
      defaultValue: 'food_subtotal',
      options: [
        { label: 'Food subtotal', value: 'food_subtotal' },
        { label: 'Delivery fee', value: 'delivery_fee' },
        { label: 'Both', value: 'both' },
      ],
    },
    {
      name: 'free_delivery',
      type: 'checkbox',
      defaultValue: false,
      admin: {
        description: 'Zero out the delivery fee leg (capped below when set).',
      },
    },
    {
      name: 'delivery_discount_cap',
      type: 'number',
      min: 0,
      admin: {
        description: 'Max pesos discounted on delivery, e.g. free delivery up to ₱80.',
      },
    },
    {
      name: 'vendor',
      type: 'relationship',
      relationTo: 'vendors',
      admin: {
        description: 'Brand that owns this coupon (e.g. Jollibee). Empty = platform-wide.',
      },
    },
    {
      name: 'merchant_scope',
      type: 'select',
      required: true,
      defaultValue: 'all_vendor_branches',
      options: [
        { label: 'All vendor branches', value: 'all_vendor_branches' },
        { label: 'Selected branches', value: 'selected_branches' },
      ],
    },
    {
      name: 'merchants',
      type: 'relationship',
      relationTo: 'merchants',
      hasMany: true,
      admin: {
        description: 'Branches this coupon works at. Empty = all branches of the vendor.',
        condition: (data) => (data as any)?.merchant_scope === 'selected_branches',
      },
    },
    {
      name: 'menu_items',
      type: 'relationship',
      relationTo: 'products',
      hasMany: true,
      admin: {
        description: 'Only these menu items qualify. Empty = all items.',
      },
    },
    {
      name: 'excluded_menu_items',
      type: 'relationship',
      relationTo: 'products',
      hasMany: true,
    },
    {
      name: 'menu_categories',
      type: 'relationship',
      relationTo: 'product-categories',
      hasMany: true,
      admin: {
        description: 'Only these menu categories qualify. Empty = all categories.',
      },
    },
    {
      name: 'excluded_menu_categories',
      type: 'relationship',
      relationTo: 'product-categories',
      hasMany: true,
    },
    {
      name: 'exclude_promo_items',
      type: 'checkbox',
      defaultValue: false,
      admin: {
        description: 'Skip items already on promo (compare-at price set).',
      },
    },
    {
      name: 'minimum_basket',
      type: 'number',
      min: 0,
      admin: {
        description: 'Minimum food subtotal to qualify. Empty = no minimum.',
      },
    },
    {
      name: 'maximum_basket',
      type: 'number',
      min: 0,
      admin: {
        description: 'Maximum food subtotal to qualify. Empty = no maximum.',
      },
    },
    {
      name: 'limit_per_order_items',
      type: 'number',
      min: 1,
      admin: {
        description: 'Max discounted units per order. Only works when menu items/categories are set.',
      },
    },
    {
      name: 'individual_use',
      type: 'checkbox',
      defaultValue: true,
      admin: {
        description: 'One coupon per order (recommended for food delivery).',
      },
    },
    {
      name: 'max_coupons_per_order',
      type: 'number',
      defaultValue: 1,
      min: 1,
    },
    {
      name: 'starts_at',
      type: 'date',
      admin: {
        date: { pickerAppearance: 'dayAndTime' },
        description: 'Coupon becomes usable at this time.',
      },
    },
    {
      name: 'expires_at',
      type: 'date',
      admin: {
        date: { pickerAppearance: 'dayAndTime' },
        description: 'Coupon stops working after this time.',
      },
    },
    {
      name: 'usage_limit',
      type: 'number',
      defaultValue: 0,
      min: 0,
      admin: {
        description: 'Total redemptions allowed. 0 = unlimited.',
      },
    },
    {
      name: 'usage_limit_per_user',
      type: 'number',
      defaultValue: 0,
      min: 0,
      admin: {
        description: 'Redemptions allowed per customer. 0 = unlimited.',
      },
    },
    {
      name: 'usage_count',
      type: 'number',
      defaultValue: 0,
      min: 0,
      admin: {
        readOnly: true,
        description: 'Successful redemptions (updated automatically).',
      },
    },
    {
      name: 'email_restrictions',
      type: 'text',
      hasMany: true,
      admin: {
        description: 'Only these emails qualify. Supports * wildcards, e.g. *@gmail.com.',
      },
    },
    {
      name: 'phone_restrictions',
      type: 'text',
      hasMany: true,
      admin: {
        description: 'Only these phone numbers qualify. Supports * wildcards.',
      },
    },
    {
      name: 'first_order_only',
      type: 'checkbox',
      defaultValue: false,
    },
    {
      name: 'allowed_payment_methods',
      type: 'select',
      hasMany: true,
      options: PAYMENT_METHOD_OPTIONS,
      admin: {
        description: 'Only these payment methods qualify. Empty = all methods.',
      },
    },
    {
      name: 'time_windows',
      type: 'array',
      admin: {
        description: 'Optional daypart schedule, e.g. lunch rush Mon-Fri 11:00-14:00.',
      },
      fields: [
        {
          name: 'days',
          type: 'select',
          hasMany: true,
          required: true,
          options: [
            { label: 'Monday', value: 'mon' },
            { label: 'Tuesday', value: 'tue' },
            { label: 'Wednesday', value: 'wed' },
            { label: 'Thursday', value: 'thu' },
            { label: 'Friday', value: 'fri' },
            { label: 'Saturday', value: 'sat' },
            { label: 'Sunday', value: 'sun' },
          ],
        },
        {
          name: 'start_time',
          type: 'text',
          required: true,
          admin: { description: 'HH:mm, 24h' },
        },
        {
          name: 'end_time',
          type: 'text',
          required: true,
          admin: { description: 'HH:mm, 24h' },
        },
      ],
    },
    {
      name: 'funded_by',
      type: 'select',
      required: true,
      defaultValue: 'platform',
      options: [
        { label: 'Platform', value: 'platform' },
        { label: 'Vendor', value: 'vendor' },
        { label: 'Split', value: 'split' },
      ],
      admin: {
        description: 'Who pays for the discount at settlement.',
      },
    },
    {
      name: 'vendor_share_pct',
      type: 'number',
      min: 0,
      max: 100,
      defaultValue: 0,
      admin: {
        description: 'Vendor share (1-99) when funded_by is split.',
      },
    },
  ],
}
