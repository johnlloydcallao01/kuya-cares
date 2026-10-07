import type { Access, AccessArgs, CollectionConfig } from 'payload'
import { APIError } from 'payload'
import { adminOnly } from '../access'

/**
 * Private members-only marketplace orders (peer-to-peer, same-account buy+sell).
 *
 * Unified model: `admin` supervises all; `member` is a single account that
 * buys AND sells. Both buyer and seller can read their shared order; only
 * staff can delete (history preservation). Price/listing parties are
 * immutable for non-admins; status follows a strict transition map.
 */

const STAFF_ROLES = ['admin', 'service']
const TRADER_ROLES = ['admin', 'service', 'member']

type MemberOrderStatus = 'pending' | 'confirmed' | 'handed_over' | 'completed' | 'cancelled'

const ALLOWED_TRANSITIONS: Record<MemberOrderStatus, MemberOrderStatus[]> = {
  pending: ['confirmed', 'cancelled'],
  confirmed: ['handed_over', 'cancelled'],
  handed_over: ['completed', 'cancelled'],
  completed: [],
  cancelled: [],
}

const AVAILABLE_LISTING_STATUSES = ['active', 'reserved']

const isStaffRole = (role: unknown): boolean =>
  typeof role === 'string' && STAFF_ROLES.includes(role)

const canTrade = (role: unknown): boolean =>
  typeof role === 'string' && TRADER_ROLES.includes(role)

const resolveId = (value: unknown): string | null => {
  if (value == null) return null
  if (typeof value === 'string' || typeof value === 'number') return String(value)
  if (typeof value === 'object' && 'id' in (value as Record<string, unknown>)) {
    const id = (value as Record<string, unknown>).id
    return id == null ? null : String(id)
  }
  return null
}

const IMMUTABLE_FIELDS = ['listing', 'buyer', 'seller', 'price'] as const

export const MemberOrders: CollectionConfig = {
  slug: 'member-orders',
  dbName: 'member_orders',
  admin: {
    useAsTitle: 'id',
    defaultColumns: ['listing', 'buyer', 'seller', 'price', 'status'],
    group: 'Members',
    description:
      'Private-circle orders. Buyer+seller share one member account type; admin supervises.',
  },
  access: {
    read: (({ req: { user } }: AccessArgs) => {
      if (!user) return false
      if (isStaffRole(user.role)) return true
      if (user.role === 'member') {
        return {
          or: [
            { buyer: { equals: user.id } },
            { seller: { equals: user.id } },
          ] as Record<string, unknown>[],
        }
      }
      return false
    }) as Access,
    create: ({ req: { user } }) => {
      if (!user) return false
      return canTrade(user.role)
    },
    update: (({ req: { user } }: AccessArgs) => {
      if (!user) return false
      if (isStaffRole(user.role)) return true
      // Both parties may progress their shared order (hook enforces field guards).
      if (user.role === 'member') {
        return {
          or: [
            { buyer: { equals: user.id } },
            { seller: { equals: user.id } },
          ] as Record<string, unknown>[],
        }
      }
      return false
    }) as Access,
    delete: adminOnly,
  },
  fields: [
    {
      name: 'listing',
      type: 'relationship',
      relationTo: 'member-listings',
      required: true,
      index: true,
      admin: {
        description: 'Listing being purchased (immutable)',
      },
    },
    {
      name: 'buyer',
      type: 'relationship',
      relationTo: 'users',
      required: true,
      index: true,
      admin: {
        description: 'Buying member (auto-set from the signed-in user)',
      },
    },
    {
      name: 'seller',
      type: 'relationship',
      relationTo: 'users',
      required: true,
      index: true,
      admin: {
        description: 'Selling member (snapshot from the listing)',
      },
    },
    {
      name: 'price',
      type: 'number',
      required: true,
      min: 0,
      admin: {
        description: 'Agreed price snapshot (>= 0, immutable)',
        step: 0.01,
      },
    },
    {
      name: 'quantity',
      type: 'number',
      defaultValue: 1,
      min: 1,
      admin: {
        description: 'Quantity purchased (>= 1)',
        step: 1,
      },
    },
    {
      name: 'status',
      type: 'select',
      required: true,
      defaultValue: 'pending',
      options: [
        { label: 'Pending', value: 'pending' },
        { label: 'Confirmed', value: 'confirmed' },
        { label: 'Handed Over', value: 'handed_over' },
        { label: 'Completed', value: 'completed' },
        { label: 'Cancelled', value: 'cancelled' },
      ],
    },
    {
      name: 'meetupNotes',
      type: 'textarea',
      admin: {
        description: 'Handover / meetup coordination notes',
      },
    },
    {
      name: 'cancelledReason',
      type: 'text',
      admin: {
        description: 'Reason when the order is cancelled',
      },
    },
    {
      name: 'completedAt',
      type: 'date',
      admin: {
        readOnly: true,
        description: 'When the order completed',
        date: { pickerAppearance: 'dayAndTime' },
      },
    },
  ],
  indexes: [
    { fields: ['buyer'] },
    { fields: ['seller'] },
    { fields: ['listing'] },
    { fields: ['status'] },
    { fields: ['buyer', 'status'] },
    { fields: ['seller', 'status'] },
  ],
  hooks: {
    beforeChange: [
      async ({ data, originalDoc, operation, req }) => {
        const d = (data ?? {}) as Record<string, unknown>
        const role = req.user?.role as string | undefined

        if (operation === 'create') {
          if (!req.user || !canTrade(role)) {
            throw new APIError('Only members, service accounts, or admins can order', 403, null, true)
          }

          const listingId = resolveId(d.listing)
          if (!listingId) {
            throw new APIError('listing is required', 400, null, true)
          }

          // Validation read with overrideAccess (enterprise pattern): the
          // listing itself is private-circle, so direct reads would fail for
          // edge roles; authorization is enforced below instead.
          let listing: Record<string, unknown>
          try {
            listing = (await req.payload.findByID({
              collection: 'member-listings',
              id: listingId,
              overrideAccess: true,
              depth: 0,
            })) as unknown as Record<string, unknown>
          } catch {
            throw new APIError('Listing not found', 404, null, true)
          }

          const listingStatus = String(listing.status ?? '')
          if (!AVAILABLE_LISTING_STATUSES.includes(listingStatus)) {
            throw new APIError(
              `Listing is not available (status: ${listingStatus || 'unknown'})`,
              409,
              null,
              true,
            )
          }

          const listingSeller = resolveId(listing.seller)
          const buyerId = resolveId(d.buyer) ?? (req.user.id ? String(req.user.id) : null)
          if (!buyerId) {
            throw new APIError('buyer is required', 400, null, true)
          }
          if (listingSeller && listingSeller === buyerId) {
            throw new APIError('You cannot buy your own listing', 400, null, true)
          }

          // Auto-fill buyer / seller / price snapshot.
          d.buyer = buyerId
          if (listingSeller) d.seller = listing.seller
          if ((d.price === undefined || d.price === null) && listing.price !== undefined) {
            d.price = listing.price
          }

          const wantQty = Number(d.quantity ?? 1)
          const haveQty = Number((listing.quantity as number | undefined) ?? 1)
          if (!Number.isFinite(wantQty) || wantQty < 1) {
            throw new APIError('Quantity must be >= 1', 400, null, true)
          }
          if (Number.isFinite(haveQty) && wantQty > haveQty) {
            throw new APIError('Quantity exceeds listing availability', 400, null, true)
          }
          if (d.price === undefined || d.price === null || Number(d.price) < 0) {
            throw new APIError('Price must be >= 0', 400, null, true)
          }

          return d
        }

        if (operation === 'update') {
          const prev = (originalDoc ?? {}) as Record<string, unknown>

          // Immutable fields guard (admin bypass).
          if (role !== 'admin') {
            for (const field of IMMUTABLE_FIELDS) {
              const incoming = resolveId(d[field]) ?? (d[field] as string | undefined)
              const original = resolveId(prev[field])
              if (
                incoming !== undefined &&
                incoming !== null &&
                original !== null &&
                String(incoming) !== String(original)
              ) {
                throw new APIError(`${field} cannot be changed`, 400, null, true)
              }
            }
          }

          // Status transition guard (admin bypass).
          const prevStatus = prev.status as MemberOrderStatus | undefined
          const nextStatus = (d.status ?? prevStatus) as MemberOrderStatus | undefined
          if (prevStatus && nextStatus && nextStatus !== prevStatus && role !== 'admin') {
            const allowed = ALLOWED_TRANSITIONS[prevStatus] ?? []
            if (!allowed.includes(nextStatus)) {
              throw new APIError(
                `Invalid status transition: ${prevStatus} -> ${nextStatus}`,
                400,
                null,
                true,
              )
            }
          }

          // Stamp completedAt when completing.
          if (nextStatus === 'completed' && prevStatus !== 'completed' && !d.completedAt) {
            d.completedAt = new Date().toISOString()
          }

          return d
        }

        return d
      },
    ],
    afterChange: [
      async ({ doc, previousDoc, operation, req }) => {
        try {
          const next = (doc ?? {}) as Record<string, unknown>
          const listingId = resolveId(next.listing)
          if (!listingId) return doc

          if (operation === 'create') {
            // Reserve the listing so a second buyer cannot grab it.
            // Fire-and-forget: never fail order creation on this side effect.
            void req.payload
              .update({
                collection: 'member-listings',
                id: listingId,
                data: { status: 'reserved' },
                overrideAccess: true,
                depth: 0,
              })
              .catch(() => {})
            return doc
          }

          if (operation === 'update') {
            const prevStatus = (previousDoc as Record<string, unknown> | undefined)?.status
            const nextStatus = next.status
            if (nextStatus === 'completed' && prevStatus !== 'completed') {
              // Mark the listing sold and record buyer + timestamp.
              // Fire-and-forget: never fail the order update on this side effect.
              const buyerId = resolveId(next.buyer)
              // Users use numeric ids: only pass buyer when it parses as one.
              const buyerNumericId =
                buyerId == null || buyerId === '' || Number.isNaN(Number(buyerId))
                  ? undefined
                  : Number(buyerId)
              void req.payload
                .update({
                  collection: 'member-listings',
                  id: listingId,
                  data: {
                    status: 'sold',
                    ...(buyerNumericId !== undefined ? { buyer: buyerNumericId } : {}),
                    soldAt: new Date().toISOString(),
                  },
                  overrideAccess: true,
                  depth: 0,
                })
                .catch(() => {})
            }
          }
        } catch {
          // Never break core order writes on listing fan-out failures.
        }
        return doc
      },
    ],
  },
  timestamps: true,
}
