import type { Access, AccessArgs, CollectionConfig } from 'payload'
import { APIError } from 'payload'
import { adminOnly } from '../access'

/**
 * Private members-only marketplace invites (invite / private-circle primitive).
 *
 * Unified model: `admin` supervises all; `member` is a single account that
 * buys AND sells. Invites gate entry into the private circle (50-100 people).
 * Code redemption lookups run via the BFF with `overrideAccess`, so read
 * access stays restricted to staff + involved parties.
 */

type MemberInviteStatus = 'pending' | 'claimed' | 'revoked' | 'expired'

const STAFF_ROLES = ['admin', 'service']

const isStaffRole = (role: unknown): boolean =>
  typeof role === 'string' && STAFF_ROLES.includes(role)

const resolveId = (value: unknown): string | null => {
  if (value == null) return null
  if (typeof value === 'string' || typeof value === 'number') return String(value)
  if (typeof value === 'object' && 'id' in (value as Record<string, unknown>)) {
    const id = (value as Record<string, unknown>).id
    return id == null ? null : String(id)
  }
  return null
}

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000

export const MemberInvites: CollectionConfig = {
  slug: 'member-invites',
  dbName: 'member_invites',
  admin: {
    useAsTitle: 'code',
    defaultColumns: ['code', 'email', 'status', 'invitedBy', 'claimedBy', 'expiresAt'],
    group: 'Members',
    description:
      'Private-circle invite codes. Admin supervises; members buy+sell with one account.',
  },
  access: {
    read: (({ req: { user } }: AccessArgs) => {
      if (!user) return false
      if (isStaffRole(user.role)) return true
      return {
        or: [
          { invitedBy: { equals: user.id } },
          { claimedBy: { equals: user.id } },
        ] as Record<string, unknown>[],
      }
    }) as Access,
    create: ({ req: { user } }) => {
      if (!user) return false
      // Admins/service manage the circle; members may invite friends.
      return isStaffRole(user.role) || user.role === 'member'
    },
    update: ({ req: { user } }) => {
      if (!user) return false
      if (isStaffRole(user.role)) return true
      // Members may only touch invites they issued (status guard in hooks).
      if (user.role === 'member') return { invitedBy: { equals: user.id } }
      return false
    },
    delete: adminOnly,
  },
  fields: [
    {
      name: 'code',
      type: 'text',
      required: true,
      unique: true,
      minLength: 6,
      index: true,
      admin: {
        description: 'Invite code, normalized to uppercase (min 6 chars)',
      },
    },
    {
      name: 'email',
      type: 'email',
      admin: {
        description: 'Optional invitee email',
      },
    },
    {
      name: 'status',
      type: 'select',
      required: true,
      defaultValue: 'pending',
      options: [
        { label: 'Pending', value: 'pending' },
        { label: 'Claimed', value: 'claimed' },
        { label: 'Revoked', value: 'revoked' },
        { label: 'Expired', value: 'expired' },
      ],
      admin: {
        description: 'Invite lifecycle status',
      },
    },
    {
      name: 'invitedBy',
      type: 'relationship',
      relationTo: 'users',
      required: true,
      index: true,
      admin: {
        description: 'User who issued the invite (auto-set for member creators)',
      },
    },
    {
      name: 'claimedBy',
      type: 'relationship',
      relationTo: 'users',
      index: true,
      admin: {
        description: 'User who redeemed the invite',
      },
    },
    {
      name: 'expiresAt',
      type: 'date',
      admin: {
        description: 'Invite expiry (defaults to +30d on create)',
        date: { pickerAppearance: 'dayAndTime' },
      },
    },
    {
      name: 'claimedAt',
      type: 'date',
      admin: {
        readOnly: true,
        description: 'When the invite was claimed',
        date: { pickerAppearance: 'dayAndTime' },
      },
    },
    {
      name: 'notes',
      type: 'textarea',
      admin: {
        description: 'Internal notes about this invite',
      },
    },
  ],
  indexes: [
    { fields: ['code'], unique: true },
    { fields: ['status'] },
    { fields: ['invitedBy'] },
    { fields: ['claimedBy'] },
    { fields: ['expiresAt'] },
  ],
  hooks: {
    beforeChange: [
      ({ data, originalDoc, operation, req }) => {
        const d = (data ?? {}) as Record<string, unknown>

        if (operation === 'create') {
          // Normalize code: uppercase + trim.
          const rawCode = typeof d.code === 'string' ? d.code.trim().toUpperCase() : ''
          if (!rawCode || rawCode.length < 6) {
            throw new APIError('Invite code must be at least 6 characters', 400, null, true)
          }
          d.code = rawCode

          // Auto-set invitedBy from the authenticated user when not provided.
          if (!d.invitedBy && req.user?.id) {
            d.invitedBy = req.user.id
          }
          if (!d.invitedBy) {
            throw new APIError('invitedBy is required', 400, null, true)
          }

          // Default expiry +30d when missing.
          if (!d.expiresAt) {
            d.expiresAt = new Date(Date.now() + THIRTY_DAYS_MS).toISOString()
          }
          return d
        }

        if (operation === 'update') {
          const prevStatus = (originalDoc as Record<string, unknown> | undefined)
            ?.status as MemberInviteStatus | undefined
          const nextStatus = d.status as MemberInviteStatus | undefined

          // Only pending invites can transition (claim / revoke / expire).
          if (prevStatus && prevStatus !== 'pending' && nextStatus !== prevStatus) {
            throw new APIError(
              `Invite is already ${prevStatus} and cannot be re-claimed`,
              400,
              null,
              true,
            )
          }

          // Stamp claimedAt when moving to claimed.
          if (nextStatus === 'claimed' && prevStatus !== 'claimed') {
            d.claimedAt = new Date().toISOString()
            if (!d.claimedBy && req.user?.id) {
              d.claimedBy = req.user.id
            }
          }

          // Claimed invites must record who claimed them.
          if (nextStatus === 'claimed' && !d.claimedBy) {
            const prevClaimedBy = resolveId(
              (originalDoc as Record<string, unknown> | undefined)?.claimedBy,
            )
            if (!prevClaimedBy) {
              throw new APIError('claimedBy is required when claiming an invite', 400, null, true)
            }
          }

          return d
        }

        return d
      },
    ],
  },
  timestamps: true,
}
