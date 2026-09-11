import type { Access } from 'payload'

/**
 * Modifier configuration is catalog authoring data. Keep direct CRUD behind
 * authenticated service/admin identities; customer-facing reads use the
 * trusted effective-modifiers endpoints instead.
 */
export const modifierConfigurationAccess: Access = ({ req: { user } }) => {
  return user?.role === 'service' || user?.role === 'admin'
}
