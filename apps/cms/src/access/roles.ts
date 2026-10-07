import type { Access } from 'payload'

/**
 * Unified private-marketplace roles.
 *
 * - `admin` supervises everything (all collections, all members).
 * - `member` is a single unified account that BOTH buys and sells inside the
 *   private circle (member-listings + member-orders + member-invites).
 * - `customer` | `vendor` | `driver` | `service` are kept for backwards
 *   compatibility with the existing B2B2C flows and must not be removed.
 *
 * This module is unit-test-friendly: pure functions only, no payload runtime
 * import (types only). Every access factory handles `!user => false`.
 */

export type Role = 'admin' | 'member' | 'customer' | 'vendor' | 'driver' | 'service'

export interface RoleUser {
  id: string | number
  role?: string | null
}

const roleOf = (user: RoleUser | null | undefined): string => {
  if (!user || typeof user.role !== 'string') return ''
  return user.role
}

/** True when the user is a platform admin (supervises all). */
export const isAdmin = (user: RoleUser | null | undefined): boolean => roleOf(user) === 'admin'

/** True when the user is a service account (server-to-server). */
export const isService = (user: RoleUser | null | undefined): boolean =>
  roleOf(user) === 'service'

/** True for staff: admin or service. Staff bypass ownership constraints. */
export const isStaff = (user: RoleUser | null | undefined): boolean => {
  const role = roleOf(user)
  return role === 'admin' || role === 'service'
}

/**
 * True for unified private-marketplace accounts.
 * A member buys AND sells with the same account.
 */
export const isMember = (user: RoleUser | null | undefined): boolean =>
  roleOf(user) === 'member'

/** True for admin or service (staff gate). */
export const isAdminOrService = (user: RoleUser | null | undefined): boolean => isStaff(user)

/**
 * True when the user is staff, or when `id` matches the user's own id.
 * Used for user-scoped reads/updates.
 */
export const isAdminOrSelf = (
  user: RoleUser | null | undefined,
  id: string | number | null | undefined,
): boolean => {
  if (!user) return false
  if (isStaff(user)) return true
  if (id == null) return false
  return String(user.id) === String(id)
}

/**
 * Ownership where-clause for a relationship/text field pointing at the user.
 * Returns `true` for staff, `{ [field]: { equals: user.id } }` for members,
 * and `false` for everyone else (including anonymous).
 *
 * @example
 * read: ({ req: { user } }) => ownerConstraint(user)('seller')
 */
export const ownerConstraint =
  (user: RoleUser | null | undefined) =>
  (field: string): true | { [key: string]: { equals: string | number } } | false => {
    if (!user) return false
    if (isStaff(user)) return true
    if (isMember(user)) return { [field]: { equals: user.id } }
    return false
  }

/** Staff-only gate (admin | service). Handles `!user => false`. */
export const adminOrServiceOnly: Access = ({ req: { user } }) => {
  if (!user) return false
  const role = (user as RoleUser).role
  return role === 'admin' || role === 'service'
}

/**
 * Admin-only gate (re-export compatible with existing `adminOnly`).
 * Handles `!user => false`.
 */
export const adminOnlyAccess: Access = ({ req: { user } }) => {
  if (!user) return false
  return (user as RoleUser).role === 'admin'
}

/**
 * Ownership gate for member-owned documents.
 * Staff see everything; members see only docs where `field` equals their id.
 *
 * @param field relationship field pointing at `users` (e.g. 'seller', 'buyer',
 * 'user', 'claimedBy', 'invitedBy').
 */
export const memberOwnsField = (field: string): Access => {
  return ({ req: { user } }) => {
    if (!user) return false
    const u = user as RoleUser
    if (isStaff(u)) return true
    if (isMember(u)) return { [field]: { equals: u.id } }
    return false
  }
}

/**
 * Admin-or-owner gate: staff bypass, members constrained to `fieldName`.
 * Non-staff, non-member roles get `false` (no access).
 */
export const adminOrOwner = (fieldName: string): Access => {
  return ({ req: { user } }) => {
    if (!user) return false
    const u = user as RoleUser
    if (isStaff(u)) return true
    if (isMember(u)) return { [fieldName]: { equals: u.id } }
    return false
  }
}

/**
 * Private-catalog read gate: only the private circle may browse.
 * Admins and service accounts supervise; members buy+sell. Every other role
 * (customer, vendor, driver) and anonymous callers are blocked.
 */
export const memberOrStaff: Access = ({ req: { user } }) => {
  if (!user) return false
  const role = (user as RoleUser).role
  return role === 'admin' || role === 'service' || role === 'member'
}
